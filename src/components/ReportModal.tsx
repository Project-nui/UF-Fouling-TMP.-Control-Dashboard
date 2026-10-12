import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Printer, FileText, CheckCircle2, AlertTriangle, ShieldCheck, Layers, Gauge } from 'lucide-react';
import { UnitAnalysis, MembraneParameters, formatDate, formatNumber, calculateLinearTrend } from '../utils/membraneCalculations';
import { ProcessedDataset, UNIT_COLORS } from '../data/initialData';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  analyses: UnitAnalysis[];
  params: MembraneParameters;
  dataset: ProcessedDataset;
  timeRangeStart: number;
  timeRangeEnd: number;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  analyses,
  params,
  dataset,
  timeRangeStart,
  timeRangeEnd
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);

  // Canvas refs for charts rendered inside the report
  const multiChartRef = useRef<HTMLCanvasElement | null>(null);
  const foulingCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const fluxCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  // Monthly aggregated data
  const monthlyData = React.useMemo(() => {
    const monthKey = (ms: number) => formatDate(ms).slice(0, 7);
    const map: Record<string, (number[] | null)[]> = {};

    analyses.forEach((a, k) => {
      a.activePoints.forEach(p => {
        const m = monthKey(p.timestamp);
        if (!map[m]) {
          map[m] = analyses.map(() => null);
        }
        if (!map[m][k]) {
          map[m][k] = [];
        }
        map[m][k]!.push(p.tmp);
      });
    });

    return Object.keys(map)
      .sort()
      .map(m => {
        return {
          month: m,
          units: analyses.map((_, k) => {
            const vals = map[m][k];
            if (!vals || vals.length === 0) return null;
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            const max = Math.max(...vals);
            return { avg, max };
          })
        };
      });
  }, [analyses]);

  // Overall statistics
  const overallSummary = React.useMemo(() => {
    let peakTmp = 0;
    let peakUnit = '-';
    let peakDate = '-';

    analyses.forEach(a => {
      a.activePoints.forEach(p => {
        if (p.tmp > peakTmp) {
          peakTmp = p.tmp;
          peakUnit = a.unitName;
          peakDate = p.dateStr;
        }
      });
    });

    const normalCount = analyses.filter(a => a.status === 'normal').length;
    const warningCount = analyses.filter(a => a.status === 'warning').length;
    const criticalCount = analyses.filter(a => a.status === 'critical').length;

    return {
      peakTmp,
      peakUnit,
      peakDate,
      normalCount,
      warningCount,
      criticalCount
    };
  }, [analyses]);

  // Render Charts onto Report Canvases
  useEffect(() => {
    if (!isOpen) return;

    // 1. Draw Multi-Unit TMP Trend Chart
    const multiCanvas = multiChartRef.current;
    if (multiCanvas) {
      const W = 720;
      const H = 240;
      multiCanvas.width = W * 2;
      multiCanvas.height = H * 2;
      const ctx = multiCanvas.getContext('2d');
      if (ctx) {
        ctx.scale(2, 2);
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        const padLeft = 45;
        const padRight = 15;
        const padTop = 15;
        const padBottom = 30;
        const plotW = W - padLeft - padRight;
        const plotH = H - padTop - padBottom;

        const allTs: number[] = [];
        analyses.forEach(a => a.activePoints.forEach(p => allTs.push(p.timestamp)));
        const ptsMin = allTs.length > 0 ? Math.min(...allTs) : Date.now() - 86400000;
        const ptsMax = allTs.length > 0 ? Math.max(...allTs) : Date.now();

        const tMin = isFinite(timeRangeStart) && timeRangeStart > 0 ? timeRangeStart : ptsMin;
        const rawTMax = isFinite(timeRangeEnd) && timeRangeEnd > 0 ? timeRangeEnd : ptsMax;
        const tMax = Math.max(rawTMax, tMin + (rawTMax <= tMin ? 86400000 : 0));
        const timeSpan = Math.max(tMax - tMin, 3600000);
        const yMax = Math.max(params.criticalTmp * 1.15, 0.5);
        const yMin = 0;

        const getX = (t: number) => padLeft + Math.max(0, Math.min(plotW, ((t - tMin) / timeSpan) * plotW));
        const getY = (v: number) => padTop + plotH - Math.max(0, Math.min(plotH, ((v - yMin) / (yMax - yMin)) * plotH));

        // Grid lines
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';

        for (let v = 0; v <= yMax; v += 0.1) {
          const y = getY(v);
          ctx.beginPath();
          ctx.moveTo(padLeft, y);
          ctx.lineTo(W - padRight, y);
          ctx.stroke();
          ctx.fillText(v.toFixed(2), padLeft - 6, y + 3);
        }

        // X ticks
        ctx.textAlign = 'center';
        for (let i = 0; i <= 6; i++) {
          const t = tMin + (i / 6) * (tMax - tMin);
          const x = getX(t);
          ctx.fillText(formatDate(t), x, padTop + plotH + 16);
        }

        // Warning Line
        ctx.strokeStyle = '#d97706';
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(padLeft, getY(params.warningTmp));
        ctx.lineTo(W - padRight, getY(params.warningTmp));
        ctx.stroke();

        // Critical Line
        ctx.strokeStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(padLeft, getY(params.criticalTmp));
        ctx.lineTo(W - padRight, getY(params.criticalTmp));
        ctx.stroke();
        ctx.setLineDash([]);

        // Unit Curves
        analyses.forEach((a, k) => {
          // Daily averages
          const dayMap: Record<string, { sum: number; count: number; timestamp: number }> = {};
          a.activePoints.forEach(p => {
            if (!dayMap[p.dateStr]) dayMap[p.dateStr] = { sum: 0, count: 0, timestamp: p.timestamp };
            dayMap[p.dateStr].sum += p.tmp;
            dayMap[p.dateStr].count++;
          });
          const pts = Object.keys(dayMap).sort().map(d => ({
            timestamp: dayMap[d].timestamp,
            tmp: dayMap[d].sum / dayMap[d].count
          }));

          if (pts.length === 0) return;
          ctx.strokeStyle = UNIT_COLORS[k % UNIT_COLORS.length];
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          pts.forEach((p, idx) => {
            const x = getX(p.timestamp);
            const y = getY(p.tmp);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
        });
      }
    }

    // 2. Draw Single Unit Fouling Charts
    analyses.forEach((a, k) => {
      const cv = foulingCanvasRefs.current[k];
      if (!cv) return;
      const W = 720;
      const H = 200;
      cv.width = W * 2;
      cv.height = H * 2;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      ctx.scale(2, 2);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      const padLeft = 45;
      const padRight = 15;
      const padTop = 15;
      const padBottom = 26;
      const plotW = W - padLeft - padRight;
      const plotH = H - padTop - padBottom;

      const ptsMin = a.activePoints.length > 0 ? a.activePoints[0].timestamp : Date.now() - 86400000;
      const ptsMax = a.activePoints.length > 0 ? a.activePoints[a.activePoints.length - 1].timestamp : Date.now();

      const tMin = isFinite(timeRangeStart) && timeRangeStart > 0 ? timeRangeStart : ptsMin;
      const rawTMax = isFinite(timeRangeEnd) && timeRangeEnd > 0 ? timeRangeEnd : ptsMax;
      const tMax = Math.max(rawTMax, tMin + (rawTMax <= tMin ? 86400000 : 0));
      const timeSpan = Math.max(tMax - tMin, 3600000);
      const yMax = Math.max(params.criticalTmp * 1.15, a.maxTmp * 1.05, 0.5);
      const yMin = 0;

      const getX = (t: number) => padLeft + Math.max(0, Math.min(plotW, ((t - tMin) / timeSpan) * plotW));
      const getY = (v: number) => padTop + plotH - Math.max(0, Math.min(plotH, ((v - yMin) / (yMax - yMin)) * plotH));

      // Grid
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';

      for (let v = 0; v <= yMax; v += 0.1) {
        const y = getY(v);
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(W - padRight, y);
        ctx.stroke();
        ctx.fillText(v.toFixed(2), padLeft - 6, y + 3);
      }

      // Warning / Critical
      ctx.strokeStyle = '#d97706';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, getY(params.warningTmp));
      ctx.lineTo(W - padRight, getY(params.warningTmp));
      ctx.stroke();

      ctx.strokeStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(padLeft, getY(params.criticalTmp));
      ctx.lineTo(W - padRight, getY(params.criticalTmp));
      ctx.stroke();
      ctx.setLineDash([]);

      // TMP curve
      if (a.activePoints.length > 0) {
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        a.activePoints.forEach((p, idx) => {
          const x = getX(p.timestamp);
          const y = getY(p.tmp);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Cleaning markers
        a.events.forEach(ev => {
          const x = getX(ev.timestamp);
          const y = getY(ev.tmpBefore);
          if (ev.type === 'CIP') {
            ctx.fillStyle = '#991b1b';
            ctx.beginPath();
            ctx.moveTo(x, y - 5);
            ctx.lineTo(x - 4, y + 4);
            ctx.lineTo(x + 4, y + 4);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(x, y, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }
    });

    // 3. Draw Flux Rate Charts
    analyses.forEach((a, k) => {
      const cv = fluxCanvasRefs.current[k];
      if (!cv) return;
      const W = 720;
      const H = 190;
      cv.width = W * 2;
      cv.height = H * 2;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      ctx.scale(2, 2);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      const padLeft = 45;
      const padRight = 15;
      const padTop = 15;
      const padBottom = 26;
      const plotW = W - padLeft - padRight;
      const plotH = H - padTop - padBottom;

      // Daily aggregates
      const dayMap: Record<string, { sum: number; count: number; timestamp: number }> = {};
      a.activePoints.forEach(p => {
        if (p.flux !== null) {
          if (!dayMap[p.dateStr]) dayMap[p.dateStr] = { sum: 0, count: 0, timestamp: p.timestamp };
          dayMap[p.dateStr].sum += p.flux;
          dayMap[p.dateStr].count++;
        }
      });
      const pts = Object.keys(dayMap).sort().map(d => ({
        timestamp: dayMap[d].timestamp,
        flux: dayMap[d].sum / dayMap[d].count
      }));

      const ptsMin = pts.length > 0 ? pts[0].timestamp : Date.now() - 86400000;
      const ptsMax = pts.length > 0 ? pts[pts.length - 1].timestamp : Date.now();

      const tMin = isFinite(timeRangeStart) && timeRangeStart > 0 ? timeRangeStart : ptsMin;
      const rawTMax = isFinite(timeRangeEnd) && timeRangeEnd > 0 ? timeRangeEnd : ptsMax;
      const tMax = Math.max(rawTMax, tMin + (rawTMax <= tMin ? 86400000 : 0));
      const timeSpan = Math.max(tMax - tMin, 3600000);

      const maxFlux = pts.length > 0 ? Math.max(...pts.map(p => p.flux)) : 50;
      const yMax = Math.max(25, Math.ceil((maxFlux * 1.1) / 5) * 5);
      const yMin = 0;

      const getX = (t: number) => padLeft + Math.max(0, Math.min(plotW, ((t - tMin) / timeSpan) * plotW));
      const getY = (v: number) => padTop + plotH - Math.max(0, Math.min(plotH, ((v - yMin) / (yMax - yMin)) * plotH));

      // Grid
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';

      for (let v = 0; v <= yMax; v += 10) {
        const y = getY(v);
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(W - padRight, y);
        ctx.stroke();
        ctx.fillText(v.toString(), padLeft - 6, y + 3);
      }

      // Points
      ctx.fillStyle = '#0284c7';
      pts.forEach(p => {
        ctx.beginPath();
        ctx.arc(getX(p.timestamp), getY(p.flux), 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Linear trendline
      const trend = calculateLinearTrend(pts);
      if (trend && pts.length >= 2) {
        const x1 = getX(trend.xMin);
        const y1 = getY(trend.intercept + (trend.slopePerDay / 86400000) * trend.xMin);
        const x2 = getX(trend.xMax);
        const y2 = getY(trend.intercept + (trend.slopePerDay / 86400000) * trend.xMax);

        ctx.strokeStyle = '#2563eb';
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }, [isOpen, analyses, params, timeRangeStart, timeRangeEnd]);

  if (!isOpen) return null;

  // Handle PDF Export
  const handleDownloadPDF = async () => {
    const reportElem = reportRef.current;
    if (!reportElem) return;

    setIsExporting(true);
    setExportProgress('กำลังประมวลผลหน้าเอกสารและเรนเดอร์กราฟ...');

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Query all sections inside report
      const sections = reportElem.querySelectorAll<HTMLElement>('.pdf-report-section');
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 10;
      const usableWidth = pdfWidth - margin * 2;
      const usableHeight = pdfHeight - margin * 2;

      let currentY = margin;

      for (let i = 0; i < sections.length; i++) {
        const sec = sections[i];
        setExportProgress(`กำลังสร้างหน้า ${i + 1} จาก ${sections.length}...`);

        const canvas = await html2canvas(sec, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgH = (canvas.height * usableWidth) / canvas.width;

        if (currentY + imgH > usableHeight + margin && currentY > margin) {
          pdf.addPage();
          currentY = margin;
        }

        pdf.addImage(imgData, 'JPEG', margin, currentY, usableWidth, imgH);
        currentY += imgH + 3;
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      pdf.save(`UF_TMP_Engineering_Report_${dateStr}.pdf`);
      setExportProgress('บันทึกเอกสาร PDF เรียบร้อยแล้ว');
      setTimeout(() => setExportProgress(null), 3000);
    } catch (err: any) {
      alert(`การส่งออก PDF ล้มเหลว: ${err.message || 'เกิดข้อผิดพลาดในการเรนเดอร์'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex justify-center items-start overflow-y-auto p-2 sm:p-4 md:p-6 print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col my-4 print:shadow-none print:border-none print:my-0">
        {/* Modal Top Action Bar */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">รายงานสรุปผลการควบคุม Fouling (TMP) ฉบับสมบูรณ์</h2>
              <p className="text-[11px] text-slate-400">
                ดึงข้อมูลสถานะ, กราฟแนวโน้มทุกยูนิต, การล้าง EFM/CIP และข้อเสนอแนะเชิงปฏิบัติการ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="px-3.5 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Alert */}
        {exportProgress && (
          <div className="bg-blue-600 text-white px-4 py-2 text-xs flex items-center justify-between print:hidden">
            <span>{exportProgress}</span>
          </div>
        )}

        {/* Scrollable Printable Document Area */}
        <div
          ref={reportRef}
          className="p-6 sm:p-8 bg-white text-slate-900 space-y-6 overflow-y-auto max-h-[85vh] print:max-h-none print:overflow-visible font-['Prompt',system-ui,sans-serif]"
        >
          {/* Section 1: Report Title & Team Attribution */}
          <div className="pdf-report-section border-b-2 border-slate-900 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <div className="inline-block text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 mb-1.5">
                  Membrane Operation & Health Assessment Report
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                  รายงานสรุป Fouling (TMP) – ระบบ UF Membrane
                </h1>
                <div className="text-xs font-semibold text-blue-800 mt-1">
                  Developed by: Utility Operation Engineering UOP Team
                </div>
              </div>

              <div className="text-left sm:text-right text-xs text-slate-500 space-y-0.5">
                <div>วันที่ออกรายงาน: <strong>{new Date().toLocaleDateString('th-TH')}</strong></div>
                <div>ช่วงข้อมูล: <strong>{formatDate(timeRangeStart)}</strong> ถึง <strong>{formatDate(timeRangeEnd)}</strong></div>
                <div className="text-[11px] text-slate-400 truncate max-w-xs">{dataset.sourceLabel}</div>
              </div>
            </div>

            {/* Executive Highlights */}
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 leading-relaxed">
              <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                สรุปภาพรวมการเดินระบบ (Executive Summary):
              </div>
              <div>
                ปัจจุบันระบบมีสถานะ{' '}
                <strong className="text-emerald-700">ปกติ {overallSummary.normalCount} ยูนิต</strong>
                {overallSummary.warningCount > 0 && (
                  <span className="text-amber-700 font-semibold">, เฝ้าระวัง {overallSummary.warningCount} ยูนิต</span>
                )}
                {overallSummary.criticalCount > 0 && (
                  <span className="text-red-700 font-bold">, วิกฤต {overallSummary.criticalCount} ยูนิต</span>
                )}
                {' · '}
                ค่า TMP สูงสุดที่บันทึกได้คือ <strong>{overallSummary.peakTmp.toFixed(3)} bar</strong> ที่{' '}
                <strong>{overallSummary.peakUnit}</strong> (วันที่ {overallSummary.peakDate})
              </div>
              <div className="text-[11px] text-slate-500 mt-1.5 border-t border-slate-200 pt-1">
                เกณฑ์ประเมิน: TMP เตือน = {params.warningTmp} bar · TMP วิกฤต = {params.criticalTmp} bar ·
                พื้นที่รวมต่อยูนิต = {(params.modulesCount * params.areaPerModule).toLocaleString()} m² ·
                เกณฑ์ตรวจจับ EFM (&Delta;TMP &ge; {params.efmDrop} bar) · CIP (&Delta;TMP &ge; {params.cipDrop} bar)
              </div>
            </div>
          </div>

          {/* Section 2: Table of Status & Action Recommendations */}
          <div className="pdf-report-section space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-1.5">
              <span className="w-2 h-4 bg-blue-600 rounded-xs" />
              1. ตารางสถานะและความสมบูรณ์รายยูนิต (Unit Status & Recommended Actions)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="py-2 px-3">Unit</th>
                    <th className="py-2 px-2 text-right">TMP ล่าสุด</th>
                    <th className="py-2 px-2 text-right">TMP สูงสุด</th>
                    <th className="py-2 px-2 text-right">% เกินเตือน</th>
                    <th className="py-2 px-2 text-right">EFM</th>
                    <th className="py-2 px-2 text-right">CIP</th>
                    <th className="py-2 px-2 text-center">สถานะ</th>
                    <th className="py-2 px-3 text-center">การดำเนินการที่ควรทำ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analyses.map(a => (
                    <tr key={a.unitName} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-semibold text-slate-900">{a.unitName}</td>
                      <td className="py-2 px-2 text-right font-mono font-bold">
                        {a.currentTmp ? `${a.currentTmp.toFixed(3)} bar` : '-'}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-600">{a.maxTmp.toFixed(3)}</td>
                      <td className="py-2 px-2 text-right font-mono">{a.percentTimeOverWarning.toFixed(1)}%</td>
                      <td className="py-2 px-2 text-right font-mono text-amber-600 font-medium">{a.efmCount}</td>
                      <td className="py-2 px-2 text-right font-mono text-red-600 font-medium">{a.cipCount}</td>
                      <td className="py-2 px-2 text-center">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold text-white"
                          style={{ backgroundColor: a.statusColor }}
                        >
                          {a.statusLabel}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            a.actionType === 'cip'
                              ? 'bg-red-600 text-white'
                              : a.actionType === 'efm'
                              ? 'bg-amber-600 text-white'
                              : a.actionType === 'prep-efm'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {a.actionRecommendation}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Engineering Reasoning Checklist */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1.5 text-slate-700">
              <div className="font-semibold text-slate-900">เหตุผลประกอบการตัดสินใจทางวิศวกรรม:</div>
              {analyses.map(a => (
                <div key={a.unitName} className="flex items-start gap-2 text-[11px]">
                  <strong className="text-slate-900 min-w-[70px]">{a.unitName}:</strong>
                  <span>{a.actionReason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Monthly TMP Breakdown Table */}
          <div className="pdf-report-section space-y-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-1.5">
              <span className="w-2 h-4 bg-blue-600 rounded-xs" />
              2. สถิติ TMP รายเดือน (เฉลี่ย / สูงสุด ในหน่วย bar)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-center border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="py-2 px-3 text-left">เดือน</th>
                    {analyses.map(a => (
                      <th key={a.unitName} className="py-2 px-2">{a.unitName}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {monthlyData.map(mRow => (
                    <tr key={mRow.month} className="hover:bg-slate-50/50">
                      <td className="py-1.5 px-3 text-left font-sans font-semibold text-slate-800">
                        {mRow.month}
                      </td>
                      {mRow.units.map((uVal, idx) => (
                        <td key={idx} className="py-1.5 px-2">
                          {uVal ? `${uVal.avg.toFixed(2)} / ${uVal.max.toFixed(2)}` : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Multi-Unit TMP Trend Chart */}
          <div className="pdf-report-section space-y-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between border-b border-slate-200 pb-1.5">
              <span className="flex items-center gap-2">
                <span className="w-2 h-4 bg-blue-600 rounded-xs" />
                3. กราฟเปรียบเทียบแนวโน้ม TMP ทุก Unit (เฉลี่ยรายวัน)
              </span>
              <span className="text-[11px] text-slate-500 font-normal">
                เส้นประสีทอง = เตือน ({params.warningTmp}) · เส้นประสีแดง = วิกฤต ({params.criticalTmp})
              </span>
            </h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white p-2">
              <canvas ref={multiChartRef} className="w-full h-auto block" style={{ aspectRatio: '720/240' }} />
            </div>
          </div>

          {/* Section 5: Individual Unit Fouling Curves */}
          <div className="pdf-report-section space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between border-b border-slate-200 pb-1.5">
              <span className="flex items-center gap-2">
                <span className="w-2 h-4 bg-blue-600 rounded-xs" />
                4. กราฟรูปแบบ Fouling เจาะลึกรายยูนิต (จุดสีส้ม = EFM, จุดสามเหลี่ยมสีแดง = CIP)
              </span>
            </h3>

            <div className="grid grid-cols-1 gap-4">
              {analyses.map((a, k) => (
                <div key={a.unitName} className="border border-slate-200 rounded-lg p-3 bg-white space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">{a.unitName} – รูปแบบการไต่ของ TMP</span>
                    <span className="text-slate-500 text-[11px]">
                      EFM: <strong className="text-amber-600">{a.efmCount}</strong> ครั้ง · CIP:{' '}
                      <strong className="text-red-600">{a.cipCount}</strong> ครั้ง · TMP สูงสุด:{' '}
                      <strong>{a.maxTmp.toFixed(3)} bar</strong>
                    </span>
                  </div>
                  <canvas
                    ref={el => { foulingCanvasRefs.current[k] = el; }}
                    className="w-full h-auto block border border-slate-100 rounded"
                    style={{ aspectRatio: '720/200' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Section 6: Individual Unit Flux Rate Curves */}
          <div className="pdf-report-section space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between border-b border-slate-200 pb-1.5">
              <span className="flex items-center gap-2">
                <span className="w-2 h-4 bg-blue-600 rounded-xs" />
                5. กราฟอัตราการกรอง Flux Rate & แนวโน้ม Linear Trendline (LMH)
              </span>
              <span className="text-[11px] text-slate-500 font-normal">
                เส้นประน้ำเงิน = แนวโน้มการเสื่อมของอัตรากรอง (&Delta;LMH / 30 วัน)
              </span>
            </h3>

            <div className="grid grid-cols-1 gap-4">
              {analyses.map((a, k) => (
                <div key={a.unitName} className="border border-slate-200 rounded-lg p-3 bg-white space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">{a.unitName} – Flux Rate</span>
                    <span className="text-slate-500 text-[11px]">
                      Flux เฉลี่ย: <strong>{formatNumber(a.avgFlux, 1)} LMH</strong> · Permeability:{' '}
                      <strong>{formatNumber(a.avgPermeability, 0)} LMH/bar</strong>
                    </span>
                  </div>
                  <canvas
                    ref={el => { fluxCanvasRefs.current[k] = el; }}
                    className="w-full h-auto block border border-slate-100 rounded"
                    style={{ aspectRatio: '720/190' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Section 7: SOP Reference & Sign-off Signature Block */}
          <div className="pdf-report-section pt-4 border-t-2 border-slate-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div className="font-bold text-slate-800">เกณฑ์การล้างตามคู่มือผู้ผลิตและ SOP โรงงาน:</div>
                <div>• <strong>AS/BW:</strong> ล้างย้อนอัตโนมัติทุก 15-30 นาที ตรวจสอบความสม่ำเสมอของแรงดันลมเป่า</div>
                <div>• <strong>EFM:</strong> ทำเมื่อ TMP &ge; {params.warningTmp} bar ใช้ NaOCl 200-500 ppm หรือกรดซิตริก แช่ 15 นาที</div>
                <div>• <strong>CIP:</strong> ทำเมื่อ TMP &ge; {params.criticalTmp} bar สารเคมีเข้มข้น pH 11-12 และ pH 2.0 แช่ 2-4 ชม. ที่ 35-40°C</div>
              </div>

              <div className="border border-slate-200 p-3 rounded-lg flex flex-col justify-between">
                <div className="font-bold text-slate-800 mb-4">การรับรองรายงาน (Sign-off & Approval):</div>
                <div className="grid grid-cols-2 gap-3 text-center text-[11px]">
                  <div className="border-t border-slate-300 pt-1">
                    <div>(......................................................)</div>
                    <div className="text-slate-500 mt-0.5">วิศวกรผู้จัดทำรายงาน</div>
                  </div>
                  <div className="border-t border-slate-300 pt-1">
                    <div>(......................................................)</div>
                    <div className="text-slate-500 mt-0.5">หัวหน้ากะ / ผู้จัดการส่วนงาน</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center text-[11px] text-slate-400 mt-4">
              Utility Operation Engineering UOP Team · Ultrafiltration Membrane Management System
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

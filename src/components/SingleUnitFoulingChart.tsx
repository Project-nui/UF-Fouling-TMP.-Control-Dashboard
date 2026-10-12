import React, { useRef, useEffect, useState } from 'react';
import { UnitAnalysis, formatDate } from '../utils/membraneCalculations';
import { getPointAction, ActionInfo } from './MultiUnitTmpChart';

interface SingleUnitFoulingChartProps {
  analysis: UnitAnalysis;
  warningTmp: number;
  criticalTmp: number;
  timeRangeStart: number;
  timeRangeEnd: number;
}

export const SingleUnitFoulingChart: React.FC<SingleUnitFoulingChartProps> = ({
  analysis,
  warningTmp,
  criticalTmp,
  timeRangeStart,
  timeRangeEnd
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [hoveredPoint, setHoveredPoint] = useState<{
    dateStr: string;
    tmp: number;
    action: ActionInfo;
    event?: { type: 'EFM' | 'CIP'; drop: number };
    xPx: number;
    yPx: number;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || 800;
    const height = 320;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Crisp white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    const padLeft = 55;
    const padRight = 25;
    const padTop = 20;
    const padBottom = 40;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const pts = analysis.activePoints;
    const ptsMin = pts.length > 0 ? pts[0].timestamp : Date.now() - 86400000;
    const ptsMax = pts.length > 0 ? pts[pts.length - 1].timestamp : Date.now();

    const effectiveStart = isFinite(timeRangeStart) && timeRangeStart > 0 && pts.length > 0
      ? Math.max(timeRangeStart, ptsMin)
      : ptsMin;
    const effectiveEnd = isFinite(timeRangeEnd) && timeRangeEnd > 0 && pts.length > 0
      ? Math.min(timeRangeEnd, ptsMax)
      : ptsMax;

    const tMin = effectiveStart;
    const rawTMax = effectiveEnd;
    const tMax = Math.max(rawTMax, tMin + (rawTMax <= tMin ? 3600000 : 0));
    const timeSpan = Math.max(tMax - tMin, 3600000);

    let maxVal = Math.max(criticalTmp * 1.15, analysis.maxTmp * 1.05, 0.5);
    const minVal = analysis.minTmp < -0.005 ? Math.floor(analysis.minTmp * 20) / 20 - 0.02 : 0;
    const ySpan = Math.max(maxVal - minVal, 0.05);

    const getX = (t: number) => padLeft + Math.max(0, Math.min(plotW, ((t - tMin) / timeSpan) * plotW));
    const getY = (v: number) => padTop + plotH - Math.max(0, Math.min(plotH, ((v - minVal) / ySpan) * plotH));

    // Grid & Y Ticks
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748B';
    ctx.font = '500 11px system-ui';
    ctx.textAlign = 'right';

    const yStep = ySpan > 1.0 ? 0.2 : ySpan > 0.4 ? 0.1 : 0.05;
    for (let v = Math.ceil(minVal / yStep) * yStep; v <= maxVal + 0.001; v += yStep) {
      const y = getY(v);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      ctx.fillText(v.toFixed(yStep < 0.1 ? 3 : 2), padLeft - 8, y + 4);
    }

    // Y Axis label
    ctx.save();
    ctx.translate(14, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1E293B';
    ctx.font = '600 11px system-ui';
    ctx.fillText('TMP (bar)', 0, 0);
    ctx.restore();

    // X Ticks
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748B';
    const xTicksCount = Math.min(8, Math.max(4, Math.floor(plotW / 90)));
    for (let i = 0; i <= xTicksCount; i++) {
      const t = tMin + (i / xTicksCount) * (tMax - tMin);
      const x = getX(t);
      ctx.strokeStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.moveTo(x, padTop + plotH);
      ctx.lineTo(x, padTop + plotH + 5);
      ctx.stroke();
      const d = new Date(t);
      const isSubWeek = timeSpan <= 7 * 86400000;
      const hoursStr = isSubWeek ? ` ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` : '';
      const label = `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${String(d.getUTCFullYear()).slice(-2)}${hoursStr}`;
      ctx.fillText(label, x, padTop + plotH + 18);
    }

    // Warning Line
    if (warningTmp <= maxVal) {
      const yWarn = getY(warningTmp);
      ctx.save();
      ctx.strokeStyle = '#D97706';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(padLeft, yWarn);
      ctx.lineTo(width - padRight, yWarn);
      ctx.stroke();

      const warnText = `⚠️ เตือน: ${warningTmp.toFixed(2)} bar`;
      ctx.font = 'bold 10px system-ui';
      const txtW = ctx.measureText(warnText).width;
      ctx.fillStyle = 'rgba(255, 251, 235, 0.95)';
      ctx.fillRect(width - padRight - txtW - 14, yWarn - 17, txtW + 10, 16);
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(width - padRight - txtW - 14, yWarn - 17, txtW + 10, 16);
      ctx.fillStyle = '#92400E';
      ctx.textAlign = 'left';
      ctx.fillText(warnText, width - padRight - txtW - 9, yWarn - 5);
      ctx.restore();
    }

    // Critical Line
    if (criticalTmp <= maxVal) {
      const yCrit = getY(criticalTmp);
      ctx.save();
      ctx.strokeStyle = '#DC2626';
      ctx.setLineDash([5, 3]);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(padLeft, yCrit);
      ctx.lineTo(width - padRight, yCrit);
      ctx.stroke();

      const critText = `🛑 วิกฤต (CIP): ${criticalTmp.toFixed(2)} bar`;
      ctx.font = 'bold 10px system-ui';
      const txtW = ctx.measureText(critText).width;
      ctx.fillStyle = 'rgba(254, 242, 242, 0.95)';
      ctx.fillRect(width - padRight - txtW - 14, yCrit - 17, txtW + 10, 16);
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(width - padRight - txtW - 14, yCrit - 17, txtW + 10, 16);
      ctx.fillStyle = '#991B1B';
      ctx.textAlign = 'left';
      ctx.fillText(critText, width - padRight - txtW - 9, yCrit - 5);
      ctx.restore();
    }

    if (pts.length > 0) {
      // Line curve in Rich Royal Blue
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      pts.forEach((p, i) => {
        const x = getX(p.timestamp);
        const y = getY(p.tmp);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Point dots
      ctx.fillStyle = '#3B82F6';
      const dotR = pts.length > 80 ? 2.5 : 3.5;
      pts.forEach(p => {
        const x = getX(p.timestamp);
        const y = getY(p.tmp);
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fill();
      });

      // Cleaning Event Markers
      analysis.events.forEach(ev => {
        const x = getX(ev.timestamp);
        const y = getY(ev.tmpBefore);

        if (ev.type === 'CIP') {
          // Red Triangle for CIP
          ctx.fillStyle = '#DC2626';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, y - 8);
          ctx.lineTo(x - 7, y + 6);
          ctx.lineTo(x + 7, y + 6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          // Amber circle for EFM
          ctx.fillStyle = '#D97706';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      });
    }
  }, [analysis, warningTmp, criticalTmp, timeRangeStart, timeRangeEnd]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padLeft = 55;
    const padRight = 25;
    const plotW = canvas.clientWidth - padLeft - padRight;
    if (x < padLeft || x > padLeft + plotW) {
      setHoveredPoint(null);
      return;
    }

    const pts = analysis.activePoints;
    if (pts.length === 0) return;

    const ptsMin = pts[0].timestamp;
    const ptsMax = pts[pts.length - 1].timestamp;
    const effectiveStart = isFinite(timeRangeStart) && timeRangeStart > 0 ? Math.max(timeRangeStart, ptsMin) : ptsMin;
    const effectiveEnd = isFinite(timeRangeEnd) && timeRangeEnd > 0 ? Math.min(timeRangeEnd, ptsMax) : ptsMax;
    const tMin = effectiveStart;
    const rawTMax = effectiveEnd;
    const tMax = Math.max(rawTMax, tMin + (rawTMax <= tMin ? 3600000 : 0));
    const timeSpan = Math.max(tMax - tMin, 3600000);

    const getX = (t: number) => padLeft + Math.max(0, Math.min(plotW, ((t - tMin) / timeSpan) * plotW));

    // Find nearest point
    let closest = pts[0];
    let minDiff = Infinity;
    pts.forEach(p => {
      const px = getX(p.timestamp);
      const diff = Math.abs(px - x);
      if (diff < minDiff) {
        minDiff = diff;
        closest = p;
      }
    });

    if (minDiff > 35) {
      setHoveredPoint(null);
      return;
    }

    const matchedEvent = analysis.events.find(ev => ev.timestamp === closest!.timestamp);
    const action = getPointAction(closest.tmp, warningTmp, criticalTmp);

    setHoveredPoint({
      dateStr: closest.dateStr,
      tmp: closest.tmp,
      action,
      event: matchedEvent ? { type: matchedEvent.type, drop: matchedEvent.tmpDrop } : undefined,
      xPx: x,
      yPx: y
    });
  };

  const handleMouseLeave = () => setHoveredPoint(null);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            รูปแบบ Fouling ของ {analysis.unitName} (วิเคราะห์การสะสมและการล้างย้อน)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            เส้นสีน้ำเงิน = ค่า TMP · จุดส้ม = EFM (เคมีเจือจาง) · สามเหลี่ยมแดง = CIP (เคมีเข้มข้น) · ชี้ที่จุดเพื่อดูคำแนะนำ
          </p>
        </div>

        {/* Quick metrics */}
        <div className="flex items-center gap-3 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800">
            <span className="text-slate-500">EFM ทั้งหมด:</span>{' '}
            <span className="font-bold text-amber-700">{analysis.efmCount} ครั้ง</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800">
            <span className="text-slate-500">CIP ทั้งหมด:</span>{' '}
            <span className="font-bold text-rose-700">{analysis.cipCount} ครั้ง</span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative w-full h-[320px] select-none bg-white border border-slate-200 rounded-xl overflow-hidden cursor-crosshair"
      >
        <canvas ref={canvasRef} className="block w-full h-full" />

        {analysis.activePoints.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 text-center p-4">
            <p className="text-sm font-semibold text-slate-800">ไม่มีข้อมูลในช่วงเวลาที่เลือก</p>
            <p className="text-xs text-slate-500 mt-0.5">กรุณาคลิก &quot;แสดงค่าเท่าที่ข้อมูลมี&quot; เพื่อดูข้อมูลจริงทั้งหมด</p>
          </div>
        )}

        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none bg-white text-slate-800 rounded-xl p-3 text-xs shadow-xl border min-w-[240px] max-w-[310px]"
            style={{
              borderColor: hoveredPoint.action.badgeColor,
              left: Math.min(hoveredPoint.xPx + 15, (containerRef.current?.clientWidth || 600) - 260),
              top: Math.max(10, Math.min(hoveredPoint.yPx - 30, 160))
            }}
          >
            <div className="font-semibold text-slate-500 border-b border-slate-100 pb-1.5 mb-1.5 flex justify-between items-center">
              <span>วันที่ {hoveredPoint.dateStr}</span>
              <span className="font-mono text-slate-900 font-bold">{hoveredPoint.tmp.toFixed(3)} bar</span>
            </div>

            {/* Action Box */}
            <div
              className={`p-2 rounded-lg border text-xs space-y-1 mb-1.5 ${hoveredPoint.action.badgeBg}`}
            >
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1 text-xs">
                  <span>{hoveredPoint.action.icon}</span>
                  <span>จุดนี้ควรทำ: {hoveredPoint.action.type}</span>
                </span>
                <span className="text-[10px] bg-white/70 px-1.5 py-0.5 rounded text-slate-800 font-semibold border border-slate-200">
                  {hoveredPoint.action.actionName}
                </span>
              </div>
              <p className="text-[11px] leading-snug">
                {hoveredPoint.action.stepGuideline}
              </p>
            </div>

            {hoveredPoint.event && (
              <div className="pt-1 border-t border-slate-100 text-[11px] text-emerald-700 font-semibold">
                ✓ ตรวจพบเหตุการณ์ {hoveredPoint.event.type} (TMP ลดลง {hoveredPoint.event.drop.toFixed(2)} bar)
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

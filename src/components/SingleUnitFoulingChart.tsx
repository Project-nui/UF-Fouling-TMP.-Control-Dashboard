import React, { useRef, useEffect, useState } from 'react';
import { UnitAnalysis, formatDate } from '../utils/membraneCalculations';

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
    ctx.clearRect(0, 0, width, height);

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
    ctx.strokeStyle = '#1F2238';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#A1A1AA';
    ctx.font = '11px system-ui';
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
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '500 11px system-ui';
    ctx.fillText('TMP (bar)', 0, 0);
    ctx.restore();

    // X Ticks
    ctx.textAlign = 'center';
    ctx.fillStyle = '#A1A1AA';
    const xTicksCount = Math.min(8, Math.max(4, Math.floor(plotW / 90)));
    for (let i = 0; i <= xTicksCount; i++) {
      const t = tMin + (i / xTicksCount) * (tMax - tMin);
      const x = getX(t);
      ctx.strokeStyle = '#2C2F4D';
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
    const yWarn = getY(warningTmp);
    ctx.strokeStyle = '#F59E0B';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padLeft, yWarn);
    ctx.lineTo(width - padRight, yWarn);
    ctx.stroke();

    // Critical Line
    const yCrit = getY(criticalTmp);
    ctx.strokeStyle = '#F43F5E';
    ctx.beginPath();
    ctx.moveTo(padLeft, yCrit);
    ctx.lineTo(width - padRight, yCrit);
    ctx.stroke();
    ctx.setLineDash([]);

    if (pts.length > 0) {
      // Line curve in Neon Violet
      ctx.strokeStyle = '#8B5CF6';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      pts.forEach((p, i) => {
        const x = getX(p.timestamp);
        const y = getY(p.tmp);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Point dots
      ctx.fillStyle = '#A78BFA';
      const dotR = pts.length > 80 ? 2 : 3.5;
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
          ctx.fillStyle = '#F43F5E';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, y - 7);
          ctx.lineTo(x - 6, y + 5);
          ctx.lineTo(x + 6, y + 5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          // Amber circle for EFM
          ctx.fillStyle = '#F59E0B';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, 4.5, 0, Math.PI * 2);
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
    const hoverMs = tMin + ((x - padLeft) / plotW) * timeSpan;

    // Find closest point
    let closest: typeof analysis.activePoints[0] | null = null;
    let minDiff = 1e12;
    for (const p of analysis.activePoints) {
      const diff = Math.abs(p.timestamp - hoverMs);
      if (diff < minDiff) {
        minDiff = diff;
        closest = p;
      }
    }

    if (!closest || minDiff > 86400000 * 4) {
      setHoveredPoint(null);
      return;
    }

    const matchedEvent = analysis.events.find(ev => ev.timestamp === closest!.timestamp);

    setHoveredPoint({
      dateStr: closest.dateStr,
      tmp: closest.tmp,
      event: matchedEvent ? { type: matchedEvent.type, drop: matchedEvent.tmpDrop } : undefined,
      xPx: x,
      yPx: y
    });
  };

  const handleMouseLeave = () => setHoveredPoint(null);

  return (
    <div className="bg-[#13141F] border border-[#1F2238] rounded-xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            รูปแบบ Fouling ของ {analysis.unitName} (วิเคราะห์การสะสมและการล้างย้อน)
          </h3>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            เส้นม่วงนีออน = ค่า TMP · จุดเหลือง = EFM (เคมีเจือจาง) · สามเหลี่ยมแดง = CIP (เคมีเข้มข้น)
          </p>
        </div>

        {/* Quick metrics */}
        <div className="flex items-center gap-3 text-xs">
          <div className="bg-[#090A0F] border border-[#1F2238] rounded-lg px-3 py-1.5 text-white">
            <span className="text-[#A1A1AA]">EFM ทั้งหมด:</span>{' '}
            <span className="font-semibold text-amber-400">{analysis.efmCount} ครั้ง</span>
          </div>
          <div className="bg-[#090A0F] border border-[#1F2238] rounded-lg px-3 py-1.5 text-white">
            <span className="text-[#A1A1AA]">CIP ทั้งหมด:</span>{' '}
            <span className="font-semibold text-rose-400">{analysis.cipCount} ครั้ง</span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative w-full h-[320px] select-none bg-[#090A0F] border border-[#1F2238] rounded-xl overflow-hidden"
      >
        <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair" />

        {analysis.activePoints.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#090A0F]/90 text-center p-4">
            <p className="text-sm font-semibold text-white">ไม่มีข้อมูลในช่วงเวลาที่เลือก</p>
            <p className="text-xs text-[#A1A1AA] mt-0.5">กรุณาคลิก "แสดงค่าเท่าที่ข้อมูลมี" เพื่อดูข้อมูลจริงทั้งหมด</p>
          </div>
        )}

        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none bg-[#13141F]/95 text-white rounded-xl p-2.5 text-xs shadow-2xl backdrop-blur-md border border-[#8B5CF6]/40"
            style={{
              left: Math.min(hoveredPoint.xPx + 15, (containerRef.current?.clientWidth || 600) - 160),
              top: Math.max(10, Math.min(hoveredPoint.yPx - 20, 220))
            }}
          >
            <div className="font-semibold text-[#A1A1AA] border-b border-[#1F2238] pb-1 mb-1">
              วันที่ {hoveredPoint.dateStr}
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#A1A1AA]">TMP:</span>
              <span className="font-mono font-bold text-[#8B5CF6]">
                {hoveredPoint.tmp.toFixed(3)} bar
              </span>
            </div>
            {hoveredPoint.event && (
              <div className="mt-1 pt-1 border-t border-[#1F2238] text-[11px] text-emerald-400">
                ตรวจพบ {hoveredPoint.event.type} (ลดลง {hoveredPoint.event.drop.toFixed(2)} bar)
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

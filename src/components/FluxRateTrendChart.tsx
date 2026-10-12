import React, { useRef, useEffect, useState } from 'react';
import { UnitAnalysis, calculateLinearTrend } from '../utils/membraneCalculations';

interface FluxRateTrendChartProps {
  analysis: UnitAnalysis;
  timeRangeStart: number;
  timeRangeEnd: number;
  averagingMode: 'daily' | 'all';
  onAveragingChange: (mode: 'daily' | 'all') => void;
}

export const FluxRateTrendChart: React.FC<FluxRateTrendChartProps> = ({
  analysis,
  timeRangeStart,
  timeRangeEnd,
  averagingMode,
  onAveragingChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [hoveredPoint, setHoveredPoint] = useState<{
    dateStr: string;
    flux: number;
    xPx: number;
    yPx: number;
  } | null>(null);

  const points = React.useMemo(() => {
    const raw = analysis.activePoints
      .filter(p => p.flux !== null && (!isFinite(timeRangeStart) || p.timestamp >= timeRangeStart) && (!isFinite(timeRangeEnd) || p.timestamp <= timeRangeEnd))
      .map(p => ({ timestamp: p.timestamp, flux: p.flux!, dateStr: p.dateStr }));

    // If total points are <= 150 or mode is 'all', show all raw data cycles
    if (averagingMode === 'all' || raw.length <= 150) return raw;

    // Daily aggregate
    const dayMap: Record<string, { sum: number; count: number; timestamp: number }> = {};
    raw.forEach(p => {
      if (!dayMap[p.dateStr]) {
        dayMap[p.dateStr] = { sum: 0, count: 0, timestamp: p.timestamp };
      }
      dayMap[p.dateStr].sum += p.flux;
      dayMap[p.dateStr].count++;
    });

    return Object.keys(dayMap)
      .sort()
      .map(d => ({
        dateStr: d,
        timestamp: dayMap[d].timestamp,
        flux: dayMap[d].sum / dayMap[d].count
      }));
  }, [analysis.activePoints, timeRangeStart, timeRangeEnd, averagingMode]);

  const trend = React.useMemo(() => calculateLinearTrend(points), [points]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || 800;
    const height = 300;
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

    const ptsMin = points.length > 0 ? points[0].timestamp : Date.now() - 86400000;
    const ptsMax = points.length > 0 ? points[points.length - 1].timestamp : Date.now();

    const effectiveStart = isFinite(timeRangeStart) && timeRangeStart > 0 && points.length > 0
      ? Math.max(timeRangeStart, ptsMin)
      : ptsMin;
    const effectiveEnd = isFinite(timeRangeEnd) && timeRangeEnd > 0 && points.length > 0
      ? Math.min(timeRangeEnd, ptsMax)
      : ptsMax;

    const tMin = effectiveStart;
    const rawTMax = effectiveEnd;
    const tMax = Math.max(rawTMax, tMin + (rawTMax <= tMin ? 3600000 : 0));
    const timeSpan = Math.max(tMax - tMin, 3600000);

    const maxFlux = points.length > 0 ? Math.max(...points.map(p => p.flux)) : 50;
    const yMax = Math.max(20, Math.ceil((maxFlux * 1.1) / 5) * 5);
    const yMin = 0;
    const ySpan = Math.max(yMax - yMin, 1);

    const getX = (t: number) => padLeft + Math.max(0, Math.min(plotW, ((t - tMin) / timeSpan) * plotW));
    const getY = (v: number) => padTop + plotH - Math.max(0, Math.min(plotH, ((v - yMin) / ySpan) * plotH));

    // Grid & Y Ticks
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748B';
    ctx.font = '500 11px system-ui';
    ctx.textAlign = 'right';

    const step = yMax > 60 ? 10 : 5;
    for (let v = 0; v <= yMax; v += step) {
      const y = getY(v);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      ctx.fillText(`${v}`, padLeft - 8, y + 4);
    }

    // Y Axis label
    ctx.save();
    ctx.translate(14, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1E293B';
    ctx.font = '600 11px system-ui';
    ctx.fillText('Flux rate (LMH = L/m²/h)', 0, 0);
    ctx.restore();

    // X Ticks (Date)
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

    // Draw Scatter points
    ctx.fillStyle = '#0284C7';
    const radius = averagingMode === 'daily' ? 4 : 2.8;
    points.forEach(p => {
      const x = getX(p.timestamp);
      const y = getY(p.flux);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Linear Trendline
    if (trend && points.length >= 2) {
      const x1 = getX(trend.xMin);
      const y1 = getY(trend.intercept + (trend.slopePerDay / 86400000) * trend.xMin);
      const x2 = getX(trend.xMax);
      const y2 = getY(trend.intercept + (trend.slopePerDay / 86400000) * trend.xMax);

      ctx.strokeStyle = '#7C3AED';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [points, trend, timeRangeStart, timeRangeEnd, averagingMode]);

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

    const ptsMin = points.length > 0 ? points[0].timestamp : Date.now() - 86400000;
    const ptsMax = points.length > 0 ? points[points.length - 1].timestamp : Date.now();

    const effectiveStart = isFinite(timeRangeStart) && timeRangeStart > 0 && points.length > 0
      ? Math.max(timeRangeStart, ptsMin)
      : ptsMin;
    const effectiveEnd = isFinite(timeRangeEnd) && timeRangeEnd > 0 && points.length > 0
      ? Math.min(timeRangeEnd, ptsMax)
      : ptsMax;

    const tMin = effectiveStart;
    const rawTMax = effectiveEnd;
    const tMax = Math.max(rawTMax, tMin + (rawTMax <= tMin ? 3600000 : 0));
    const timeSpan = Math.max(tMax - tMin, 3600000);
    const hoverMs = tMin + ((x - padLeft) / plotW) * timeSpan;

    let closest: typeof points[0] | null = null;
    let minDiff = 1e12;
    for (const p of points) {
      const diff = Math.abs(p.timestamp - hoverMs);
      if (diff < minDiff) {
        minDiff = diff;
        closest = p;
      }
    }

    if (!closest || minDiff > 86400000 * 3) {
      setHoveredPoint(null);
      return;
    }

    setHoveredPoint({
      dateStr: closest.dateStr,
      flux: closest.flux,
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
            อัตราการกรอง Flux Rate ของ {analysis.unitName} (LMH)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            จุดสีฟ้า = ค่า Flux · เส้นประสีม่วง = แนวโน้มเชิงเส้น (Linear Trend)
          </p>
        </div>

        <div className="flex items-center gap-3">
          {trend && (
            <div className="text-xs bg-purple-50 border border-purple-200 text-purple-700 px-2.5 py-1 rounded-lg">
              แนวโน้ม:{' '}
              <span className="font-bold text-slate-900">
                {trend.changePer30Days > 0 ? '+' : ''}
                {trend.changePer30Days.toFixed(1)} LMH ต่อ 30 วัน
              </span>
            </div>
          )}

          <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => onAveragingChange('daily')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                averagingMode === 'daily'
                  ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              เฉลี่ยรายวัน
            </button>
            <button
              onClick={() => onAveragingChange('all')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                averagingMode === 'all'
                  ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทุกจุดข้อมูล
            </button>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative w-full h-[300px] select-none bg-white border border-slate-200 rounded-xl overflow-hidden"
      >
        <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair" />

        {points.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 text-center p-4">
            <p className="text-sm font-semibold text-slate-800">ไม่มีข้อมูลในช่วงเวลาที่เลือก</p>
            <p className="text-xs text-slate-500 mt-0.5">กรุณาคลิก "แสดงค่าเท่าที่ข้อมูลมี" เพื่อดูข้อมูลจริงทั้งหมด</p>
          </div>
        )}

        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none bg-white text-slate-800 rounded-xl p-2.5 text-xs shadow-xl border border-sky-300"
            style={{
              left: Math.min(hoveredPoint.xPx + 15, (containerRef.current?.clientWidth || 600) - 150),
              top: Math.max(10, Math.min(hoveredPoint.yPx - 20, 200))
            }}
          >
            <div className="font-semibold text-slate-500 border-b border-slate-100 pb-1 mb-1">
              วันที่ {hoveredPoint.dateStr}
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Flux:</span>
              <span className="font-mono font-bold text-sky-600">
                {hoveredPoint.flux.toFixed(1)} LMH
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

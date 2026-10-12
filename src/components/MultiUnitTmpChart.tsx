import React, { useRef, useEffect, useState } from 'react';
import { UnitAnalysis, formatDate } from '../utils/membraneCalculations';
import { UNIT_COLORS } from '../data/initialData';
import { ZoomIn, Eye, Activity } from 'lucide-react';

interface MultiUnitTmpChartProps {
  analyses: UnitAnalysis[];
  warningTmp: number;
  criticalTmp: number;
  timeRangeStart: number;
  timeRangeEnd: number;
}

export const MultiUnitTmpChart: React.FC<MultiUnitTmpChartProps> = ({
  analyses,
  warningTmp,
  criticalTmp,
  timeRangeStart,
  timeRangeEnd
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const maxPoints = Math.max(...analyses.map(a => a.activePoints.length), 0);
  const isShortRange = (timeRangeEnd - timeRangeStart) <= 45 * 86400000;
  const [viewMode, setViewMode] = useState<'cycles' | 'daily'>(isShortRange || maxPoints <= 300 ? 'cycles' : 'daily');
  const [zoomY, setZoomY] = useState(true);

  // Auto-switch to cycles whenever dataset or time range changes to a short period or <= 300 points
  useEffect(() => {
    const isShort = (timeRangeEnd - timeRangeStart) <= 45 * 86400000;
    const pts = Math.max(...analyses.map(a => a.activePoints.length), 0);
    if (isShort || pts <= 300) {
      setViewMode('cycles');
    }
  }, [timeRangeStart, timeRangeEnd, analyses]);

  const [hoveredPoint, setHoveredPoint] = useState<{
    dateStr: string;
    values: { name: string; val: number | null; color: string }[];
    xPx: number;
    yPx: number;
  } | null>(null);

  const [visibleUnits, setVisibleUnits] = useState<boolean[]>(() => analyses.map(() => true));

  useEffect(() => {
    setVisibleUnits(prev => {
      if (prev.length !== analyses.length) return analyses.map(() => true);
      return prev;
    });
  }, [analyses.length]);

  const toggleUnit = (idx: number) => {
    setVisibleUnits(prev => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || 800;
    const height = 340;
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
    const padRight = 20;
    const padTop = 20;
    const padBottom = 40;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Series data points based on mode
    const chartSeries: { unitName: string; points: { timestamp: number; dateStr: string; tmp: number }[] }[] =
      analyses.map(a => {
        if (viewMode === 'cycles') {
          return {
            unitName: a.unitName,
            points: a.activePoints.map(p => ({
              timestamp: p.timestamp,
              dateStr: p.dateStr,
              tmp: p.tmp
            }))
          };
        } else {
          // Daily aggregate
          const dayMap: Record<string, { sum: number; count: number; timestamp: number }> = {};
          a.activePoints.forEach(p => {
            if (!dayMap[p.dateStr]) {
              dayMap[p.dateStr] = { sum: 0, count: 0, timestamp: p.timestamp };
            }
            dayMap[p.dateStr].sum += p.tmp;
            dayMap[p.dateStr].count++;
          });
          const pts = Object.keys(dayMap)
            .sort()
            .map(d => ({
              dateStr: d,
              timestamp: dayMap[d].timestamp,
              tmp: dayMap[d].sum / dayMap[d].count
            }));
          return { unitName: a.unitName, points: pts };
        }
      });

    // Safely collect all timestamps from active points
    const allTs: number[] = [];
    analyses.forEach(a => a.activePoints.forEach(p => allTs.push(p.timestamp)));
    const ptsMin = allTs.length > 0 ? Math.min(...allTs) : Date.now() - 86400000;
    const ptsMax = allTs.length > 0 ? Math.max(...allTs) : Date.now();

    // Show strictly within the range where data actually exists!
    const effectiveStart = isFinite(timeRangeStart) && timeRangeStart > 0 && allTs.length > 0
      ? Math.max(timeRangeStart, ptsMin)
      : ptsMin;
    const effectiveEnd = isFinite(timeRangeEnd) && timeRangeEnd > 0 && allTs.length > 0
      ? Math.min(timeRangeEnd, ptsMax)
      : ptsMax;

    const tMin = effectiveStart;
    const rawTMax = effectiveEnd;
    const tMax = Math.max(rawTMax, tMin + (rawTMax <= tMin ? 3600000 : 0));
    const timeSpan = Math.max(tMax - tMin, 3600000);

    let maxObserved = 0;
    let minObserved = 0;
    chartSeries.forEach(s => {
      s.points.forEach(pt => {
        if (pt.tmp > maxObserved) maxObserved = pt.tmp;
        if (pt.tmp < minObserved) minObserved = pt.tmp;
      });
    });

    let maxVal: number;
    if (zoomY && maxObserved < criticalTmp) {
      maxVal = Math.max(maxObserved * 1.35, 0.20);
    } else {
      maxVal = Math.max(criticalTmp * 1.15, maxObserved * 1.05, 0.5);
    }
    // Accommodate negative sensor offsets (e.g. -0.035 bar on UF No.3)
    const minVal = minObserved < -0.005 ? Math.floor(minObserved * 20) / 20 - 0.02 : 0;
    const ySpan = Math.max(maxVal - minVal, 0.05);

    const getX = (t: number) => padLeft + Math.max(0, Math.min(plotW, ((t - tMin) / timeSpan) * plotW));
    const getY = (v: number) => padTop + plotH - Math.max(0, Math.min(plotH, ((v - minVal) / ySpan) * plotH));

    // Draw Grid & Y-Ticks
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

    // X Axis Ticks (Dates / Hours)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#A1A1AA';
    const xTicksCount = Math.min(8, Math.max(4, Math.floor(plotW / 95)));
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

    // Threshold lines
    if (warningTmp <= maxVal) {
      const yWarn = getY(warningTmp);
      ctx.strokeStyle = '#F59E0B';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padLeft, yWarn);
      ctx.lineTo(width - padRight, yWarn);
      ctx.stroke();
    }

    if (criticalTmp <= maxVal) {
      const yCrit = getY(criticalTmp);
      ctx.strokeStyle = '#F43F5E';
      ctx.beginPath();
      ctx.moveTo(padLeft, yCrit);
      ctx.lineTo(width - padRight, yCrit);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Unit Series Curves & Dots
    chartSeries.forEach((s, k) => {
      if (!visibleUnits[k] || s.points.length === 0) return;
      const color = UNIT_COLORS[k % UNIT_COLORS.length];

      // Draw lines if 2 or more points
      if (s.points.length >= 2) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        s.points.forEach((pt, i) => {
          const x = getX(pt.timestamp);
          const y = getY(pt.tmp);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      // ALWAYS draw circular dots so every single point is visible
      const dotRadius = s.points.length > 100 ? 2 : 3.5;
      ctx.fillStyle = color;
      s.points.forEach(pt => {
        const x = getX(pt.timestamp);
        const y = getY(pt.tmp);
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }, [analyses, warningTmp, criticalTmp, timeRangeStart, timeRangeEnd, visibleUnits, viewMode, zoomY]);

  // Handle Mouse Hover
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padLeft = 55;
    const padRight = 20;
    const plotW = canvas.clientWidth - padLeft - padRight;
    if (x < padLeft || x > padLeft + plotW) {
      setHoveredPoint(null);
      return;
    }

    const allTs: number[] = [];
    analyses.forEach(a => a.activePoints.forEach(p => allTs.push(p.timestamp)));
    const ptsMin = allTs.length > 0 ? Math.min(...allTs) : Date.now() - 86400000;
    const ptsMax = allTs.length > 0 ? Math.max(...allTs) : Date.now();

    const effectiveStart = isFinite(timeRangeStart) && timeRangeStart > 0 && allTs.length > 0
      ? Math.max(timeRangeStart, ptsMin)
      : ptsMin;
    const effectiveEnd = isFinite(timeRangeEnd) && timeRangeEnd > 0 && allTs.length > 0
      ? Math.min(timeRangeEnd, ptsMax)
      : ptsMax;

    const tMin = effectiveStart;
    const rawTMax = effectiveEnd;
    const tMax = Math.max(rawTMax, tMin + (rawTMax <= tMin ? 3600000 : 0));
    const timeSpan = Math.max(tMax - tMin, 3600000);
    const hoverMs = tMin + ((x - padLeft) / plotW) * timeSpan;

    // Find nearest point within tolerance
    const values = analyses.map((a, k) => {
      let nearestVal: number | null = null;
      let minDiff = Infinity;
      a.activePoints.forEach(p => {
        const diff = Math.abs(p.timestamp - hoverMs);
        if (diff < minDiff && diff <= 3 * 86400000) {
          minDiff = diff;
          nearestVal = p.tmp;
        }
      });
      return {
        name: a.unitName,
        val: nearestVal,
        color: UNIT_COLORS[k % UNIT_COLORS.length]
      };
    });

    const d = new Date(hoverMs);
    const dateDisplay = `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${String(d.getUTCFullYear()).slice(-2)} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;

    setHoveredPoint({
      dateStr: dateDisplay,
      values,
      xPx: x,
      yPx: y
    });
  };

  const handleMouseLeave = () => setHoveredPoint(null);

  return (
    <div className="bg-[#13141F] border border-[#1F2238] rounded-xl p-5 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">
              แนวโน้ม TMP ทุก Unit
            </h2>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30">
              {viewMode === 'cycles' ? 'แสดงทุกรอบบันทึก' : 'เฉลี่ยรายวัน'}
            </span>
          </div>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            เปรียบเทียบแรงดันตกคร่อมเยื่อกรองระหว่างยูนิต เพื่อระบุโมดูลที่อุดตันเร็วกว่าปกติ
          </p>
        </div>

        {/* View mode & Zoom toggles */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#090A0F] border border-[#1F2238] p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setViewMode('cycles')}
              className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
                viewMode === 'cycles' ? 'bg-[#8B5CF6] text-white shadow-xs font-semibold' : 'text-[#A1A1AA] hover:text-white'
              }`}
              title="แสดงทุกจุดรอบการวัดจริงตามที่บันทึกมา"
            >
              ทุกรอบกรอง ({maxPoints} จุด)
            </button>
            <button
              onClick={() => setViewMode('daily')}
              className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
                viewMode === 'daily' ? 'bg-[#8B5CF6] text-white shadow-xs font-semibold' : 'text-[#A1A1AA] hover:text-white'
              }`}
              title="ยุบรวมค่าเฉลี่ยเป็นรายวัน"
            >
              เฉลี่ยรายวัน
            </button>
          </div>

          <button
            onClick={() => setZoomY(!zoomY)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
              zoomY
                ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border-[#8B5CF6]/40 font-semibold'
                : 'bg-[#090A0F] text-[#A1A1AA] border-[#1F2238] hover:text-white'
            }`}
            title="ขยายสเกลแกนตั้งให้พอดีกับค่า TMP จริงเพื่อดูการเปลี่ยนแปลงได้ชัดเจน"
          >
            <ZoomIn className="w-3 h-3" />
            <span>{zoomY ? 'สเกลซูม (Zoomed)' : 'สเกลเต็ม 0.7 bar'}</span>
          </button>
        </div>
      </div>

      {/* Legend with interactive toggles */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#1F2238] text-xs">
        <span className="text-[#A1A1AA] text-[11px] mr-1">คลิกเพื่อซ่อน/แสดง:</span>
        {analyses.map((a, k) => {
          const isVisible = visibleUnits[k];
          const color = UNIT_COLORS[k % UNIT_COLORS.length];
          return (
            <button
              key={a.unitName}
              onClick={() => toggleUnit(k)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-opacity cursor-pointer border ${
                isVisible
                  ? 'border-[#2C2F4D] bg-[#090A0F] font-medium text-white shadow-xs'
                  : 'border-dashed border-[#1F2238] bg-[#090A0F]/50 opacity-40 line-through text-[#71717A]'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full shadow-xs" style={{ backgroundColor: color }} />
              <span>{a.unitName}</span>
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-3 text-[11px] text-[#A1A1AA]">
          <span className="flex items-center gap-1">
            <span className="w-3 border-t-2 border-dashed border-amber-400 inline-block" />
            <span>เตือน {warningTmp} bar</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 border-t-2 border-rose-500 inline-block" />
            <span>วิกฤต {criticalTmp} bar</span>
          </span>
        </div>
      </div>

      {/* Canvas Chart Area */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative w-full h-[340px] bg-[#090A0F] rounded-lg overflow-hidden border border-[#1F2238]"
      >
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* Empty state if no data points in range */}
        {maxPoints === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#090A0F]/90 text-center p-4">
            <Activity className="w-8 h-8 text-[#A1A1AA] mb-2" />
            <p className="text-sm font-semibold text-white">ไม่มีข้อมูลในช่วงเวลาที่เลือก</p>
            <p className="text-xs text-[#A1A1AA] mt-0.5">กรุณาคลิก "แสดงค่าเท่าที่ข้อมูลมี" เพื่อดูข้อมูลจริงทั้งหมด</p>
          </div>
        )}

        {/* Hover Crosshair & Tooltip */}
        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none bg-[#13141F]/95 text-white p-2.5 rounded-xl text-xs shadow-2xl border border-[#8B5CF6]/40 min-w-[170px] backdrop-blur-md"
            style={{
              left: Math.min(Math.max(hoveredPoint.xPx + 15, 60), containerRef.current ? containerRef.current.clientWidth - 190 : 300),
              top: Math.max(hoveredPoint.yPx - 70, 10)
            }}
          >
            <div className="font-bold border-b border-[#1F2238] pb-1 mb-1 text-[#A1A1AA] text-[11px]">
              {hoveredPoint.dateStr}
            </div>
            <div className="space-y-1 font-mono text-[11px]">
              {hoveredPoint.values.map(v => (
                <div key={v.name} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 font-sans" style={{ color: v.color }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} />
                    {v.name}:
                  </span>
                  <span className="font-bold text-white">
                    {v.val !== null ? `${v.val.toFixed(3)} bar` : '-'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

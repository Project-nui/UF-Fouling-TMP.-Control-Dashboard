import React, { useRef, useEffect, useState } from 'react';
import { UnitAnalysis, formatDate } from '../utils/membraneCalculations';
import { UNIT_COLORS } from '../data/initialData';
import { ZoomIn, Activity } from 'lucide-react';

interface MultiUnitTmpChartProps {
  analyses: UnitAnalysis[];
  warningTmp: number;
  criticalTmp: number;
  timeRangeStart: number;
  timeRangeEnd: number;
  onUpdateThresholds?: (newWarning: number, newCritical: number) => void;
}

export interface ActionInfo {
  type: 'AS/RF' | 'EFM' | 'CIP';
  title: string;
  actionName: string;
  badgeBg: string;
  badgeColor: string;
  icon: string;
  recommendation: string;
  stepGuideline: string;
}

export function getPointAction(tmp: number, warningTmp: number, criticalTmp: number): ActionInfo {
  if (tmp >= criticalTmp) {
    return {
      type: 'CIP',
      title: 'CIP (Clean-In-Place)',
      actionName: 'ล้างเคมีเข้มข้น/ฟื้นฟูใหญ่',
      badgeBg: 'bg-rose-50 text-rose-800 border-rose-300',
      badgeColor: '#DC2626',
      icon: '🛑',
      recommendation: `TMP (${tmp.toFixed(3)} bar) สูงเกินเกณฑ์วิกฤต (≥ ${criticalTmp.toFixed(2)} bar)`,
      stepGuideline: 'ควรทำความสะอาด CIP ทันที: ล้างเคมีเข้มข้น แช่นาน 1–2 ชม. เพื่อสลายคราบฝังแน่นและฟื้นฟูเยื่อกรอง'
    };
  }
  if (tmp >= warningTmp) {
    return {
      type: 'EFM',
      title: 'EFM (Enhanced Flux Maintenance)',
      actionName: 'ล้างเคมีช่วงสั้น/เจือจาง',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-300',
      badgeColor: '#D97706',
      icon: '⚡',
      recommendation: `TMP (${tmp.toFixed(3)} bar) แตะเกณฑ์เตือน (≥ ${warningTmp.toFixed(2)} bar)`,
      stepGuideline: 'ควรทำ EFM: ล้างเคมีเจือจางช่วงสั้น 15–30 นาที เพื่อสลายคราบสะสมก่อนลุกลามถึงจุดวิกฤต'
    };
  }
  return {
    type: 'AS/RF',
    title: 'AS/RF (Air Scrubbing / Backwash)',
    actionName: 'ล้างทางกายภาพตามรอบปกติ',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    badgeColor: '#059669',
    icon: '💧',
    recommendation: `TMP (${tmp.toFixed(3)} bar) อยู่ในเกณฑ์ปกติ (< ${warningTmp.toFixed(2)} bar)`,
    stepGuideline: 'เดินระบบตามปกติ และทำกายภาพ AS/RF (เป่าลมร่วมล้างย้อนน้ำ) ทุก 30–60 นาที'
  };
}

export const MultiUnitTmpChart: React.FC<MultiUnitTmpChartProps> = ({
  analyses,
  warningTmp,
  criticalTmp,
  timeRangeStart,
  timeRangeEnd,
  onUpdateThresholds
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Local state for interactive threshold configuration
  const [localWarning, setLocalWarning] = useState<number>(warningTmp);
  const [localCritical, setLocalCritical] = useState<number>(criticalTmp);
  const [showThresholds, setShowThresholds] = useState<boolean>(true);

  // Sync with prop updates
  useEffect(() => {
    setLocalWarning(warningTmp);
  }, [warningTmp]);

  useEffect(() => {
    setLocalCritical(criticalTmp);
  }, [criticalTmp]);

  const handleAdjustWarning = (delta: number) => {
    const val = Math.max(0.01, Math.round((localWarning + delta) * 100) / 100);
    setLocalWarning(val);
    onUpdateThresholds?.(val, localCritical);
  };

  const handleAdjustCritical = (delta: number) => {
    const val = Math.max(localWarning + 0.01, Math.round((localCritical + delta) * 100) / 100);
    setLocalCritical(val);
    onUpdateThresholds?.(localWarning, val);
  };

  const handleDirectWarningChange = (val: number) => {
    if (isNaN(val)) return;
    const clean = Math.max(0.01, Math.round(val * 1000) / 1000);
    setLocalWarning(clean);
    onUpdateThresholds?.(clean, localCritical);
  };

  const handleDirectCriticalChange = (val: number) => {
    if (isNaN(val)) return;
    const clean = Math.max(0.01, Math.round(val * 1000) / 1000);
    setLocalCritical(clean);
    onUpdateThresholds?.(localWarning, clean);
  };

  const handleApplyPreset = (w: number, c: number) => {
    setLocalWarning(w);
    setLocalCritical(c);
    onUpdateThresholds?.(w, c);
  };

  const maxPoints = Math.max(...analyses.map(a => a.activePoints.length), 0);
  const isShortRange = (timeRangeEnd - timeRangeStart) <= 45 * 86400000;
  const [viewMode, setViewMode] = useState<'cycles' | 'daily'>(
    isShortRange || maxPoints <= 300 ? 'cycles' : 'daily'
  );
  const [zoomY, setZoomY] = useState(true);

  // Auto-switch to cycles whenever dataset or time range changes to a short period or <= 300 points
  useEffect(() => {
    const isShort = (timeRangeEnd - timeRangeStart) <= 45 * 86400000;
    const pts = Math.max(...analyses.map(a => a.activePoints.length), 0);
    if (isShort || pts <= 300) {
      setViewMode('cycles');
    }
  }, [timeRangeStart, timeRangeEnd, analyses]);

  // Rich Point Hover state with Action Recommendation (EFM, CIP, AS/RF)
  const [hoveredPoint, setHoveredPoint] = useState<{
    dateStr: string;
    timestamp: number;
    unitName: string;
    unitColor: string;
    tmp: number;
    xPx: number;
    yPx: number;
    action: ActionInfo;
    otherUnits: { name: string; val: number | null; color: string }[];
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

    // Crisp white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // =========================================================================
    // DATA DRIVEN RENDERING (cycles / daily trend curves)
    // =========================================================================
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
    if (showThresholds) {
      maxVal = Math.max(localCritical * 1.15, localWarning * 1.25, maxObserved * 1.15, 0.25);
    } else if (zoomY && maxObserved < localCritical) {
      maxVal = Math.max(maxObserved * 1.35, 0.20);
    } else {
      maxVal = Math.max(localCritical * 1.15, maxObserved * 1.05, 0.5);
    }
    const minVal = minObserved < -0.005 ? Math.floor(minObserved * 20) / 20 - 0.02 : 0;
    const ySpan = Math.max(maxVal - minVal, 0.05);

    const getX = (t: number) => padLeft + Math.max(0, Math.min(plotW, ((t - tMin) / timeSpan) * plotW));
    const getY = (v: number) => padTop + plotH - Math.max(0, Math.min(plotH, ((v - minVal) / ySpan) * plotH));

    // Draw Light Subtle Grid & Y-Ticks
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

    // X Axis Ticks (Dates / Hours)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748B';
    const xTicksCount = Math.min(8, Math.max(4, Math.floor(plotW / 95)));
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

    // Threshold lines & highlighted safety zones
    if (showThresholds) {
      // 1. Shaded Warning Zone (between warning and critical)
      if (localWarning < localCritical && localWarning <= maxVal) {
        const yTop = getY(Math.min(localCritical, maxVal));
        const yBottom = getY(Math.max(localWarning, minVal));
        if (yBottom > yTop) {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
          ctx.fillRect(padLeft, yTop, plotW, yBottom - yTop);
        }
      }

      // 2. Shaded Critical Zone (above critical)
      if (localCritical <= maxVal) {
        const yCritTop = getY(maxVal);
        const yCritBottom = getY(localCritical);
        if (yCritBottom > yCritTop) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
          ctx.fillRect(padLeft, yCritTop, plotW, yCritBottom - yCritTop);
        }
      }

      // 3. Warning Line (เส้นเตือน EFM)
      if (localWarning >= minVal && localWarning <= maxVal) {
        const yWarn = getY(localWarning);
        ctx.save();
        ctx.strokeStyle = '#D97706';
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padLeft, yWarn);
        ctx.lineTo(width - padRight, yWarn);
        ctx.stroke();

        // Right side badge
        const warnText = `⚠️ เตือน (EFM): ${localWarning.toFixed(2)} bar`;
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

      // 4. Critical Line (เส้นวิกฤต CIP)
      if (localCritical >= minVal && localCritical <= maxVal) {
        const yCrit = getY(localCritical);
        ctx.save();
        ctx.strokeStyle = '#DC2626';
        ctx.setLineDash([5, 3]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padLeft, yCrit);
        ctx.lineTo(width - padRight, yCrit);
        ctx.stroke();

        // Right side badge
        const critText = `🛑 วิกฤต (CIP): ${localCritical.toFixed(2)} bar`;
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
    }

    // Unit Series Curves & Dots
    chartSeries.forEach((s, k) => {
      if (!visibleUnits[k] || s.points.length === 0) return;
      const color = UNIT_COLORS[k % UNIT_COLORS.length];

      // Draw lines if 2 or more points
      if (s.points.length >= 2) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        s.points.forEach((pt, i) => {
          const x = getX(pt.timestamp);
          const y = getY(pt.tmp);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      // Draw distinct circular dots
      const dotRadius = s.points.length > 100 ? 2.5 : 3.5;
      s.points.forEach(pt => {
        const x = getX(pt.timestamp);
        const y = getY(pt.tmp);

        // Highlight abnormal points on the graph
        if (pt.tmp >= localCritical) {
          ctx.fillStyle = '#DC2626';
          ctx.beginPath();
          ctx.arc(x, y, dotRadius + 1.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (pt.tmp >= localWarning) {
          ctx.fillStyle = '#D97706';
          ctx.beginPath();
          ctx.arc(x, y, dotRadius + 1, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    });

    // If a point is currently hovered, draw crosshair guidelines and target on canvas
    if (hoveredPoint) {
      const hx = hoveredPoint.xPx;
      const hy = hoveredPoint.yPx;

      ctx.save();
      // Vertical guide line
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hx, padTop);
      ctx.lineTo(hx, padTop + plotH);
      ctx.stroke();

      // Horizontal guide line
      ctx.beginPath();
      ctx.moveTo(padLeft, hy);
      ctx.lineTo(width - padRight, hy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Target circle around hovered point with action-specific color
      ctx.strokeStyle = hoveredPoint.action.badgeColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(hx, hy, 7, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(hx, hy, 3, 0, Math.PI * 2);
      ctx.fill();

      // Mini action badge floating on canvas
      const badgeText = hoveredPoint.action.type;
      ctx.font = 'bold 10px system-ui';
      const bW = ctx.measureText(badgeText).width + 12;
      const bH = 18;
      const bX = Math.max(padLeft, Math.min(width - padRight - bW, hx - bW / 2));
      const bY = hy - 22 > padTop ? hy - 22 : hy + 12;

      ctx.fillStyle = hoveredPoint.action.badgeColor;
      ctx.beginPath();
      ctx.roundRect(bX, bY, bW, bH, 4);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, bX + bW / 2, bY + bH / 2);
      ctx.restore();
    }
  }, [analyses, localWarning, localCritical, showThresholds, timeRangeStart, timeRangeEnd, visibleUnits, viewMode, zoomY, hoveredPoint]);

  // Handle Mouse Hover / Movement to find the exact nearest point
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padLeft = 55;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 40;
    const plotW = canvas.clientWidth - padLeft - padRight;
    const plotH = canvas.clientHeight - padTop - padBottom;

    if (x < padLeft || x > padLeft + plotW || y < padTop || y > padTop + plotH) {
      setHoveredPoint(null);
      return;
    }

    const allTs: number[] = [];
    analyses.forEach(a => a.activePoints.forEach(p => allTs.push(p.timestamp)));
    const ptsMin = allTs.length > 0 ? Math.min(...allTs) : Date.now() - 86400000;
    const ptsMax = allTs.length > 0 ? Math.max(...allTs) : Date.now();
    const effectiveStart = isFinite(timeRangeStart) && timeRangeStart > 0 && allTs.length > 0 ? Math.max(timeRangeStart, ptsMin) : ptsMin;
    const effectiveEnd = isFinite(timeRangeEnd) && timeRangeEnd > 0 && allTs.length > 0 ? Math.min(timeRangeEnd, ptsMax) : ptsMax;
    const tMin = effectiveStart;
    const rawTMax = effectiveEnd;
    const tMax = Math.max(rawTMax, tMin + (rawTMax <= tMin ? 3600000 : 0));
    const timeSpan = Math.max(tMax - tMin, 3600000);

    let maxObserved = 0;
    let minObserved = 0;
    analyses.forEach(a => {
      a.activePoints.forEach(pt => {
        if (pt.tmp > maxObserved) maxObserved = pt.tmp;
        if (pt.tmp < minObserved) minObserved = pt.tmp;
      });
    });

    let maxVal: number;
    if (showThresholds) {
      maxVal = Math.max(localCritical * 1.15, localWarning * 1.25, maxObserved * 1.15, 0.25);
    } else if (zoomY && maxObserved < localCritical) {
      maxVal = Math.max(maxObserved * 1.35, 0.20);
    } else {
      maxVal = Math.max(localCritical * 1.15, maxObserved * 1.05, 0.5);
    }
    const minVal = minObserved < -0.005 ? Math.floor(minObserved * 20) / 20 - 0.02 : 0;
    const ySpan = Math.max(maxVal - minVal, 0.05);

    const getX = (t: number) => padLeft + Math.max(0, Math.min(plotW, ((t - tMin) / timeSpan) * plotW));
    const getY = (v: number) => padTop + plotH - Math.max(0, Math.min(plotH, ((v - minVal) / ySpan) * plotH));

    // Find the closest point across all visible units in 2D space
    let bestDistSq = Infinity;
    let closestCandidate: {
      unitName: string;
      unitColor: string;
      point: { timestamp: number; dateStr: string; tmp: number };
      px: number;
      py: number;
    } | null = null;

    for (let k = 0; k < analyses.length; k++) {
      if (!visibleUnits[k]) continue;
      const a = analyses[k];
      const pts = viewMode === 'cycles'
        ? a.activePoints.map(p => ({ timestamp: p.timestamp, dateStr: p.dateStr, tmp: p.tmp }))
        : (() => {
            const dayMap: Record<string, { sum: number; count: number; timestamp: number }> = {};
            a.activePoints.forEach(p => {
              if (!dayMap[p.dateStr]) dayMap[p.dateStr] = { sum: 0, count: 0, timestamp: p.timestamp };
              dayMap[p.dateStr].sum += p.tmp;
              dayMap[p.dateStr].count++;
            });
            return Object.keys(dayMap).sort().map(d => ({
              dateStr: d,
              timestamp: dayMap[d].timestamp,
              tmp: dayMap[d].sum / dayMap[d].count
            }));
          })();

      for (let j = 0; j < pts.length; j++) {
        const p = pts[j];
        if (p.timestamp < tMin || p.timestamp > tMax) continue;
        const px = getX(p.timestamp);
        const py = getY(p.tmp);
        const distSq = (x - px) ** 2 + (y - py) ** 2;

        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          closestCandidate = {
            unitName: a.unitName,
            unitColor: UNIT_COLORS[k % UNIT_COLORS.length],
            point: p,
            px,
            py
          };
        }
      }
    }

    // Limit snap distance to ~55px
    if (!closestCandidate || bestDistSq > 55 * 55) {
      setHoveredPoint(null);
      return;
    }

    const target = closestCandidate;
    const { unitName, unitColor, point, px, py } = target;
    const action = getPointAction(point.tmp, localWarning, localCritical);

    // Also collect values of other units at nearest timestamp
    const otherUnits = analyses
      .map((a, k) => {
        let nearestVal: number | null = null;
        let minDiff = Infinity;
        a.activePoints.forEach(p => {
          const diff = Math.abs(p.timestamp - point.timestamp);
          if (diff < minDiff && diff <= 3600000 * 6) {
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

    setHoveredPoint({
      dateStr: point.dateStr,
      timestamp: point.timestamp,
      unitName,
      unitColor,
      tmp: point.tmp,
      xPx: px,
      yPx: py,
      action,
      otherUnits
    });
  };

  const handleMouseLeave = () => setHoveredPoint(null);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              แนวโน้ม TMP ทุก Unit
            </h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg border bg-blue-50 text-blue-700 border-blue-200">
              {viewMode === 'cycles' ? 'แสดงทุกรอบบันทึก' : 'เฉลี่ยรายวัน'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            เปรียบเทียบแรงดันตกคร่อมเยื่อกรองระหว่างยูนิต · ชี้ที่จุด (Point) บนกราฟเพื่อเปิด Popup คำแนะนำว่าควรทำอะไร (AS/RF, EFM, CIP)
          </p>
        </div>

        {/* View mode & Zoom toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 border border-slate-200 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setViewMode('cycles')}
              className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
                viewMode === 'cycles' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="แสดงทุกจุดรอบการวัดจริงตามที่บันทึกมา"
            >
              ทุกรอบกรอง ({maxPoints} จุด)
            </button>
            <button
              onClick={() => setViewMode('daily')}
              className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
                viewMode === 'daily' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
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
                ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="ขยายสเกลแกนตั้งให้พอดีกับค่า TMP จริงเพื่อดูการเปลี่ยนแปลงได้ชัดเจน"
          >
            <ZoomIn className="w-3.5 h-3.5 text-blue-600" />
            <span>{zoomY ? 'สเกลซูม (Zoomed)' : 'สเกลเต็ม 0.7 bar'}</span>
          </button>
        </div>
      </div>

      {/* Legend with interactive toggles & Action Guidelines Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-500 text-[11px] mr-1">คลิกเพื่อซ่อน/แสดง:</span>
          {analyses.map((a, k) => {
            const isVisible = visibleUnits[k];
            const color = UNIT_COLORS[k % UNIT_COLORS.length];
            return (
              <button
                key={a.unitName}
                onClick={() => toggleUnit(k)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-opacity cursor-pointer border ${
                  isVisible
                    ? 'border-slate-300 bg-white font-medium text-slate-800 shadow-2xs'
                    : 'border-dashed border-slate-200 bg-slate-50 opacity-40 line-through text-slate-400'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full shadow-2xs" style={{ backgroundColor: color }} />
                <span>{a.unitName}</span>
              </button>
            );
          })}
        </div>

        {/* Action Indicators for Points */}
        <div className="flex items-center gap-3 text-[11px] text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
          <span className="text-slate-500 font-semibold text-[10px]">คำแนะนำที่จุด:</span>
          <span className="flex items-center gap-1 text-emerald-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>💧 AS/RF (ปกติ)</span>
          </span>
          <span className="flex items-center gap-1 text-amber-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>⚡ EFM (≥{localWarning.toFixed(2)}b)</span>
          </span>
          <span className="flex items-center gap-1 text-rose-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>🛑 CIP (≥{localCritical.toFixed(2)}b)</span>
          </span>
        </div>
      </div>

      {/* Interactive Threshold Setting Toolbar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Warning Setter */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-800 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200 inline-block"></span>
              <span>เส้นเตือน EFM (Warning):</span>
            </span>
            <div className="flex items-center bg-white border border-amber-300 rounded-lg overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => handleAdjustWarning(-0.02)}
                className="px-2 py-1 text-amber-700 hover:bg-amber-100 font-bold transition-colors cursor-pointer"
                title="ลดค่าเกณฑ์เตือน 0.02 bar"
              >
                -
              </button>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="1.50"
                value={localWarning}
                onChange={e => handleDirectWarningChange(Number(e.target.value))}
                className="w-16 text-center font-mono font-bold text-amber-900 bg-transparent text-xs py-1 outline-none"
              />
              <button
                type="button"
                onClick={() => handleAdjustWarning(0.02)}
                className="px-2 py-1 text-amber-700 hover:bg-amber-100 font-bold transition-colors cursor-pointer"
                title="เพิ่มค่าเกณฑ์เตือน 0.02 bar"
              >
                +
              </button>
            </div>
            <span className="text-slate-500 text-[11px] font-mono">bar</span>
          </div>

          {/* Critical Setter */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-rose-800 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200 inline-block"></span>
              <span>เส้นวิกฤต CIP (Critical):</span>
            </span>
            <div className="flex items-center bg-white border border-rose-300 rounded-lg overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => handleAdjustCritical(-0.02)}
                className="px-2 py-1 text-rose-700 hover:bg-rose-100 font-bold transition-colors cursor-pointer"
                title="ลดค่าเกณฑ์วิกฤต 0.02 bar"
              >
                -
              </button>
              <input
                type="number"
                step="0.01"
                min="0.02"
                max="2.00"
                value={localCritical}
                onChange={e => handleDirectCriticalChange(Number(e.target.value))}
                className="w-16 text-center font-mono font-bold text-rose-900 bg-transparent text-xs py-1 outline-none"
              />
              <button
                type="button"
                onClick={() => handleAdjustCritical(0.02)}
                className="px-2 py-1 text-rose-700 hover:bg-rose-100 font-bold transition-colors cursor-pointer"
                title="เพิ่มค่าเกณฑ์วิกฤต 0.02 bar"
              >
                +
              </button>
            </div>
            <span className="text-slate-500 text-[11px] font-mono">bar</span>
          </div>
        </div>

        {/* Quick Presets & Show Line Toggle */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-500 text-[11px]">Preset:</span>
          <button
            type="button"
            onClick={() => handleApplyPreset(0.40, 0.60)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
              localWarning === 0.40 && localCritical === 0.60
                ? 'bg-blue-600 text-white font-bold shadow-2xs'
                : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200'
            }`}
            title="เกณฑ์มาตรฐานตามคู่มือวิศวกรรม WHA-UP"
          >
            มาตรฐาน (0.40 / 0.60)
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset(0.30, 0.50)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
              localWarning === 0.30 && localCritical === 0.50
                ? 'bg-blue-600 text-white font-bold shadow-2xs'
                : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200'
            }`}
            title="เกณฑ์เฝ้าระวังเข้มงวด"
          >
            เข้มงวด (0.30 / 0.50)
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset(0.12, 0.18)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
              localWarning === 0.12 && localCritical === 0.18
                ? 'bg-blue-600 text-white font-bold shadow-2xs'
                : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200'
            }`}
            title="ปรับระดับเส้นให้พาดผ่านข้อมูลจริง (~0.09-0.17 bar)"
          >
            ทดสอบกับข้อมูลจริง (0.12 / 0.18)
          </button>

          <button
            type="button"
            onClick={() => setShowThresholds(!showThresholds)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ml-1 ${
              showThresholds
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            <span>{showThresholds ? '✓ แสดงเส้นบนกราฟ' : 'ซ่อนเส้น'}</span>
          </button>
        </div>
      </div>

      {/* Canvas Chart Area */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative w-full h-[340px] bg-white rounded-lg overflow-hidden border border-slate-200 transition-all cursor-crosshair select-none"
      >
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* Empty state if no data points in range */}
        {maxPoints === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 text-center p-4">
            <Activity className="w-8 h-8 text-slate-400 mb-2" />
            <p className="text-sm font-semibold text-slate-800">ไม่มีข้อมูลในช่วงเวลาที่เลือก</p>
            <p className="text-xs text-slate-500 mt-0.5">กรุณาคลิก &quot;แสดงค่าเท่าที่ข้อมูลมี&quot; เพื่อดูข้อมูลจริงทั้งหมด</p>
          </div>
        )}

        {/* High-Fidelity Interactive Popup at the point with Action Guidelines (AS/RF, EFM, CIP) */}
        {hoveredPoint && (
          <>
            {/* Pulsing ring directly on the canvas point */}
            <div
              className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 animate-ping"
              style={{
                left: hoveredPoint.xPx,
                top: hoveredPoint.yPx,
                borderColor: hoveredPoint.action.badgeColor
              }}
            />

            {/* Rich Floating Action Card Popup */}
            <div
              className="absolute z-30 pointer-events-none bg-white text-slate-800 p-3 rounded-xl text-xs shadow-xl border min-w-[270px] max-w-[330px] transition-all duration-75"
              style={{
                borderColor: hoveredPoint.action.badgeColor,
                left: (() => {
                  const cW = containerRef.current?.clientWidth || 800;
                  const cardW = 310;
                  if (hoveredPoint.xPx + cardW + 20 > cW) {
                    return Math.max(12, hoveredPoint.xPx - cardW - 16);
                  }
                  return Math.min(cW - cardW - 12, hoveredPoint.xPx + 16);
                })(),
                top: (() => {
                  const cH = 340;
                  const cardH = 220;
                  return Math.max(12, Math.min(cH - cardH - 12, hoveredPoint.yPx - 70));
                })()
              }}
            >
              {/* Header: Unit & Timestamp */}
              <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                <span className="font-bold flex items-center gap-1.5 text-xs" style={{ color: hoveredPoint.unitColor }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hoveredPoint.unitColor }} />
                  <span>{hoveredPoint.unitName}</span>
                </span>
                <span className="text-slate-500 text-[11px] font-mono">{hoveredPoint.dateStr}</span>
              </div>

              {/* Action Recommendation Box (AS/RF · EFM · CIP) */}
              <div
                className={`p-2.5 rounded-lg border mb-2 text-xs space-y-1 ${hoveredPoint.action.badgeBg}`}
              >
                <div className="flex items-center justify-between gap-1.5 font-bold">
                  <span className="flex items-center gap-1.5 text-xs">
                    <span className="text-sm">{hoveredPoint.action.icon}</span>
                    <span>จุดนี้ควรทำ: {hoveredPoint.action.type}</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/70 text-slate-800 border border-slate-200 font-mono">
                    {hoveredPoint.action.actionName}
                  </span>
                </div>
                <p className="text-[11px] leading-snug">
                  {hoveredPoint.action.stepGuideline}
                </p>
              </div>

              {/* TMP vs Thresholds Comparison */}
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-1 font-mono text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">ค่า TMP ที่จุดนี้:</span>
                  <span className="font-bold text-slate-900 text-xs">{hoveredPoint.tmp.toFixed(3)} bar</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-amber-800 font-semibold">เกณฑ์เตือน (EFM):</span>
                  <span className="text-amber-700 font-bold">{localWarning.toFixed(2)} bar</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-rose-800 font-semibold">เกณฑ์วิกฤต (CIP):</span>
                  <span className="text-rose-700 font-bold">{localCritical.toFixed(2)} bar</span>
                </div>
              </div>

              {/* Other units at this point in time */}
              {hoveredPoint.otherUnits.length > 1 && (
                <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] space-y-1">
                  <div className="text-slate-500 text-[9px] font-semibold uppercase tracking-wider">
                    ยูนิตอื่นๆ ณ เวลานี้:
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono">
                    {hoveredPoint.otherUnits
                      .filter(ou => ou.name !== hoveredPoint.unitName)
                      .map(ou => (
                        <div key={ou.name} className="flex items-center justify-between">
                          <span className="truncate mr-1 text-[10px] font-medium" style={{ color: ou.color }}>
                            {ou.name}:
                          </span>
                          <span className="text-slate-700 font-semibold">
                            {ou.val !== null ? `${ou.val.toFixed(3)}b` : '-'}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

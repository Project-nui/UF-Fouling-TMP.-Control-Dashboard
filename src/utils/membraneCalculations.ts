import { ProcessedDataset } from '../data/initialData';

export interface MembraneParameters {
  modulesCount: number;        // e.g. 22 modules
  areaPerModule: number;       // e.g. 99 m2
  warningTmp: number;          // e.g. 0.40 bar
  criticalTmp: number;         // e.g. 0.60 bar
  minFlux: number;             // e.g. 30 LMH
  efmDrop: number;             // e.g. 0.10 bar drop
  cipDrop: number;             // e.g. 0.30 bar drop
  consecutiveEfmLimit: number; // e.g. 3 times
  fluxAveraging: 'daily' | 'all';
  minPermeability?: number;    // e.g. 100 LMH/bar (เกณฑ์เตือนเมื่อต่ำกว่า = เริ่มอุดตัน)
  maxPermeability?: number;    // e.g. 700 LMH/bar (เกณฑ์เตือนเมื่อสูงกว่า = เสี่ยงเยื่อกรองขาด/รั่ว)
}

export interface CleaningEvent {
  timestamp: number;
  dateStr: string;
  tmpBefore: number;
  tmpDrop: number;
  type: 'EFM' | 'CIP';
}

export interface UnitAnalysis {
  unitIdx: number;
  unitName: string;
  activePoints: { timestamp: number; dateStr: string; tmp: number; flow: number | null; flux: number | null }[];
  events: CleaningEvent[];
  currentTmp: number | null;
  maxTmp: number;
  minTmp: number;
  avgFlux: number | null;
  minFlux: number | null;
  maxFlux: number | null;
  latestFlux: number | null;
  avgPermeability: number | null;
  permeabilityStatus?: 'normal' | 'low' | 'high' | 'no-data';
  permeabilityAlert?: string | null;
  percentTimeOverWarning: number;
  percentOperatingDuty: number;
  efmCount: number;
  cipCount: number;
  status: 'normal' | 'warning' | 'critical' | 'no-data';
  statusLabel: string;
  statusColor: string;
  actionRecommendation: string;
  actionReason: string;
  actionType: 'normal' | 'prep-efm' | 'efm' | 'cip';
}

export const formatDate = (ms: number): string => {
  if (ms === null || ms === undefined || isNaN(ms)) return '';
  try {
    const d = new Date(ms);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

export const formatDateTime = (ms: number): string => {
  if (ms === null || ms === undefined || isNaN(ms)) return '-';
  try {
    const d = new Date(ms);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return '-';
  }
};

export const formatNumber = (num: number | null | undefined, decimals = 2): string => {
  if (num === null || num === undefined || isNaN(num)) return '-';
  return num.toFixed(decimals);
};

export function analyzePlantData(
  dataset: ProcessedDataset,
  params: MembraneParameters,
  rangeStartMs: number,
  rangeEndMs: number
): UnitAnalysis[] {
  const totalArea = params.modulesCount * params.areaPerModule; // m2

  return dataset.tmp.map((unitTmpSeries, k) => {
    const activePoints: UnitAnalysis['activePoints'] = [];
    let fluxSum = 0;
    let fluxCount = 0;
    let allPointsCount = 0;
    let runPointsCount = 0;

    unitTmpSeries.forEach((tmpVal, i) => {
      const t = dataset.timestamps[i];
      if (t < rangeStartMs || t > rangeEndMs) return;

      allPointsCount++;
      const flowVal = dataset.flow[k] ? dataset.flow[k][i] : null;
      let fluxVal: number | null = null;

      if (flowVal !== null && flowVal !== undefined && totalArea > 0) {
        fluxVal = (flowVal / totalArea) * 1000; // LMH
      }

      // Check if running/filtering:
      // Active filtration if fluxVal >= minFlux, or positive permeate flow
      const isFiltering =
        fluxVal === null
          ? true
          : fluxVal >= params.minFlux || (fluxVal >= 2 && params.minFlux > 15);
      if (isFiltering && fluxVal !== null) {
        runPointsCount++;
      }

      // Preserve EVERY valid TMP record so NO imported data points are lost
      if (tmpVal !== null && tmpVal !== undefined && !isNaN(tmpVal)) {
        activePoints.push({
          timestamp: t,
          dateStr: formatDate(t),
          tmp: tmpVal,
          flow: flowVal,
          flux: fluxVal
        });

        if (fluxVal !== null && isFiltering) {
          fluxSum += fluxVal;
          fluxCount++;
        }
      }
    });

    // Detect cleaning events from drops in consecutive active TMP points
    const events: CleaningEvent[] = [];
    for (let i = 1; i < activePoints.length; i++) {
      const drop = activePoints[i - 1].tmp - activePoints[i].tmp;
      if (drop >= params.efmDrop) {
        events.push({
          timestamp: activePoints[i - 1].timestamp,
          dateStr: activePoints[i - 1].dateStr,
          tmpBefore: activePoints[i - 1].tmp,
          tmpDrop: drop,
          type: drop >= params.cipDrop ? 'CIP' : 'EFM'
        });
      }
    }

    const tmpVals = activePoints.map(p => p.tmp);
    const last14 = tmpVals.slice(-14);
    const currentTmp = last14.length > 0 ? last14.reduce((a, b) => a + b, 0) / last14.length : null;
    const maxTmp = tmpVals.length > 0 ? Math.max(...tmpVals) : 0;
    const minTmp = tmpVals.length > 0 ? Math.min(...tmpVals) : 0;

    const fluxVals = activePoints.map(p => p.flux).filter((f): f is number => f !== null);
    const avgFlux = fluxCount > 0 ? fluxSum / fluxCount : null;
    const minFlux = fluxVals.length > 0 ? Math.min(...fluxVals) : null;
    const maxFlux = fluxVals.length > 0 ? Math.max(...fluxVals) : null;
    const last14Flux = fluxVals.slice(-14);
    const latestFlux = last14Flux.length > 0 ? last14Flux.reduce((a, b) => a + b, 0) / last14Flux.length : null;

    const avgPermeability =
      avgFlux !== null && currentTmp !== null && currentTmp > 0 ? avgFlux / currentTmp : null;

    // Evaluate Permeability Alerts (High / Low alarms)
    const minPerm = params.minPermeability ?? 100;
    const maxPerm = params.maxPermeability ?? 700;
    let permeabilityStatus: UnitAnalysis['permeabilityStatus'] = 'no-data';
    let permeabilityAlert: string | null = null;

    if (avgPermeability !== null && !isNaN(avgPermeability)) {
      if (avgPermeability < minPerm) {
        permeabilityStatus = 'low';
        permeabilityAlert = `Permeability ต่ำ (${avgPermeability.toFixed(0)} < ${minPerm} LMH/bar) เสี่ยงอุดตันสะสม`;
      } else if (avgPermeability > maxPerm) {
        permeabilityStatus = 'high';
        permeabilityAlert = `Permeability สูงผิดปกติ (${avgPermeability.toFixed(0)} > ${maxPerm} LMH/bar) เสี่ยงเยื่อกรองรั่ว/ขาด`;
      } else {
        permeabilityStatus = 'normal';
      }
    }

    const overWarningCount = tmpVals.filter(v => v >= params.warningTmp).length;
    const percentTimeOverWarning = tmpVals.length > 0 ? (overWarningCount / tmpVals.length) * 100 : 0;
    const percentOperatingDuty = allPointsCount > 0 ? (runPointsCount / allPointsCount) * 100 : 100;

    const efmCount = events.filter(e => e.type === 'EFM').length;
    const cipCount = events.filter(e => e.type === 'CIP').length;

    // Status evaluation
    let status: UnitAnalysis['status'] = 'no-data';
    let statusLabel = 'ไม่มีข้อมูล';
    let statusColor = '#64748b';

    if (currentTmp !== null) {
      if (currentTmp >= params.criticalTmp) {
        status = 'critical';
        statusLabel = 'วิกฤต';
        statusColor = '#dc2626';
      } else if (currentTmp >= params.warningTmp) {
        status = 'warning';
        statusLabel = 'เฝ้าระวัง';
        statusColor = '#d97706';
      } else {
        status = 'normal';
        statusLabel = 'ปกติ';
        statusColor = '#16a34a';
      }
    }

    // Recommendation logic
    let actionRecommendation = 'AS/BW ตามปกติ';
    let actionReason = 'TMP อยู่ในเกณฑ์ปกติ → ดำเนินการ AS/BW ตามรอบปกติ เฝ้าดูแนวโน้ม';
    let actionType: UnitAnalysis['actionType'] = 'normal';

    if (currentTmp === null) {
      actionRecommendation = '-';
      actionReason = 'ไม่มีข้อมูลช่วงกรองในระบบ';
    } else {
      const lastCip = [...events].reverse().find(e => e.type === 'CIP');
      const efmSinceLastCip = events.filter(
        e => e.type === 'EFM' && (!lastCip || e.timestamp > lastCip.timestamp)
      ).length;

      if (currentTmp >= params.criticalTmp) {
        actionRecommendation = 'CIP';
        actionReason = `TMP (${currentTmp.toFixed(2)} bar) ถึงเกณฑ์วิกฤต (${params.criticalTmp.toFixed(2)} bar) → วางแผน CIP โดยเร็ว และตรวจคุณภาพน้ำป้อน/ปริมาณ Flux`;
        actionType = 'cip';
      } else if (efmSinceLastCip >= params.consecutiveEfmLimit) {
        actionRecommendation = 'CIP';
        actionReason = `ทำ EFM มาแล้ว ${efmSinceLastCip} ครั้งนับจาก CIP ล่าสุด → ควรทำ CIP เพื่อฟื้นสภาพเมมเบรนและขจัด irreversible foulants`;
        actionType = 'cip';
      } else if (currentTmp >= params.warningTmp) {
        actionRecommendation = 'EFM';
        actionReason = `TMP (${currentTmp.toFixed(2)} bar) เกินเกณฑ์เตือน (${params.warningTmp.toFixed(2)} bar) → ทำ EFM หากหลังล้างแล้ว TMP ไม่ลดลงให้เตรียม CIP`;
        actionType = 'efm';
      } else if (currentTmp >= params.warningTmp * 0.75) {
        actionRecommendation = 'AS/BW + เตรียม EFM';
        actionReason = `TMP (${currentTmp.toFixed(2)} bar) เริ่มไต่ใกล้เกณฑ์เตือน → ตรวจว่า AS/BW ทำงานครบ และเตรียมสารเคมีสำหรับ EFM`;
        actionType = 'prep-efm';
      }
    }

    return {
      unitIdx: k,
      unitName: `UF No.${k + 1}`,
      activePoints,
      events,
      currentTmp,
      maxTmp,
      minTmp,
      avgFlux,
      minFlux,
      maxFlux,
      latestFlux,
      avgPermeability,
      permeabilityStatus,
      permeabilityAlert,
      percentTimeOverWarning,
      percentOperatingDuty,
      efmCount,
      cipCount,
      status,
      statusLabel,
      statusColor,
      actionRecommendation,
      actionReason,
      actionType
    };
  });
}

// Calculate linear regression for Flux points
export function calculateLinearTrend(
  points: { timestamp: number; flux: number }[]
): { slopePerDay: number; changePer30Days: number; intercept: number; xMin: number; xMax: number } | null {
  if (points.length < 2) return null;
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += p.timestamp;
    sumY += p.flux;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    const dx = p.timestamp - meanX;
    const dy = p.flux - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
  }

  const slope = sxx !== 0 ? sxy / sxx : 0;
  const intercept = meanY - slope * meanX;
  const slopePerDay = slope * 86400000;
  const changePer30Days = slopePerDay * 30;

  return {
    slopePerDay,
    changePer30Days,
    intercept,
    xMin: points[0].timestamp,
    xMax: points[points.length - 1].timestamp
  };
}

import * as XLSX from 'xlsx';
import { ProcessedDataset } from '../data/initialData';
import { UnitAnalysis, MembraneParameters, formatDate } from './membraneCalculations';

export interface FileValidationResult {
  isValid: boolean;
  fileName: string;
  rowCount: number;
  dateStartStr: string;
  dateEndStr: string;
  detectedUnits: { unitIndex: number; unitName: string; hasTmp: boolean; hasFlow: boolean }[];
  previewRows: { dateStr: string; values: Record<string, string | number> }[];
  errors: string[];
  dataset: ProcessedDataset | null;
}

// Thai month abbreviations and full names
const THAI_MONTHS: Record<string, number> = {
  'ม.ค.': 0, 'ก.พ.': 1, 'มี.ค.': 2, 'เม.ย.': 3, 'พ.ค.': 4, 'มิ.ย.': 5,
  'ก.ค.': 6, 'ส.ค.': 7, 'ก.ย.': 8, 'ต.ค.': 9, 'พ.ย.': 10, 'ธ.ค.': 11,
  'มกราคม': 0, 'กุมภาพันธ์': 1, 'มีนาคม': 2, 'เมษายน': 3, 'พฤษภาคม': 4, 'มิถุนายน': 5,
  'กรกฎาคม': 6, 'สิงหาคม': 7, 'กันยายน': 8, 'ตุลาคม': 9, 'พฤศจิกายน': 10, 'ธันวาคม': 11,
  'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
  'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
};

// Robust Date Parser supporting SCADA formats: "1/7/25 0:00", "01/07/2025 14:24", Thai BE, ISO, Excel Serials, AM/PM
export function parsePlantDate(dateVal: any, timeVal?: any): number {
  if (dateVal === null || dateVal === undefined || dateVal === '') {
    return NaN;
  }

  let ms = NaN;

  if (dateVal instanceof Date) {
    const t = dateVal.getTime();
    ms = isNaN(t) ? NaN : t;
  } else if (typeof dateVal === 'number') {
    if (!isNaN(dateVal)) {
      // Excel serial number (days since 1899-12-30)
      if (dateVal > 10000 && dateVal < 80000) {
        ms = Math.round((dateVal - 25569) * 86400 * 1000);
      } else if (dateVal > 1000000000000) {
        // Unix epoch ms
        ms = dateVal;
      } else if (dateVal > 1000000000) {
        // Unix epoch seconds
        ms = dateVal * 1000;
      }
    }
  } else if (typeof dateVal === 'string') {
    const s = dateVal.trim();
    if (s) {
      // Check if numeric string serial
      const num = Number(s);
      if (!isNaN(num) && num > 10000 && num < 80000) {
        ms = Math.round((num - 25569) * 86400 * 1000);
      }

      if (isNaN(ms)) {
        // 1. Check Thai month string: e.g. "1 ก.ค. 2568 02:24", "01-ก.ค.-68", "15 กรกฎาคม 2568"
        for (const [mKey, mIdx] of Object.entries(THAI_MONTHS)) {
          if (s.toLowerCase().includes(mKey)) {
            const escaped = mKey.replace(/\./g, '\\.');
            const dayMatch = s.match(new RegExp(`(\\d{1,2})\\s*(?:-|\\/|\\.)?\\s*${escaped}`));
            const afterMonth = s.slice(s.toLowerCase().indexOf(mKey) + mKey.length).trim();
            const yearMatch = afterMonth.match(/^[\s\-\/\.]*(\d{2,4})/);
            const timeMatch = s.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);

            const d = dayMatch ? parseInt(dayMatch[1], 10) : 1;
            let y = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getUTCFullYear();
            if (y >= 50 && y < 100) {
              y = (y + 2500) - 543; // Thai BE short year (e.g. 68 -> 2025)
            } else if (y < 50) {
              y += 2000;
            } else if (y > 2500) {
              y -= 543; // Thai BE full year (e.g. 2568 -> 2025)
            }

            const h = timeMatch ? parseInt(timeMatch[1], 10) : 0;
            const min = timeMatch ? parseInt(timeMatch[2], 10) : 0;
            const sec = timeMatch && timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
            ms = Date.UTC(y, mIdx, d, h, min, sec);
            break;
          }
        }
      }

      if (isNaN(ms)) {
        // 2. Check D/M/YY or D/M/YYYY with optional time & AM/PM: e.g. "1/7/25 0:00" or "01/07/2025 14:24:00"
        const dmyRegex = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\s*(AM|PM))?)?$/i;
        const match = s.match(dmyRegex);
        if (match) {
          const d = parseInt(match[1], 10);
          const m = parseInt(match[2], 10) - 1; // 0-indexed month
          let y = parseInt(match[3], 10);
          if (y < 100) {
            y += 2000; // e.g. 25 -> 2025
          } else if (y > 2500) {
            y -= 543; // Buddhist Era (พ.ศ. -> ค.ศ.)
          }
          let hour = match[4] ? parseInt(match[4], 10) : 0;
          const min = match[5] ? parseInt(match[5], 10) : 0;
          const sec = match[6] ? parseInt(match[6], 10) : 0;
          const ampm = match[7] ? match[7].toUpperCase() : null;
          if (ampm === 'PM' && hour < 12) hour += 12;
          if (ampm === 'AM' && hour === 12) hour = 0;
          ms = Date.UTC(y, m, d, hour, min, sec);
        }
      }

      if (isNaN(ms)) {
        // 3. Check ISO: YYYY-MM-DD with optional time
        const isoRegex = /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\s*(AM|PM))?)?$/i;
        const isoMatch = s.match(isoRegex);
        if (isoMatch) {
          let y = parseInt(isoMatch[1], 10);
          if (y > 2500) y -= 543;
          const m = parseInt(isoMatch[2], 10) - 1;
          const d = parseInt(isoMatch[3], 10);
          let hour = isoMatch[4] ? parseInt(isoMatch[4], 10) : 0;
          const min = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
          const sec = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;
          const ampm = isoMatch[7] ? isoMatch[7].toUpperCase() : null;
          if (ampm === 'PM' && hour < 12) hour += 12;
          if (ampm === 'AM' && hour === 12) hour = 0;
          ms = Date.UTC(y, m, d, hour, min, sec);
        }
      }

      if (isNaN(ms)) {
        const parsed = Date.parse(s);
        if (!isNaN(parsed)) ms = parsed;
      }
    }
  }

  // If separate time column is provided, combine with date
  if (!isNaN(ms) && timeVal !== undefined && timeVal !== null && timeVal !== '') {
    if (typeof timeVal === 'number' && timeVal >= 0 && timeVal < 1) {
      // Excel fractional day (e.g. 0.5 = 12:00:00)
      const d = new Date(ms);
      const timeMs = Math.round(timeVal * 86400 * 1000);
      ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0) + timeMs;
    } else if (typeof timeVal === 'string') {
      const tm = timeVal.trim().match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\s*(AM|PM))?$/i);
      if (tm) {
        let h = parseInt(tm[1], 10);
        const m = parseInt(tm[2], 10);
        const sec = tm[3] ? parseInt(tm[3], 10) : 0;
        const ampm = tm[4] ? tm[4].toUpperCase() : null;
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        const d = new Date(ms);
        ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m, sec);
      }
    }
  }

  return ms;
}

export function parseExcelWorkbook(fileBuffer: ArrayBuffer, fileName: string): ProcessedDataset {
  const workbook = XLSX.read(fileBuffer, { cellDates: true });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('ไม่พบข้อมูลชีทในไฟล์ Excel');
  }

  // Search through all sheets to find the one containing membrane columns
  let chosenWorksheet: XLSX.WorkSheet | null = null;
  let chosenSheetName = workbook.SheetNames[0];
  let rawRows: any[][] = [];
  let headerRowIdx = -1;
  let tmpCols: Record<number, number> = {};
  let flowCols: Record<number, number> = {};
  let pInCols: Record<number, number> = {};
  let pOutCols: Record<number, number> = {};
  let dateColIdx = 0;
  let timeColIdx = -1;

  for (const sName of workbook.SheetNames) {
    const ws = workbook.Sheets[sName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true });
    if (!rows || rows.length < 2) continue;

    // Scan top 15 rows for membrane headers
    let foundHeader = -1;
    let sTmp: Record<number, number> = {};
    let sFlow: Record<number, number> = {};
    let sPIn: Record<number, number> = {};
    let sPOut: Record<number, number> = {};
    let sDate = -1;
    let sTime = -1;

    // Try single row, then combined consecutive rows (for multi-level headers)
    for (let r = 0; r < Math.min(15, rows.length); r++) {
      const row1 = rows[r] || [];
      const row2 = rows[r + 1] || [];

      const curTmp: Record<number, number> = {};
      const curFlow: Record<number, number> = {};
      const curPIn: Record<number, number> = {};
      const curPOut: Record<number, number> = {};
      let curDate = -1;
      let curTime = -1;

      const maxCols = Math.max(row1.length, row2.length);

      for (let colIdx = 0; colIdx < maxCols; colIdx++) {
        const val1 = String(row1[colIdx] || '').trim();
        const val2 = String(row2[colIdx] || '').trim();
        // Combined text from single or multi-row header
        const text = `${val1} ${val2}`.replace(/\s+/g, ' ').trim();
        if (!text) continue;

        // Date detection
        if (/(?:date|timestamp|datetime|วันที่|วัน\/เวลา|วัน-เวลา|วดป)/i.test(text) && !/TMP|Flow|Pressure/i.test(text)) {
          if (curDate === -1) curDate = colIdx;
        } else if (/^(?:time|เวลา)$/i.test(val1) || /^(?:time|เวลา)$/i.test(val2)) {
          curTime = colIdx;
        }

        // Unit number matching: UF1, UF No.1, Unit 1, Rack 1, ยูนิต 1, ชุดที่ 1, FIT-102-1, PT-102-1-1
        let uIdx: number | null = null;
        const mUf = text.match(/(?:UF|Unit|Rack|ยูนิต|ชุดที่|FIT-102-|PT-102-)\s*(?:No\.?|#|-|_)?\s*(\d+)/i);
        if (mUf) {
          uIdx = parseInt(mUf[1], 10) - 1;
        } else {
          const mAlt = text.match(/(?:TMP|Flow|Flux)\s*(?:No\.?|#|-|_)?\s*(\d+)/i);
          if (mAlt) uIdx = parseInt(mAlt[1], 10) - 1;
        }

        if (uIdx !== null && uIdx >= 0 && uIdx <= 20) {
          if (/TMP|แรงดันตกคร่อม/i.test(text)) {
            curTmp[uIdx] = colIdx;
          } else if ((/FLOW|อัตราการไหล|m3\/h|m³\/h/i.test(text) || /FIT-102-\d+/i.test(text)) && !/FEED|BACKWASH|BW/i.test(text)) {
            curFlow[uIdx] = colIdx;
          } else if (/PT.*?-1\b|PRESSURE.*?(?:IN|FEED)|ความดันเข้า/i.test(text)) {
            curPIn[uIdx] = colIdx;
          } else if (/PT.*?-2\b|PRESSURE.*?(?:OUT|PERMEATE)|ความดันออก/i.test(text)) {
            curPOut[uIdx] = colIdx;
          }
        }
      }

      if (Object.keys(curTmp).length > 0 || (Object.keys(curPIn).length > 0 && Object.keys(curPOut).length > 0)) {
        foundHeader = Object.keys(curTmp).length > 0 && row1.some(c => /TMP/i.test(String(c))) ? r : r + 1;
        sTmp = curTmp;
        sFlow = curFlow;
        sPIn = curPIn;
        sPOut = curPOut;
        sDate = curDate;
        sTime = curTime;
        break;
      }
    }

    if (foundHeader !== -1) {
      chosenWorksheet = ws;
      chosenSheetName = sName;
      rawRows = rows;
      headerRowIdx = foundHeader;
      tmpCols = sTmp;
      flowCols = sFlow;
      pInCols = sPIn;
      pOutCols = sPOut;
      dateColIdx = sDate !== -1 ? sDate : 0;
      timeColIdx = sTime;
      break;
    }
  }

  // Fallback: If no TMP columns by header keyword, look for generic UF unit columns
  if (!chosenWorksheet || headerRowIdx === -1) {
    for (const sName of workbook.SheetNames) {
      const ws = workbook.Sheets[sName];
      if (!ws) continue;
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true });
      if (!rows || rows.length < 2) continue;

      for (let r = 0; r < Math.min(10, rows.length); r++) {
        const row = rows[r] || [];
        const curTmp: Record<number, number> = {};
        let curDate = 0;

        row.forEach((colVal, colIdx) => {
          const text = String(colVal || '').trim();
          if (/(?:date|time|timestamp|วัน|เวลา)/i.test(text)) {
            curDate = colIdx;
          }
          const m = text.match(/(?:UF|Unit)\s*(?:No\.?|#|-|_)?\s*(\d+)/i);
          if (m) {
            const u = parseInt(m[1], 10) - 1;
            if (u >= 0 && u <= 20) curTmp[u] = colIdx;
          }
        });

        if (Object.keys(curTmp).length > 0) {
          chosenWorksheet = ws;
          chosenSheetName = sName;
          rawRows = rows;
          headerRowIdx = r;
          tmpCols = curTmp;
          dateColIdx = curDate;
          break;
        }
      }
      if (chosenWorksheet) break;
    }
  }

  if (!chosenWorksheet || headerRowIdx === -1) {
    throw new Error(
      'ไม่พบคอลัมน์หัวตาราง TMP (เช่น "UF No.1 TMP", "Pane1-UF No.1 TMP" หรือ "Unit 1 TMP") กรุณาตรวจสอบชื่อคอลัมน์ในไฟล์ Excel'
    );
  }

  // Fallback dateColIdx check: If column 0 doesn't have dates, test top columns
  if (rawRows.length > headerRowIdx + 1) {
    const testRow = rawRows[headerRowIdx + 1];
    if (testRow && isNaN(parsePlantDate(testRow[dateColIdx]))) {
      for (let c = 0; c < Math.min(6, testRow.length); c++) {
        if (!isNaN(parsePlantDate(testRow[c]))) {
          dateColIdx = c;
          break;
        }
      }
    }
  }

  // Determine all unit indices found
  const allUnitIndices = Array.from(
    new Set([
      ...Object.keys(tmpCols).map(Number),
      ...Object.keys(flowCols).map(Number),
      ...Object.keys(pInCols).map(Number)
    ])
  ).sort((a, b) => a - b);

  const unitCount = allUnitIndices.length > 0 ? Math.max(...allUnitIndices) + 1 : 1;

  const timestamps: number[] = [];
  const tmp: (number | null)[][] = Array.from({ length: unitCount }, () => []);
  const flow: (number | null)[][] = Array.from({ length: unitCount }, () => []);

  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    const dateVal = row[dateColIdx];
    const timeVal = timeColIdx !== -1 ? row[timeColIdx] : undefined;
    const ms = parsePlantDate(dateVal, timeVal);

    if (isNaN(ms)) continue;

    timestamps.push(ms);

    for (let u = 0; u < unitCount; u++) {
      // 1. Get TMP value directly or calculate from Pin - Pout
      let tmpVal: number | null = null;
      const colT = tmpCols[u];

      if (colT !== undefined && row[colT] !== undefined && row[colT] !== null && row[colT] !== '') {
        const strVal = String(row[colT]).replace(',', '.').trim();
        const v = parseFloat(strVal);
        tmpVal = isNaN(v) ? null : v;
      } else if (pInCols[u] !== undefined && pOutCols[u] !== undefined) {
        // Fallback: calculate TMP = Pin - Ppermeate
        const pinStr = String(row[pInCols[u]] ?? '').replace(',', '.').trim();
        const poutStr = String(row[pOutCols[u]] ?? '').replace(',', '.').trim();
        const pin = parseFloat(pinStr);
        const pout = parseFloat(poutStr);
        if (!isNaN(pin) && !isNaN(pout)) {
          tmpVal = pin - pout;
        }
      }
      tmp[u].push(tmpVal);

      // 2. Get Flow value
      const colF = flowCols[u];
      if (colF !== undefined && row[colF] !== undefined && row[colF] !== null && row[colF] !== '') {
        const strVal = String(row[colF]).replace(',', '.').trim();
        const val = parseFloat(strVal);
        flow[u].push(isNaN(val) ? null : val);
      } else {
        flow[u].push(null);
      }
    }
  }

  if (timestamps.length === 0) {
    throw new Error('ไม่พบข้อมูลวันที่ที่ถูกต้องในตาราง กรุณาตรวจสอบรูปแบบวันที่ (เช่น 1/7/25 0:00)');
  }

  // Auto-detect unit scaling for TMP:
  // If TMP values average > 5.0 (e.g. 16 instead of 0.16 bar, scaled by 100 or kPa), divide by 100
  for (let u = 0; u < unitCount; u++) {
    const valid = tmp[u].filter((v): v is number => v !== null && !isNaN(v));
    if (valid.length > 0) {
      const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
      if (avg > 5.0 && avg < 200.0) {
        tmp[u] = tmp[u].map(v => (v !== null ? v / 100 : null));
      }
    }
  }

  return {
    timestamps,
    tmp,
    flow,
    isEmbedded: false,
    sourceLabel: `ไฟล์นำเข้า: ${fileName} (${chosenSheetName}) · ${timestamps.length.toLocaleString()} แถว (${formatDate(timestamps[0])} ถึง ${formatDate(timestamps[timestamps.length - 1])})`
  };
}

export function validateAndPreviewExcel(fileBuffer: ArrayBuffer, fileName: string): FileValidationResult {
  const errors: string[] = [];
  try {
    const dataset = parseExcelWorkbook(fileBuffer, fileName);

    const detectedUnits = dataset.tmp.map((tSeries, uIdx) => {
      const validTmpCount = tSeries.filter(v => v !== null).length;
      const validFlowCount = dataset.flow[uIdx] ? dataset.flow[uIdx].filter(v => v !== null).length : 0;
      return {
        unitIndex: uIdx,
        unitName: `UF No.${uIdx + 1}`,
        hasTmp: validTmpCount > 0,
        hasFlow: validFlowCount > 0
      };
    });

    const previewCount = Math.min(6, dataset.timestamps.length);
    const previewRows: FileValidationResult['previewRows'] = [];

    for (let i = 0; i < previewCount; i++) {
      const d = new Date(dataset.timestamps[i]);
      const dateDisplay = `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${String(d.getUTCFullYear()).slice(-2)} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
      const values: Record<string, string | number> = {};

      dataset.tmp.forEach((uTmp, uIdx) => {
        const tVal = uTmp[i];
        const fVal = dataset.flow[uIdx] ? dataset.flow[uIdx][i] : null;
        values[`UF No.${uIdx + 1} TMP`] = tVal !== null ? `${tVal.toFixed(3)} bar` : '-';
        values[`UF No.${uIdx + 1} Flow`] = fVal !== null ? `${fVal.toFixed(1)} m³/h` : '-';
      });

      previewRows.push({ dateStr: dateDisplay, values });
    }

    return {
      isValid: true,
      fileName,
      rowCount: dataset.timestamps.length,
      dateStartStr: formatDate(dataset.timestamps[0]),
      dateEndStr: formatDate(dataset.timestamps[dataset.timestamps.length - 1]),
      detectedUnits,
      previewRows,
      errors: [],
      dataset
    };
  } catch (err: any) {
    errors.push(err.message || 'โครงสร้างไฟล์ไม่ตรงกับแบบฟอร์ม');
    return {
      isValid: false,
      fileName,
      rowCount: 0,
      dateStartStr: '-',
      dateEndStr: '-',
      detectedUnits: [],
      previewRows: [],
      errors,
      dataset: null
    };
  }
}

// Support parsing raw TSV/CSV text pasted from Excel clipboard
export function parseClipboardTextAndValidate(text: string, label = 'ข้อมูลจาก Clipboard'): FileValidationResult {
  const errors: string[] = [];
  try {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('กรุณาวางข้อมูลข้อความหรือตารางจาก Excel');
    }

    const lines = trimmed.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('ต้องการหัวตารางและแถวข้อมูลอย่างน้อย 1 แถว');
    }

    // Determine delimiter (tab or comma or semicolon)
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(',') ? ',' : ';';

    const rawRows = lines.map(line => line.split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, '')));

    // Build worksheet from AOA and write to buffer, then reuse parseExcelWorkbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rawRows);
    XLSX.utils.book_append_sheet(wb, ws, 'PastedData');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    return validateAndPreviewExcel(buf, label);
  } catch (err: any) {
    errors.push(err.message || 'ไม่สามารถแยกวิเคราะห์ข้อมูลที่วางได้');
    return {
      isValid: false,
      fileName: label,
      rowCount: 0,
      dateStartStr: '-',
      dateEndStr: '-',
      detectedUnits: [],
      previewRows: [],
      errors,
      dataset: null
    };
  }
}

export function exportAnalysisExcel(
  analyses: UnitAnalysis[],
  params: MembraneParameters,
  dataset: ProcessedDataset
) {
  const monthKey = (ms: number) => formatDate(ms).slice(0, 7);
  const monthlyData: Record<string, Record<number, { values: number[]; efm: number; cip: number }>> = {};

  analyses.forEach((a, k) => {
    a.activePoints.forEach(p => {
      const m = monthKey(p.timestamp);
      if (!monthlyData[m]) monthlyData[m] = {};
      if (!monthlyData[m][k]) monthlyData[m][k] = { values: [], efm: 0, cip: 0 };
      monthlyData[m][k].values.push(p.tmp);
    });

    a.events.forEach(e => {
      const m = monthKey(e.timestamp);
      if (monthlyData[m] && monthlyData[m][k]) {
        if (e.type === 'CIP') monthlyData[m][k].cip++;
        else monthlyData[m][k].efm++;
      }
    });
  });

  // Sheet 1: Monthly Summary
  const sheet1Rows: any[][] = [
    ['เดือน', 'Unit', 'TMP เฉลี่ย (bar)', 'TMP สูงสุด (bar)', 'TMP ต่ำสุด (bar)', '% เวลาเกินเกณฑ์เตือน', 'EFM (ครั้ง)', 'CIP (ครั้ง)', 'สถานะ']
  ];

  Object.keys(monthlyData).sort().forEach(m => {
    Object.keys(monthlyData[m]).forEach(kStr => {
      const k = parseInt(kStr, 10);
      const record = monthlyData[m][k];
      const count = record.values.length;
      if (count === 0) return;
      const sum = record.values.reduce((x, y) => x + y, 0);
      const avg = sum / count;
      const max = Math.max(...record.values);
      const min = Math.min(...record.values);
      const overWarning = (record.values.filter(v => v >= params.warningTmp).length / count) * 100;
      const statusLabel = max >= params.criticalTmp ? 'วิกฤต' : max >= params.warningTmp ? 'เฝ้าระวัง' : 'ปกติ';

      sheet1Rows.push([
        m,
        `UF No.${k + 1}`,
        parseFloat(avg.toFixed(3)),
        parseFloat(max.toFixed(3)),
        parseFloat(min.toFixed(3)),
        parseFloat(overWarning.toFixed(1)),
        record.efm,
        record.cip,
        statusLabel
      ]);
    });
  });

  // Sheet 2: Recommendations
  const sheet2Rows: any[][] = [
    ['Unit', 'TMP ล่าสุด (bar)', 'สถานะ', 'คำแนะนำที่ควรทำ', 'เหตุผลทางวิศวกรรม']
  ];

  analyses.forEach(a => {
    sheet2Rows.push([
      a.unitName,
      a.currentTmp === null ? '-' : parseFloat(a.currentTmp.toFixed(3)),
      a.statusLabel,
      a.actionRecommendation,
      a.actionReason
    ]);
  });

  sheet2Rows.push([]);
  sheet2Rows.push(['เกณฑ์และพารามิเตอร์ระบบ']);
  sheet2Rows.push(['เกณฑ์ TMP เตือน (Warning)', `${params.warningTmp} bar`]);
  sheet2Rows.push(['เกณฑ์ TMP วิกฤต (Critical CIP)', `${params.criticalTmp} bar`]);
  sheet2Rows.push(['จำนวนโมดูลต่อยูนิต', `${params.modulesCount} modules`]);
  sheet2Rows.push(['พื้นที่ผิวเยื่อกรองต่อโมดูล', `${params.areaPerModule} m²`]);
  sheet2Rows.push(['พื้นที่ผิวเยื่อกรองรวมต่อยูนิต', `${params.modulesCount * params.areaPerModule} m²`]);
  sheet2Rows.push(['Flux ต่ำสุดที่นับเป็นช่วงกรอง', `${params.minFlux} LMH`]);
  sheet2Rows.push(['TMP ลดลง ≥ ถือเป็น EFM', `${params.efmDrop} bar`]);
  sheet2Rows.push(['TMP ลดลง ≥ ถือเป็น CIP', `${params.cipDrop} bar`]);
  sheet2Rows.push(['จำนวนครั้ง EFM ติดกันที่ควร CIP', `${params.consecutiveEfmLimit} ครั้ง`]);

  // Sheet 3: Daily TMP
  const dailyMap: Record<string, (number | null)[]> = {};
  analyses.forEach((a, k) => {
    const dayBuckets: Record<string, number[]> = {};
    a.activePoints.forEach(p => {
      const d = p.dateStr;
      if (!dayBuckets[d]) dayBuckets[d] = [];
      dayBuckets[d].push(p.tmp);
    });

    Object.keys(dayBuckets).forEach(d => {
      if (!dailyMap[d]) dailyMap[d] = Array(analyses.length).fill(null);
      const vals = dayBuckets[d];
      dailyMap[d][k] = parseFloat((vals.reduce((x, y) => x + y, 0) / vals.length).toFixed(3));
    });
  });

  const sheet3Rows: any[][] = [
    ['วันที่', ...analyses.map(a => `${a.unitName} TMP เฉลี่ย (bar)`)]
  ];

  Object.keys(dailyMap).sort().forEach(d => {
    sheet3Rows.push([d, ...dailyMap[d]]);
  });

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Rows);

  ws1['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
  ws2['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 70 }];
  ws3['!cols'] = [{ wch: 14 }, ...analyses.map(() => ({ wch: 20 }))];

  XLSX.utils.book_append_sheet(wb, ws1, 'สรุปรายเดือน');
  XLSX.utils.book_append_sheet(wb, ws2, 'คำแนะนำและสถานะ');
  XLSX.utils.book_append_sheet(wb, ws3, 'TMP_รายวัน');

  const months = Object.keys(monthlyData).sort();
  const startM = months[0] || 'Start';
  const endM = months[months.length - 1] || 'End';
  const fileName = `UF_TMP_Report_${startM}_to_${endM}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

// Download Comprehensive Standard Template for Plant Engineers
export function downloadExcelTemplate() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: SCADA WHA-UP Plant Record Format (Exact match to image.png)
  const scadaHeaders = [
    'Time',
    'ms',
    'Pane1-FIT-102-1 UF No.1 (FLOW TRANSMITTER)',
    'Pane1-PT-102-1-1 UF No.1 (PRESSURE TRANSMITTER)',
    'Pane1-UF No.1 TMP',
    'Pane1-PT-102-1-2 UF No.1 (PRESSURE TRANSMITTER)',
    'Pane1-FIT-102-2 UF No.2 (FLOW TRANSMITTER)',
    'Pane1-PT-102-2-1 UF No.2 (PRESSURE TRANSMITTER)',
    'Pane1-UF No.2 TMP',
    'Pane1-PT-102-2-2 UF No.2 (PRESSURE TRANSMITTER)',
    'Pane1-FIT-102-3 UF No.3 (FLOW TRANSMITTER)',
    'Pane1-PT-102-3-1 UF No.3 (PRESSURE TRANSMITTER)',
    'Pane1-UF No.3 TMP',
    'Pane1-PT-102-3-2 UF No.3 (PRESSURE TRANSMITTER)',
    'Pane1-FIT-102-4 UF No.4 (FLOW TRANSMITTER)',
    'Pane1-PT-102-4-1 UF No.4 (PRESSURE TRANSMITTER)',
    'Pane1-UF No.4 TMP',
    'Pane1-PT-102-4-2 UF No.4 (PRESSURE TRANSMITTER)',
    'Pane1-FIT-102-5 UF No.5 (FLOW TRANSMITTER)',
    'Pane1-PT-102-5-1 UF No.5 (PRESSURE TRANSMITTER)',
    'Pane1-UF No.5 TMP',
    'Pane1-PT-102-5-2 UF No.5 (PRESSURE TRANSMITTER)',
    'Pane1-FIT-01 UF FEED (FLOW TRANSMITTER)',
    'Pane1-FIT-BW UF BACKWASH PUMP (FLOW TRANSMITTER)'
  ];

  const scadaSampleRows: any[][] = [
    scadaHeaders,
    ['1/7/25 0:00', 0, 44.66, 0.58, 0.0918, 0.29, 45.88, 0.57, 0.0633, 0.30, 2.57, 2.57, -0.0349, 2.40, 42.81, 1.18, 0.0211, 0.96, 40.26, 0.53, 0.0287, 0.30, 184.8, 4.70],
    ['1/7/25 2:24', 0, 43.39, 0.60, 0.0897, 0.31, 44.45, 0.58, 0.0599, 0.32, 2.56, 2.56, -0.0349, 2.40, 42.06, 0.89, 0.0192, 0.67, 40.62, 0.55, 0.0453, 0.32, 182.8, 4.27],
    ['1/7/25 4:48', 0, 57.98, 0.65, 0.1176, 0.33, 59.19, 0.63, 0.0832, 0.34, 2.40, 2.40, -0.0347, 2.23, 56.46, 0.58, 0.0291, 0.35, 54.71, 0.58, 0.0584, 0.34, 245.9, 5.38],
    ['1/7/25 7:12', 0, 49.43, 0.60, 0.1039, 0.29, 50.39, 0.58, 0.0710, 0.30, 2.55, 2.55, -0.0350, 2.38, 35.82, 0.97, 0.0174, 0.76, 34.74, 0.55, 0.0229, 0.33, 186.4, 4.67],
    ['1/7/25 9:36', 0, 54.32, 0.67, 0.1131, 0.35, 59.22, 0.64, 0.0780, 0.36, 1.71, 1.71, 0.0038, 1.51, 35.72, 0.82, 0.0386, 0.58, 47.39, 0.62, 0.0399, 0.38, 240.0, 5.88],
    ['1/7/25 12:00', 0, 89.26, 0.79, 0.1719, 0.42, 75.07, 0.73, 0.0987, 0.43, 35.44, 35.44, 0.0111, 1.02, 53.52, 0.53, 0.0618, 0.27, 68.59, 0.70, 0.0654, 0.43, 340.3, 12.86]
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(scadaSampleRows);
  ws1['!cols'] = scadaHeaders.map(() => ({ wch: 22 }));

  // Sheet 2: Simple Standard Format
  const simpleHeaders = [
    'Date / Time',
    'UF No.1 TMP',
    'UF No.1 FLOW',
    'UF No.2 TMP',
    'UF No.2 FLOW',
    'UF No.3 TMP',
    'UF No.3 FLOW',
    'UF No.4 TMP',
    'UF No.4 FLOW',
    'UF No.5 TMP',
    'UF No.5 FLOW'
  ];

  const simpleRows: any[][] = [
    simpleHeaders,
    ['2025-07-01 00:00', 0.092, 44.7, 0.063, 45.9, 0.010, 35.4, 0.021, 42.8, 0.029, 40.3],
    ['2025-07-01 02:24', 0.090, 43.4, 0.060, 44.5, 0.010, 35.0, 0.019, 42.1, 0.045, 40.6],
    ['2025-07-01 04:48', 0.118, 58.0, 0.083, 59.2, 0.012, 40.0, 0.029, 56.5, 0.058, 54.7],
    ['2025-07-01 07:12', 0.104, 49.4, 0.071, 50.4, 0.011, 38.0, 0.017, 35.8, 0.023, 34.7],
    ['2025-07-01 12:00', 0.172, 89.3, 0.099, 75.1, 0.011, 35.4, 0.062, 53.5, 0.065, 68.6]
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(simpleRows);
  ws2['!cols'] = simpleHeaders.map(() => ({ wch: 18 }));

  // Sheet 3: Documentation
  const ws3Data = [
    ['คู่มือการจัดเตรียมไฟล์นำเข้าข้อมูล (Data Import Specification) - WHA-UP Team'],
    [''],
    ['1. รองรับทั้งการ Export ตรงจาก SCADA (Sheet 1) หรือแบบกรอกอย่างง่าย (Sheet 2)'],
    ['2. รูปแบบวันที่รองรับ: D/M/YY H:mm (เช่น 1/7/25 0:00), DD/MM/YYYY หรือ YYYY-MM-DD'],
    ['3. หน่วยวัด: TMP ในหน่วย bar (เช่น 0.0918) | Flow ในหน่วย m³/hr (เช่น 44.66)'],
    ['4. ระบบจะกรองและคำนวณเฉพาะช่วงที่เดินระบบกรองจริง (Flux >= 15 LMH) ให้อัตโนมัติ']
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(ws3Data);

  XLSX.utils.book_append_sheet(wb, ws1, 'SCADA_WHA-UP_Format');
  XLSX.utils.book_append_sheet(wb, ws2, 'Simple_Standard_Format');
  XLSX.utils.book_append_sheet(wb, ws3, 'คำแนะนำและข้อกำหนด');

  XLSX.writeFile(wb, 'UF_SCADA_Plant_Data_Template_UOP.xlsx');
}

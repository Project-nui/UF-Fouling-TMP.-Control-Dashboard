import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { ProcessedDataset } from '../data/initialData';
import { MembraneParameters, formatDateTime, formatNumber } from '../utils/membraneCalculations';
import { parsePlantDate, parseExcelWorkbook } from '../utils/excelHandler';
import { createScadaSampleDataset } from '../data/scadaSampleData';
import {
  FileSpreadsheet,
  Save,
  Upload,
  Download,
  Plus,
  Trash2,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  ClipboardPaste,
  ChevronRight,
  ExternalLink,
  Sliders,
  Check,
  X
} from 'lucide-react';

export interface SpreadsheetRow {
  id: string;
  timestamp: number;
  dateTimeStr: string;
  u1_tmp: number | null;
  u1_flow: number | null;
  u2_tmp: number | null;
  u2_flow: number | null;
  u3_tmp: number | null;
  u3_flow: number | null;
  u4_tmp: number | null;
  u4_flow: number | null;
  u5_tmp: number | null;
  u5_flow: number | null;
}

interface ExcelOnlineEditorProps {
  dataset: ProcessedDataset;
  params: MembraneParameters;
  onSaveDataset: (newDataset: ProcessedDataset) => void;
  onNavigateToDashboard?: () => void;
}

type ActiveCell = {
  rowIndex: number;
  colKey: keyof SpreadsheetRow;
} | null;

export const ExcelOnlineEditor: React.FC<ExcelOnlineEditorProps> = ({
  dataset,
  params,
  onSaveDataset,
  onNavigateToDashboard
}) => {
  // Convert incoming dataset to rows
  const [rows, setRows] = useState<SpreadsheetRow[]>(() => datasetToRows(dataset));
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [activeCell, setActiveCell] = useState<ActiveCell>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState<boolean>(false);
  const [pasteRawText, setPasteRawText] = useState<string>('');
  const [addRowsCount, setAddRowsCount] = useState<number>(1);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const totalArea = params.modulesCount * params.areaPerModule; // m2

  // Sync rows if external dataset changes and not dirty
  useEffect(() => {
    if (!isDirty) {
      setRows(datasetToRows(dataset));
    }
  }, [dataset, isDirty]);

  // Focus editor input when editing starts
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing, activeCell]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Cell helper formulas
  const calculateFlux = (flow: number | null | undefined): number | null => {
    if (flow === null || flow === undefined || isNaN(flow) || totalArea <= 0) return null;
    return (flow / totalArea) * 1000;
  };

  // Filtered rows for search
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((r, idx) =>
      r.dateTimeStr.toLowerCase().includes(q) ||
      String(idx + 1).includes(q) ||
      String(r.u1_tmp ?? '').includes(q) ||
      String(r.u2_tmp ?? '').includes(q) ||
      String(r.u3_tmp ?? '').includes(q) ||
      String(r.u4_tmp ?? '').includes(q) ||
      String(r.u5_tmp ?? '').includes(q)
    );
  }, [rows, searchTerm]);

  // Summary stats
  const stats = useMemo(() => {
    let validTmpCount = 0;
    let sumTmp = 0;
    let validFlowCount = 0;
    let sumFlow = 0;

    rows.forEach(r => {
      [r.u1_tmp, r.u2_tmp, r.u3_tmp, r.u4_tmp, r.u5_tmp].forEach(v => {
        if (v !== null && !isNaN(v)) {
          sumTmp += v;
          validTmpCount++;
        }
      });
      [r.u1_flow, r.u2_flow, r.u3_flow, r.u4_flow, r.u5_flow].forEach(v => {
        if (v !== null && !isNaN(v)) {
          sumFlow += v;
          validFlowCount++;
        }
      });
    });

    const avgTmp = validTmpCount > 0 ? sumTmp / validTmpCount : null;
    const avgFlow = validFlowCount > 0 ? sumFlow / validFlowCount : null;
    const avgFlux = avgFlow !== null && totalArea > 0 ? (avgFlow / totalArea) * 1000 : null;

    return {
      totalRows: rows.length,
      avgTmp,
      avgFlow,
      avgFlux,
      selectedCount: selectedRowIds.size
    };
  }, [rows, totalArea, selectedRowIds]);

  // Click on a cell to select / start editing
  const handleCellClick = (rowIndex: number, colKey: keyof SpreadsheetRow) => {
    if (colKey === 'id' || colKey === 'timestamp') return;

    if (activeCell?.rowIndex === rowIndex && activeCell?.colKey === colKey && isEditing) {
      return;
    }

    // Commit any existing edit
    if (isEditing) {
      commitCellEdit();
    }

    const row = filteredRows[rowIndex];
    if (!row) return;

    const currentVal = row[colKey];
    setEditValue(currentVal === null || currentVal === undefined ? '' : String(currentVal));
    setActiveCell({ rowIndex, colKey });
    setIsEditing(true);
  };

  // Commit edit changes
  const commitCellEdit = () => {
    if (!activeCell) return;
    const { rowIndex, colKey } = activeCell;
    const targetRow = filteredRows[rowIndex];
    if (!targetRow) return;

    setRows(prevRows => {
      return prevRows.map(r => {
        if (r.id !== targetRow.id) return r;

        const updated = { ...r };
        if (colKey === 'dateTimeStr') {
          const parsedMs = parsePlantDate(editValue);
          updated.dateTimeStr = editValue.trim();
          if (!isNaN(parsedMs)) {
            updated.timestamp = parsedMs;
          }
        } else {
          const num = editValue.trim() === '' ? null : Number(editValue);
          (updated as any)[colKey] = isNaN(num as any) ? null : num;
        }
        return updated;
      });
    });

    setIsDirty(true);
    setIsEditing(false);
  };

  // Handle keyboard navigation in cell editor
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitCellEdit();
      // Move to cell below
      if (activeCell && activeCell.rowIndex < filteredRows.length - 1) {
        handleCellClick(activeCell.rowIndex + 1, activeCell.colKey);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitCellEdit();
      // Move to next cell to the right
      const editableCols: (keyof SpreadsheetRow)[] = [
        'dateTimeStr',
        'u1_tmp', 'u1_flow',
        'u2_tmp', 'u2_flow',
        'u3_tmp', 'u3_flow',
        'u4_tmp', 'u4_flow',
        'u5_tmp', 'u5_flow'
      ];
      if (activeCell) {
        const curColIdx = editableCols.indexOf(activeCell.colKey);
        if (e.shiftKey) {
          if (curColIdx > 0) {
            handleCellClick(activeCell.rowIndex, editableCols[curColIdx - 1]);
          }
        } else {
          if (curColIdx < editableCols.length - 1) {
            handleCellClick(activeCell.rowIndex, editableCols[curColIdx + 1]);
          } else if (activeCell.rowIndex < filteredRows.length - 1) {
            handleCellClick(activeCell.rowIndex + 1, editableCols[0]);
          }
        }
      }
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  // Add new rows to the spreadsheet
  const handleAddRows = (count = 1) => {
    const lastRow = rows[rows.length - 1];
    let nextTimestamp = lastRow ? lastRow.timestamp + 2.4 * 3600 * 1000 : Date.now();

    const newRows: SpreadsheetRow[] = [];
    for (let i = 0; i < count; i++) {
      const ts = nextTimestamp + i * (2.4 * 3600 * 1000);
      newRows.push({
        id: `row-new-${Date.now()}-${i}`,
        timestamp: ts,
        dateTimeStr: formatDateTime(ts),
        u1_tmp: 0.10,
        u1_flow: 50.0,
        u2_tmp: 0.08,
        u2_flow: 55.0,
        u3_tmp: 0.01,
        u3_flow: 40.0,
        u4_tmp: 0.03,
        u4_flow: 45.0,
        u5_tmp: 0.04,
        u5_flow: 45.0
      });
    }

    setRows(prev => [...prev, ...newRows]);
    setIsDirty(true);
    showToast(`เพิ่มแถวใหม่เรียบร้อยแล้ว (+${count} แถว)`);
  };

  // Duplicate a specific row
  const handleDuplicateRow = (rowId: string) => {
    const idx = rows.findIndex(r => r.id === rowId);
    if (idx === -1) return;
    const target = rows[idx];
    const newTs = target.timestamp + 3600 * 1000;
    const duplicated: SpreadsheetRow = {
      ...target,
      id: `row-dup-${Date.now()}`,
      timestamp: newTs,
      dateTimeStr: formatDateTime(newTs)
    };
    const nextRows = [...rows];
    nextRows.splice(idx + 1, 0, duplicated);
    setRows(nextRows);
    setIsDirty(true);
    showToast('ทำซ้ำแถวเรียบร้อย');
  };

  // Delete a specific row
  const handleDeleteRow = (rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      next.delete(rowId);
      return next;
    });
    setIsDirty(true);
    showToast('ลบแถวเรียบร้อย');
  };

  // Delete all selected rows
  const handleDeleteSelected = () => {
    if (selectedRowIds.size === 0) return;
    const count = selectedRowIds.size;
    setRows(prev => prev.filter(r => !selectedRowIds.has(r.id)));
    setSelectedRowIds(new Set());
    setIsDirty(true);
    showToast(`ลบ ${count} แถวที่เลือกเรียบร้อยแล้ว`);
  };

  // Toggle select all rows
  const handleToggleSelectAll = () => {
    if (selectedRowIds.size === filteredRows.length && filteredRows.length > 0) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(filteredRows.map(r => r.id)));
    }
  };

  // Toggle single row selection
  const handleToggleSelectRow = (id: string) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Reset to original SCADA attached dataset
  const handleResetToAttached = () => {
    const scada = createScadaSampleDataset();
    setRows(datasetToRows(scada));
    setSelectedRowIds(new Set());
    setIsDirty(false);
    showToast('รีเซ็ตเป็นข้อมูล SCADA เริ่มต้นตามรูปภาพแนบแล้ว (43 รอบ)');
  };

  // Save changes & apply to live dashboard
  const handleSaveAndApply = () => {
    if (rows.length === 0) {
      alert('ไม่มีข้อมูลในตาราง กรุณาเพิ่มหรือนำเข้าข้อมูลอย่างน้อย 1 แถว');
      return;
    }
    commitCellEdit();
    const updatedDataset = rowsToDataset(rows, 'ข้อมูลที่แก้ไขและบันทึกผ่าน Excel Online');
    onSaveDataset(updatedDataset);
    setIsDirty(false);
    showToast('บันทึกข้อมูลเข้าสู่ระบบสำเร็จ! ระบบคำนวณและวิเคราะห์ผลสดเรียบร้อย');
    if (onNavigateToDashboard) {
      setTimeout(() => onNavigateToDashboard(), 800);
    }
  };

  // Export current table to Excel (.xlsx)
  const handleExportToExcel = () => {
    try {
      const headers = [
        'ลำดับ (No.)',
        'วันและเวลา (Date / Time)',
        'UF-1 TMP (bar)',
        'UF-1 Flow (m3/h)',
        'UF-1 Flux (LMH)',
        'UF-2 TMP (bar)',
        'UF-2 Flow (m3/h)',
        'UF-2 Flux (LMH)',
        'UF-3 TMP (bar)',
        'UF-3 Flow (m3/h)',
        'UF-3 Flux (LMH)',
        'UF-4 TMP (bar)',
        'UF-4 Flow (m3/h)',
        'UF-4 Flux (LMH)',
        'UF-5 TMP (bar)',
        'UF-5 Flow (m3/h)',
        'UF-5 Flux (LMH)'
      ];

      const exportRows = rows.map((r, i) => [
        i + 1,
        r.dateTimeStr,
        r.u1_tmp,
        r.u1_flow,
        calculateFlux(r.u1_flow) !== null ? Number(calculateFlux(r.u1_flow)!.toFixed(1)) : null,
        r.u2_tmp,
        r.u2_flow,
        calculateFlux(r.u2_flow) !== null ? Number(calculateFlux(r.u2_flow)!.toFixed(1)) : null,
        r.u3_tmp,
        r.u3_flow,
        calculateFlux(r.u3_flow) !== null ? Number(calculateFlux(r.u3_flow)!.toFixed(1)) : null,
        r.u4_tmp,
        r.u4_flow,
        calculateFlux(r.u4_flow) !== null ? Number(calculateFlux(r.u4_flow)!.toFixed(1)) : null,
        r.u5_tmp,
        r.u5_flow,
        calculateFlux(r.u5_flow) !== null ? Number(calculateFlux(r.u5_flow)!.toFixed(1)) : null
      ]);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...exportRows]);
      ws['!cols'] = headers.map(() => ({ wch: 18 }));

      XLSX.utils.book_append_sheet(wb, ws, 'UF_Membrane_Online_Data');
      XLSX.writeFile(wb, `UF_Excel_Online_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('ดาวน์โหลดไฟล์ Excel (.xlsx) สำเร็จ');
    } catch (err: any) {
      alert(`ไม่สามารถส่งออก Excel ได้: ${err.message}`);
    }
  };

  // Upload Excel / CSV file directly into online editor
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const buffer = ev.target?.result as ArrayBuffer;
        const parsed = parseExcelWorkbook(buffer, file.name);
        const importedRows = datasetToRows(parsed);
        setRows(importedRows);
        setIsDirty(true);
        showToast(`นำเข้าสำเร็จ: ${file.name} (${importedRows.length} แถว พร้อมแก้ไขออนไลน์)`);
      } catch (err: any) {
        alert(`อ่านไฟล์ไม่สำเร็จ: ${err.message || 'โครงสร้างไฟล์ไม่ตรงตามรูปแบบ'}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Bulk Paste from Clipboard
  const handleApplyPasteText = () => {
    if (!pasteRawText.trim()) return;

    const lines = pasteRawText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
    const newParsedRows: SpreadsheetRow[] = [];

    lines.forEach((line, idx) => {
      // Split by tab or comma
      const parts = line.includes('\t') ? line.split('\t') : line.split(',');
      if (parts.length < 2) return;

      const dateStr = parts[0]?.trim();
      const dateMs = parsePlantDate(dateStr);
      if (isNaN(dateMs) && isNaN(Number(parts[1]))) {
        // likely header row, skip
        return;
      }

      const parseNum = (v: any) => {
        if (!v) return null;
        const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
        return isNaN(n) ? null : n;
      };

      const ts = !isNaN(dateMs) ? dateMs : Date.now() + idx * 86400000;
      newParsedRows.push({
        id: `row-paste-${Date.now()}-${idx}`,
        timestamp: ts,
        dateTimeStr: dateStr || formatDateTime(ts),
        u1_tmp: parseNum(parts[1]),
        u1_flow: parseNum(parts[2]),
        u2_tmp: parseNum(parts[3]),
        u2_flow: parseNum(parts[4]),
        u3_tmp: parseNum(parts[5]),
        u3_flow: parseNum(parts[6]),
        u4_tmp: parseNum(parts[7]),
        u4_flow: parseNum(parts[8]),
        u5_tmp: parseNum(parts[9]),
        u5_flow: parseNum(parts[10])
      });
    });

    if (newParsedRows.length > 0) {
      setRows(prev => [...prev, ...newParsedRows]);
      setIsDirty(true);
      setIsPasteModalOpen(false);
      setPasteRawText('');
      showToast(`วางข้อมูลสำเร็จ: เพิ่ม ${newParsedRows.length} แถวใหม่เข้าสู่ตาราง`);
    } else {
      alert('ไม่สามารถอ่านข้อมูลที่วางได้ กรุณาตรวจสอบว่ามีคอลัมน์ วันที่/เวลา และตัวเลข TMP / Flow');
    }
  };

  return (
    <div className="bg-[#13141F] border border-[#1F2238] rounded-2xl shadow-xl overflow-hidden flex flex-col font-['Prompt',system-ui,sans-serif]">
      {/* Excel Ribbon / Top Bar */}
      <div className="bg-[#13141F] border-b border-[#1F2238] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#EC4899] flex items-center justify-center text-white shadow-lg shadow-[#8B5CF6]/30">
            <FileSpreadsheet className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-wide">
                Excel Online – นำเข้าและแก้ไขข้อมูลเยื่อกรอง UF
              </h1>
              <span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30">
                Live Spreadsheet Editor
              </span>
              {isDirty && (
                <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-[#EC4899]/20 text-[#EC4899] border border-[#EC4899]/40 animate-pulse">
                  ● มีการแก้ไขที่ยังไม่ได้บันทึก
                </span>
              )}
            </div>
            <p className="text-xs text-[#A1A1AA]">
              แก้ไขค่า TMP (bar) และ Flow (m³/h) ได้สดๆ ทุกช่อง · คำนวณ Flux (LMH) ให้อัตโนมัติ · บันทึกผลเข้าสู่แดชบอร์ดทันที
            </p>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleSaveAndApply}
            className="px-4 py-2 bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-[#8B5CF6]/30 transition-all flex items-center gap-1.5 cursor-pointer transform active:scale-95"
            title="บันทึกข้อมูลที่แก้ไข และส่งเข้าวิเคราะห์บนแดชบอร์ดทันที"
          >
            <Save className="w-4 h-4 text-white" />
            <span>บันทึก &amp; นำเข้าวิเคราะห์ผลทันที</span>
          </button>

          {onNavigateToDashboard && (
            <button
              type="button"
              onClick={onNavigateToDashboard}
              className="px-3.5 py-2 bg-[#1F2238] hover:bg-[#272B47] text-white font-medium text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border border-[#2F3459]"
              title="กลับไปดูแดชบอร์ดกราฟ"
            >
              <span>ดูแดชบอร์ด</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#8B5CF6]" />
            </button>
          )}
        </div>
      </div>

      {/* Spreadsheet Operations Toolbar */}
      <div className="bg-[#090A0F] border-b border-[#1F2238] px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left tools: File & Edit actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-[#13141F] hover:bg-[#191B29] text-white border border-[#1F2238] rounded-lg font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="อัปโหลดไฟล์ Excel หรือ CSV เข้ามาเปิดในตาราง"
          >
            <Upload className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>เปิดไฟล์ Excel/CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPasteModalOpen(true)}
            className="px-3 py-1.5 bg-[#13141F] hover:bg-[#191B29] text-white border border-[#1F2238] rounded-lg font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="วางข้อมูลตารางที่คัดลอกจาก Excel หรือ Google Sheets"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-[#EC4899]" />
            <span>วางจาก Excel (Paste)</span>
          </button>

          <button
            type="button"
            onClick={handleExportToExcel}
            className="px-3 py-1.5 bg-[#13141F] hover:bg-[#191B29] text-white border border-[#1F2238] rounded-lg font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="ดาวน์โหลดตารางข้อมูลนี้เป็นไฟล์ .xlsx"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>ดาวน์โหลด .xlsx</span>
          </button>

          <div className="h-5 w-px bg-[#1F2238] mx-1 hidden sm:block" />

          {/* Add Rows */}
          <div className="flex items-center gap-1 bg-[#13141F] border border-[#1F2238] rounded-lg p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => handleAddRows(addRowsCount)}
              className="px-2.5 py-1 text-white hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/10 rounded font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title={`เพิ่มแถวใหม่จำนวน ${addRowsCount} แถว`}
            >
              <Plus className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span>เพิ่มแถว (+{addRowsCount})</span>
            </button>
            <select
              value={addRowsCount}
              onChange={e => setAddRowsCount(Number(e.target.value))}
              className="text-[11px] font-medium bg-[#090A0F] border border-[#1F2238] rounded text-white px-1.5 py-0.5 outline-hidden cursor-pointer"
              title="จำนวนแถวที่ต้องการเพิ่มในแต่ละครั้ง"
            >
              <option value={1} className="bg-[#13141F] text-white">1</option>
              <option value={5} className="bg-[#13141F] text-white">5</option>
              <option value={10} className="bg-[#13141F] text-white">10</option>
              <option value={20} className="bg-[#13141F] text-white">20</option>
            </select>
          </div>

          {selectedRowIds.size > 0 && (
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/40 rounded-lg font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer animate-fade-in"
              title={`ลบแถวที่ติ๊กเลือก (${selectedRowIds.size} แถว)`}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>ลบแถวที่เลือก ({selectedRowIds.size})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetToAttached}
            className="px-2.5 py-1.5 text-[#A1A1AA] hover:text-white rounded-lg hover:bg-[#13141F] transition-colors flex items-center gap-1 cursor-pointer"
            title="รีเซ็ตกลับเป็นข้อมูลต้นฉบับ 43 รอบการกรอง"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span className="hidden md:inline">คืนค่าข้อมูลต้นฉบับ</span>
          </button>
        </div>

        {/* Right tools: Search filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="ค้นหาตามวันที่ หรือ ลำดับ..."
              className="pl-8 pr-3 py-1 text-xs bg-[#13141F] border border-[#1F2238] rounded-lg text-white placeholder-[#71717A] focus:outline-hidden focus:ring-1 focus:ring-[#8B5CF6] focus:border-[#8B5CF6] w-44 sm:w-56"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Excel Formula & Status Bar */}
      <div className="bg-[#13141F] border-b border-[#1F2238] px-5 py-2 flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3 flex-1 overflow-hidden">
          {/* Active cell coordinates */}
          <div className="bg-[#090A0F] text-[#8B5CF6] px-2.5 py-1 rounded-lg font-mono font-bold text-xs shrink-0 min-w-14 text-center border border-[#1F2238]">
            {activeCell ? `R${activeCell.rowIndex + 1}:${String(activeCell.colKey).toUpperCase()}` : 'A1'}
          </div>

          <div className="text-[#8B5CF6] font-serif italic text-sm">fx</div>

          {/* Formula bar input */}
          <div className="flex-1 bg-[#090A0F] border border-[#1F2238] rounded-lg px-2.5 py-1 text-white font-mono text-xs truncate">
            {isEditing ? editValue : activeCell ? String(filteredRows[activeCell.rowIndex]?.[activeCell.colKey] ?? '') : 'คลิกเลือกช่องตารางด้านล่างเพื่อพิมพ์แก้ไขได้ทันที'}
          </div>
        </div>

        {/* Quick Calculations & Statistics badge */}
        <div className="flex items-center gap-2 shrink-0 text-[11px] text-[#A1A1AA]">
          <span className="font-mono bg-[#090A0F] px-2 py-0.5 rounded border border-[#1F2238]">
            จำนวน: <strong className="text-white">{stats.totalRows}</strong> แถว
          </span>
          <span className="font-mono bg-[#090A0F] px-2 py-0.5 rounded border border-[#1F2238] hidden sm:inline">
            TMP เฉลี่ย: <strong className="text-white">{formatNumber(stats.avgTmp, 3)}</strong> bar
          </span>
          <span className="font-mono bg-[#090A0F] px-2 py-0.5 rounded border border-[#1F2238] hidden sm:inline">
            Flux เฉลี่ย: <strong className="text-[#8B5CF6]">{formatNumber(stats.avgFlux, 1)}</strong> LMH
          </span>
        </div>
      </div>

      {/* Editable Grid View */}
      <div className="overflow-x-auto overflow-y-auto max-h-[620px] divide-y divide-[#1F2238] select-none bg-[#13141F]">
        <table className="w-full text-xs text-left border-collapse font-sans min-w-[1100px]">
          <thead className="bg-[#090A0F] text-[#A1A1AA] font-semibold sticky top-0 z-20 shadow-md">
            <tr className="border-b border-[#1F2238] divide-x divide-[#1F2238] text-center">
              <th className="py-2.5 px-2 w-12 bg-[#090A0F]">
                <input
                  type="checkbox"
                  checked={selectedRowIds.size === filteredRows.length && filteredRows.length > 0}
                  onChange={handleToggleSelectAll}
                  className="rounded border-[#1F2238] text-[#8B5CF6] focus:ring-[#8B5CF6] cursor-pointer"
                  title="เลือกทุกแถว"
                />
              </th>
              <th className="py-2.5 px-2 w-12 bg-[#090A0F] font-mono text-[#A1A1AA]">#</th>
              <th className="py-2.5 px-3 min-w-36 text-left text-white">วันและเวลา (Date / Time)</th>

              {/* UF Units Header Group */}
              <th colSpan={3} className="py-1 px-2 bg-[#8B5CF6]/15 border-b border-[#8B5CF6]/30 text-[#8B5CF6]">
                UF No.1
              </th>
              <th colSpan={3} className="py-1 px-2 bg-[#EC4899]/15 border-b border-[#EC4899]/30 text-[#EC4899]">
                UF No.2
              </th>
              <th colSpan={3} className="py-1 px-2 bg-[#06B6D4]/15 border-b border-[#06B6D4]/30 text-[#06B6D4]">
                UF No.3
              </th>
              <th colSpan={3} className="py-1 px-2 bg-[#10B981]/15 border-b border-[#10B981]/30 text-[#10B981]">
                UF No.4
              </th>
              <th colSpan={3} className="py-1 px-2 bg-[#F59E0B]/15 border-b border-[#F59E0B]/30 text-[#F59E0B]">
                UF No.5
              </th>

              <th className="py-2.5 px-2 w-20 bg-[#090A0F] text-[#A1A1AA]">จัดการ</th>
            </tr>
            <tr className="border-b border-[#1F2238] divide-x divide-[#1F2238] text-[11px] text-[#A1A1AA]">
              <th className="bg-[#090A0F]"></th>
              <th className="bg-[#090A0F]"></th>
              <th className="px-3 text-left font-normal text-[#71717A]">รูปแบบ: D/M/YY H:mm</th>

              {/* Sub-headers for Unit 1 to 5 */}
              <th className="py-1.5 px-2 bg-[#8B5CF6]/10 font-mono font-medium text-slate-300">TMP (bar)</th>
              <th className="py-1.5 px-2 bg-[#8B5CF6]/10 font-mono font-medium text-slate-300">Flow (m³/h)</th>
              <th className="py-1.5 px-2 bg-[#8B5CF6]/20 font-mono font-bold text-[#8B5CF6]" title="คำนวณอัตโนมัติ">Flux (LMH)</th>

              <th className="py-1.5 px-2 bg-[#EC4899]/10 font-mono font-medium text-slate-300">TMP (bar)</th>
              <th className="py-1.5 px-2 bg-[#EC4899]/10 font-mono font-medium text-slate-300">Flow (m³/h)</th>
              <th className="py-1.5 px-2 bg-[#EC4899]/20 font-mono font-bold text-[#EC4899]" title="คำนวณอัตโนมัติ">Flux (LMH)</th>

              <th className="py-1.5 px-2 bg-[#06B6D4]/10 font-mono font-medium text-slate-300">TMP (bar)</th>
              <th className="py-1.5 px-2 bg-[#06B6D4]/10 font-mono font-medium text-slate-300">Flow (m³/h)</th>
              <th className="py-1.5 px-2 bg-[#06B6D4]/20 font-mono font-bold text-[#06B6D4]" title="คำนวณอัตโนมัติ">Flux (LMH)</th>

              <th className="py-1.5 px-2 bg-[#10B981]/10 font-mono font-medium text-slate-300">TMP (bar)</th>
              <th className="py-1.5 px-2 bg-[#10B981]/10 font-mono font-medium text-slate-300">Flow (m³/h)</th>
              <th className="py-1.5 px-2 bg-[#10B981]/20 font-mono font-bold text-[#10B981]" title="คำนวณอัตโนมัติ">Flux (LMH)</th>

              <th className="py-1.5 px-2 bg-[#F59E0B]/10 font-mono font-medium text-slate-300">TMP (bar)</th>
              <th className="py-1.5 px-2 bg-[#F59E0B]/10 font-mono font-medium text-slate-300">Flow (m³/h)</th>
              <th className="py-1.5 px-2 bg-[#F59E0B]/20 font-mono font-bold text-[#F59E0B]" title="คำนวณอัตโนมัติ">Flux (LMH)</th>

              <th className="bg-[#090A0F]"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#1F2238] bg-[#13141F]">
            {filteredRows.map((row, rIdx) => {
              const isRowSelected = selectedRowIds.has(row.id);
              return (
                <tr
                  key={row.id}
                  className={`divide-x divide-[#1F2238] hover:bg-[#191B29] transition-colors ${
                    isRowSelected ? 'bg-[#8B5CF6]/20' : rIdx % 2 === 1 ? 'bg-[#0F101A]' : 'bg-[#13141F]'
                  }`}
                >
                  {/* Select row checkbox */}
                  <td className="py-1.5 px-2 text-center bg-[#090A0F]/60">
                    <input
                      type="checkbox"
                      checked={isRowSelected}
                      onChange={() => handleToggleSelectRow(row.id)}
                      className="rounded border-[#1F2238] text-[#8B5CF6] focus:ring-[#8B5CF6] cursor-pointer"
                    />
                  </td>

                  {/* Row index */}
                  <td className="py-1.5 px-2 text-center font-mono text-[#A1A1AA] bg-[#090A0F]/60 text-[11px]">
                    {rIdx + 1}
                  </td>

                  {/* Date and Time cell */}
                  {renderEditableCell(
                    rIdx,
                    'dateTimeStr',
                    row.dateTimeStr,
                    activeCell,
                    isEditing,
                    editValue,
                    setEditValue,
                    handleCellClick,
                    handleKeyDown,
                    commitCellEdit,
                    editInputRef,
                    'text-left font-mono font-medium text-white'
                  )}

                  {/* UF No.1 */}
                  {renderEditableCell(
                    rIdx,
                    'u1_tmp',
                    row.u1_tmp,
                    activeCell,
                    isEditing,
                    editValue,
                    setEditValue,
                    handleCellClick,
                    handleKeyDown,
                    commitCellEdit,
                    editInputRef,
                    getTmpCellClass(row.u1_tmp, params)
                  )}
                  {renderEditableCell(
                    rIdx,
                    'u1_flow',
                    row.u1_flow,
                    activeCell,
                    isEditing,
                    editValue,
                    setEditValue,
                    handleCellClick,
                    handleKeyDown,
                    commitCellEdit,
                    editInputRef,
                    'text-right font-mono text-[#A1A1AA]'
                  )}
                  <td className="py-1.5 px-2.5 text-right font-mono font-bold text-[#8B5CF6] bg-[#8B5CF6]/5">
                    {formatNumber(calculateFlux(row.u1_flow), 1)}
                  </td>

                  {/* UF No.2 */}
                  {renderEditableCell(
                    rIdx,
                    'u2_tmp',
                    row.u2_tmp,
                    activeCell,
                    isEditing,
                    editValue,
                    setEditValue,
                    handleCellClick,
                    handleKeyDown,
                    commitCellEdit,
                    editInputRef,
                    getTmpCellClass(row.u2_tmp, params)
                  )}
                  {renderEditableCell(
                    rIdx,
                    'u2_flow',
                    row.u2_flow,
                    activeCell,
                    isEditing,
                    editValue,
                    setEditValue,
                    handleCellClick,
                    handleKeyDown,
                    commitCellEdit,
                    editInputRef,
                    'text-right font-mono text-[#A1A1AA]'
                  )}
                  <td className="py-1.5 px-2.5 text-right font-mono font-bold text-[#EC4899] bg-[#EC4899]/5">
                    {formatNumber(calculateFlux(row.u2_flow), 1)}
                  </td>

                  {/* UF No.3 */}
                  {renderEditableCell(
                    rIdx,
                    'u3_tmp',
                    row.u3_tmp,
                    activeCell,
                    isEditing,
                    editValue,
                    setEditValue,
                    handleCellClick,
                    handleKeyDown,
                    commitCellEdit,
                    editInputRef,
                    getTmpCellClass(row.u3_tmp, params)
                  )}
                  {renderEditableCell(
                    rIdx,
                    'u3_flow',
                    row.u3_flow,
                    activeCell,
                    isEditing,
                    editValue,
                    setEditValue,
                    handleCellClick,
                    handleKeyDown,
                    commitCellEdit,
                    editInputRef,
                    'text-right font-mono text-[#A1A1AA]'
                  )}
                  <td className="py-1.5 px-2.5 text-right font-mono font-bold text-[#06B6D4] bg-[#06B6D4]/5">
                    {formatNumber(calculateFlux(row.u3_flow), 1)}
                  </td>

                  {/* UF No.4 */}
                  {renderEditableCell(
                    rIdx,
                    'u4_tmp',
                    row.u4_tmp,
                    activeCell,
                    isEditing,
                    editValue,
                    setEditValue,
                    handleCellClick,
                    handleKeyDown,
                    commitCellEdit,
                    editInputRef,
                    getTmpCellClass(row.u4_tmp, params)
                  )}
                  {renderEditableCell(
                    rIdx,
                    'u4_flow',
                    row.u4_flow,
                    activeCell,
                    isEditing,
                    editValue,
                    setEditValue,
                    handleCellClick,
                    handleKeyDown,
                    commitCellEdit,
                    editInputRef,
                    'text-right font-mono text-[#A1A1AA]'
                  )}
                  <td className="py-1.5 px-2.5 text-right font-mono font-bold text-[#10B981] bg-[#10B981]/5">
                    {formatNumber(calculateFlux(row.u4_flow), 1)}
                  </td>

                  {/* UF No.5 */}
                  {renderEditableCell(
                    rIdx,
                    'u5_tmp',
                    row.u5_tmp,
                    activeCell,
                    isEditing,
                    editValue,
                    setEditValue,
                    handleCellClick,
                    handleKeyDown,
                    commitCellEdit,
                    editInputRef,
                    getTmpCellClass(row.u5_tmp, params)
                  )}
                  {renderEditableCell(
                    rIdx,
                    'u5_flow',
                    row.u5_flow,
                    activeCell,
                    isEditing,
                    editValue,
                    setEditValue,
                    handleCellClick,
                    handleKeyDown,
                    commitCellEdit,
                    editInputRef,
                    'text-right font-mono text-[#A1A1AA]'
                  )}
                  <td className="py-1.5 px-2.5 text-right font-mono font-bold text-[#F59E0B] bg-[#F59E0B]/5">
                    {formatNumber(calculateFlux(row.u5_flow), 1)}
                  </td>

                  {/* Action cell */}
                  <td className="py-1.5 px-2 text-center bg-[#090A0F]/60">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDuplicateRow(row.id)}
                        className="p-1 text-[#A1A1AA] hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/10 rounded transition-colors"
                        title="ทำซ้ำแถวนี้"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-1 text-[#A1A1AA] hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                        title="ลบแถวนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Spreadsheet Bottom Footer */}
      <div className="bg-[#090A0F] border-t border-[#1F2238] px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#A1A1AA]">
        <div className="flex items-center gap-3">
          <span className="font-medium text-white">
            📊 รวมทั้งหมด: <strong>{rows.length}</strong> แถว
          </span>
          <span>·</span>
          <span>
            พื้นที่ผิวรวมคำนวณ: <strong>{totalArea.toLocaleString()}</strong> m²
          </span>
          <span>·</span>
          <span className="text-[11px] text-[#A1A1AA]">
            ดับเบิ้ลคลิกหรือคลิกช่องเพื่อเริ่มพิมพ์แก้ไข | กด Enter เพื่อไปแถวถัดไป | กด Tab เพื่อไปคอลัมน์ถัดไป
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveAndApply}
            className="px-4 py-1.5 bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:opacity-95 text-white font-bold rounded-lg shadow-md shadow-[#8B5CF6]/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>บันทึกการแก้ไขเข้าแดชบอร์ด</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#13141F] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-xs border border-[#8B5CF6]/50 animate-bounce backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modal: Quick Paste from Clipboard */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#13141F] rounded-2xl shadow-2xl border border-[#1F2238] w-full max-w-2xl overflow-hidden flex flex-col text-white">
            <div className="bg-[#090A0F] border-b border-[#1F2238] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <ClipboardPaste className="w-5 h-5 text-[#8B5CF6]" />
                <span>วางข้อมูลจาก Excel / Google Sheets (Paste Data)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="text-[#A1A1AA] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-[#A1A1AA]">
              <p className="leading-relaxed text-white">
                คัดลอกตารางจากโปรแกรม <strong>Microsoft Excel</strong> หรือ <strong>Google Sheets</strong> (รวมหัวตารางหรือเฉพาะข้อมูล) แล้วกด <strong>Ctrl+V</strong> วางในกล่องข้อความด้านล่างนี้:
              </p>

              <textarea
                value={pasteRawText}
                onChange={e => setPasteRawText(e.target.value)}
                placeholder={`ตัวอย่างที่คัดลอกมาจาก Excel:\n1/7/25 0:00\t0.0918\t44.66\t0.0633\t45.88\t-0.0349\t2.57\t0.0211\t42.81\t0.0287\t40.26\n1/7/25 2:24\t0.0897\t43.39\t0.0599\t44.45\t-0.0349\t2.56\t0.0192\t42.06\t0.0453\t40.62`}
                rows={8}
                className="w-full bg-[#090A0F] border border-[#1F2238] rounded-xl p-3 font-mono text-xs text-white focus:outline-hidden focus:ring-1 focus:ring-[#8B5CF6] focus:border-[#8B5CF6]"
              />

              <div className="bg-[#090A0F] border border-[#1F2238] rounded-xl p-3 text-[11px] text-[#A1A1AA] space-y-1">
                <div className="font-semibold text-white">ลำดับคอลัมน์มาตรฐาน:</div>
                <div>คอลัมน์ 1: วันที่และเวลา (Date / Time)</div>
                <div>คอลัมน์ 2-11: UF-1 TMP, UF-1 Flow, UF-2 TMP, UF-2 Flow, ..., UF-5 Flow</div>
              </div>
            </div>

            <div className="bg-[#090A0F] border-t border-[#1F2238] px-6 py-3.5 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="px-4 py-2 bg-[#1F2238] hover:bg-[#272B47] text-white rounded-xl font-medium cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleApplyPasteText}
                disabled={!pasteRawText.trim()}
                className="px-4 py-2 bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:opacity-95 disabled:opacity-50 text-white font-bold rounded-xl shadow-md shadow-[#8B5CF6]/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>เพิ่มข้อมูลเข้าตาราง</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Render an inline editable cell with focus box
function renderEditableCell(
  rowIndex: number,
  colKey: keyof SpreadsheetRow,
  value: any,
  activeCell: ActiveCell,
  isEditing: boolean,
  editValue: string,
  setEditValue: (val: string) => void,
  handleCellClick: (r: number, c: keyof SpreadsheetRow) => void,
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void,
  commitCellEdit: () => void,
  editInputRef: React.RefObject<HTMLInputElement | null>,
  extraClass = ''
) {
  const isSelected = activeCell?.rowIndex === rowIndex && activeCell?.colKey === colKey;

  return (
    <td
      onClick={() => handleCellClick(rowIndex, colKey)}
      className={`py-1.5 px-2.5 cursor-pointer relative font-mono text-xs transition-all ${extraClass} ${
        isSelected
          ? 'ring-2 ring-[#8B5CF6] ring-inset bg-[#8B5CF6]/20 text-white z-10'
          : 'hover:bg-[#191B29]'
      }`}
    >
      {isSelected && isEditing ? (
        <input
          ref={editInputRef}
          type="text"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitCellEdit}
          className="w-full bg-[#090A0F] border border-[#8B5CF6] rounded px-1.5 py-0.5 text-xs text-white font-mono focus:outline-hidden shadow-xs"
        />
      ) : (
        <span className="block truncate">
          {value === null || value === undefined ? (
            <span className="text-[#52525B]">-</span>
          ) : typeof value === 'number' ? (
            colKey.includes('tmp') ? value.toFixed(4) : value.toFixed(2)
          ) : (
            String(value)
          )}
        </span>
      )}
    </td>
  );
}

// Visual color tint based on TMP severity
function getTmpCellClass(tmp: number | null | undefined, params: MembraneParameters): string {
  if (tmp === null || tmp === undefined || isNaN(tmp)) return 'text-right font-mono text-[#52525B]';
  if (tmp >= params.criticalTmp) return 'text-right font-mono font-bold text-rose-400 bg-rose-500/15';
  if (tmp >= params.warningTmp) return 'text-right font-mono font-bold text-amber-400 bg-amber-500/15';
  if (tmp < 0) return 'text-right font-mono text-[#A1A1AA] italic bg-[#1F2238]/30';
  return 'text-right font-mono text-white';
}

// Convert dataset to table rows
export function datasetToRows(ds: ProcessedDataset): SpreadsheetRow[] {
  return ds.timestamps.map((t, idx) => ({
    id: `row-${t}-${idx}`,
    timestamp: t,
    dateTimeStr: formatDateTime(t),
    u1_tmp: ds.tmp[0]?.[idx] ?? null,
    u1_flow: ds.flow[0]?.[idx] ?? null,
    u2_tmp: ds.tmp[1]?.[idx] ?? null,
    u2_flow: ds.flow[1]?.[idx] ?? null,
    u3_tmp: ds.tmp[2]?.[idx] ?? null,
    u3_flow: ds.flow[2]?.[idx] ?? null,
    u4_tmp: ds.tmp[3]?.[idx] ?? null,
    u4_flow: ds.flow[3]?.[idx] ?? null,
    u5_tmp: ds.tmp[4]?.[idx] ?? null,
    u5_flow: ds.flow[4]?.[idx] ?? null
  }));
}

// Convert rows back to ProcessedDataset
export function rowsToDataset(rows: SpreadsheetRow[], sourceLabel: string): ProcessedDataset {
  const sorted = [...rows].sort((a, b) => a.timestamp - b.timestamp);
  const timestamps = sorted.map(r => r.timestamp);
  const tmp: (number | null)[][] = [
    sorted.map(r => r.u1_tmp),
    sorted.map(r => r.u2_tmp),
    sorted.map(r => r.u3_tmp),
    sorted.map(r => r.u4_tmp),
    sorted.map(r => r.u5_tmp)
  ];
  const flow: (number | null)[][] = [
    sorted.map(r => r.u1_flow),
    sorted.map(r => r.u2_flow),
    sorted.map(r => r.u3_flow),
    sorted.map(r => r.u4_flow),
    sorted.map(r => r.u5_flow)
  ];

  return {
    timestamps,
    tmp,
    flow,
    isEmbedded: false,
    sourceLabel: sourceLabel || 'ข้อมูลที่แก้ไขผ่าน Excel Online'
  };
}

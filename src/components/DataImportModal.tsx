import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  Layers,
  ArrowRight,
  Table,
  Check,
  ClipboardPaste,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  validateAndPreviewExcel,
  parseClipboardTextAndValidate,
  FileValidationResult,
  downloadExcelTemplate
} from '../utils/excelHandler';
import { createInitialDataset, ProcessedDataset } from '../data/initialData';
import { createScadaSampleDataset } from '../data/scadaSampleData';
import { formatDate } from '../utils/membraneCalculations';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (dataset: ProcessedDataset) => void;
  onOpenExcelOnline?: () => void;
}

// Helper to build validation result for SCADA WHA-UP dataset
function buildScadaSampleValidation(): FileValidationResult {
  const scadaData = createScadaSampleDataset();
  const detectedUnits = scadaData.tmp.map((_, uIdx) => ({
    unitIndex: uIdx,
    unitName: `UF No.${uIdx + 1}`,
    hasTmp: true,
    hasFlow: true
  }));

  const previewCount = Math.min(6, scadaData.timestamps.length);
  const previewRows: FileValidationResult['previewRows'] = [];
  for (let i = 0; i < previewCount; i++) {
    const d = new Date(scadaData.timestamps[i]);
    const dateDisplay = `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${String(d.getUTCFullYear()).slice(-2)} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    const values: Record<string, string | number> = {};
    scadaData.tmp.forEach((uTmp, uIdx) => {
      const tVal = uTmp[i];
      const fVal = scadaData.flow[uIdx] ? scadaData.flow[uIdx][i] : null;
      values[`UF No.${uIdx + 1} TMP`] = tVal !== null ? `${tVal.toFixed(3)} bar` : '-';
      values[`UF No.${uIdx + 1} Flow`] = fVal !== null ? `${fVal.toFixed(1)} m³/h` : '-';
    });
    previewRows.push({ dateStr: dateDisplay, values });
  }

  return {
    isValid: true,
    fileName: 'ข้อมูล SCADA_WHA-UP_Format (43 รอบการกรอง · 1-5 ก.ค. 2568)',
    rowCount: scadaData.timestamps.length,
    dateStartStr: formatDate(scadaData.timestamps[0]),
    dateEndStr: formatDate(scadaData.timestamps[scadaData.timestamps.length - 1]),
    detectedUnits,
    previewRows,
    errors: [],
    dataset: scadaData
  };
}

export const DataImportModal: React.FC<DataImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  onOpenExcelOnline
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'spec'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [validationResult, setValidationResult] = useState<FileValidationResult | null>(null);
  const [showPreviewRows, setShowPreviewRows] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileProcess = (file: File) => {
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const result = validateAndPreviewExcel(buffer, file.name);
        setValidationResult(result);
      } catch (err: any) {
        setValidationResult({
          isValid: false,
          fileName: file.name,
          rowCount: 0,
          dateStartStr: '-',
          dateEndStr: '-',
          detectedUnits: [],
          previewRows: [],
          errors: [err.message || 'เกิดข้อผิดพลาดในการอ่านไฟล์'],
          dataset: null
        });
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileProcess(file);
  };

  // Preview SCADA sample in table so user can review and click Confirm
  const handlePreviewScadaSample = () => {
    try {
      const scadaData = createScadaSampleDataset();
      const detectedUnits = scadaData.tmp.map((_, uIdx) => ({
        unitIndex: uIdx,
        unitName: `UF No.${uIdx + 1}`,
        hasTmp: true,
        hasFlow: true
      }));

      const previewCount = Math.min(6, scadaData.timestamps.length);
      const previewRows: FileValidationResult['previewRows'] = [];
      for (let i = 0; i < previewCount; i++) {
        const d = new Date(scadaData.timestamps[i]);
        const dateDisplay = `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${String(d.getUTCFullYear()).slice(-2)} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
        const values: Record<string, string | number> = {};
        scadaData.tmp.forEach((uTmp, uIdx) => {
          const tVal = uTmp[i];
          const fVal = scadaData.flow[uIdx] ? scadaData.flow[uIdx][i] : null;
          values[`UF No.${uIdx + 1} TMP`] = tVal !== null ? `${tVal.toFixed(3)} bar` : '-';
          values[`UF No.${uIdx + 1} Flow`] = fVal !== null ? `${fVal.toFixed(1)} m³/h` : '-';
        });
        previewRows.push({ dateStr: dateDisplay, values });
      }

      setValidationResult({
        isValid: true,
        fileName: 'ข้อมูล SCADA โรงงานตัวอย่าง (WHA-UP Plant Record · 43 รอบการกรอง)',
        rowCount: scadaData.timestamps.length,
        dateStartStr: formatDate(scadaData.timestamps[0]),
        dateEndStr: formatDate(scadaData.timestamps[scadaData.timestamps.length - 1]),
        detectedUnits,
        previewRows,
        errors: [],
        dataset: scadaData
      });
      setActiveTab('upload');
    } catch (err: any) {
      alert(`โหลดตัวอย่างไม่สำเร็จ: ${err.message}`);
    }
  };

  // Direct Apply SCADA Sample
  const handleQuickApplyScadaSample = () => {
    try {
      const scadaData = createScadaSampleDataset();
      onImportSuccess(scadaData);
      onClose();
    } catch (err: any) {
      alert(`นำเข้าไม่สำเร็จ: ${err.message}`);
    }
  };

  const handleProcessPastedText = () => {
    if (!pastedText.trim()) {
      alert('กรุณาวางข้อความหรือตารางข้อมูลจาก Excel');
      return;
    }
    setIsLoading(true);
    try {
      const result = parseClipboardTextAndValidate(pastedText, 'ข้อมูลคัดลอก (Clipboard Table)');
      setValidationResult(result);
    } catch (err: any) {
      setValidationResult({
        isValid: false,
        fileName: 'ข้อมูลจาก Clipboard',
        rowCount: 0,
        dateStartStr: '-',
        dateEndStr: '-',
        detectedUnits: [],
        previewRows: [],
        errors: [err.message || 'เกิดข้อผิดพลาดในการอ่านข้อความ'],
        dataset: null
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmImport = () => {
    const targetDataset = validationResult?.dataset || createScadaSampleDataset();
    try {
      onImportSuccess(targetDataset);
      onClose();
    } catch (err: any) {
      console.error('Failed to apply dataset:', err);
      alert(`ไม่สามารถนำเข้าข้อมูลได้: ${err.message || 'กรุณาตรวจสอบความถูกต้องของข้อมูล'}`);
    }
  };

  const handleRestoreSampleData = () => {
    const defaultData = createInitialDataset();
    onImportSuccess(defaultData);
    handleClose();
  };

  const handleClose = () => {
    setValidationResult(null);
    setPastedText('');
    onClose();
  };

  const handleTabChange = (tab: 'upload' | 'paste' | 'spec') => {
    setActiveTab(tab);
    if (tab === 'spec') {
      setValidationResult(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex justify-center items-center p-3 sm:p-5 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">แบบฟอร์มนำเข้าข้อมูลมาตรฐาน (Data Import Standard)</h2>
              <p className="text-xs text-blue-400 font-medium">
                Developed by: Utility Operation Engineering UOP Team
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-6 gap-2">
          <button
            onClick={() => handleTabChange('upload')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'upload'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            นำเข้าและตรวจสอบไฟล์ (Upload &amp; Validate)
          </button>
          <button
            onClick={() => handleTabChange('paste')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'paste'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            วางข้อมูลจาก Excel (Paste Data)
          </button>
          <button
            onClick={() => handleTabChange('spec')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'spec'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            ข้อกำหนดโครงสร้างตาราง (Data Schema Guide)
          </button>
          {onOpenExcelOnline && (
            <button
              onClick={() => {
                handleClose();
                onOpenExcelOnline();
              }}
              className="py-3 px-3.5 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-b-2 border-emerald-600 ml-auto"
              title="เปิดแก้ไขในระบบ Excel Online โดยตรง"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>📊 แก้ไขใน Excel Online ↗</span>
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Quick Template Download Banner */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-bold text-blue-900 text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                ชุดข้อมูลตัวอย่าง SCADA WHA-UP &amp; แบบฟอร์มมาตรฐาน (.xlsx)
              </div>
              <div className="text-[11px] text-blue-700 leading-relaxed">
                คลิกเพื่อดูตัวอย่างข้อมูลจริง 43 รอบการกรอง (1/7/25 - 5/7/25) หรือเปิดแก้ไขสดใน Excel Online
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onOpenExcelOnline && (
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onOpenExcelOnline();
                  }}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="เปิดหน้าต่างแก้ไขข้อมูลแบบ Excel Online เต็มรูปแบบ"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                  <span>เปิดแก้ไขใน Excel Online</span>
                </button>
              )}

              <button
                type="button"
                onClick={handlePreviewScadaSample}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="โหลดตัวอย่างเข้าสู่ตารางตรวจสอบก่อนยืนยัน"
              >
                <Layers className="w-3.5 h-3.5" />
                ดูตัวอย่างข้อมูล SCADA
              </button>

              {validationResult && (
                <button
                  type="button"
                  onClick={() => setValidationResult(null)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="ซ่อนกล่องตัวอย่าง ไม่ต้องแสดงที่หน้าจอ"
                >
                  <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>ไม่ต้องแสดงที่หน้าจอ</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleQuickApplyScadaSample}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="นำเข้าชุดข้อมูล SCADA เข้าสู่แดชบอร์ดทันที"
              >
                <Check className="w-3.5 h-3.5" />
                นำเข้า SCADA ทันที
              </button>

              <button
                type="button"
                onClick={downloadExcelTemplate}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                ดาวน์โหลด Template
              </button>
            </div>
          </div>

          {activeTab === 'upload' && (
            <>
              {/* Drag and drop / Select file zone */}
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleFileProcess(file);
                    e.target.value = '';
                  }}
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center mb-2">
                  <Upload className="w-6 h-6" />
                </div>

                <div className="font-semibold text-slate-800 text-sm">
                  คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
                </div>
                <div className="text-slate-500 text-[11px] mt-1">
                  รองรับไฟล์ Microsoft Excel (.xlsx, .xls) หรือ CSV (.csv)
                </div>
              </div>
            </>
          )}

          {activeTab === 'paste' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-800 block text-xs">
                  วางข้อมูลตารางที่คัดลอกจาก Excel (Copy &amp; Paste):
                </label>
                <p className="text-[11px] text-slate-500">
                  เลือกแถวและคอลัมน์ใน Excel กด Ctrl+C แล้วนำมากด Ctrl+V วางในกล่องข้อความด้านล่างนี้
                </p>
              </div>

              <textarea
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                placeholder={"Time\tPane1-FIT-102-1 UF No.1\tPane1-UF No.1 TMP\t...\n1/7/25 0:00\t44.66\t0.0918\t..."}
                rows={7}
                className="w-full font-mono text-[11px] bg-slate-50 border border-slate-300 rounded-xl p-3 focus:bg-white focus:outline-blue-500"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPastedText('')}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-medium cursor-pointer"
                >
                  ล้างข้อความ
                </button>
                <button
                  type="button"
                  onClick={handleProcessPastedText}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  ตรวจสอบข้อมูลที่วาง (Parse &amp; Validate)
                </button>
              </div>
            </div>
          )}

          {/* Validation & Preview Feedback */}
          {isLoading && (
            <div className="text-center py-4 text-slate-500 text-xs flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>กำลังอ่านและตรวจสอบโครงสร้างไฟล์...</span>
            </div>
          )}

          {validationResult && !isLoading && (
            <div className="space-y-4">
              {validationResult.isValid ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900 border-b border-emerald-200 pb-2 gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>ไฟล์ถูกต้องตามแบบฟอร์มมาตรฐาน พร้อมนำเข้าสู่ระบบ</span>
                      <span className="text-[11px] font-normal text-emerald-700">
                        ({validationResult.fileName} · {validationResult.rowCount.toLocaleString()} แถว)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setValidationResult(null)}
                      className="px-2.5 py-1 text-emerald-800 hover:text-emerald-950 hover:bg-emerald-200/60 rounded-lg transition-colors flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer border border-emerald-300 shadow-2xs"
                      title="ไม่ต้องแสดงที่หน้าจอ (ซ่อนกล่องตัวอย่าง)"
                    >
                      <EyeOff className="w-3.5 h-3.5 text-emerald-700" />
                      <span>ไม่ต้องแสดงที่หน้าจอ</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px] text-emerald-800">
                    <div>
                      <span className="text-emerald-600 font-medium">ช่วงวันที่:</span>{' '}
                      <strong>{validationResult.dateStartStr} ถึง {validationResult.dateEndStr}</strong>
                    </div>
                    <div>
                      <span className="text-emerald-600 font-medium">ยูนิตที่ตรวจพบ:</span>{' '}
                      <strong>{validationResult.detectedUnits.length} ยูนิต</strong>
                    </div>
                    <div>
                      <span className="text-emerald-600 font-medium">สถานะข้อมูล:</span>{' '}
                      <strong className="text-emerald-700 font-bold">พร้อมอัปเดตแดชบอร์ด</strong>
                    </div>
                  </div>

                  {/* Detected Units Badges */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {validationResult.detectedUnits.map(u => (
                      <span
                        key={u.unitName}
                        className="bg-white border border-emerald-300 rounded px-2 py-0.5 text-[10px] text-emerald-800 font-medium shadow-2xs"
                      >
                        ✓ {u.unitName} {u.hasFlow ? '(TMP + Flow)' : '(เฉพาะ TMP)'}
                      </span>
                    ))}
                  </div>

                  {/* 5 Rows Preview */}
                  {validationResult.previewRows.length > 0 && (
                    <div className="pt-2">
                      <div className="text-[11px] font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-emerald-950 font-bold">
                          <Table className="w-3.5 h-3.5 text-emerald-700" />
                          ตัวอย่างข้อมูลที่อ่านได้จริง (5 แถวแรก):
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">
                            แสดง {validationResult.previewRows.length} จาก {validationResult.rowCount.toLocaleString()} แถว
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowPreviewRows(!showPreviewRows)}
                            className="text-[11px] text-emerald-800 hover:text-emerald-950 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                          >
                            {showPreviewRows ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>ซ่อนตาราง (ไม่ต้องแสดงที่หน้าจอ)</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>แสดงตาราง</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {showPreviewRows && (
                        <div className="overflow-x-auto border border-emerald-200 rounded-lg bg-white max-h-48 overflow-y-auto">
                          <table className="w-full text-[10px] text-right">
                            <thead className="sticky top-0 bg-slate-100 z-10">
                              <tr className="text-slate-700 font-semibold border-b border-slate-200">
                                <th className="py-1.5 px-2 text-left bg-slate-100">วันที่</th>
                                {Object.keys(validationResult.previewRows[0].values).map(colName => (
                                  <th key={colName} className="py-1.5 px-2 bg-slate-100">{colName}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {validationResult.previewRows.map((r, rIdx) => (
                                <tr key={rIdx} className="hover:bg-slate-50">
                                  <td className="py-1.5 px-2 text-left font-sans font-medium text-slate-900">{r.dateStr}</td>
                                  {Object.values(r.values).map((v, cIdx) => (
                                    <td key={cIdx} className="py-1.5 px-2">{String(v)}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="pt-3 flex items-center justify-between border-t border-emerald-200 gap-2 flex-wrap">
                    <span className="text-[11px] text-emerald-800 font-medium">
                      กดปุ่มยืนยันเพื่อนำข้อมูลเข้าแดชบอร์ดทันที:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setValidationResult(null)}
                        className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="ปิดกล่องนี้ ไม่ต้องแสดงที่หน้าจอ"
                      >
                        <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                        <span>ไม่ต้องแสดงที่หน้าจอ</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleConfirmImport}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer hover:shadow-lg active:scale-95"
                      >
                        <Check className="w-4 h-4" />
                        <span>ยืนยันนำเข้าข้อมูลเพื่อวิเคราะห์ (Confirm &amp; Analyze)</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold flex items-center gap-1.5 text-red-900">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      ไฟล์ไม่ตรงตามรูปแบบมาตรฐาน
                    </div>
                    <button
                      type="button"
                      onClick={() => setValidationResult(null)}
                      className="px-2 py-0.5 text-red-700 hover:bg-red-100 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      title="ไม่ต้องแสดงที่หน้าจอ"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>ไม่ต้องแสดงที่หน้าจอ</span>
                    </button>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px]">
                    {validationResult.errors.map((err, eIdx) => (
                      <li key={eIdx}>{err}</li>
                    ))}
                  </ul>
                  <div className="pt-1 text-[11px] text-slate-600 flex items-center justify-between">
                    <span>แนะนำให้คลิกปุ่ม &quot;ดูตัวอย่างข้อมูล SCADA&quot; หรือดาวน์โหลดไฟล์แม่แบบ</span>
                    <button
                      type="button"
                      onClick={handlePreviewScadaSample}
                      className="text-blue-700 font-bold underline cursor-pointer"
                    >
                      โหลดตัวอย่าง SCADA ทดสอบ
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'spec' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 leading-relaxed">
                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  มาตรฐานการจัดรูปแบบตาราง (Standard Header Schema)
                </div>
                <p className="text-[11px] text-slate-600">
                  ระบบอ่านข้อมูลโดยจับคู่ชื่อหัวคอลัมน์อัตโนมัติ (Smart Column Matching) เพื่อความสะดวกในการรวบรวมข้อมูลจาก SCADA / PLC ของโรงงาน:
                </p>
              </div>

              {/* Specification Table */}
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 font-semibold text-slate-700 border-b border-slate-200">
                      <th className="py-2.5 px-3">ลำดับ</th>
                      <th className="py-2.5 px-3">ชื่อคอลัมน์มาตรฐาน</th>
                      <th className="py-2.5 px-3">หน่วยวัด</th>
                      <th className="py-2.5 px-3">รูปแบบที่ระบบรองรับ (Aliases)</th>
                      <th className="py-2.5 px-3">ตัวอย่างข้อมูล</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    <tr>
                      <td className="py-2 px-3 font-mono text-slate-500">Col 1</td>
                      <td className="py-2 px-3 font-bold text-slate-900">Time / Date</td>
                      <td className="py-2 px-3 text-slate-600">วัน/เวลา</td>
                      <td className="py-2 px-3 text-slate-600">Time, Date, Timestamp, วันที่, เวลา, วัน/เวลา</td>
                      <td className="py-2 px-3 font-mono">1/7/25 0:00 หรือ 2025-07-01</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono text-slate-500">SCADA Tag</td>
                      <td className="py-2 px-3 font-bold text-blue-700">Pane1-UF No.1 TMP</td>
                      <td className="py-2 px-3 text-slate-600">bar</td>
                      <td className="py-2 px-3 text-slate-600">Pane1-UF No.1 TMP, UF No.1 TMP, UF1 TMP, Unit 1 TMP</td>
                      <td className="py-2 px-3 font-mono">0.0918 bar</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono text-slate-500">SCADA Tag</td>
                      <td className="py-2 px-3 font-bold text-sky-700">Pane1-FIT-102-1 UF No.1 (FLOW TRANSMITTER)</td>
                      <td className="py-2 px-3 text-slate-600">m³/hr</td>
                      <td className="py-2 px-3 text-slate-600">Pane1-FIT-102-1, UF No.1 FLOW, UF1 Flow, FIT-102-1</td>
                      <td className="py-2 px-3 font-mono">44.66 m³/h</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono text-slate-500">SCADA Tag</td>
                      <td className="py-2 px-3 font-bold text-purple-700">Pane1-PT-102-1-1 / 1-2 (PRESSURE)</td>
                      <td className="py-2 px-3 text-slate-600">bar</td>
                      <td className="py-2 px-3 text-slate-600">Inlet &amp; Permeate Pressure (คำนวณ TMP ให้อัตโนมัติหากไม่มีคอลัมน์ TMP)</td>
                      <td className="py-2 px-3 font-mono">0.58 / 0.29 bar</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-mono text-slate-500">Unit 2-5</td>
                      <td className="py-2 px-3 font-bold text-slate-900">Pane1-UF No.2 ถึง UF No.5</td>
                      <td className="py-2 px-3 text-slate-600">bar / m³/hr</td>
                      <td className="py-2 px-3 text-slate-600">รูปแบบแท็ก SCADA เดียวกับ UF No.1</td>
                      <td className="py-2 px-3 font-mono">ตามค่าวัดจริง</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={handleRestoreSampleData}
            className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>รีเซ็ตกลับเป็นข้อมูลตามรูปภาพแนบ (SCADA WHA-UP: 43 รอบการกรอง)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-medium transition-colors cursor-pointer"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};

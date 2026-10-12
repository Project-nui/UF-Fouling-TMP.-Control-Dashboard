/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Activity,
  Layers,
  Sliders,
  Download,
  Upload,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Gauge,
  Sparkles,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Droplets,
  RotateCcw,
  BookOpen,
  LogOut,
  Trash2,
  Code
} from 'lucide-react';
import { createInitialDataset, ProcessedDataset } from './data/initialData';
import { createScadaSampleDataset } from './data/scadaSampleData';
import {
  MembraneParameters,
  analyzePlantData,
  formatDate,
  formatNumber
} from './utils/membraneCalculations';
import { parseExcelWorkbook, exportAnalysisExcel, downloadExcelTemplate } from './utils/excelHandler';
import { exportReportToPDF } from './utils/pdfExport';
import { MultiUnitTmpChart } from './components/MultiUnitTmpChart';
import { SingleUnitFoulingChart } from './components/SingleUnitFoulingChart';
import { FluxRateTrendChart } from './components/FluxRateTrendChart';
import { FoulingPhysicsAnimation } from './components/FoulingPhysicsAnimation';
import { SopAndReferenceGuide } from './components/SopAndReferenceGuide';
import { LoginScreen } from './components/LoginScreen';
import { ReportModal } from './components/ReportModal';
import { DataImportModal } from './components/DataImportModal';
import { ExcelOnlineEditor } from './components/ExcelOnlineEditor';
import { HtmlCodeModal } from './components/HtmlCodeModal';

export default function App() {
  // Authentication state - Default to true for direct online web access
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('uf_auth_token') === 'false') {
      return false;
    }
    return true;
  });

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'excel' | 'animation' | 'sop'>('dashboard');

  // Report modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Standalone HTML modal state
  const [isHtmlModalOpen, setIsHtmlModalOpen] = useState(false);

  // Data import modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Loaded dataset: uses SCADA_WHA-UP_Format by default
  const [dataset, setDataset] = useState<ProcessedDataset>(() => createScadaSampleDataset());

  // Operating parameters
  const [params, setParams] = useState<MembraneParameters>({
    modulesCount: 22,
    areaPerModule: 99,
    warningTmp: 0.40,
    criticalTmp: 0.60,
    minFlux: 10,
    efmDrop: 0.10,
    cipDrop: 0.30,
    consecutiveEfmLimit: 3,
    fluxAveraging: 'daily',
    minPermeability: 100, // LMH/bar (เกณฑ์เตือนเมื่อต่ำกว่า = เริ่มอุดตัน)
    maxPermeability: 700  // LMH/bar (เกณฑ์เตือนเมื่อสูงกว่า = เสี่ยงเยื่อกรองขาด/รั่ว)
  });

  const [showParamSettings, setShowParamSettings] = useState(false);
  const [showPermeabilityConfig, setShowPermeabilityConfig] = useState(false);
  // Symbol display mode for Permeability: 'symbol-only' (<, =, >) vs 'symbol-label' (< เตือน, = ปกติ, > วิกฤต)
  const [permeabilitySymbolMode, setPermeabilitySymbolMode] = useState<'symbol-only' | 'symbol-label'>('symbol-only');

  // Time range filtering
  const [startDateStr, setStartDateStr] = useState<string>(() => formatDate(dataset.timestamps[0]));
  const [endDateStr, setEndDateStr] = useState<string>(() =>
    formatDate(dataset.timestamps[dataset.timestamps.length - 1])
  );

  // Available data bounds in string format (YYYY-MM-DD)
  const dataStartStr = dataset.timestamps.length > 0 ? formatDate(dataset.timestamps[0]) : '';
  const dataEndStr = dataset.timestamps.length > 0 ? formatDate(dataset.timestamps[dataset.timestamps.length - 1]) : '';

  // Synchronize start and end dates whenever dataset changes so it always reflects available data
  useEffect(() => {
    if (dataset.timestamps.length > 0) {
      const minDate = formatDate(dataset.timestamps[0]);
      const maxDate = formatDate(dataset.timestamps[dataset.timestamps.length - 1]);
      if (!startDateStr || startDateStr < minDate || startDateStr > maxDate) {
        setStartDateStr(minDate);
      }
      if (!endDateStr || endDateStr > maxDate || endDateStr < minDate) {
        setEndDateStr(maxDate);
      }
    }
  }, [dataset.timestamps]);

  // Selected unit for deep-dive
  const [selectedUnitIdx, setSelectedUnitIdx] = useState<number>(0);

  // Notification / export states
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Time bounds in milliseconds (always finite and bounded strictly to available data range)
  const rangeStartMs = useMemo(() => {
    if (dataset.timestamps.length === 0) return Date.now() - 30 * 86400000;
    const minDataTs = dataset.timestamps[0];
    const maxDataTs = dataset.timestamps[dataset.timestamps.length - 1];

    if (!startDateStr) return minDataTs;
    const parts = startDateStr.split('-').map(Number);
    let ms: number;
    if (parts.length === 3 && !isNaN(parts[0])) {
      ms = Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    } else {
      const parsed = Date.parse(startDateStr);
      ms = !isNaN(parsed) ? parsed : minDataTs;
    }
    // Clamp to available data range
    return Math.max(minDataTs, Math.min(ms, maxDataTs));
  }, [startDateStr, dataset.timestamps]);

  const rangeEndMs = useMemo(() => {
    if (dataset.timestamps.length === 0) return Date.now();
    const minDataTs = dataset.timestamps[0];
    const maxDataTs = dataset.timestamps[dataset.timestamps.length - 1];

    if (!endDateStr) return maxDataTs;
    const parts = endDateStr.split('-').map(Number);
    let ms: number;
    if (parts.length === 3 && !isNaN(parts[0])) {
      ms = Date.UTC(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
    } else {
      const parsed = Date.parse(endDateStr);
      ms = !isNaN(parsed) ? parsed + 86400000 - 1 : maxDataTs;
    }
    // Clamp to available data range
    return Math.min(maxDataTs, Math.max(ms, minDataTs));
  }, [endDateStr, dataset.timestamps]);

  // Comprehensive analysis
  const analyses = useMemo(() => {
    return analyzePlantData(dataset, params, rangeStartMs, rangeEndMs);
  }, [dataset, params, rangeStartMs, rangeEndMs]);

  // Summary Metrics
  const summaryStats = useMemo(() => {
    const normalCount = analyses.filter(a => a.status === 'normal').length;
    const warningCount = analyses.filter(a => a.status === 'warning').length;
    const criticalCount = analyses.filter(a => a.status === 'critical').length;

    // Highest current TMP
    let highestCurrentTmp = -1;
    let highestCurrentUnit = '-';
    analyses.forEach(a => {
      if (a.currentTmp !== null && a.currentTmp > highestCurrentTmp) {
        highestCurrentTmp = a.currentTmp;
        highestCurrentUnit = a.unitName;
      }
    });

    // Average Flux across running units
    const validFluxes = analyses.map(a => a.avgFlux).filter((f): f is number => f !== null);
    const avgPlantFlux = validFluxes.length > 0 ? validFluxes.reduce((x, y) => x + y, 0) / validFluxes.length : null;

    // Total Cleanings in range
    const totalEfm = analyses.reduce((sum, a) => sum + a.efmCount, 0);
    const totalCip = analyses.reduce((sum, a) => sum + a.cipCount, 0);

    return {
      normalCount,
      warningCount,
      criticalCount,
      highestCurrentTmp: highestCurrentTmp > 0 ? highestCurrentTmp : null,
      highestCurrentUnit,
      avgPlantFlux,
      totalEfm,
      totalCip
    };
  }, [analyses]);

  // Handle Preset Time ranges
  const handleRangePreset = (days: number | 0) => {
    const latestMs = dataset.timestamps[dataset.timestamps.length - 1];
    setEndDateStr(formatDate(latestMs));
    if (days === 0) {
      setStartDateStr(formatDate(dataset.timestamps[0]));
    } else {
      const startMs = Math.max(dataset.timestamps[0], latestMs - days * 86400000);
      setStartDateStr(formatDate(startMs));
    }
  };

  const handleSetSpecificDate = (dateStr: string) => {
    setStartDateStr(dateStr);
    setEndDateStr(dateStr);
    setExportMessage(`แสดงผลเฉพาะวันที่ ${dateStr} ตามข้อมูลที่แนบ`);
    setTimeout(() => setExportMessage(null), 3000);
  };

  // Save dataset updated from Excel Online Editor
  const handleSaveFromExcelOnline = (newDataset: ProcessedDataset) => {
    setDataset(newDataset);
    if (newDataset.timestamps.length > 0) {
      setStartDateStr(formatDate(newDataset.timestamps[0]));
      setEndDateStr(formatDate(newDataset.timestamps[newDataset.timestamps.length - 1]));
    }
    setExportMessage(`บันทึกข้อมูล Excel Online สำเร็จ: ${newDataset.timestamps.length.toLocaleString()} แถว พร้อมวิเคราะห์ผลสดบนแดชบอร์ด`);
    setTimeout(() => setExportMessage(null), 5000);
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const buffer = ev.target?.result as ArrayBuffer;
        const newDataset = parseExcelWorkbook(buffer, file.name);
        setDataset(newDataset);
        setStartDateStr(formatDate(newDataset.timestamps[0]));
        setEndDateStr(formatDate(newDataset.timestamps[newDataset.timestamps.length - 1]));
        setSelectedUnitIdx(0);
        setExportMessage(`อัปโหลดสำเร็จ: ${file.name} (${newDataset.timestamps.length} แถว)`);
        setTimeout(() => setExportMessage(null), 5000);
      } catch (err: any) {
        alert(`อ่านไฟล์ไม่สำเร็จ: ${err.message || 'รูปแบบตารางไม่ตรงตามมาตรฐาน'}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Handle Export Excel
  const handleExportExcel = () => {
    try {
      exportAnalysisExcel(analyses, params, dataset);
      setExportMessage('ส่งออกไฟล์ Excel สำเร็จเรียบร้อย');
      setTimeout(() => setExportMessage(null), 4000);
    } catch (err: any) {
      alert(`ส่งออก Excel ไม่สำเร็จ: ${err.message}`);
    }
  };

  // Handle Export PDF
  const handleExportPDF = async () => {
    setIsExportingPdf(true);
    setExportMessage('กำลังสร้างรายงาน PDF กรุณารอสักครู่...');
    try {
      await exportReportToPDF('printable-dashboard-area', 'UF_TMP_Summary_Report');
      setExportMessage('บันทึกรายงาน PDF เรียบร้อยแล้ว');
      setTimeout(() => setExportMessage(null), 4000);
    } catch (err: any) {
      alert(`สร้าง PDF ไม่สำเร็จ: ${err.message}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.setItem('uf_auth_token', 'false');
    setIsAuthenticated(false);
  };

  const selectedAnalysis = analyses[selectedUnitIdx] || analyses[0];

  // If not authenticated, show Login Screen with password: eng1234
  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-['Prompt',system-ui,sans-serif]">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2.5 flex-wrap">
                    <span>UF Fouling TMP. Control Dashboard</span>
                    <span className="text-blue-600 font-semibold">WHA-UP Analysis</span>
                  </h1>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                  <span className="text-blue-600 font-medium">Developed by: Utility Operation Engineering UOP Team</span>
                </div>
              </div>
            </div>

            {/* Navigation Tabs & Logout */}
            <div className="flex items-center gap-2 self-start md:self-center">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                    activeTab === 'dashboard'
                      ? 'bg-white text-blue-700 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  แดชบอร์ด TMP & Flux
                </button>
                <button
                  onClick={() => setActiveTab('excel')}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'excel'
                      ? 'bg-emerald-700 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-emerald-800'
                  }`}
                  title="เปิดตาราง Excel Online นำเข้าและแก้ไขข้อมูลสด"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                  <span>Excel Online (แก้ไขสด)</span>
                </button>
                <button
                  onClick={() => setActiveTab('animation')}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                    activeTab === 'animation'
                      ? 'bg-white text-blue-700 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Droplets className="w-4 h-4" />
                  แอนิเมชันฟิสิกส์การอุดตัน
                </button>
                <button
                  onClick={() => setActiveTab('sop')}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                    activeTab === 'sop'
                      ? 'bg-white text-blue-700 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  คู่มือวิศวกรรม & SOP
                </button>
              </div>

              <button
                onClick={handleLogout}
                className="px-2.5 py-1.5 text-xs font-medium rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="ออกจากระบบ"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ออกจากระบบ</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Notification Toast */}
      {exportMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-xs shadow-xl flex items-center gap-2 border border-slate-700 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{exportMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-5 flex-1 space-y-6">
        {activeTab === 'animation' && (
          <FoulingPhysicsAnimation
            warningTmp={params.warningTmp}
            criticalTmp={params.criticalTmp}
          />
        )}

        {activeTab === 'sop' && <SopAndReferenceGuide />}

        {activeTab === 'excel' && (
          <div className="space-y-6">
            <ExcelOnlineEditor
              dataset={dataset}
              params={params}
              onSaveDataset={handleSaveFromExcelOnline}
              onNavigateToDashboard={() => setActiveTab('dashboard')}
            />
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div id="printable-dashboard-area" className="space-y-6">
            {/* Active Data Source Banner & Fast Dataset Switcher */}
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 animate-pulse" />
                <span className="font-semibold text-slate-800">ชุดข้อมูลที่กำลังวิเคราะห์:</span>
                <span className="font-semibold px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border-emerald-300">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{dataset.sourceLabel}</span>
                </span>
                <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✓ แสดงผลตามข้อมูลที่แนบไปเท่านั้น ({dataset.timestamps.length.toLocaleString()} จุด · UF No.1 - No.5)
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('excel')}
                  className="px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs cursor-pointer"
                  title="เปิดหน้าแก้ไขหรือนำเข้าข้อมูลในระบบ Excel Online"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>แก้ไขใน Excel Online</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const scada = createScadaSampleDataset();
                    setDataset(scada);
                    setStartDateStr(formatDate(scada.timestamps[0]));
                    setEndDateStr(formatDate(scada.timestamps[scada.timestamps.length - 1]));
                    setSelectedUnitIdx(0);
                    setExportMessage('รีเซ็ตเป็นข้อมูล SCADA ตามรูปภาพแนบเรียบร้อยแล้ว (43 รอบการกรอง)');
                    setTimeout(() => setExportMessage(null), 5000);
                  }}
                  className="px-3 py-1.5 rounded-lg font-semibold text-xs transition-all flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                  title="รีเซ็ตกลับเป็นข้อมูลตามรูปภาพแนบ (43 รอบการกรอง)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>ข้อมูลตามรูปภาพแนบ (43 รอบ)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="เปิดแบบฟอร์มนำเข้าไฟล์ข้อมูล Excel/SCADA ใหม่"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>นำเข้าไฟล์ใหม่</span>
                </button>
              </div>
            </div>

            {/* KPI Summary Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* Unit Status Overview */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <div className="text-xs font-medium text-slate-500 mb-1 flex items-center justify-between">
                  <span>สถานะความสมบูรณ์ยูนิต</span>
                  <Activity className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {summaryStats.normalCount}
                    <span className="text-xs font-normal text-slate-500">/{analyses.length} ปกติ</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] mt-2 pt-2 border-t border-slate-100">
                  <span className="text-emerald-700 font-medium">✓ ปกติ {summaryStats.normalCount}</span>
                  {summaryStats.warningCount > 0 && (
                    <span className="text-amber-600 font-medium">· ⚠️ เตือน {summaryStats.warningCount}</span>
                  )}
                  {summaryStats.criticalCount > 0 && (
                    <span className="text-red-600 font-bold">· 🛑 วิกฤต {summaryStats.criticalCount}</span>
                  )}
                </div>
              </div>

              {/* Highest TMP */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <div className="text-xs font-medium text-slate-500 mb-1 flex items-center justify-between">
                  <span>TMP ล่าสุดสูงสุด</span>
                  <Gauge className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span
                    className={`text-2xl font-bold ${
                      summaryStats.highestCurrentTmp && summaryStats.highestCurrentTmp >= params.criticalTmp
                        ? 'text-red-600'
                        : summaryStats.highestCurrentTmp && summaryStats.highestCurrentTmp >= params.warningTmp
                        ? 'text-amber-600'
                        : 'text-slate-900'
                    }`}
                  >
                    {formatNumber(summaryStats.highestCurrentTmp, 3)}
                  </span>
                  <span className="text-xs text-slate-500">bar</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100 truncate">
                  อยู่ที่ยูนิต: <strong className="text-slate-700">{summaryStats.highestCurrentUnit}</strong>
                </div>
              </div>

              {/* Average Plant Flux */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <div className="text-xs font-medium text-slate-500 mb-1 flex items-center justify-between">
                  <span>Filtration Flux เฉลี่ยรวม</span>
                  <Droplets className="w-4 h-4 text-sky-500" />
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {formatNumber(summaryStats.avgPlantFlux, 1)}
                  </span>
                  <span className="text-xs text-slate-500">LMH</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                  เป้าหมายช่วงกรอง: &ge; {params.minFlux} LMH
                </div>
              </div>

              {/* Specific Permeability */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <div className="text-xs font-medium text-slate-500 mb-1 flex items-center justify-between">
                  <span>Permeability เฉลี่ย</span>
                  <Sparkles className="w-4 h-4 text-purple-500" />
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {selectedAnalysis.avgPermeability ? formatNumber(selectedAnalysis.avgPermeability, 0) : '-'}
                  </span>
                  <span className="text-xs text-slate-500">LMH/bar</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100 truncate">
                  {selectedAnalysis.unitName} (ความสามารถในการซึม)
                </div>
              </div>

              {/* Detected Cleanings */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <div className="text-xs font-medium text-slate-500 mb-1 flex items-center justify-between">
                  <span>การล้างเคมีสะสมช่วงนี้</span>
                  <Clock className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {summaryStats.totalEfm + summaryStats.totalCip}
                    <span className="text-xs font-normal text-slate-500"> ครั้ง</span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
                  <span className="text-amber-700 font-medium">EFM: {summaryStats.totalEfm}</span>
                  <span>·</span>
                  <span className="text-red-700 font-medium">CIP: {summaryStats.totalCip}</span>
                </div>
              </div>
            </div>

            {/* Filter & Control Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Date range & Presets */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">จาก:</span>
                    <input
                      type="date"
                      value={startDateStr}
                      min={dataStartStr}
                      max={dataEndStr}
                      onChange={e => {
                        const val = e.target.value;
                        if (!val) {
                          setStartDateStr(dataStartStr);
                          return;
                        }
                        if (dataStartStr && val < dataStartStr) setStartDateStr(dataStartStr);
                        else if (dataEndStr && val > dataEndStr) setStartDateStr(dataEndStr);
                        else setStartDateStr(val);
                      }}
                      className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
                      title="เลือกวันเริ่มต้นในการวิเคราะห์ (จำกัดตามช่วงข้อมูลที่มีจริง)"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">ถึง:</span>
                    <input
                      type="date"
                      value={endDateStr}
                      min={dataStartStr}
                      max={dataEndStr}
                      onChange={e => {
                        const val = e.target.value;
                        if (!val) {
                          setEndDateStr(dataEndStr);
                          return;
                        }
                        if (dataEndStr && val > dataEndStr) setEndDateStr(dataEndStr);
                        else if (dataStartStr && val < dataStartStr) setEndDateStr(dataStartStr);
                        else setEndDateStr(val);
                      }}
                      className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
                      title="เลือกวันสิ้นสุดในการวิเคราะห์ (จำกัดตามช่วงข้อมูลที่มีจริง)"
                    />
                  </div>

                  {/* Preset Pills (Functional Filter Buttons) */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        handleRangePreset(0);
                        setExportMessage(`แสดงค่าเท่าที่ข้อมูลมีทั้งหมด: ${dataStartStr} ถึง ${dataEndStr} (${dataset.timestamps.length.toLocaleString()} จุด)`);
                        setTimeout(() => setExportMessage(null), 3500);
                      }}
                      className={`px-2.5 py-1 rounded font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                        startDateStr === dataStartStr && endDateStr === dataEndStr
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'hover:bg-white text-slate-700 hover:text-blue-700'
                      }`}
                      title="แสดงค่าทั้งหมดเท่าที่ข้อมูลมีในระบบ (ปรับช่วงเวลาพอดีกับข้อมูลจริง)"
                    >
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      <span>ข้อมูลแนบทั้งหมด ({dataset.timestamps.length.toLocaleString()} จุด)</span>
                    </button>

                    {/* Quick Day Selectors for 1-5 July 2025 */}
                    {['2025-07-01', '2025-07-02', '2025-07-03', '2025-07-04', '2025-07-05'].map((dStr, idx) => {
                      const isSelected = startDateStr === dStr && endDateStr === dStr;
                      return (
                        <button
                          key={dStr}
                          type="button"
                          onClick={() => handleSetSpecificDate(dStr)}
                          className={`px-2 py-1 rounded font-medium transition-colors cursor-pointer text-xs ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-xs font-semibold'
                              : 'hover:bg-white text-slate-600 hover:text-blue-600'
                          }`}
                          title={`กรองแสดงเฉพาะวันที่ ${idx + 1} ก.ค. 2568`}
                        >
                          {idx + 1} ก.ค.
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => handleRangePreset(1)}
                      className="px-2 py-1 rounded font-medium hover:bg-white hover:text-slate-900 text-slate-600 transition-colors cursor-pointer text-xs"
                      title="แสดง 24 ชั่วโมงล่าสุดของข้อมูล"
                    >
                      24 ชม. ล่าสุด
                    </button>
                  </div>

                  {/* Informational badge showing available data date bounds */}
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded-md border border-slate-200" title="ช่วงวันและเวลาที่มีข้อมูลจริงอยู่ในระบบ">
                    <Calendar className="w-3 h-3 text-blue-500" />
                    <span>ข้อมูลจริง: <strong>{dataStartStr || '-'}</strong> ถึง <strong>{dataEndStr || '-'}</strong></span>
                  </div>
                </div>

                {/* Settings & Exports */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowParamSettings(!showParamSettings)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                      showParamSettings
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    พารามิเตอร์เกณฑ์
                  </button>

                  <button
                    onClick={handleExportExcel}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Export Excel (สรุป 3 ชีท)
                  </button>

                  <button
                    onClick={() => setIsReportModalOpen(true)}
                    className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="ดึงข้อมูลแนวโน้ม, กราฟทุกยูนิต และสรุปคำแนะนำเป็นรายงานทางการ"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>สร้างรายงานสรุป (ดึงกราฟ &amp; PDF)</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Parameter Config Panel */}
              {showParamSettings && (
                <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 text-xs">
                  <div>
                    <label className="text-slate-500 block mb-1">จำนวนโมดูลต่อยูนิต (Units)</label>
                    <input
                      type="number"
                      value={params.modulesCount}
                      onChange={e => setParams({ ...params, modulesCount: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">พื้นที่ผิวต่อโมดูล (m²)</label>
                    <input
                      type="number"
                      value={params.areaPerModule}
                      onChange={e => setParams({ ...params, areaPerModule: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">TMP เตือน Warning (bar)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={params.warningTmp}
                      onChange={e => setParams({ ...params, warningTmp: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">TMP วิกฤต CIP (bar)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={params.criticalTmp}
                      onChange={e => setParams({ ...params, criticalTmp: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">Flux ต่ำสุดที่ถือว่ากรอง (LMH)</label>
                    <input
                      type="number"
                      value={params.minFlux}
                      onChange={e => setParams({ ...params, minFlux: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">TMP ลดลง ≥ ถือเป็น EFM (bar)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={params.efmDrop}
                      onChange={e => setParams({ ...params, efmDrop: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">TMP ลดลง ≥ ถือเป็น CIP (bar)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={params.cipDrop}
                      onChange={e => setParams({ ...params, cipDrop: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">EFM ติดกันกี่ครั้งแล้วควร CIP</label>
                    <input
                      type="number"
                      value={params.consecutiveEfmLimit}
                      onChange={e => setParams({ ...params, consecutiveEfmLimit: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-amber-700 block mb-1 font-semibold">Permeability เตือนต่ำสุด (LMH/bar)</label>
                    <input
                      type="number"
                      value={params.minPermeability ?? 100}
                      onChange={e => setParams({ ...params, minPermeability: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-amber-300 rounded px-2.5 py-1.5 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-rose-700 block mb-1 font-semibold">Permeability เตือนสูงสุด (LMH/bar)</label>
                    <input
                      type="number"
                      value={params.maxPermeability ?? 700}
                      onChange={e => setParams({ ...params, maxPermeability: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-rose-300 rounded px-2.5 py-1.5 text-slate-800"
                    />
                  </div>

                  <div className="col-span-full pt-2 flex items-center justify-between text-slate-500 text-[11px]">
                    <span>
                      พื้นที่รวมต่อยูนิต = {params.modulesCount} โมดูล × {params.areaPerModule} m² ={' '}
                      <strong className="text-slate-700">
                        {(params.modulesCount * params.areaPerModule).toLocaleString()} m²
                      </strong>
                    </span>
                    <button
                      onClick={downloadExcelTemplate}
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      ดาวน์โหลดแบบฟอร์มเทมเพลต Excel สำหรับป้อนข้อมูล
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Calculated Flux Rate Table */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                    <span>ค่า Filtration Flux และ Permeability แยกตาม Unit</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      ระบบเฝ้าระวังความสมบูรณ์เยื่อกรอง
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    พื้นที่คำนวณ: {(params.modulesCount * params.areaPerModule).toLocaleString()} m² ต่อ Rack · ติดตาม Permeability เพื่อตรวจจับการอุดตันสะสมหรือเยื่อกรองขาด
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPermeabilityConfig(!showPermeabilityConfig)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      showPermeabilityConfig
                        ? 'bg-purple-700 text-white shadow-xs'
                        : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300'
                    }`}
                    title="คลิกเพื่อตั้งค่าเกณฑ์แจ้งเตือน Permeability สูง - ต่ำ"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>ตั้งค่าเกณฑ์เตือน สูง - ต่ำ (High / Low Alarm)</span>
                  </button>
                </div>
              </div>

              {/* Permeability Alert Threshold Configuration Panel */}
              {showPermeabilityConfig && (
                <div className="p-3.5 bg-purple-50/80 border border-purple-200 rounded-xl text-xs space-y-3 animate-fade-in shadow-inner">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-200 pb-2">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-purple-700" />
                      <span className="font-bold text-purple-950">
                        ตั้งค่าเกณฑ์แจ้งเตือน Permeability สูง - ต่ำ (System Alarm Limits)
                      </span>
                    </div>
                    <span className="text-[11px] text-purple-700 font-mono">
                      หน่วย: LMH/bar (Specific Permeability = Flux / TMP)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
                    {/* Min Alarm Setter (Low Alarm) */}
                    <div className="bg-white p-3 rounded-lg border border-amber-300 shadow-2xs space-y-1">
                      <label className="text-[11px] font-semibold text-amber-900 block flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-amber-100 border border-amber-300 rounded font-black font-mono text-amber-800 text-xs">&lt;</span>
                          <span>เกณฑ์สัญลักษณ์ &lt; (Min Alarm - เตือนอุดตัน):</span>
                        </span>
                        <span className="font-mono text-amber-700 font-bold">{params.minPermeability ?? 100}</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setParams(p => ({ ...p, minPermeability: Math.max(10, (p.minPermeability ?? 100) - 10) }))}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-bold cursor-pointer transition-colors"
                        >
                          -10
                        </button>
                        <input
                          type="number"
                          step="10"
                          min="10"
                          max="1000"
                          value={params.minPermeability ?? 100}
                          onChange={e => setParams({ ...params, minPermeability: Number(e.target.value) })}
                          className="w-full bg-amber-50/40 border border-amber-300 rounded px-2 py-1 font-mono text-center font-bold text-amber-950 text-xs outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setParams(p => ({ ...p, minPermeability: (p.minPermeability ?? 100) + 10 }))}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-bold cursor-pointer transition-colors"
                        >
                          +10
                        </button>
                      </div>
                      <p className="text-[10px] text-amber-700 mt-1">แสดงสัญลักษณ์ <strong>&lt;</strong> เมื่อค่าต่ำกว่านี้ (เมมเบรนเริ่มตัน ต้องล้าง EFM/CIP)</p>
                    </div>

                    {/* Max Alarm Setter (High Alarm) */}
                    <div className="bg-white p-3 rounded-lg border border-rose-300 shadow-2xs space-y-1">
                      <label className="text-[11px] font-semibold text-rose-900 block flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-rose-100 border border-rose-300 rounded font-black font-mono text-rose-800 text-xs">&gt;</span>
                          <span>เกณฑ์สัญลักษณ์ &gt; (Max Alarm - เตือนรั่ว/ขาด):</span>
                        </span>
                        <span className="font-mono text-rose-700 font-bold">{params.maxPermeability ?? 700}</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setParams(p => ({ ...p, maxPermeability: Math.max((p.minPermeability ?? 100) + 50, (p.maxPermeability ?? 700) - 50) }))}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-bold cursor-pointer transition-colors"
                        >
                          -50
                        </button>
                        <input
                          type="number"
                          step="20"
                          min="50"
                          max="2000"
                          value={params.maxPermeability ?? 700}
                          onChange={e => setParams({ ...params, maxPermeability: Number(e.target.value) })}
                          className="w-full bg-rose-50/40 border border-rose-300 rounded px-2 py-1 font-mono text-center font-bold text-rose-950 text-xs outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setParams(p => ({ ...p, maxPermeability: (p.maxPermeability ?? 700) + 50 }))}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-bold cursor-pointer transition-colors"
                        >
                          +50
                        </button>
                      </div>
                      <p className="text-[10px] text-rose-700 mt-1">เตือนเมื่อค่าสูงผิดปกติ (อาจมีท่อแตกหรือเส้นใยขาดรั่ว)</p>
                    </div>

                    {/* Quick Presets */}
                    <div className="bg-white p-3 rounded-lg border border-purple-200 shadow-2xs col-span-1 sm:col-span-2 space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-700 block">
                        เลือกเกณฑ์มาตรฐานด่วน (Quick Alarm Presets):
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setParams({ ...params, minPermeability: 100, maxPermeability: 700 })}
                          className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                            params.minPermeability === 100 && params.maxPermeability === 700
                              ? 'bg-purple-700 text-white font-bold'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          มาตรฐาน (100 - 700)
                        </button>
                        <button
                          type="button"
                          onClick={() => setParams({ ...params, minPermeability: 150, maxPermeability: 600 })}
                          className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                            params.minPermeability === 150 && params.maxPermeability === 600
                              ? 'bg-purple-700 text-white font-bold'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          เข้มงวด (150 - 600)
                        </button>
                        <button
                          type="button"
                          onClick={() => setParams({ ...params, minPermeability: 250, maxPermeability: 650 })}
                          className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                            params.minPermeability === 250 && params.maxPermeability === 650
                              ? 'bg-purple-700 text-white font-bold'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                          title="ทดสอบให้เห็นการแจ้งเตือนกับข้อมูลจริง"
                        >
                          ทดสอบแจ้งเตือน (250 - 650)
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPermeabilityConfig(false)}
                          className="ml-auto px-2.5 py-1 bg-purple-100 text-purple-900 font-semibold rounded text-xs hover:bg-purple-200 cursor-pointer"
                        >
                          ปิดแผงตั้งค่า
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Alert Notification Banner if any unit breaches Permeability thresholds */}
              {analyses.some(a => a.permeabilityStatus === 'low' || a.permeabilityStatus === 'high') && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs flex flex-wrap items-center justify-between gap-3 text-amber-900 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <div className="font-bold text-amber-950 flex items-center gap-1.5">
                        <span>ระบบแจ้งเตือน Permeability หลุดเกณฑ์ควบคุม</span>
                        <span className="text-[11px] font-normal text-amber-700">
                          (เกณฑ์: Min {params.minPermeability ?? 100} / Max {params.maxPermeability ?? 700} LMH/bar)
                        </span>
                      </div>
                      <div className="text-[11px] text-amber-800 mt-1 flex flex-wrap gap-2">
                        {analyses.filter(a => a.permeabilityStatus === 'low').map(a => (
                          <span key={a.unitName} className="bg-amber-100 px-2 py-0.5 rounded font-mono font-semibold border border-amber-300 text-amber-900">
                            ⚠️ {a.unitName}: {formatNumber(a.avgPermeability, 0)} LMH/bar (ต่ำกว่าเกณฑ์ Min → เสี่ยงตัน)
                          </span>
                        ))}
                        {analyses.filter(a => a.permeabilityStatus === 'high').map(a => (
                          <span key={a.unitName} className="bg-red-100 px-2 py-0.5 rounded font-mono font-semibold border border-red-300 text-red-900">
                            🚨 {a.unitName}: {formatNumber(a.avgPermeability, 0)} LMH/bar (สูงผิดปกติ Max → เสี่ยงรั่ว/ขาด)
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPermeabilityConfig(true)}
                    className="px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold rounded-lg text-xs cursor-pointer shrink-0 transition-colors"
                  >
                    ปรับระดับเกณฑ์
                  </button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3 text-left">Unit</th>
                      <th className="py-2.5 px-3">Flow เฉลี่ย (m³/hr)</th>
                      <th className="py-2.5 px-3">Flux เฉลี่ย (LMH)</th>
                      <th className="py-2.5 px-3">Permeability (LMH/bar)</th>
                      <th className="py-2.5 px-3">Flux ต่ำสุด</th>
                      <th className="py-2.5 px-3">Flux สูงสุด</th>
                      <th className="py-2.5 px-3">Flux ล่าสุด (เฉลี่ย 14 จุด)</th>
                      <th className="py-2.5 px-3">% เวลาที่เดินระบบ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analyses.map(a => {
                      const totalArea = params.modulesCount * params.areaPerModule;
                      const avgFlow = a.avgFlux !== null ? (a.avgFlux * totalArea) / 1000 : null;
                      return (
                        <tr key={a.unitName} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-3 text-left font-medium text-slate-900">{a.unitName}</td>
                          <td className="py-2.5 px-3 font-mono">{formatNumber(avgFlow, 1)}</td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-sky-700">
                            {formatNumber(a.avgFlux, 1)}
                          </td>
                          <td
                            className="py-2.5 px-3 font-mono text-right"
                            title={a.permeabilityAlert || `สูตรคิด: Flux (${formatNumber(a.avgFlux, 1)} LMH) ÷ TMP (${formatNumber(a.currentTmp, 3)} bar)`}
                          >
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {a.permeabilityStatus === 'low' && (
                                permeabilitySymbolMode === 'symbol-only' ? (
                                  <span
                                    className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-md font-mono font-black text-xs bg-amber-100 text-amber-900 border border-amber-400 shadow-2xs"
                                    title={`สัญลักษณ์ < : ค่า Permeability (${formatNumber(a.avgPermeability, 0)}) < เกณฑ์ต่ำสุด ${params.minPermeability ?? 100} LMH/bar (เตือนเมมเบรนเริ่มอุดตัน)`}
                                  >
                                    &lt;
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs"
                                    title={`สัญลักษณ์ < : ค่า Permeability (${formatNumber(a.avgPermeability, 0)}) < เกณฑ์ต่ำสุด ${params.minPermeability ?? 100} LMH/bar (เตือนเมมเบรนเริ่มอุดตัน)`}
                                  >
                                    <span className="font-black text-xs text-amber-800">&lt;</span>
                                    <span className="text-[9px]">เตือนต่ำ</span>
                                  </span>
                                )
                              )}
                              {a.permeabilityStatus === 'normal' && a.avgPermeability !== null && (
                                permeabilitySymbolMode === 'symbol-only' ? (
                                  <span
                                    className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-md font-mono font-black text-xs bg-emerald-100 text-emerald-900 border border-emerald-400 shadow-2xs"
                                    title={`สัญลักษณ์ = : ค่า Permeability (${formatNumber(a.avgPermeability, 0)}) อยู่ในช่วงปกติ (${params.minPermeability ?? 100} - ${params.maxPermeability ?? 700} LMH/bar)`}
                                  >
                                    =
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold text-emerald-900 bg-emerald-50 border border-emerald-300 shadow-2xs"
                                    title={`สัญลักษณ์ = : ค่า Permeability (${formatNumber(a.avgPermeability, 0)}) อยู่ในช่วงปกติ (${params.minPermeability ?? 100} - ${params.maxPermeability ?? 700} LMH/bar)`}
                                  >
                                    <span className="font-black text-xs text-emerald-700">=</span>
                                    <span className="text-[9px]">ปกติ</span>
                                  </span>
                                )
                              )}
                              {a.permeabilityStatus === 'high' && (
                                permeabilitySymbolMode === 'symbol-only' ? (
                                  <span
                                    className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-md font-mono font-black text-xs bg-rose-100 text-rose-900 border border-rose-400 shadow-2xs"
                                    title={`สัญลักษณ์ > : ค่า Permeability (${formatNumber(a.avgPermeability, 0)}) > เกณฑ์สูงสุด ${params.maxPermeability ?? 700} LMH/bar (วิกฤตเสี่ยงเยื่อกรองขาด/รั่ว)`}
                                  >
                                    &gt;
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs"
                                    title={`สัญลักษณ์ > : ค่า Permeability (${formatNumber(a.avgPermeability, 0)}) > เกณฑ์สูงสุด ${params.maxPermeability ?? 700} LMH/bar (วิกฤตเสี่ยงเยื่อกรองขาด/รั่ว)`}
                                  >
                                    <span className="font-black text-xs text-rose-700">&gt;</span>
                                    <span className="text-[9px]">วิกฤตสูง</span>
                                  </span>
                                )
                              )}
                              <span
                                className={`font-bold font-mono text-xs ${
                                  a.permeabilityStatus === 'low'
                                    ? 'text-amber-800'
                                    : a.permeabilityStatus === 'high'
                                    ? 'text-rose-700'
                                    : a.avgPermeability !== null
                                    ? 'text-purple-700'
                                    : 'text-slate-400'
                                }`}
                              >
                                {formatNumber(a.avgPermeability, 0)}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{formatNumber(a.minFlux, 1)}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{formatNumber(a.maxFlux, 1)}</td>
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                            {formatNumber(a.latestFlux, 1)}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-emerald-600 font-medium">
                            {formatNumber(a.percentOperatingDuty, 1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="text-[11px] text-slate-500 mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  คำนวณจากทุกจุดข้อมูลในช่วงเวลาที่เลือก ด้วยตัวหาร {params.modulesCount} โมดูล × {params.areaPerModule} m² (พื้นที่รวม {(params.modulesCount * params.areaPerModule).toLocaleString()} m²)
                  · &quot;% เวลาที่เดินระบบ&quot; นับเมื่อ Flux &ge; {params.minFlux} LMH
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="font-semibold text-slate-700">คำอธิบายสัญลักษณ์:</span>
                  <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
                    <strong className="font-black text-amber-800 text-xs">&lt;</strong>
                    <span>น้อยกว่าเกณฑ์ต่ำสุด ({params.minPermeability ?? 100} LMH/bar เตือนตัน)</span>
                  </span>
                  <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
                    <strong className="font-black text-emerald-800 text-xs">=</strong>
                    <span>ช่วงปกติ ({params.minPermeability ?? 100} - {params.maxPermeability ?? 700})</span>
                  </span>
                  <span className="bg-rose-100 text-rose-900 border border-rose-300 px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
                    <strong className="font-black text-rose-800 text-xs">&gt;</strong>
                    <span>มากกว่าเกณฑ์สูงสุด ({params.maxPermeability ?? 700} LMH/bar วิกฤตเสี่ยงรั่ว)</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Health Monitor & Unit Status Table */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
              <h2 className="text-base font-semibold text-slate-800 mb-3">สถานะแต่ละ UF Unit</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3 text-left">Unit</th>
                      <th className="py-2.5 px-3">TMP ล่าสุด (เฉลี่ย)</th>
                      <th className="py-2.5 px-3">TMP สูงสุด</th>
                      <th className="py-2.5 px-3">Flux เฉลี่ย (LMH)</th>
                      <th className="py-2.5 px-3">% เวลาเกินเกณฑ์เตือน</th>
                      <th className="py-2.5 px-3">EFM (ครั้ง)</th>
                      <th className="py-2.5 px-3">CIP (ครั้ง)</th>
                      <th className="py-2.5 px-3 text-center">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analyses.map(a => (
                      <tr key={a.unitName} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2.5 px-3 text-left font-medium text-slate-900">{a.unitName}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                          {formatNumber(a.currentTmp, 3)} bar
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{formatNumber(a.maxTmp, 3)}</td>
                        <td className="py-2.5 px-3 font-mono">{formatNumber(a.avgFlux, 1)}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {formatNumber(a.percentTimeOverWarning, 1)}%
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-amber-600">{a.efmCount}</td>
                        <td className="py-2.5 px-3 font-mono font-medium text-red-600">{a.cipCount}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold text-white"
                            style={{ backgroundColor: a.statusColor }}
                          >
                            {a.statusLabel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Operational Guide: What to do & When */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
              <h2 className="text-base font-semibold text-slate-800 mb-3">
                ไกด์วิศวกรรม: ควรทำอะไรเมื่อไร (Operational Action Guide)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="border-l-4 border-emerald-500 bg-slate-50/70 p-3.5 rounded-r-lg text-xs space-y-1.5">
                  <div className="font-bold text-slate-900">AS/BW – ล้างทางกายภาพ (อัตโนมัติทุกรอบ)</div>
                  <p className="text-slate-600 leading-relaxed">
                    เป่าลมร่วมกับล้างย้อนน้ำ ใช้ตามรอบปกติ เมื่อ TMP ยังต่ำกว่าเกณฑ์เตือน
                    ตรวจดูว่าระบบทำงานครบรอบและ TMP หลังล้างกลับมาใกล้ค่าเดิม
                  </p>
                </div>
                <div className="border-l-4 border-amber-500 bg-slate-50/70 p-3.5 rounded-r-lg text-xs space-y-1.5">
                  <div className="font-bold text-slate-900">EFM – ล้างเคมีช่วงสั้น/เจือจาง</div>
                  <p className="text-slate-600 leading-relaxed">
                    ทำเมื่อ TMP ไต่ถึงเกณฑ์เตือน ({params.warningTmp} bar) หรือ AS/BW เอา TMP กลับมาไม่ได้แล้ว
                    ใช้เวลาสั้น สารเคมีเจือจาง ป้องกันไม่ให้ไปถึงจุดวิกฤต
                  </p>
                </div>
                <div className="border-l-4 border-red-500 bg-slate-50/70 p-3.5 rounded-r-lg text-xs space-y-1.5">
                  <div className="font-bold text-slate-900">CIP – ล้างเคมีเข้มข้น/ใช้เวลานาน</div>
                  <p className="text-slate-600 leading-relaxed">
                    ทำเมื่อ TMP ถึงเกณฑ์วิกฤต ({params.criticalTmp} bar) หรือทำ EFM หลายครั้งติดกันแล้ว
                    TMP ไม่ยอมลดลงมาใกล้ค่าเริ่มต้น
                  </p>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 mt-2.5">
                ชนิดสารเคมี ความเข้มข้น เวลาแช่ และอุณหภูมิ ให้ใช้ตามคู่มือผู้ผลิตเมมเบรนและ SOP ของโรงงาน
              </div>
            </div>

            {/* Actionable Recommendations per Unit Table */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
              <h2 className="text-base font-semibold text-slate-800 mb-3">
                คำแนะนำปฏิบัติการรายยูนิต (ตามข้อมูลล่าสุด)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3 w-28">Unit</th>
                      <th className="py-2.5 px-3 w-44">การดำเนินการที่ควรทำ</th>
                      <th className="py-2.5 px-3">เหตุผลทางวิศวกรรม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analyses.map(a => {
                      const badgeBg =
                        a.actionType === 'cip'
                          ? 'bg-red-600 text-white'
                          : a.actionType === 'efm'
                          ? 'bg-amber-600 text-white'
                          : a.actionType === 'prep-efm'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold'
                          : 'bg-emerald-600 text-white';

                      return (
                        <tr key={a.unitName} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{a.unitName}</td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-block px-2.5 py-1 rounded text-xs font-semibold ${badgeBg}`}>
                              {a.actionRecommendation}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 leading-relaxed">{a.actionReason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Multi-Unit Trend Chart */}
            <MultiUnitTmpChart
              analyses={analyses}
              warningTmp={params.warningTmp}
              criticalTmp={params.criticalTmp}
              timeRangeStart={rangeStartMs}
              timeRangeEnd={rangeEndMs}
              onUpdateThresholds={(newWarn, newCrit) => {
                setParams(prev => ({
                  ...prev,
                  warningTmp: newWarn,
                  criticalTmp: newCrit
                }));
                setExportMessage(`อัปเดตเกณฑ์: เตือน ${newWarn.toFixed(2)} bar · วิกฤต ${newCrit.toFixed(2)} bar เรียบร้อย`);
                setTimeout(() => setExportMessage(null), 3000);
              }}
            />

            {/* Single Unit Deep-Dive Selectors & Charts */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">
                    การวิเคราะห์เจาะลึกเฉพาะยูนิต (Single Unit Deep Dive)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    เลือกยูนิตเพื่อตรวจดูกราฟการสะสม Fouling, ประวัติการล้างย้อน และแนวโน้ม Flux Rate
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">เลือกยูนิต:</span>
                  <select
                    value={selectedUnitIdx}
                    onChange={e => setSelectedUnitIdx(Number(e.target.value))}
                    className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800"
                  >
                    {analyses.map(a => (
                      <option key={a.unitIdx} value={a.unitIdx}>
                        {a.unitName} (TMP: {a.currentTmp ? a.currentTmp.toFixed(3) : '-'} bar)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Single Unit Fouling Chart */}
              <SingleUnitFoulingChart
                analysis={selectedAnalysis}
                warningTmp={params.warningTmp}
                criticalTmp={params.criticalTmp}
                timeRangeStart={rangeStartMs}
                timeRangeEnd={rangeEndMs}
              />

              {/* Single Unit Flux Rate Chart */}
              <FluxRateTrendChart
                analysis={selectedAnalysis}
                timeRangeStart={rangeStartMs}
                timeRangeEnd={rangeEndMs}
                averagingMode={params.fluxAveraging}
                onAveragingChange={m => setParams({ ...params, fluxAveraging: m })}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="w-full px-4 flex items-center justify-center">
          <span>Developed by: Utility Operation Engineering UOP Team</span>
        </div>
      </footer>

      {/* Full Engineering Report Modal (Charts & Summary) */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        analyses={analyses}
        params={params}
        dataset={dataset}
        timeRangeStart={rangeStartMs}
        timeRangeEnd={rangeEndMs}
      />

      {/* Standard Data Import Modal & Template Form */}
      <DataImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onOpenExcelOnline={() => setActiveTab('excel')}
        onImportSuccess={newDataset => {
          if (!newDataset || !newDataset.timestamps || newDataset.timestamps.length === 0) {
            alert('ไม่พบข้อมูลที่ถูกต้องในไฟล์ กรุณาตรวจสอบข้อมูล');
            return;
          }
          setDataset(newDataset);
          const firstTs = newDataset.timestamps[0];
          const lastTs = newDataset.timestamps[newDataset.timestamps.length - 1];
          if (firstTs && !isNaN(firstTs)) {
            setStartDateStr(formatDate(firstTs));
          }
          if (lastTs && !isNaN(lastTs)) {
            setEndDateStr(formatDate(lastTs));
          }
          setSelectedUnitIdx(0);
          setActiveTab('dashboard');
          setExportMessage(
            `นำเข้าข้อมูลสำเร็จ: ${newDataset.timestamps.length.toLocaleString()} แถวเข้าสู่ระบบ พร้อมวิเคราะห์ผลทันที`
          );
          setTimeout(() => setExportMessage(null), 6000);
        }}
      />

      {/* Standalone HTML Code Modal */}
      <HtmlCodeModal
        isOpen={isHtmlModalOpen}
        onClose={() => setIsHtmlModalOpen(false)}
        dataset={dataset}
        params={params}
        analyses={analyses}
      />
    </div>
  );
}

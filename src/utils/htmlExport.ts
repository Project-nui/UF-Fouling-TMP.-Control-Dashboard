import { ProcessedDataset } from '../data/initialData';
import { MembraneParameters, UnitAnalysis, formatDateTime } from './membraneCalculations';

export function generateStandaloneHtml(
  dataset: ProcessedDataset,
  params: MembraneParameters,
  analyses: UnitAnalysis[]
): string {
  const totalArea = params.modulesCount * params.areaPerModule;

  // Format dataset timestamps as readable strings
  const labels = dataset.timestamps.map(t => formatDateTime(t));
  const safeJsonData = JSON.stringify({
    labels,
    timestamps: dataset.timestamps,
    tmp: dataset.tmp,
    flow: dataset.flow,
    warningTmp: params.warningTmp,
    criticalTmp: params.criticalTmp,
    totalArea
  });

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UF Fouling TMP. Control Dashboard - WHA-UP Analysis (Full Version)</title>
  <!-- Tailwind CSS & Chart.js ผ่าน CDN ไม่ต้องติดตั้ง Node.js หรือ build tools ใดๆ -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Prompt', system-ui, -apple-system, sans-serif; }
    .font-mono { font-family: 'Plus Jakarta Sans', monospace; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .cell-input { width: 100%; border: 1px solid #10b981; border-radius: 4px; padding: 2px 4px; font-family: monospace; font-size: 11px; outline: none; }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen flex flex-col">

  <!-- Top Navigation Header -->
  <header class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/20">
          UF
        </div>
        <div>
          <h1 class="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
            <span>UF Fouling TMP. Control Dashboard</span>
            <span class="text-blue-600 font-semibold">WHA-UP Analysis</span>
          </h1>
          <div class="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
            <span class="text-blue-600 font-medium">Developed by: Utility Operation Engineering UOP Team</span>
            <span>·</span>
            <span>5 ยูนิตเมมเบรน (UF No.1 - No.5)</span>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <div class="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
          <button onclick="switchTab('dashboard')" id="nav-dashboard" class="tab-btn px-3 py-1.5 text-xs font-bold rounded-lg bg-white text-blue-700 shadow-xs transition-all">
            📊 แดชบอร์ด TMP & Flux
          </button>
          <button onclick="switchTab('excel')" id="nav-excel" class="tab-btn px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:text-emerald-700 transition-all">
            📗 Excel Online (แก้ไขสด)
          </button>
          <button onclick="switchTab('physics')" id="nav-physics" class="tab-btn px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:text-blue-700 transition-all">
            💧 แอนิเมชันฟิสิกส์การอุดตัน
          </button>
          <button onclick="switchTab('sop')" id="nav-sop" class="tab-btn px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:text-blue-700 transition-all">
            📖 คู่มือวิศวกรรม & SOP
          </button>
        </div>
        <button onclick="window.print()" class="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg shadow-xs transition-colors cursor-pointer">
          พิมพ์ / PDF
        </button>
      </div>
    </div>
  </header>

  <!-- Notification Banner -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 w-full">
    <div class="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-800">
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 animate-pulse"></span>
        <span>ข้อมูล SCADA WHA-UP Plant Data: <strong>43 รอบการกรอง</strong> (1 ก.ค. 2568 00:00 - 5 ก.ค. 2568 04:48)</span>
      </div>
      <div class="flex items-center gap-2 font-mono text-[11px] text-blue-700">
        <span>พื้นที่ผิวรวม: ${(params.modulesCount * params.areaPerModule).toLocaleString()} m²</span>
        <span>·</span>
        <span>เกณฑ์เตือน: ${params.warningTmp} bar</span>
        <span>·</span>
        <span>เกณฑ์วิกฤต: ${params.criticalTmp} bar</span>
      </div>
    </div>
  </div>

  <!-- Main Workspace -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex-1 w-full space-y-6">

    <!-- ========================================== -->
    <!-- TAB 1: DASHBOARD & CHARTS                  -->
    <!-- ========================================== -->
    <div id="tab-dashboard" class="tab-content active space-y-6">
      
      <!-- KPI Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-3.5" id="kpiContainer"></div>

      <!-- Date Presets & Filter Toolbar -->
      <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-slate-500 font-semibold mr-1">เลือกช่วงข้อมูล:</span>
          <button onclick="filterDate('all')" id="btn-filter-all" class="filter-btn px-2.5 py-1 rounded-lg font-bold bg-blue-600 text-white cursor-pointer">ทั้งหมด (43 จุด)</button>
          <button onclick="filterDate('2025-07-01')" id="btn-filter-1" class="filter-btn px-2.5 py-1 rounded-lg font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer">1 ก.ค.</button>
          <button onclick="filterDate('2025-07-02')" id="btn-filter-2" class="filter-btn px-2.5 py-1 rounded-lg font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer">2 ก.ค.</button>
          <button onclick="filterDate('2025-07-03')" id="btn-filter-3" class="filter-btn px-2.5 py-1 rounded-lg font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer">3 ก.ค.</button>
          <button onclick="filterDate('2025-07-04')" id="btn-filter-4" class="filter-btn px-2.5 py-1 rounded-lg font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer">4 ก.ค.</button>
          <button onclick="filterDate('2025-07-05')" id="btn-filter-5" class="filter-btn px-2.5 py-1 rounded-lg font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer">5 ก.ค.</button>
          <button onclick="filterDate('24h')" id="btn-filter-24h" class="filter-btn px-2.5 py-1 rounded-lg font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer">24 ชม. ล่าสุด</button>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="switchTab('excel')" class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1">
            <span>📗 แก้ไขตารางใน Excel Online ↗</span>
          </button>
        </div>
      </div>

      <!-- Multi-Unit Trend Chart -->
      <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>แนวโน้มค่า TMP เปรียบเทียบทุกยูนิต (UF No.1 - No.5)</span>
            <span class="text-xs text-slate-500 font-normal">เกณฑ์เตือน: 0.40 bar · เกณฑ์วิกฤต: 0.60 bar</span>
          </h2>
        </div>
        <div class="relative w-full h-[320px]">
          <canvas id="multiUnitChart"></canvas>
        </div>
      </div>

      <!-- Single Unit Detailed Breakdown Chart -->
      <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 class="text-sm font-bold text-slate-900">
            <span>การวิเคราะห์การอุดตันเชิงลึกและอัตราการไหล (Fouling & Flow Analysis)</span>
          </h2>
          <div class="flex items-center gap-1.5">
            <button onclick="selectUnit(0)" id="btnUnit0" class="unit-btn px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white cursor-pointer">UF No.1</button>
            <button onclick="selectUnit(1)" id="btnUnit1" class="unit-btn px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer">UF No.2</button>
            <button onclick="selectUnit(2)" id="btnUnit2" class="unit-btn px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer">UF No.3</button>
            <button onclick="selectUnit(3)" id="btnUnit3" class="unit-btn px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer">UF No.4</button>
            <button onclick="selectUnit(4)" id="btnUnit4" class="unit-btn px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer">UF No.5</button>
          </div>
        </div>
        <div class="relative w-full h-[300px]">
          <canvas id="singleUnitChart"></canvas>
        </div>
      </div>

      <!-- Raw Data Inspection Table -->
      <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-0">
        <div class="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
          <div>
            <h3 class="text-sm font-bold text-slate-900">ตารางข้อมูลดิบและรอบการกรอง SCADA WHA-UP</h3>
            <p class="text-xs text-slate-500 mt-0.5">บันทึกค่าทุก 2 ชั่วโมง 24 นาที ระหว่าง 1/7/25 - 5/7/25</p>
          </div>
          <span class="text-xs font-mono bg-white border border-slate-300 px-2.5 py-1 rounded-md text-slate-700" id="tableRowCount">
            43 รอบการกรอง
          </span>
        </div>
        <div class="overflow-x-auto max-h-[460px] divide-y divide-slate-100 text-xs">
          <table class="w-full text-left font-mono" id="rawDataTable">
            <thead class="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200 text-center">
              <tr>
                <th class="py-2 px-3 text-center">#</th>
                <th class="py-2 px-3 text-left">วันและเวลา (Date/Time)</th>
                <th class="py-2 px-2 text-right">UF-1 TMP</th>
                <th class="py-2 px-2 text-right">UF-1 Flow</th>
                <th class="py-2 px-2 text-right">UF-2 TMP</th>
                <th class="py-2 px-2 text-right">UF-2 Flow</th>
                <th class="py-2 px-2 text-right">UF-3 TMP</th>
                <th class="py-2 px-2 text-right">UF-3 Flow</th>
                <th class="py-2 px-2 text-right">UF-4 TMP</th>
                <th class="py-2 px-2 text-right">UF-4 Flow</th>
                <th class="py-2 px-2 text-right">UF-5 TMP</th>
                <th class="py-2 px-2 text-right">UF-5 Flow</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white" id="rawDataTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- TAB 2: EXCEL ONLINE SPREADSHEET EDITOR     -->
    <!-- ========================================== -->
    <div id="tab-excel" class="tab-content space-y-4">
      <div class="bg-emerald-800 text-white px-5 py-4 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-bold flex items-center gap-2">
            <span>📗 Excel Online – ตารางกรอกและแก้ไขข้อมูลสด</span>
            <span class="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-700 border border-emerald-600">Spreadsheet Live Editor</span>
          </h2>
          <p class="text-xs text-emerald-200 mt-0.5">
            คลิกเพื่อแก้ไขค่า TMP (bar) หรือ Flow (m³/h) ได้สดๆ ทุกช่อง · ระบบคำนวณ Flux (LMH) อัตโนมัติ · บันทึกผลแล้วกราฟอัปเดตทันที
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="saveExcelAndRefresh()" class="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1.5">
            💾 บันทึกและอัปเดตกราฟทันที
          </button>
        </div>
      </div>

      <!-- Spreadsheet Toolbar -->
      <div class="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2 flex-wrap">
          <button onclick="addExcelRow()" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs cursor-pointer flex items-center gap-1">
            ➕ เพิ่มแถวใหม่ (+1)
          </button>
          <button onclick="addExcelRow(5)" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer">
            +5 แถว
          </button>
          <button onclick="openPasteModal()" class="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold cursor-pointer flex items-center gap-1">
            📋 วางจาก Excel (Paste)
          </button>
          <button onclick="exportCsv()" class="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold cursor-pointer flex items-center gap-1">
            📥 ดาวน์โหลดเป็น CSV
          </button>
          <button onclick="resetExcelData()" class="px-3 py-1.5 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer">
            ↺ รีเซ็ตเป็นข้อมูลเดิม (43 รอบ)
          </button>
        </div>
        <span class="text-slate-500 font-mono text-[11px]" id="excelStatusBadge">
          ตารางพร้อมแก้ไข: 43 แถว
        </span>
      </div>

      <!-- Editable Spreadsheet Grid -->
      <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div class="overflow-x-auto max-h-[580px] text-xs">
          <table class="w-full text-left font-mono border-collapse" id="excelGrid">
            <thead class="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-300 shadow-2xs text-center font-sans">
              <tr class="divide-x divide-slate-200">
                <th class="py-2 px-2 bg-slate-200 w-12 font-mono">#</th>
                <th class="py-2 px-3 text-left min-w-36">วันและเวลา (Date/Time)</th>
                <th colspan="3" class="py-1 px-2 bg-blue-50 text-blue-900 border-b border-blue-200">UF No.1</th>
                <th colspan="3" class="py-1 px-2 bg-amber-50 text-amber-900 border-b border-amber-200">UF No.2</th>
                <th colspan="3" class="py-1 px-2 bg-emerald-50 text-emerald-900 border-b border-emerald-200">UF No.3</th>
                <th colspan="3" class="py-1 px-2 bg-red-50 text-red-900 border-b border-red-200">UF No.4</th>
                <th colspan="3" class="py-1 px-2 bg-purple-50 text-purple-900 border-b border-purple-200">UF No.5</th>
                <th class="py-2 px-2 w-16 bg-slate-200">ลบ</th>
              </tr>
              <tr class="divide-x divide-slate-200 text-[11px] text-slate-500 border-b border-slate-300">
                <th class="bg-slate-200"></th>
                <th class="text-left px-3 font-normal">D/M/YYYY H:mm</th>
                <th class="py-1 px-2 bg-blue-50/50">TMP</th><th class="py-1 px-2 bg-blue-50/50">Flow</th><th class="py-1 px-2 bg-blue-100 text-sky-800 font-bold">Flux</th>
                <th class="py-1 px-2 bg-amber-50/50">TMP</th><th class="py-1 px-2 bg-amber-50/50">Flow</th><th class="py-1 px-2 bg-amber-100 text-sky-800 font-bold">Flux</th>
                <th class="py-1 px-2 bg-emerald-50/50">TMP</th><th class="py-1 px-2 bg-emerald-50/50">Flow</th><th class="py-1 px-2 bg-emerald-100 text-sky-800 font-bold">Flux</th>
                <th class="py-1 px-2 bg-red-50/50">TMP</th><th class="py-1 px-2 bg-red-50/50">Flow</th><th class="py-1 px-2 bg-red-100 text-sky-800 font-bold">Flux</th>
                <th class="py-1 px-2 bg-purple-50/50">TMP</th><th class="py-1 px-2 bg-purple-50/50">Flow</th><th class="py-1 px-2 bg-purple-100 text-sky-800 font-bold">Flux</th>
                <th class="bg-slate-200"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white" id="excelGridBody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- TAB 3: FOULING PHYSICS ANIMATION           -->
    <!-- ========================================== -->
    <div id="tab-physics" class="tab-content space-y-6">
      <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>แอนิเมชันฟิสิกส์การอุดตันของเมมเบรน (Membrane Fouling Physics Simulation)</span>
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">
              จำลองกลไกอนุภาคในน้ำดิบ, ชั้นเค้ก (Cake Layer), การอุดตันรูพรุน (Pore Blocking) และผลของการล้างย้อน (Backwash / CIP)
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="triggerBackwash()" class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer">
              🚿 จำลอง Backwash (ล้างย้อน)
            </button>
            <button onclick="triggerCip()" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer">
              🧪 จำลอง CIP (ล้างเคมี)
            </button>
          </div>
        </div>

        <!-- Canvas Container -->
        <div class="relative w-full h-[360px] bg-slate-950 rounded-xl overflow-hidden shadow-inner border border-slate-800">
          <canvas id="physicsCanvas" class="w-full h-full"></canvas>
          <div class="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white px-3 py-2 rounded-lg text-xs space-y-1 font-mono border border-slate-700">
            <div>สถานะการจำลอง: <span id="simStatus" class="font-bold text-emerald-400">กรองน้ำปกติ (Filtration)</span></div>
            <div>ระดับความหนา Cake Layer: <span id="cakeThickness" class="font-bold text-amber-400">0.05 mm</span></div>
            <div>แรงดัน TMP จำลอง: <span id="simTmp" class="font-bold text-blue-400">0.12 bar</span></div>
          </div>
        </div>

        <!-- Controls -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
          <div>
            <label class="text-slate-600 font-semibold block mb-1">ความเร็วการไหลของน้ำดิบ (Feed Flow Rate):</label>
            <input type="range" min="1" max="5" value="3" id="speedSlider" class="w-full cursor-pointer">
          </div>
          <div>
            <label class="text-slate-600 font-semibold block mb-1">ความขุ่น/อนุภาคแขวนลอยในน้ำดิบ (Turbidity):</label>
            <input type="range" min="1" max="10" value="4" id="particleSlider" class="w-full cursor-pointer">
          </div>
          <div class="flex items-end">
            <button onclick="resetPhysics()" class="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors">
              ↺ รีเซ็ตสภาพเยื่อกรองใหม่
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- TAB 4: ENGINEERING SOP & REFERENCE GUIDE   -->
    <!-- ========================================== -->
    <div id="tab-sop" class="tab-content space-y-6">
      <div class="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        <div>
          <h2 class="text-base font-bold text-slate-900">
            คู่มือการปฏิบัติการวิศวกรรม & เกณฑ์การควบคุมเมมเบรน (Standard Operating Procedure)
          </h2>
          <p class="text-xs text-slate-500 mt-1">
            หลักเกณฑ์มาตรฐานการตรวจสอบแรงดันคร่อมเยื่อกรอง (TMP) และการฟื้นฟูฟลักซ์สำหรับโรงผลิตน้ำ WHA-UP
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <!-- Step 1 -->
          <div class="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 space-y-2">
            <div class="font-bold text-emerald-800 text-sm flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">1</span>
              <span>สภาวะเดินระบบปกติ (Normal)</span>
            </div>
            <p class="text-slate-700 leading-relaxed">
              ค่า TMP อยู่ต่ำกว่า <strong>0.40 bar</strong> ฟลักซ์เดินระบบอยู่ระหว่าง 15-25 LMH ดำเนินการล้างย้อน (Backwash) ทุก 20-30 นาที และระบายตะกอนตามรอบปกติ
            </p>
          </div>

          <!-- Step 2 -->
          <div class="border border-amber-200 bg-amber-50/40 rounded-xl p-4 space-y-2">
            <div class="font-bold text-amber-800 text-sm flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs">2</span>
              <span>ขั้นตอน EFM (Enhanced Flux Maint.)</span>
            </div>
            <p class="text-slate-700 leading-relaxed">
              เมื่อ TMP สะสมแตะ <strong>0.40 bar</strong> หรือตามรอบทุก 24-48 ชั่วโมง แช่ล้างด้วยคลอรีน NaOCl 100-200 ppm นาน 15-30 นาที เพื่อกำจัดเมือกไบโอฟิล์มและสารอินทรีย์ที่ผิว
            </p>
          </div>

          <!-- Step 3 -->
          <div class="border border-red-200 bg-red-50/40 rounded-xl p-4 space-y-2">
            <div class="font-bold text-red-800 text-sm flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs">3</span>
              <span>ขั้นตอน CIP (Clean-in-Place)</span>
            </div>
            <p class="text-slate-700 leading-relaxed">
              เมื่อ TMP สูงแตะ <strong>0.60 bar</strong> ต้องหยุดเดินระบบเพื่อ CIP ใหญ่ แช่ล้างด้วยกรด Citric Acid 2% (pH ~2) เพื่อกำจัดตะกรันโลหะ และโซดาไฟ NaOH (pH ~11-12) เพื่อกำจัดสารอินทรีย์ดื้อยา
            </p>
          </div>
        </div>

        <!-- Formulas Table -->
        <div class="border border-slate-200 rounded-xl overflow-hidden">
          <div class="bg-slate-100 px-4 py-2.5 font-bold text-xs text-slate-800 border-b border-slate-200">
            สูตรคำนวณทางวิศวกรรมเมมเบรน
          </div>
          <div class="p-4 bg-slate-50 font-mono text-xs text-slate-700 space-y-2">
            <div>1. Filtration Flux (J): <strong>J = (Q / A) * 1000</strong> [LMH] โดย Q = อัตราการไหล (m³/h), A = พื้นที่ผิวรวม (m²)</div>
            <div>2. Transmembrane Pressure (TMP): <strong>TMP = (P_feed + P_concentrate)/2 - P_permeate</strong> [bar]</div>
            <div>3. Specific Permeability (Lp): <strong>Lp = J / TMP</strong> [LMH/bar]</div>
          </div>
        </div>
      </div>
    </div>

  </main>

  <footer class="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-auto">
    <p class="font-semibold text-slate-700">Developed by: Utility Operation Engineering UOP Team</p>
    <p class="text-[11px] text-slate-400 mt-1">UF Membrane Fouling TMP Control Dashboard · Standalone Single-File Offline Build</p>
  </footer>

  <!-- Modal: Paste text from Excel -->
  <div id="pasteModal" class="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs hidden items-center justify-center p-4">
    <div class="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-200">
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-sm text-slate-900">วางข้อมูลตารางที่คัดลอกจาก Excel / Google Sheets</h3>
        <button onclick="closePasteModal()" class="text-slate-400 hover:text-slate-700 font-bold">&times;</button>
      </div>
      <p class="text-xs text-slate-600">คัดลอกเซลล์จาก Excel (รวมคอลัมน์ วันที่/เวลา, UF-1 TMP, UF-1 Flow ...) แล้วกด Ctrl+V วางที่นี่:</p>
      <textarea id="pasteInput" rows="6" class="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-mono" placeholder="1/7/25 0:00	0.0918	44.66	0.0633	45.88..."></textarea>
      <div class="flex justify-end gap-2 text-xs">
        <button onclick="closePasteModal()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg">ยกเลิก</button>
        <button onclick="applyPastedRows()" class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg">เพิ่มข้อมูลเข้าตาราง</button>
      </div>
    </div>
  </div>

  <!-- JAVASCRIPT LOGIC -->
  <script>
    // Embedded Initial Data
    const rawData = ${safeJsonData};
    const unitColors = ['#2563eb', '#d97706', '#16a34a', '#dc2626', '#9333ea'];
    const totalArea = rawData.totalArea;

    let appData = {
      labels: [...rawData.labels],
      timestamps: [...rawData.timestamps],
      tmp: rawData.tmp.map(arr => [...arr]),
      flow: rawData.flow.map(arr => [...arr])
    };

    let selectedUnitIdx = 0;
    let multiChartInstance = null;
    let singleChartInstance = null;

    // Tab Switching
    function switchTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'text-blue-700', 'shadow-xs', 'font-bold');
        btn.classList.add('text-slate-600');
      });

      document.getElementById('tab-' + tabId).classList.add('active');
      const activeBtn = document.getElementById('nav-' + tabId);
      if (activeBtn) {
        activeBtn.classList.add('bg-white', 'text-blue-700', 'shadow-xs', 'font-bold');
        activeBtn.classList.remove('text-slate-600');
      }

      if (tabId === 'dashboard') {
        renderCharts();
      } else if (tabId === 'excel') {
        renderExcelTable();
      } else if (tabId === 'physics') {
        startPhysics();
      }
    }

    // Filter by Date
    function filterDate(preset) {
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white', 'font-bold');
        b.classList.add('bg-slate-100', 'text-slate-700');
      });

      let indices = [];
      if (preset === 'all') {
        document.getElementById('btn-filter-all').className = 'filter-btn px-2.5 py-1 rounded-lg font-bold bg-blue-600 text-white cursor-pointer';
        indices = appData.labels.map((_, i) => i);
      } else if (preset === '24h') {
        document.getElementById('btn-filter-24h').className = 'filter-btn px-2.5 py-1 rounded-lg font-bold bg-blue-600 text-white cursor-pointer';
        const lastIdx = appData.labels.length - 1;
        indices = Array.from({ length: Math.min(10, appData.labels.length) }, (_, i) => lastIdx - 9 + i).filter(i => i >= 0);
      } else {
        const dayNum = preset.slice(-2);
        const btn = document.getElementById('btn-filter-' + parseInt(dayNum));
        if (btn) btn.className = 'filter-btn px-2.5 py-1 rounded-lg font-bold bg-blue-600 text-white cursor-pointer';
        appData.timestamps.forEach((t, i) => {
          const d = new Date(t).toISOString().slice(0, 10);
          if (d === preset) indices.push(i);
        });
      }

      renderCharts(indices);
    }

    // Render KPI and Table
    function renderKPIs() {
      const c = document.getElementById('kpiContainer');
      c.innerHTML = '';
      appData.tmp.forEach((series, uIdx) => {
        const validTmp = series.filter(v => v !== null && !isNaN(v));
        const curTmp = validTmp.length > 0 ? validTmp[validTmp.length - 1] : 0;
        const maxTmp = validTmp.length > 0 ? Math.max(...validTmp) : 0;
        const flows = appData.flow[uIdx].filter(v => v !== null && !isNaN(v));
        const avgFlow = flows.length > 0 ? flows.reduce((a, b) => a + b, 0) / flows.length : 0;
        const avgFlux = (avgFlow / totalArea) * 1000;

        const isCritical = curTmp >= 0.60;
        const isWarning = curTmp >= 0.40 && !isCritical;
        const statusColor = isCritical ? 'bg-red-50 border-red-300 text-red-700' : isWarning ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700';
        const statusText = isCritical ? 'วิกฤต (CIP)' : isWarning ? 'เฝ้าระวัง' : 'ปกติ';

        c.innerHTML += \`
          <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div class="text-xs font-semibold text-slate-500 mb-1 flex items-center justify-between">
              <span>UF No.\${uIdx + 1}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold border \${statusColor}">\${statusText}</span>
            </div>
            <div class="text-2xl font-bold font-mono text-slate-900 mt-1">
              \${curTmp.toFixed(3)} <span class="text-xs font-normal text-slate-500">bar</span>
            </div>
            <div class="text-[11px] text-slate-500 mt-2 space-y-0.5 border-t border-slate-100 pt-1.5 font-mono">
              <div>Flux: <strong class="text-sky-700">\${avgFlux.toFixed(1)}</strong> LMH</div>
              <div>สูงสุด: <strong>\${maxTmp.toFixed(3)}</strong> bar</div>
            </div>
          </div>
        \`;
      });
    }

    function renderRawTable() {
      const tbody = document.getElementById('rawDataTableBody');
      tbody.innerHTML = '';
      appData.labels.forEach((lbl, i) => {
        tbody.innerHTML += \`
          <tr class="hover:bg-slate-50">
            <td class="py-2 px-3 text-slate-400 text-center">\${i + 1}</td>
            <td class="py-2 px-3 font-semibold text-slate-800">\${lbl}</td>
            <td class="py-2 px-2 text-right">\${appData.tmp[0][i] !== null ? appData.tmp[0][i].toFixed(3) : '-'}</td>
            <td class="py-2 px-2 text-right text-slate-600">\${appData.flow[0][i] !== null ? appData.flow[0][i].toFixed(1) : '-'}</td>
            <td class="py-2 px-2 text-right">\${appData.tmp[1][i] !== null ? appData.tmp[1][i].toFixed(3) : '-'}</td>
            <td class="py-2 px-2 text-right text-slate-600">\${appData.flow[1][i] !== null ? appData.flow[1][i].toFixed(1) : '-'}</td>
            <td class="py-2 px-2 text-right">\${appData.tmp[2][i] !== null ? appData.tmp[2][i].toFixed(3) : '-'}</td>
            <td class="py-2 px-2 text-right text-slate-600">\${appData.flow[2][i] !== null ? appData.flow[2][i].toFixed(1) : '-'}</td>
            <td class="py-2 px-2 text-right">\${appData.tmp[3][i] !== null ? appData.tmp[3][i].toFixed(3) : '-'}</td>
            <td class="py-2 px-2 text-right text-slate-600">\${appData.flow[3][i] !== null ? appData.flow[3][i].toFixed(1) : '-'}</td>
            <td class="py-2 px-2 text-right">\${appData.tmp[4][i] !== null ? appData.tmp[4][i].toFixed(3) : '-'}</td>
            <td class="py-2 px-2 text-right text-slate-600">\${appData.flow[4][i] !== null ? appData.flow[4][i].toFixed(1) : '-'}</td>
          </tr>
        \`;
      });
      document.getElementById('tableRowCount').innerText = appData.labels.length + ' รอบการกรอง';
    }

    // Chart.js Rendering
    function renderCharts(filterIndices = null) {
      renderKPIs();
      renderRawTable();

      const labels = filterIndices ? filterIndices.map(i => appData.labels[i]) : appData.labels;
      const getSeries = (series) => filterIndices ? filterIndices.map(i => series[i]) : series;

      // Multi Unit Chart
      const mCtx = document.getElementById('multiUnitChart').getContext('2d');
      if (multiChartInstance) multiChartInstance.destroy();

      multiChartInstance = new Chart(mCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            ...appData.tmp.map((s, idx) => ({
              label: 'UF No.' + (idx + 1),
              data: getSeries(s),
              borderColor: unitColors[idx],
              backgroundColor: unitColors[idx],
              borderWidth: 2,
              pointRadius: 2,
              tension: 0.2
            })),
            {
              label: 'เกณฑ์เตือน (0.40 bar)',
              data: Array(labels.length).fill(0.40),
              borderColor: '#f59e0b',
              borderWidth: 1.5,
              borderDash: [5, 5],
              pointRadius: 0
            },
            {
              label: 'เกณฑ์วิกฤต (0.60 bar)',
              data: Array(labels.length).fill(0.60),
              borderColor: '#ef4444',
              borderWidth: 1.5,
              borderDash: [5, 5],
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { title: { display: true, text: 'TMP (bar)' }, min: -0.05, max: 0.8 },
            x: { ticks: { maxTicksLimit: 12 } }
          }
        }
      });

      renderSingleUnit(selectedUnitIdx, filterIndices);
    }

    function renderSingleUnit(unitIdx, filterIndices = null) {
      const sCtx = document.getElementById('singleUnitChart').getContext('2d');
      if (singleChartInstance) singleChartInstance.destroy();

      const labels = filterIndices ? filterIndices.map(i => appData.labels[i]) : appData.labels;
      const getSeries = (series) => filterIndices ? filterIndices.map(i => series[i]) : series;

      singleChartInstance = new Chart(sCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'TMP (bar) - UF No.' + (unitIdx + 1),
              data: getSeries(appData.tmp[unitIdx]),
              borderColor: unitColors[unitIdx],
              backgroundColor: unitColors[unitIdx] + '22',
              fill: true,
              borderWidth: 2.5,
              tension: 0.2,
              yAxisID: 'y'
            },
            {
              label: 'Flow (m³/h)',
              data: getSeries(appData.flow[unitIdx]),
              borderColor: '#94a3b8',
              borderWidth: 1.5,
              borderDash: [3, 3],
              pointRadius: 0,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { title: { display: true, text: 'TMP (bar)' }, min: -0.05, max: 0.8 },
            y1: { position: 'right', title: { display: true, text: 'Flow (m³/h)' }, grid: { drawOnChartArea: false } },
            x: { ticks: { maxTicksLimit: 12 } }
          }
        }
      });
    }

    function selectUnit(idx) {
      selectedUnitIdx = idx;
      for (let i = 0; i < 5; i++) {
        const btn = document.getElementById('btnUnit' + i);
        if (i === idx) {
          btn.className = 'unit-btn px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white cursor-pointer';
        } else {
          btn.className = 'unit-btn px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer';
        }
      }
      renderSingleUnit(idx);
    }

    // ========================================================
    // EXCEL ONLINE SPREADSHEET LOGIC
    // ========================================================
    function renderExcelTable() {
      const tbody = document.getElementById('excelGridBody');
      tbody.innerHTML = '';
      appData.labels.forEach((lbl, rIdx) => {
        let tr = document.createElement('tr');
        tr.className = 'divide-x divide-slate-200 hover:bg-emerald-50/20';

        const u1_flux = appData.flow[0][rIdx] ? ((appData.flow[0][rIdx] / totalArea) * 1000).toFixed(1) : '-';
        const u2_flux = appData.flow[1][rIdx] ? ((appData.flow[1][rIdx] / totalArea) * 1000).toFixed(1) : '-';
        const u3_flux = appData.flow[2][rIdx] ? ((appData.flow[2][rIdx] / totalArea) * 1000).toFixed(1) : '-';
        const u4_flux = appData.flow[3][rIdx] ? ((appData.flow[3][rIdx] / totalArea) * 1000).toFixed(1) : '-';
        const u5_flux = appData.flow[4][rIdx] ? ((appData.flow[4][rIdx] / totalArea) * 1000).toFixed(1) : '-';

        tr.innerHTML = \`
          <td class="py-1 px-2 text-center bg-slate-100 font-mono text-[11px] text-slate-500">\${rIdx + 1}</td>
          <td class="py-1 px-2 font-mono"><input type="text" value="\${lbl}" onchange="updateCell(\${rIdx}, 'label', this.value)" class="cell-input"></td>

          <!-- UF-1 -->
          <td class="py-1 px-1.5"><input type="number" step="0.0001" value="\${appData.tmp[0][rIdx] ?? ''}" onchange="updateCell(\${rIdx}, 'u1_tmp', this.value)" class="cell-input text-right"></td>
          <td class="py-1 px-1.5"><input type="number" step="0.01" value="\${appData.flow[0][rIdx] ?? ''}" onchange="updateCell(\${rIdx}, 'u1_flow', this.value)" class="cell-input text-right"></td>
          <td class="py-1 px-1.5 text-right font-bold text-sky-800 bg-blue-50/40" id="flux-0-\${rIdx}">\${u1_flux}</td>

          <!-- UF-2 -->
          <td class="py-1 px-1.5"><input type="number" step="0.0001" value="\${appData.tmp[1][rIdx] ?? ''}" onchange="updateCell(\${rIdx}, 'u2_tmp', this.value)" class="cell-input text-right"></td>
          <td class="py-1 px-1.5"><input type="number" step="0.01" value="\${appData.flow[1][rIdx] ?? ''}" onchange="updateCell(\${rIdx}, 'u2_flow', this.value)" class="cell-input text-right"></td>
          <td class="py-1 px-1.5 text-right font-bold text-sky-800 bg-amber-50/40" id="flux-1-\${rIdx}">\${u2_flux}</td>

          <!-- UF-3 -->
          <td class="py-1 px-1.5"><input type="number" step="0.0001" value="\${appData.tmp[2][rIdx] ?? ''}" onchange="updateCell(\${rIdx}, 'u3_tmp', this.value)" class="cell-input text-right"></td>
          <td class="py-1 px-1.5"><input type="number" step="0.01" value="\${appData.flow[2][rIdx] ?? ''}" onchange="updateCell(\${rIdx}, 'u3_flow', this.value)" class="cell-input text-right"></td>
          <td class="py-1 px-1.5 text-right font-bold text-sky-800 bg-emerald-50/40" id="flux-2-\${rIdx}">\${u3_flux}</td>

          <!-- UF-4 -->
          <td class="py-1 px-1.5"><input type="number" step="0.0001" value="\${appData.tmp[3][rIdx] ?? ''}" onchange="updateCell(\${rIdx}, 'u4_tmp', this.value)" class="cell-input text-right"></td>
          <td class="py-1 px-1.5"><input type="number" step="0.01" value="\${appData.flow[3][rIdx] ?? ''}" onchange="updateCell(\${rIdx}, 'u4_flow', this.value)" class="cell-input text-right"></td>
          <td class="py-1 px-1.5 text-right font-bold text-sky-800 bg-red-50/40" id="flux-3-\${rIdx}">\${u4_flux}</td>

          <!-- UF-5 -->
          <td class="py-1 px-1.5"><input type="number" step="0.0001" value="\${appData.tmp[4][rIdx] ?? ''}" onchange="updateCell(\${rIdx}, 'u5_tmp', this.value)" class="cell-input text-right"></td>
          <td class="py-1 px-1.5"><input type="number" step="0.01" value="\${appData.flow[4][rIdx] ?? ''}" onchange="updateCell(\${rIdx}, 'u5_flow', this.value)" class="cell-input text-right"></td>
          <td class="py-1 px-1.5 text-right font-bold text-sky-800 bg-purple-50/40" id="flux-4-\${rIdx}">\${u5_flux}</td>

          <td class="py-1 px-1 text-center bg-slate-50"><button onclick="deleteExcelRow(\${rIdx})" class="text-red-500 hover:text-red-700 font-bold px-1.5">&times;</button></td>
        \`;
        tbody.appendChild(tr);
      });
      document.getElementById('excelStatusBadge').innerText = 'ตารางพร้อมแก้ไข: ' + appData.labels.length + ' แถว';
    }

    function updateCell(rIdx, field, val) {
      if (field === 'label') {
        appData.labels[rIdx] = val;
      } else {
        const num = val === '' ? null : parseFloat(val);
        const map = {
          u1_tmp: [0, 'tmp'], u1_flow: [0, 'flow'],
          u2_tmp: [1, 'tmp'], u2_flow: [1, 'flow'],
          u3_tmp: [2, 'tmp'], u3_flow: [2, 'flow'],
          u4_tmp: [3, 'tmp'], u4_flow: [3, 'flow'],
          u5_tmp: [4, 'tmp'], u5_flow: [4, 'flow']
        };
        const [uIdx, type] = map[field];
        appData[type][uIdx][rIdx] = num;

        // Auto update flux
        if (type === 'flow') {
          const fluxEl = document.getElementById('flux-' + uIdx + '-' + rIdx);
          if (fluxEl) {
            fluxEl.innerText = num !== null ? ((num / totalArea) * 1000).toFixed(1) : '-';
          }
        }
      }
    }

    function addExcelRow(count = 1) {
      for (let i = 0; i < count; i++) {
        const nextIdx = appData.labels.length + 1;
        appData.labels.push('รอบที่ ' + nextIdx);
        appData.timestamps.push(Date.now() + nextIdx * 86400000);
        for (let u = 0; u < 5; u++) {
          appData.tmp[u].push(0.08);
          appData.flow[u].push(45.0);
        }
      }
      renderExcelTable();
    }

    function deleteExcelRow(rIdx) {
      appData.labels.splice(rIdx, 1);
      appData.timestamps.splice(rIdx, 1);
      for (let u = 0; u < 5; u++) {
        appData.tmp[u].splice(rIdx, 1);
        appData.flow[u].splice(rIdx, 1);
      }
      renderExcelTable();
    }

    function saveExcelAndRefresh() {
      renderCharts();
      alert('บันทึกข้อมูลเรียบร้อย! กราฟและค่าสรุปอัปเดตตรงตามตารางสดแล้ว');
      switchTab('dashboard');
    }

    function resetExcelData() {
      if (confirm('ต้องการคืนค่าเริ่มต้น 43 รอบการกรองใช่หรือไม่?')) {
        appData = {
          labels: [...rawData.labels],
          timestamps: [...rawData.timestamps],
          tmp: rawData.tmp.map(arr => [...arr]),
          flow: rawData.flow.map(arr => [...arr])
        };
        renderExcelTable();
        renderCharts();
      }
    }

    function exportCsv() {
      let csv = 'No,Date_Time,UF1_TMP,UF1_Flow,UF2_TMP,UF2_Flow,UF3_TMP,UF3_Flow,UF4_TMP,UF4_Flow,UF5_TMP,UF5_Flow\\n';
      appData.labels.forEach((lbl, i) => {
        csv += [
          i + 1,
          '"' + lbl + '"',
          appData.tmp[0][i], appData.flow[0][i],
          appData.tmp[1][i], appData.flow[1][i],
          appData.tmp[2][i], appData.flow[2][i],
          appData.tmp[3][i], appData.flow[3][i],
          appData.tmp[4][i], appData.flow[4][i]
        ].join(',') + '\\n';
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'UF_Membrane_Data.csv';
      a.click();
    }

    function openPasteModal() {
      document.getElementById('pasteModal').classList.remove('hidden');
      document.getElementById('pasteModal').classList.add('flex');
    }
    function closePasteModal() {
      document.getElementById('pasteModal').classList.add('hidden');
      document.getElementById('pasteModal').classList.remove('flex');
    }

    function applyPastedRows() {
      const text = document.getElementById('pasteInput').value.trim();
      if (!text) return;
      const lines = text.split(/\\r?\\n/).filter(l => l.trim().length > 0);
      lines.forEach(line => {
        const parts = line.includes('\\t') ? line.split('\\t') : line.split(',');
        if (parts.length >= 2) {
          appData.labels.push(parts[0].trim());
          appData.timestamps.push(Date.now());
          appData.tmp[0].push(parseFloat(parts[1]) || 0);
          appData.flow[0].push(parseFloat(parts[2]) || 0);
          appData.tmp[1].push(parseFloat(parts[3]) || 0);
          appData.flow[1].push(parseFloat(parts[4]) || 0);
          appData.tmp[2].push(parseFloat(parts[5]) || 0);
          appData.flow[2].push(parseFloat(parts[6]) || 0);
          appData.tmp[3].push(parseFloat(parts[7]) || 0);
          appData.flow[3].push(parseFloat(parts[8]) || 0);
          appData.tmp[4].push(parseFloat(parts[9]) || 0);
          appData.flow[4].push(parseFloat(parts[10]) || 0);
        }
      });
      closePasteModal();
      renderExcelTable();
      alert('เพิ่ม ' + lines.length + ' แถวเรียบร้อย!');
    }

    // ========================================================
    // CANVAS FOULING PHYSICS SIMULATION
    // ========================================================
    let canvas, ctx, animId;
    let particles = [];
    let cakeLayerThickness = 12;
    let isCleaning = false;
    let cleaningTimer = 0;

    function initPhysics() {
      canvas = document.getElementById('physicsCanvas');
      if (!canvas) return;
      ctx = canvas.getContext('2d');
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;

      particles = [];
      for (let i = 0; i < 60; i++) {
        particles.push({
          x: Math.random() * (canvas.width * 0.65),
          y: Math.random() * canvas.height,
          vx: Math.random() * 2 + 1,
          vy: (Math.random() - 0.5) * 0.8,
          radius: Math.random() * 3 + 2,
          color: Math.random() > 0.4 ? '#f59e0b' : '#38bdf8'
        });
      }
    }

    function animatePhysics() {
      if (!canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const memX = canvas.width * 0.7;

      // Draw Feed Stream (Left)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, memX, canvas.height);

      // Draw Permeate Stream (Right)
      ctx.fillStyle = '#0369a1';
      ctx.fillRect(memX, 0, canvas.width - memX, canvas.height);

      // Draw Membrane Hollow Fiber Wall
      ctx.fillStyle = '#64748b';
      ctx.fillRect(memX, 0, 36, canvas.height);

      // Pores
      ctx.fillStyle = '#0284c7';
      for (let y = 15; y < canvas.height; y += 30) {
        ctx.fillRect(memX, y, 36, 12);
      }

      // Cake Layer on Membrane Surface
      if (cakeLayerThickness > 0) {
        ctx.fillStyle = '#b45309';
        ctx.fillRect(memX - cakeLayerThickness, 0, cakeLayerThickness, canvas.height);
      }

      // Draw Particles
      const speed = parseFloat(document.getElementById('speedSlider')?.value || 3);
      particles.forEach(p => {
        if (!isCleaning) {
          p.x += p.vx * (speed / 2.5);
          p.y += p.vy;

          if (p.x >= memX - cakeLayerThickness - p.radius) {
            p.x = Math.random() * 40;
            p.y = Math.random() * canvas.height;
            if (cakeLayerThickness < 30) cakeLayerThickness += 0.08;
          }
        } else {
          // Backwash: Water pushes backwards!
          p.x -= 4;
          if (p.x < 0) p.x = canvas.width * 0.6;
        }

        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      });

      // Update gauges
      if (isCleaning) {
        cleaningTimer--;
        cakeLayerThickness = Math.max(0, cakeLayerThickness - 0.4);
        if (cleaningTimer <= 0) {
          isCleaning = false;
          document.getElementById('simStatus').innerText = 'กรองน้ำปกติ (Filtration)';
          document.getElementById('simStatus').className = 'font-bold text-emerald-400';
        }
      }

      const mm = (cakeLayerThickness / 30 * 0.15).toFixed(3);
      const estTmp = (0.09 + (cakeLayerThickness / 30) * 0.55).toFixed(2);
      if (document.getElementById('cakeThickness')) document.getElementById('cakeThickness').innerText = mm + ' mm';
      if (document.getElementById('simTmp')) document.getElementById('simTmp').innerText = estTmp + ' bar';

      animId = requestAnimationFrame(animatePhysics);
    }

    function startPhysics() {
      if (!canvas) initPhysics();
      if (!animId) animatePhysics();
    }

    function triggerBackwash() {
      isCleaning = true;
      cleaningTimer = 90;
      document.getElementById('simStatus').innerText = 'กำลังล้างย้อน (Backwash)...';
      document.getElementById('simStatus').className = 'font-bold text-sky-400';
    }

    function triggerCip() {
      isCleaning = true;
      cleaningTimer = 160;
      cakeLayerThickness = 2;
      document.getElementById('simStatus').innerText = 'กำลังล้างเคมี CIP (Chemical Clean)...';
      document.getElementById('simStatus').className = 'font-bold text-amber-400';
    }

    function resetPhysics() {
      cakeLayerThickness = 6;
      isCleaning = false;
      document.getElementById('simStatus').innerText = 'กรองน้ำปกติ (Filtration)';
      document.getElementById('simStatus').className = 'font-bold text-emerald-400';
    }

    // Window Load Init
    window.addEventListener('load', () => {
      renderCharts();
    });
  </script>
</body>
</html>`;
}

export function downloadStandaloneHtmlFile(
  dataset: ProcessedDataset,
  params: MembraneParameters,
  analyses: UnitAnalysis[],
  filename = 'UF_Fouling_Dashboard_Full.html'
): void {
  const htmlContent = generateStandaloneHtml(dataset, params, analyses);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

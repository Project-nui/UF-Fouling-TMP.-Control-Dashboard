import { ProcessedDataset } from '../data/initialData';
import { MembraneParameters, UnitAnalysis, formatDateTime, formatNumber } from './membraneCalculations';

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
  <title>UF Fouling TMP. Control Dashboard - WHA-UP Analysis</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Prompt', system-ui, -apple-system, sans-serif; }
    .font-mono { font-family: 'Plus Jakarta Sans', monospace; }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen">

  <!-- Header -->
  <header class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
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
      <div class="flex items-center gap-2 text-xs">
        <span class="bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold px-3 py-1.5 rounded-lg">
          ● ข้อมูล SCADA WHA-UP (43 รอบการกรอง)
        </span>
        <button onclick="window.print()" class="bg-slate-800 hover:bg-slate-900 text-white font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors">
          พิมพ์ / บันทึก PDF
        </button>
      </div>
    </div>
  </header>

  <!-- Main Container -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

    <!-- KPI Summary Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
      ${analyses.map((u, i) => {
        const isCritical = u.currentTmp !== null && u.currentTmp >= params.criticalTmp;
        const isWarning = u.currentTmp !== null && u.currentTmp >= params.warningTmp && !isCritical;
        const statusColor = isCritical ? 'bg-red-50 border-red-300 text-red-700' : isWarning ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700';
        const statusText = isCritical ? 'วิกฤต (CIP ด่วน)' : isWarning ? 'เฝ้าระวัง' : 'ปกติ';

        return `
        <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div class="text-xs font-semibold text-slate-500 mb-1 flex items-center justify-between">
            <span>UF No.${i + 1}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${statusColor}">${statusText}</span>
          </div>
          <div class="text-2xl font-bold font-mono text-slate-900 mt-1">
            ${u.currentTmp !== null ? u.currentTmp.toFixed(3) : '-'} <span class="text-xs font-normal text-slate-500">bar</span>
          </div>
          <div class="text-[11px] text-slate-500 mt-2 space-y-0.5 border-t border-slate-100 pt-1.5 font-mono">
            <div>Flux: <strong class="text-sky-700">${u.avgFlux !== null ? u.avgFlux.toFixed(1) : '-'}</strong> LMH</div>
            <div>สูงสุด: <strong>${u.maxTmp !== null && !isNaN(u.maxTmp) ? u.maxTmp.toFixed(3) : '-'}</strong> bar</div>
          </div>
        </div>
        `;
      }).join('')}
    </div>

    <!-- Multi-Unit Trend Chart -->
    <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
          <span>แนวโน้มค่า TMP เปรียบเทียบทุกยูนิต (UF No.1 - No.5)</span>
          <span class="text-xs text-slate-500 font-normal">เกณฑ์เตือน: ${params.warningTmp} bar · เกณฑ์วิกฤต: ${params.criticalTmp} bar</span>
        </h2>
      </div>
      <div class="relative w-full h-[320px]">
        <canvas id="multiUnitChart"></canvas>
      </div>
    </div>

    <!-- Single Unit Detailed Breakdown Chart -->
    <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
          <span>การวิเคราะห์การอุดตันเชิงลึก (Fouling Analysis)</span>
        </h2>
        <div class="flex items-center gap-1.5" id="unitTabsContainer">
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

    <!-- Raw Data Inspection Table (43 rows) -->
    <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-0">
      <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div>
          <h3 class="text-sm font-bold text-slate-900">ตารางข้อมูลดิบและรอบการกรอง SCADA WHA-UP (43 รอบ)</h3>
          <p class="text-xs text-slate-500 mt-0.5">บันทึกค่าทุก 2 ชั่วโมง 24 นาที ระหว่าง 1/7/25 - 5/7/25</p>
        </div>
        <span class="text-xs font-mono bg-white border border-slate-300 px-2.5 py-1 rounded-md text-slate-700">
          43 รอบการกรอง
        </span>
      </div>

      <div class="overflow-x-auto max-h-[460px] divide-y divide-slate-100 text-xs">
        <table class="w-full text-left font-mono">
          <thead class="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200">
            <tr>
              <th class="py-2.5 px-3">#</th>
              <th class="py-2.5 px-3">วันและเวลา (Date/Time)</th>
              <th class="py-2.5 px-3 text-right">UF-1 TMP</th>
              <th class="py-2.5 px-3 text-right">UF-1 Flow</th>
              <th class="py-2.5 px-3 text-right">UF-2 TMP</th>
              <th class="py-2.5 px-3 text-right">UF-2 Flow</th>
              <th class="py-2.5 px-3 text-right">UF-3 TMP</th>
              <th class="py-2.5 px-3 text-right">UF-3 Flow</th>
              <th class="py-2.5 px-3 text-right">UF-4 TMP</th>
              <th class="py-2.5 px-3 text-right">UF-4 Flow</th>
              <th class="py-2.5 px-3 text-right">UF-5 TMP</th>
              <th class="py-2.5 px-3 text-right">UF-5 Flow</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 bg-white">
            ${dataset.timestamps.map((t, i) => `
              <tr class="hover:bg-slate-50">
                <td class="py-2 px-3 text-slate-400 text-center">${i + 1}</td>
                <td class="py-2 px-3 font-semibold text-slate-800">${formatDateTime(t)}</td>
                <td class="py-2 px-3 text-right ${dataset.tmp[0][i] && dataset.tmp[0][i]! >= params.criticalTmp ? 'text-red-600 font-bold' : ''}">${dataset.tmp[0][i] !== null ? dataset.tmp[0][i]!.toFixed(3) : '-'}</td>
                <td class="py-2 px-3 text-right text-slate-600">${dataset.flow[0][i] !== null ? dataset.flow[0][i]!.toFixed(1) : '-'}</td>
                <td class="py-2 px-3 text-right ${dataset.tmp[1][i] && dataset.tmp[1][i]! >= params.criticalTmp ? 'text-red-600 font-bold' : ''}">${dataset.tmp[1][i] !== null ? dataset.tmp[1][i]!.toFixed(3) : '-'}</td>
                <td class="py-2 px-3 text-right text-slate-600">${dataset.flow[1][i] !== null ? dataset.flow[1][i]!.toFixed(1) : '-'}</td>
                <td class="py-2 px-3 text-right">${dataset.tmp[2][i] !== null ? dataset.tmp[2][i]!.toFixed(3) : '-'}</td>
                <td class="py-2 px-3 text-right text-slate-600">${dataset.flow[2][i] !== null ? dataset.flow[2][i]!.toFixed(1) : '-'}</td>
                <td class="py-2 px-3 text-right">${dataset.tmp[3][i] !== null ? dataset.tmp[3][i]!.toFixed(3) : '-'}</td>
                <td class="py-2 px-3 text-right text-slate-600">${dataset.flow[3][i] !== null ? dataset.flow[3][i]!.toFixed(1) : '-'}</td>
                <td class="py-2 px-3 text-right">${dataset.tmp[4][i] !== null ? dataset.tmp[4][i]!.toFixed(3) : '-'}</td>
                <td class="py-2 px-3 text-right text-slate-600">${dataset.flow[4][i] !== null ? dataset.flow[4][i]!.toFixed(1) : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Engineering SOP Summary -->
    <div class="bg-blue-50/70 border border-blue-200 rounded-xl p-5 text-xs text-blue-900 space-y-2">
      <div class="font-bold text-sm text-blue-950 flex items-center gap-2">
        <span>คู่มือเกณฑ์ปฏิบัติการวิศวกรรม (Engineering SOP Guidelines)</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
        <div class="bg-white p-3 rounded-lg border border-blue-200">
          <div class="font-bold text-emerald-700">1. การเดินระบบปกติ (Normal)</div>
          <p class="text-slate-600 text-[11px] mt-1 leading-relaxed">TMP ต่ำกว่า ${params.warningTmp} bar โดยแรงดันเสถียรและฟลักซ์อยู่ระหว่าง 15-25 LMH</p>
        </div>
        <div class="bg-white p-3 rounded-lg border border-amber-200">
          <div class="font-bold text-amber-700">2. ขั้นตอน EFM (Enhanced Flux Maint.)</div>
          <p class="text-slate-600 text-[11px] mt-1 leading-relaxed">ดำเนินการเมื่อ TMP เพิ่มขึ้นแตะ ${params.warningTmp} bar หรือล้างตามรอบทุก 24-48 ชั่วโมง ด้วย NaOCl 100-200 ppm</p>
        </div>
        <div class="bg-white p-3 rounded-lg border border-red-200">
          <div class="font-bold text-red-700">3. ขั้นตอน CIP (Clean-in-Place)</div>
          <p class="text-slate-600 text-[11px] mt-1 leading-relaxed">ดำเนินการทันทีเมื่อ TMP แตะ ${params.criticalTmp} bar แช่ล้างกรด Citric Acid 2% (กำจัดตะกรัน) และด่าง NaOH (กำจัดสารอินทรีย์)</p>
        </div>
      </div>
    </div>

  </main>

  <footer class="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-8">
    <p>Developed by: Utility Operation Engineering UOP Team</p>
    <p class="text-[11px] text-slate-400 mt-1">UF Membrane Fouling Control Dashboard (Standalone Offline HTML Build)</p>
  </footer>

  <script>
    const data = ${safeJsonData};
    const unitColors = ['#2563eb', '#d97706', '#16a34a', '#dc2626', '#9333ea'];
    let selectedUnitIdx = 0;
    let singleChartInstance = null;

    // Multi-Unit Trend Chart
    const multiCtx = document.getElementById('multiUnitChart').getContext('2d');
    new Chart(multiCtx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          ...data.tmp.map((series, uIdx) => ({
            label: 'UF No.' + (uIdx + 1),
            data: series,
            borderColor: unitColors[uIdx],
            backgroundColor: unitColors[uIdx],
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.2
          })),
          {
            label: 'เกณฑ์เตือน (' + data.warningTmp + ' bar)',
            data: Array(data.labels.length).fill(data.warningTmp),
            borderColor: '#f59e0b',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          },
          {
            label: 'เกณฑ์วิกฤต (' + data.criticalTmp + ' bar)',
            data: Array(data.labels.length).fill(data.criticalTmp),
            borderColor: '#ef4444',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
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

    // Single Unit Detailed Chart
    function renderSingleUnit(unitIdx) {
      const ctx = document.getElementById('singleUnitChart').getContext('2d');
      const unitTmp = data.tmp[unitIdx];
      const unitFlow = data.flow[unitIdx];

      if (singleChartInstance) {
        singleChartInstance.destroy();
      }

      singleChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [
            {
              label: 'TMP (bar) - UF No.' + (unitIdx + 1),
              data: unitTmp,
              borderColor: unitColors[unitIdx],
              backgroundColor: unitColors[unitIdx] + '22',
              fill: true,
              borderWidth: 2.5,
              tension: 0.2,
              yAxisID: 'y'
            },
            {
              label: 'Flow (m³/h)',
              data: unitFlow,
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

    // Init first unit
    renderSingleUnit(0);
  </script>
</body>
</html>`;
}

export function downloadStandaloneHtmlFile(
  dataset: ProcessedDataset,
  params: MembraneParameters,
  analyses: UnitAnalysis[],
  filename = 'UF_Fouling_Dashboard_Standalone.html'
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

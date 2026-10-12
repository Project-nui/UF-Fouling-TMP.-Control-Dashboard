import React, { useState, useMemo } from 'react';
import { ProcessedDataset } from '../data/initialData';
import { UnitAnalysis, formatDateTime, formatNumber } from '../utils/membraneCalculations';
import { Table, Search, ChevronLeft, ChevronRight, CheckCircle2, FileSpreadsheet, Eye, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';

interface RawDataInspectionTableProps {
  dataset: ProcessedDataset;
  analyses: UnitAnalysis[];
  timeRangeStart: number;
  timeRangeEnd: number;
  params: { modulesCount: number; areaPerModule: number };
  onDeleteRow?: (timestamp: number) => void;
  onDeleteSelectedRows?: (timestamps: number[]) => void;
  onClearFilteredRows?: () => void;
  onResetDataset?: () => void;
  onOpenExcelOnline?: () => void;
}

export const RawDataInspectionTable: React.FC<RawDataInspectionTableProps> = ({
  dataset,
  analyses,
  timeRangeStart,
  timeRangeEnd,
  params,
  onDeleteRow,
  onDeleteSelectedRows,
  onClearFilteredRows,
  onResetDataset,
  onOpenExcelOnline
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [showOnlyInRange, setShowOnlyInRange] = useState(false);
  const [selectedTimestamps, setSelectedTimestamps] = useState<Set<number>>(new Set());
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    type: 'single' | 'selected' | 'range' | 'all';
    targetTs?: number;
    count?: number;
  }>({ isOpen: false, type: 'single' });

  const totalArea = params.modulesCount * params.areaPerModule;

  // Build row objects
  const allRows = useMemo(() => {
    return dataset.timestamps.map((t, idx) => {
      const inRange = t >= timeRangeStart && t <= timeRangeEnd;
      const formattedDate = formatDateTime(t);

      const unitData = dataset.tmp.map((uTmp, uIdx) => {
        const tmpVal = uTmp[idx];
        const flowVal = dataset.flow[uIdx] ? dataset.flow[uIdx][idx] : null;
        let fluxVal: number | null = null;
        if (flowVal !== null && flowVal !== undefined && totalArea > 0) {
          fluxVal = (flowVal / totalArea) * 1000;
        }
        return {
          tmp: tmpVal,
          flow: flowVal,
          flux: fluxVal
        };
      });

      return {
        rowNumber: idx + 1,
        timestamp: t,
        dateTimeStr: formattedDate,
        inRange,
        units: unitData
      };
    });
  }, [dataset, timeRangeStart, timeRangeEnd, totalArea]);

  // Filter rows
  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (showOnlyInRange) {
      rows = rows.filter(r => r.inRange);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      rows = rows.filter(r => r.dateTimeStr.toLowerCase().includes(q) || String(r.rowNumber).includes(q));
    }
    return rows;
  }, [allRows, showOnlyInRange, searchTerm]);

  // Pagination
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredRows.length / pageSize);
  const paginatedRows = useMemo(() => {
    if (pageSize === 0) return filteredRows;
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Selection helpers
  const handleToggleSelectRow = (ts: number) => {
    setSelectedTimestamps(prev => {
      const next = new Set(prev);
      if (next.has(ts)) {
        next.delete(ts);
      } else {
        next.add(ts);
      }
      return next;
    });
  };

  const handleSelectAllCurrentPage = () => {
    const allSelected = paginatedRows.every(r => selectedTimestamps.has(r.timestamp));
    setSelectedTimestamps(prev => {
      const next = new Set(prev);
      if (allSelected) {
        paginatedRows.forEach(r => next.delete(r.timestamp));
      } else {
        paginatedRows.forEach(r => next.add(r.timestamp));
      }
      return next;
    });
  };

  const isAllCurrentPageSelected =
    paginatedRows.length > 0 && paginatedRows.every(r => selectedTimestamps.has(r.timestamp));

  const executeDeleteAction = () => {
    if (confirmDeleteModal.type === 'single' && confirmDeleteModal.targetTs !== undefined) {
      if (onDeleteRow) {
        onDeleteRow(confirmDeleteModal.targetTs);
        setSelectedTimestamps(prev => {
          const next = new Set(prev);
          next.delete(confirmDeleteModal.targetTs!);
          return next;
        });
      }
    } else if (confirmDeleteModal.type === 'selected') {
      if (onDeleteSelectedRows) {
        onDeleteSelectedRows(Array.from(selectedTimestamps));
        setSelectedTimestamps(new Set());
      }
    } else if (confirmDeleteModal.type === 'range') {
      if (onClearFilteredRows) {
        onClearFilteredRows();
        setSelectedTimestamps(new Set());
      }
    } else if (confirmDeleteModal.type === 'all') {
      if (onResetDataset) {
        onResetDataset();
        setSelectedTimestamps(new Set());
      }
    }
    setConfirmDeleteModal({ isOpen: false, type: 'single' });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4 relative">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Table className="w-4 h-4 text-blue-600" />
              <span>ตารางตรวจสอบและจัดการข้อมูลดิบ (Data Inspection &amp; Management)</span>
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              คงเหลือ {dataset.timestamps.length.toLocaleString()} แถว
            </span>
            {selectedTimestamps.size > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                เลือกอยู่ {selectedTimestamps.size} แถว
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            ตรวจสอบข้อมูลดิบทุกจุดที่นำเข้า สามารถเลือกลบแถวที่ผิดปกติ, ลบหลายแถวพร้อมกัน หรือลบข้อมูลช่วงที่เลือกได้ทันที
          </p>
        </div>

        {/* Delete Batch Controls & Search */}
        <div className="flex items-center gap-2 flex-wrap">
          {selectedTimestamps.size > 0 && onDeleteSelectedRows && (
            <button
              type="button"
              onClick={() =>
                setConfirmDeleteModal({
                  isOpen: true,
                  type: 'selected',
                  count: selectedTimestamps.size
                })
              }
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              title="ลบแถวที่เลือกไว้ทั้งหมด"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ลบแถวที่เลือก ({selectedTimestamps.size})</span>
            </button>
          )}

          {showOnlyInRange && onClearFilteredRows && filteredRows.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setConfirmDeleteModal({
                  isOpen: true,
                  type: 'range',
                  count: filteredRows.length
                })
              }
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer flex items-center gap-1"
              title="ลบข้อมูลทั้งหมดที่อยู่ในช่วงเวลาที่กำลังกรองอยู่นี้"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>ลบข้อมูลช่วงนี้ ({filteredRows.length})</span>
            </button>
          )}

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="ค้นหาวันที่/เวลา..."
              className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-blue-500 w-36 sm:w-44"
            />
          </div>

          <button
            onClick={() => {
              setShowOnlyInRange(!showOnlyInRange);
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
              showOnlyInRange
                ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>{showOnlyInRange ? 'เฉพาะช่วงที่เลือก' : 'แสดงทั้งหมดทุกช่วง'}</span>
          </button>

          <select
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 cursor-pointer"
          >
            <option value={15}>15 แถว/หน้า</option>
            <option value={30}>30 แถว/หน้า</option>
            <option value={50}>50 แถว/หน้า</option>
            <option value={0}>แสดงทั้งหมด ({dataset.timestamps.length})</option>
          </select>

          {onOpenExcelOnline && (
            <button
              type="button"
              onClick={onOpenExcelOnline}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="เปิดแก้ไขตารางข้อมูลในระบบ Excel Online"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>แก้ไขใน Excel Online ↗</span>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmDeleteModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ยืนยันการลบข้อมูล</h3>
                <p className="text-xs text-slate-500">การดำเนินการนี้จะตัดข้อมูลออกจากชุดที่กำลังวิเคราะห์</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              {confirmDeleteModal.type === 'single' && (
                <span>
                  ต้องการลบข้อมูลแถววันที่{' '}
                  <strong className="text-slate-900 font-mono">
                    {confirmDeleteModal.targetTs ? formatDateTime(confirmDeleteModal.targetTs) : ''}
                  </strong>{' '}
                  ใช่หรือไม่? กราฟและการคำนวณทั้งหมดจะอัปเดตใหม่ทันที
                </span>
              )}
              {confirmDeleteModal.type === 'selected' && (
                <span>
                  ต้องการลบแถวที่เลือกไว้ทั้งหมดจำนวน{' '}
                  <strong className="text-red-600">{confirmDeleteModal.count} แถว</strong>{' '}
                  ออกจากชุดข้อมูลใช่หรือไม่?
                </span>
              )}
              {confirmDeleteModal.type === 'range' && (
                <span>
                  ต้องการลบข้อมูลทั้งหมดที่อยู่ในช่วงเวลานี้จำนวน{' '}
                  <strong className="text-red-600">{confirmDeleteModal.count} แถว</strong>{' '}
                  ออกจากชุดข้อมูลใช่หรือไม่?
                </span>
              )}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteModal({ isOpen: false, type: 'single' })}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={executeDeleteAction}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>ยืนยันการลบข้อมูล</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[460px] overflow-y-auto">
        <table className="w-full text-xs text-right border-collapse">
          <thead className="sticky top-0 bg-slate-100 z-10 shadow-2xs">
            <tr className="border-b border-slate-200 text-slate-700 font-semibold">
              <th className="py-2.5 px-2.5 text-center bg-slate-100 w-10">
                <input
                  type="checkbox"
                  checked={isAllCurrentPageSelected}
                  onChange={handleSelectAllCurrentPage}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  title="เลือก/ยกเลิกทั้งหมดในหน้านี้"
                />
              </th>
              <th className="py-2.5 px-3 text-center bg-slate-100 w-14">แถว</th>
              <th className="py-2.5 px-3 text-left bg-slate-100 min-w-[140px]">วัน-เวลา (SCADA)</th>
              {analyses.map(a => (
                <th key={a.unitName} colSpan={2} className="py-2 px-3 text-center border-l border-slate-200 bg-slate-100">
                  <div className="font-bold text-slate-800">{a.unitName}</div>
                  <div className="text-[10px] text-slate-500 font-normal">TMP (bar) | Flow (m³/h)</div>
                </th>
              ))}
              <th className="py-2.5 px-3 text-center bg-slate-100 w-14 border-l border-slate-200">
                ลบ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={3 + analyses.length * 2 + 1} className="py-8 text-center text-slate-400 font-sans">
                  ไม่พบข้อมูลตามคำค้นหา
                </td>
              </tr>
            ) : (
              paginatedRows.map(row => {
                const isSelected = selectedTimestamps.has(row.timestamp);
                return (
                  <tr
                    key={row.rowNumber}
                    className={`hover:bg-blue-50/40 transition-colors ${
                      isSelected ? 'bg-blue-50/70' : !row.inRange ? 'opacity-60 bg-slate-50/50' : ''
                    }`}
                  >
                    <td className="py-2 px-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectRow(row.timestamp)}
                        className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-2 px-2 text-center text-slate-400 font-sans">{row.rowNumber}</td>
                    <td className="py-2 px-3 text-left font-sans text-slate-900 font-medium whitespace-nowrap">
                      {row.dateTimeStr}
                    </td>
                    {row.units.map((u, uIdx) => (
                      <React.Fragment key={uIdx}>
                        <td className="py-2 px-2 text-right border-l border-slate-100">
                          {u.tmp !== null ? (
                            <span
                              className={`font-semibold ${
                                u.tmp >= 0.25
                                  ? 'text-red-600'
                                  : u.tmp >= 0.18
                                  ? 'text-amber-600'
                                  : 'text-slate-800'
                              }`}
                            >
                              {u.tmp.toFixed(3)}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-500">
                          {u.flow !== null ? (
                            <span>{u.flow.toFixed(1)}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </React.Fragment>
                    ))}
                    <td className="py-2 px-2 text-center border-l border-slate-100">
                      {onDeleteRow && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDeleteModal({
                              isOpen: true,
                              type: 'single',
                              targetTs: row.timestamp
                            })
                          }
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title={`ลบแถว ${row.dateTimeStr}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 pt-1 gap-2">
        <div className="flex items-center gap-3">
          <span>
            แสดงแถวที่{' '}
            <strong className="text-slate-700">
              {filteredRows.length === 0 ? 0 : (currentPage - 1) * (pageSize || filteredRows.length) + 1}
            </strong>{' '}
            ถึง{' '}
            <strong className="text-slate-700">
              {pageSize === 0 ? filteredRows.length : Math.min(currentPage * pageSize, filteredRows.length)}
            </strong>{' '}
            จากทั้งหมด <strong className="text-slate-700">{filteredRows.length.toLocaleString()}</strong> แถว
          </span>

          {selectedTimestamps.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTimestamps(new Set())}
              className="text-blue-600 hover:underline font-medium cursor-pointer"
            >
              ยกเลิกการเลือก ({selectedTimestamps.size})
            </button>
          )}
        </div>

        {pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-xs font-medium text-slate-700">
              หน้า {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


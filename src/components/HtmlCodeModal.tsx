import React, { useState } from 'react';
import { ProcessedDataset } from '../data/initialData';
import { MembraneParameters, UnitAnalysis } from '../utils/membraneCalculations';
import { generateStandaloneHtml, downloadStandaloneHtmlFile } from '../utils/htmlExport';
import {
  Code,
  Download,
  Copy,
  Check,
  ExternalLink,
  X,
  FileCode,
  Sparkles
} from 'lucide-react';

interface HtmlCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: ProcessedDataset;
  params: MembraneParameters;
  analyses: UnitAnalysis[];
}

export const HtmlCodeModal: React.FC<HtmlCodeModalProps> = ({
  isOpen,
  onClose,
  dataset,
  params,
  analyses
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const htmlCode = generateStandaloneHtml(dataset, params, analyses);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(htmlCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = htmlCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleDownload = () => {
    downloadStandaloneHtmlFile(dataset, params, analyses);
  };

  const handleOpenPreview = () => {
    const blob = new Blob([htmlCode], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex justify-center items-center p-3 sm:p-5 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">โค้ด HTML แดชบอร์ดแบบ Standalone (Single-File HTML)</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/30 text-orange-200 border border-orange-400/40">
                  HTML5 + Tailwind + Chart.js
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                สามารถดาวน์โหลดเป็นไฟล์ .html นำไปเปิดออฟไลน์ หรือคัดลอกโค้ดไปวางใช้งานได้ทันที
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium">
              ขนาดไฟล์: <strong className="text-slate-900">{(htmlCode.length / 1024).toFixed(1)} KB</strong>
            </span>
            <span>·</span>
            <span className="text-slate-600 font-medium">
              จุดข้อมูลที่ฝังในตัว: <strong className="text-blue-700">{dataset.timestamps.length} รอบการกรอง</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCopyCode}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'คัดลอกโค้ดเรียบร้อย!' : 'คัดลอกโค้ด HTML'}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPreview}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              <span>เปิดพรีวิวแท็บใหม่</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ดาวน์โหลดไฟล์ .html</span>
            </button>
          </div>
        </div>

        {/* Code Content View */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1 bg-slate-900 text-slate-200 font-mono text-xs max-h-[58vh]">
          <pre className="whitespace-pre overflow-x-auto leading-relaxed select-all">
            <code>{htmlCode}</code>
          </pre>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-orange-600" />
            <span>ไฟล์ HTML เดี่ยวที่ทำงานได้โดยไม่ต้องติดตั้ง Node.js หรือ Server เสริม</span>
          </div>

          <div className="flex items-center gap-2">
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
    </div>
  );
};

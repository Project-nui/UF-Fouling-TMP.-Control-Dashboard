import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle, Gauge } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    // Validate password
    if (password === 'eng1234') {
      sessionStorage.setItem('uf_auth_token', 'true');
      onLoginSuccess();
    } else {
      setErrorMsg('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 text-slate-800 font-['Prompt',system-ui,sans-serif]">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl">
        {/* Header Icon & Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20 mb-3.5">
            <Gauge className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            UF Fouling (TMP) Control System
          </h1>
          <p className="text-xs font-semibold mt-1 text-blue-600">
            Developed by: Utility Operation Engineering UOP Team
          </p>
          <div className="text-xs text-slate-500 mt-2">
            ระบบตรวจสอบและควบคุมแรงดันตกคร่อมเยื่อกรองอัลตราฟิลเตรชัน
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center justify-between">
              <span>รหัสผ่านเข้าใช้งาน (Access Password)</span>
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Lock className="w-3 h-3 text-blue-600" />
                สิทธิ์ระดับวิศวกร
              </span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                autoFocus
                onChange={e => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="กรอกรหัสผ่าน..."
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !password}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl text-sm transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <span>เข้าสู่ระบบด้วยรหัสผ่าน (Sign In)</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Quick Direct Online Access */}
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem('uf_auth_token', 'true');
              onLoginSuccess();
            }}
            className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>เข้าใช้งาน Online Web ทันที (Direct Access)</span>
          </button>
        </form>

        {/* Security badge & copyright */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5 text-slate-600">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Protected Industrial Terminal
          </span>
          <span>v2.5 Data Platform</span>
        </div>
      </div>

      {/* Footer attribution */}
      <div className="mt-6 text-center text-xs text-slate-500">
        Utility Operation Engineering UOP Team · Ultrafiltration Membrane Management
      </div>
    </div>
  );
};

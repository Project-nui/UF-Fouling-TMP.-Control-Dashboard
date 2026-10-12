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
    <div className="min-h-screen bg-[#090A0F] flex flex-col justify-center items-center p-4 text-[#FFFFFF] font-['Prompt',system-ui,sans-serif]">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#8B5CF6]/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#EC4899]/15 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md bg-[#13141F] border border-[#1F2238] rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
        {/* Header Icon & Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#EC4899] text-white shadow-lg shadow-[#8B5CF6]/30 mb-3.5">
            <Gauge className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#FFFFFF]">
            UF Fouling (TMP) Control System
          </h1>
          <p className="text-xs font-semibold mt-1 bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] bg-clip-text text-transparent">
            Developed by: Utility Operation Engineering UOP Team
          </p>
          <div className="text-xs text-[#A1A1AA] mt-2">
            ระบบตรวจสอบและควบคุมแรงดันตกคร่อมเยื่อกรองอัลตราฟิลเตรชัน
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5 flex items-center justify-between">
              <span>รหัสผ่านเข้าใช้งาน (Access Password)</span>
              <span className="text-[11px] text-[#A1A1AA] flex items-center gap-1">
                <Lock className="w-3 h-3 text-[#8B5CF6]" />
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
                className="w-full bg-[#090A0F] border border-[#1F2238] rounded-xl px-3.5 py-2.5 text-sm text-[#FFFFFF] placeholder-[#71717A] focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/25 transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#FFFFFF] transition-colors p-1"
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-400 flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !password}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:opacity-95 active:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl text-sm transition-all shadow-lg shadow-[#8B5CF6]/30 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <span>เข้าสู่ระบบ (Sign In)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Security badge & copyright */}
        <div className="mt-6 pt-5 border-t border-[#1F2238] flex items-center justify-between text-[11px] text-[#A1A1AA]">
          <span className="flex items-center gap-1.5 text-[#A1A1AA]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Protected Industrial Terminal
          </span>
          <span>v2.5 SaaS Data Platform</span>
        </div>
      </div>

      {/* Footer attribution */}
      <div className="mt-6 text-center text-xs text-[#A1A1AA]">
        Utility Operation Engineering UOP Team · Ultrafiltration Membrane Management
      </div>
    </div>
  );
};

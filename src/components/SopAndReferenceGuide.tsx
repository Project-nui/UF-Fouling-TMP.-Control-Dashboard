import React from 'react';
import { BookOpen, AlertCircle, ShieldCheck, Thermometer, Gauge, Wrench, CheckCircle2 } from 'lucide-react';

export const SopAndReferenceGuide: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          คู่มือวิศวกรรมการควบคุมการอุดตันและมาตรฐานการล้างเยื่อกรอง (UF Fouling & Cleaning SOP)
        </h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          รวบรวมหลักเกณฑ์ทางทฤษฎีการกรองเมมเบรนอัลตราฟิลเตรชัน (Darcy&apos;s Resistance Model), ขั้นตอนการปฏิบัติงานมาตรฐาน (SOP)
          สำหรับระบบ Submerged Hollow Fiber และ Pressurized UF พร้อมแนวทางการวิเคราะห์หาสาเหตุความผิดปกติของ TMP
        </p>
      </div>

      {/* Darcy's Resistance Model & Fundamental Equations */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Gauge className="w-4 h-4 text-blue-600" />
          ทฤษฎีและสมการพื้นฐาน: Darcy&apos;s Law & Membrane Resistance Model
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5">
            <div className="font-semibold text-slate-900 border-b border-slate-200 pb-1.5">
              1. สมการการกรองฟลักซ์ (Filtration Flux Equation)
            </div>
            <div className="bg-white border border-slate-300 rounded p-3 font-mono text-center text-sm font-bold text-blue-700">
              J = ΔP / [ μ(T) · (Rm + Rc + Rp) ]
            </div>
            <ul className="space-y-1 text-slate-600 list-disc list-inside">
              <li><strong>J (Flux):</strong> อัตราการกรองต่อพื้นที่ (LMH = L/m²/hr)</li>
              <li><strong>ΔP (TMP):</strong> แรงดันตกคร่อมเยื่อกรอง (Transmembrane Pressure, bar หรือ kPa)</li>
              <li><strong>μ(T):</strong> ความหนืดพลวัตของน้ำที่อุณหภูมิ T (Dynamic Viscosity, Pa·s)</li>
              <li><strong>Rm:</strong> ความต้านทานเนื้อเยื่อกรองแท้จริง (Intrinsic Membrane Resistance)</li>
              <li><strong>Rc:</strong> ความต้านทานชั้นเค้กบนผิว (Reversible Cake Resistance - ล้างออกได้ด้วย AS/BW)</li>
              <li><strong>Rp:</strong> ความต้านทานการอุดตันในรูพรุน (Irreversible Pore Resistance - ต้องใช้เคมี EFM/CIP)</li>
            </ul>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5">
            <div className="font-semibold text-slate-900 border-b border-slate-200 pb-1.5">
              2. ความสามารถในการซึมผ่านและการชดเชยอุณหภูมิ (Permeability & Temperature)
            </div>
            <div className="bg-white border border-slate-300 rounded p-3 font-mono text-center text-sm font-bold text-emerald-700">
              Permeability = J / TMP  (LMH/bar)
            </div>
            <p className="text-slate-600 leading-relaxed">
              <strong>ผลของอุณหภูมิ:</strong> น้ำที่อุณหภูมิต่ำจะมีความหนืดสูงขึ้น ทำให้ TMP สูงขึ้นแม้ปริมาณน้ำเท่าเดิม
              โดยทุกๆ 1°C ที่อุณหภูมิน้ำลดลง TMP จะเพิ่มขึ้นประมาณ <strong>2-3%</strong> จึงควรพิจารณาค่า Temperature-Corrected Flux (J₂₅)
              เทียบที่อุณหภูมิอ้างอิง 25°C เสมอ
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-800 text-[11px]">
              ⚠️ <em>ข้อควรระวัง:</em> หากพบ TMP สูงขึ้นในฤดูหนาว ต้องตรวจสอบอุณหภูมิน้ำก่อนตัดสินใจทำ CIP
            </div>
          </div>
        </div>
      </div>

      {/* Cleaning SOP 3 Tiers */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          มาตรฐานขั้นตอนการล้างเยื่อกรอง 3 ระดับ (3-Tier Cleaning Protocols)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* AS/BW */}
          <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-emerald-800 text-sm">ระดับที่ 1: AS / BW</span>
                <span className="text-[11px] font-medium bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                  ทางกายภาพ (ทุกรอบ)
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-3">
                Air Scouring เป่าฟองอากาศร่วมกับ Backwash ล้างย้อนด้วยน้ำกรองสะอาด
              </p>
              <div className="space-y-1.5 text-xs text-slate-700">
                <div><strong>ความถี่:</strong> ทุกๆ 15 – 45 นาที (ตามรอบกรอง)</div>
                <div><strong>ระยะเวลา:</strong> 30 – 60 วินาทีต่อรอบ</div>
                <div><strong>อัตราล้างย้อน (BW Flux):</strong> 1.5 – 2.5 เท่าของอัตรากรองปกติ</div>
                <div><strong>แรงดันลมเป่า (AS):</strong> 0.1 – 0.2 bar (ฟองอากาศหยาบ)</div>
                <div><strong>เป้าหมาย:</strong> ขจัดชั้นเค้ก (Cake layer) บนผิวภายนอกเส้นใย</div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-emerald-200 text-[11px] text-emerald-700 font-medium">
              ✓ ดำเนินการอัตโนมัติด้วยระบบ PLC
            </div>
          </div>

          {/* EFM */}
          <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-amber-800 text-sm">ระดับที่ 2: EFM (CEB)</span>
                <span className="text-[11px] font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                  เคมีเจือจาง (สั้น)
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-3">
                Enhanced Flux Maintenance / Chemically Enhanced Backwash ยับยั้งการสะสม
              </p>
              <div className="space-y-1.5 text-xs text-slate-700">
                <div><strong>ความถี่:</strong> วันละ 1 ครั้ง หรือสัปดาห์ละ 1-2 ครั้ง (เมื่อแตะเกณฑ์เตือน)</div>
                <div><strong>ระยะเวลาแช่:</strong> 10 – 20 นาที</div>
                <div><strong>สารเคมีออกซิไดซ์ (Organic):</strong> NaOCl 200 – 500 mg/L (ppm)</div>
                <div><strong>สารเคมีกรด (Scaling):</strong> กรดซิตริก 1,000 – 2,000 mg/L หรือ HCl pH 2.0</div>
                <div><strong>เป้าหมาย:</strong> ขจัดไบโอฟิล์มระยะเริ่มต้นและสิ่งอุดตันในรูพรุน</div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-amber-200 text-[11px] text-amber-800 font-medium">
              ✓ ประหยัดเวลา ไม่ต้องระบายน้ำทั้งถัง
            </div>
          </div>

          {/* CIP */}
          <div className="border border-red-200 bg-red-50/50 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-red-800 text-sm">ระดับที่ 3: CIP</span>
                <span className="text-[11px] font-medium bg-red-100 text-red-800 px-2 py-0.5 rounded">
                  เคมีเข้มข้น (ลึก)
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-3">
                Clean-In-Place หมุนเวียนสารเคมีความเข้มข้นสูงและแช่นานเพื่อฟื้นฟูสภาพสมบูรณ์
              </p>
              <div className="space-y-1.5 text-xs text-slate-700">
                <div><strong>ความถี่:</strong> ทุก 1 – 6 เดือน (เมื่อแตะเกณฑ์วิกฤต หรือ EFM ไม่ได้ผล)</div>
                <div><strong>ระยะเวลาแช่:</strong> 2 – 4 ชั่วโมง (หรือข้ามคืนกรณีติดแน่น)</div>
                <div><strong>สเต็ปที่ 1 (ด่าง):</strong> NaOH pH 11.5–12.0 + NaOCl 1,000–2,000 ppm</div>
                <div><strong>สเต็ปที่ 2 (กรด):</strong> Citric acid 2–3% (w/v) หรือ HCl pH 1.5–2.0</div>
                <div><strong>อุณหภูมิสารละลาย:</strong> 35°C – 40°C (ช่วยเร่งปฏิกิริยาได้ 2 เท่า)</div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-red-200 text-[11px] text-red-800 font-medium">
              ✓ ต้องหยุดยูนิตและล้าง Flush สารเคมีออกหมด
            </div>
          </div>
        </div>
      </div>

      {/* Troubleshooting Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-blue-600" />
          ตารางวิเคราะห์ความผิดปกติและการแก้ปัญหาหน้างาน (Field Troubleshooting Matrix)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <th className="py-2.5 px-3 font-semibold">อาการที่ตรวจพบ (Symptom)</th>
                <th className="py-2.5 px-3 font-semibold">สาเหตุที่เป็นไปได้ (Probable Cause)</th>
                <th className="py-2.5 px-3 font-semibold">การตรวจสอบ (Verification)</th>
                <th className="py-2.5 px-3 font-semibold">มาตรการแก้ไข (Corrective Action)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-900">
                  TMP พุ่งสูงขึ้นอย่างรวดเร็วผิดปกติในเวลาไม่กี่ชั่วโมง
                </td>
                <td className="py-2.5 px-3">
                  คุณภาพน้ำดิบแย่ลงเฉียบพลัน (ความขุ่น/SDI/Algae bloom พุ่งสูง) หรือระบบตกตะกอนเคมีหลุดลอด
                </td>
                <td className="py-2.5 px-3">
                  ตรวจค่า Turbidity ของ Feed water, ค่า PAC / Coagulant overdosing
                </td>
                <td className="py-2.5 px-3 text-emerald-700">
                  ลดอัตราการกรอง (Flux) ชั่วคราว, เพิ่มความถี่ AS/BW และปรับสมดุลเคมีต้นน้ำ
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-900">
                  TMP สูงเฉพาะบางยูนิต ขณะที่ยูนิตอื่นยังปกติ
                </td>
                <td className="py-2.5 px-3">
                  หัวเป่าลม (Air diffuser) อุดตัน, วาล์ว Backwash ไม่เปิดสุด หรือเกิด Sludge compaction
                </td>
                <td className="py-2.5 px-3">
                  สังเกตการเดือดของฟองอากาศในถัง, ตรวจสอบแรงดันลมย่อยและตำแหน่งวาล์ว
                </td>
                <td className="py-2.5 px-3 text-emerald-700">
                  ล้างหัวจ่ายลม, ซ่อมวาล์ว และระบายตะกอนก้นถัง (Desludge)
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-900">
                  ทำ EFM แล้ว TMP แทบไม่ลดลงเลย
                </td>
                <td className="py-2.5 px-3">
                  ใช้สารเคมีไม่ตรงกับชนิด Fouling (เช่น เกิดตะกรันแต่ล้างด้วยคลอรีน) หรือสารเคมีเสื่อมสภาพ
                </td>
                <td className="py-2.5 px-3">
                  วัดค่า Free Chlorine หรือ pH ของน้ำยาในถังเตรียมเคมี, ตรวจประวัติค่าน้ำดิบ Hardness
                </td>
                <td className="py-2.5 px-3 text-emerald-700">
                  เปลี่ยนชนิดสารเคมี (สลับเป็นกรดซิตริกหากเป็นตะกรัน), ตรวจสอบความเข้มข้นก่อนสูบเข้า
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-900">
                  TMP หลัง CIP ไม่กลับลงมาที่ค่าเริ่มต้นของเมมเบรนใหม่
                </td>
                <td className="py-2.5 px-3">
                  เกิด Irreversible Fouling ลึกสะสมนานเกินไป หรือเมมเบรนเสื่อมอายุการใช้งาน (Membrane aging)
                </td>
                <td className="py-2.5 px-3">
                  ตรวจสอบอายุการใช้งานโมดูล (ปี), สถิติประวัติ CIP ในอดีต
                </td>
                <td className="py-2.5 px-3 text-emerald-700">
                  พิจารณาแช่ CIP นานขึ้นร่วมกับอุณหภูมิ 40°C หากยังไม่ดีขึ้นอาจต้องวางแผนเปลี่ยนโมดูล
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

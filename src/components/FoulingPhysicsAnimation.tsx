import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Wind, Sparkles, AlertTriangle, Layers, Droplets } from 'lucide-react';

interface FoulingAnimationProps {
  warningTmp: number;
  criticalTmp: number;
}

type FoulingMode = 'cake' | 'pore' | 'bio' | 'scale' | 'slud' | 'all';
type CleaningType = 'AS/BW' | 'EFM' | 'CIP';

interface FoulingState {
  cake: number;
  pore: number;
  bio: number;
  scale: number;
  slud: number;
}

const FOULING_RATES: Record<FoulingMode, Partial<FoulingState>> = {
  cake: { cake: 1 },
  pore: { pore: 1 },
  bio: { bio: 1 },
  scale: { scale: 1 },
  slud: { slud: 1 },
  all: { cake: 0.5, pore: 0.4, bio: 0.3, scale: 0.25, slud: 0.3 }
};

const CLEANING_EFFICIENCY: Record<CleaningType, FoulingState> = {
  'AS/BW': { cake: 0.5, pore: 0.05, bio: 0.05, scale: 0, slud: 0.4 },
  EFM: { cake: 0.9, pore: 0.35, bio: 0.5, scale: 0.15, slud: 0.5 },
  CIP: { cake: 0.95, pore: 0.95, bio: 0.95, scale: 0.95, slud: 0.95 }
};

const WEIGHTS: FoulingState = {
  cake: 0.5,
  pore: 0.6,
  bio: 0.45,
  scale: 0.5,
  slud: 0.4
};

const MODE_DETAILS: Record<
  FoulingMode,
  {
    title: string;
    color: string;
    cause: string;
    symptom: string;
    strategy: string;
  }
> = {
  cake: {
    title: 'ชั้นเค้กบนผิว (Cake Layer)',
    color: '#8b5a2b',
    cause: 'ตะกอนแขวนลอย (SS) และอนุภาคคอลลอยด์สะสมเป็นชั้นหนาบนผิวด้านนอกเมมเบรน',
    symptom: 'TMP ค่อยๆ ไต่ขึ้นสม่ำเสมอในแต่ละรอบกรอง แต่หลังล้างย้อนจะกลับมาใกล้ค่าเดิม',
    strategy: 'ย้อนกลับได้ง่ายทางกายภาพ: AS/BW (เป่าลม+ล้างย้อน) ได้ผลดีมาก หากสะสมหนาให้ทำ EFM'
  },
  pore: {
    title: 'รูพรุนอุดตันภายใน (Pore Blocking)',
    color: '#7a5fa0',
    cause: 'อนุภาคขนาดเล็กกว่าหรือเท่ากับขนาดรูพรุน (NOM / คอลลอยด์ละเอียด) เข้าไปอุดตันในช่องรูพรุน',
    symptom: 'TMP ไต่ขึ้นเร็วขึ้นเรื่อยๆ และค่าฐานเริ่มต้นหลังล้าง (Baseline TMP) สูงขึ้นสะสมทุกรอบ',
    strategy: 'ย้อนกลับยาก: AS/BW แทบเอาไม่ออก ต้องใช้สารเคมี EFM ประจำสัปดาห์ หรือ CIP ฟื้นฟู'
  },
  bio: {
    title: 'ไบโอฟิล์มจุลินทรีย์ (Biofouling)',
    color: '#16a34a',
    cause: 'จุลินทรีย์และแบคทีเรียยึดเกาะผิว สร้างสารเมือกพอลิเมอร์นอกเซลล์ (EPS) หุ้มเส้นใย',
    symptom: 'ระยะแรก TMP ขึ้นช้า แต่เมื่อฟิล์มประสานตัวจะเร่งตัวขึ้นอย่างรวดเร็ว ล้างทางกายภาพไม่หลุด',
    strategy: 'ต้องใช้สารออกซิไดซ์/ฆ่าเชื้อ: EFM ด้วยโซเดียมไฮโปคลอไรต์ (NaOCl) เจือจาง หรือ CIP ค่า pH สูง'
  },
  scale: {
    title: 'ตะกรันสารอนินทรีย์ (Inorganic Scaling)',
    color: '#2563eb',
    cause: 'เกลือแร่ละลายน้ำ เช่น แคลเซียม แมกนีเซียม เหล็ก แมงกานีส ซิลิกา ตกผลึกแข็งบนผิวเยื่อกรอง',
    symptom: 'ค่าฐาน TMP ยกตัวสูงขึ้นเป็นขั้นๆ อย่างถาวร AS/BW และคลอรีนไม่ได้ผลเลย',
    strategy: 'ต้องล้างด้วยกรด: ทำ EFM หรือ CIP ด้วยกรดซิตริก (Citric acid) หรือกรดไฮโดรคลอริกเจือจาง (HCl)'
  },
  slud: {
    title: 'ตะกอนอัดแน่นระหว่างเส้นใย (Sludging)',
    color: '#92400e',
    cause: 'ตะกอนสะสมอัดแน่นระหว่างช่องว่างของเส้นใยที่โคนโมดูล ลมเป่าขัดถูเข้าไม่ถึง',
    symptom: 'TMP พุ่งสูงผิดปกติเฉพาะบางยูนิต และฟองอากาศกระจายตัวไม่สม่ำเสมอทั่วทั้งถัง',
    strategy: 'ตรวจเช็กหัวจ่ายลมเป่า (Air diffuser), ติดตั้งตะแกรงดักผงหยาบก่อนเข้าถัง และทำ CIP แช่นาน'
  },
  all: {
    title: 'ผสมผสานทุกรูปแบบ (Real-world Condition)',
    color: '#475569',
    cause: 'ในระบบบำบัดจริง เกิดทั้งชั้นเค้ก, รูพรุนอุดตัน, ไบโอฟิล์ม และตะกรันพร้อมกันในสัดส่วนต่างๆ',
    symptom: 'TMP ไต่ขึ้นทั้งแบบ Reversible (เค้ก) และมี Irreversible fouling สะสมยกระดับฐานขึ้นเรื่อยๆ',
    strategy: 'ควบคุมแบบบูรณาการ: AS/BW ทุก 15-30 นาที → EFM ทุก 1-7 วัน → CIP เมื่อ EFM เริ่มไม่คืนสภาพ'
  }
};

export const FoulingPhysicsAnimation: React.FC<FoulingAnimationProps> = ({ warningTmp, criticalTmp }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<FoulingMode>('cake');
  const [isRunning, setIsRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [cleaningStatus, setCleaningStatus] = useState<string | null>(null);

  // Simulation persistent refs
  const stateRef = useRef<FoulingState>({ cake: 0, pore: 0, bio: 0, scale: 0, slud: 0 });
  const historyRef = useRef<number[]>([]);
  const eventsRef = useRef<{ index: number; type: CleaningType }[]>([]);
  const cleaningRef = useRef<{ type: CleaningType; elapsed: number; duration: number; initial: FoulingState } | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const histCountRef = useRef<number>(0);
  const histAccumRef = useRef<number>(0);

  // Particles & sub-elements
  const particlesRef = useRef({
    feed: [] as { x: number; y: number; v: number; p: number; type: string }[],
    water: [] as { mode: string; x: number; y: number; targetY?: number; out?: number; rnd?: number }[],
    bubbles: [] as { z: number; x: number; y: number; r: number }[],
    crystals: [] as { y: number; angle: number; size: number; offset: number }[],
    poresBlockedRnd: [] as number[],
    organicDots: [] as { y: number; u: number; r: number }[],
    outerDots: [] as { x: number; y: number }[],
    permeateDots: [] as { y: number }[]
  });

  // Calculate simulated TMP from fouling components
  const calcSimulatedTmp = () => {
    const st = stateRef.current;
    const added =
      WEIGHTS.cake * st.cake +
      WEIGHTS.pore * st.pore +
      WEIGHTS.bio * st.bio +
      WEIGHTS.scale * st.scale +
      WEIGHTS.slud * st.slud;
    return Math.min(1.0, 0.10 + added);
  };

  // Initialize random particle sets
  useEffect(() => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    particlesRef.current.poresBlockedRnd = Array.from({ length: 10 }, () => 0.6 + 0.8 * rnd());
    particlesRef.current.crystals = Array.from({ length: 70 }, () => ({
      y: 70 + rnd() * 270,
      angle: rnd() * 3,
      size: 3 + rnd() * 4,
      offset: rnd() * 14
    }));
    particlesRef.current.organicDots = Array.from({ length: 160 }, () => ({
      y: 70 + rnd() * 270,
      u: rnd(),
      r: 1.5 + rnd() * 2.5
    }));
    particlesRef.current.outerDots = Array.from({ length: 26 }, () => ({
      x: 78 + Math.floor(rnd() * 11) * 10.8,
      y: 112 + rnd() * 232
    }));
    particlesRef.current.permeateDots = Array.from({ length: 5 }, (_, i) => ({
      y: 40 + i * 11
    }));

    const createFeedParticle = () => ({
      x: 292 + Math.random() * 30,
      y: 62 + Math.random() * 280,
      v: 35 + Math.random() * 35,
      p: Math.random() * 6,
      type: mode === 'all' ? ['cake', 'pore', 'bio', 'scale'][Math.floor(Math.random() * 4)] : mode === 'slud' ? 'cake' : mode
    });

    particlesRef.current.feed = Array.from({ length: 30 }, createFeedParticle);
    particlesRef.current.water = Array.from({ length: 34 }, () => ({
      mode: '',
      x: 292,
      y: 62
    }));
  }, []);

  // Update feed particles when mode changes
  useEffect(() => {
    const createFeedParticle = () => ({
      x: 292 + Math.random() * 30,
      y: 62 + Math.random() * 280,
      v: 35 + Math.random() * 35,
      p: Math.random() * 6,
      type: mode === 'all' ? ['cake', 'pore', 'bio', 'scale'][Math.floor(Math.random() * 4)] : mode === 'slud' ? 'cake' : mode
    });
    particlesRef.current.feed = Array.from({ length: 30 }, createFeedParticle);
  }, [mode]);

  const triggerCleaning = (type: CleaningType) => {
    if (cleaningRef.current) return;
    const dur = type === 'AS/BW' ? 2.5 : 3.5;
    cleaningRef.current = {
      type,
      elapsed: 0,
      duration: dur,
      initial: { ...stateRef.current }
    };
    setCleaningStatus(`กำลังล้าง ${type}...`);
  };

  const handleReset = () => {
    stateRef.current = { cake: 0, pore: 0, bio: 0, scale: 0, slud: 0 };
    historyRef.current = [];
    eventsRef.current = [];
    histCountRef.current = 0;
    cleaningRef.current = null;
    setCleaningStatus(null);
  };

  // Main Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 760;
    const H = 470;
    canvas.width = W * 2;
    canvas.height = H * 2;
    ctx.scale(2, 2);

    const poreY = (i: number) => 95 + i * 26;

    const renderLoop = (timestamp: number) => {
      const dt = Math.min(0.1, (timestamp - lastTimeRef.current) / 1000 || 0);
      lastTimeRef.current = timestamp;

      // 1. Simulation Step
      const st = stateRef.current;
      const cl = cleaningRef.current;
      const parts = particlesRef.current;

      if (isRunning && !cl) {
        const rates = FOULING_RATES[mode];
        (Object.keys(rates) as (keyof FoulingState)[]).forEach(k => {
          const rateVal = rates[k] || 0;
          st[k] = Math.min(1.0, st[k] + (rateVal * dt * speed) / 30);
        });
      }

      let isBackwash = false;
      let isChemicalSoak = false;

      if (cl) {
        cl.elapsed += dt * speed;
        const progress = Math.min(1.0, cl.elapsed / cl.duration);
        const eff = CLEANING_EFFICIENCY[cl.type];
        (Object.keys(st) as (keyof FoulingState)[]).forEach(k => {
          st[k] = cl.initial[k] * (1 - eff[k] * progress);
        });

        isBackwash = cl.type === 'AS/BW';
        isChemicalSoak = !isBackwash;

        if (cl.elapsed >= cl.duration) {
          eventsRef.current.push({ index: histCountRef.current, type: cl.type });
          cleaningRef.current = null;
          setCleaningStatus(null);
        }
      }

      const cakeFront = 510 - st.cake * 50 - st.bio * 28;

      // Update feed particles
      parts.feed.forEach(q => {
        if (cl) {
          q.x -= q.v * dt * 1.2;
          if (q.x < 292) {
            q.x = cakeFront - 3;
            q.y = 62 + Math.random() * 280;
          }
          return;
        }
        q.x += q.v * dt;
        q.y += Math.sin(q.p + q.x / 30) * 0.3;
        if (q.x >= cakeFront) {
          q.x = 292 + Math.random() * 30;
          q.y = 62 + Math.random() * 280;
        }
      });

      // Update water flow particles
      parts.water.forEach(w => {
        if (isBackwash) {
          if (w.mode !== 'bw') {
            w.mode = 'bw';
            w.x = 548 + Math.random() * 150;
            w.y = 48;
            w.targetY = poreY(Math.floor(Math.random() * 10));
            w.out = 0;
          }
          if (!w.out) {
            w.y += 75 * dt;
            if (w.targetY !== undefined && w.y >= w.targetY) {
              w.y = w.targetY;
              w.out = 1;
            }
          } else {
            w.x -= 85 * dt;
            if (w.x < 292) {
              w.mode = '';
            }
          }
        } else {
          // Normal filtration flow
          if (w.mode !== 'filt') {
            w.mode = 'filt';
            w.x = 292;
            w.y = 62 + Math.random() * 280;
            w.out = 0;
            w.rnd = Math.random() * 150;
          }
          const flowSpeed = isChemicalSoak ? 12 : 70;
          if (!w.out) {
            w.x += flowSpeed * dt;
            if (w.x > 505 && w.x < 540) {
              let bestPore = 95;
              let minDiff = 1e9;
              for (let i = 0; i < 10; i++) {
                const py = poreY(i);
                if (Math.abs(py - w.y) < minDiff) {
                  minDiff = Math.abs(py - w.y);
                  bestPore = py;
                }
              }
              w.y += (bestPore - w.y) * Math.min(1.0, dt * 10);
            }
            if (w.x >= 540) {
              w.out = 1;
              w.x = 544 + (w.rnd || 0);
            }
          } else {
            w.y -= flowSpeed * dt;
            if (w.y < 46) {
              w.mode = '';
            }
          }
        }
      });

      // Outer module particles
      const flowSign = isBackwash ? 1 : isChemicalSoak ? 0.15 : -1;
      parts.outerDots.forEach(o => {
        o.y += flowSign * 60 * dt;
        if (o.y < 112) o.y = 345;
        if (o.y > 345) o.y = 112;
      });
      parts.permeateDots.forEach(o => {
        o.y += flowSign * 60 * dt;
        if (o.y < 40) o.y = 95;
        if (o.y > 95) o.y = 40;
      });

      // Air Scour bubbles
      if (isBackwash && Math.random() < 0.9) {
        parts.bubbles.push({
          z: 0,
          x: 78 + Math.random() * 112,
          y: 345,
          r: 2 + Math.random() * 3
        });
        parts.bubbles.push({
          z: 1,
          x: 485 + Math.random() * 22,
          y: 345,
          r: 2 + Math.random() * 3
        });
      }
      parts.bubbles.forEach(b => {
        b.y -= 90 * dt;
      });
      parts.bubbles = parts.bubbles.filter(b => b.y > (b.z ? 70 : 110));

      // Record TMP History
      histAccumRef.current += dt;
      if (histAccumRef.current > 0.25) {
        histAccumRef.current = 0;
        const currentTmpVal = calcSimulatedTmp();
        historyRef.current.push(currentTmpVal);
        histCountRef.current++;
        if (historyRef.current.length > 160) {
          historyRef.current.shift();
        }
      }

      // 2. Render Canvas Drawing
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, W, H);

      // Titles
      ctx.font = '600 13px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText('ภาพรวมโมดูล UF (Submerged Hollow Fiber)', 14, 24);
      ctx.fillText('ซูมหน้าตัดผนังเมมเบรนและรูพรุน (Pore Wall Cross-Section)', 292, 24);

      // Left Panel: Macro Module Container
      ctx.fillStyle = '#f1f5f9';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(50, 40, 160, 320);

      // Permeate Header (Top manifold)
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(70, 95, 120, 15);
      ctx.fillRect(125, 60, 10, 35);

      // Header Flow direction indicator
      ctx.fillStyle = isBackwash ? '#dc2626' : '#0284c7';
      ctx.beginPath();
      if (isBackwash) {
        ctx.moveTo(130, 56);
        ctx.lineTo(121, 38);
        ctx.lineTo(139, 38);
      } else {
        ctx.moveTo(130, 38);
        ctx.lineTo(121, 56);
        ctx.lineTo(139, 56);
      }
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.font = '500 12px system-ui';
      ctx.fillText(isBackwash ? 'น้ำล้างย้อน (BW) ↓' : 'Permeate ดูดออก ↑', 142, 52);

      // 11 Hollow fiber strands
      for (let i = 0; i < 11; i++) {
        const fx = 78 + i * 10.8;
        // Outer sheath
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(fx, 110);
        ctx.lineTo(fx, 345);
        ctx.stroke();

        // Inner lumen
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(fx, 110);
        ctx.lineTo(fx, 345);
        ctx.stroke();
      }

      // Macro suction dots
      ctx.fillStyle = '#0284c7';
      parts.outerDots.forEach(o => {
        ctx.beginPath();
        ctx.arc(o.x, o.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });
      parts.permeateDots.forEach(o => {
        ctx.beginPath();
        ctx.arc(130, o.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });

      // Suction arrows (Outside-in)
      const drawArrow = (x1: number, y: number, x2: number) => {
        const s = Math.sign(x2 - x1);
        ctx.strokeStyle = '#0284c7';
        ctx.fillStyle = '#0284c7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2, y);
        ctx.lineTo(x2 - s * 5, y - 3);
        ctx.lineTo(x2 - s * 5, y + 3);
        ctx.fill();
      };

      [140, 200, 260, 320].forEach(y => {
        if (isBackwash) {
          drawArrow(66, y, 44);
          drawArrow(194, y, 216);
        } else {
          drawArrow(44, y, 66);
          drawArrow(216, y, 194);
        }
      });

      ctx.fillStyle = '#64748b';
      ctx.font = '11px system-ui';
      ctx.fillText('น้ำดิบในถัง', 8, 128);
      ctx.fillText('Outside-in', 6, 368);
      ctx.fillText('(ดูดเข้าใน)', 8, 382);

      // Aerator Header (Bottom)
      ctx.fillStyle = '#475569';
      ctx.fillRect(70, 345, 120, 14);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px system-ui';
      ctx.fillText('ท่อลมเป่า (Air inlet)', 86, 356);

      // Sludge compaction layer at bottom
      if (st.slud > 0) {
        ctx.fillStyle = 'rgba(146, 64, 14, 0.7)';
        const sh = st.slud * 220;
        ctx.fillRect(72, 345 - sh, 116, sh);
      }

      // Zoom circle callout indicator
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(150, 230, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(160, 230);
      ctx.lineTo(292, 230);
      ctx.stroke();
      ctx.setLineDash([]);

      // Right Panel: Microscopic Wall Cross-Section
      // Feed tank water area (Left side)
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(292, 40, 218, 310);

      // Lumen interior channel (Right side)
      ctx.fillStyle = '#f0fdf4';
      ctx.fillRect(540, 40, 200, 310);

      // Chemical soak color overlay
      if (cl && cl.type !== 'AS/BW') {
        ctx.fillStyle = cl.type === 'EFM' ? 'rgba(254, 240, 138, 0.45)' : 'rgba(254, 215, 170, 0.55)';
        ctx.fillRect(292, 40, 218, 310);
      }

      // Membrane Porous Wall Structure (510 to 540)
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(510, 40, 30, 310);

      // 10 micro-pores
      for (let i = 0; i < 10; i++) {
        const y = poreY(i);
        ctx.fillStyle = '#f0fdf4';
        ctx.fillRect(510, y - 5, 30, 10);

        // Pore blocking foulant inside pore
        const blockedLen = Math.min(1.0, st.pore * (parts.poresBlockedRnd[i] || 1));
        if (blockedLen > 0) {
          ctx.fillStyle = '#7a5fa0';
          ctx.fillRect(510, y - 5, 30 * blockedLen, 10);
        }
      }

      // Mineral Scaling Crystals on surface
      if (st.scale > 0) {
        const nCryst = Math.floor(st.scale * 70);
        for (let i = 0; i < nCryst; i++) {
          const c = parts.crystals[i];
          if (!c) continue;
          ctx.save();
          ctx.translate(509 - c.offset * 0.6, c.y);
          ctx.rotate(c.angle);
          ctx.fillStyle = '#dbeafe';
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 1;
          ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size);
          ctx.strokeRect(-c.size / 2, -c.size / 2, c.size, c.size);
          ctx.restore();
        }
      }

      // Cake layer accumulation
      const cakeThick = st.cake * 50;
      if (cakeThick > 0) {
        ctx.fillStyle = 'rgba(139, 90, 43, 0.85)';
        ctx.fillRect(510 - cakeThick, 40, cakeThick, 310);

        parts.organicDots.forEach(dot => {
          if (dot.u * 50 < cakeThick) {
            ctx.fillStyle = 'rgba(70, 40, 15, 0.6)';
            ctx.beginPath();
            ctx.arc(510 - dot.u * 50, dot.y, dot.r, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      // Biofilm slime mesh layer
      const bioThick = st.bio * 28;
      if (bioThick > 0) {
        const f0 = 510 - cakeThick;
        ctx.fillStyle = 'rgba(22, 163, 74, 0.75)';
        ctx.beginPath();
        ctx.moveTo(f0, 40);
        for (let y = 40; y <= 350; y += 6) {
          ctx.lineTo(f0 - bioThick + Math.sin(y / 9 + performance.now() / 600) * 3, y);
        }
        ctx.lineTo(f0, 350);
        ctx.fill();

        ctx.fillStyle = 'rgba(187, 247, 208, 0.8)';
        parts.organicDots.forEach(dot => {
          if (dot.u * bioThick > 2) {
            ctx.beginPath();
            ctx.arc(f0 - dot.u * bioThick, dot.y, 1.6, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      // Feed particles moving towards wall
      parts.feed.forEach(q => {
        if (q.x > cakeFront) return;
        if (q.type === 'scale') {
          ctx.fillStyle = '#2563eb';
          ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
        } else if (q.type === 'bio') {
          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.arc(q.x, q.y, 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (q.type === 'pore') {
          ctx.fillStyle = '#7a5fa0';
          ctx.beginPath();
          ctx.arc(q.x, q.y, 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#8b5a2b';
          ctx.beginPath();
          ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Water flow dots
      ctx.fillStyle = '#0284c7';
      parts.water.forEach(w => {
        ctx.beginPath();
        ctx.arc(w.x, w.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Air bubbles
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 1.4;
      parts.bubbles.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Micro Labels
      ctx.fillStyle = '#0f172a';
      ctx.font = '600 12px system-ui';
      ctx.fillText('น้ำดิบ (Feed water)', 300, 58);
      ctx.fillText('ผนังเมมเบรน (Membrane skin)', 470, 36);
      ctx.fillText('ในรูกลวงเส้นใย (Lumen)', 552, 58);
      ctx.font = '500 11px system-ui';
      ctx.fillText(isBackwash ? 'น้ำล้างย้อนไหลลง ↓' : 'Permeate ไหลขึ้น ↑', 552, 74);

      // Large Flow indicator in Lumen
      const isUp = !isBackwash;
      ctx.strokeStyle = '#0284c7';
      ctx.fillStyle = '#0284c7';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(722, isUp ? 290 : 130);
      ctx.lineTo(722, isUp ? 150 : 270);
      ctx.stroke();
      ctx.beginPath();
      if (isUp) {
        ctx.moveTo(722, 130);
        ctx.lineTo(713, 152);
        ctx.lineTo(731, 152);
      } else {
        ctx.moveTo(722, 290);
        ctx.lineTo(713, 268);
        ctx.lineTo(731, 268);
      }
      ctx.fill();

      // Current Operation Status Text
      ctx.font = '600 12px system-ui';
      ctx.fillStyle = cl ? (cl.type === 'CIP' ? '#dc2626' : cl.type === 'EFM' ? '#d97706' : '#16a34a') : '#0284c7';
      ctx.fillText(
        cl
          ? cl.type === 'AS/BW'
            ? 'AS/BW: เป่าลมขัดผิวด้านนอก + ดันน้ำล้างย้อนออก'
            : cl.type === 'EFM'
            ? 'EFM: สารเคมีเจือจาง แช่ช่วงสั้น 10-15 นาที'
            : 'CIP: สารเคมีเข้มข้น + อุณหภูมิ แช่นาน 2-4 ชม.'
          : 'สถานะ: กำลังกรองปกติ (Filtration - Outside-in)',
        300,
        342
      );

      // 3. Bottom Panel: Simulated TMP Gauge & Time Graph
      const currentSimTmp = calcSimulatedTmp();
      const X0 = 130;
      const X1 = 740;
      const Y0 = 455;
      const Y1 = 388;
      const yScale = (v: number) => Y0 - (Y0 - Y1) * Math.min(1.0, v);

      // History Plot Box
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.fillRect(X0, Y1 - 4, X1 - X0, Y0 - Y1 + 8);
      ctx.strokeRect(X0, Y1 - 4, X1 - X0, Y0 - Y1 + 8);

      // Threshold lines
      const drawThresholdLine = (val: number, strokeColor: string, label: string) => {
        const y = yScale(val);
        ctx.strokeStyle = strokeColor;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(X0, y);
        ctx.lineTo(X1, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = strokeColor;
        ctx.font = '500 10px system-ui';
        ctx.fillText(label, X1 - 70, y - 2);
      };

      drawThresholdLine(warningTmp, '#d97706', `เตือน (${warningTmp.toFixed(2)})`);
      drawThresholdLine(criticalTmp, '#dc2626', `วิกฤต (${criticalTmp.toFixed(2)})`);

      // Plot TMP History Curve
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const hist = historyRef.current;
      const histLen = hist.length;
      const getX = (idx: number) => X0 + ((X1 - X0) * idx) / 159;

      hist.forEach((v, idx) => {
        const px = getX(idx);
        const py = yScale(v);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      // Plot cleaning event markers
      eventsRef.current.forEach(ev => {
        const eventIdx = ev.index - (histCountRef.current - histLen);
        if (eventIdx >= 0 && eventIdx < histLen) {
          const px = getX(eventIdx);
          const py = yScale(hist[eventIdx]);
          ctx.fillStyle = ev.type === 'CIP' ? '#991b1b' : ev.type === 'EFM' ? '#d97706' : '#16a34a';
          ctx.beginPath();
          ctx.arc(px, py, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0f172a';
          ctx.font = '600 9px system-ui';
          ctx.fillText(ev.type, px - 10, Y1 - 6);
        }
      });

      // Gauge Current Value Indicator
      const statusColor = currentSimTmp >= criticalTmp ? '#dc2626' : currentSimTmp >= warningTmp ? '#d97706' : '#16a34a';
      const statusThai =
        currentSimTmp >= criticalTmp ? 'วิกฤต → ต้อง CIP' : currentSimTmp >= warningTmp ? 'เตือน → ต้อง EFM' : 'ปกติ → AS/BW';

      ctx.fillStyle = statusColor;
      ctx.font = '700 24px system-ui';
      ctx.fillText(`${currentSimTmp.toFixed(2)} bar`, 14, 420);

      ctx.font = '600 12px system-ui';
      ctx.fillStyle = '#475569';
      ctx.fillText('TMP (จำลอง)', 14, 440);

      ctx.font = '600 12px system-ui';
      ctx.fillStyle = statusColor;
      ctx.fillText(statusThai, 14, 460);

      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isRunning, speed, mode, warningTmp, criticalTmp]);

  return (
    <div className="space-y-6">
      {/* Simulation Screen Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Droplets className="w-5 h-5 text-blue-600" />
              แอนิเมชันจำลองฟิสิกส์: รูปแบบการอุดตันของเมมเบรน Submerged Hollow Fiber
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              แบบจำลองเพื่อสาธิตกลไกการอุดตันและการฟื้นสภาพด้วยการล้างแต่ละประเภท · เส้นประ TMP เชื่อมโยงกับค่าเกณฑ์ของระบบ
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">ความเร็ว:</span>
            <select
              value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              className="text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-700"
            >
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </div>
        </div>

        {/* Fouling Mechanism Selector Buttons */}
        <div className="mt-4">
          <div className="text-xs font-medium text-slate-600 mb-2">เลือกรูปแบบการอุดตัน (Fouling Mode):</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(MODE_DETAILS) as FoulingMode[]).map(mKey => {
              const info = MODE_DETAILS[mKey];
              const isActive = mode === mKey;
              return (
                <button
                  key={mKey}
                  onClick={() => setMode(mKey)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: info.color }} />
                  {info.title.split(' (')[0]}
                </button>
              );
            })}
          </div>
        </div>

        {/* HTML5 Canvas */}
        <div className="mt-4 bg-slate-50 rounded-lg overflow-hidden border border-slate-200">
          <canvas
            ref={canvasRef}
            className="w-full h-auto block"
            style={{ aspectRatio: '760 / 470' }}
          />
        </div>

        {/* Controls Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => triggerCleaning('AS/BW')}
              className="px-3.5 py-2 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center gap-1.5"
            >
              <Wind className="w-4 h-4" />
              ล้าง AS/BW (เป่าลม + ล้างย้อน)
            </button>
            <button
              onClick={() => triggerCleaning('EFM')}
              className="px-3.5 py-2 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              ล้าง EFM (เคมีเจือจาง แช่สั้น)
            </button>
            <button
              onClick={() => triggerCleaning('CIP')}
              className="px-3.5 py-2 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors flex items-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4" />
              ล้าง CIP (เคมีเข้มข้น แช่นาน)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5"
            >
              {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isRunning ? 'หยุดชั่วคราว' : 'เล่นต่อ'}
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              รีเซ็ต
            </button>
          </div>
        </div>

        {cleaningStatus && (
          <div className="mt-3 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
            {cleaningStatus}
          </div>
        )}
      </div>

      {/* Mechanism Deep-dive & Explanations Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: MODE_DETAILS[mode].color }}
            />
            <h3 className="font-semibold text-slate-800 text-sm">{MODE_DETAILS[mode].title}</h3>
          </div>
          <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
            <div>
              <span className="font-semibold text-slate-700">สาเหตุการเกิด:</span>{' '}
              {MODE_DETAILS[mode].cause}
            </div>
            <div>
              <span className="font-semibold text-slate-700">ลักษณะในกราฟ TMP:</span>{' '}
              {MODE_DETAILS[mode].symptom}
            </div>
            <div>
              <span className="font-semibold text-slate-700">แนวทางแก้ไขทางวิศวกรรม:</span>{' '}
              {MODE_DETAILS[mode].strategy}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            ทิศทางการไหลตามโครงสร้างจริง (Submerged Hollow Fiber)
          </h3>
          <ul className="space-y-1.5 text-xs text-slate-600 leading-relaxed list-disc list-inside">
            <li>
              <strong className="text-slate-700">ช่วงกรอง (Filtration):</strong> น้ำดิบอยู่ด้านนอกเส้นใย ถูกดูดด้วยแรงดันลบผ่านรูพรุนเข้าสู่รูกลวงด้านใน (Outside-in) ไหลขึ้นตามรูกลวงสู่ท่อ Manifold ด้านบนเป็น Permeate
            </li>
            <li>
              <strong className="text-slate-700">ช่วงล้างย้อน (Backwash):</strong> ปั๊มน้ำสะอาดกลับจากท่อด้านบนลงในรูกลวง แล้วดันย้อนออกสู่ผนังภายนอก เพื่อดันตะกอนหลุดออก
            </li>
            <li>
              <strong className="text-slate-700">ช่วงเป่าลม (Air Scouring):</strong> หัวจ่ายลมด้านล่างปล่อยฟองอากาศขนาดใหญ่ ลอยขึ้นขัดถูและสั่นไหวเส้นใย membrane ให้ตะกอนหลุดลอย
            </li>
          </ul>
        </div>
      </div>

      {/* Cleaning Effectiveness Comparison Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800 text-sm mb-3">
          ตารางเปรียบเทียบประสิทธิภาพการล้างแต่ละประเภทต่อการอุดตันแต่ละแบบ
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="py-2.5 px-3 font-semibold">ประเภทการอุดตัน</th>
                <th className="py-2.5 px-3 font-semibold text-center">AS/BW (เป่าลม+ล้างย้อน)</th>
                <th className="py-2.5 px-3 font-semibold text-center">EFM (เคมีเจือจาง แช่สั้น)</th>
                <th className="py-2.5 px-3 font-semibold text-center">CIP (เคมีเข้มข้น แช่นาน)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2 px-3 font-medium text-slate-800">1. ชั้นเค้ก (Cake Layer)</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-medium">ได้ผลดีมาก (50-80%)</td>
                <td className="py-2 px-3 text-center text-emerald-700 font-semibold">ดีเยี่ยม (&gt;90%)</td>
                <td className="py-2 px-3 text-center text-emerald-700 font-semibold">ดีเยี่ยม (&gt;95%)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium text-slate-800">2. รูพรุนอุดตัน (Pore Blocking)</td>
                <td className="py-2 px-3 text-center text-rose-500">ได้ผลน้อย (&lt;10%)</td>
                <td className="py-2 px-3 text-center text-amber-600">บางส่วน (30-40%)</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-medium">ได้ผลดีมาก (&gt;90%)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium text-slate-800">3. ไบโอฟิล์ม (Biofouling)</td>
                <td className="py-2 px-3 text-center text-rose-500">ได้ผลน้อย (&lt;10%)</td>
                <td className="py-2 px-3 text-center text-amber-600 font-medium">ดีปานกลาง (NaOCl)</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-medium">ได้ผลดีมาก (pH สูง+คลอรีน)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium text-slate-800">4. ตะกรันเคมี (Inorganic Scale)</td>
                <td className="py-2 px-3 text-center text-slate-400">ไม่ได้ผลเลย (0%)</td>
                <td className="py-2 px-3 text-center text-amber-600">ได้ผลน้อย (15%)</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-medium">ได้ผลดีมาก (ใช้กรดซิตริก/HCl)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium text-slate-800">5. ตะกอนอัดแน่น (Sludging)</td>
                <td className="py-2 px-3 text-center text-amber-600">บางส่วน (40%)</td>
                <td className="py-2 px-3 text-center text-amber-600">บางส่วน (50%)</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-medium">ได้ผลดีมาก (&gt;95%)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

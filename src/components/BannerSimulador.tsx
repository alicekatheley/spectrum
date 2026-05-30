import { useState, useEffect, type CSSProperties } from "react";
import { Brand } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { Play, Square } from "lucide-react";

type MecanicaType = 'presente' | 'caixa' | 'carta' | 'adesivo' | 'postit' | 'fio' | 'velha' | 'papel' | 'balao' | 'cupom' | 'generico';
type FrameType = 'inicial' | 'intermediario' | 'final';
type EstiloVariant = 'neon' | 'flat' | 'glass' | 'realista' | 'default';

interface BannerSimuladorProps {
  brand: Brand;
  headline: string;
  subHeadline: string;
  cta: string;
  mecanicaText: string;
  recompensa: string;
  paleta: { nome: string; cores: string[] };
  estiloIlustracao?: string;
}

// ─── Color helpers ────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

function darken(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `#${rgb.map(v => Math.round(v * factor).toString(16).padStart(2, '0')).join('')}`;
}

function detectEstilo(estilo?: string): EstiloVariant {
  if (!estilo) return 'default';
  const e = estilo.toLowerCase();
  if (e.includes('neon') || e.includes('vibrante')) return 'neon';
  if (e.includes('flat') || e.includes('2d')) return 'flat';
  if (e.includes('glass') || e.includes('glassmorphism')) return 'glass';
  if (e.includes('3d') || e.includes('realista')) return 'realista';
  return 'default';
}

function getBannerBg(mecanica: MecanicaType, primary: string, accent: string, estilo: EstiloVariant): string {
  const lightBgMechanics: MecanicaType[] = ['velha', 'balao'];
  if (lightBgMechanics.includes(mecanica)) {
    return estilo === 'neon'
      ? `linear-gradient(160deg, ${primary}22 0%, ${accent}18 100%)`
      : `linear-gradient(160deg, ${primary}15 0%, ${primary}22 100%)`;
  }
  const dark1 = darken(primary, 0.55);
  const dark2 = darken(primary, 0.35);
  if (estilo === 'neon') return `linear-gradient(160deg, ${dark2} 0%, ${dark1} 40%, ${darken(accent, 0.45)} 100%)`;
  if (estilo === 'glass') return `linear-gradient(160deg, ${dark1}f0 0%, ${dark2}e0 100%)`;
  if (estilo === 'flat') return `linear-gradient(160deg, ${dark1} 0%, ${dark1} 100%)`;
  return `linear-gradient(160deg, ${dark1} 0%, ${dark2} 100%)`;
}

function detectMecanica(text: string): MecanicaType {
  const m = text.toLowerCase();
  if (m.includes('velha') || m.includes('jogo da')) return 'velha';
  if (m.includes('balão') || m.includes('balao')) return 'balao';
  if (m.includes('corte') || m.includes('cortando') || m.includes(' fio')) return 'fio';
  if (m.includes('rasgue') || m.includes('rasgar') || m.includes(' papel')) return 'papel';
  if (m.includes('adesivo')) return 'adesivo';
  if (m.includes('post-it') || m.includes('post it') || m.includes('postit')) return 'postit';
  if (m.includes('cupom')) return 'cupom';
  if (m.includes('carta') || m.includes('envelope')) return 'carta';
  if (m.includes('caixa')) return 'caixa';
  if (m.includes('presente') || m.includes('gift') || m.includes('brinde')) return 'presente';
  if (m.startsWith('abra ') || m.startsWith('abrir ') || m.startsWith('abra o') || m.startsWith('abra a')) return 'presente';
  return 'generico';
}

function shortReward(r: string): string {
  if (!r) return 'PRESENTE ESPECIAL';
  return r.split(/[\n+]/)[0].trim().split(' ').slice(0, 6).join(' ');
}

// ─── Reward badge ─────────────────────────────────────────────────────────────
function RewardBadge({ recompensa, accent, estilo }: { recompensa: string; accent: string; estilo: EstiloVariant }) {
  const bg = estilo === 'glass'
    ? `linear-gradient(135deg, ${accent}88 0%, ${accent}55 100%)`
    : `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`;
  const shadow = estilo === 'neon'
    ? `0 12px 32px ${accent}70, 0 0 28px ${accent}60, 0 0 0 2px rgba(255,255,255,0.35)`
    : `0 12px 32px ${accent}70, 0 0 0 2px rgba(255,255,255,0.35)`;

  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 14 }}
      className="relative overflow-hidden rounded-2xl px-5 py-4 text-center"
      style={{ background: bg, backdropFilter: estilo === 'glass' ? 'blur(12px)' : undefined, boxShadow: shadow, minWidth: 160 }}
    >
      <div className="absolute top-0 right-0 w-20 h-12 bg-white/15 -skew-y-12 translate-x-8 -translate-y-4 pointer-events-none" />
      <p className="text-[9px] uppercase tracking-widest font-extrabold text-white/70">Sua recompensa</p>
      <p className="text-base font-black text-white leading-tight mt-0.5">{shortReward(recompensa)}</p>
      <motion.div
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="absolute inset-0 rounded-2xl"
        style={{ boxShadow: `0 0 24px ${accent}80` }}
      />
    </motion.div>
  );
}

function Sparkles({ color }: { color: string }) {
  const positions = [
    { left: '10%', top: '15%', delay: 0 },
    { left: '75%', top: '10%', delay: 0.2 },
    { left: '85%', top: '55%', delay: 0.4 },
    { left: '15%', top: '65%', delay: 0.6 },
    { left: '50%', top: '5%',  delay: 0.1 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {positions.map((p, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{ left: p.left, top: p.top, background: color }}
          animate={{ opacity: [0, 1, 0], scale: [0, 1.4, 0], y: [0, -12, 0] }}
          transition={{ duration: 1.4, delay: p.delay, repeat: Infinity }}
        />
      ))}
    </div>
  );
}

// ─── PRESENTE ─────────────────────────────────────────────────────────────────
function FramePresente({ frame, primary, accent, recompensa, estilo }: { frame: FrameType; primary: string; accent: string; recompensa: string; estilo: EstiloVariant }) {
  const boxBg = `linear-gradient(150deg, ${darken(primary, 0.6)} 0%, ${darken(primary, 0.4)} 100%)`;
  const lidBg = `linear-gradient(150deg, ${darken(primary, 0.65)} 0%, ${darken(primary, 0.52)} 100%)`;
  const ribbon = accent;
  const dropShadow = estilo === 'neon'
    ? `drop-shadow(0 16px 28px rgba(0,0,0,0.5)) drop-shadow(0 0 16px ${accent}60)`
    : 'drop-shadow(0 16px 28px rgba(0,0,0,0.5))';

  if (frame === 'final') return (
    <div className="relative flex flex-col items-center justify-center w-full h-full gap-2">
      <Sparkles color={accent} />
      <div className="w-36 h-14 rounded-xl relative overflow-hidden" style={{ background: boxBg }}>
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-5" style={{ background: ribbon, opacity: 0.8 }} />
        <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent" />
      </div>
      <RewardBadge recompensa={recompensa} accent={accent} estilo={estilo} />
    </div>
  );

  const Box = (
    <div className="relative" style={{ filter: dropShadow }}>
      <div className="absolute" style={{ bottom: -6, left: '10%', right: '10%', height: 12, background: accent, opacity: 0.25, filter: 'blur(8px)', borderRadius: '50%' }} />
      <div className="w-36 h-28 rounded-xl overflow-hidden relative" style={{ background: boxBg, boxShadow: '0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)' }}>
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6" style={{ background: ribbon, opacity: 0.85 }} />
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-6" style={{ background: ribbon, opacity: 0.85 }} />
        <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-gradient-to-br from-white/15 to-transparent" />
      </div>
      <motion.div
        animate={frame === 'intermediario' ? { rotateX: [0, 30, 0] } : {}}
        transition={{ duration: 1.4, repeat: Infinity }}
        style={{ position: 'absolute', top: -18, left: -9, right: -9, height: 42, borderRadius: 10, background: lidBg, transformOrigin: 'bottom center', boxShadow: '0 -4px 12px rgba(0,0,0,0.3)' }}
      >
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6" style={{ background: ribbon, opacity: 0.85 }} />
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl" />
      </motion.div>
      <div style={{ position: 'absolute', top: -50, left: '50%', transform: 'translateX(-50%)', width: 56, height: 30 }}>
        <div style={{ position: 'absolute', left: 2, top: 4, width: 22, height: 16, borderRadius: '50%', background: ribbon, transform: 'rotate(-25deg)', transformOrigin: 'right center' }} />
        <div style={{ position: 'absolute', right: 2, top: 4, width: 22, height: 16, borderRadius: '50%', background: ribbon, transform: 'rotate(25deg)', transformOrigin: 'left center' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 13, height: 13, borderRadius: '50%', background: ribbon, zIndex: 2, boxShadow: `0 0 10px ${ribbon}` }} />
      </div>
    </div>
  );

  if (frame === 'intermediario') return (
    <motion.div animate={{ rotate: [-2, 2, -2, 2, 0], y: [0, -4, 0, -4, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
      {Box}
    </motion.div>
  );
  return Box;
}

// ─── CARTA / ENVELOPE ─────────────────────────────────────────────────────────
function FrameCarta({ frame, isApice, primary, accent, recompensa, estilo }: { frame: FrameType; isApice: boolean; primary: string; accent: string; recompensa: string; estilo: EstiloVariant }) {
  const envBg = `linear-gradient(160deg, ${primary}12 0%, ${primary}20 100%)`;
  const sealColor = primary;
  const flapBg = `linear-gradient(160deg, ${primary}20 0%, ${primary}32 100%)`;
  const outerShadow = estilo === 'neon'
    ? '0 12px 32px rgba(0,0,0,0.4), 0 0 20px ' + primary + '50'
    : '0 12px 32px rgba(0,0,0,0.4)';

  if (frame === 'final') return (
    <div className="relative flex flex-col items-center gap-2 w-full">
      <Sparkles color={accent} />
      <div className="w-44 rounded-2xl overflow-hidden" style={{ boxShadow: outerShadow }}>
        <div className="py-3 px-5" style={{ background: `linear-gradient(150deg, ${sealColor}20, ${sealColor}40)`, borderBottom: `2px solid ${sealColor}40` }}>
          <p className="text-[9px] uppercase tracking-widest font-bold text-center" style={{ color: sealColor }}>Carta Revelada</p>
        </div>
        <div className="bg-white py-4 px-5 text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Sua recompensa</p>
          <p className="text-base font-black leading-tight" style={{ color: sealColor }}>{shortReward(recompensa)}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative flex items-center justify-center" style={{ filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.35))' }}>
      <div className="w-44 h-32 rounded-xl relative overflow-hidden" style={{ background: estilo === 'flat' ? `${primary}20` : envBg, boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, transparent 49%, rgba(0,0,0,0.06) 49%, rgba(0,0,0,0.06) 51%, transparent 51%)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(225deg, transparent 49%, rgba(0,0,0,0.06) 49%, rgba(0,0,0,0.06) 51%, transparent 51%)' }} />
        {frame === 'intermediario' && (
          <motion.div
            animate={{ y: [-4, 0, -4] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="absolute bottom-2 left-4 right-4 h-12 rounded bg-white"
            style={{ boxShadow: '0 -4px 12px rgba(0,0,0,0.1)' }}
          >
            <div className="w-2/3 h-1 rounded mx-auto mt-3 mb-1" style={{ background: sealColor, opacity: 0.4 }} />
            <div className="w-1/2 h-1 rounded mx-auto" style={{ background: sealColor, opacity: 0.25 }} />
          </motion.div>
        )}
      </div>
      <motion.div
        animate={frame === 'intermediario' ? { rotateX: [0, -35, 0] } : {}}
        transition={{ duration: 1.6, repeat: Infinity }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 52, background: flapBg, transformOrigin: 'top center', clipPath: 'polygon(0 0, 100% 0, 50% 100%)', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}
      />
      {frame === 'inicial' && (
        <div className="absolute" style={{
          top: 28, left: '50%', transform: 'translateX(-50%)',
          width: 36, height: 36, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${accent}ee, ${sealColor})`,
          boxShadow: estilo === 'neon'
            ? `0 4px 12px ${sealColor}80, 0 0 16px ${accent}60, 0 0 0 2px ${sealColor}30`
            : `0 4px 12px ${sealColor}80, 0 0 0 2px ${sealColor}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span className="text-white font-black text-[11px]">{isApice ? 'A' : 'B'}</span>
        </div>
      )}
    </div>
  );
}

// ─── CAIXA ────────────────────────────────────────────────────────────────────
function FrameCaixa({ frame, primary, accent, recompensa, estilo }: { frame: FrameType; primary: string; accent: string; recompensa: string; estilo: EstiloVariant }) {
  const boxBg = `linear-gradient(150deg, ${darken(primary, 0.55)} 0%, ${darken(primary, 0.38)} 100%)`;
  const lidBg = `linear-gradient(150deg, ${darken(primary, 0.62)} 0%, ${darken(primary, 0.50)} 100%)`;
  const band = accent;
  const boxShadow = estilo === 'neon'
    ? `0 8px 24px rgba(0,0,0,0.4), 0 0 20px ${accent}40`
    : '0 8px 24px rgba(0,0,0,0.4)';

  if (frame === 'final') return (
    <div className="relative flex flex-col items-center gap-2 w-full">
      <Sparkles color={accent} />
      <div className="w-40 h-10 rounded-b-xl relative overflow-hidden" style={{ background: boxBg }}>
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
      </div>
      <RewardBadge recompensa={recompensa} accent={accent} estilo={estilo} />
    </div>
  );

  return (
    <motion.div
      animate={frame === 'intermediario' ? { rotate: [-3, 3, -3, 3, 0], y: [0, -5, 0] } : {}}
      transition={{ duration: 0.8, repeat: Infinity }}
      className="relative"
      style={{ filter: 'drop-shadow(0 16px 24px rgba(0,0,0,0.5))' }}
    >
      <div className="w-40 h-28 rounded-xl overflow-hidden relative" style={{ background: boxBg, boxShadow }}>
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-5" style={{ background: band, opacity: 0.7 }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-lg font-black text-white/60">?</div>
        </div>
        <div className="absolute top-0 left-0 w-1/3 h-1/3 bg-gradient-to-br from-white/20 to-transparent" />
      </div>
      <div style={{ position: 'absolute', top: -10, left: -6, right: -6, height: 22, borderRadius: 8, background: lidBg, boxShadow: '0 -4px 10px rgba(0,0,0,0.3)' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent rounded-lg" />
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2" style={{ background: band, opacity: 0.7 }} />
      </div>
    </motion.div>
  );
}

// ─── ADESIVO ──────────────────────────────────────────────────────────────────
function FrameAdesivo({ frame, isApice, primary, accent, recompensa, estilo }: { frame: FrameType; isApice: boolean; primary: string; accent: string; recompensa: string; estilo: EstiloVariant }) {
  const stickerBg = estilo === 'flat'
    ? primary
    : `linear-gradient(135deg, ${primary}ee 0%, ${darken(primary, 0.65)}cc 100%)`;
  const stickerShadow = estilo === 'neon'
    ? `0 12px 32px ${primary}60, 0 0 28px ${accent}50, 0 0 0 3px rgba(255,255,255,0.2)`
    : `0 12px 32px ${primary}60, 0 0 0 3px rgba(255,255,255,0.2)`;

  if (frame === 'final') return (
    <div className="relative flex flex-col items-center gap-3 w-full">
      <Sparkles color={accent} />
      <div className="w-36 h-10 rounded-xl relative overflow-hidden opacity-40" style={{ background: stickerBg, transform: 'perspective(200px) rotateX(40deg)' }} />
      <div className="w-44 rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.25)', border: `2px dashed ${primary}50` }}>
        <div className="py-3 px-4 text-center">
          <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Oculto por baixo</p>
          <p className="text-base font-black mt-0.5 leading-tight" style={{ color: primary }}>{shortReward(recompensa)}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        animate={frame === 'intermediario' ? { rotateY: [0, -15, 0] } : {}}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="relative w-44 h-36 rounded-2xl overflow-hidden flex items-center justify-center"
        style={{ background: stickerBg, boxShadow: stickerShadow }}
      >
        <div className="absolute top-0 left-0 w-full h-full" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, transparent 50%, rgba(255,255,255,0.1) 100%)' }} />
        <div className="flex flex-col items-center text-center px-4">
          <span className="text-3xl">🏷️</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-white/80 mt-1">
            {isApice ? 'Apice' : 'Barbours'}
          </span>
        </div>
        {frame === 'intermediario' && (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="absolute bottom-0 right-0 w-10 h-10"
            style={{ background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.4) 50%)', borderRadius: '0 0 1rem 0' }}
          />
        )}
      </motion.div>
    </div>
  );
}

// ─── POST-IT ──────────────────────────────────────────────────────────────────
function FramePostit({ frame, accent, recompensa, estilo }: { frame: FrameType; accent: string; recompensa: string; estilo: EstiloVariant }) {
  const pinColor = accent;
  const noteColor = '#FBF1A9';
  const noteShadow = estilo === 'neon'
    ? `0 12px 32px rgba(0,0,0,0.3), 4px 4px 0 rgba(0,0,0,0.08), 0 0 24px ${accent}40`
    : '0 12px 32px rgba(0,0,0,0.3), 4px 4px 0 rgba(0,0,0,0.08)';

  if (frame === 'final') return (
    <div className="relative flex flex-col items-center justify-center w-full">
      <Sparkles color={accent} />
      <motion.div
        initial={{ rotate: -5, scale: 0.8 }}
        animate={{ rotate: 2, scale: 1 }}
        transition={{ type: 'spring', stiffness: 180 }}
        className="relative w-44 h-44 flex flex-col items-center justify-center p-4"
        style={{ background: noteColor, borderRadius: 4, transform: 'rotate(2deg)', boxShadow: noteShadow }}
      >
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full z-10"
          style={{ background: `radial-gradient(circle at 35% 30%, #ff8888, ${pinColor})`, boxShadow: `0 4px 10px ${pinColor}80` }} />
        <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Sua recompensa</p>
        <p className="text-sm font-black text-red-600 leading-snug text-center mt-1 line-clamp-3">{shortReward(recompensa)}</p>
      </motion.div>
    </div>
  );

  return (
    <motion.div
      animate={frame === 'intermediario' ? { rotate: [2, -3, 2], y: [0, -6, 0] } : {}}
      transition={{ duration: 1.4, repeat: Infinity }}
      className="relative flex items-center justify-center"
    >
      <div
        className="relative w-44 h-44 flex flex-col items-center justify-center p-4"
        style={{ background: noteColor, borderRadius: 4, transform: 'rotate(-2deg)', boxShadow: '0 12px 32px rgba(0,0,0,0.3), 4px 4px 0 rgba(0,0,0,0.08)' }}
      >
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full z-10"
          style={{ background: `radial-gradient(circle at 35% 30%, #ff8888, ${pinColor})`, boxShadow: `0 4px 10px ${pinColor}80` }} />
        <div className="flex flex-col gap-2 w-full px-2">
          <div className="h-2 rounded-full bg-slate-400/30 w-3/4 mx-auto" />
          <div className="h-2 rounded-full bg-slate-400/30 w-full mx-auto" />
          <div className="h-2 rounded-full bg-slate-400/30 w-2/3 mx-auto" />
        </div>
        {frame === 'intermediario' && (
          <motion.div
            animate={{ width: [32, 44, 32] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="absolute bottom-0 right-0 h-8"
            style={{ width: 32, background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,240,0.9) 50%)', filter: 'drop-shadow(-2px -2px 4px rgba(0,0,0,0.15))' }}
          />
        )}
      </div>
    </motion.div>
  );
}

// ─── CORTE O FIO ──────────────────────────────────────────────────────────────
function FrameFio({ frame, primary, accent, recompensa, estilo }: { frame: FrameType; primary: string; accent: string; recompensa: string; estilo: EstiloVariant }) {
  const pkgBg = `linear-gradient(150deg, ${darken(primary, 0.58)} 0%, ${darken(primary, 0.38)} 100%)`;
  const wireColor = accent;
  const pkgShadow = estilo === 'neon'
    ? `0 12px 28px rgba(0,0,0,0.4), 0 0 20px ${accent}50`
    : '0 12px 28px rgba(0,0,0,0.4)';

  if (frame === 'final') return (
    <div className="relative flex flex-col items-center gap-2 w-full">
      <Sparkles color={accent} />
      <div className="flex items-center gap-1 w-40">
        <div className="h-0.5 flex-1 rounded-full opacity-50" style={{ background: wireColor }} />
        <div className="text-xs font-black text-white opacity-60">✂️</div>
        <div className="h-0.5 flex-1 rounded-full opacity-50" style={{ background: wireColor }} />
      </div>
      <RewardBadge recompensa={recompensa} accent={accent} estilo={estilo} />
    </div>
  );

  return (
    <div className="relative flex items-center justify-center">
      <div className="w-36 h-28 rounded-xl relative overflow-hidden" style={{ background: pkgBg, boxShadow: pkgShadow }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(45deg, transparent 44%, ${wireColor} 44%, ${wireColor} 56%, transparent 56%)`, opacity: 0.8 }} />
        <div className="absolute inset-0" style={{ background: `linear-gradient(-45deg, transparent 44%, ${wireColor} 44%, ${wireColor} 56%, transparent 56%)`, opacity: 0.8 }} />
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
      </div>
      <motion.div
        animate={frame === 'intermediario' ? { x: [-20, 0, -20], rotate: [-10, 5, -10] } : { x: -24 }}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="absolute right-0 text-2xl"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
      >✂️</motion.div>
    </div>
  );
}

// ─── JOGO DA VELHA ────────────────────────────────────────────────────────────
function FrameVelha({ frame, primary, accent, recompensa, estilo }: { frame: FrameType; primary: string; accent: string; recompensa: string; estilo: EstiloVariant }) {
  const gridBg = `${primary}18`;
  const xColor = primary;
  const oColor = accent;
  const gridShadow = estilo === 'neon'
    ? `0 8px 24px rgba(0,0,0,0.2), 0 0 20px ${primary}30`
    : '0 8px 24px rgba(0,0,0,0.2)';

  const cells = [
    { v: 'X', active: false }, { v: 'O', active: false }, { v: 'X', active: false },
    { v: 'O', active: false }, { v: null, active: true  }, { v: 'O', active: false },
    { v: 'X', active: false }, { v: 'O', active: false }, { v: null, active: false },
  ];

  if (frame === 'final') return (
    <div className="relative flex flex-col items-center gap-3 w-full">
      <div className="relative" style={{ width: 120, height: 120 }}>
        <div className="absolute inset-0 grid grid-cols-3 gap-0" style={{ background: gridBg, borderRadius: 12, padding: 6, boxShadow: '0 8px 20px rgba(0,0,0,0.15)' }}>
          {[...'XOXOOXXOX'].map((v, i) => (
            <div key={i} className="flex items-center justify-center text-lg font-black" style={{
              color: v === 'X' ? xColor : oColor,
              background: i === 1 || i === 4 || i === 7 ? `${xColor}20` : 'transparent',
              borderRadius: 6,
            }}>{v}</div>
          ))}
        </div>
        <motion.div
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          style={{ position: 'absolute', top: 8, bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 4, background: xColor, borderRadius: 2, opacity: 0.7 }}
        />
      </div>
      <RewardBadge recompensa={recompensa} accent={accent} estilo={estilo} />
    </div>
  );

  return (
    <div className="relative">
      <div style={{ width: 140, height: 140, background: gridBg, borderRadius: 14, padding: 8, boxShadow: gridShadow }}>
        <div className="absolute inset-0" style={{ padding: 8 }}>
          <div style={{ position: 'absolute', top: '33%', left: 8, right: 8, height: 2, background: primary, opacity: 0.3, borderRadius: 1 }} />
          <div style={{ position: 'absolute', top: '66%', left: 8, right: 8, height: 2, background: primary, opacity: 0.3, borderRadius: 1 }} />
          <div style={{ position: 'absolute', left: '33%', top: 8, bottom: 8, width: 2, background: primary, opacity: 0.3, borderRadius: 1 }} />
          <div style={{ position: 'absolute', left: '66%', top: 8, bottom: 8, width: 2, background: primary, opacity: 0.3, borderRadius: 1 }} />
        </div>
        <div className="relative grid grid-cols-3 gap-1 h-full">
          {cells.map((cell, i) => (
            <div key={i} className="flex items-center justify-center text-base font-black" style={{ borderRadius: 4 }}>
              {cell.v === 'X' && <span style={{ color: xColor }}>X</span>}
              {cell.v === 'O' && <span style={{ color: oColor }}>O</span>}
              {cell.v === null && cell.active && frame === 'intermediario' && (
                <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8, repeat: Infinity }} style={{ color: xColor }}>X</motion.span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── RASGUE O PAPEL ───────────────────────────────────────────────────────────
function FramePapel({ frame, primary, accent, recompensa, estilo }: { frame: FrameType; primary: string; accent: string; recompensa: string; estilo: EstiloVariant }) {
  const paperShadow = estilo === 'neon'
    ? `0 12px 28px ${primary}60, 0 0 24px ${accent}50`
    : `0 12px 28px ${primary}60`;

  if (frame === 'final') return (
    <div className="relative flex flex-col items-center gap-2 w-full">
      <Sparkles color={accent} />
      <div className="flex gap-1 mb-1">
        {['-8deg', '3deg', '-5deg', '7deg'].map((r, i) => (
          <div key={i} className="w-8 h-6 rounded-sm opacity-40" style={{ background: primary, transform: `rotate(${r})` }} />
        ))}
      </div>
      <RewardBadge recompensa={recompensa} accent={accent} estilo={estilo} />
    </div>
  );

  return (
    <motion.div
      animate={frame === 'intermediario' ? { rotate: [0, -2, 2, -2, 0] } : {}}
      transition={{ duration: 0.8, repeat: Infinity }}
      className="relative flex items-center justify-center"
    >
      <div className="relative w-40 h-32 flex items-center justify-center"
        style={{ background: `linear-gradient(145deg, ${primary}cc, ${primary})`, borderRadius: 12, boxShadow: paperShadow }}
      >
        <div className="absolute inset-4 opacity-20">
          {[0,1,2,3].map(i => <div key={i} className="h-px bg-white mb-3 rounded" />)}
        </div>
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-5" style={{ background: 'rgba(255,255,255,0.3)' }} />
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-5" style={{ background: 'rgba(255,255,255,0.3)' }} />
        {frame === 'intermediario' && (
          <motion.div
            animate={{ width: [20, 36, 20] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="absolute top-0 right-0 h-8"
            style={{ width: 20, background: 'linear-gradient(225deg, #fff8 0%, transparent 50%)', borderRadius: '0 12px 0 0' }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent rounded-xl" />
      </div>
    </motion.div>
  );
}

// ─── ESTOURE O BALÃO ──────────────────────────────────────────────────────────
function FrameBalao({ frame, primary, accent, recompensa, estilo }: { frame: FrameType; primary: string; accent: string; recompensa: string; estilo: EstiloVariant }) {
  const balloonShadow = estilo === 'neon'
    ? `0 8px 24px ${primary}60, inset 0 -8px 16px rgba(0,0,0,0.2), 0 0 32px ${primary}50`
    : `0 8px 24px ${primary}60, inset 0 -8px 16px rgba(0,0,0,0.2)`;

  if (frame === 'final') return (
    <div className="relative flex flex-col items-center gap-2 w-full">
      <div className="relative flex items-center justify-center w-full h-20">
        {[[-30,-20,'20%'],[30,-25,'60%'],[-10,-30,'40%'],[20,-10,'75%'],[-20,-5,'25%']].map(([x,y,l],i) => (
          <motion.div key={i} className="absolute w-2.5 h-2.5 rounded-full"
            style={{ left: l as string, top: '50%', background: i % 2 === 0 ? primary : accent }}
            animate={{ x:[0,(x as number)*2], y:[0,(y as number)*2], opacity:[1,0] }}
            transition={{ duration: 0.8, delay: i*0.08, repeat: Infinity, repeatDelay: 1.5 }}
          />
        ))}
        <span className="text-3xl">💥</span>
      </div>
      <RewardBadge recompensa={recompensa} accent={accent} estilo={estilo} />
    </div>
  );

  return (
    <div className="relative flex flex-col items-center">
      <motion.div
        animate={{ y: frame === 'intermediario' ? [0,-6,0] : [0,-4,0], scale: frame === 'intermediario' ? [1,1.04,1] : [1,1.02,1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="relative flex items-center justify-center"
        style={{ filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.3))' }}
      >
        <div style={{ width:120, height:140, borderRadius:'50% 50% 50% 50% / 55% 55% 45% 45%', background:`radial-gradient(circle at 35% 30%, ${primary}ff, ${primary}aa)`, boxShadow: balloonShadow, position:'relative' }}>
          <div style={{ position:'absolute', top:'15%', left:'25%', width:24, height:18, borderRadius:'50%', background:'rgba(255,255,255,0.4)', transform:'rotate(-20deg)' }} />
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ color:'rgba(255,255,255,0.4)', fontSize:40, fontWeight:900 }}>✿</span>
          </div>
        </div>
        <div style={{ position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)', width:10, height:10, borderRadius:'50%', background:primary }} />
        <div style={{ position:'absolute', bottom:-30, left:'50%', transform:'translateX(-50%)', width:1, height:30, background:`${primary}80` }} />
      </motion.div>
      {frame === 'intermediario' && (
        <motion.div
          animate={{ x:[30,8,30] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="absolute right-4 top-4 text-lg"
          style={{ transform:'rotate(-45deg)', filter:`drop-shadow(0 2px 4px ${accent}80)` }}
        >📍</motion.div>
      )}
    </div>
  );
}

// ─── GENÉRICO ─────────────────────────────────────────────────────────────────
function FrameGenerico({ frame, primary, accent, recompensa, mecanicaText, estilo }: { frame: FrameType; primary: string; accent: string; recompensa: string; mecanicaText: string; estilo: EstiloVariant }) {
  const orbShadow = estilo === 'neon'
    ? `0 0 0 3px ${primary}40, 0 0 60px ${primary}70, 0 0 100px ${accent}40`
    : `0 0 0 3px ${primary}40, 0 0 40px ${primary}50`;

  if (frame === 'final') return (
    <div className="relative flex flex-col items-center gap-3 w-full">
      <Sparkles color={accent} />
      <div className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
        style={{ background: `${primary}30`, color: primary, border: `1px solid ${primary}50` }}>
        {mecanicaText}
      </div>
      <RewardBadge recompensa={recompensa} accent={accent} estilo={estilo} />
    </div>
  );

  return (
    <motion.div
      animate={frame === 'intermediario' ? { scale:[1,1.08,1,1.08,1], rotate:[0,5,-5,5,0] } : { y:[0,-4,0] }}
      transition={{ duration: 1.6, repeat: Infinity }}
      className="relative flex flex-col items-center gap-3"
    >
      <div className="relative flex items-center justify-center" style={{ filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.4))' }}>
        <div style={{ width:120, height:120, borderRadius:'50%', background:`radial-gradient(circle at 35% 30%, ${accent}cc, ${primary}aa)`, boxShadow: orbShadow, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:'18%', left:'22%', width:28, height:20, borderRadius:'50%', background:'rgba(255,255,255,0.35)', transform:'rotate(-20deg)' }} />
          {frame === 'inicial'
            ? <span style={{ fontSize:40, color:'rgba(255,255,255,0.7)', fontWeight:900 }}>?</span>
            : <motion.span animate={{ opacity:[0.5,1,0.5] }} transition={{ duration:0.5, repeat:Infinity }} style={{ fontSize:36 }}>⚡</motion.span>
          }
        </div>
        <div style={{ position:'absolute', inset:-8, borderRadius:'50%', border:`2px solid ${primary}40`, animation:'spin 4s linear infinite' }} />
      </div>
      <div className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
        style={{ background:`${primary}25`, color:'rgba(255,255,255,0.7)', border:`1px solid ${primary}40` }}>
        {mecanicaText || 'Mecânica IA'}
      </div>
    </motion.div>
  );
}

// ─── PUXE O CUPOM ─────────────────────────────────────────────────────────────
function FrameCupom({ frame, isApice, primary, accent, recompensa, estilo }: { frame: FrameType; isApice: boolean; primary: string; accent: string; recompensa: string; estilo: EstiloVariant }) {
  const stripeColor = primary;
  const outerShadow = estilo === 'neon'
    ? `0 12px 28px rgba(0,0,0,0.3), 0 0 20px ${stripeColor}50`
    : '0 12px 28px rgba(0,0,0,0.3)';

  if (frame === 'final') return (
    <div className="relative flex flex-col items-center gap-2 w-full">
      <Sparkles color={accent} />
      <div className="w-44 rounded-xl overflow-hidden" style={{ boxShadow: outerShadow, border: `2px solid ${stripeColor}30` }}>
        <div className="h-3 w-full" style={{ background: `repeating-linear-gradient(90deg, ${stripeColor} 0px, ${stripeColor} 8px, transparent 8px, transparent 16px)` }} />
        <div className="bg-white py-4 px-5 text-center">
          <p className="text-[9px] uppercase tracking-widest font-extrabold" style={{ color: stripeColor }}>Cupom Liberado</p>
          <p className="text-base font-black text-slate-800 mt-1 leading-tight">{shortReward(recompensa)}</p>
          <div className="mt-2 px-3 py-1 rounded text-[10px] font-black tracking-widest" style={{ background: `${stripeColor}15`, color: stripeColor }}>
            {isApice ? 'APICEHITS' : 'BARBGOLD'}
          </div>
        </div>
        <div className="h-2 w-full" style={{ background: `repeating-linear-gradient(90deg, ${stripeColor} 0px, ${stripeColor} 8px, transparent 8px, transparent 16px)` }} />
      </div>
    </div>
  );

  return (
    <motion.div
      animate={frame === 'intermediario' ? { y:[-4,4,-4] } : {}}
      transition={{ duration: 1, repeat: Infinity }}
      className="relative flex items-center justify-center"
    >
      <div className="w-44 rounded-2xl overflow-hidden relative"
        style={{ background:`linear-gradient(150deg, ${stripeColor}20, ${stripeColor}10)`, border:`2px solid ${stripeColor}30`, boxShadow:'0 8px 20px rgba(0,0,0,0.2)' }}
      >
        <div className="h-3" style={{ background:`repeating-linear-gradient(90deg, ${stripeColor} 0px, ${stripeColor} 8px, transparent 8px, transparent 16px)` }} />
        <div className="py-4 px-5 flex flex-col items-center">
          <div className="h-2 w-3/4 rounded mb-2" style={{ background:`${stripeColor}30` }} />
          <div className="h-2 w-1/2 rounded mb-2" style={{ background:`${stripeColor}20` }} />
          <div className="h-2 w-2/3 rounded" style={{ background:`${stripeColor}15` }} />
        </div>
        <div className="h-px w-full" style={{ background:`repeating-linear-gradient(90deg, ${stripeColor}80 0px, ${stripeColor}80 6px, transparent 6px, transparent 12px)` }} />
        {frame === 'intermediario' && (
          <motion.div
            animate={{ y:[0,6,0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="h-5 w-full flex items-center justify-center"
            style={{ background:`${stripeColor}15` }}
          >
            <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color:stripeColor }}>Puxar ▼</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function BannerSimulador({
  brand, headline, subHeadline, cta, mecanicaText, recompensa, paleta, estiloIlustracao,
}: BannerSimuladorProps) {
  const isApice = brand === 'Apice';
  const [activeFrame, setActiveFrame] = useState<FrameType>('inicial');
  const [isPlaying, setIsPlaying] = useState(false);

  const primaryColor = paleta?.cores?.[0] || (isApice ? '#688D65' : '#BF0F26');
  const accentColor  = paleta?.cores?.[1] || (isApice ? '#D553A5' : '#AA834B');
  const estilo = detectEstilo(estiloIlustracao);
  const mecanica = detectMecanica(mecanicaText);

  useEffect(() => {
    let iv: NodeJS.Timeout;
    if (isPlaying) {
      iv = setInterval(() => {
        setActiveFrame(p => p === 'inicial' ? 'intermediario' : p === 'intermediario' ? 'final' : 'inicial');
      }, 2200);
    }
    return () => clearInterval(iv);
  }, [isPlaying]);

  const bannerBg = getBannerBg(mecanica, primaryColor, accentColor, estilo);

  const lightBgMechanics: MecanicaType[] = ['velha', 'balao'];
  const isLightBg = lightBgMechanics.includes(mecanica);
  const headlineColor = isLightBg
    ? (isApice ? '#1b3d2b' : '#3d060e')
    : (isApice ? '#d4edda' : '#f5e0c8');
  const subColor = isLightBg ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)';

  const bannerFilter: string | undefined = {
    neon: 'saturate(1.5) brightness(1.05)',
    flat: 'saturate(0.65)',
    glass: 'brightness(0.92)',
    realista: 'contrast(1.05) brightness(0.97)',
    default: undefined,
  }[estilo];

  const centralWrapStyle: CSSProperties = estilo === 'glass'
    ? { backdropFilter: 'blur(8px)', background: `${primaryColor}15`, borderRadius: 20, padding: 12 }
    : estilo === 'neon'
    ? { filter: `drop-shadow(0 0 12px ${primaryColor}80) drop-shadow(0 0 24px ${accentColor}40)` }
    : {};

  const visualProps = { primary: primaryColor, accent: accentColor, estilo, recompensa };

  function renderElement() {
    switch (mecanica) {
      case 'carta':    return <FrameCarta    frame={activeFrame} isApice={isApice} {...visualProps} />;
      case 'caixa':    return <FrameCaixa    frame={activeFrame} {...visualProps} />;
      case 'adesivo':  return <FrameAdesivo  frame={activeFrame} isApice={isApice} {...visualProps} />;
      case 'postit':   return <FramePostit   frame={activeFrame} accent={accentColor} recompensa={recompensa} estilo={estilo} />;
      case 'fio':      return <FrameFio      frame={activeFrame} {...visualProps} />;
      case 'velha':    return <FrameVelha    frame={activeFrame} {...visualProps} />;
      case 'papel':    return <FramePapel    frame={activeFrame} {...visualProps} />;
      case 'balao':    return <FrameBalao    frame={activeFrame} {...visualProps} />;
      case 'cupom':    return <FrameCupom    frame={activeFrame} isApice={isApice} {...visualProps} />;
      case 'generico': return <FrameGenerico frame={activeFrame} {...visualProps} mecanicaText={mecanicaText} />;
      default:         return <FramePresente frame={activeFrame} {...visualProps} />;
    }
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      <div className="w-full bg-slate-900 border border-slate-800 rounded-[2.5rem] p-3 shadow-2xl relative overflow-hidden max-w-[430px] mx-auto select-none">
        {/* Notch */}
        <div className="absolute top-0 inset-x-0 h-6 flex justify-center items-center z-20">
          <div className="w-28 h-4 bg-slate-950 rounded-b-xl flex items-center justify-around px-2 text-[8px] text-slate-500 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
            <span>CRM VIEW</span>
            <span className="w-1.5 h-[3px] rounded bg-slate-800" />
          </div>
        </div>
        {/* Status bar */}
        <div className="w-full flex justify-between px-6 pt-3 pb-3 text-[10px] text-slate-400 font-bold font-mono">
          <span>09:41</span>
          <div className="flex gap-1.5 items-center">
            <span className="text-[9px] bg-slate-800 text-slate-350 px-1.5 py-0.2 rounded leading-none uppercase">LTE</span>
            <div className="w-4.5 h-2.5 border border-slate-500 rounded-sm p-0.5 flex">
              <div className="bg-slate-400 flex-1 rounded-2xs" />
            </div>
          </div>
        </div>

        {/* Email body */}
        <div className="bg-white rounded-[1.8rem] overflow-y-auto max-h-[580px] border border-slate-100 flex flex-col text-slate-800 text-left font-sans">
          {/* Brand header */}
          <div className="w-full py-4.5 px-6 flex justify-center items-center shrink-0"
            style={{ backgroundColor: isApice ? '#325E49' : '#BF0F26' }}>
            {isApice ? (
              <div className="flex flex-col items-center text-white text-center">
                <span className="font-serif-brand tracking-normal italic text-3xl font-extrabold -mb-1">Apice</span>
                <span className="text-[9px] uppercase font-bold tracking-[0.25em] text-emerald-100 opacity-90">COSMÉTICOS</span>
              </div>
            ) : (
              <div className="flex flex-col items-center text-white text-center">
                <span className="font-serif-brand tracking-wide italic text-2xl font-extrabold -mb-1">Barbours</span>
                <span className="text-[9px] uppercase font-bold tracking-[0.25em] text-amber-100 opacity-90">BEAUTY</span>
              </div>
            )}
          </div>

          {/* Banner area */}
          <div
            className="w-full aspect-square relative overflow-hidden flex flex-col items-center justify-between p-5 shrink-0 transition-all duration-300"
            style={{ background: bannerBg, filter: bannerFilter }}
          >
            {/* Headline */}
            <div className="w-full flex flex-col items-center text-center z-10">
              {isApice ? (
                <h3 className="font-serif-brand italic text-2xl font-extrabold leading-tight max-w-[280px] drop-shadow-sm" style={{ color: headlineColor }}>
                  {headline || 'Abra o presente'}
                </h3>
              ) : (
                <h3 className="font-sans font-black uppercase text-2xl tracking-tight leading-none max-w-[280px] drop-shadow" style={{ color: headlineColor }}>
                  {(headline || 'Abra o presente').toUpperCase()}
                </h3>
              )}
              <p className="text-[10px] font-bold uppercase tracking-wider max-w-[290px] leading-tight mt-1.5" style={{ color: subColor }}>
                {subHeadline || ''}
              </p>
            </div>

            {/* Central mechanic element */}
            <div className="flex-1 w-full flex items-center justify-center relative my-1 z-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${mecanica}-${activeFrame}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.22 }}
                  className="w-full flex items-center justify-center"
                  style={centralWrapStyle}
                >
                  {renderElement()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* CTA button */}
            <div className="w-full flex justify-center pb-1 z-10">
              {isApice ? (
                <button disabled className="text-white text-xs font-black uppercase tracking-[0.2em] px-8 py-2.5 rounded-full select-none"
                  style={{
                    background: primaryColor,
                    boxShadow: estilo === 'neon'
                      ? `0 4px 16px ${primaryColor}80, 0 0 24px ${primaryColor}60`
                      : `0 4px 16px ${primaryColor}80`,
                  }}>
                  {cta || 'PUXAR'}
                </button>
              ) : (
                <button disabled className="bg-black text-white border-2 border-dashed text-xs font-black uppercase tracking-[0.22em] px-8 py-2.5 rounded-lg select-none"
                  style={{ borderColor: accentColor }}>
                  {cta || 'ABRIR'}
                </button>
              )}
            </div>
          </div>

          {/* Email body text */}
          <div className="py-6 px-6 bg-white flex flex-col gap-4 text-xs text-slate-700 leading-relaxed border-t border-slate-100">
            <p className="font-medium">
              Já preparei sua nova surpresa... E tenho certeza que você não estava esperando algo assim, porque hoje eu trouxe presentes juntos no seu carrinho!
            </p>
            <p className="font-medium">
              Me diz se eu não sou a melhor em te presentear. Você tem até 00h para conseguir tudo,{' '}
              <span className="text-indigo-600 underline font-bold cursor-pointer">clicando aqui</span>.
            </p>
            <div className="pt-2 font-semibold flex flex-col text-slate-800">
              <span>Abraços,</span>
              <span className="font-serif-brand italic text-base mt-0.5" style={{ color: isApice ? '#325E49' : '#BF0F26' }}>
                {isApice ? 'Apice' : 'Barbours'}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="py-8 px-6 bg-[#EFEFEF] flex flex-col items-center text-center gap-4 border-t border-slate-200 shrink-0">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-base font-black shadow-sm"
              style={{ backgroundColor: isApice ? '#325E49' : '#BF0F26' }}>
              {isApice ? 'A' : 'B'}
            </div>
            <div className="flex flex-col gap-1 text-[10px] text-slate-500 font-medium">
              <span>© 2025 {isApice ? 'Apice Cosméticos' : 'Barbours Beauty'}</span>
              <span>Avenida Fernando Ferrari, 2675, Vitória, Brazil</span>
            </div>
            <span className="text-[10px] font-bold text-slate-500 underline cursor-pointer pt-1">Cancelar assinatura</span>
          </div>
        </div>

        {/* Home indicator */}
        <div className="w-full flex justify-center pb-2 pt-4">
          <div className="w-32 h-1 bg-slate-800 rounded-full" />
        </div>
      </div>

      {/* Frame controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-900 p-3 rounded-2xl border border-slate-800 gap-3 max-w-[430px] mx-auto w-full">
        <div className="flex gap-1">
          {(['inicial', 'intermediario', 'final'] as const).map((f, i) => (
            <button key={f}
              onClick={() => { setActiveFrame(f); setIsPlaying(false); }}
              className={`px-3 py-1.5 text-[10px] uppercase font-extrabold tracking-wider rounded-lg transition-all cursor-pointer ${
                activeFrame === f
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}>
              {['F1: Fechado', 'F2: Ação', 'F3: Revelação'][i]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`px-3 py-1.5 text-[10px] uppercase font-extrabold tracking-widest rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
            isPlaying ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
          }`}>
          {isPlaying ? <><Square className="w-3 h-3 fill-current" />Pausar</> : <><Play className="w-3 h-3 fill-current" />Assistir GIF</>}
        </button>
      </div>
    </div>
  );
}

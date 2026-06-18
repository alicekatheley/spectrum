import { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';

function generateStars(count: number, seed: number): string {
  const shadows: string[] = [];
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const x = Math.abs(s % 1920);
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const y = Math.abs(s % 1080);
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const op = (Math.abs(s % 7) + 3) / 10;
    shadows.push(`${x}px ${y}px 0 rgba(255,255,255,${op})`);
  }
  return shadows.join(', ');
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const stars1 = useMemo(() => generateStars(300, 42), []);
  const stars2 = useMemo(() => generateStars(150, 137), []);
  const stars3 = useMemo(() => generateStars(60, 999), []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase!.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            hd: 'gocase.com.br',
          },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError('Erro ao fazer login. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#05060F' }}
    >
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes twinkleSlow {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.7; }
        }
        .login-orb { animation: float 8s ease-in-out infinite; }
        .login-card { animation: fadeInUp 0.6s ease both; }
        .stars-1 { animation: twinkle 3.5s ease-in-out infinite; }
        .stars-2 { animation: twinkle 4.8s ease-in-out infinite 1.2s; }
        .stars-3 { animation: twinkleSlow 6s ease-in-out infinite 2.4s; }
        @media (prefers-reduced-motion: reduce) {
          .login-orb, .login-card, .stars-1, .stars-2, .stars-3 {
            animation: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>

      {/* Camada de estrelas — 3 tamanhos */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="stars-1 absolute inset-0"
          style={{ boxShadow: stars1, width: 1, height: 1, borderRadius: '50%' }}
        />
        <div
          className="stars-2 absolute inset-0"
          style={{ boxShadow: stars2, width: 2, height: 2, borderRadius: '50%' }}
        />
        <div
          className="stars-3 absolute inset-0"
          style={{ boxShadow: stars3, width: 3, height: 3, borderRadius: '50%' }}
        />
      </div>

      {/* Orbe superior direito */}
      <div
        className="login-orb absolute pointer-events-none"
        style={{
          top: '-120px',
          right: '-120px',
          width: '480px',
          height: '480px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 40%, #C026D3, #7C3AED 50%, transparent 70%)',
          boxShadow: [
            '0 0 80px 20px rgba(124,58,237,0.35)',
            '0 0 160px 60px rgba(192,38,211,0.2)',
            '0 0 260px 100px rgba(236,72,153,0.1)',
          ].join(', '),
          opacity: 0.9,
        }}
      />

      {/* Glow ambiente inferior esquerdo */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '-80px',
          left: '-80px',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.15), transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Card */}
      <div
        className="login-card relative z-10 w-full flex flex-col items-center gap-6 mx-4 sm:mx-0"
        style={{
          maxWidth: '420px',
          padding: 'clamp(32px, 5vw, 48px)',
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', paddingLeft: '32px', overflow: 'visible' }}>
            <svg viewBox="0 0 140 160" xmlns="http://www.w3.org/2000/svg" width="80" height="80" style={{ overflow: 'visible' }}>
              <defs>
                <style>{`
                  @keyframes shimmer { 0%,100%{opacity:0.85} 50%{opacity:1} }
                  .glow { animation: shimmer 3s ease-in-out infinite; }
                `}</style>
              </defs>
              <ellipse cx="70" cy="125" rx="38" ry="10" fill="#7C3AED" opacity="0.15"/>
              <polygon points="70,10 118,100 22,100"
                fill="#0F0720" stroke="#8B5CF6" strokeWidth="2.5" strokeLinejoin="round"/>
              <line x1="22" y1="100" x2="70" y2="10" stroke="#A855F7" strokeWidth="0.75" opacity="0.3"/>
              <circle cx="70" cy="10" r="4" fill="#C084FC" className="glow"/>
              <circle cx="70" cy="10" r="8" fill="none" stroke="#A855F7" strokeWidth="0.75" opacity="0.4"/>
              <line x1="70" y1="-8" x2="70" y2="10" stroke="#C084FC" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
              <line x1="22" y1="100" x2="-18" y2="72"  stroke="#7C3AED" strokeWidth="3"    strokeLinecap="round"/>
              <line x1="22" y1="100" x2="-24" y2="88"  stroke="#9333EA" strokeWidth="2.5"  strokeLinecap="round" opacity="0.9"/>
              <line x1="22" y1="100" x2="-26" y2="104" stroke="#A855F7" strokeWidth="2"    strokeLinecap="round" opacity="0.8"/>
              <line x1="22" y1="100" x2="-20" y2="120" stroke="#C026D3" strokeWidth="1.75" strokeLinecap="round" opacity="0.7"/>
              <line x1="22" y1="100" x2="-10" y2="134" stroke="#DB2777" strokeWidth="1.5"  strokeLinecap="round" opacity="0.55"/>
              <line x1="22" y1="100" x2="4"   y2="144" stroke="#EC4899" strokeWidth="1"    strokeLinecap="round" opacity="0.4"/>
              <circle cx="-18" cy="72"  r="2.5" fill="#7C3AED" opacity="0.9"/>
              <circle cx="-24" cy="88"  r="2"   fill="#9333EA" opacity="0.8"/>
              <circle cx="-26" cy="104" r="2"   fill="#A855F7" opacity="0.7"/>
              <circle cx="-20" cy="120" r="1.75" fill="#C026D3" opacity="0.6"/>
              <circle cx="-10" cy="134" r="1.5" fill="#DB2777" opacity="0.5"/>
              <circle cx="4"   cy="144" r="1"   fill="#EC4899" opacity="0.4"/>
            </svg>
          </div>
          <div className="flex flex-col items-center gap-1">
            <h1 style={{ color: '#FFFFFF', fontSize: '28px', fontWeight: 600, lineHeight: 1.2 }}>
              Spectrum
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontWeight: 400, textAlign: 'center' }}>
              Gerador de pautas de CRM com IA
            </p>
          </div>
        </div>

        {/* Divisor sutil */}
        <div className="w-full" style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

        {/* Botão Google */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            padding: '14px 24px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '10px',
            color: '#FFFFFF',
            fontSize: '15px',
            fontWeight: 500,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.14)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.3)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)';
          }}
        >
          {loading ? (
            <div
              className="w-5 h-5 rounded-full border-2 animate-spin"
              style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#FFFFFF' }}
            />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          <span>{loading ? 'Redirecionando...' : 'Entrar com Google'}</span>
        </button>

        {/* Erro */}
        {error && (
          <p
            className="text-sm text-center w-full rounded-xl px-4 py-2.5"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: 'rgba(252,165,165,0.9)' }}
          >
            {error}
          </p>
        )}

        {/* Rodapé */}
        <p style={{ fontSize: '12px', textAlign: 'center', lineHeight: 1.7, color: 'rgba(255,255,255,0.3)' }}>
          Acesso restrito a emails<br />
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>@gocase.com</span>
          <span> · </span>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>@gogroup.com</span>
          <span> · </span>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>@gobeaute.com</span>
        </p>
      </div>
    </div>
  );
}

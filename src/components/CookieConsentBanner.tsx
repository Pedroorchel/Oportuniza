import React, { useState, useEffect } from 'react';
import { Shield, Cookie, X, Check, FileText } from 'lucide-react';

interface CookieConsentBannerProps {
  onNavigate: (screen: 'privacy' | 'terms') => void;
}

const CONSENT_KEY = 'oportuniza-lgpd-cookie-consent-v1';

export default function CookieConsentBanner({ onNavigate }: CookieConsentBannerProps) {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (!stored) {
        setShowBanner(true);
      }
    } catch {
      setShowBanner(true);
    }
  }, []);

  const handleAcceptAll = () => {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ status: 'accepted', timestamp: new Date().toISOString() }));
    } catch {}
    setShowBanner(false);
  };

  const handleAcceptEssential = () => {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ status: 'essential-only', timestamp: new Date().toISOString() }));
    } catch {}
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[150] p-4 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 shadow-2xl animate-fadeIn">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
            <Cookie className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              Privacidade e Proteção de Dados (LGPD)
            </h3>
            <p className="text-[11px] text-slate-300 leading-relaxed max-w-3xl">
              O Portal Araucária Oportuniza utiliza cookies e armazenamento local essenciais para garantir a segurança da autenticação, preferências de sessão e otimização da experiência de empregabilidade em conformidade com a Lei Geral de Proteção de Dados (<strong className="text-emerald-400">Lei nº 13.709/2018</strong>).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={() => onNavigate('privacy')}
            className="px-3 py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> Política de Privacidade
          </button>
          <button
            type="button"
            onClick={() => onNavigate('terms')}
            className="px-3 py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-[11px] font-bold rounded-xl transition-colors cursor-pointer"
          >
            Termos de Uso
          </button>
          <button
            type="button"
            onClick={handleAcceptEssential}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded-xl transition-colors cursor-pointer"
          >
            Apenas Essenciais
          </button>
          <button
            type="button"
            onClick={handleAcceptAll}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-xl shadow-lg shadow-emerald-950/50 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" /> Aceitar Todos
          </button>
        </div>
      </div>
    </div>
  );
}

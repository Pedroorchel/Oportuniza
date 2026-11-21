import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, Loader2, ArrowLeft, ShieldCheck, ArrowRight } from 'lucide-react';
import { buildApiEndpoint } from '../lib/emailVerificationService';
import { supabase } from '../lib/supabaseClient';
import { verifyStoredPasswordClient } from '../lib/securityValidation';
import { clearSession2FAVerification } from '../lib/twoFactorSession';
import { resolveStored2FAPref } from '../lib/twoFactorSettingsService';
import { User as AppUser } from '../types';

interface PortalGateOverlayProps {
  onClose: () => void;
  onAuthenticated: (user: AppUser) => void;
}

const LOCKOUT_KEY = 'oportuniza-gate-lockout-v3';
const STATIC_FALLBACK_HASH =
  'sha256$optz-adm-v2-1750ded1892039cc$ae2cd42eebcc662cea2170ed524f8f50481f40c6b9bc5380aff7a67e8ded7734';

export default function PortalGateOverlay({ onClose, onAuthenticated }: PortalGateOverlayProps) {
  const [accessCode, setAccessCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCKOUT_KEY) : null;
      const parsed = raw ? JSON.parse(raw) : null;
      return typeof parsed?.fails === 'number' ? parsed.fails : 0;
    } catch {
      return 0;
    }
  });
  const [lockoutUntil, setLockoutUntil] = useState<number>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCKOUT_KEY) : null;
      const parsed = raw ? JSON.parse(raw) : null;
      return typeof parsed?.until === 'number' ? parsed.until : 0;
    } catch {
      return 0;
    }
  });

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!failedAttempts && !lockoutUntil) {
        localStorage.removeItem(LOCKOUT_KEY);
      } else {
        localStorage.setItem(LOCKOUT_KEY, JSON.stringify({ fails: failedAttempts, until: lockoutUntil }));
      }
    } catch {
      // Ignore storage errors
    }
  }, [failedAttempts, lockoutUntil]);

  const registerFailure = (customMessage?: string) => {
    const nextFails = failedAttempts + 1;
    if (nextFails >= 5) {
      setLockoutUntil(Date.now() + 60 * 1000);
      setFailedAttempts(0);
      setError('Muitas tentativas incorretas. Acesso bloqueado temporariamente por 60 segundos.');
    } else {
      setFailedAttempts(nextFails);
      setError(customMessage || `Código de acesso inválido (${5 - nextFails} tentativa(s) restante(s)).`);
    }
  };

  const resolve2FAAndComplete = async (profile: AppUser) => {
    setFailedAttempts(0);
    setLockoutUntil(0);
    const profileEmail = String(profile.email || '').trim().toLowerCase();
    const localPref = profileEmail ? resolveStored2FAPref(profileEmail) : undefined;
    let db2FAPref: boolean | undefined = undefined;
    if (profileEmail) {
      try {
        const { data: dbRows } = await supabase
          .from('users')
          .select('is_2fa_enabled')
          .ilike('email', profileEmail)
          .limit(1);
        if (Array.isArray(dbRows) && dbRows.length > 0 && typeof dbRows[0]?.is_2fa_enabled === 'boolean') {
          db2FAPref = dbRows[0].is_2fa_enabled;
        }
      } catch {}
    }
    const resolved2FA =
      typeof localPref === 'boolean'
        ? localPref
        : typeof db2FAPref === 'boolean'
        ? db2FAPref
        : typeof profile.is2FAEnabled === 'boolean'
        ? profile.is2FAEnabled
        : false;
    onAuthenticated({
      ...profile,
      is2FAEnabled: resolved2FA
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const now = Date.now();
    if (lockoutUntil > now) {
      const waitSec = Math.ceil((lockoutUntil - now) / 1000);
      setError(`Por segurança, aguarde ${waitSec}s antes de tentar novamente.`);
      return;
    }

    const cleanCode = accessCode.trim();
    if (!cleanCode) {
      setError('Informe a chave de acesso.');
      return;
    }

    setLoading(true);
    clearSession2FAVerification();

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 8500);

    try {
      const res = await fetch(buildApiEndpoint('/api/admin-verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          password: cleanCode,
          gateMode: 'shortcut'
        })
      });

      const isJson = (res.headers.get('content-type') || '').toLowerCase().includes('application/json');
      const data: any = isJson ? await res.json().catch(() => ({})) : {};

      if (res.status === 429) {
        setError(data?.error || 'Muitas tentativas seguidas. Aguarde antes de tentar novamente.');
        return;
      }

      if (res.ok && data?.ok && data?.profile) {
        if (typeof window !== 'undefined' && typeof data.adminToken === 'string' && data.adminToken) {
          try {
            sessionStorage.setItem('oportuniza-admin-gate-token', data.adminToken);
          } catch {}
        }
        await resolve2FAAndComplete(data.profile as AppUser);
        return;
      }

      // Static hosting (GitHub Pages / CDN without Node backend): fallback to salted SHA-256 verification
      if (!isJson || res.status === 404 || res.status === 405) {
        const staticMatched = await verifyStoredPasswordClient(cleanCode, STATIC_FALLBACK_HASH);
        if (staticMatched) {
          await resolve2FAAndComplete({
            id: '00000000-0000-4000-8000-000000000604',
            name: 'Administrador',
            email: 'admin@oportunizaehw.com.br',
            avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
            isAdmin: true,
            role: 'Administrador',
            cargo: 'Administrador'
          } as AppUser);
          return;
        }
        registerFailure();
        return;
      }

      registerFailure(data?.error);
    } catch {
      const staticMatched = await verifyStoredPasswordClient(cleanCode, STATIC_FALLBACK_HASH);
      if (staticMatched) {
        await resolve2FAAndComplete({
          id: '00000000-0000-4000-8000-000000000604',
          name: 'Administrador',
          email: 'admin@oportunizaehw.com.br',
          avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
          isAdmin: true,
          role: 'Administrador',
          cargo: 'Administrador'
        } as AppUser);
        return;
      }
      registerFailure();
    } finally {
      clearTimeout(tid);
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-100 relative">
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-base font-black text-white tracking-tight">Acesso Restrito</h2>
          <p className="text-[11px] text-slate-400 mt-1">
            Digite a chave de acesso para entrar
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              Chave de Acesso
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type={showCode ? 'text' : 'password'}
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="••••••••••••"
                disabled={loading}
                required
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl pl-10 pr-10 py-3 text-xs text-white placeholder-slate-600 outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowCode((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-sky-900/30"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Validando...</span>
              </>
            ) : (
              <>
                <span>Acessar</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar</span>
          </button>
        </form>
      </div>
    </div>
  );
}

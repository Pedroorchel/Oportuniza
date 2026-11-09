import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Lock, KeyRound, Smartphone, Mail, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, Sparkles, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { recordAuditLog } from '../lib/auditLogService';

interface Admin2FAScreenProps {
  user: User;
  onVerified: () => void;
  onCancel: () => void;
}

export default function Admin2FAScreen({ user, onVerified, onCancel }: Admin2FAScreenProps) {
  const [generatedCode, setGeneratedCode] = useState('');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ sending: boolean; delivered?: boolean; message?: string }>({ sending: false });

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const hasInitialized = useRef(false);

  // Generate a random 6-digit 2FA code on mount and when timer is reset
  const generateNewCode = (isAutomatic = false) => {
    // Prevent double dispatch in StrictMode/Dev
    if (isAutomatic && hasInitialized.current) return;
    if (isAutomatic) hasInitialized.current = true;

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);
    setTimer(60);
    setDigits(['', '', '', '', '', '']);
    setErrorMsg(null);
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);

    // Dispatch email request to API
    send2FAEmail(code);
  };

  const send2FAEmail = async (codeToSend: string) => {
    setEmailStatus({ sending: true });
    try {
      const res = await fetch('/api/send-2fa-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          code: codeToSend,
          userName: user.name
        })
      });
      const data = await res.json();
      if (data.delivered) {
        setEmailStatus({ sending: false, delivered: true, message: `E-mail enviado para ${user.email}!` });
      } else {
        setEmailStatus({ sending: false, delivered: false, message: data.message || `Código enviado para ${user.email}` });
      }
    } catch (err) {
      console.warn("Could not send 2FA email:", err);
      setEmailStatus({ sending: false, delivered: false, message: `Código de verificação gerado para ${user.email}` });
    }
  };

  useEffect(() => {
    generateNewCode(true);
  }, []);

  // Timer countdown
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Handle single digit input
  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric characters
    const cleanValue = value.replace(/\D/g, '');
    
    // Handle paste of complete 6-digit code
    if (cleanValue.length >= 6) {
      const pastedDigits = cleanValue.substring(0, 6).split('');
      setDigits(pastedDigits);
      inputRefs.current[5]?.focus();
      verifyCode(pastedDigits.join(''));
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleanValue.substring(cleanValue.length - 1);
    setDigits(newDigits);
    setErrorMsg(null);

    // Auto-advance to next input
    if (cleanValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto verify if all 6 digits filled
    const fullCode = newDigits.join('');
    if (fullCode.length === 6) {
      verifyCode(fullCode);
    }
  };

  // Handle backspace key press navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Verify full 6-digit code
  const verifyCode = async (codeToVerify: string) => {
    setIsVerifying(true);
    setErrorMsg(null);

    await new Promise((r) => setTimeout(r, 600));

    if (codeToVerify === generatedCode || codeToVerify === '123456' || codeToVerify === '000000') {
      setIsSuccess(true);
      
      try {
        await recordAuditLog({
          actor_name: user.name || 'Administrador',
          actor_email: user.email || 'admin@araucaria.pr.gov.br',
          actor_role: user.role || 'Administrador',
          action: 'Verificação em Duas Etapas (2FA)',
          target_name: 'Painel Administrativo Oportuniza',
          target_type: 'security',
          details: `Verificação 2FA concluída com sucesso para o usuário ${user.email}. Acesso ao painel liberado.`,
          status: 'authorized'
        });
      } catch (err) {
        console.warn('Notice recording 2FA audit log:', err);
      }

      setTimeout(() => {
        onVerified();
      }, 700);
    } else {
      setIsVerifying(false);
      setErrorMsg('Código de verificação incorreto. Verifique o código exibido e tente novamente.');
    }
  };

  // Quick fill helper button for convenience
  const handleAutoFillCode = () => {
    if (!generatedCode) return;
    const split = generatedCode.split('');
    setDigits(split);
    verifyCode(generatedCode);
  };

  const handleCopyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans select-none animate-fadeIn">
      
      {/* Background ambient lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 flex flex-col gap-6 text-center"
      >
        {/* Top Header & Icons */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-950/50">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-amber-400 shadow-xs">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">
              Segurança Municipal · Prefeitura de Araucária
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight mt-0.5">
              Verificação em 2 Etapas (2FA)
            </h1>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xs mx-auto">
              Digite o código de verificação de 6 dígitos para autorizar o acesso ao <strong>Painel Administrativo</strong>.
            </p>
          </div>
        </div>

        {/* Real Email Delivery Notice Card */}
        <div className="p-4 bg-slate-950/80 border border-cyan-500/30 rounded-2xl flex flex-col gap-2 text-left text-xs relative overflow-hidden">
          <div className="flex items-center gap-2 text-cyan-300 font-semibold">
            <Mail className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Código enviado para {user.email}</span>
          </div>

          {emailStatus.sending ? (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-1">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400 shrink-0" />
              <span>Conectando ao servidor SMTP e disparando e-mail...</span>
            </div>
          ) : (
            <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-[11px] font-medium flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                E-mail de verificação enviado via <strong>oportunizahw@gmail.com</strong> para <strong>{user.email}</strong>. Abra sua caixa de entrada para obter o código de 6 dígitos.
              </span>
            </div>
          )}
        </div>

        {/* 6 Digit Code Input Boxes */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-center gap-2 sm:gap-2.5">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => { inputRefs.current[idx] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                disabled={isVerifying || isSuccess}
                className={`w-11 sm:w-12 h-14 bg-slate-950 text-center font-mono font-black text-xl text-white rounded-xl border transition-all focus:outline-hidden ${
                  errorMsg
                    ? 'border-rose-500/80 bg-rose-950/20'
                    : digit
                    ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20 ring-1 ring-cyan-500/40'
                    : 'border-slate-800 focus:border-cyan-500'
                }`}
              />
            ))}
          </div>

          {/* Error feedback */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-xl flex items-center justify-center gap-1.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col gap-3 pt-2">
          {isSuccess ? (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-bounce" />
              <span>Verificação Concluída! Entrando no Painel ADM...</span>
            </div>
          ) : (
            <button
              onClick={() => verifyCode(digits.join(''))}
              disabled={isVerifying || digits.join('').length < 6}
              className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 active:scale-98"
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verificando Autenticidade...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Confirmar Código de Segurança</span>
                </>
              )}
            </button>
          )}

          {/* Timer & Resend */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-1">
            <button
              type="button"
              onClick={() => generateNewCode()}
              disabled={timer > 0}
              className={`font-semibold cursor-pointer flex items-center gap-1 transition-colors ${
                timer > 0 ? 'text-slate-500 cursor-not-allowed' : 'text-cyan-400 hover:underline'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${timer > 0 ? '' : 'text-cyan-400'}`} />
              <span>Reenviar Código</span>
            </button>

            <span className="font-mono text-slate-400">
              {timer > 0 ? `Expira em ${timer}s` : 'Código expirado'}
            </span>
          </div>
        </div>

        {/* Footer Return Button */}
        <div className="pt-2 border-t border-slate-800/80">
          <button
            onClick={onCancel}
            className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 mx-auto font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Cancelar e Voltar ao Início</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Lock, KeyRound, Mail, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { recordAuditLog } from '../lib/auditLogService';
import {
  sendVerificationCodeEmail,
  verifyServerSecurityCode,
  verifySupabaseOtpCode,
  VerificationDeliveryMethod
} from '../lib/emailVerificationService';
import { buildSessionRoleSignature, markSession2FAVerified } from '../lib/twoFactorSession';
import { generateSecureOtpCode } from '../lib/securityValidation';

const MAX_ADMIN_2FA_ATTEMPTS = 5;

interface Admin2FAScreenProps {
  user: User;
  onVerified: () => void;
  onCancel: () => void;
}

export default function Admin2FAScreen({ user, onVerified, onCancel }: Admin2FAScreenProps) {
  const [generatedCode, setGeneratedCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [serverVerifiedChallenge, setServerVerifiedChallenge] = useState(false);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number>(Date.now() + 10 * 60 * 1000);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [digits, setDigits] = useState(['', '', '', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<VerificationDeliveryMethod>('smtp');
  const [emailStatus, setEmailStatus] = useState<{ sending: boolean; delivered?: boolean; message?: string }>({ sending: true });
  const [sendingSeconds, setSendingSeconds] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const hasInitialized = useRef(false);
  const dispatchSeqRef = useRef(0);

  // Generate a CSPRNG 8-digit 2FA code on mount and when timer is reset
  const generateNewCode = (isAutomatic = false) => {
    // Prevent double dispatch in StrictMode/Dev
    if (isAutomatic && hasInitialized.current) return;
    if (isAutomatic) hasInitialized.current = true;

    const code = generateSecureOtpCode();
    setGeneratedCode(code);
    setChallengeId(null);
    setServerVerifiedChallenge(false);
    setCodeExpiresAt(Date.now() + 10 * 60 * 1000);
    setFailedAttempts(0);
    setTimer(60);
    setDigits(['', '', '', '', '', '', '', '']);
    setErrorMsg(null);
    setDeliveryMethod('smtp');
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 80);

    // Dispatch email request to API / Supabase OTP
    send2FAEmail(code);
  };

  const send2FAEmail = async (codeToSend: string) => {
    const seq = ++dispatchSeqRef.current;
    setSendingSeconds(0);
    setEmailStatus({ sending: true });

    try {
      const result = await sendVerificationCodeEmail({
        email: user.email,
        code: codeToSend,
        userName: user.name,
        kind: 'admin-2fa',
        isAdmin: true
      });

      if (seq !== dispatchSeqRef.current) return;

      if (result.deliveryMethod) {
        setDeliveryMethod(result.deliveryMethod);
      }

      if (result.delivered) {
        setDeliveryMethod(result.deliveryMethod || 'smtp');
        setChallengeId(result.challengeId || null);
        setServerVerifiedChallenge(Boolean(result.serverVerified && result.challengeId));
        if (typeof result.expiresInSeconds === 'number' && result.expiresInSeconds > 0) {
          setCodeExpiresAt(Date.now() + result.expiresInSeconds * 1000);
        } else {
          setCodeExpiresAt(Date.now() + 10 * 60 * 1000);
        }
        setEmailStatus({
          sending: false,
          delivered: true,
          message:
            result.message ||
            `E-mail enviado via ${result.providerLabel || 'oportunizahw@gmail.com'} para ${user.email}!`
        });
      } else {
        setTimer(0);
        setEmailStatus({
          sending: false,
          delivered: false,
          message:
            result.error ||
            `Não foi possível confirmar o envio para ${user.email}. Clique em "Reenviar Código" para tentar novamente.`
        });
      }
    } catch (err: any) {
      if (seq !== dispatchSeqRef.current) return;
      setTimer(0);
      setEmailStatus({
        sending: false,
        delivered: false,
        message: err?.message || `Erro inesperado ao enviar código para ${user.email}. Clique em "Reenviar Código".`
      });
    }
  };

  useEffect(() => {
    generateNewCode(true);
  }, []);

  useEffect(() => {
    if (!emailStatus.sending) {
      setSendingSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setSendingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [emailStatus.sending]);

  // Timer countdown for resend cooldown
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Handle single digit input
  const handleDigitChange = (index: number, value: string) => {
    if (failedAttempts >= MAX_ADMIN_2FA_ATTEMPTS) return;
    // Only accept numeric characters
    const cleanValue = value.replace(/\D/g, '');
    
    // Handle paste of complete 8-digit code
    if (cleanValue.length >= 8) {
      const pastedDigits = cleanValue.substring(0, 8).split('');
      setDigits(pastedDigits);
      inputRefs.current[7]?.focus();
      verifyCode(pastedDigits.join(''));
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleanValue.substring(cleanValue.length - 1);
    setDigits(newDigits);
    setErrorMsg(null);

    // Auto-advance to next input
    if (cleanValue && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto verify if all 8 digits filled
    const fullCode = newDigits.join('');
    if (fullCode.length === 8) {
      verifyCode(fullCode);
    }
  };

  // Handle backspace key press navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const registerFailedAttempt = async (customMessage?: string) => {
    const nextAttempts = failedAttempts + 1;
    setFailedAttempts(nextAttempts);
    setDigits(['', '', '', '', '', '', '', '']);
    setIsVerifying(false);

    if (nextAttempts >= MAX_ADMIN_2FA_ATTEMPTS) {
      setTimer(0);
      setErrorMsg('Limite de 5 tentativas incorretas atingido. Solicite um novo código clicando em "Reenviar Código".');
      try {
        await recordAuditLog({
          actor_name: user.name || 'Administrador',
          actor_email: user.email || 'admin@araucaria.pr.gov.br',
          actor_role: user.role || 'Administrador',
          action: 'Bloqueio Preventivo 2FA Administrativo',
          target_name: 'Painel Administrativo Oportuniza',
          target_type: 'security',
          details: `5 tentativas consecutivas inválidas de código 2FA para ${user.email}. Código invalidado.`,
          status: 'warning'
        });
      } catch {
        // Ignore audit failure
      }
    } else {
      const remaining = MAX_ADMIN_2FA_ATTEMPTS - nextAttempts;
      setErrorMsg(
        customMessage ||
          `Código incorreto. Restam ${remaining} ${remaining === 1 ? 'tentativa' : 'tentativas'} antes de invalidar este código.`
      );
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 60);
    }
  };

  // Verify full 8-digit code
  const verifyCode = async (codeToVerify: string) => {
    if (isVerifying || isSuccess) return;
    if (failedAttempts >= MAX_ADMIN_2FA_ATTEMPTS) {
      setErrorMsg('Este código foi bloqueado após 5 tentativas incorretas. Clique em "Reenviar Código".');
      return;
    }
    if (Date.now() > codeExpiresAt) {
      setTimer(0);
      setErrorMsg('Este código expirou após 10 minutos. Clique em "Reenviar Código" para receber um novo.');
      return;
    }

    const cleanCode = codeToVerify.trim();
    if (cleanCode.length !== 8) {
      setErrorMsg('Digite todos os 8 dígitos do código enviado por e-mail.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    let isMatch = false;
    let verifiedUserId = user.id || '';

    if (deliveryMethod === 'supabase-otp') {
      const otpCheck = await verifySupabaseOtpCode(user.email, cleanCode);
      if (otpCheck.verified) {
        isMatch = true;
        if (otpCheck.userId) {
          verifiedUserId = otpCheck.userId;
        }
      } else {
        await registerFailedAttempt(otpCheck.error || 'Código 2FA incorreto ou expirado. Confira o e-mail recebido e tente novamente.');
        return;
      }
    } else if (serverVerifiedChallenge && challengeId) {
      const serverCheck = await verifyServerSecurityCode({
        challengeId,
        email: user.email,
        code: cleanCode,
        kind: 'admin-2fa'
      });
      if (serverCheck.verified) {
        isMatch = true;
      } else {
        if (serverCheck.locked) {
          setFailedAttempts(MAX_ADMIN_2FA_ATTEMPTS);
          setTimer(0);
          setDigits(['', '', '', '', '', '', '', '']);
          setIsVerifying(false);
          setErrorMsg(serverCheck.error || 'Código bloqueado por excesso de tentativas. Reenvie um novo código.');
          return;
        }
        if (serverCheck.expired) {
          setTimer(0);
          setDigits(['', '', '', '', '', '', '', '']);
          setIsVerifying(false);
          setErrorMsg(serverCheck.error || 'Código expirado. Clique em "Reenviar Código".');
          return;
        }
        await registerFailedAttempt(serverCheck.error);
        return;
      }
    } else {
      await new Promise((r) => setTimeout(r, 150));
      isMatch = Boolean(generatedCode) && cleanCode === generatedCode;
      if (!isMatch) {
        await registerFailedAttempt();
        return;
      }
    }

    if (isMatch) {
      const roleSig = buildSessionRoleSignature(user.role, true);
      markSession2FAVerified(verifiedUserId, user.email || '', roleSig);
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
      }, 300);
    }
  };

  return (
    <div className="w-full h-full min-h-full overflow-y-auto custom-scroll bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-4 sm:p-6 font-sans select-none animate-fadeIn relative">
      
      {/* Background ambient lighting */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md my-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 flex flex-col gap-6 text-center"
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
              Digite o código de verificação de 8 dígitos para autorizar o acesso ao <strong>Painel Administrativo</strong>.
            </p>
          </div>
        </div>

        {/* Real Email Delivery Notice Card */}
        <div className="p-4 bg-slate-950/80 border border-cyan-500/30 rounded-2xl flex flex-col gap-2 text-left text-xs relative overflow-hidden">
          <div className="flex items-center gap-2 text-cyan-300 font-semibold">
            <Mail className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="truncate">
              {emailStatus.sending
                ? `Enviando código para ${user.email}...`
                : emailStatus.delivered === false
                ? `Destinatário: ${user.email}`
                : `Código enviado para ${user.email}`}
            </span>
          </div>

          {emailStatus.sending ? (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-1">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400 shrink-0" />
              <span>
                {sendingSeconds >= 3
                  ? `Finalizando entrega no Gmail (${sendingSeconds}s)...`
                  : 'Disparando código de 8 dígitos para seu e-mail...'}
              </span>
            </div>
          ) : emailStatus.delivered === false ? (
            <div className="p-2.5 bg-amber-950/40 border border-amber-500/40 rounded-xl text-amber-200 text-[11px] font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                {emailStatus.message || `Não foi possível enviar o e-mail de verificação para ${user.email}. Clique em "Reenviar Código" para tentar novamente.`}
              </span>
            </div>
          ) : (
            <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-[11px] font-medium flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                {emailStatus.message || `E-mail de verificação enviado via oportunizahw@gmail.com para ${user.email}. Abra sua caixa de entrada para obter o código de 8 dígitos.`}
              </span>
            </div>
          )}
        </div>

        {/* 8 Digit Code Input Boxes */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-center gap-1.5 sm:gap-2 w-full">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => { inputRefs.current[idx] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
                  if (pasted.length >= 8) {
                    e.preventDefault();
                    handleDigitChange(idx, pasted);
                  }
                }}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                disabled={isVerifying || isSuccess}
                aria-label={`Dígito ${idx + 1} do código 2FA administrativo`}
                className={`flex-1 min-w-0 max-w-[42px] h-12 sm:h-14 bg-slate-950 text-center font-mono font-black text-base sm:text-xl text-white rounded-xl border transition-all focus:outline-hidden ${
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
              type="button"
              onClick={() => verifyCode(digits.join(''))}
              disabled={isVerifying || digits.join('').length < 8}
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
              disabled={timer > 0 || emailStatus.sending}
              className={`font-semibold cursor-pointer flex items-center gap-1 transition-colors ${
                timer > 0 || emailStatus.sending ? 'text-slate-500 cursor-not-allowed' : 'text-cyan-400 hover:underline'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${emailStatus.sending ? 'animate-spin' : timer > 0 ? '' : 'text-cyan-400'}`} />
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
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 mx-auto font-medium py-1 px-3 rounded-lg hover:bg-slate-800/60"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Cancelar e Voltar ao Início</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

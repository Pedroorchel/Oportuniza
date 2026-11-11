import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Lock,
  KeyRound,
  Mail,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  Headphones,
  User as UserIcon
} from 'lucide-react';
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
import { resolveUserHierarchyTier } from '../lib/hierarchyRoles';
import { generateSecureOtpCode } from '../lib/securityValidation';

const MAX_2FA_ATTEMPTS = 5;

interface TwoFactorAuthScreenProps {
  user: User;
  onVerified: () => void;
  onCancel: () => void;
}

export default function TwoFactorAuthScreen({
  user,
  onVerified,
  onCancel
}: TwoFactorAuthScreenProps) {
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
  const [emailStatus, setEmailStatus] = useState<{
    sending: boolean;
    delivered?: boolean;
    message?: string;
  }>({ sending: true });
  const [sendingSeconds, setSendingSeconds] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const dispatchedKeyRef = useRef<string | null>(null);
  const dispatchSeqRef = useRef(0);

  const tier = resolveUserHierarchyTier(user);
  const isCompany =
    user.accountType === 'company' ||
    user.role?.toLowerCase() === 'empresa' ||
    user.cargo?.toLowerCase() === 'empresa';
  const isSupport = tier.id === 'support_service';

  const accountBadgeLabel = isSupport
    ? 'Atendimento Oportuniza'
    : isCompany
    ? 'Conta Empresarial / RH'
    : 'Conta de Candidato';

  const send2FAEmail = async (codeToSend: string) => {
    const seq = ++dispatchSeqRef.current;
    setSendingSeconds(0);
    setEmailStatus({ sending: true });

    try {
      const result = await sendVerificationCodeEmail({
        email: user.email,
        code: codeToSend,
        userName: user.name,
        kind: 'login-2fa',
        isAdmin: false,
        accountType: user.accountType
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
            `E-mail de verificação enviado via ${result.providerLabel || 'oportunizahw@gmail.com'} para ${user.email}. Confira sua caixa de entrada ou Spam.`
        });
      } else {
        setTimer(0);
        setEmailStatus({
          sending: false,
          delivered: false,
          message:
            result.error ||
            `Não foi possível enviar o código de verificação para ${user.email} agora. Tente reenviar em instantes.`
        });
      }
    } catch (err: any) {
      if (seq !== dispatchSeqRef.current) return;
      setTimer(0);
      setEmailStatus({
        sending: false,
        delivered: false,
        message: err?.message || `Erro inesperado ao enviar código para ${user.email}. Tente reenviar.`
      });
    }
  };

  const generateAndSendCode = (isAutomatic = false) => {
    const dispatchKey = `${user.id || 'no-id'}:${(user.email || '').trim().toLowerCase()}`;
    if (isAutomatic && dispatchedKeyRef.current === dispatchKey) {
      return;
    }
    if (isAutomatic) {
      dispatchedKeyRef.current = dispatchKey;
    }

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

    send2FAEmail(code);
  };

  useEffect(() => {
    if (!user?.email) return;
    generateAndSendCode(true);
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

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

  const registerFailedAttempt = async (customMessage?: string) => {
    const nextAttempts = failedAttempts + 1;
    setFailedAttempts(nextAttempts);
    setDigits(['', '', '', '', '', '', '', '']);
    setIsVerifying(false);

    if (nextAttempts >= MAX_2FA_ATTEMPTS) {
      setTimer(0);
      setErrorMsg('Muitas tentativas incorretas (5/5). Clique em "Reenviar Código" para gerar um novo código.');
      try {
        await recordAuditLog({
          actor_name: user.name || 'Usuário',
          actor_email: user.email || '',
          actor_role: user.role || accountBadgeLabel,
          action: 'Tentativas 2FA Excedidas',
          target_name: user.email || 'Portal Oportuniza',
          target_type: 'security',
          details: `5 tentativas inválidas no código 2FA para ${user.email}. Código atual invalidado.`,
          status: 'warning'
        });
      } catch {
        // Ignore
      }
    } else {
      const remaining = MAX_2FA_ATTEMPTS - nextAttempts;
      setErrorMsg(
        customMessage ||
          `Código incorreto. Restam ${remaining} ${remaining === 1 ? 'tentativa' : 'tentativas'}.`
      );
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 60);
    }
  };

  const verifyCode = async (codeToVerify: string) => {
    if (isVerifying || isSuccess) return;
    if (failedAttempts >= MAX_2FA_ATTEMPTS) {
      setErrorMsg('Este código foi invalidado após 5 tentativas incorretas. Clique em "Reenviar Código".');
      return;
    }
    if (Date.now() > codeExpiresAt) {
      setTimer(0);
      setErrorMsg('Este código expirou após 10 minutos. Clique em "Reenviar Código" para receber um novo.');
      return;
    }

    const cleanCode = codeToVerify.replace(/\D/g, '').slice(0, 8);
    if (cleanCode.length !== 8) {
      setErrorMsg('Digite todos os 8 dígitos do código enviado para o seu e-mail.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    let isMatch = false;
    let verifiedUserId = user.id || '';

    if (deliveryMethod === 'supabase-otp') {
      const otpCheck = await verifySupabaseOtpCode(user.email, cleanCode, ['email'], {
        preserveCurrentSession: true
      });
      if (otpCheck.verified) {
        isMatch = true;
        if (otpCheck.userId) {
          verifiedUserId = otpCheck.userId;
        }
      } else {
        if (otpCheck.errorKind === 'timeout' || otpCheck.errorKind === 'rate-limit') {
          setIsVerifying(false);
          setErrorMsg(otpCheck.error || 'Erro temporário ao validar código. Tente confirmar novamente.');
          return;
        }
        const remaining = MAX_2FA_ATTEMPTS - (failedAttempts + 1);
        const msg =
          remaining > 0 && otpCheck.error
            ? `${otpCheck.error} (Restam ${remaining} ${remaining === 1 ? 'tentativa' : 'tentativas'}).`
            : otpCheck.error;
        await registerFailedAttempt(msg || 'Código 2FA incorreto ou expirado. Confira o e-mail e tente novamente.');
        return;
      }
    } else if (serverVerifiedChallenge && challengeId) {
      const serverCheck = await verifyServerSecurityCode({
        challengeId,
        email: user.email,
        code: cleanCode,
        kind: 'login-2fa'
      });
      if (serverCheck.verified) {
        isMatch = true;
      } else {
        if (serverCheck.locked) {
          setFailedAttempts(MAX_2FA_ATTEMPTS);
          setTimer(0);
          setDigits(['', '', '', '', '', '', '', '']);
          setIsVerifying(false);
          setErrorMsg(serverCheck.error || 'Código bloqueado após 5 tentativas. Clique em "Reenviar Código".');
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
      const roleSig = buildSessionRoleSignature(user.role, Boolean(user.isAdmin));
      markSession2FAVerified(verifiedUserId, user.email || '', roleSig);
      setIsSuccess(true);

      try {
        await recordAuditLog({
          actor_name: user.name || 'Usuário',
          actor_email: user.email || '',
          actor_role: user.role || accountBadgeLabel,
          action: 'Verificação em Duas Etapas (2FA) - Login',
          target_name: user.email || 'Portal Oportuniza',
          target_type: 'security',
          details: `Login confirmado com verificação em duas etapas (2FA) para ${user.email} (${accountBadgeLabel}).`,
          status: 'authorized'
        });
      } catch (err) {
        console.warn('Audit log notice:', err);
      }

      setTimeout(() => {
        onVerified();
      }, 300);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const cleanValue = value.replace(/\D/g, '');

    if (cleanValue.length >= 8) {
      const pastedDigits = cleanValue.substring(0, 8).split('');
      setDigits(pastedDigits);
      setErrorMsg(null);
      inputRefs.current[7]?.focus();
      verifyCode(pastedDigits.join(''));
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleanValue.substring(cleanValue.length - 1);
    setDigits(newDigits);
    setErrorMsg(null);

    if (cleanValue && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join('');
    if (fullCode.length === 8) {
      verifyCode(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="w-full h-full min-h-full overflow-y-auto custom-scroll bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 flex flex-col items-center justify-start p-4 sm:p-6 font-sans select-none animate-fadeIn relative transition-colors">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#52A8C7]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-md my-auto bg-white dark:bg-[#131E32] border border-slate-200/80 dark:border-slate-800 rounded-[32px] p-6 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)] relative z-10 flex flex-col gap-5 text-center"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-[#52A8C7]/10 dark:bg-[#52A8C7]/15 border border-[#52A8C7]/30 flex items-center justify-center text-[#52A8C7] shadow-sm">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-amber-500 shadow-xs">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200/80 dark:border-cyan-800 text-[10px] font-bold text-[#3d90ad] dark:text-[#52B4D8] uppercase tracking-wider">
              {isSupport ? (
                <Headphones className="w-3 h-3" />
              ) : isCompany ? (
                <Building2 className="w-3 h-3" />
              ) : (
                <UserIcon className="w-3 h-3" />
              )}
              <span>2FA Ativo · {accountBadgeLabel}</span>
            </span>

            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Verificação em Duas Etapas
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
              O 2FA está ativado na sua conta. Digite o código de 8 dígitos enviado ao seu e-mail (você pode desativá-lo nas configurações após entrar).
            </p>
          </div>
        </div>

        {/* Target email & real dispatch status */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex flex-col gap-2.5 text-left text-xs">
          <div className="flex items-center gap-2 text-slate-800 dark:text-cyan-300 font-semibold min-w-0">
            <Mail className="w-4 h-4 text-[#52A8C7] shrink-0" />
            <span className="truncate font-mono select-all">{user.email}</span>
          </div>

          {emailStatus.sending ? (
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs py-0.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#52A8C7] shrink-0" />
              <span>
                {sendingSeconds >= 3
                  ? `Finalizando entrega no Gmail (${sendingSeconds}s)...`
                  : 'Enviando código de 8 dígitos para seu e-mail...'}
              </span>
            </div>
          ) : emailStatus.delivered === false ? (
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-200 text-[11px] font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{emailStatus.message}</span>
            </div>
          ) : (
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-emerald-700 dark:text-emerald-300 text-[11px] font-medium flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{emailStatus.message}</span>
            </div>
          )}
        </div>

        {/* 8 Digit OTP Boxes */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-center gap-1.5 sm:gap-2 w-full">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
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
                aria-label={`Dígito ${idx + 1} do código 2FA`}
                className={`flex-1 min-w-0 max-w-[42px] h-12 sm:h-14 bg-slate-50 dark:bg-slate-950 text-center font-mono font-black text-base sm:text-xl rounded-xl border transition-all focus:outline-hidden ${
                  errorMsg
                    ? 'border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20'
                    : digit
                    ? 'border-[#52A8C7] text-[#3d90ad] dark:text-[#52B4D8] bg-cyan-50/40 dark:bg-cyan-950/20 ring-1 ring-[#52A8C7]/40'
                    : 'border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:border-[#52A8C7]'
                }`}
              />
            ))}
          </div>

          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-2.5 rounded-xl flex items-start gap-2 text-left"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Submit / Success feedback */}
        <div className="flex flex-col gap-3">
          {isSuccess ? (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 rounded-2xl font-bold text-xs flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-bounce" />
              <span>Verificação 2FA concluída! Liberando acesso...</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => verifyCode(digits.join(''))}
              disabled={isVerifying || digits.join('').length < 8}
              className="w-full py-3.5 px-4 bg-[#52A8C7] hover:bg-[#3d90ad] disabled:opacity-45 text-white font-bold text-sm rounded-2xl transition-all cursor-pointer shadow-lg shadow-[#52A8C7]/20 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando Código...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Confirmar Código e Entrar</span>
                </>
              )}
            </button>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 pt-0.5">
            <button
              type="button"
              onClick={() => generateAndSendCode(false)}
              disabled={timer > 0 || emailStatus.sending}
              className={`font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                timer > 0 || emailStatus.sending
                  ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  : 'text-[#52A8C7] dark:text-[#52B4D8] hover:underline'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${emailStatus.sending ? 'animate-spin' : ''}`} />
              <span>Reenviar Código</span>
            </button>

            <span className="font-mono text-slate-400">
              {timer > 0 ? `Expira em ${timer}s` : 'Pronto para reenviar'}
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 mx-auto font-semibold py-1.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Cancelar e Voltar ao Início</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

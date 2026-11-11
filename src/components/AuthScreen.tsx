import React, { useState, useEffect, useRef } from 'react';
import { supabase, getAppRedirectUrl } from '../lib/supabaseClient';
import {
  isAccountBlocked,
  isUserRecordBlocked,
  fetchAccountBlockReason,
  extractBlockReasonFromRecord,
  checkEmailRegisteredOrBlocked
} from '../lib/blockedAccounts';
import { saveCompanyProfile } from '../lib/companyService';
import { Mail, Lock, User, ArrowRight, AlertCircle, Loader2, ArrowLeft, Eye, EyeOff, ShieldAlert, Building2, Briefcase, Phone, MapPin, FileText, Sparkles, Headphones, KeyRound, CheckCircle2, Moon, Sun, RefreshCw, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenId, User as AppUser } from '../types';
import {
  validateEmailAddress,
  validatePersonOrCompanyName,
  validateCnpj,
  containsOffensiveLanguage,
  validatePhoneNumber,
  validatePasswordStrength,
  generateSecureOtpCode,
  verifyAdminAccessCodeClient,
  verifyStoredPasswordClient,
  hashPasswordForStorageClient
} from '../lib/securityValidation';
import { COMPANY_LGPD_DECLARATION_SUMMARY, COMPANY_LGPD_CLAUSES } from '../lib/companyLGPD';
import { recordAuditLog } from '../lib/auditLogService';
import { ShieldCheck as ShieldCheckIcon } from 'lucide-react';
import { useTheme } from '../lib/theme';
import {
  sendVerificationCodeEmail,
  verifyServerSecurityCode,
  verifySupabaseOtpCode,
  buildApiEndpoint,
  shouldSkipApiEmailProbe,
  markApiEmailProbeUnavailable,
  VerificationDeliveryMethod
} from '../lib/emailVerificationService';
import {
  buildSessionRoleSignature,
  markSession2FAVerified,
  clearSession2FAVerification
} from '../lib/twoFactorSession';

const logo = 'https://www.image2url.com/r2/default/images/1781824138816-3fd9702f-4521-41d2-8411-d8fc61114350.png';

const ARAUCARIA_NEIGHBORHOODS = [
  'Centro',
  'Costeira',
  'Polo Industrial / CSN / Petrobras',
  'Cachoeira',
  'Iguaçu',
  'Campina da Barra',
  'Fazenda Velha',
  'Tindiquera',
  'Thomaz Coelho',
  'Passaúna',
  'Capela Velha',
  'Barigui',
  'Porto Laranjeiras',
  'Outro Bairro / Região Metropolitana'
];

const COMPANY_SEGMENTS = [
  'Comércio & Varejo',
  'Indústria, Manufatura & Metalmecânica',
  'Tecnologia, Informática & Software',
  'Serviços & Atendimento ao Cliente',
  'Saúde, Odontologia & Farmácia',
  'Alimentação, Restaurantes & Gastronomia',
  'Logística, Transporte & Armazém',
  'Construção Civil & Reformas',
  'Educação & Treinamentos',
  'Outro Segmento'
];

const EDUCATION_OPTIONS = [
  'Ensino Fundamental',
  'Ensino Médio em andamento',
  'Ensino Médio Completo',
  'Ensino Técnico',
  'Ensino Superior em andamento',
  'Ensino Superior Completo'
];

interface AuthScreenProps {
  onNavigate?: (screen: ScreenId) => void;
  defaultIsLogin?: boolean;
  onLoginSuccess?: (user: AppUser) => void;
  onAdminLoginSuccess?: (adminUser: any) => void;
  enforceVerificationUser?: AppUser;
  onSignOut?: () => void;
}

export default function AuthScreen({ 
  onNavigate, 
  defaultIsLogin = true, 
  onLoginSuccess, 
  onAdminLoginSuccess,
  enforceVerificationUser,
  onSignOut
}: AuthScreenProps) {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  
  const [isLogin, setIsLogin] = useState(defaultIsLogin);
  const [isRecover, setIsRecover] = useState(false);

  // Account Type: candidate vs company (only Admin can assign Level 2 Atendimento)
  const [accountType, setAccountType] = useState<'candidate' | 'company'>('candidate');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [neighborhood, setNeighborhood] = useState(ARAUCARIA_NEIGHBORHOODS[0]);
  const [education, setEducation] = useState(EDUCATION_OPTIONS[1]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Company specific fields
  const [companyName, setCompanyName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [companySegment, setCompanySegment] = useState(COMPANY_SEGMENTS[0]);
  const [companyNeighborhood, setCompanyNeighborhood] = useState(ARAUCARIA_NEIGHBORHOODS[0]);

  const [theme, toggleTheme] = useTheme();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [showLgpdModal, setShowLgpdModal] = useState(false);

  const [verificationSent, setVerificationSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  // Security brute-force protection states
  const [loginFailedAttempts, setLoginFailedAttempts] = useState(0);
  const [loginLockoutUntil, setLoginLockoutUntil] = useState(0);
  const [adminFailedAttempts, setAdminFailedAttempts] = useState(0);
  const [adminLockoutUntil, setAdminLockoutUntil] = useState(0);

  // Recovery 3-step state: 'request' | 'verify-code' | 'new-password'
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'verify-code' | 'new-password'>('request');
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [sentRecoveryCode, setSentRecoveryCode] = useState('');
  const [recoveryChallengeId, setRecoveryChallengeId] = useState<string | null>(null);
  const [recoveryServerVerified, setRecoveryServerVerified] = useState(false);
  const [recoveryDeliveryMethod, setRecoveryDeliveryMethod] = useState<VerificationDeliveryMethod>('smtp');
  const [recoveryResetToken, setRecoveryResetToken] = useState<string | null>(null);
  const [recoveryExpiresAt, setRecoveryExpiresAt] = useState<number>(Date.now() + 10 * 60 * 1000);
  const [recoveryFailedAttempts, setRecoveryFailedAttempts] = useState(0);
  const [recoveryHasSupabaseSession, setRecoveryHasSupabaseSession] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Registration verification states
  const [isVerifyingReg, setIsVerifyingReg] = useState(false);
  const [regVerifyCodeInput, setRegVerifyCodeInput] = useState('');
  const [sentRegCode, setSentRegCode] = useState('');
  const [regChallengeId, setRegChallengeId] = useState<string | null>(null);
  const [regServerVerified, setRegServerVerified] = useState(false);
  const [regExpiresAt, setRegExpiresAt] = useState<number>(Date.now() + 10 * 60 * 1000);
  const [regFailedAttempts, setRegFailedAttempts] = useState(0);
  const [tempLoggedUser, setTempLoggedUser] = useState<AppUser | null>(null);
  const [regTimer, setRegTimer] = useState(0);
  const [regDeliveryMethod, setRegDeliveryMethod] = useState<VerificationDeliveryMethod>('smtp');
  const [regEmailStatus, setRegEmailStatus] = useState<{ sending: boolean; delivered?: boolean; message?: string }>({ sending: false });
  const regDispatchLockRef = useRef<{ email: string; at: number } | null>(null);

  // OAuth / Google Mandatory 2FA + Profile Completion states
  const [oauthStep, setOauthStep] = useState<'verify-code' | 'complete-info'>('verify-code');
  const [oauthCodeInput, setOauthCodeInput] = useState('');
  const [oauthSentCode, setOauthSentCode] = useState('');
  const [oauthChallengeId, setOauthChallengeId] = useState<string | null>(null);
  const [oauthServerVerified, setOauthServerVerified] = useState(false);
  const [oauthExpiresAt, setOauthExpiresAt] = useState<number>(Date.now() + 10 * 60 * 1000);
  const [oauthFailedAttempts, setOauthFailedAttempts] = useState(0);
  const [oauthTimer, setOauthTimer] = useState(0);
  const [oauthDeliveryMethod, setOauthDeliveryMethod] = useState<VerificationDeliveryMethod>('smtp');
  const [oauthEmailStatus, setOauthEmailStatus] = useState<{ sending: boolean; delivered?: boolean; message?: string }>({ sending: false });
  const oauthDispatchedEmailRef = useRef<string | null>(null);
  const oauthDispatchSeqRef = useRef(0);

  const signupPasswordStrength = !isLogin && !isRecover && password ? validatePasswordStrength(password, email) : null;
  const recoveryPasswordStrength = isRecover && recoveryStep === 'new-password' && newPassword ? validatePasswordStrength(newPassword, email) : null;

  useEffect(() => {
    if (!enforceVerificationUser) {
      setIsLogin(defaultIsLogin);
    }
  }, [defaultIsLogin, enforceVerificationUser]);

  // Format CNPJ as 00.000.000/0000-00
  const handleCnpjChange = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 14);
    if (raw.length <= 2) {
      setCnpj(raw);
    } else if (raw.length <= 5) {
      setCnpj(`${raw.slice(0, 2)}.${raw.slice(2)}`);
    } else if (raw.length <= 8) {
      setCnpj(`${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5)}`);
    } else if (raw.length <= 12) {
      setCnpj(`${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8)}`);
    } else {
      setCnpj(`${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12, 14)}`);
    }
  };

  // Format phone as (00) 00000-0000
  const handlePhoneChange = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 11);
    if (raw.length <= 2) {
      setPhone(raw.length ? `(${raw}` : '');
    } else if (raw.length <= 6) {
      setPhone(`(${raw.slice(0, 2)}) ${raw.slice(2)}`);
    } else if (raw.length <= 10) {
      setPhone(`(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`);
    } else {
      setPhone(`(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`);
    }
  };

  const handleResendConfirmation = async () => {
    setResendLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const displayName = accountType === 'company' ? (companyName.trim() || 'Empresa') : (fullName.trim() || (registeredEmail || '').split('@')[0]);
      const { error } = await supabase.auth.signUp({ 
        email: registeredEmail, 
        password: password,
        options: {
          data: {
            full_name: displayName,
            account_type: accountType
          }
        }
      });
      if (error) throw error;
      setSuccess('Uhu! Reenviamos o e-mail de confirmação com um novo link!');
    } catch (err: any) {
      setError(err.message || 'Erro ao reenviar e-mail de confirmação.');
    } finally {
      setResendLoading(false);
    }
  };

  const verifyAdminCredentials = async (
    candidateEmail: string,
    candidatePassword: string
  ): Promise<{ authorized: boolean; error?: string }> => {
    const cleanTarget = (candidateEmail || '').trim().toLowerCase();
    if (cleanTarget !== 'oportunizahw@gmail.com' || !candidatePassword) {
      return { authorized: false, error: 'Credenciais administrativas inválidas.' };
    }

    if (!shouldSkipApiEmailProbe()) {
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), 2500);
      try {
        const res = await fetch(buildApiEndpoint('/api/admin-verify'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({ email: cleanTarget, password: candidatePassword })
        });
        const isJson = (res.headers.get('content-type') || '').toLowerCase().includes('application/json');
        const data: any = isJson ? await res.json().catch(() => ({})) : {};
        if (!isJson || res.status === 404 || res.status === 405) {
          markApiEmailProbeUnavailable();
        } else if (res.ok && data?.ok) {
          return { authorized: true };
        } else {
          return {
            authorized: false,
            error: data?.error || 'E-mail ou senha do administrador incorretos.'
          };
        }
      } catch {
        markApiEmailProbeUnavailable();
      } finally {
        clearTimeout(timeoutId);
      }
    }

    const clientValid = verifyAdminAccessCodeClient(candidatePassword);
    return clientValid
      ? { authorized: true }
      : { authorized: false, error: 'E-mail ou senha do administrador incorretos.' };
  };

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (adminLockoutUntil > now) {
      const waitSec = Math.ceil((adminLockoutUntil - now) / 1000);
      setError(`Acesso administrativo temporariamente bloqueado por excesso de erros. Aguarde ${waitSec}s.`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const verification = await verifyAdminCredentials('oportunizahw@gmail.com', adminPassword);
    if (verification.authorized) {
      setAdminFailedAttempts(0);
      setAdminLockoutUntil(0);
      clearSession2FAVerification();
      setSuccess('Credenciais validadas! Redirecionando para verificação 2FA...');
      try {
        await recordAuditLog({
          actor_name: 'Administrador Orchent',
          actor_email: 'oportunizahw@gmail.com',
          actor_role: 'Administrador',
          action: 'Autenticação Primária Admin Autorizada',
          target_name: 'Painel Administrativo Oportuniza',
          target_type: 'security',
          details: 'Credenciais primárias validadas; aguardando código 2FA por e-mail.',
          status: 'authorized'
        });
      } catch {}
      const adminUser = {
        id: '00000000-0000-4000-8000-000000000604',
        name: 'Administrador Orchent',
        email: 'oportunizahw@gmail.com',
        avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        isAdmin: true,
        role: 'Administrador',
        cargo: 'Administrador',
        is2FAEnabled: true
      };
      setTimeout(() => {
        setLoading(false);
        if (onAdminLoginSuccess) {
          onAdminLoginSuccess(adminUser);
        }
      }, 150);
    } else {
      const nextFails = adminFailedAttempts + 1;
      setAdminFailedAttempts(nextFails);
      setAdminPassword('');
      setLoading(false);
      if (nextFails >= 5) {
        setAdminLockoutUntil(Date.now() + 60 * 1000);
        setAdminFailedAttempts(0);
        setError('5 tentativas incorretas detectadas. Acesso administrativo bloqueado por 60 segundos.');
        try {
          await recordAuditLog({
            actor_name: 'Sistema Anti-Fraude Oportuniza',
            actor_email: 'oportunizahw@gmail.com',
            actor_role: 'Firewall de Segurança',
            action: 'Bloqueio Preventivo de Login Admin',
            target_name: 'Painel Administrativo',
            target_type: 'security',
            details: '5 erros consecutivos no código administrativo acionaram pausa automática de 60 segundos.',
            status: 'warning'
          });
        } catch {}
      } else {
        setError(verification.error || `E-mail ou senha do administrador incorretos (${5 - nextFails} tentativa(s) restante(s)).`);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    clearSession2FAVerification();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAppRedirectUrl(),
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login com Google.');
      setLoading(false);
    }
  };

  const handleGitHubLogin = async () => {
    setLoading(true);
    setError(null);
    clearSession2FAVerification();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: getAppRedirectUrl(),
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login com GitHub.');
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const getFriendlyErrorMessage = (errMsg: string) => {
      if (!errMsg) return 'Ocorreu um erro na autenticação';
      const lower = errMsg.toLowerCase();
      if (lower.includes('rate limit') || lower.includes('email rate limit exceeded')) {
        return 'Limite de solicitações de e-mail atingido! Por segurança, aguarde de 5 a 10 minutos para tentar novamente com este e-mail.';
      }
      if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
        return 'E-mail ou senha incorretos.';
      }
      if (lower.includes('failed to fetch') || lower.includes('network error')) {
        return 'Erro de conexão: Não conseguimos falar com o servidor. Verifique sua internet ou tente novamente em instantes.';
      }
      if (lower.includes('user already registered') || lower.includes('already exists') || lower.includes('já está sendo utilizado') || lower.includes('bloqueado')) {
        return 'Este e-mail já está sendo utilizado ou encontra-se bloqueado.';
      }
      if (lower.includes('email not confirmed')) {
        return 'Por favor, confirme seu e-mail antes de fazer login.';
      }
      if (lower.includes('email logins are disabled') || lower.includes('signups not allowed')) {
        return 'O login por e-mail está temporariamente desativado ou exigindo confirmação. Por favor, utilize "Entrar com Google" ou tente novamente em instantes.';
      }
      if (lower.includes('password should be') || lower.includes('password must be')) {
        return 'A senha deve conter pelo menos 6 caracteres.';
      }
      return errMsg;
    };

    if (isRecover) {
      const cleanRecEmail = email.trim().toLowerCase();

      if (recoveryStep === 'request') {
        if (!cleanRecEmail || !cleanRecEmail.includes('@')) {
          setError('Por favor, digite seu e-mail completo.');
          setLoading(false);
          return;
        }

        const generatedCode = generateSecureOtpCode();
        setSentRecoveryCode(generatedCode);
        setRecoveryChallengeId(null);
        setRecoveryServerVerified(false);
        setRecoveryResetToken(null);
        setRecoveryFailedAttempts(0);
        setRecoveryHasSupabaseSession(false);

        const mailRes = await sendVerificationCodeEmail({
          email: cleanRecEmail,
          code: generatedCode,
          userName: cleanRecEmail.split('@')[0],
          kind: 'recovery'
        });

        setRecoveryDeliveryMethod(mailRes.deliveryMethod || 'smtp');

        if (mailRes.delivered) {
          setRecoveryChallengeId(mailRes.challengeId || null);
          setRecoveryServerVerified(Boolean(mailRes.serverVerified && mailRes.challengeId));
          setRecoveryExpiresAt(Date.now() + (mailRes.expiresInSeconds || 600) * 1000);
          setSuccess(mailRes.message || `Código de 8 dígitos enviado com sucesso para ${cleanRecEmail}! Digite o código abaixo.`);
          setRecoveryStep('verify-code');
        } else if (mailRes.timedOut) {
          setRecoveryExpiresAt(Date.now() + 10 * 60 * 1000);
          setSuccess(`Verifique sua caixa de entrada ou Spam de ${cleanRecEmail} — digite o código de 8 dígitos abaixo.`);
          setRecoveryStep('verify-code');
        } else {
          setError(mailRes.error || 'Não foi possível enviar o código de recuperação. Tente novamente em instantes.');
        }

        setLoading(false);
        return;
      }

      if (recoveryStep === 'verify-code') {
        if (recoveryFailedAttempts >= 5) {
          setError('Código bloqueado após 5 tentativas incorretas. Volte e solicite um novo código.');
          setLoading(false);
          return;
        }
        if (Date.now() > recoveryExpiresAt) {
          setError('Este código expirou após 10 minutos. Volte e solicite um novo código.');
          setLoading(false);
          return;
        }

        const cleanCode = recoveryCodeInput.replace(/\D/g, '').slice(0, 8);
        if (cleanCode.length !== 8) {
          setError('Por favor, informe os 8 dígitos enviados para seu e-mail.');
          setLoading(false);
          return;
        }

        if (recoveryDeliveryMethod === 'supabase-otp') {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('oportuniza-recovery-in-progress', cleanRecEmail);
          }
          const otpCheck = await verifySupabaseOtpCode(cleanRecEmail, cleanCode, ['email', 'recovery']);
          if (!otpCheck.verified) {
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem('oportuniza-recovery-in-progress');
            }
            if (otpCheck.errorKind === 'timeout' || otpCheck.errorKind === 'rate-limit') {
              setError(otpCheck.error || 'Erro temporário ao validar código. Tente novamente em instantes.');
              setLoading(false);
              return;
            }
            const nextFails = recoveryFailedAttempts + 1;
            setRecoveryFailedAttempts(nextFails);
            setRecoveryCodeInput('');
            setError(
              nextFails >= 5
                ? 'Código bloqueado após 5 tentativas incorretas. Volte e solicite um novo código.'
                : `${otpCheck.error || 'Código de recuperação incorreto ou expirado.'} Restam ${5 - nextFails} tentativa(s).`
            );
            setLoading(false);
            return;
          }
          setRecoveryHasSupabaseSession(true);
          setRecoveryFailedAttempts(0);
          setSuccess('Código verificado com sucesso! Agora defina sua nova senha.');
          setRecoveryStep('new-password');
          setLoading(false);
          return;
        }

        if (recoveryServerVerified && recoveryChallengeId) {
          const serverCheck = await verifyServerSecurityCode({
            challengeId: recoveryChallengeId,
            email: cleanRecEmail,
            code: cleanCode,
            kind: 'recovery'
          });
          if (!serverCheck.verified) {
            if (serverCheck.locked) {
              setRecoveryFailedAttempts(5);
            } else {
              setRecoveryFailedAttempts((prev) => prev + 1);
            }
            setRecoveryCodeInput('');
            setError(serverCheck.error || 'Código incorreto. Verifique no e-mail recebido e tente novamente.');
            setLoading(false);
            return;
          }
          setRecoveryResetToken(serverCheck.resetToken || null);
          setRecoveryFailedAttempts(0);
          setSuccess('Código verificado com sucesso! Agora defina sua nova senha.');
          setRecoveryStep('new-password');
          setLoading(false);
          return;
        }

        if (!sentRecoveryCode || cleanCode !== sentRecoveryCode) {
          const nextFails = recoveryFailedAttempts + 1;
          setRecoveryFailedAttempts(nextFails);
          setRecoveryCodeInput('');
          setError(
            nextFails >= 5
              ? 'Código bloqueado após 5 tentativas incorretas. Volte e solicite um novo código.'
              : `Código de verificação incorreto. Restam ${5 - nextFails} tentativa(s).`
          );
          setLoading(false);
          return;
        }

        setRecoveryFailedAttempts(0);
        setSuccess('Código verificado com sucesso! Agora defina sua nova senha.');
        setRecoveryStep('new-password');
        setLoading(false);
        return;
      }

      if (recoveryStep === 'new-password') {
        const pwdCheck = validatePasswordStrength(newPassword, cleanRecEmail);
        if (!pwdCheck.isValid) {
          setError(pwdCheck.error || 'A nova senha deve conter pelo menos 8 caracteres combinando letras e números.');
          setLoading(false);
          return;
        }

        if (newPassword !== confirmNewPassword) {
          setError('As senhas não coincidem. Digite a mesma senha nos dois campos.');
          setLoading(false);
          return;
        }

        try {
          if (!cleanRecEmail) {
            setError('Sessão expirada. Por favor, reinicie o processo de recuperação.');
            setRecoveryStep('request');
            setLoading(false);
            return;
          }

          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData?.session?.access_token || '';

          let updatedSupabaseAuth = false;
          if (recoveryHasSupabaseSession || accessToken) {
            const { error: supaErr } = await supabase.auth.updateUser({ password: newPassword });
            if (!supaErr) {
              updatedSupabaseAuth = true;
            }
            try {
              const hashedPwd = await hashPasswordForStorageClient(newPassword);
              await supabase
                .from('users')
                .update({ password: hashedPwd, updated_at: new Date().toISOString() })
                .ilike('email', cleanRecEmail);
            } catch {
              // Optional profile password hash sync
            }
          }

          let updatedBackend = false;
          if (!shouldSkipApiEmailProbe() && (recoveryResetToken || accessToken)) {
            const response = await fetch(buildApiEndpoint('/api/update-password'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
              },
              body: JSON.stringify({
                email: cleanRecEmail,
                newPassword,
                ...(recoveryResetToken ? { resetToken: recoveryResetToken } : {})
              })
            });

            const isJson = (response.headers.get('content-type') || '').toLowerCase().includes('application/json');
            const result = isJson ? await response.json().catch(() => ({})) : {};

            if (!isJson || response.status === 404 || response.status === 405) {
              markApiEmailProbeUnavailable();
            } else if (response.ok) {
              updatedBackend = true;
            } else if (!updatedSupabaseAuth) {
              const errorMsg = result.hint ? `${result.error}. ${result.hint}` : (result.error || 'Não foi possível redefinir a senha.');
              throw new Error(errorMsg);
            }
          }

          if (!updatedSupabaseAuth && !updatedBackend) {
            throw new Error('Não foi possível validar a sessão de recuperação para alterar a senha. Recomece o processo.');
          }

          try {
            await recordAuditLog({
              actor_name: cleanRecEmail.split('@')[0],
              actor_email: cleanRecEmail,
              actor_role: 'Recuperação de Conta',
              action: 'Redefinição de Senha Concluída',
              target_name: cleanRecEmail,
              target_type: 'security',
              details: 'Senha atualizada após validação de código de segurança de 8 dígitos.',
              status: 'authorized'
            });
          } catch {}

          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('oportuniza-recovery-in-progress');
          }
          clearSession2FAVerification();
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch {}

          setSuccess('Excelente! Sua senha foi redefinida com segurança. Faça login com sua nova senha...');

          setTimeout(() => {
            setRecoveryStep('request');
            setIsRecover(false);
            setIsLogin(true);
            setPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
            setRecoveryCodeInput('');
            setRecoveryResetToken(null);
            setRecoveryChallengeId(null);
            setRecoveryServerVerified(false);
            setRecoveryHasSupabaseSession(false);
            setError(null);
            setSuccess(null);
            setLoading(false);
          }, 1800);
        } catch (err: any) {
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('oportuniza-recovery-in-progress');
          }
          console.error('Password reset flow error:', err);
          setError(err.message || 'Erro ao redefinir a senha. Tente novamente.');
          setLoading(false);
        }
        return;
      }
    }

    const cleanEmail = email.trim().toLowerCase();

    // Registration validation
    if (!isLogin) {
      // 1. Email syntax & disposable domain check (Anti-Zaralho / Anti-Fake)
      const emailVal = validateEmailAddress(cleanEmail);
      if (!emailVal.isValid) {
        setError(emailVal.error || 'E-mail inválido ou descartável.');
        setLoading(false);
        recordAuditLog({
          actor_name: accountType === 'company' ? (companyName || 'Empresa') : (fullName || 'Candidato'),
          actor_email: cleanEmail,
          actor_role: 'Sistema Anti-Fraude',
          action: 'Tentativa de Cadastro Bloqueada',
          target_name: cleanEmail,
          target_type: 'security',
          details: `Bloqueado por: ${emailVal.error}`,
          status: 'blocked'
        });
        return;
      }

      if (accountType === 'candidate') {
        const nameVal = validatePersonOrCompanyName(fullName, false);
        if (!nameVal.isValid) {
          setError(nameVal.error || 'Por favor, informe seu nome completo real.');
          setLoading(false);
          return;
        }
        const offensiveName = containsOffensiveLanguage(fullName);
        if (offensiveName.found) {
          setError(`Cadastro bloqueado: O nome informado contém termo inapropriado ("${offensiveName.word}"). Nomes falsos, vulgares ou conteúdo +18 são proibidos.`);
          setLoading(false);
          return;
        }
        const phoneVal = validatePhoneNumber(phone);
        if (!phoneVal.isValid) {
          setError(phoneVal.error || 'Número de telefone inválido.');
          setLoading(false);
          return;
        }
        if (!lgpdAccepted) {
          setError('Atenção: É obrigatório aceitar o Termo de Proteção de Dados e Tratamento de Informações (LGPD Lei nº 13.709/18) para criar seu cadastro de candidato.');
          setLoading(false);
          return;
        }
      } else {
        // Company validations
        const compVal = validatePersonOrCompanyName(companyName, true);
        if (!compVal.isValid) {
          setError(compVal.error || 'Por favor, informe a Razão Social ou Nome Fantasia real.');
          setLoading(false);
          return;
        }
        const respVal = validatePersonOrCompanyName(responsibleName, false);
        if (!respVal.isValid) {
          setError(respVal.error || 'Por favor, informe o nome do Responsável ou RH.');
          setLoading(false);
          return;
        }
        const compOffensive = containsOffensiveLanguage(companyName);
        if (compOffensive.found) {
          setError(`Cadastro de Empresa bloqueado: Razão Social contém termo inapropriado ("${compOffensive.word}"). Publicação de conteúdos falsos ou +18 acarretará sanções cíveis e criminais.`);
          setLoading(false);
          return;
        }
        const respOffensive = containsOffensiveLanguage(responsibleName);
        if (respOffensive.found) {
          setError(`Cadastro de Empresa bloqueado: Nome do responsável contém termo inapropriado ("${respOffensive.word}").`);
          setLoading(false);
          return;
        }
        const phoneVal = validatePhoneNumber(phone);
        if (!phoneVal.isValid) {
          setError(phoneVal.error || 'Número de telefone comercial inválido.');
          setLoading(false);
          return;
        }
        const cnpjVal = validateCnpj(cnpj);
        if (!cnpjVal.isValid) {
          setError(cnpjVal.error || 'CNPJ inválido.');
          setLoading(false);
          return;
        }

        // LGPD and Legal Responsibility Term mandatory check
        if (!lgpdAccepted) {
          setError('Atenção: É obrigatório ler e aceitar o Termo de Responsabilidade Jurídica e a LGPD (Lei 13.709/18) para cadastrar sua empresa em Araucária.');
          setLoading(false);
          return;
        }
      }

      if (password !== confirmPassword) {
        setError('As senhas não coincidem');
        setLoading(false);
        return;
      }

      const pwdStrengthCheck = validatePasswordStrength(password, cleanEmail);
      if (!pwdStrengthCheck.isValid) {
        setError(pwdStrengthCheck.error || 'A senha deve conter pelo menos 8 caracteres combinando letras e números.');
        setLoading(false);
        return;
      }
    }

    try {
      if (isLogin) {
        const nowTs = Date.now();
        if (loginLockoutUntil > nowTs) {
          const waitSec = Math.ceil((loginLockoutUntil - nowTs) / 1000);
          setError(`Muitas tentativas de login incorretas. Por segurança, aguarde ${waitSec}s.`);
          setLoading(false);
          return;
        }

        // Sempre limpar a verificação 2FA da sessão anterior em qualquer nova tentativa de login
        clearSession2FAVerification();

        // 1. Verificação prévia de bloqueio rigorosa (banco de dados e cache)
        const isPreBlocked = await isAccountBlocked({ email: cleanEmail });
        if (isPreBlocked) {
          const reason = await fetchAccountBlockReason({ email: cleanEmail });
          setError(`Esta conta foi bloqueada pelo administrador. Motivo: "${reason}". Acesso negado e revogado.`);
          setLoading(false);
          return;
        }

        let authResult = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        
        if (authResult.error) {
          console.warn("Supabase signInWithPassword returned error:", authResult.error.message);
          
          const { data: dbUserMatch } = await supabase
            .from('users')
            .select('*')
            .ilike('email', cleanEmail)
            .maybeSingle();

          if (dbUserMatch) {
            if (isUserRecordBlocked(dbUserMatch)) {
              const reason = extractBlockReasonFromRecord(dbUserMatch) || await fetchAccountBlockReason({ id: dbUserMatch.id, email: cleanEmail });
              setError(`Esta conta foi bloqueada pelo administrador. Motivo: "${reason}". Acesso negado e revogado.`);
              setLoading(false);
              return;
            }

            const passwordMatched = dbUserMatch.password
              ? await verifyStoredPasswordClient(password, dbUserMatch.password)
              : false;
            if (!passwordMatched) {
              const nextFails = loginFailedAttempts + 1;
              setLoginFailedAttempts(nextFails);
              if (nextFails >= 5) {
                setLoginLockoutUntil(Date.now() + 45 * 1000);
                setLoginFailedAttempts(0);
                setError('5 tentativas incorretas detectadas. Login pausado por 45 segundos para proteger sua conta.');
              } else {
                setError(`E-mail ou senha incorretos (${5 - nextFails} tentativa(s) restante(s)).`);
              }
              setLoading(false);
              return;
            }

            setLoginFailedAttempts(0);
            setLoginLockoutUntil(0);

            const isDbAdmin = Boolean(
              dbUserMatch.is_admin ||
              dbUserMatch.role === 'Administrador' ||
              dbUserMatch.cargo === 'Administrador' ||
              cleanEmail === 'oportunizahw@gmail.com'
            );
            const isDbCompany =
              String(dbUserMatch.account_type || '').toLowerCase() === 'company' ||
              String(dbUserMatch.role || '').toLowerCase() === 'empresa' ||
              String(dbUserMatch.cargo || '').toLowerCase() === 'empresa';

            const fallbackUser: AppUser = {
              id: dbUserMatch.id || 'usr-' + Date.now(),
              name: dbUserMatch.name || cleanEmail.split('@')[0],
              email: cleanEmail,
              avatarUrl: dbUserMatch.avatar_url || '',
              bio: dbUserMatch.bio || '',
              education: dbUserMatch.education || (isDbCompany ? 'Empresa / Empregador' : 'Ensino Médio'),
              experience: dbUserMatch.experience || '',
              phone: dbUserMatch.phone || '',
              skills: Array.isArray(dbUserMatch.skills) ? dbUserMatch.skills : [],
              accountType: isDbCompany ? 'company' : 'candidate',
              companyName: dbUserMatch.company_name || undefined,
              cnpj: dbUserMatch.cnpj || undefined,
              companySegment: dbUserMatch.company_segment || undefined,
              companyNeighborhood: dbUserMatch.company_neighborhood || undefined,
              responsibleName: dbUserMatch.responsible_name || undefined,
              status: String(dbUserMatch.status || '').toLowerCase() === 'pending' ? 'pending' : 'active',
              isAdmin: isDbAdmin,
              role: dbUserMatch.role || (isDbAdmin ? 'Administrador' : isDbCompany ? 'Empresa' : 'Candidato'),
              cargo: dbUserMatch.cargo || (isDbAdmin ? 'Administrador' : isDbCompany ? 'Empresa' : 'Estudante'),
              is2FAEnabled: true
            };

            setLoading(false);
            if (onLoginSuccess) {
              onLoginSuccess(fallbackUser);
            }
            return;
          } else {
            // Admin fallback (exige validação administrativa server/hash e obriga 2FA na próxima tela)
            if (cleanEmail === 'oportunizahw@gmail.com') {
              const adminCheck = await verifyAdminCredentials(cleanEmail, password);
              if (adminCheck.authorized) {
                setLoginFailedAttempts(0);
                setLoginLockoutUntil(0);
                const adminFallback: AppUser = {
                  id: '00000000-0000-4000-8000-000000000604',
                  name: 'Administrador Orchent',
                  email: cleanEmail,
                  isAdmin: true,
                  role: 'Administrador',
                  cargo: 'Administrador',
                  is2FAEnabled: true
                };
                setLoading(false);
                if (onLoginSuccess) {
                  onLoginSuccess(adminFallback);
                }
                return;
              }
            }
          }

          const nextFails = loginFailedAttempts + 1;
          setLoginFailedAttempts(nextFails);
          if (nextFails >= 5) {
            setLoginLockoutUntil(Date.now() + 45 * 1000);
            setLoginFailedAttempts(0);
            setLoading(false);
            setError('5 tentativas incorretas detectadas. Login pausado por 45 segundos para proteger sua conta.');
            return;
          }

          throw authResult.error;
        }

        setLoginFailedAttempts(0);
        setLoginLockoutUntil(0);

        const data = authResult.data;
        
        if (data && data.user) {
          // 2. Verificação pós-autenticação por ID e e-mail
          const isPostBlocked = await isAccountBlocked({ id: data.user.id, email: cleanEmail });
          if (isPostBlocked) {
            await supabase.auth.signOut();
            const reason = await fetchAccountBlockReason({ id: data.user.id, email: cleanEmail });
            setError(`Esta conta foi bloqueada pelo administrador. Motivo: "${reason}". Acesso negado e revogado.`);
            setLoading(false);
            return;
          }

          const meta = data.user.user_metadata || {};
          let dbUser: any = null;
          let companyRow: any = null;

          try {
            const { data: uRow } = await supabase.from('users').select('*').eq('id', data.user.id).maybeSingle();
            dbUser = uRow;
            if (!dbUser && cleanEmail) {
              const { data: uByEmail } = await supabase.from('users').select('*').ilike('email', cleanEmail).maybeSingle();
              dbUser = uByEmail;
            }
            if (cleanEmail) {
              const { data: cRow } = await supabase.from('companies').select('*').ilike('email', cleanEmail).maybeSingle();
              companyRow = cRow;
            }
          } catch (e) {}

          if (dbUser && isUserRecordBlocked(dbUser)) {
            await supabase.auth.signOut();
            const reason = extractBlockReasonFromRecord(dbUser) || await fetchAccountBlockReason({ id: data.user.id, email: cleanEmail });
            setError(`Esta conta foi bloqueada pelo administrador. Motivo: "${reason}". Acesso negado e revogado.`);
            setLoading(false);
            return;
          }

          const isAdminUser = Boolean(
            dbUser?.is_admin ||
            meta.is_admin ||
            dbUser?.role === 'Administrador' ||
            dbUser?.cargo === 'Administrador' ||
            cleanEmail === 'oportunizahw@gmail.com'
          );

          const rawType = String(dbUser?.account_type || meta.account_type || '').toLowerCase();
          const rawRole = String(dbUser?.role || dbUser?.cargo || meta.role || meta.cargo || '').toLowerCase();
          const isComp = rawType === 'company' || rawRole === 'empresa';

          const userRole = dbUser?.role || meta.role || meta.cargo || (isAdminUser ? 'Administrador' : (isComp ? 'Empresa' : 'Candidato'));
          const userCargo = dbUser?.cargo || meta.cargo || meta.role || (isAdminUser ? 'Administrador' : (isComp ? 'Empresa' : 'Estudante'));
          const isPendingInDb = String(dbUser?.status || '').toLowerCase() === 'pending';

          const loggedUser: AppUser = {
            id: data.user.id,
            name: (isComp ? (companyRow?.company_name || dbUser?.company_name || meta.company_name) : null) || dbUser?.name || meta.full_name || data.user.email?.split('@')[0] || 'Usuário',
            email: data.user.email || cleanEmail,
            avatarUrl: dbUser?.avatar_url || meta.avatar_url || '',
            bio: dbUser?.bio || meta.bio || (isComp ? `Empresa atuante no setor ${companyRow?.segment || meta.company_segment || 'Comércio'} em Araucária` : ''),
            education: dbUser?.education || meta.education || (isComp ? 'Empresa / Empregador' : 'Ensino Médio em andamento'),
            experience: dbUser?.experience || meta.experience || (isComp ? 'Empresa Contratante em Araucária' : 'Nenhuma registrada'),
            phone: (isComp ? companyRow?.phone : null) || dbUser?.phone || meta.phone || '',
            skills: Array.isArray(dbUser?.skills) ? dbUser.skills : (meta.skills || []),
            favorites: [],
            status: isAdminUser ? 'active' : (isPendingInDb ? 'pending' : 'active'),
            accountType: isComp ? 'company' : 'candidate',
            companyName: isComp ? (companyRow?.company_name || dbUser?.company_name || meta.company_name) : undefined,
            cnpj: isComp ? (companyRow?.cnpj || dbUser?.cnpj || meta.cnpj) : undefined,
            companySegment: isComp ? (companyRow?.segment || dbUser?.company_segment || meta.company_segment) : undefined,
            companyNeighborhood: isComp ? (companyRow?.neighborhood || dbUser?.company_neighborhood || meta.company_neighborhood) : undefined,
            responsibleName: isComp ? (companyRow?.responsible_name || dbUser?.responsible_name || meta.responsible_name) : undefined,
            isAdmin: isAdminUser,
            role: userRole,
            cargo: userCargo,
            is2FAEnabled: true
          };

          // App.tsx obrigatoriamente exige 2FA antes de liberar qualquer painel ou área logada
          if (onLoginSuccess) {
            onLoginSuccess(loggedUser);
          }
        }
      } else {
        // 1. Verificação prévia de cadastro via RPC seguro (sem expor perfis de outros usuários)
        const preCheck = await checkEmailRegisteredOrBlocked(cleanEmail);
        if (preCheck.isBlocked) {
          const reason = preCheck.blockReason || await fetchAccountBlockReason({ email: cleanEmail });
          setError(`Esta conta/e-mail foi bloqueada pelo administrador. Motivo: "${reason}". Novos cadastros estão impedidos.`);
          setLoading(false);
          return;
        }

        if (preCheck.exists) {
          setError('Este e-mail já está sendo utilizado ou encontra-se cadastrado.');
          setLoading(false);
          return;
        }

        const displayName = accountType === 'company' ? companyName.trim() : fullName.trim();

        const userMetadata: Record<string, any> = {
          full_name: displayName,
          account_type: accountType,
          phone: phone.trim(),
          requires_activation: true,
          account_activated: false,
          profile_completed: true,
          role: accountType === 'company' ? 'Empresa' : 'Candidato',
          cargo: accountType === 'company' ? 'Empresa' : 'Estudante'
        };

        if (accountType === 'company') {
          userMetadata.company_name = companyName.trim();
          userMetadata.cnpj = cnpj.trim();
          userMetadata.responsible_name = responsibleName.trim();
          userMetadata.company_segment = companySegment;
          userMetadata.company_neighborhood = companyNeighborhood;
        } else {
          userMetadata.neighborhood = neighborhood;
        }

        if (typeof window !== 'undefined') {
          sessionStorage.setItem('oportuniza-reg-in-progress', cleanEmail);
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ 
          email: cleanEmail, 
          password,
          options: {
            emailRedirectTo: getAppRedirectUrl(),
            data: userMetadata
          }
        });

        if (signUpError) {
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('oportuniza-reg-in-progress');
          }
          const lowerErr = (signUpError.message || '').toLowerCase();
          if (lowerErr.includes('already registered') || lowerErr.includes('already exists') || lowerErr.includes('duplicate')) {
            throw new Error('Este e-mail já está sendo utilizado ou encontra-se bloqueado.');
          }
          throw signUpError;
        }
        
        // --- Verificação por Código de 8 Dígitos (CSPRNG) ---
        const registrationCode = generateSecureOtpCode();
        setSentRegCode(registrationCode);
        setRegChallengeId(null);
        setRegServerVerified(false);
        setRegExpiresAt(Date.now() + 10 * 60 * 1000);
        setRegFailedAttempts(0);
        setRegVerifyCodeInput('');
        setRegTimer(60);
        
        // Armazenamos temporariamente os dados do usuário para salvar e logar após a verificação
        const newUser: AppUser = {
          id: signUpData?.user?.id || 'usr-' + Date.now(),
          name: displayName || cleanEmail.split('@')[0],
          email: cleanEmail,
          avatarUrl: '',
          bio: accountType === 'company' 
            ? `Empresa atuante no setor ${companySegment} em Araucária` 
            : `Candidato em Araucária (${neighborhood})`,
          education: accountType === 'company' ? 'Empresa / Empregador' : education,
          experience: accountType === 'company' ? 'Empresa Contratante em Araucária' : 'Nenhuma registrada',
          phone: phone.trim(),
          skills: [],
          favorites: [],
          status: 'pending',
          accountType: accountType === 'company' ? 'company' : 'candidate',
          companyName: accountType === 'company' ? companyName.trim() : undefined,
          cnpj: accountType === 'company' ? cnpj.trim() : undefined,
          responsibleName: accountType === 'company' ? responsibleName.trim() : undefined,
          companySegment: accountType === 'company' ? companySegment : undefined,
          companyNeighborhood: accountType === 'company' ? companyNeighborhood : neighborhood,
          role: accountType === 'company' ? 'Empresa' : 'Candidato',
          cargo: accountType === 'company' ? 'Empresa' : 'Estudante'
        };
        
        setTempLoggedUser(newUser);

        // Enviar e-mail de ativação via backend (evitando apenas duplo-clique simultâneo)
        const nowTs = Date.now();
        const isDuplicateRapidClick =
          regDispatchLockRef.current &&
          regDispatchLockRef.current.email === cleanEmail &&
          nowTs - regDispatchLockRef.current.at < 3000;

        if (!isDuplicateRapidClick) {
          regDispatchLockRef.current = { email: cleanEmail, at: nowTs };
          setRegDeliveryMethod('smtp');
          setRegEmailStatus({ sending: true });
          const alreadyDispatchedSignupOtp = Boolean(signUpData?.user && !signUpData?.session);
          const mailResult = await sendActivationCodeEmail(cleanEmail, registrationCode, newUser.name, alreadyDispatchedSignupOtp);
          if (mailResult.deliveryMethod) {
            setRegDeliveryMethod(mailResult.deliveryMethod);
          }
          if (mailResult.delivered) {
            setRegDeliveryMethod(mailResult.deliveryMethod || 'smtp');
            setRegChallengeId(mailResult.challengeId || null);
            setRegServerVerified(Boolean(mailResult.serverVerified && mailResult.challengeId));
            setRegExpiresAt(Date.now() + (mailResult.expiresInSeconds || 600) * 1000);
            setRegEmailStatus({
              sending: false,
              delivered: true,
              message:
                mailResult.message ||
                `Código de 8 dígitos enviado via ${mailResult.providerLabel || 'oportunizahw@gmail.com'} para ${cleanEmail}.`
            });
            setSuccess(`Um código de 8 dígitos foi enviado para ${cleanEmail}. Digite-o abaixo para ativar sua conta.`);
          } else {
            setRegTimer(0);
            setRegEmailStatus({
              sending: false,
              delivered: false,
              message: mailResult.error || `Não foi possível confirmar o envio do e-mail para ${cleanEmail}. Tente reenviar em instantes.`
            });
            setSuccess(null);
          }
        }

        setIsVerifyingReg(true);
        setLoading(false);
        return;
      }
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err.message || 'Ocorreu um erro na autenticação'));
    } finally {
      setLoading(false);
    }
  };

  async function sendActivationCodeEmail(
    targetEmail: string,
    codeToSend: string,
    targetName: string,
    alreadyDispatchedSignupOtp = false
  ) {
    return await sendVerificationCodeEmail({
      email: targetEmail,
      code: codeToSend,
      userName: targetName,
      kind: 'registration',
      accountType,
      alreadyDispatchedSignupOtp
    });
  }

  async function upsertUserProfileSafely(fullPayload: Record<string, any>, fallbackPayload: Record<string, any>) {
    try {
      const { error: firstErr } = await supabase
        .from('users')
        .upsert(fullPayload, { onConflict: 'id' });

      if (firstErr) {
        const msg = (firstErr.message || '').toLowerCase();
        const isMissingCol =
          firstErr.code === 'PGRST204' ||
          (firstErr as any).code === '42703' ||
          msg.includes('column') ||
          msg.includes('schema cache');

        if (isMissingCol) {
          const { error: secondErr } = await supabase
            .from('users')
            .upsert(fallbackPayload, { onConflict: 'id' });
          if (secondErr) {
            console.warn('Fallback users upsert warning:', secondErr.message);
          }
        } else {
          console.warn('Users upsert warning:', firstErr.message);
        }
      }
    } catch (e) {
      console.warn('Exception during users profile upsert:', e);
    }
  }

  const dispatchOAuthCode = async (targetUser: AppUser) => {
    const cleanTargetEmail = (targetUser.email || '').trim().toLowerCase();
    if (!cleanTargetEmail) return;

    const seq = ++oauthDispatchSeqRef.current;
    const code = generateSecureOtpCode();
    setOauthSentCode(code);
    setOauthChallengeId(null);
    setOauthServerVerified(false);
    setOauthExpiresAt(Date.now() + 10 * 60 * 1000);
    setOauthFailedAttempts(0);
    setOauthCodeInput('');
    setOauthTimer(60);
    setOauthDeliveryMethod('smtp');
    setError(null);
    setSuccess(null);
    setOauthEmailStatus({ sending: true });

    try {
      const res = await sendVerificationCodeEmail({
        email: cleanTargetEmail,
        code,
        userName: targetUser.name || cleanTargetEmail.split('@')[0],
        kind: 'login-2fa',
        isAdmin: Boolean(targetUser.isAdmin),
        accountType: targetUser.accountType
      });

      if (seq !== oauthDispatchSeqRef.current) return;

      if (res.deliveryMethod) {
        setOauthDeliveryMethod(res.deliveryMethod);
      }

      if (res.delivered) {
        setOauthDeliveryMethod(res.deliveryMethod || 'smtp');
        setOauthChallengeId(res.challengeId || null);
        setOauthServerVerified(Boolean(res.serverVerified && res.challengeId));
        setOauthExpiresAt(Date.now() + (res.expiresInSeconds || 600) * 1000);
        setOauthEmailStatus({
          sending: false,
          delivered: true,
          message:
            res.message ||
            `Código enviado via ${res.providerLabel || 'oportunizahw@gmail.com'} para ${cleanTargetEmail}. Verifique sua caixa de entrada ou Spam.`
        });
      } else {
        setOauthTimer(0);
        setOauthEmailStatus({
          sending: false,
          delivered: false,
          message: res.error || `Não foi possível enviar o código para ${cleanTargetEmail}. Clique em "Reenviar código".`
        });
      }
    } catch (err: any) {
      if (seq !== oauthDispatchSeqRef.current) return;
      setOauthTimer(0);
      setOauthEmailStatus({
        sending: false,
        delivered: false,
        message: err?.message || `Erro inesperado ao enviar código para ${cleanTargetEmail}. Clique em "Reenviar código".`
      });
    }
  };

  useEffect(() => {
    if (!enforceVerificationUser) {
      oauthDispatchedEmailRef.current = null;
      return;
    }

    const cleanTargetEmail = (enforceVerificationUser.email || '').trim().toLowerCase();
    if (!cleanTargetEmail) return;

    // Do not reset active verification step/input/errors if same pending user re-renders
    if (oauthDispatchedEmailRef.current === cleanTargetEmail) {
      return;
    }
    oauthDispatchedEmailRef.current = cleanTargetEmail;

    setEmail(cleanTargetEmail);
    setRegisteredEmail(cleanTargetEmail);
    setVerificationSent(false);
    setIsLogin(false);
    setIsRecover(false);
    setIsAdminMode(false);
    setOauthStep('verify-code');
    setError(null);
    setSuccess(null);

    if (enforceVerificationUser.accountType === 'company') {
      setAccountType('company');
      setCompanyName(enforceVerificationUser.companyName || enforceVerificationUser.name || '');
      setResponsibleName(enforceVerificationUser.responsibleName || enforceVerificationUser.name || '');
      setCnpj(enforceVerificationUser.cnpj || '');
      if (enforceVerificationUser.companySegment) setCompanySegment(enforceVerificationUser.companySegment);
      if (enforceVerificationUser.companyNeighborhood) setCompanyNeighborhood(enforceVerificationUser.companyNeighborhood);
    } else {
      setAccountType('candidate');
      setFullName(enforceVerificationUser.name || '');
      if (enforceVerificationUser.education && EDUCATION_OPTIONS.includes(enforceVerificationUser.education)) {
        setEducation(enforceVerificationUser.education);
      }
    }

    if (enforceVerificationUser.phone) {
      handlePhoneChange(enforceVerificationUser.phone);
    }

    dispatchOAuthCode(enforceVerificationUser);
  }, [enforceVerificationUser]);

  useEffect(() => {
    if (oauthTimer <= 0) return;
    const interval = setInterval(() => {
      setOauthTimer(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [oauthTimer]);

  useEffect(() => {
    if (regTimer <= 0) return;
    const interval = setInterval(() => {
      setRegTimer(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [regTimer]);

  const handleResendRegCode = async () => {
    if (regTimer > 0) return;
    const targetEmail = (tempLoggedUser?.email || email).trim().toLowerCase();
    if (!targetEmail) return;

    const newCode = generateSecureOtpCode();
    setSentRegCode(newCode);
    setRegChallengeId(null);
    setRegServerVerified(false);
    setRegExpiresAt(Date.now() + 10 * 60 * 1000);
    setRegFailedAttempts(0);
    setRegTimer(60);
    setRegDeliveryMethod('smtp');
    setError(null);
    setSuccess(null);
    setRegEmailStatus({ sending: true });

    const mailResult = await sendActivationCodeEmail(targetEmail, newCode, tempLoggedUser?.name || fullName || companyName || targetEmail.split('@')[0]);
    if (mailResult.deliveryMethod) {
      setRegDeliveryMethod(mailResult.deliveryMethod);
    }
    if (mailResult.delivered) {
      setRegDeliveryMethod(mailResult.deliveryMethod || 'smtp');
      setRegChallengeId(mailResult.challengeId || null);
      setRegServerVerified(Boolean(mailResult.serverVerified && mailResult.challengeId));
      setRegExpiresAt(Date.now() + (mailResult.expiresInSeconds || 600) * 1000);
      setRegEmailStatus({
        sending: false,
        delivered: true,
        message:
          mailResult.message ||
          `Novo código enviado via ${mailResult.providerLabel || 'oportunizahw@gmail.com'} para ${targetEmail}.`
      });
      setSuccess(`Reenviamos um novo código de 8 dígitos para ${targetEmail}.`);
    } else {
      setRegTimer(0);
      setRegEmailStatus({
        sending: false,
        delivered: false,
        message: mailResult.error || `Falha ao reenviar código para ${targetEmail}.`
      });
    }
  };

  const handleVerifyOAuthCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (oauthFailedAttempts >= 5) {
      setError('Código bloqueado após 5 tentativas incorretas. Clique em "Reenviar código".');
      return;
    }
    if (Date.now() > oauthExpiresAt) {
      setOauthTimer(0);
      setError('Este código expirou após 10 minutos. Clique em "Reenviar código".');
      return;
    }

    const entered = oauthCodeInput.replace(/\D/g, '').slice(0, 8);
    if (entered.length !== 8) {
      setError('Digite os 8 dígitos do código de ativação enviado para o seu e-mail.');
      return;
    }

    const targetEmail = (enforceVerificationUser?.email || email).trim().toLowerCase();

    if (oauthDeliveryMethod === 'supabase-otp') {
      setLoading(true);
      const otpCheck = await verifySupabaseOtpCode(targetEmail, entered, ['email'], {
        preserveCurrentSession: true
      });
      setLoading(false);
      if (!otpCheck.verified) {
        if (otpCheck.errorKind === 'timeout' || otpCheck.errorKind === 'rate-limit') {
          setError(otpCheck.error || 'Erro temporário ao validar o código. Tente confirmar novamente.');
          return;
        }
        const nextFails = oauthFailedAttempts + 1;
        setOauthFailedAttempts(nextFails);
        setOauthCodeInput('');
        setError(
          nextFails >= 5
            ? 'Código bloqueado após 5 tentativas incorretas. Clique em "Reenviar código".'
            : `${otpCheck.error || 'Código de ativação incorreto ou expirado.'} Restam ${5 - nextFails} tentativa(s).`
        );
        return;
      }
    } else if (oauthServerVerified && oauthChallengeId) {
      setLoading(true);
      const serverCheck = await verifyServerSecurityCode({
        challengeId: oauthChallengeId,
        email: targetEmail,
        code: entered,
        kind: 'login-2fa'
      });
      setLoading(false);
      if (!serverCheck.verified) {
        if (serverCheck.locked) {
          setOauthFailedAttempts(5);
          setOauthTimer(0);
        } else {
          setOauthFailedAttempts((prev) => prev + 1);
        }
        setOauthCodeInput('');
        setError(serverCheck.error || 'Código de ativação incorreto. Confira o e-mail e tente novamente.');
        return;
      }
    } else if (!oauthSentCode || entered !== oauthSentCode) {
      const nextFails = oauthFailedAttempts + 1;
      setOauthFailedAttempts(nextFails);
      setOauthCodeInput('');
      setError(
        nextFails >= 5
          ? 'Código bloqueado após 5 tentativas incorretas. Clique em "Reenviar código".'
          : `Código de ativação incorreto. Restam ${5 - nextFails} tentativa(s).`
      );
      return;
    }

    setOauthFailedAttempts(0);
    setSuccess('Código 2FA verificado! Agora preencha suas informações para liberar sua conta.');
    setOauthStep('complete-info');
  };

  const handleCompleteOAuthProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enforceVerificationUser) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    const cleanTargetEmail = (enforceVerificationUser.email || email).trim().toLowerCase();

    if (accountType === 'candidate') {
      const nameVal = validatePersonOrCompanyName(fullName, false);
      if (!nameVal.isValid) {
        setError(nameVal.error || 'Por favor, informe seu nome completo real.');
        setLoading(false);
        return;
      }
      const offensiveName = containsOffensiveLanguage(fullName);
      if (offensiveName.found) {
        setError(`Cadastro bloqueado: O nome informado contém termo inapropriado ("${offensiveName.word}").`);
        setLoading(false);
        return;
      }
      if (!phone.replace(/\D/g, '').length) {
        setError('Por favor, informe seu número de WhatsApp / Telefone com DDD.');
        setLoading(false);
        return;
      }
      const phoneVal = validatePhoneNumber(phone);
      if (!phoneVal.isValid) {
        setError(phoneVal.error || 'Número de telefone inválido.');
        setLoading(false);
        return;
      }
      if (!lgpdAccepted) {
        setError('Atenção: É obrigatório aceitar os Termos de Uso e LGPD (Lei nº 13.709/18) para concluir seu cadastro.');
        setLoading(false);
        return;
      }
    } else {
      const compVal = validatePersonOrCompanyName(companyName, true);
      if (!compVal.isValid) {
        setError(compVal.error || 'Por favor, informe a Razão Social ou Nome Fantasia real.');
        setLoading(false);
        return;
      }
      const respVal = validatePersonOrCompanyName(responsibleName, false);
      if (!respVal.isValid) {
        setError(respVal.error || 'Por favor, informe o nome do Responsável ou RH.');
        setLoading(false);
        return;
      }
      const compOffensive = containsOffensiveLanguage(companyName);
      if (compOffensive.found) {
        setError(`Cadastro de Empresa bloqueado: Razão Social contém termo inapropriado ("${compOffensive.word}").`);
        setLoading(false);
        return;
      }
      const respOffensive = containsOffensiveLanguage(responsibleName);
      if (respOffensive.found) {
        setError(`Cadastro de Empresa bloqueado: Nome do responsável contém termo inapropriado ("${respOffensive.word}").`);
        setLoading(false);
        return;
      }
      if (!phone.replace(/\D/g, '').length) {
        setError('Por favor, informe o WhatsApp Comercial / RH com DDD.');
        setLoading(false);
        return;
      }
      const phoneVal = validatePhoneNumber(phone);
      if (!phoneVal.isValid) {
        setError(phoneVal.error || 'Número de telefone comercial inválido.');
        setLoading(false);
        return;
      }
      const cnpjVal = validateCnpj(cnpj);
      if (!cnpjVal.isValid) {
        setError(cnpjVal.error || 'CNPJ inválido.');
        setLoading(false);
        return;
      }
      if (!lgpdAccepted) {
        setError('Atenção: É obrigatório ler e aceitar o Termo de Responsabilidade Jurídica e a LGPD para concluir o cadastro.');
        setLoading(false);
        return;
      }
    }

    try {
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      const userId = sessionUser?.id || enforceVerificationUser.id || 'usr-' + Date.now();
      const displayName = accountType === 'company' ? companyName.trim() : fullName.trim();
      const resolvedRole = accountType === 'company' ? 'Empresa' : 'Candidato';
      const resolvedCargo = accountType === 'company' ? 'Empresa' : 'Estudante';
      const resolvedBio =
        accountType === 'company'
          ? `Empresa atuante no setor ${companySegment} em Araucária (${companyNeighborhood})`
          : `Candidato em Araucária (${neighborhood})`;
      const resolvedEducation = accountType === 'company' ? 'Empresa / Empregador' : education;
      const resolvedExperience = accountType === 'company' ? 'Empresa Contratante em Araucária' : (enforceVerificationUser.experience || 'Nenhuma registrada');

      const activatedUser: AppUser = {
        ...enforceVerificationUser,
        id: userId,
        name: displayName,
        email: cleanTargetEmail,
        phone: phone.trim(),
        bio: resolvedBio,
        education: resolvedEducation,
        experience: resolvedExperience,
        status: 'active',
        accountType: accountType === 'company' ? 'company' : 'candidate',
        companyName: accountType === 'company' ? companyName.trim() : undefined,
        cnpj: accountType === 'company' ? cnpj.trim() : undefined,
        responsibleName: accountType === 'company' ? responsibleName.trim() : undefined,
        companySegment: accountType === 'company' ? companySegment : undefined,
        companyNeighborhood: accountType === 'company' ? companyNeighborhood : neighborhood,
        role: resolvedRole,
        cargo: resolvedCargo
      };

      const basePayload = {
        id: userId,
        name: displayName,
        email: cleanTargetEmail,
        avatar_url: activatedUser.avatarUrl || '',
        phone: phone.trim(),
        bio: resolvedBio,
        education: resolvedEducation,
        experience: resolvedExperience,
        skills: activatedUser.skills || [],
        updated_at: new Date().toISOString()
      };

      const fullPayload: Record<string, any> = {
        ...basePayload,
        status: 'active',
        is_2fa_enabled: true,
        account_type: activatedUser.accountType,
        role: resolvedRole,
        cargo: resolvedCargo
      };

      if (accountType === 'company') {
        fullPayload.company_name = companyName.trim();
        fullPayload.cnpj = cnpj.trim();
        fullPayload.responsible_name = responsibleName.trim();
        fullPayload.company_segment = companySegment;
        fullPayload.company_neighborhood = companyNeighborhood;
      }

      await upsertUserProfileSafely(fullPayload, basePayload);

      if (accountType === 'company') {
        try {
          await saveCompanyProfile({
            user_id: userId,
            company_name: companyName.trim(),
            cnpj: cnpj.trim(),
            responsible_name: responsibleName.trim(),
            responsible_role: 'RH / Proprietário',
            email: cleanTargetEmail,
            phone: phone.trim(),
            segment: companySegment,
            neighborhood: companyNeighborhood,
            status: 'active',
            verified: false,
            bio: resolvedBio
          });
        } catch (compErr) {
          console.warn('Company profile save notice:', compErr);
        }
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(`oportuniza-activated-${cleanTargetEmail}`, 'true');
        localStorage.setItem('oportuniza-current-user', JSON.stringify(activatedUser));
        sessionStorage.removeItem('oportuniza-reg-in-progress');
      }

      // Usuário acabou de verificar 2FA nesta ativação; marca sessão atual com assinatura de cargo
      markSession2FAVerified(
        userId,
        cleanTargetEmail,
        buildSessionRoleSignature(resolvedRole, Boolean(activatedUser.isAdmin))
      );

      try {
        await supabase.auth.updateUser({
          data: {
            full_name: displayName,
            account_type: activatedUser.accountType,
            phone: phone.trim(),
            role: resolvedRole,
            cargo: resolvedCargo,
            education: resolvedEducation,
            bio: resolvedBio,
            experience: resolvedExperience,
            neighborhood: accountType === 'candidate' ? neighborhood : undefined,
            company_name: accountType === 'company' ? companyName.trim() : undefined,
            cnpj: accountType === 'company' ? cnpj.trim() : undefined,
            responsible_name: accountType === 'company' ? responsibleName.trim() : undefined,
            company_segment: accountType === 'company' ? companySegment : undefined,
            company_neighborhood: accountType === 'company' ? companyNeighborhood : undefined,
            account_activated: true,
            profile_completed: true,
            requires_activation: false
          }
        });
      } catch (metaErr) {
        console.warn('Auth metadata update notice:', metaErr);
      }

      try {
        await recordAuditLog({
          actor_name: displayName,
          actor_email: cleanTargetEmail,
          actor_role: resolvedRole,
          action: 'Ativação 2FA & Cadastro OAuth Concluído',
          target_name: cleanTargetEmail,
          target_type: 'security',
          details: `Usuário ativado com código 2FA e perfil (${activatedUser.accountType}) concluído.`,
          status: 'authorized'
        });
      } catch {}

      setSuccess('Conta ativada e informações salvas com sucesso! Entrando...');
      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess({ ...activatedUser, is2FAEnabled: true });
        }
      }, 700);
    } catch (err: any) {
      setError('Erro ao concluir cadastro: ' + (err.message || 'Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regFailedAttempts >= 5) {
      setError('Código invalidado após 5 tentativas incorretas. Clique em "Reenviar código".');
      return;
    }
    if (Date.now() > regExpiresAt) {
      setRegTimer(0);
      setError('Este código expirou após 10 minutos. Clique em "Reenviar código".');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const targetEmailCheck = (tempLoggedUser?.email || email).trim().toLowerCase();
    const enteredCode = regVerifyCodeInput.replace(/\D/g, '').slice(0, 8);
    if (enteredCode.length !== 8) {
      setError('Digite todos os 8 dígitos do código enviado para seu e-mail.');
      setLoading(false);
      return;
    }

    let verifiedSessionUserId: string | undefined;
    if (regDeliveryMethod === 'supabase-otp') {
      const otpCheck = await verifySupabaseOtpCode(targetEmailCheck, enteredCode, ['signup', 'email']);
      if (!otpCheck.verified) {
        if (otpCheck.errorKind === 'timeout' || otpCheck.errorKind === 'rate-limit') {
          setError(otpCheck.error || 'Erro temporário ao validar código. Tente novamente.');
          setLoading(false);
          return;
        }
        const nextFails = regFailedAttempts + 1;
        setRegFailedAttempts(nextFails);
        setRegVerifyCodeInput('');
        setError(
          nextFails >= 5
            ? 'Código bloqueado após 5 tentativas incorretas. Clique em "Reenviar código".'
            : `${otpCheck.error || 'Código de ativação incorreto ou expirado.'} Restam ${5 - nextFails} tentativa(s).`
        );
        setLoading(false);
        return;
      }
      verifiedSessionUserId = otpCheck.userId;
    } else if (regServerVerified && regChallengeId) {
      const serverCheck = await verifyServerSecurityCode({
        challengeId: regChallengeId,
        email: targetEmailCheck,
        code: enteredCode,
        kind: 'registration'
      });
      if (!serverCheck.verified) {
        if (serverCheck.locked) {
          setRegFailedAttempts(5);
          setRegTimer(0);
        } else {
          setRegFailedAttempts((prev) => prev + 1);
        }
        setRegVerifyCodeInput('');
        setError(serverCheck.error || 'Código de ativação incorreto. Verifique o código enviado no seu e-mail.');
        setLoading(false);
        return;
      }
    } else if (!sentRegCode || enteredCode !== sentRegCode) {
      const nextFails = regFailedAttempts + 1;
      setRegFailedAttempts(nextFails);
      setRegVerifyCodeInput('');
      setError(
        nextFails >= 5
          ? 'Código bloqueado após 5 tentativas incorretas. Clique em "Reenviar código".'
          : `Código de ativação incorreto. Restam ${5 - nextFails} tentativa(s).`
      );
      setLoading(false);
      return;
    }
    setRegFailedAttempts(0);

    const { data: { user: sessionUser } } = await supabase.auth.getUser();

    if (!sessionUser && !tempLoggedUser && !verifiedSessionUserId) {
      setError('Sessão expirada. Tente se cadastrar novamente.');
      setIsVerifyingReg(false);
      setLoading(false);
      return;
    }

    const userId = sessionUser?.id || verifiedSessionUserId || tempLoggedUser?.id || 'usr-' + Date.now();
    const baseUser: AppUser = {
      ...(tempLoggedUser || {
        name: sessionUser?.user_metadata?.full_name || email.split('@')[0] || 'Usuário',
        email: sessionUser?.email || email
      }),
      id: userId,
      email: (tempLoggedUser?.email || sessionUser?.email || email).trim().toLowerCase(),
      status: 'active'
    };
    const cleanFinalEmail = baseUser.email.trim().toLowerCase();

    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('oportuniza-reg-in-progress');
        localStorage.setItem(`oportuniza-activated-${cleanFinalEmail}`, 'true');
        localStorage.setItem('oportuniza-current-user', JSON.stringify(baseUser));
      }

      const basePayload = {
        id: userId,
        name: baseUser.name,
        email: cleanFinalEmail,
        avatar_url: baseUser.avatarUrl || '',
        phone: baseUser.phone || '',
        bio: baseUser.bio || '',
        education: baseUser.education || '',
        experience: baseUser.experience || '',
        skills: baseUser.skills || [],
        updated_at: new Date().toISOString()
      };

      const fullPayload: Record<string, any> = {
        ...basePayload,
        status: 'active',
        is_2fa_enabled: true,
        account_type: baseUser.accountType || 'candidate',
        role: baseUser.role || 'Candidato',
        cargo: baseUser.cargo || 'Estudante'
      };

      if (baseUser.accountType === 'company') {
        fullPayload.company_name = baseUser.companyName || baseUser.name;
        fullPayload.cnpj = baseUser.cnpj || '';
        fullPayload.responsible_name = baseUser.responsibleName || baseUser.name;
        fullPayload.company_segment = baseUser.companySegment || '';
        fullPayload.company_neighborhood = baseUser.companyNeighborhood || '';
      }

      await upsertUserProfileSafely(fullPayload, basePayload);

      if (baseUser.accountType === 'company') {
        try {
          await saveCompanyProfile({
            user_id: userId,
            company_name: baseUser.companyName || baseUser.name,
            cnpj: baseUser.cnpj,
            responsible_name: baseUser.responsibleName || baseUser.name,
            responsible_role: 'RH / Proprietário',
            email: cleanFinalEmail,
            phone: baseUser.phone,
            segment: baseUser.companySegment,
            neighborhood: baseUser.companyNeighborhood,
            status: 'active',
            verified: false,
            bio: baseUser.bio
          });
        } catch (compErr) {
          console.warn('Company profile save warning:', compErr);
        }
      }

      if (sessionUser) {
        try {
          await supabase.auth.updateUser({
            data: {
              account_activated: true,
              profile_completed: true,
              requires_activation: false
            }
          });
        } catch (metaErr) {
          console.warn('Auth metadata activation sync warning:', metaErr);
        }
      }

      try {
        await recordAuditLog({
          actor_name: baseUser.name,
          actor_email: cleanFinalEmail,
          actor_role: baseUser.role || 'Candidato',
          action: 'Ativação de Conta por E-mail',
          target_name: cleanFinalEmail,
          target_type: 'security',
          details: `Cadastro ativado por código de 8 dígitos (${baseUser.accountType || 'candidate'}).`,
          status: 'authorized'
        });
      } catch {}

      // Cadastro acabou de validar e-mail em 2 etapas; libera entrada direta com assinatura de cargo
      markSession2FAVerified(
        userId,
        cleanFinalEmail,
        buildSessionRoleSignature(baseUser.role || 'Candidato', Boolean(baseUser.isAdmin))
      );
      setSuccess('Conta ativada com sucesso! Bem-vindo ao Oportuniza.');
      
      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess({ ...baseUser, is2FAEnabled: true });
        }
      }, 900);
    } catch (err: any) {
      setError('Erro ao finalizar cadastro: ' + (err.message || 'Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="h-full w-full bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 flex flex-col overflow-y-auto overflow-x-hidden custom-scroll p-0 md:p-4 relative transition-colors"
    >
      {/* Spacer desktop reduzido */}
      <div className="hidden md:block h-4 w-full shrink-0" />
      
      {(onNavigate || onSignOut) && (
        <div className="p-4 pb-0 md:p-0 z-10 shrink-0">
          <button 
            type="button"
            onClick={() => {
              if (enforceVerificationUser && onSignOut) {
                onSignOut();
              } else if (onNavigate) {
                onNavigate('landing');
              } else if (onSignOut) {
                onSignOut();
              }
            }}
            className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm w-fit hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-slate-300" />
          </button>
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col items-center justify-start pt-2 md:pt-8 pb-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white dark:bg-[#131E32] rounded-[32px] md:rounded-[40px] shadow-[0_10px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)] p-5 sm:p-7 md:p-9 border border-slate-100 dark:border-slate-800 relative mx-4 transition-colors"
        >
          {/* Indicador visual simples no topo */}
          <div className="w-12 h-1 bg-gray-100 dark:bg-slate-700 rounded-full mx-auto mb-6 md:hidden" />

          {enforceVerificationUser ? (
            oauthStep === 'verify-code' ? (
              <div className="animate-fadeIn text-center">
                <div className="w-16 h-16 bg-[#52A8C7]/10 dark:bg-[#52A8C7]/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#52A8C7]/20">
                  <ShieldCheckIcon className="w-8 h-8 text-[#52A8C7]" />
                </div>

                <span className="inline-block px-3 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200/80 dark:border-cyan-800 text-[10px] font-bold text-[#3d90ad] dark:text-[#52B4D8] uppercase tracking-wider mb-3">
                  Ativação Obrigatória (2FA)
                </span>

                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Confirme seu Código 2FA
                </h2>
                <p className="text-gray-500 dark:text-slate-400 text-xs sm:text-sm mb-4 leading-relaxed">
                  Para criar e ativar sua conta via Google/Social, digite o código de 8 dígitos enviado para:
                </p>

                <div className="mb-4 px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl inline-flex items-center gap-2 max-w-full">
                  <span className="w-2 h-2 rounded-full bg-[#52A8C7] animate-pulse shrink-0" />
                  <span className="text-slate-800 dark:text-slate-200 text-xs font-mono font-bold truncate select-all">
                    {enforceVerificationUser.email}
                  </span>
                </div>

                {oauthEmailStatus.sending ? (
                  <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 text-left">
                    <Loader2 className="w-4 h-4 animate-spin text-[#52A8C7] shrink-0" />
                    <span>Enviando código 2FA para {enforceVerificationUser.email}...</span>
                  </div>
                ) : oauthEmailStatus.delivered === false ? (
                  <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2 text-left">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>{oauthEmailStatus.message}</span>
                  </div>
                ) : oauthEmailStatus.delivered ? (
                  <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2 text-left">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{oauthEmailStatus.message}</span>
                  </div>
                ) : null}

                <form onSubmit={handleVerifyOAuthCode} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-xl flex items-start gap-2.5 text-red-600 dark:text-red-400 text-xs font-medium text-left">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                      Código de Ativação (8 dígitos)
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <KeyRound className="w-5 h-5 text-slate-400 group-focus-within:text-[#52A8C7] transition-colors" />
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={24}
                        placeholder="00000000"
                        value={oauthCodeInput}
                        onChange={(e) => {
                          setOauthCodeInput(e.target.value.replace(/\D/g, '').slice(0, 8));
                          setError(null);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-[#52A8C7]/40 focus:border-[#52A8C7] transition-all text-base font-mono font-bold tracking-[0.2em] text-center text-slate-900 dark:text-white"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || oauthCodeInput.length < 8}
                    className="w-full bg-[#52A8C7] hover:bg-[#3d90ad] text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-[#52A8C7]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>Confirmar Código e Continuar</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-4 flex items-center justify-between text-xs px-1">
                  <button
                    type="button"
                    onClick={() => dispatchOAuthCode(enforceVerificationUser)}
                    disabled={oauthTimer > 0 || oauthEmailStatus.sending}
                    className={`font-bold flex items-center gap-1.5 cursor-pointer ${
                      oauthTimer > 0 || oauthEmailStatus.sending
                        ? 'text-slate-400 cursor-not-allowed'
                        : 'text-[#52A8C7] dark:text-[#52B4D8] hover:underline'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${oauthEmailStatus.sending ? 'animate-spin' : ''}`} />
                    <span>Reenviar código</span>
                  </button>
                  <span className="font-mono text-slate-400">
                    {oauthTimer > 0 ? `Aguarde ${oauthTimer}s` : 'Pronto para reenviar'}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      if (onSignOut) onSignOut();
                      else if (onNavigate) onNavigate('landing');
                    }}
                    className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-semibold inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Cancelar e Voltar ao Início</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="animate-fadeIn">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                    Complete suas Informações
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    E-mail verificado! Preencha os dados do seu perfil para entrar no portal.
                  </p>
                  <div className="mt-2.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-full inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 max-w-full">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{enforceVerificationUser.email}</span>
                  </div>
                </div>

                <div className="mb-4 p-1 bg-slate-100 dark:bg-slate-900/90 rounded-2xl flex flex-wrap gap-1 border border-slate-200/70 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountType('candidate');
                      setError(null);
                    }}
                    className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                      accountType === 'candidate'
                        ? 'bg-white dark:bg-slate-800 text-[#52A8C7] dark:text-[#52B4D8] shadow-xs border border-slate-200/60 dark:border-slate-700'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Sou Candidato</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAccountType('company');
                      setError(null);
                    }}
                    className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                      accountType === 'company'
                        ? 'bg-white dark:bg-slate-800 text-[#52A8C7] dark:text-[#52B4D8] shadow-xs border border-slate-200/60 dark:border-slate-700'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Sou Empresa</span>
                  </button>
                </div>

                {accountType === 'company' && (
                  <div className="mb-3 p-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/70 rounded-2xl text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-[#52A8C7] dark:text-[#52B4D8] shrink-0 mt-0.5" />
                    <div className="space-y-0.5 text-left">
                      <strong className="block font-bold text-slate-900 dark:text-white text-xs">Oportuniza para Empresas</strong>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                        Cadastre seu negócio em Araucária para anunciar vagas gratuitamente.
                      </p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleCompleteOAuthProfile} className="space-y-3">
                  {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 rounded-xl flex items-start gap-2 text-red-600 dark:text-red-300 text-xs font-medium text-left">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}
                  {success && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 rounded-xl flex items-start gap-2 text-emerald-600 dark:text-emerald-300 text-xs font-medium text-left">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{success}</span>
                    </div>
                  )}

                  {accountType === 'candidate' ? (
                    <div className="space-y-3">
                      <div className="space-y-1 text-left">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          Nome Completo <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative group flex items-center">
                          <User className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            placeholder="Seu nome completo"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] text-xs sm:text-sm font-semibold text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-1 text-left">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          WhatsApp <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative group flex items-center">
                          <Phone className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            required
                            placeholder="(41) 99999-9999"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] text-xs sm:text-sm font-semibold text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-1 text-left">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          Bairro em Araucária
                        </label>
                        <div className="relative group flex items-center">
                          <MapPin className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                          <select
                            value={neighborhood}
                            onChange={(e) => setNeighborhood(e.target.value)}
                            className="w-full pl-10 pr-8 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] text-xs sm:text-sm font-semibold text-slate-900 dark:text-white cursor-pointer appearance-none"
                          >
                            {ARAUCARIA_NEIGHBORHOODS.map((n) => (
                              <option key={n} value={n} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{n}</option>
                            ))}
                          </select>
                          <div className="absolute right-3.5 pointer-events-none text-slate-400 text-xs">▼</div>
                        </div>
                      </div>

                      <div className="space-y-1 text-left">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          Escolaridade
                        </label>
                        <div className="relative group flex items-center">
                          <GraduationCap className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                          <select
                            value={education}
                            onChange={(e) => setEducation(e.target.value)}
                            className="w-full pl-10 pr-8 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] text-xs sm:text-sm font-semibold text-slate-900 dark:text-white cursor-pointer appearance-none"
                          >
                            {EDUCATION_OPTIONS.map((ed) => (
                              <option key={ed} value={ed} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{ed}</option>
                            ))}
                          </select>
                          <div className="absolute right-3.5 pointer-events-none text-slate-400 text-xs">▼</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1 text-left">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          Razão Social ou Nome Fantasia <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative group flex items-center">
                          <Building2 className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            required
                            placeholder="Ex: Supermercado Araucária Ltda"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] text-xs sm:text-sm font-semibold text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-1 text-left">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          CNPJ <span className="text-[10px] text-slate-400 font-normal lowercase">(opcional)</span>
                        </label>
                        <div className="relative group flex items-center">
                          <FileText className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input
                            type="text"
                            value={cnpj}
                            onChange={(e) => handleCnpjChange(e.target.value)}
                            placeholder="00.000.000/0000-00"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] text-xs sm:text-sm font-semibold text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-1 text-left">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          Responsável / RH <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative group flex items-center">
                          <User className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input
                            type="text"
                            value={responsibleName}
                            onChange={(e) => setResponsibleName(e.target.value)}
                            required
                            placeholder="Ex: Ana Silva (Recrutamento)"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] text-xs sm:text-sm font-semibold text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-1 text-left">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          Segmento de Atuação
                        </label>
                        <div className="relative group flex items-center">
                          <Briefcase className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                          <select
                            value={companySegment}
                            onChange={(e) => setCompanySegment(e.target.value)}
                            className="w-full pl-10 pr-8 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] text-xs sm:text-sm font-semibold text-slate-900 dark:text-white cursor-pointer appearance-none"
                          >
                            {COMPANY_SEGMENTS.map((s) => (
                              <option key={s} value={s} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{s}</option>
                            ))}
                          </select>
                          <div className="absolute right-3.5 pointer-events-none text-slate-400 text-xs">▼</div>
                        </div>
                      </div>

                      <div className="space-y-1 text-left">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          Bairro em Araucária
                        </label>
                        <div className="relative group flex items-center">
                          <MapPin className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                          <select
                            value={companyNeighborhood}
                            onChange={(e) => setCompanyNeighborhood(e.target.value)}
                            className="w-full pl-10 pr-8 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] text-xs sm:text-sm font-semibold text-slate-900 dark:text-white cursor-pointer appearance-none"
                          >
                            {ARAUCARIA_NEIGHBORHOODS.map((n) => (
                              <option key={n} value={n} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{n}</option>
                            ))}
                          </select>
                          <div className="absolute right-3.5 pointer-events-none text-slate-400 text-xs">▼</div>
                        </div>
                      </div>

                      <div className="space-y-1 text-left">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          WhatsApp Comercial / RH <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative group flex items-center">
                          <Phone className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            required
                            placeholder="(41) 99999-9999"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] text-xs sm:text-sm font-semibold text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 px-1 text-left">
                    <label className="flex items-start gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={lgpdAccepted}
                        onChange={(e) => setLgpdAccepted(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-[#52A8C7] focus:ring-[#52A8C7] bg-white dark:bg-slate-950 cursor-pointer shrink-0"
                      />
                      <span className="text-xs text-slate-600 dark:text-slate-300 leading-tight font-medium select-none">
                        Li e aceito os{' '}
                        <button
                          type="button"
                          onClick={() => setShowLgpdModal(true)}
                          className="text-[#52A8C7] dark:text-[#52B4D8] font-bold hover:underline cursor-pointer inline"
                        >
                          Termos de Uso e LGPD
                        </button>.
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#52A8C7] hover:bg-[#3d90ad] text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 text-sm disabled:opacity-60"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>Concluir Cadastro e Entrar</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (onSignOut) onSignOut();
                      else if (onNavigate) onNavigate('landing');
                    }}
                    className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-semibold inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Cancelar e Voltar ao Início</span>
                  </button>
                </div>
              </div>
            )
          ) : verificationSent ? (
            <div className="flex flex-col items-center text-center animate-fadeIn py-2">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 relative shadow-inner">
                <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-25" />
                <Mail className="w-10 h-10 text-emerald-600 relative z-10" />
              </div>

              <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                Instruções Enviadas!
              </h1>
              <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                Enviamos um e-mail com o link de confirmação para ativar sua conta em nosso banco de dados:
              </p>

              <div className="my-5 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl inline-flex items-center gap-2 max-w-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-slate-800 text-xs font-mono font-bold truncate select-all">
                  {registeredEmail}
                </span>
              </div>

              {/* Relação organizada de passos */}
              <div className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 text-left mb-6 space-y-4">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Abra sua caixa de entrada</h3>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-normal mt-0.5">
                      Procure pela mensagem enviada por <strong className="text-slate-700 dark:text-slate-300">Oportuniza Araucária (oportunizahw@gmail.com)</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 border-t border-slate-100/70 dark:border-slate-800 pt-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Clique no link de confirmação</h3>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-normal mt-0.5">
                      Abra a mensagem recebida e clique no botão azul escrito <strong className="text-blue-600 dark:text-blue-400">"Confirm email address"</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 border-t border-slate-100/70 dark:border-slate-800 pt-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Seja redirecionado com segurança</h3>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-normal mt-0.5">
                      O sistema identificará sua validação, criará o seu perfil no banco de dados e abrirá o painel de vagas automaticamente!
                    </p>
                  </div>
                </div>
              </div>

              {/* Box de dicas e notificações de erro/sucesso locais para re-envio */}
              {success && (
                <div className="w-full mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900 rounded-xl text-xs font-medium text-left">
                  {success}
                </div>
              )}
              {error && (
                <div className="w-full mb-4 p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border border-red-100 dark:border-red-900 rounded-xl text-xs font-medium text-left">
                  {error}
                </div>
              )}

              <div className="w-full bg-[#52A8C7]/10 dark:bg-[#52B4D8]/10 border border-[#52A8C7]/20 dark:border-[#52B4D8]/20 rounded-2xl p-3 text-[11px] text-slate-600 dark:text-slate-300 text-left leading-relaxed mb-6 font-medium">
                💡 <span className="font-bold text-[#3d90ad] dark:text-[#52B4D8]">Dica anti-spam:</span> Caso não veja o e-mail na entrada principal, certifique-se de olhar sua aba de <strong className="text-slate-800 dark:text-white">Promoções, Atualizações, Spam</strong> ou <strong className="text-slate-800 dark:text-white">Lixo Eletrônico</strong>. Geralmente ele chega em menos de 10 segundos!
              </div>

              <div className="w-full space-y-2.5">
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resendLoading}
                  className="w-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  {resendLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-500 dark:text-slate-400" />
                  ) : (
                    <span>Não recebi o e-mail. Reenviar agora</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setVerificationSent(false);
                    setIsLogin(true);
                    setError(null);
                    setSuccess(null);
                  }}
                  className="w-full text-slate-400 hover:text-slate-600 text-xs font-semibold py-2 block hover:underline"
                >
                  Voltar para a tela de login
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-5">
                <div 
                  onClick={() => {
                    setIsAdminMode(!isAdminMode);
                    setError(null);
                    setSuccess(null);
                  }}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 cursor-pointer select-none overflow-hidden shadow-xs border border-slate-200/80 dark:border-slate-700 transition-transform active:scale-95 ${isAdminMode ? 'bg-amber-500/10' : 'bg-white dark:bg-slate-800'}`}
                >
                  {isAdminMode ? (
                    <User className="w-7 h-7 text-amber-500" />
                  ) : (
                    <img src={logo} alt="Oportuniza" className="w-full h-full object-cover object-center block" />
                  )}
                </div>
                
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight font-sans">
                  {isAdminMode ? 'Painel Administrativo' : isRecover ? 'Recuperar Senha' : isLogin ? 'Seja bem-vindo de volta' : (accountType === 'candidate' ? 'Crie sua Conta' : 'Cadastrar Empresa')}
                </h1>
                <p className="text-gray-500 dark:text-slate-400 mt-1 text-xs">
                  {isAdminMode 
                    ? 'Inserir credenciais de administrador' 
                    : isRecover 
                      ? 'Instruções de acesso serão enviadas por e-mail' 
                      : isLogin 
                        ? 'Acesse suas vagas, cursos e histórico' 
                        : (accountType === 'candidate' ? 'Cadastre-se e inicie sua jornada profissional' : 'Divulgue vagas e recrute talentos de Araucária')
                  }
                </p>
              </div>

              {/* Selector de Tipo de Conta no Modo Cadastro */}
              {!isLogin && !isRecover && !isAdminMode && (
                <div className="mb-4 p-1 bg-slate-100 dark:bg-slate-900/90 rounded-2xl flex flex-wrap gap-1 border border-slate-200/70 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountType('candidate');
                      setError(null);
                    }}
                    className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                      accountType === 'candidate'
                        ? 'bg-white dark:bg-slate-800 text-[#52A8C7] dark:text-[#52B4D8] shadow-xs border border-slate-200/60 dark:border-slate-700'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Sou Candidato</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAccountType('company');
                      setError(null);
                    }}
                    className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                      accountType === 'company'
                        ? 'bg-white dark:bg-slate-800 text-[#52A8C7] dark:text-[#52B4D8] shadow-xs border border-slate-200/60 dark:border-slate-700'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Sou Empresa</span>
                  </button>
                </div>
              )}

              {/* Banner informativo de Empresa */}
              {!isLogin && !isRecover && !isAdminMode && accountType === 'company' && (
                <div className="mb-4 p-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/70 rounded-2xl text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2.5 shadow-2xs">
                  <Sparkles className="w-4 h-4 text-[#52A8C7] dark:text-[#52B4D8] shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-left">
                    <strong className="block font-bold text-slate-900 dark:text-white text-xs">Oportuniza para Empresas</strong>
                    <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                      Cadastre seu negócio em Araucária para anunciar vagas de menor aprendiz, estágio e CLT gratuitamente.
                    </p>
                  </div>
                </div>
              )}

              {isAdminMode ? (
                <form onSubmit={handleAdminAuth} className="space-y-4">
                  <AnimatePresence mode="wait">
                    {(error || success) && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`${error ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border-red-100 dark:border-red-900' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900'} border px-4 py-3 rounded-xl flex items-start gap-2 text-xs font-medium`}
                      >
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="flex-1">{error || success}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider ml-1">Código de Acesso Admin</label>
                    <div className="relative group flex items-center">
                      <Lock className="absolute left-4 w-4 h-4 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
                      <input 
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        required
                        placeholder="Digitar código..."
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-amber-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-4 text-sm"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>Acessar Painel Admin</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsAdminMode(false);
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-gray-500 dark:text-slate-400 text-xs font-bold hover:underline cursor-pointer"
                    >
                      Voltar ao Login de Usuário
                    </button>
                  </div>
                </form>
              ) : isVerifyingReg ? (
                <div className="animate-fadeIn">
                  <div className="w-16 h-16 bg-[#52A8C7]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[#52A8C7]/20">
                    <Mail className="w-8 h-8 text-[#52A8C7]" />
                  </div>

                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Verifique seu e-mail</h2>
                  <p className="text-gray-500 dark:text-slate-400 text-sm mb-4 leading-relaxed">
                    Enviamos um código de ativação para <strong className="text-gray-900 dark:text-white font-semibold">{email}</strong>.
                  </p>

                  {regEmailStatus.delivered === false && regEmailStatus.message && (
                    <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2 text-amber-800 dark:text-amber-200 text-xs text-left">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                      <span>{regEmailStatus.message}</span>
                    </div>
                  )}

                  <form onSubmit={handleVerifyRegistration} className="space-y-4">
                    {error && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-xl flex items-start gap-2.5 text-red-600 dark:text-red-400 text-xs font-medium animate-shake">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}
                    {success && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-xl flex items-start gap-2.5 text-emerald-600 dark:text-emerald-400 text-xs font-medium text-left">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{success}</span>
                      </div>
                    )}

                    <div className="space-y-2 text-left">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Código de Ativação</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <KeyRound className="w-5 h-5 text-slate-400 group-focus-within:text-[#52A8C7] transition-colors" />
                        </div>
                        <input 
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={24}
                          placeholder="Digite os 8 dígitos"
                          value={regVerifyCodeInput}
                          onChange={(e) => {
                            setRegVerifyCodeInput(e.target.value.replace(/\D/g, '').slice(0, 8));
                            setError(null);
                          }}
                          className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-[#52A8C7]/50 focus:border-[#52A8C7] transition-all text-sm font-mono font-bold tracking-[0.18em] text-center"
                          required
                        />
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={loading || regVerifyCodeInput.length < 8}
                      className="w-full bg-[#52A8C7] hover:bg-[#3d90ad] text-white font-bold py-4 rounded-2xl shadow-lg shadow-[#52A8C7]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <span>Ativar Minha Conta</span>
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between text-xs px-1">
                      <button
                        type="button"
                        onClick={handleResendRegCode}
                        disabled={regTimer > 0 || regEmailStatus.sending}
                        className={`font-bold flex items-center gap-1.5 cursor-pointer ${
                          regTimer > 0 || regEmailStatus.sending
                            ? 'text-slate-400 cursor-not-allowed'
                            : 'text-[#52A8C7] dark:text-[#52B4D8] hover:underline'
                        }`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${regEmailStatus.sending ? 'animate-spin' : ''}`} />
                        <span>Reenviar código</span>
                      </button>
                      <span className="font-mono text-slate-400">
                        {regTimer > 0 ? `Aguarde ${regTimer}s` : 'Pronto para reenviar'}
                      </span>
                    </div>
                    
                    <button 
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          sessionStorage.removeItem('oportuniza-reg-in-progress');
                        }
                        setIsVerifyingReg(false);
                        setRegVerifyCodeInput('');
                        setError(null);
                        setSuccess(null);
                      }}
                      className="w-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold py-2 block hover:underline cursor-pointer"
                    >
                      Voltar e corrigir e-mail
                    </button>
                  </form>
                </div>
              ) : (
                <form onSubmit={handleAuth} className="space-y-3.5">
                  <AnimatePresence mode="wait">
                    {(error || success) && (
                      <div className="space-y-3">
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={`${
                            error
                              ? error.toLowerCase().includes('bloquead') || error.includes('Motivo:')
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-900 shadow-sm'
                                : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border-red-100 dark:border-red-900'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900'
                          } border px-4 py-3.5 rounded-xl flex items-start gap-2.5 text-xs font-medium`}
                        >
                          {error && (error.toLowerCase().includes('bloquead') || error.includes('Motivo:')) ? (
                            <>
                              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                              <div className="flex-1 space-y-1 text-left">
                                <strong className="block text-rose-900 dark:text-rose-100 font-bold text-xs uppercase tracking-wide">Conta Bloqueada</strong>
                                <p className="text-rose-800 dark:text-rose-300 leading-relaxed font-normal">{error}</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                              <div className="flex-1 text-left">{error || success}</div>
                            </>
                          )}
                        </motion.div>

                        {error && error.includes('limita novas contas') && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="p-3.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-xl text-[11px] text-slate-700 dark:text-slate-300 space-y-2 font-normal leading-relaxed text-left"
                          >
                            <span className="font-bold text-slate-950 dark:text-white flex items-center gap-1">
                              💡 Como resolver e permitir cadastros ilimitados:
                            </span>
                            <ol className="list-decimal pl-4 space-y-1 text-slate-600 dark:text-slate-400">
                              <li>Acesse o painel do seu projeto no <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-[#52A8C7] hover:underline font-bold">Supabase</a></li>
                              <li>No menu lateral esquerdo, vá em <span className="font-semibold text-slate-800 dark:text-slate-200">Authentication</span> → <span className="font-semibold text-slate-800 dark:text-slate-200">Providers</span> → <span className="font-semibold text-slate-800 dark:text-slate-200">Email</span></li>
                              <li>Desative a opção <span className="font-semibold text-slate-800 dark:text-slate-200">"Confirm Email"</span></li>
                              <li>Clique em <span className="font-semibold text-slate-800 dark:text-slate-200">Save</span> no canto inferior direito</li>
                            </ol>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </AnimatePresence>

                  {/* ---------------- CANDIDATE FIELDS ---------------- */}
                  {!isLogin && !isRecover && accountType === 'candidate' && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          Nome Completo <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative group flex items-center">
                          <User className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input 
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            placeholder="Seu nome completo"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">WhatsApp</label>
                        <div className="relative group flex items-center">
                          <Phone className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input 
                            type="tel"
                            value={phone}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            placeholder="(41) 99999-9999"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Bairro em Araucária</label>
                        <div className="relative group flex items-center">
                          <MapPin className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                          <select 
                            value={neighborhood}
                            onChange={(e) => setNeighborhood(e.target.value)}
                            className="w-full pl-10 pr-8 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white shadow-xs cursor-pointer appearance-none"
                          >
                            {ARAUCARIA_NEIGHBORHOODS.map(n => (
                              <option key={n} value={n} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{n}</option>
                            ))}
                          </select>
                          <div className="absolute right-3.5 pointer-events-none text-slate-400 text-xs">
                            ▼
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* ---------------- COMPANY FIELDS ---------------- */}
                  {!isLogin && !isRecover && accountType === 'company' && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          Razão Social ou Nome Fantasia <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative group flex items-center">
                          <Building2 className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input 
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            required
                            placeholder="Ex: Supermercado Araucária Ltda"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          CNPJ <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal lowercase">(opcional)</span>
                        </label>
                        <div className="relative group flex items-center">
                          <FileText className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input 
                            type="text"
                            value={cnpj}
                            onChange={(e) => handleCnpjChange(e.target.value)}
                            placeholder="00.000.000/0000-00"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          Responsável / RH <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative group flex items-center">
                          <User className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input 
                            type="text"
                            value={responsibleName}
                            onChange={(e) => setResponsibleName(e.target.value)}
                            required
                            placeholder="Ex: Ana Silva (Recrutamento)"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Segmento de Atuação</label>
                        <div className="relative group flex items-center">
                          <Briefcase className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                          <select 
                            value={companySegment}
                            onChange={(e) => setCompanySegment(e.target.value)}
                            className="w-full pl-10 pr-8 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white shadow-xs cursor-pointer appearance-none"
                          >
                            {COMPANY_SEGMENTS.map(s => (
                              <option key={s} value={s} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{s}</option>
                            ))}
                          </select>
                          <div className="absolute right-3.5 pointer-events-none text-slate-400 text-xs">
                            ▼
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Bairro em Araucária</label>
                        <div className="relative group flex items-center">
                          <MapPin className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                          <select 
                            value={companyNeighborhood}
                            onChange={(e) => setCompanyNeighborhood(e.target.value)}
                            className="w-full pl-10 pr-8 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white shadow-xs cursor-pointer appearance-none"
                          >
                            {ARAUCARIA_NEIGHBORHOODS.map(n => (
                              <option key={n} value={n} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{n}</option>
                            ))}
                          </select>
                          <div className="absolute right-3.5 pointer-events-none text-slate-400 text-xs">
                            ▼
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          WhatsApp Comercial / RH <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative group flex items-center">
                          <Phone className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input 
                            type="tel"
                            value={phone}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            required
                            placeholder="(41) 99999-9999"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* E-mail field (hidden during code or password reset steps) */}
                  {!(isRecover && (recoveryStep === 'verify-code' || recoveryStep === 'new-password')) && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                        {accountType === 'company' && !isLogin ? 'E-mail Corporativo / RH' : 'E-MAIL'}
                      </label>
                      <div className="relative group flex items-center">
                        <Mail className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                        <input 
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          placeholder={accountType === 'company' && !isLogin ? "rh@suaempresa.com.br" : "seu@email.com"}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* STEP 2: ENTER CODE ONLY */}
                  {isRecover && recoveryStep === 'verify-code' && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="p-3.5 bg-[#52A8C7]/10 border border-[#52A8C7]/30 rounded-2xl text-xs text-slate-700 dark:text-slate-200 text-left space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-[#52A8C7] dark:text-[#52B4D8]">
                          <Mail className="w-4 h-4 shrink-0" />
                          <span>Código enviado para {email}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                          Abra sua caixa de entrada no Gmail (enviado via oportunizahw@gmail.com) e digite o código de 8 dígitos abaixo:
                        </p>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          Código de Verificação (8 Dígitos)
                        </label>
                        <div className="relative group flex items-center">
                          <KeyRound className="absolute left-3.5 w-4 h-4 text-[#52A8C7] transition-colors" />
                          <input 
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={24}
                            value={recoveryCodeInput}
                            onChange={(e) => setRecoveryCodeInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                            required
                            placeholder="Digite os 8 dígitos"
                            className="w-full pl-10 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-base font-mono font-black tracking-widest text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs text-center"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            sessionStorage.removeItem('oportuniza-recovery-in-progress');
                          }
                          setRecoveryStep('request');
                          setError(null);
                          setSuccess(null);
                        }}
                        className="text-xs text-[#52A8C7] dark:text-[#52B4D8] font-bold hover:underline cursor-pointer block text-left pt-1"
                      >
                        ← Voltar / Alterar E-mail
                      </button>
                    </div>
                  )}

                  {/* STEP 3: NEW PASSWORD SCREEN */}
                  {isRecover && recoveryStep === 'new-password' && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-slate-700 dark:text-slate-200 text-left space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                          <ShieldCheckIcon className="w-4 h-4 shrink-0" />
                          <span>Código confirmado com sucesso!</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                          Agora defina a sua nova senha de acesso à plataforma Oportuniza.
                        </p>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Nova Senha</label>
                        <div className="relative group flex items-center">
                          <Lock className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input 
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            placeholder="Mín. 8 dígitos (letras e números)"
                            className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {recoveryPasswordStrength && (
                          <div className="pt-1 space-y-1">
                            <div className="grid grid-cols-4 gap-1">
                              {[1, 2, 3, 4].map((step) => (
                                <div
                                  key={step}
                                  className={`h-1.5 rounded-full transition-colors ${
                                    recoveryPasswordStrength.score >= step
                                      ? recoveryPasswordStrength.score >= 4
                                        ? 'bg-emerald-500'
                                        : recoveryPasswordStrength.score === 3
                                        ? 'bg-cyan-500'
                                        : recoveryPasswordStrength.score === 2
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                      : 'bg-slate-200 dark:bg-slate-700'
                                  }`}
                                />
                              ))}
                            </div>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              Força da senha: <strong className="text-slate-700 dark:text-slate-200">{recoveryPasswordStrength.label}</strong>
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Confirmar Nova Senha</label>
                        <div className="relative group flex items-center">
                          <Lock className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input 
                            type={showNewPassword ? 'text' : 'password'}
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            required
                            placeholder="Digite a senha novamente"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {!isRecover && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">SENHA</label>
                        {isLogin && (
                          <button 
                            type="button"
                            onClick={() => {
                              setIsRecover(true);
                              setRecoveryStep('request');
                            }}
                            className="text-xs font-bold text-[#52A8C7] dark:text-[#52B4D8] hover:underline cursor-pointer"
                          >
                            Esqueceu?
                          </button>
                        )}
                      </div>
                      <div className="relative group flex items-center">
                        <Lock className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                        <input 
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          placeholder={isLogin ? "••••••••" : "Mín. 8 dígitos (letras e números)"}
                          className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {signupPasswordStrength && (
                        <div className="pt-1 space-y-1 text-left">
                          <div className="grid grid-cols-4 gap-1">
                            {[1, 2, 3, 4].map((step) => (
                              <div
                                key={step}
                                className={`h-1.5 rounded-full transition-colors ${
                                  signupPasswordStrength.score >= step
                                    ? signupPasswordStrength.score >= 4
                                      ? 'bg-emerald-500'
                                      : signupPasswordStrength.score === 3
                                      ? 'bg-cyan-500'
                                      : signupPasswordStrength.score === 2
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                    : 'bg-slate-200 dark:bg-slate-700'
                                }`}
                              />
                            ))}
                          </div>
                          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Força da senha: <strong className="text-slate-700 dark:text-slate-200">{signupPasswordStrength.label}</strong>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {!isLogin && !isRecover && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Confirmar Senha</label>
                      <div className="relative group flex items-center">
                        <Lock className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                        <input 
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          placeholder="••••••••"
                          className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          aria-label={showConfirmPassword ? 'Ocultar senha' : 'Ver senha'}
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ---------------- TERMOS DE USO & LGPD ---------------- */}
                  {!isLogin && !isRecover && (
                    <div className="pt-2 px-1">
                      <label className="flex items-start gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={lgpdAccepted}
                          onChange={(e) => setLgpdAccepted(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-[#52A8C7] focus:ring-[#52A8C7] bg-white dark:bg-slate-950 cursor-pointer shrink-0"
                        />
                        <span className="text-xs text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white leading-tight font-medium select-none">
                          Li e aceito os <button type="button" onClick={() => setShowLgpdModal(true)} className="text-[#52A8C7] dark:text-[#52B4D8] font-bold hover:underline cursor-pointer inline">Termos de Uso</button>.
                        </span>
                      </label>
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#52A8C7] hover:bg-[#3d90ad] text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-3 text-sm"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>
                          {isRecover 
                            ? (recoveryStep === 'verify-code' 
                                ? 'Confirmar Código' 
                                : recoveryStep === 'new-password' 
                                ? 'Salvar Nova Senha' 
                                : 'Enviar Instruções e Código') 
                            : isLogin 
                            ? 'Entrar no Oportuniza' 
                            : (accountType === 'company' ? 'Cadastrar Empresa' : 'Criar minha Conta')}
                        </span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                  
                  {/* Google Login Button */}
                  <div className="relative mt-3">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase">
                      <span className="bg-white dark:bg-[#131E32] px-3 text-slate-400 font-semibold">Ou continuar com</span>
                    </div>
                  </div>

                  <button 
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full mt-2 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-xs text-xs sm:text-sm"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4B4B"/>
                    </svg>
                    <span>{isLogin ? 'Entrar com Google' : 'Cadastrar com Google'}</span>
                  </button>

                  <button 
                    type="button"
                    onClick={handleGitHubLogin}
                    disabled={loading}
                    className="w-full mt-2 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-xs text-xs sm:text-sm"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                    </svg>
                    <span>{isLogin ? 'Entrar com GitHub' : 'Cadastrar com GitHub'}</span>
                  </button>
                </form>
              )}

              {!isAdminMode && (
                <div className="mt-6 text-center">
                  {isRecover ? (
                    <button 
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          sessionStorage.removeItem('oportuniza-recovery-in-progress');
                        }
                        setIsRecover(false);
                        setRecoveryStep('request');
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-[#52A8C7] dark:text-[#52B4D8] text-xs font-bold hover:underline cursor-pointer"
                    >
                      Voltar ao Login
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-xs font-medium text-gray-500 dark:text-slate-400">
                      <button 
                        type="button"
                        onClick={toggleTheme}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
                      >
                        {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-sky-500" />}
                      </button>
                      <span>{isLogin ? 'Novo por aqui?' : 'Já possui uma conta?'}</span>
                      <button 
                        type="button"
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-[#52A8C7] dark:text-[#52B4D8] font-bold hover:underline cursor-pointer"
                      >
                        {isLogin ? 'Cadastre-se grátis' : 'Faça Login'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
      
      {/* MODAL: ÍNTEGRA DO TERMO DE RESPONSABILIDADE & LGPD */}
      {showLgpdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                  <ShieldCheckIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Termo de Responsabilidade & LGPD</h3>
                  <p className="text-[10px] text-slate-400">Lei nº 13.709/2018 e Artigo 299 do Código Penal</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLgpdModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scroll space-y-4 text-xs leading-relaxed text-slate-300">
              <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-indigo-200 text-[11px]">
                {COMPANY_LGPD_DECLARATION_SUMMARY}
              </div>

              <div className="space-y-3">
                {COMPANY_LGPD_CLAUSES.map((clause, idx) => (
                  <div key={idx} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1">
                    <h4 className="font-bold text-white text-[11px]">{clause.title}</h4>
                    <p className="text-[11px] text-slate-400 leading-normal">{clause.content}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
              <span className="text-[10px] text-slate-400 font-mono">Versão 2026.1-LEGAL (Araucária/PR)</span>
              <button
                type="button"
                onClick={() => {
                  setLgpdAccepted(true);
                  setShowLgpdModal(false);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-md"
              >
                Compreendi e Aceito os Termos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Espaçador final para garantir que o scroll chegue até o fundo em qualquer tela */}
      <div className="h-20 w-full shrink-0 md:hidden" />
    </div>
  );
}

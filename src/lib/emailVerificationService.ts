import { supabase, createEphemeralSupabaseClient, getAppRedirectUrl } from './supabaseClient';

export type VerificationEmailKind = 'login-2fa' | 'admin-2fa' | 'registration' | 'recovery';
export type VerificationDeliveryMethod = 'smtp' | 'supabase-otp';

export interface SendVerificationEmailParams {
  email: string;
  code: string;
  userName?: string;
  kind: VerificationEmailKind;
  isAdmin?: boolean;
  accountType?: string;
  alreadyDispatchedSignupOtp?: boolean;
}

export interface SendVerificationEmailResult {
  ok: boolean;
  delivered: boolean;
  deliveryMethod?: VerificationDeliveryMethod;
  providerLabel?: string;
  challengeId?: string;
  serverVerified?: boolean;
  expiresInSeconds?: number;
  message?: string;
  error?: string;
  isStaticHostError?: boolean;
  timedOut?: boolean;
}

const API_SKIP_CACHE_KEY = 'oportuniza-skip-api-email-until';
const API_READY_CACHE_KEY = 'oportuniza-api-email-ready-until';
const API_SKIP_TTL_MS = 5 * 60 * 1000;
const API_READY_TTL_MS = 60 * 1000;
const API_HEALTH_PROBE_TIMEOUT_MS = 1500;
const API_SMTP_SEND_TIMEOUT_MS = 15000;
const SUPABASE_OTP_TIMEOUT_MS = 12000;

function getApiBaseUrl(): string {
  const configured = (import.meta.env?.VITE_API_BASE_URL || '').trim();
  return configured.replace(/\/+$/, '');
}

export function buildApiEndpoint(path: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export function shouldSkipApiEmailProbe(): boolean {
  if (typeof window === 'undefined') return false;
  if (getApiBaseUrl()) return false;

  const host = (window.location.hostname || '').toLowerCase();
  if (host.endsWith('.github.io')) {
    return true;
  }

  try {
    const until = Number(window.sessionStorage.getItem(API_SKIP_CACHE_KEY) || 0);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

export function markApiEmailProbeUnavailable(): void {
  if (typeof window === 'undefined' || getApiBaseUrl()) return;
  try {
    window.sessionStorage.removeItem(API_READY_CACHE_KEY);
    window.sessionStorage.setItem(API_SKIP_CACHE_KEY, String(Date.now() + API_SKIP_TTL_MS));
  } catch {
    // Ignore restricted storage
  }
}

function markApiEmailProbeReady(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(API_SKIP_CACHE_KEY);
    window.sessionStorage.setItem(API_READY_CACHE_KEY, String(Date.now() + API_READY_TTL_MS));
  } catch {
    // Ignore restricted storage
  }
}

function clearApiEmailReadyCache(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(API_READY_CACHE_KEY);
  } catch {
    // Ignore restricted storage
  }
}

function isApiEmailReadyCached(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const until = Number(window.sessionStorage.getItem(API_READY_CACHE_KEY) || 0);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

async function probeApiEmailAvailability(): Promise<'smtp-ready' | 'unavailable'> {
  if (shouldSkipApiEmailProbe()) {
    return 'unavailable';
  }
  if (isApiEmailReadyCached()) {
    return 'smtp-ready';
  }
  if (typeof window === 'undefined') {
    return 'smtp-ready';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_HEALTH_PROBE_TIMEOUT_MS);

  try {
    const res = await fetch(buildApiEndpoint('/api/health'), {
      method: 'GET',
      signal: controller.signal
    });
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const isJson = contentType.includes('application/json');
    if (!res.ok || !isJson) {
      markApiEmailProbeUnavailable();
      return 'unavailable';
    }
    const data: any = await res.json().catch(() => ({}));
    if (data?.ok && data?.smtpConfigured) {
      markApiEmailProbeReady();
      return 'smtp-ready';
    }
    markApiEmailProbeUnavailable();
    return 'unavailable';
  } catch {
    markApiEmailProbeUnavailable();
    return 'unavailable';
  } finally {
    clearTimeout(timeoutId);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timerId !== undefined) clearTimeout(timerId);
  });
}

function formatSupabaseOtpErrorMessage(rawMessage: string): string {
  const msg = rawMessage || '';
  const lower = msg.toLowerCase();
  const secMatch = msg.match(/after\s+(\d+)\s+second/i);
  if (lower.includes('rate limit') || lower.includes('security purposes') || secMatch) {
    if (secMatch) {
      return `Muitas tentativas seguidas. Aguarde ${secMatch[1]}s para pedir um novo código, ou digite o código que já chegou no seu e-mail.`;
    }
    return 'Muitas solicitações seguidas ao serviço de e-mail. Aguarde alguns segundos ou confira o código já recebido.';
  }
  return `Não foi possível disparar o e-mail automaticamente (${msg}). Tente clicar em "Reenviar Código" em instantes.`;
}

function isInstitutionalOrGovEmail(cleanEmail: string): boolean {
  const domain = cleanEmail.split('@')[1] || '';
  return (
    domain.includes('escola.') ||
    domain.endsWith('.gov.br') ||
    domain.includes('.edu.') ||
    domain.endsWith('.mil.br')
  );
}

function formatSupabaseVerifyError(
  rawMessage: string,
  cleanEmail: string
): { message: string; errorKind: 'expired' | 'rate-limit' | 'timeout' | 'invalid' } {
  const msg = String(rawMessage || '');
  const lower = msg.toLowerCase();

  if (lower.includes('rate limit') || lower.includes('too many') || lower.includes('429') || lower.includes('security purposes')) {
    return {
      errorKind: 'rate-limit',
      message: 'Muitas tentativas seguidas de verificação no servidor. Aguarde alguns segundos antes de tentar novamente.'
    };
  }

  if (lower.includes('tempo esgotado') || lower.includes('timeout') || lower.includes('failed to fetch') || lower.includes('network')) {
    return {
      errorKind: 'timeout',
      message: 'Tempo esgotado ao validar o código no servidor. Verifique sua conexão e tente confirmar novamente.'
    };
  }

  const instHint = isInstitutionalOrGovEmail(cleanEmail)
    ? ' Em e-mails institucionais (@escola.pr.gov.br / .gov.br), antivírus podem abrir links automaticamente e invalidar o código — clique em "Reenviar código" e digite sempre o mais recente.'
    : ' Confira se não houve novo envio recente e clique em "Reenviar código" se precisar de um código novo.';

  return {
    errorKind: 'expired',
    message: `Código incorreto, expirado ou já utilizado.${instHint}`
  };
}

async function trySupabaseOtpFallback(
  cleanEmail: string,
  options?: { preserveCurrentSession?: boolean }
): Promise<SendVerificationEmailResult> {
  try {
    const redirectTo = getAppRedirectUrl();
    const client = options?.preserveCurrentSession ? createEphemeralSupabaseClient() : supabase;
    const attempt = await withTimeout(
      client.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectTo || undefined
        }
      }),
      SUPABASE_OTP_TIMEOUT_MS,
      '__OTP_TIMEOUT__'
    );

    if (!attempt.error) {
      return {
        ok: true,
        delivered: true,
        deliveryMethod: 'supabase-otp',
        providerLabel: 'Supabase Auth',
        message: `Código de 8 dígitos enviado para ${cleanEmail}. Confira sua caixa de entrada ou Spam.`
      };
    }

    return {
      ok: false,
      delivered: false,
      deliveryMethod: 'supabase-otp',
      isStaticHostError: true,
      error: formatSupabaseOtpErrorMessage(attempt.error.message || '')
    };
  } catch (err: any) {
    if (err?.message === '__OTP_TIMEOUT__') {
      return {
        ok: false,
        delivered: false,
        deliveryMethod: 'supabase-otp',
        timedOut: true,
        isStaticHostError: true,
        error: `O servidor de e-mail demorou mais que o normal para confirmar. Verifique sua caixa de entrada ou Spam de ${cleanEmail} — se o código de 8 dígitos chegar, digite-o abaixo ou clique em "Reenviar Código".`
      };
    }

    return {
      ok: false,
      delivered: false,
      deliveryMethod: 'supabase-otp',
      isStaticHostError: true,
      error: `Falha ao acionar envio de e-mail: ${err?.message || 'servidor indisponível no momento.'}`
    };
  }
}

export async function sendVerificationCodeEmail(
  params: SendVerificationEmailParams
): Promise<SendVerificationEmailResult> {
  const cleanEmail = (params.email || '').trim().toLowerCase();
  if (!cleanEmail) {
    return {
      ok: false,
      delivered: false,
      error: 'E-mail de destino não informado.'
    };
  }

  const preserveSession = params.kind === 'login-2fa' || params.kind === 'admin-2fa';
  const apiStatus = await probeApiEmailAvailability();

  if (apiStatus !== 'smtp-ready') {
    if (params.alreadyDispatchedSignupOtp) {
      return {
        ok: true,
        delivered: true,
        deliveryMethod: 'supabase-otp',
        providerLabel: 'Supabase Auth',
        message: `Código de ativação enviado para ${cleanEmail}. Confira sua caixa de entrada ou Spam.`
      };
    }
    return await trySupabaseOtpFallback(cleanEmail, { preserveCurrentSession: preserveSession });
  }

  const endpointPath =
    params.kind === 'registration'
      ? '/api/send-registration-email'
      : params.kind === 'recovery'
      ? '/api/send-password-recovery-email'
      : '/api/send-2fa-email';
  const endpointUrl = buildApiEndpoint(endpointPath);

  let useSupabaseFallback = false;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_SMTP_SEND_TIMEOUT_MS);

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        email: cleanEmail,
        userName: params.userName || cleanEmail.split('@')[0],
        isAdmin: Boolean(params.isAdmin || params.kind === 'admin-2fa'),
        accountType: params.accountType
      })
    });

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const isJson = contentType.includes('application/json');
    const data: any = isJson ? await response.json().catch(() => ({})) : {};

    if (response.status === 429) {
      return {
        ok: false,
        delivered: false,
        error: data?.error || 'Muitas tentativas em sequência. Aguarde alguns segundos antes de reenviar.'
      };
    }

    if (response.ok && data?.delivered) {
      markApiEmailProbeReady();
      return {
        ok: true,
        delivered: true,
        deliveryMethod: 'smtp',
        providerLabel: 'oportunizahw@gmail.com',
        challengeId: typeof data.challengeId === 'string' ? data.challengeId : undefined,
        serverVerified: Boolean(data.serverVerified),
        expiresInSeconds: typeof data.expiresInSeconds === 'number' ? data.expiresInSeconds : 600,
        message:
          data.message ||
          `Código de 8 dígitos enviado via oportunizahw@gmail.com para ${cleanEmail}.`
      };
    }

    if (
      !isJson ||
      response.status === 404 ||
      response.status === 405 ||
      (response.ok && data?.fallbackRequired)
    ) {
      markApiEmailProbeUnavailable();
      useSupabaseFallback = true;
    } else if (response.ok) {
      clearApiEmailReadyCache();
      useSupabaseFallback = true;
    } else {
      clearApiEmailReadyCache();
      const serverErr = data?.details || data?.error || `Erro HTTP ${response.status} ao enviar e-mail.`;
      if (params.alreadyDispatchedSignupOtp) {
        return {
          ok: true,
          delivered: true,
          deliveryMethod: 'supabase-otp',
          providerLabel: 'Supabase Auth',
          message: `Código de ativação enviado para ${cleanEmail}. Confira sua caixa de entrada ou Spam.`
        };
      }
      const fallback = await trySupabaseOtpFallback(cleanEmail, { preserveCurrentSession: preserveSession });
      if (fallback.delivered) {
        return fallback;
      }
      return {
        ok: false,
        delivered: false,
        deliveryMethod: fallback.deliveryMethod,
        error: fallback.error || serverErr
      };
    }
  } catch (err: any) {
    clearApiEmailReadyCache();
    // Do NOT silently trigger a conflicting second Supabase OTP when the SMTP request timed out mid-flight
    if (err?.name === 'AbortError') {
      return {
        ok: false,
        delivered: false,
        timedOut: true,
        error: `O servidor SMTP demorou para responder ao enviar para ${cleanEmail}. Confira sua caixa de entrada/Spam ou clique em "Reenviar código".`
      };
    }
    console.warn('API e-mail endpoint unreachable, switching to Supabase OTP:', err?.message || err);
    markApiEmailProbeUnavailable();
    useSupabaseFallback = true;
  } finally {
    clearTimeout(timeoutId);
  }

  if (useSupabaseFallback) {
    if (params.alreadyDispatchedSignupOtp) {
      return {
        ok: true,
        delivered: true,
        deliveryMethod: 'supabase-otp',
        providerLabel: 'Supabase Auth',
        message: `Código de ativação enviado para ${cleanEmail}. Confira sua caixa de entrada ou Spam.`
      };
    }
    return await trySupabaseOtpFallback(cleanEmail, { preserveCurrentSession: preserveSession });
  }

  return {
    ok: false,
    delivered: false,
    error: 'Não foi possível enviar o código de verificação por e-mail agora.'
  };
}

export async function verifyServerSecurityCode(params: {
  challengeId: string;
  email: string;
  code: string;
  kind?: VerificationEmailKind;
}): Promise<{
  verified: boolean;
  resetToken?: string;
  locked?: boolean;
  expired?: boolean;
  attemptsRemaining?: number;
  error?: string;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    const cleanCode = (params.code || '').replace(/\D/g, '').slice(0, 8);
    const res = await fetch(buildApiEndpoint('/api/verify-security-code'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        challengeId: params.challengeId,
        email: params.email.trim().toLowerCase(),
        code: cleanCode,
        kind: params.kind
      })
    });
    const data: any = await res.json().catch(() => ({}));
    return {
      verified: Boolean(res.ok && data?.verified),
      resetToken: typeof data?.resetToken === 'string' ? data.resetToken : undefined,
      locked: Boolean(data?.locked),
      expired: Boolean(data?.expired),
      attemptsRemaining: typeof data?.attemptsRemaining === 'number' ? data.attemptsRemaining : undefined,
      error: data?.error
    };
  } catch {
    return {
      verified: false,
      error: 'Erro de conexão ao verificar código de segurança.'
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function verifySupabaseOtpCode(
  email: string,
  code: string,
  preferredTypes?: Array<'email' | 'magiclink' | 'signup' | 'recovery'>,
  options?: { preserveCurrentSession?: boolean }
): Promise<{
  verified: boolean;
  userId?: string;
  error?: string;
  errorKind?: 'expired' | 'rate-limit' | 'timeout' | 'invalid';
}> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanToken = (code || '').replace(/\D/g, '');
  if (!cleanEmail || cleanToken.length !== 8) {
    return { verified: false, errorKind: 'invalid', error: 'Informe os 8 dígitos do código.' };
  }

  const rawTypes: Array<'email' | 'magiclink' | 'signup' | 'recovery'> =
    preferredTypes && preferredTypes.length > 0
      ? preferredTypes
      : ['email'];
  const types = Array.from(new Set(rawTypes));

  const client = options?.preserveCurrentSession ? createEphemeralSupabaseClient() : supabase;
  let lastErrorMsg = 'Token has expired or is invalid';

  for (const otpType of types) {
    try {
      const { data, error } = await withTimeout(
        client.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: otpType
        }),
        8000,
        'Tempo esgotado ao validar código.'
      );
      if (!error && (data?.session || data?.user)) {
        return {
          verified: true,
          userId: data?.user?.id || data?.session?.user?.id
        };
      }
      if (error?.message) {
        lastErrorMsg = error.message;
        const lower = error.message.toLowerCase();
        if (lower.includes('rate limit') || lower.includes('too many') || lower.includes('429')) {
          break;
        }
      }
    } catch (e: any) {
      if (e?.message) {
        lastErrorMsg = e.message;
      }
    }
  }

  const formatted = formatSupabaseVerifyError(lastErrorMsg, cleanEmail);
  return { verified: false, errorKind: formatted.errorKind, error: formatted.message };
}

import { supabase, getAppRedirectUrl } from './supabaseClient';

export type VerificationEmailKind = 'login-2fa' | 'admin-2fa' | 'registration' | 'recovery';
export type VerificationDeliveryMethod = 'smtp' | 'supabase-otp';

export interface SendVerificationEmailParams {
  email: string;
  code: string;
  userName?: string;
  kind: VerificationEmailKind;
  isAdmin?: boolean;
  accountType?: string;
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
const API_SKIP_TTL_MS = 5 * 60 * 1000;
const API_FETCH_TIMEOUT_MS = 2500;
const SUPABASE_OTP_TIMEOUT_MS = 10000;

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
    window.sessionStorage.setItem(API_SKIP_CACHE_KEY, String(Date.now() + API_SKIP_TTL_MS));
  } catch {
    // Ignore restricted storage
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
      return `Muitas tentativas seguidas. Aguarde ${secMatch[1]}s para pedir um novo código, ou digite o código que já chegou no seu Gmail.`;
    }
    return 'Muitas solicitações seguidas ao serviço de e-mail. Aguarde alguns segundos ou confira o código já recebido no Gmail.';
  }
  return `Não foi possível disparar o e-mail automaticamente (${msg}). Tente clicar em "Reenviar Código" em instantes.`;
}

async function trySupabaseOtpFallback(
  cleanEmail: string
): Promise<SendVerificationEmailResult> {
  try {
    const redirectTo = getAppRedirectUrl();
    const attempt = await withTimeout(
      supabase.auth.signInWithOtp({
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

  if (shouldSkipApiEmailProbe()) {
    return await trySupabaseOtpFallback(cleanEmail);
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
  const timeoutId = setTimeout(() => controller.abort(), API_FETCH_TIMEOUT_MS);

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
      markApiEmailProbeUnavailable();
      useSupabaseFallback = true;
    } else {
      markApiEmailProbeUnavailable();
      const serverErr = data?.details || data?.error || `Erro HTTP ${response.status} ao enviar e-mail.`;
      const fallback = await trySupabaseOtpFallback(cleanEmail);
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
    console.warn('API e-mail endpoint unreachable/timed out, switching to Supabase OTP:', err?.message || err);
    markApiEmailProbeUnavailable();
    useSupabaseFallback = true;
  } finally {
    clearTimeout(timeoutId);
  }

  if (useSupabaseFallback) {
    return await trySupabaseOtpFallback(cleanEmail);
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
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(buildApiEndpoint('/api/verify-security-code'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        challengeId: params.challengeId,
        email: params.email.trim().toLowerCase(),
        code: params.code.trim(),
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
  preferredTypes?: Array<'email' | 'magiclink' | 'signup' | 'recovery'>
): Promise<{ verified: boolean; userId?: string; error?: string }> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanToken = (code || '').trim();
  if (!cleanEmail || cleanToken.length !== 8) {
    return { verified: false, error: 'Informe os 8 dígitos do código.' };
  }

  const types: Array<'email' | 'magiclink' | 'signup' | 'recovery'> =
    preferredTypes && preferredTypes.length > 0
      ? preferredTypes
      : ['email', 'magiclink', 'signup'];
  let lastErrorMsg = 'Código incorreto ou expirado.';

  for (const otpType of types) {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.verifyOtp({
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
      }
    } catch (e: any) {
      if (e?.message) lastErrorMsg = e.message;
    }
  }

  return { verified: false, error: lastErrorMsg };
}

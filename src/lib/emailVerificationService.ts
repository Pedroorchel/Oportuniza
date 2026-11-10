import { supabase, getAppRedirectUrl } from './supabaseClient';

export type VerificationEmailKind = 'login-2fa' | 'admin-2fa' | 'registration';
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
  message?: string;
  error?: string;
  isStaticHostError?: boolean;
}

function getApiBaseUrl(): string {
  const configured = (import.meta.env?.VITE_API_BASE_URL || '').trim();
  return configured.replace(/\/+$/, '');
}

export function buildApiEndpoint(path: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

async function trySupabaseOtpFallback(
  cleanEmail: string,
  kind: VerificationEmailKind
): Promise<SendVerificationEmailResult> {
  try {
    const redirectTo = getAppRedirectUrl();
    const firstAttempt = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: kind === 'registration',
        emailRedirectTo: redirectTo || undefined
      }
    });

    if (!firstAttempt.error) {
      return {
        ok: true,
        delivered: true,
        deliveryMethod: 'supabase-otp',
        providerLabel: 'Supabase Auth',
        message: `Código / verificação enviado via e-mail para ${cleanEmail}. Confira sua caixa de entrada ou Spam e digite os 6 dígitos recebidos.`
      };
    }

    const errMsg = (firstAttempt.error.message || '').toLowerCase();
    const isOtpDisabledForMissingUser =
      errMsg.includes('signups not allowed for otp') ||
      errMsg.includes('otp_disabled') ||
      errMsg.includes('user not found');

    if (isOtpDisabledForMissingUser) {
      const retryWithCreate = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectTo || undefined
        }
      });

      if (!retryWithCreate.error) {
        return {
          ok: true,
          delivered: true,
          deliveryMethod: 'supabase-otp',
          providerLabel: 'Supabase Auth',
          message: `Verificação enviada via e-mail para ${cleanEmail}. Confira sua caixa de entrada ou Spam e informe os 6 dígitos recebidos.`
        };
      }

      const retryMsg = retryWithCreate.error.message || '';
      if (retryMsg.toLowerCase().includes('rate limit') || retryMsg.toLowerCase().includes('security purposes')) {
        return {
          ok: false,
          delivered: false,
          isStaticHostError: true,
          error: 'Limite temporário de envio de e-mails do Supabase atingido. Aguarde alguns minutos ou utilize a versão com servidor Node ativo (/api).'
        };
      }
    }

    if (errMsg.includes('rate limit') || errMsg.includes('security purposes')) {
      return {
        ok: false,
        delivered: false,
        isStaticHostError: true,
        error: 'Muitas solicitações seguidas ao serviço de e-mail do Supabase. Aguarde alguns instantes e clique em "Reenviar código".'
      };
    }

    return {
      ok: false,
      delivered: false,
      isStaticHostError: true,
      error: `Não foi possível enviar o e-mail neste ambiente estático (${firstAttempt.error.message}). Acesse pelo servidor completo (com /api ativo) ou configure VITE_API_BASE_URL.`
    };
  } catch (err: any) {
    return {
      ok: false,
      delivered: false,
      isStaticHostError: true,
      error: `Falha ao acionar serviço de verificação por e-mail: ${err?.message || 'servidor /api indisponível neste host.'}`
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

  const endpointPath =
    params.kind === 'registration' ? '/api/send-registration-email' : '/api/send-2fa-email';
  const endpointUrl = buildApiEndpoint(endpointPath);

  let backendUnavailableOnStaticHost = false;

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        code: params.code,
        userName: params.userName || cleanEmail.split('@')[0],
        isAdmin: Boolean(params.isAdmin || params.kind === 'admin-2fa'),
        accountType: params.accountType
      })
    });

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const isJson = contentType.includes('application/json');
    const data: any = isJson ? await response.json().catch(() => ({})) : {};

    if (response.ok && data?.delivered) {
      return {
        ok: true,
        delivered: true,
        deliveryMethod: 'smtp',
        providerLabel: 'oportunizahw@gmail.com',
        message:
          data.message ||
          `Código de 6 dígitos enviado via oportunizahw@gmail.com para ${cleanEmail}.`
      };
    }

    if (response.ok && !isJson) {
      // Static host SPA fallback served index.html instead of /api JSON
      backendUnavailableOnStaticHost = true;
    } else if (response.status === 404 || response.status === 405 || !isJson) {
      // GitHub Pages / static CDN rejects POST /api/* with 404/405 HTML
      backendUnavailableOnStaticHost = true;
    } else if (response.ok) {
      return {
        ok: true,
        delivered: false,
        error: data?.message || 'Servidor de envio de e-mail em modo contingência.'
      };
    } else {
      // Node backend responded with an actual SMTP error JSON — surface exact details
      const serverErr = data?.details || data?.error || `Erro HTTP ${response.status} ao enviar e-mail.`;
      // Still attempt Supabase OTP fallback in case SMTP had an outbound glitch
      const fallback = await trySupabaseOtpFallback(cleanEmail, params.kind);
      if (fallback.delivered) {
        return fallback;
      }
      return {
        ok: false,
        delivered: false,
        error: serverErr
      };
    }
  } catch (err: any) {
    console.warn('API e-mail endpoint unreachable, attempting Supabase OTP fallback:', err?.message || err);
    backendUnavailableOnStaticHost = true;
  }

  if (backendUnavailableOnStaticHost) {
    return await trySupabaseOtpFallback(cleanEmail, params.kind);
  }

  return {
    ok: false,
    delivered: false,
    error: 'Não foi possível enviar o código de verificação por e-mail agora.'
  };
}

export async function verifySupabaseOtpCode(
  email: string,
  code: string
): Promise<{ verified: boolean; userId?: string; error?: string }> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanToken = (code || '').trim();
  if (!cleanEmail || cleanToken.length !== 6) {
    return { verified: false, error: 'Informe os 6 dígitos do código.' };
  }

  const types: Array<'email' | 'magiclink' | 'signup'> = ['email', 'magiclink', 'signup'];
  let lastErrorMsg = 'Código incorreto ou expirado.';

  for (const otpType of types) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: otpType
      });
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

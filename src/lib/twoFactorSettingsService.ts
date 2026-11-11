import { supabase } from './supabaseClient';
import { User } from '../types';
import { recordAuditLog } from './auditLogService';
import {
  buildSessionRoleSignature,
  clearSession2FAVerification,
  markSession2FAVerified
} from './twoFactorSession';
import { cleanEmailAddress } from './profileLookupService';

const PREF_KEY_PREFIX = 'oportuniza-2fa-pref-';

export function resolveStored2FAPref(email?: string | null): boolean | undefined {
  if (typeof window === 'undefined') return undefined;
  const cleanEmail = cleanEmailAddress(email);
  if (!cleanEmail) return undefined;
  try {
    const raw = window.localStorage.getItem(`${PREF_KEY_PREFIX}${cleanEmail}`);
    if (raw === 'true') return true;
    if (raw === 'false') return false;

    const cachedRaw = window.localStorage.getItem('oportuniza-current-user');
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      if (parsed && cleanEmailAddress(parsed.email) === cleanEmail && typeof parsed.is2FAEnabled === 'boolean') {
        return parsed.is2FAEnabled;
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return undefined;
}

export function persistLocal2FAPref(email: string | undefined | null, enabled: boolean): void {
  if (typeof window === 'undefined') return;
  const cleanEmail = cleanEmailAddress(email);
  try {
    if (cleanEmail) {
      window.localStorage.setItem(`${PREF_KEY_PREFIX}${cleanEmail}`, String(Boolean(enabled)));
    }
    const cachedRaw = window.localStorage.getItem('oportuniza-current-user');
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      if (parsed && (!cleanEmail || cleanEmailAddress(parsed.email) === cleanEmail)) {
        window.localStorage.setItem(
          'oportuniza-current-user',
          JSON.stringify({ ...parsed, is2FAEnabled: Boolean(enabled) })
        );
      }
    }
  } catch {
    // Ignore storage write errors
  }
}

export interface Update2FAResult {
  ok: boolean;
  user: User;
  syncedToDatabase: boolean;
  error?: string;
}

export async function updateOwn2FASetting(
  user: User,
  enabled: boolean,
  onUpdateUser?: (updated: User) => void
): Promise<Update2FAResult> {
  const desired = Boolean(enabled);
  const cleanEmail = cleanEmailAddress(user.email);
  const nowIso = new Date().toISOString();

  const updatedUser: User = {
    ...user,
    is2FAEnabled: desired,
    updatedAt: nowIso
  };

  persistLocal2FAPref(cleanEmail, desired);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('oportuniza-current-user', JSON.stringify(updatedUser));
    } catch {}
  }

  // Sincroniza marcador da sessão atual para não bloquear o titular enquanto ajusta as configurações
  if (desired) {
    markSession2FAVerified(
      updatedUser.id || '',
      cleanEmail || updatedUser.email,
      buildSessionRoleSignature(updatedUser.role, Boolean(updatedUser.isAdmin))
    );
  } else {
    clearSession2FAVerification();
  }

  onUpdateUser?.(updatedUser);

  let syncedToDatabase = false;
  let dbErrorMsg: string | undefined;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const hasAuthSession = Boolean(sessionData?.session?.user);

    if (hasAuthSession) {
      const { error: rpcErr } = await supabase.rpc('set_my_2fa_enabled', {
        p_enabled: desired
      });

      if (!rpcErr) {
        syncedToDatabase = true;
      } else {
        const updatePayload = {
          is_2fa_enabled: desired,
          updated_at: nowIso
        };

        let updatedDirectly = false;
        if (user.id && !String(user.id).startsWith('usr-')) {
          const { error: eqErr } = await supabase
            .from('users')
            .update(updatePayload)
            .eq('id', user.id);
          if (!eqErr) {
            updatedDirectly = true;
          }
        }

        if (!updatedDirectly && cleanEmail) {
          const { error: mailErr } = await supabase
            .from('users')
            .update(updatePayload)
            .ilike('email', cleanEmail);
          if (!mailErr) {
            updatedDirectly = true;
          } else {
            dbErrorMsg = mailErr.message || rpcErr.message;
          }
        } else if (!updatedDirectly) {
          dbErrorMsg = rpcErr.message;
        }

        syncedToDatabase = updatedDirectly;
      }

      try {
        await supabase.auth.updateUser({
          data: { is_2fa_enabled: desired }
        });
      } catch {
        // Metadata sync é complementar ao campo real no banco
      }
    }
  } catch (err: any) {
    dbErrorMsg = err?.message || 'Não foi possível sincronizar preferência com o servidor.';
  }

  try {
    await recordAuditLog({
      actor_name: updatedUser.name || 'Titular da Conta',
      actor_email: cleanEmail || updatedUser.email,
      actor_role: updatedUser.role || (updatedUser.isAdmin ? 'Administrador' : 'Candidato'),
      action: desired
        ? 'Verificação em Duas Etapas (2FA) Ativada pelo Titular'
        : 'Verificação em Duas Etapas (2FA) Desativada pelo Titular',
      target_name: cleanEmail || updatedUser.email,
      target_type: 'security',
      details: desired
        ? 'O titular ativou a confirmação por código de 8 dígitos nos próximos logins.'
        : 'O titular desativou a verificação em duas etapas (2FA) para sua própria conta.',
      status: 'authorized'
    });
  } catch {}

  return {
    ok: !dbErrorMsg || syncedToDatabase,
    user: updatedUser,
    syncedToDatabase,
    error: dbErrorMsg
  };
}

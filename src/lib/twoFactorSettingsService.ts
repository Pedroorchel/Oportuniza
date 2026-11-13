import { supabase } from './supabaseClient';
import { User } from '../types';
import { recordAuditLog } from './auditLogService';
import {
  buildSessionRoleSignature,
  clearSession2FAVerification,
  markSession2FAVerified
} from './twoFactorSession';
import {
  cleanEmailAddress,
  resolveStored2FAPref,
  persistLocal2FAPref
} from './profileLookupService';

export { resolveStored2FAPref, persistLocal2FAPref };

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
      }
    }

    if (!syncedToDatabase) {
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

      if (cleanEmail) {
        const { error: mailErr } = await supabase
          .from('users')
          .update(updatePayload)
          .ilike('email', cleanEmail);
        if (!mailErr) {
          updatedDirectly = true;
        } else if (!updatedDirectly) {
          dbErrorMsg = mailErr.message;
        }
      }

      syncedToDatabase = updatedDirectly;
    }

    if (hasAuthSession) {
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

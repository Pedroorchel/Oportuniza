import { supabase } from './supabaseClient';

const BLOCKED_EMAILS_KEY = 'oportuniza_blocked_emails';
const BLOCKED_IDS_KEY = 'oportuniza_blocked_ids';
const BLOCKED_REASONS_KEY = 'oportuniza_blocked_reasons';

/**
 * Returns list of blocked emails from localStorage cache
 */
export function getLocalBlockedEmails(): string[] {
  try {
    const raw = localStorage.getItem(BLOCKED_EMAILS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((e: string) => String(e).trim().toLowerCase()) : [];
  } catch {
    return [];
  }
}

/**
 * Returns list of blocked user IDs from localStorage cache
 */
export function getLocalBlockedIds(): string[] {
  try {
    const raw = localStorage.getItem(BLOCKED_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((id: string) => String(id).trim()) : [];
  } catch {
    return [];
  }
}

/**
 * Returns map of blocked account reasons from localStorage cache
 */
export function getLocalBlockedReasons(): Record<string, string> {
  try {
    const raw = localStorage.getItem(BLOCKED_REASONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Extracts block reason string from a user record
 */
export function extractBlockReasonFromRecord(u: any): string | null {
  if (!u) return null;
  if (u.block_reason && typeof u.block_reason === 'string' && u.block_reason.trim()) {
    return u.block_reason.trim();
  }
  if (u.blockReason && typeof u.blockReason === 'string' && u.blockReason.trim()) {
    return u.blockReason.trim();
  }
  const fields = [u.bio, u.experience, u.education];
  for (const field of fields) {
    if (typeof field === 'string' && field.includes('[[ACCOUNT_BLOCKED]]:')) {
      const parsed = field.replace('[[ACCOUNT_BLOCKED]]:', '').trim();
      if (parsed) return parsed;
    }
  }
  return null;
}

/**
 * Retrieves the block reason for a user by email or ID synchronously from cache
 */
export function getAccountBlockReason(identifier: { id?: string; email?: string }): string {
  const reasons = getLocalBlockedReasons();
  const email = (identifier.email || '').trim().toLowerCase();
  const id = (identifier.id || '').trim();

  if (email && reasons[email]) return reasons[email];
  if (id && reasons[id]) return reasons[id];
  return 'Violação das diretrizes da comunidade ou termos de uso';
}

/**
 * Robustly fetches the block reason from database or local storage cache
 */
export async function fetchAccountBlockReason(identifier: { id?: string; email?: string }): Promise<string> {
  const email = (identifier.email || '').trim().toLowerCase();
  const id = (identifier.id || '').trim();
  const localReasons = getLocalBlockedReasons();

  if (email && localReasons[email]) return localReasons[email];
  if (id && localReasons[id]) return localReasons[id];

  // Try checking in Supabase
  try {
    if (email) {
      const { data } = await supabase
        .from('users')
        .select('block_reason, bio, experience, education, is_blocked, status, role')
        .ilike('email', email)
        .maybeSingle();

      if (data) {
        const found = extractBlockReasonFromRecord(data);
        if (found) {
          localReasons[email] = found;
          if (id) localReasons[id] = found;
          localStorage.setItem(BLOCKED_REASONS_KEY, JSON.stringify(localReasons));
          return found;
        }
      }
    }

    if (id) {
      const { data } = await supabase
        .from('users')
        .select('block_reason, bio, experience, education, is_blocked, status, role')
        .eq('id', id)
        .maybeSingle();

      if (data) {
        const found = extractBlockReasonFromRecord(data);
        if (found) {
          if (email) localReasons[email] = found;
          localReasons[id] = found;
          localStorage.setItem(BLOCKED_REASONS_KEY, JSON.stringify(localReasons));
          return found;
        }
      }
    }
  } catch (err) {
    console.warn('Could not query block reason from Supabase:', err);
  }

  return 'Violação das diretrizes da comunidade ou termos de uso';
}

/**
 * Saves blocked emails and IDs to local storage
 */
export function saveLocalBlocked(emails: string[], ids: string[], reasons?: Record<string, string>) {
  try {
    const uniqueEmails = Array.from(new Set(emails.filter(Boolean).map(e => e.trim().toLowerCase())));
    const uniqueIds = Array.from(new Set(ids.filter(Boolean).map(i => String(i).trim())));
    localStorage.setItem(BLOCKED_EMAILS_KEY, JSON.stringify(uniqueEmails));
    localStorage.setItem(BLOCKED_IDS_KEY, JSON.stringify(uniqueIds));
    if (reasons) {
      localStorage.setItem(BLOCKED_REASONS_KEY, JSON.stringify(reasons));
    }
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.warn('Failed to save blocked cache to localStorage:', e);
  }
}

/**
 * Check if a given database user record is marked as blocked
 */
export function isUserRecordBlocked(u: any): boolean {
  if (!u) return false;
  // Super admin whitelist protection
  if (u.email && String(u.email).trim().toLowerCase() === 'pedroorchel12@gmail.com') {
    return false;
  }
  if (u.is_blocked === true || u.is_blocked === 'true' || u.isBlocked === true) return true;
  const statusStr = String(u.status || '').toLowerCase();
  if (statusStr === 'blocked' || statusStr === 'bloqueado') return true;
  const roleStr = String(u.role || '').toUpperCase();
  const cargoStr = String(u.cargo || '').toUpperCase();
  if (roleStr === 'BLOQUEADO' || roleStr === 'BLOCKED' || cargoStr === 'BLOQUEADO' || cargoStr === 'BLOCKED') return true;
  if (typeof u.bio === 'string' && (u.bio.includes('ACCOUNT_BLOCKED') || u.bio.includes('[[ACCOUNT_BLOCKED]]'))) return true;
  if (typeof u.experience === 'string' && (u.experience.includes('ACCOUNT_BLOCKED') || u.experience.includes('[[ACCOUNT_BLOCKED]]'))) return true;
  if (typeof u.education === 'string' && (u.education.includes('ACCOUNT_BLOCKED') || u.education.includes('[[ACCOUNT_BLOCKED]]'))) return true;
  return false;
}

/**
 * Robustly checks whether an account (by ID or Email) is blocked in database or local blacklist.
 * A blocked account can ONLY be unblocked when an administrator explicitly performs the unblock action.
 */
export async function isAccountBlocked(identifier: { id?: string; email?: string }): Promise<boolean> {
  const cleanEmail = (identifier.email || '').trim().toLowerCase();
  const userId = (identifier.id || '').trim();

  // Root developer is never blocked
  if (cleanEmail === 'pedroorchel12@gmail.com') {
    return false;
  }

  // 1. Fast local cache check
  const localEmails = getLocalBlockedEmails();
  const localIds = getLocalBlockedIds();

  if (cleanEmail && localEmails.includes(cleanEmail)) {
    return true;
  }
  if (userId && localIds.includes(userId)) {
    return true;
  }

  // 2. Database verification in 'users' table
  try {
    // Check by ID if provided
    if (userId) {
      const { data: byIdData, error: byIdErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId);

      if (!byIdErr && byIdData && byIdData.length > 0) {
        const blockedRecord = byIdData.find(isUserRecordBlocked);
        if (blockedRecord) {
          const reason = extractBlockReasonFromRecord(blockedRecord);
          const reasons = getLocalBlockedReasons();
          if (reason) {
            if (cleanEmail) reasons[cleanEmail] = reason;
            reasons[userId] = reason;
          }
          saveLocalBlocked(
            cleanEmail ? [...localEmails, cleanEmail] : localEmails,
            [...localIds, userId],
            reasons
          );
          return true;
        }
      }
    }

    // Check by Email if provided
    if (cleanEmail) {
      const { data: byEmailData, error: byEmailErr } = await supabase
        .from('users')
        .select('*')
        .ilike('email', cleanEmail);

      if (!byEmailErr && byEmailData && byEmailData.length > 0) {
        const blockedRecord = byEmailData.find(isUserRecordBlocked);
        if (blockedRecord) {
          const reason = extractBlockReasonFromRecord(blockedRecord);
          const reasons = getLocalBlockedReasons();
          if (reason) {
            reasons[cleanEmail] = reason;
            if (userId) reasons[userId] = reason;
          }
          saveLocalBlocked(
            [...localEmails, cleanEmail],
            userId ? [...localIds, userId] : localIds,
            reasons
          );
          return true;
        }
      }
    }
  } catch (err) {
    console.error('Error in isAccountBlocked:', err);
  }

  // Final check against local cache
  const recheckEmails = getLocalBlockedEmails();
  const recheckIds = getLocalBlockedIds();
  if (cleanEmail && recheckEmails.includes(cleanEmail)) return true;
  if (userId && recheckIds.includes(userId)) return true;

  return false;
}

/**
 * Blocks a user account permanently in the database and local blacklist.
 * Cannot be undone automatically; requires explicit Admin action.
 */
export async function blockUserAccount(userId?: string, email?: string, name?: string, reason?: string): Promise<void> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanId = (userId || '').trim();
  const cleanReason = (reason || '').trim() || 'Violação das diretrizes da comunidade ou termos de uso';

  // Root developer protection
  if (cleanEmail === 'pedroorchel12@gmail.com') {
    throw new Error('Não é permitido bloquear a conta do Administrador Principal.');
  }

  // 1. Update local cache
  const localEmails = getLocalBlockedEmails();
  const localIds = getLocalBlockedIds();
  const localReasons = getLocalBlockedReasons();
  
  if (cleanEmail && !localEmails.includes(cleanEmail)) localEmails.push(cleanEmail);
  if (cleanId && !localIds.includes(cleanId)) localIds.push(cleanId);
  if (cleanEmail) localReasons[cleanEmail] = cleanReason;
  if (cleanId) localReasons[cleanId] = cleanReason;
  
  saveLocalBlocked(localEmails, localIds, localReasons);

  const blockedBio = `[[ACCOUNT_BLOCKED]]: ${cleanReason}`;

  const blockPayloadFull = {
    role: 'BLOQUEADO',
    cargo: 'BLOQUEADO',
    bio: blockedBio,
    experience: blockedBio,
    education: blockedBio,
    status: 'blocked',
    is_blocked: true,
    block_reason: cleanReason,
    updated_at: new Date().toISOString()
  };

  const blockPayloadWithoutIsBlocked = {
    role: 'BLOQUEADO',
    cargo: 'BLOQUEADO',
    bio: blockedBio,
    experience: blockedBio,
    education: blockedBio,
    status: 'blocked',
    updated_at: new Date().toISOString()
  };

  const blockPayloadSafe = {
    role: 'BLOQUEADO',
    cargo: 'BLOQUEADO',
    bio: blockedBio,
    updated_at: new Date().toISOString()
  };

  // 2. Update database records across all matching rows
  let dbUpdated = false;

  // Try calling the SQL stored procedure if installed
  if (cleanEmail) {
    try {
      const { error: rpcErr } = await supabase.rpc('block_user_by_email', { 
        target_email: cleanEmail,
        block_reason: cleanReason 
      });
      if (!rpcErr) {
        dbUpdated = true;
      }
    } catch {
      // RPC might not be installed yet, proceed with direct table queries
    }
  }

  try {
    if (cleanId) {
      const res1 = await supabase.from('users').update(blockPayloadFull).eq('id', cleanId);
      if (!res1.error) {
        dbUpdated = true;
      } else {
        const res2 = await supabase.from('users').update(blockPayloadWithoutIsBlocked).eq('id', cleanId);
        if (!res2.error) {
          dbUpdated = true;
        } else {
          const res3 = await supabase.from('users').update(blockPayloadSafe).eq('id', cleanId);
          if (!res3.error) dbUpdated = true;
        }
      }
    }

    if (cleanEmail) {
      const res1 = await supabase.from('users').update(blockPayloadFull).ilike('email', cleanEmail);
      if (!res1.error) {
        dbUpdated = true;
      } else {
        const res2 = await supabase.from('users').update(blockPayloadWithoutIsBlocked).ilike('email', cleanEmail);
        if (!res2.error) {
          dbUpdated = true;
        } else {
          const res3 = await supabase.from('users').update(blockPayloadSafe).ilike('email', cleanEmail);
          if (!res3.error) dbUpdated = true;
        }
      }

      // Check if user exists in database, if not, create a blocked placeholder row
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .ilike('email', cleanEmail);

      if (!existing || existing.length === 0) {
        const placeholderId = cleanId || `blocked_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        try {
          const { error: upErr } = await supabase
            .from('users')
            .upsert({
              id: placeholderId,
              email: cleanEmail,
              name: name || cleanEmail.split('@')[0],
              ...blockPayloadFull
            }, { onConflict: 'email' });
          
          if (!upErr) {
            dbUpdated = true;
          } else {
            await supabase
              .from('users')
              .upsert({
                id: placeholderId,
                email: cleanEmail,
                name: name || cleanEmail.split('@')[0],
                ...blockPayloadWithoutIsBlocked
              }, { onConflict: 'email' });
            dbUpdated = true;
          }
        } catch (e) {
          console.warn('Upsert fallback warning:', e);
        }
      }
    }
  } catch (err) {
    console.error('Error saving block to database:', err);
  }

  console.log(`User ${cleanEmail || cleanId} blocked status saved to database: ${dbUpdated}`);
}

/**
 * Unblocks a user account in the database and local blacklist.
 * This is ONLY executed when the Administrator explicitly confirms the unblock action in the Admin Panel.
 */
export async function unblockUserAccount(userId?: string, email?: string): Promise<void> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanId = (userId || '').trim();

  // 1. Update local cache
  const localEmails = getLocalBlockedEmails().filter(e => e !== cleanEmail);
  const localIds = getLocalBlockedIds().filter(id => id !== cleanId);
  const localReasons = getLocalBlockedReasons();
  if (cleanEmail && localReasons[cleanEmail]) delete localReasons[cleanEmail];
  if (cleanId && localReasons[cleanId]) delete localReasons[cleanId];
  saveLocalBlocked(localEmails, localIds, localReasons);

  const unblockPayloadFull = {
    role: 'Estudante',
    cargo: 'Estudante',
    bio: '',
    experience: 'Nenhuma registrada',
    education: 'Ensino Médio em andamento',
    status: 'active',
    is_blocked: false,
    updated_at: new Date().toISOString()
  };

  const unblockPayloadWithoutIsBlocked = {
    role: 'Estudante',
    cargo: 'Estudante',
    bio: '',
    experience: 'Nenhuma registrada',
    education: 'Ensino Médio em andamento',
    status: 'active',
    updated_at: new Date().toISOString()
  };

  const unblockPayloadSafe = {
    role: 'Estudante',
    cargo: 'Estudante',
    bio: '',
    updated_at: new Date().toISOString()
  };

  // Try calling SQL stored procedure if installed
  if (cleanEmail) {
    try {
      await supabase.rpc('unblock_user_by_email', { target_email: cleanEmail });
    } catch {
      // Ignore if RPC not installed
    }
  }

  // 2. Update database records
  try {
    if (cleanId) {
      const res1 = await supabase.from('users').update(unblockPayloadFull).eq('id', cleanId);
      if (res1.error) {
        const res2 = await supabase.from('users').update(unblockPayloadWithoutIsBlocked).eq('id', cleanId);
        if (res2.error) {
          await supabase.from('users').update(unblockPayloadSafe).eq('id', cleanId);
        }
      }
    }

    if (cleanEmail) {
      const res1 = await supabase.from('users').update(unblockPayloadFull).ilike('email', cleanEmail);
      if (res1.error) {
        const res2 = await supabase.from('users').update(unblockPayloadWithoutIsBlocked).ilike('email', cleanEmail);
        if (res2.error) {
          await supabase.from('users').update(unblockPayloadSafe).ilike('email', cleanEmail);
        }
      }
    }
  } catch (err) {
    console.error('Error removing block in database:', err);
  }
}

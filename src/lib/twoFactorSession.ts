const SESSION_2FA_KEY = 'oportuniza-2fa-verified-v2';
const SESSION_2FA_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours max within same browser tab session
const SESSION_2FA_PRIVILEGED_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours max for Admin / Atendimento
const IDLE_TIMEOUT_STANDARD_MS = 30 * 60 * 1000; // 30 minutes inactivity lock
const IDLE_TIMEOUT_PRIVILEGED_MS = 15 * 60 * 1000; // 15 minutes inactivity lock for Admin / Atendimento

interface Stored2FASession {
  userId: string;
  email: string;
  verifiedAt: number;
  lastActivityAt: number;
  roleSignature?: string;
}

function normalizeEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

export function buildSessionRoleSignature(role?: string | null, isAdmin?: boolean): string {
  return `${isAdmin ? 'adm' : 'usr'}:${(role || '').trim().toLowerCase()}`;
}

export function markSession2FAVerified(
  userId: string,
  email: string,
  roleSignature?: string
): void {
  if (typeof window === 'undefined') return;
  const cleanEmail = normalizeEmail(email);
  const cleanId = (userId || '').trim();
  if (!cleanEmail && !cleanId) return;

  const now = Date.now();
  const payload: Stored2FASession = {
    userId: cleanId,
    email: cleanEmail,
    verifiedAt: now,
    lastActivityAt: now,
    roleSignature
  };

  try {
    window.sessionStorage.setItem(SESSION_2FA_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Could not persist 2FA session marker:', e);
  }
}

export function touchSession2FAActivity(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.sessionStorage.getItem(SESSION_2FA_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<Stored2FASession> | null;
    if (!parsed || typeof parsed.verifiedAt !== 'number') return;
    parsed.lastActivityAt = Date.now();
    window.sessionStorage.setItem(SESSION_2FA_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore restricted storage errors
  }
}

export function checkSession2FAStatus(
  userId?: string | null,
  email?: string | null,
  options?: { isPrivileged?: boolean; expectedRoleSignature?: string }
): { valid: boolean; reason?: 'missing' | 'expired' | 'idle' | 'mismatch' } {
  if (typeof window === 'undefined') return { valid: false, reason: 'missing' };
  const cleanEmail = normalizeEmail(email);
  const cleanId = (userId || '').trim();
  if (!cleanEmail && !cleanId) return { valid: false, reason: 'missing' };

  try {
    const raw = window.sessionStorage.getItem(SESSION_2FA_KEY);
    if (!raw) return { valid: false, reason: 'missing' };

    const parsed = JSON.parse(raw) as Partial<Stored2FASession> | null;
    if (!parsed || typeof parsed.verifiedAt !== 'number') {
      return { valid: false, reason: 'missing' };
    }

    const now = Date.now();
    const isPrivileged = Boolean(options?.isPrivileged);
    const maxAge = isPrivileged ? SESSION_2FA_PRIVILEGED_MAX_AGE_MS : SESSION_2FA_MAX_AGE_MS;
    if (now - parsed.verifiedAt > maxAge) {
      window.sessionStorage.removeItem(SESSION_2FA_KEY);
      return { valid: false, reason: 'expired' };
    }

    const lastActive = typeof parsed.lastActivityAt === 'number' ? parsed.lastActivityAt : parsed.verifiedAt;
    const maxIdle = isPrivileged ? IDLE_TIMEOUT_PRIVILEGED_MS : IDLE_TIMEOUT_STANDARD_MS;
    if (now - lastActive > maxIdle) {
      window.sessionStorage.removeItem(SESSION_2FA_KEY);
      return { valid: false, reason: 'idle' };
    }

    if (
      options?.expectedRoleSignature &&
      parsed.roleSignature &&
      parsed.roleSignature !== options.expectedRoleSignature
    ) {
      window.sessionStorage.removeItem(SESSION_2FA_KEY);
      return { valid: false, reason: 'mismatch' };
    }

    const emailMatches = cleanEmail ? normalizeEmail(parsed.email) === cleanEmail : true;
    const isPlaceholderId = (id?: string) => !id || id.startsWith('usr-');
    const idMatches =
      cleanId && parsed.userId && !isPlaceholderId(cleanId) && !isPlaceholderId(parsed.userId)
        ? parsed.userId === cleanId
        : true;
    if (!emailMatches || !idMatches) {
      return { valid: false, reason: 'mismatch' };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'missing' };
  }
}

export function isSession2FAVerified(
  userId?: string | null,
  email?: string | null,
  options?: { isPrivileged?: boolean; expectedRoleSignature?: string }
): boolean {
  return checkSession2FAStatus(userId, email, options).valid;
}

export function clearSession2FAVerification(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SESSION_2FA_KEY);
  } catch {
    // Ignore restricted sessionStorage errors
  }
}


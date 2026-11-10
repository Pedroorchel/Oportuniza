const SESSION_2FA_KEY = 'oportuniza-2fa-verified-v2';
const SESSION_2FA_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours max within same browser tab session

interface Stored2FASession {
  userId: string;
  email: string;
  verifiedAt: number;
}

function normalizeEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

export function markSession2FAVerified(userId: string, email: string): void {
  if (typeof window === 'undefined') return;
  const cleanEmail = normalizeEmail(email);
  const cleanId = (userId || '').trim();
  if (!cleanEmail && !cleanId) return;

  const payload: Stored2FASession = {
    userId: cleanId,
    email: cleanEmail,
    verifiedAt: Date.now()
  };

  try {
    window.sessionStorage.setItem(SESSION_2FA_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Could not persist 2FA session marker:', e);
  }
}

export function isSession2FAVerified(userId?: string | null, email?: string | null): boolean {
  if (typeof window === 'undefined') return false;
  const cleanEmail = normalizeEmail(email);
  const cleanId = (userId || '').trim();
  if (!cleanEmail && !cleanId) return false;

  try {
    const raw = window.sessionStorage.getItem(SESSION_2FA_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw) as Partial<Stored2FASession> | null;
    if (!parsed || typeof parsed.verifiedAt !== 'number') return false;

    if (Date.now() - parsed.verifiedAt > SESSION_2FA_MAX_AGE_MS) {
      window.sessionStorage.removeItem(SESSION_2FA_KEY);
      return false;
    }

    const emailMatches = cleanEmail ? normalizeEmail(parsed.email) === cleanEmail : true;
    const isPlaceholderId = (id?: string) => !id || id.startsWith('usr-');
    const idMatches =
      cleanId && parsed.userId && !isPlaceholderId(cleanId) && !isPlaceholderId(parsed.userId)
        ? parsed.userId === cleanId
        : true;
    return emailMatches && idMatches;
  } catch {
    return false;
  }
}

export function clearSession2FAVerification(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SESSION_2FA_KEY);
  } catch {
    // Ignore restricted sessionStorage errors
  }
}

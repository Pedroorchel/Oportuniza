import { supabase } from './supabaseClient';
import { User } from '../types';

export interface ProfileBundleResult {
  dbUser: Record<string, any> | null;
  companyData: Record<string, any> | null;
  hasActivity: boolean;
  hasPassword: boolean;
  source: 'rpc' | 'query' | 'none';
}

export function cleanEmailAddress(email?: string | null): string {
  return String(email || '').trim().toLowerCase();
}

export function extractDigits(value?: string | null): string {
  return String(value || '').replace(/\D/g, '');
}

export function hasPopulatedProfileFields(
  dbUser: Record<string, any> | null | undefined,
  companyData?: Record<string, any> | null,
  hasActivity = false,
  hasPassword = false
): boolean {
  if (companyData && String(companyData.status || '').toLowerCase() !== 'blocked') {
    return true;
  }
  if (hasActivity || hasPassword) {
    return true;
  }
  if (!dbUser) {
    return false;
  }

  if (dbUser.is_2fa_enabled === true || dbUser.is2FAEnabled === true) {
    return true;
  }
  if (Boolean(String(dbUser.password || '').trim())) {
    return true;
  }
  if (extractDigits(dbUser.phone).length >= 8) {
    return true;
  }
  if (Boolean(String(dbUser.bio || '').trim())) {
    return true;
  }
  if (Boolean(String(dbUser.company_name || dbUser.companyName || '').trim())) {
    return true;
  }
  if (Boolean(String(dbUser.cnpj || '').trim())) {
    return true;
  }
  if (Array.isArray(dbUser.skills) && dbUser.skills.length > 0) {
    return true;
  }

  return false;
}

export function resolveIsAccountActivated(params: {
  authUser?: {
    id?: string;
    email?: string | null;
    user_metadata?: Record<string, any>;
    app_metadata?: Record<string, any>;
  } | null;
  dbUser: Record<string, any> | null;
  companyData: Record<string, any> | null;
  hasActivity?: boolean;
  hasPassword?: boolean;
  cleanEmail: string;
  ignoreLocalCacheIfEmptyDbStub?: boolean;
}): boolean {
  const { authUser, dbUser, companyData, cleanEmail } = params;
  const hasActivity = Boolean(params.hasActivity);
  const hasPassword = Boolean(params.hasPassword || String(dbUser?.password || '').trim());

  const roleLower = String(
    dbUser?.role || dbUser?.cargo || authUser?.user_metadata?.role || authUser?.user_metadata?.cargo || ''
  )
    .trim()
    .toLowerCase();

  const isAdminUser = Boolean(
    dbUser?.is_admin ||
      dbUser?.isAdmin ||
      roleLower === 'administrador' ||
      roleLower === 'admin' ||
      cleanEmail === 'oportunizahw@gmail.com'
  );
  if (isAdminUser) return true;

  const isSupportRole =
    roleLower.includes('atendimento') ||
    roleLower.includes('suporte') ||
    roleLower.includes('moderador');
  if (isSupportRole) return true;

  const hasPopulated = hasPopulatedProfileFields(dbUser, companyData, hasActivity, hasPassword);
  const hasEduOrExp = Boolean(
    String(dbUser?.education || '').trim() || String(dbUser?.experience || '').trim()
  );

  // Already has real user/company/activity data in database -> always activated
  if (hasPopulated) {
    return true;
  }

  const dbStatus = String(dbUser?.status || '').trim().toLowerCase();
  const isActivatedInMeta =
    authUser?.user_metadata?.account_activated === true &&
    authUser?.user_metadata?.profile_completed === true;
  const isActivatedLocally =
    typeof window !== 'undefined' && cleanEmail
      ? localStorage.getItem(`oportuniza-activated-${cleanEmail}`) === 'true'
      : false;

  if (isActivatedInMeta) {
    return true;
  }

  if (isActivatedLocally && !params.ignoreLocalCacheIfEmptyDbStub) {
    return true;
  }

  if (!dbUser) {
    return false;
  }

  if (dbStatus === 'pending') {
    return false;
  }

  const accountTypeLower = String(dbUser.account_type || dbUser.accountType || '').trim().toLowerCase();
  if (accountTypeLower === 'company' || roleLower === 'empresa') {
    return true;
  }

  const authProvider = String(authUser?.app_metadata?.provider || 'email').toLowerCase();
  const isOAuthSession = authProvider !== '' && authProvider !== 'email';

  if (isOAuthSession) {
    // Existing OAuth account previously completed or updated settings (e.g., toggled 2FA)
    const hasUpdatedTimestamp = Boolean(
      dbUser.updated_at &&
        dbUser.created_at &&
        new Date(dbUser.updated_at).getTime() > new Date(dbUser.created_at).getTime() + 1000
    );
    return hasEduOrExp || (dbStatus === 'active' && hasUpdatedTimestamp);
  }

  // Email/password account with non-pending status
  return authUser?.user_metadata?.requires_activation !== true || hasEduOrExp;
}

export async function fetchProfileBundle(authUser?: {
  id?: string;
  email?: string | null;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
} | null): Promise<ProfileBundleResult> {
  const userId = String(authUser?.id || '').trim();
  const cleanEmail = cleanEmailAddress(authUser?.email);

  // 1. Try SECURITY DEFINER RPC first (handles legacy IDs, whitespace, duplicates, and activity atomically)
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_my_profile_bundle');
    if (!rpcErr && rpcData && typeof rpcData === 'object') {
      const payload = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (payload && (payload.found || payload.user || payload.company)) {
        return {
          dbUser: payload.user || null,
          companyData: payload.company || null,
          hasActivity: Boolean(payload.has_activity),
          hasPassword: Boolean(payload.has_password),
          source: 'rpc'
        };
      }
    }
  } catch {
    // Fallback cleanly to table queries if RPC is not deployed yet
  }

  // 2. Fallback direct queries using .limit(...) instead of .maybeSingle() (never fails on PGRST116 duplicates)
  const candidateUserRows: Record<string, any>[] = [];
  let companyData: Record<string, any> | null = null;
  let hasActivity = false;

  if (userId) {
    try {
      const { data: rowsById } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .order('updated_at', { ascending: false })
        .limit(5);
      if (Array.isArray(rowsById)) {
        candidateUserRows.push(...rowsById);
      }
    } catch {
      // Ignore query fallback error
    }
  }

  const hasPopulatedById = candidateUserRows.some((r) => hasPopulatedProfileFields(r));
  if (cleanEmail && (candidateUserRows.length === 0 || !hasPopulatedById)) {
    try {
      const { data: rowsByEmail } = await supabase
        .from('users')
        .select('*')
        .ilike('email', cleanEmail)
        .order('updated_at', { ascending: false })
        .limit(10);
      if (Array.isArray(rowsByEmail)) {
        for (const row of rowsByEmail) {
          if (!candidateUserRows.some((existing) => String(existing.id) === String(row.id))) {
            candidateUserRows.push(row);
          }
        }
      }
    } catch {
      // Ignore query fallback error
    }
  }

  let dbUser: Record<string, any> | null = null;
  if (candidateUserRows.length > 0) {
    dbUser =
      candidateUserRows.find(
        (r) =>
          Boolean(r.is_blocked) ||
          ['blocked', 'bloqueado'].includes(String(r.status || '').toLowerCase())
      ) ||
      candidateUserRows.find((r) => Boolean(r.is_admin)) ||
      candidateUserRows.find((r) => hasPopulatedProfileFields(r)) ||
      candidateUserRows.find((r) => String(r.status || '').toLowerCase() === 'active') ||
      candidateUserRows[0];
  }

  const candidateIds = Array.from(
    new Set(
      [userId, dbUser?.id, ...candidateUserRows.map((r) => r.id)]
        .map((v) => String(v || '').trim())
        .filter(Boolean)
    )
  );

  if (cleanEmail) {
    try {
      const { data: compRows } = await supabase
        .from('companies')
        .select('*')
        .ilike('email', cleanEmail)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (Array.isArray(compRows) && compRows.length > 0) {
        companyData = compRows[0];
      }
    } catch {
      // Ignore query fallback error
    }
  }

  if (!companyData && candidateIds.length > 0) {
    try {
      const { data: compByUid } = await supabase
        .from('companies')
        .select('*')
        .in('user_id', candidateIds)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (Array.isArray(compByUid) && compByUid.length > 0) {
        companyData = compByUid[0];
      }
    } catch {
      // Ignore query fallback error
    }
  }

  if (candidateIds.length > 0 || cleanEmail) {
    try {
      const appById =
        candidateIds.length > 0
          ? await supabase.from('applications').select('id').in('user_id', candidateIds).limit(1)
          : { data: null };
      if (Array.isArray(appById.data) && appById.data.length > 0) {
        hasActivity = true;
      } else if (cleanEmail) {
        const appByEmail = await supabase
          .from('applications')
          .select('id')
          .ilike('candidate_email', cleanEmail)
          .limit(1);
        if (Array.isArray(appByEmail.data) && appByEmail.data.length > 0) {
          hasActivity = true;
        }
      }

      if (!hasActivity && candidateIds.length > 0) {
        const enrollCheck = await supabase
          .from('enrollments')
          .select('id')
          .in('user_id', candidateIds)
          .limit(1);
        if (Array.isArray(enrollCheck.data) && enrollCheck.data.length > 0) {
          hasActivity = true;
        }
      }
    } catch {
      // Ignore optional activity check failure
    }
  }

  return {
    dbUser,
    companyData,
    hasActivity,
    hasPassword: Boolean(String(dbUser?.password || '').trim()),
    source: dbUser || companyData ? 'query' : 'none'
  };
}

export function mapDatabaseRecordToAppUser(params: {
  authUser?: {
    id?: string;
    email?: string | null;
    user_metadata?: Record<string, any>;
  } | null;
  dbUser: Record<string, any> | null;
  companyData: Record<string, any> | null;
  cleanEmail: string;
  isActivated: boolean;
  cachedUser?: Record<string, any> | null;
}): User {
  const { authUser, dbUser, companyData, cleanEmail, isActivated, cachedUser } = params;
  const resolvedId = String(authUser?.id || dbUser?.id || 'usr-' + Date.now());
  const meta = authUser?.user_metadata || {};

  const isAdminUser = Boolean(
    dbUser?.is_admin ||
      dbUser?.isAdmin ||
      dbUser?.role === 'Administrador' ||
      dbUser?.cargo === 'Administrador' ||
      cleanEmail === 'oportunizahw@gmail.com'
  );

  const explicitType = String(
    dbUser?.account_type || dbUser?.accountType || meta.account_type || ''
  )
    .trim()
    .toLowerCase();
  const roleLower = String(dbUser?.role || dbUser?.cargo || meta.role || meta.cargo || '')
    .trim()
    .toLowerCase();

  let isCompanyAccount = false;
  if (explicitType === 'company' || roleLower === 'empresa' || roleLower === 'empresa titular') {
    isCompanyAccount = true;
  } else if (explicitType === 'candidate' || roleLower === 'candidato' || roleLower === 'estudante') {
    isCompanyAccount = false;
  } else if (companyData && String(companyData.status || '').toLowerCase() !== 'blocked') {
    isCompanyAccount = true;
  }

  const rawDbRole = dbUser?.role || dbUser?.cargo;
  const userRole =
    rawDbRole || (isAdminUser ? 'Administrador' : isCompanyAccount ? 'Empresa' : 'Candidato');
  const userCargo =
    dbUser?.cargo ||
    rawDbRole ||
    (isAdminUser ? 'Administrador' : isCompanyAccount ? 'Empresa' : 'Estudante');

  const logoUrl = isCompanyAccount
    ? dbUser?.company_logo_url ||
      dbUser?.companyLogoUrl ||
      dbUser?.avatar_url ||
      companyData?.logo_url ||
      companyData?.avatar_url ||
      cachedUser?.companyLogoUrl ||
      cachedUser?.avatarUrl ||
      ''
    : dbUser?.avatar_url || cachedUser?.avatarUrl || meta.avatar_url || '';

  const fallbackName = cleanEmail ? cleanEmail.split('@')[0] : 'Usuário';
  const resolvedIs2FAEnabled =
    typeof dbUser?.is_2fa_enabled === 'boolean'
      ? dbUser.is_2fa_enabled
      : typeof dbUser?.is2FAEnabled === 'boolean'
      ? dbUser.is2FAEnabled
      : typeof meta?.is_2fa_enabled === 'boolean'
      ? meta.is_2fa_enabled
      : typeof cachedUser?.is2FAEnabled === 'boolean'
      ? cachedUser.is2FAEnabled
      : false;

  return {
    id: resolvedId,
    name: isCompanyAccount
      ? companyData?.company_name ||
        dbUser?.company_name ||
        dbUser?.name ||
        meta.company_name ||
        meta.full_name ||
        cachedUser?.name ||
        fallbackName
      : dbUser?.name || meta.full_name || cachedUser?.name || fallbackName,
    email: cleanEmailAddress(dbUser?.email) || cleanEmail || cleanEmailAddress(authUser?.email),
    avatarUrl: logoUrl,
    companyLogoUrl: isCompanyAccount ? logoUrl : undefined,
    companyName: isCompanyAccount
      ? companyData?.company_name ||
        dbUser?.company_name ||
        dbUser?.companyName ||
        meta.company_name ||
        cachedUser?.companyName ||
        ''
      : undefined,
    cnpj: isCompanyAccount
      ? companyData?.cnpj || dbUser?.cnpj || meta.cnpj || cachedUser?.cnpj || ''
      : undefined,
    responsibleName: isCompanyAccount
      ? companyData?.responsible_name ||
        dbUser?.responsible_name ||
        dbUser?.responsibleName ||
        meta.responsible_name ||
        cachedUser?.responsibleName ||
        ''
      : undefined,
    companySegment: isCompanyAccount
      ? companyData?.segment ||
        dbUser?.company_segment ||
        dbUser?.companySegment ||
        meta.company_segment ||
        cachedUser?.companySegment ||
        ''
      : undefined,
    companyNeighborhood: isCompanyAccount
      ? companyData?.neighborhood ||
        dbUser?.company_neighborhood ||
        dbUser?.companyNeighborhood ||
        meta.company_neighborhood ||
        cachedUser?.companyNeighborhood ||
        ''
      : undefined,
    accountType: isCompanyAccount ? 'company' : 'candidate',
    bio:
      dbUser?.bio ||
      (isCompanyAccount ? companyData?.bio : '') ||
      meta.bio ||
      cachedUser?.bio ||
      '',
    education:
      dbUser?.education ||
      meta.education ||
      (isCompanyAccount ? 'Empresa / Empregador' : 'Ensino Médio em andamento'),
    experience:
      dbUser?.experience ||
      meta.experience ||
      (isCompanyAccount ? 'Empresa Contratante em Araucária' : 'Nenhuma registrada'),
    phone:
      (isCompanyAccount ? companyData?.phone : null) ||
      dbUser?.phone ||
      meta.phone ||
      cachedUser?.phone ||
      '',
    skills: Array.isArray(dbUser?.skills)
      ? dbUser.skills
      : Array.isArray(meta.skills)
      ? meta.skills
      : [],
    favorites: Array.isArray(dbUser?.favorites)
      ? dbUser.favorites
      : Array.isArray(cachedUser?.favorites)
      ? cachedUser.favorites
      : [],
    notificationsEnabled: dbUser?.notifications_enabled ?? true,
    marketingEmailsEnabled: dbUser?.marketing_emails_enabled ?? false,
    updatedAt: dbUser?.updated_at,
    isAdmin: isAdminUser,
    isBlocked: false,
    is2FAEnabled: resolvedIs2FAEnabled,
    status: isActivated ? 'active' : 'pending',
    role: userRole,
    cargo: userCargo
  };
}

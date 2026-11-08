import { supabase } from './supabaseClient';
import { Company } from '../types';

const LOCAL_STORAGE_KEY = 'oportuniza_companies_local_db';

export const COMPANY_SQL_SCHEMA = `-- =======================================================
-- SCRIPT SQL: TABELA EXCLUSIVA PARA EMPRESAS E RH
-- Projeto: Oportuniza Araucária
-- =======================================================

-- 1. Criar a tabela 'companies' (caso ainda não exista)
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  cnpj TEXT,
  responsible_name TEXT NOT NULL,
  responsible_role TEXT DEFAULT 'RH / Recrutamento',
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  segment TEXT DEFAULT 'Outros',
  neighborhood TEXT DEFAULT 'Centro',
  address TEXT,
  website TEXT,
  bio TEXT,
  logo_url TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'pending', 'verified', 'blocked'
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Criar índices para consultas ultra rápidas
CREATE INDEX IF NOT EXISTS idx_companies_email ON public.companies(email);
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON public.companies(user_id);
CREATE INDEX IF NOT EXISTS idx_companies_segment ON public.companies(segment);
CREATE INDEX IF NOT EXISTS idx_companies_neighborhood ON public.companies(neighborhood);
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies(status);

-- 3. Habilitar Segurança por Linhas (Row Level Security - RLS)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas de acesso (Policies)
-- Política para leitura pública: Qualquer usuário pode ver as empresas cadastradas
DROP POLICY IF EXISTS "Permitir leitura publica de empresas" ON public.companies;
CREATE POLICY "Permitir leitura publica de empresas" 
  ON public.companies FOR SELECT 
  USING (true);

-- Política para cadastro: Novos cadastros de empresas permitidos
DROP POLICY IF EXISTS "Permitir cadastro de empresas" ON public.companies;
CREATE POLICY "Permitir cadastro de empresas" 
  ON public.companies FOR INSERT 
  WITH CHECK (true);

-- Política para atualização: Pela própria empresa autenticada ou administrador
DROP POLICY IF EXISTS "Permitir atualizacao de empresas" ON public.companies;
CREATE POLICY "Permitir atualizacao de empresas" 
  ON public.companies FOR UPDATE 
  USING (true);

-- Política para exclusão: Pela empresa ou administrador
DROP POLICY IF EXISTS "Permitir exclusao de empresas" ON public.companies;
CREATE POLICY "Permitir exclusao de empresas" 
  ON public.companies FOR DELETE 
  USING (true);
`;

/**
 * Lê empresas salvas no armazenamento local (fallback / cache de segurança)
 */
export function getLocalCompanies(): Company[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Salva empresa no armazenamento local (fallback)
 */
export function saveLocalCompany(company: Company): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalCompanies();
    const index = current.findIndex(c => c.id === company.id || (c.email && c.email.toLowerCase() === company.email.toLowerCase()));
    if (index >= 0) {
      current[index] = { ...current[index], ...company, updated_at: new Date().toISOString() };
    } else {
      current.unshift({ ...company, created_at: company.created_at || new Date().toISOString() });
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.warn('Erro ao salvar empresa no localStorage:', e);
  }
}

/**
 * Remove empresa do armazenamento local
 */
export function removeLocalCompany(idOrEmail: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalCompanies();
    const filtered = current.filter(c => c.id !== idOrEmail && c.email?.toLowerCase() !== idOrEmail.toLowerCase());
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('Erro ao remover empresa do localStorage:', e);
  }
}

/**
 * Busca todas as empresas cadastradas no banco de dados Supabase
 * Faz fallback automático buscando usuários com papel de 'Empresa' e cache local
 */
export async function getAllCompanies(): Promise<Company[]> {
  const companiesMap = new Map<string, Company>();

  // 1. Carrega primeiro do cache local
  const localList = getLocalCompanies();
  localList.forEach(c => {
    if (c.email) companiesMap.set(c.email.toLowerCase(), c);
  });

  // 2. Tenta buscar da tabela dedicada 'companies' no Supabase
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && Array.isArray(data)) {
      data.forEach(item => {
        const email = String(item.email || '').trim().toLowerCase();
        if (email) {
          const comp: Company = {
            id: String(item.id || `comp-${Math.random().toString(36).substring(2, 9)}`),
            user_id: item.user_id ? String(item.user_id) : undefined,
            company_name: String(item.company_name || 'Empresa'),
            cnpj: item.cnpj ? String(item.cnpj) : undefined,
            responsible_name: String(item.responsible_name || 'Responsável RH'),
            responsible_role: String(item.responsible_role || 'RH / Recrutamento'),
            email: email,
            phone: item.phone ? String(item.phone) : undefined,
            segment: String(item.segment || 'Outros'),
            neighborhood: String(item.neighborhood || 'Centro'),
            address: item.address ? String(item.address) : undefined,
            website: item.website ? String(item.website) : undefined,
            status: item.status || 'active',
            verified: Boolean(item.verified),
            bio: item.bio ? String(item.bio) : undefined,
            logo_url: item.logo_url ? String(item.logo_url) : undefined,
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at
          };
          companiesMap.set(email, comp);
          saveLocalCompany(comp);
        }
      });
    }
  } catch (err) {
    console.warn('Tabela "companies" no Supabase ainda não inicializada ou erro de leitura:', err);
  }

  // 3. Tenta complementar com usuários registrados com accountType = 'company' ou role = 'Empresa'
  try {
    const { data: usersData } = await supabase
      .from('users')
      .select('*');

    if (usersData && Array.isArray(usersData)) {
      usersData.forEach(u => {
        const isCompRole = u.role === 'Empresa' || u.cargo === 'Empresa' || u.account_type === 'company';
        const email = String(u.email || '').trim().toLowerCase();
        if (isCompRole && email && !companiesMap.has(email)) {
          const comp: Company = {
            id: String(u.id || `comp-usr-${Math.random()}`),
            user_id: u.id ? String(u.id) : undefined,
            company_name: String(u.name || u.company_name || email.split('@')[0]),
            cnpj: u.cnpj ? String(u.cnpj) : undefined,
            responsible_name: String(u.responsible_name || u.name || 'Responsável'),
            responsible_role: 'RH / Contratante',
            email: email,
            phone: u.phone ? String(u.phone) : undefined,
            segment: u.company_segment || u.segment || 'Comércio & Serviços',
            neighborhood: u.company_neighborhood || u.neighborhood || 'Centro',
            status: u.status === 'blocked' ? 'blocked' : 'active',
            verified: false,
            bio: u.bio || undefined,
            created_at: u.created_at || new Date().toISOString()
          };
          companiesMap.set(email, comp);
          saveLocalCompany(comp);
        }
      });
    }
  } catch (err) {
    console.warn('Aviso na sincronização de usuários empresas:', err);
  }

  return Array.from(companiesMap.values());
}

/**
 * Salva ou atualiza os dados de uma empresa na tabela 'companies' do Supabase
 */
export async function saveCompanyProfile(companyData: Partial<Company> & { company_name: string; email: string; responsible_name: string }): Promise<Company> {
  const cleanEmail = companyData.email.trim().toLowerCase();
  const id = companyData.id || `comp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const completeCompany: Company = {
    id,
    user_id: companyData.user_id,
    company_name: companyData.company_name.trim(),
    cnpj: companyData.cnpj?.trim() || undefined,
    responsible_name: companyData.responsible_name.trim(),
    responsible_role: companyData.responsible_role?.trim() || 'RH / Recrutador',
    email: cleanEmail,
    phone: companyData.phone?.trim() || undefined,
    segment: companyData.segment || 'Comércio & Serviços',
    neighborhood: companyData.neighborhood || 'Centro',
    address: companyData.address?.trim() || undefined,
    website: companyData.website?.trim() || undefined,
    status: companyData.status || 'active',
    verified: Boolean(companyData.verified),
    bio: companyData.bio?.trim() || undefined,
    logo_url: companyData.logo_url || undefined,
    created_at: companyData.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Salva no armazenamento local primeiro (resiliência total)
  saveLocalCompany(completeCompany);

  // Tenta salvar diretamente na tabela 'companies' do Supabase
  try {
    const payload: Record<string, any> = {
      company_name: completeCompany.company_name,
      responsible_name: completeCompany.responsible_name,
      responsible_role: completeCompany.responsible_role,
      email: completeCompany.email,
      phone: completeCompany.phone || null,
      cnpj: completeCompany.cnpj || null,
      segment: completeCompany.segment || null,
      neighborhood: completeCompany.neighborhood || null,
      address: completeCompany.address || null,
      website: completeCompany.website || null,
      bio: completeCompany.bio || null,
      status: completeCompany.status || 'active',
      verified: completeCompany.verified || false,
      updated_at: new Date().toISOString()
    };

    if (completeCompany.user_id) {
      payload.user_id = completeCompany.user_id;
    }

    const { data, error } = await supabase
      .from('companies')
      .upsert({
        ...payload,
        email: cleanEmail
      }, { onConflict: 'email' })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Aviso ao persistir na tabela "companies" do Supabase:', error.message);
    } else if (data) {
      completeCompany.id = String(data.id || completeCompany.id);
      saveLocalCompany(completeCompany);
    }
  } catch (err) {
    console.warn('Erro de conexão ao salvar empresa no Supabase:', err);
  }

  // Sincroniza também na tabela 'users' para manter integridade
  if (completeCompany.user_id) {
    try {
      await supabase.from('users').upsert({
        id: completeCompany.user_id,
        name: completeCompany.company_name,
        email: cleanEmail,
        phone: completeCompany.phone || '',
        role: 'Empresa',
        cargo: 'Empresa',
        education: 'Empresa / Empregador',
        experience: `Empresa atuante no segmento ${completeCompany.segment} em Araucária`,
        bio: completeCompany.bio || `Empresa parceira Oportuniza Araucária no bairro ${completeCompany.neighborhood}`
      }, { onConflict: 'id' });
    } catch (e) {
      console.warn('Aviso ao sincronizar tabela users:', e);
    }
  }

  return completeCompany;
}

/**
 * Atualiza status da empresa (ex: 'active', 'verified', 'blocked')
 */
export async function setCompanyStatus(companyId: string, email: string, status: 'active' | 'verified' | 'blocked' | 'pending', verified?: boolean): Promise<boolean> {
  const cleanEmail = email.trim().toLowerCase();

  // Local update
  const localList = getLocalCompanies();
  const found = localList.find(c => c.id === companyId || c.email.toLowerCase() === cleanEmail);
  if (found) {
    found.status = status;
    if (verified !== undefined) found.verified = verified;
    found.updated_at = new Date().toISOString();
    saveLocalCompany(found);
  }

  try {
    const updatePayload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString()
    };
    if (verified !== undefined) updatePayload.verified = verified;

    await supabase
      .from('companies')
      .update(updatePayload)
      .or(`id.eq.${companyId},email.ilike.${cleanEmail}`);

    return true;
  } catch (err) {
    console.warn('Erro ao atualizar status da empresa:', err);
    return false;
  }
}

/**
 * Remove empresa da base de dados
 */
export async function deleteCompanyRecord(companyId: string, email: string): Promise<boolean> {
  const cleanEmail = email.trim().toLowerCase();
  removeLocalCompany(companyId);
  removeLocalCompany(cleanEmail);

  try {
    await supabase
      .from('companies')
      .delete()
      .or(`id.eq.${companyId},email.ilike.${cleanEmail}`);
    return true;
  } catch (err) {
    console.warn('Erro ao deletar empresa do banco:', err);
    return false;
  }
}

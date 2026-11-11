-- =====================================================================
-- OPORTUNIZA - POLÍTICAS DE SEGURANÇA RLS & SCHEMA BLINDADO (SUPABASE)
-- =====================================================================
--
-- Blindagem completa contra escalação de privilégios, IDOR, exposição
-- de dados pessoais (LGPD), alteração não autorizada de status/cargos e
-- políticas abertas (USING TRUE / user_metadata spoofável).
--
-- EXECUÇÃO: Copie e cole este script no painel SQL Editor do seu projeto
-- Supabase e clique em "Run" (Executar). O script é idempotente.
-- =====================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1. TABELA DE USUÁRIOS / PERFIS (public.users)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  email TEXT UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  education TEXT,
  experience TEXT,
  skills TEXT[] DEFAULT '{}',
  phone TEXT,
  favorites TEXT[] DEFAULT '{}',
  notifications_enabled BOOLEAN DEFAULT TRUE,
  marketing_emails_enabled BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Garantir colunas essenciais caso a tabela já existisse
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_2fa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'candidate';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Candidato';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cargo TEXT DEFAULT 'Estudante';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS block_reason TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS responsible_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS responsible_role TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company_segment TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company_neighborhood TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company_logo_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS vagas_postadas INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS posted_jobs_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Remover FK restritiva caso exista
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- (Índices únicos de e-mail são criados após deduplicação e normalização na Seção 14)

-- =====================================================================
-- 2. TABELAS PRINCIPAIS (public.jobs, public.companies, public.applications)
-- (Estruturas criadas antes das funções SECURITY DEFINER e políticas RLS)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  type TEXT,
  salary TEXT,
  description TEXT,
  requirements TEXT[] DEFAULT '{}',
  benefits TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Geral';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS is_remote BOOLEAN DEFAULT FALSE;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS posted_date TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS start_date TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS end_date TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS work_hours TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_neighborhood TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_contact_phone TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_contact_email TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_responsible_name TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_responsible_role TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_logo_url TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'accepted';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS approved_at TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS accepted_candidates_count INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  company_name TEXT NOT NULL,
  cnpj TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  status TEXT DEFAULT 'active',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS responsible_name TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS responsible_role TEXT DEFAULT 'RH / Recrutamento';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS segment TEXT DEFAULT 'Outros';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS neighborhood TEXT DEFAULT 'Centro';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS vagas_postadas INTEGER DEFAULT 0;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS posted_jobs_count INTEGER DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.companies ALTER COLUMN cnpj DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- (Índices únicos de e-mail de empresas são criados após deduplicação na Seção 14)

CREATE TABLE IF NOT EXISTS public.applications (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  job_title TEXT,
  company TEXT,
  applied_date TEXT,
  status TEXT DEFAULT 'Em análise',
  candidate_name TEXT,
  candidate_email TEXT,
  candidate_phone TEXT,
  cv_link TEXT,
  cv_file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS job_id TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS applied_date TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Em análise';
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS candidate_name TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS candidate_email TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS candidate_phone TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS cv_link TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS cv_file_name TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_job_id_fkey;

-- =====================================================================
-- 3. FUNÇÕES DE SEGURANÇA (SECURITY DEFINER - SEM SPOOF DE user_metadata)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.current_auth_email()
RETURNS TEXT AS $$
  SELECT LOWER(TRIM(COALESCE(NULLIF(auth.jwt() ->> 'email', ''), '')));
$$ LANGUAGE sql STABLE;

-- Verifica administrador exclusivamente por e-mail master ou colunas confiáveis em public.users
-- (NUNCA confia em user_metadata editável pelo cliente)
CREATE OR REPLACE FUNCTION public.is_oportuniza_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_email TEXT;
  v_uid TEXT;
BEGIN
  v_email := public.current_auth_email();
  v_uid := COALESCE(auth.uid()::text, '');

  IF v_email = 'oportunizahw@gmail.com' THEN
    RETURN TRUE;
  END IF;

  IF v_uid = '' AND v_email = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.users u
    WHERE (
      (v_uid <> '' AND u.id::text = v_uid) OR
      (v_email <> '' AND LOWER(TRIM(COALESCE(u.email, ''))) = v_email)
    )
    AND (
      COALESCE(u.is_admin, FALSE) = TRUE OR
      LOWER(COALESCE(u.role, '')) IN ('administrador', 'admin', 'admin criador', 'admin criador da aplicação', 'super admin') OR
      LOWER(COALESCE(u.cargo, '')) IN ('administrador', 'admin')
    )
    AND COALESCE(u.is_blocked, FALSE) = FALSE
    AND LOWER(COALESCE(u.status, '')) NOT IN ('blocked', 'bloqueado')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Verifica equipe de Atendimento / Suporte (Nível 2)
CREATE OR REPLACE FUNCTION public.is_oportuniza_support()
RETURNS BOOLEAN AS $$
DECLARE
  v_email TEXT;
  v_uid TEXT;
BEGIN
  IF public.is_oportuniza_admin() THEN
    RETURN TRUE;
  END IF;

  v_email := public.current_auth_email();
  v_uid := COALESCE(auth.uid()::text, '');

  IF v_email IN (
    'atendimento@oportuniza.araucaria.br',
    'suporte@oportuniza.araucaria.br',
    'atendimento@oportunizaehw.com.br',
    'suporte@oportunizaehw.com.br'
  ) THEN
    RETURN TRUE;
  END IF;

  IF v_uid = '' AND v_email = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.users u
    WHERE (
      (v_uid <> '' AND u.id::text = v_uid) OR
      (v_email <> '' AND LOWER(TRIM(COALESCE(u.email, ''))) = v_email)
    )
    AND (
      LOWER(COALESCE(u.role, '')) LIKE '%atendimento%' OR
      LOWER(COALESCE(u.role, '')) LIKE '%suporte%' OR
      LOWER(COALESCE(u.role, '')) LIKE '%moderador%' OR
      LOWER(COALESCE(u.cargo, '')) LIKE '%atendimento%' OR
      LOWER(COALESCE(u.cargo, '')) LIKE '%suporte%'
    )
    AND COALESCE(u.is_blocked, FALSE) = FALSE
    AND LOWER(COALESCE(u.status, '')) NOT IN ('blocked', 'bloqueado')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Verifica se o usuário autenticado é conta Empresa ativa e não bloqueada
CREATE OR REPLACE FUNCTION public.is_oportuniza_company()
RETURNS BOOLEAN AS $$
DECLARE
  v_email TEXT;
  v_uid TEXT;
BEGIN
  v_email := public.current_auth_email();
  v_uid := COALESCE(auth.uid()::text, '');

  IF v_uid = '' AND v_email = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.users u
    WHERE (
      (v_uid <> '' AND u.id::text = v_uid) OR
      (v_email <> '' AND LOWER(TRIM(COALESCE(u.email, ''))) = v_email)
    )
    AND (
      LOWER(COALESCE(u.account_type, '')) = 'company' OR
      LOWER(COALESCE(u.role, '')) IN ('empresa', 'empresa titular') OR
      LOWER(COALESCE(u.cargo, '')) = 'empresa'
    )
    AND COALESCE(u.is_blocked, FALSE) = FALSE
    AND LOWER(COALESCE(u.status, '')) NOT IN ('blocked', 'bloqueado')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Verifica se a empresa autenticada é titular da vaga / empresa informada
CREATE OR REPLACE FUNCTION public.is_company_owner(target_company TEXT, target_job_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_email TEXT;
  v_uid TEXT;
  v_target_co TEXT;
BEGIN
  IF public.is_oportuniza_admin() THEN
    RETURN TRUE;
  END IF;

  IF NOT public.is_oportuniza_company() THEN
    RETURN FALSE;
  END IF;

  v_email := public.current_auth_email();
  v_uid := COALESCE(auth.uid()::text, '');
  v_target_co := LOWER(TRIM(COALESCE(target_company, '')));

  -- Verifica propriedade direta na tabela companies
  IF v_target_co <> '' AND EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE (
      (v_uid <> '' AND COALESCE(c.user_id::text, '') = v_uid) OR
      (v_email <> '' AND LOWER(TRIM(COALESCE(c.email, ''))) = v_email)
    )
    AND LOWER(TRIM(COALESCE(c.company_name, ''))) = v_target_co
  ) THEN
    RETURN TRUE;
  END IF;

  -- Verifica propriedade via perfil de empresa em public.users
  IF v_target_co <> '' AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE (
      (v_uid <> '' AND u.id::text = v_uid) OR
      (v_email <> '' AND LOWER(TRIM(COALESCE(u.email, ''))) = v_email)
    )
    AND (
      LOWER(TRIM(COALESCE(u.company_name, ''))) = v_target_co OR
      LOWER(TRIM(COALESCE(u.name, ''))) = v_target_co
    )
  ) THEN
    RETURN TRUE;
  END IF;

  -- Verifica propriedade da vaga específica pelo ID
  IF target_job_id IS NOT NULL AND TRIM(target_job_id) <> '' AND EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.id = target_job_id
    AND (
      (v_email <> '' AND LOWER(TRIM(COALESCE(j.company_contact_email, ''))) = v_email) OR
      EXISTS (
        SELECT 1
        FROM public.companies c
        WHERE (
          (v_uid <> '' AND COALESCE(c.user_id::text, '') = v_uid) OR
          (v_email <> '' AND LOWER(TRIM(COALESCE(c.email, ''))) = v_email)
        )
        AND LOWER(TRIM(COALESCE(c.company_name, ''))) = LOWER(TRIM(COALESCE(j.company, j.company_name, '')))
      ) OR
      EXISTS (
        SELECT 1
        FROM public.users u
        WHERE (
          (v_uid <> '' AND u.id::text = v_uid) OR
          (v_email <> '' AND LOWER(TRIM(COALESCE(u.email, ''))) = v_email)
        )
        AND (
          LOWER(TRIM(COALESCE(u.company_name, ''))) = LOWER(TRIM(COALESCE(j.company, j.company_name, ''))) OR
          LOWER(TRIM(COALESCE(u.name, ''))) = LOWER(TRIM(COALESCE(j.company, j.company_name, '')))
        )
      )
    )
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Remove quaisquer assinaturas legadas das RPCs (evita erro 42P13 ao alterar tipo de retorno)
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'check_email_status',
        'block_user_by_email',
        'unblock_user_by_email',
        'relink_user_id_references',
        'assign_company_user_id',
        'get_my_profile_bundle',
        'complete_my_profile_activation'
      )
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || fn.sig::text || ';';
  END LOOP;
END $$;

-- Remove FKs legadas em colunas user_id que impediriam re-sincronizar UUIDs entre auth.users e public.users
DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT DISTINCT
      cls.relname AS tbl_name,
      con.conname AS con_name
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    JOIN pg_attribute att ON att.attrelid = cls.oid AND att.attnum = ANY(con.conkey)
    WHERE nsp.nspname = 'public'
      AND con.contype = 'f'
      AND cls.relname IN ('applications', 'enrollments', 'user_course_progress', 'companies', 'support_tickets')
      AND att.attname = 'user_id'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I;', fk.tbl_name, fk.con_name);
  END LOOP;
END $$;

-- Auxiliar interno seguro para re-vincular user_id independentemente de a coluna ser UUID ou TEXT no banco
CREATE OR REPLACE FUNCTION public.relink_user_id_references(p_old_uid TEXT, p_new_uid TEXT)
RETURNS VOID AS $$
DECLARE
  v_old TEXT := TRIM(COALESCE(p_old_uid, ''));
  v_new TEXT := TRIM(COALESCE(p_new_uid, ''));
  v_is_new_uuid BOOLEAN;
  v_tbl TEXT;
  v_udt TEXT;
BEGIN
  IF v_old = '' OR v_new = '' OR v_old = v_new THEN
    RETURN;
  END IF;

  v_is_new_uuid := (v_new ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

  FOREACH v_tbl IN ARRAY ARRAY['applications', 'enrollments', 'user_course_progress', 'companies', 'support_tickets']
  LOOP
    SELECT c.udt_name INTO v_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = v_tbl
      AND c.column_name = 'user_id'
    LIMIT 1;

    IF v_udt IS NULL THEN
      CONTINUE;
    ELSIF v_udt = 'uuid' THEN
      IF v_is_new_uuid THEN
        EXECUTE format(
          'UPDATE public.%I SET user_id = $1::uuid WHERE user_id::text = $2 AND COALESCE(user_id::text, '''') <> $1',
          v_tbl
        ) USING v_new, v_old;
      END IF;
    ELSE
      EXECUTE format(
        'UPDATE public.%I SET user_id = $1 WHERE user_id::text = $2 AND COALESCE(user_id::text, '''') <> $1',
        v_tbl
      ) USING v_new, v_old;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.relink_user_id_references(TEXT, TEXT) FROM PUBLIC;

-- Auxiliar interno seguro para atualizar companies.user_id respeitando tipagem UUID ou TEXT
CREATE OR REPLACE FUNCTION public.assign_company_user_id(p_company_id TEXT, p_new_uid TEXT)
RETURNS VOID AS $$
DECLARE
  v_cid TEXT := TRIM(COALESCE(p_company_id, ''));
  v_uid TEXT := TRIM(COALESCE(p_new_uid, ''));
  v_is_uid_uuid BOOLEAN;
  v_udt TEXT;
BEGIN
  IF v_cid = '' OR v_uid = '' THEN
    RETURN;
  END IF;

  SELECT c.udt_name INTO v_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'companies'
    AND c.column_name = 'user_id'
  LIMIT 1;

  IF v_udt IS NULL THEN
    RETURN;
  ELSIF v_udt = 'uuid' THEN
    v_is_uid_uuid := (v_uid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
    IF v_is_uid_uuid THEN
      EXECUTE 'UPDATE public.companies SET user_id = $1::uuid WHERE id::text = $2 AND COALESCE(user_id::text, '''') <> $1'
      USING v_uid, v_cid;
    END IF;
  ELSE
    EXECUTE 'UPDATE public.companies SET user_id = $1 WHERE id::text = $2 AND COALESCE(user_id::text, '''') <> $1'
    USING v_uid, v_cid;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.assign_company_user_id(TEXT, TEXT) FROM PUBLIC;

-- RPC segura para verificar se e-mail já existe ou está bloqueado SEM expor linhas ou PII (LGPD)
DROP FUNCTION IF EXISTS public.check_email_status(TEXT);
CREATE OR REPLACE FUNCTION public.check_email_status(target_email TEXT)
RETURNS JSONB AS $$
DECLARE
  v_clean TEXT;
  v_exists BOOLEAN := FALSE;
  v_blocked BOOLEAN := FALSE;
  v_reason TEXT := NULL;
  v_user RECORD;
BEGIN
  v_clean := LOWER(TRIM(COALESCE(target_email, '')));
  IF v_clean = '' OR position('@' IN v_clean) = 0 THEN
    RETURN jsonb_build_object('exists', FALSE, 'is_blocked', FALSE, 'block_reason', NULL);
  END IF;

  SELECT
    id,
    is_blocked,
    block_reason,
    status,
    role,
    cargo,
    bio,
    experience,
    education
  INTO v_user
  FROM public.users
  WHERE LOWER(TRIM(COALESCE(email, ''))) = v_clean
  LIMIT 1;

  IF FOUND THEN
    v_exists := TRUE;
    IF v_clean <> 'oportunizahw@gmail.com' THEN
      v_blocked := (
        COALESCE(v_user.is_blocked, FALSE) = TRUE OR
        LOWER(COALESCE(v_user.status, '')) IN ('blocked', 'bloqueado') OR
        UPPER(COALESCE(v_user.role, '')) IN ('BLOQUEADO', 'BLOCKED') OR
        UPPER(COALESCE(v_user.cargo, '')) IN ('BLOQUEADO', 'BLOCKED') OR
        COALESCE(v_user.bio, '') LIKE '%ACCOUNT_BLOCKED%' OR
        COALESCE(v_user.experience, '') LIKE '%ACCOUNT_BLOCKED%' OR
        COALESCE(v_user.education, '') LIKE '%ACCOUNT_BLOCKED%'
      );

      IF v_blocked THEN
        v_reason := NULLIF(TRIM(COALESCE(v_user.block_reason, '')), '');
        IF v_reason IS NULL AND COALESCE(v_user.bio, '') LIKE '%[[ACCOUNT_BLOCKED]]:%' THEN
          v_reason := NULLIF(TRIM(replace(v_user.bio, '[[ACCOUNT_BLOCKED]]:', '')), '');
        END IF;
        IF v_reason IS NULL AND COALESCE(v_user.experience, '') LIKE '%[[ACCOUNT_BLOCKED]]:%' THEN
          v_reason := NULLIF(TRIM(replace(v_user.experience, '[[ACCOUNT_BLOCKED]]:', '')), '');
        END IF;
      END IF;
    END IF;
  ELSE
    SELECT TRUE INTO v_exists
    FROM public.companies
    WHERE LOWER(TRIM(COALESCE(email, ''))) = v_clean
    LIMIT 1;
    v_exists := COALESCE(v_exists, FALSE);
  END IF;

  RETURN jsonb_build_object(
    'exists', v_exists,
    'is_blocked', v_blocked,
    'block_reason', v_reason
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.check_email_status(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_email_status(TEXT) TO anon, authenticated;

-- RPC administrativa para bloqueio por e-mail
DROP FUNCTION IF EXISTS public.block_user_by_email(TEXT);
DROP FUNCTION IF EXISTS public.block_user_by_email(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.block_user_by_email(target_email TEXT, block_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_clean TEXT;
  v_reason TEXT;
  v_bio TEXT;
BEGIN
  IF NOT public.is_oportuniza_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem bloquear contas.';
  END IF;

  v_clean := LOWER(TRIM(COALESCE(target_email, '')));
  IF v_clean = '' OR v_clean = 'oportunizahw@gmail.com' THEN
    RAISE EXCEPTION 'Não é permitido bloquear a conta do Administrador Principal.';
  END IF;

  v_reason := COALESCE(NULLIF(TRIM(COALESCE(block_reason, '')), ''), 'Violação das diretrizes da comunidade ou termos de uso');
  v_bio := '[[ACCOUNT_BLOCKED]]: ' || v_reason;

  PERFORM set_config('oportuniza.bypass_guard', 'on', TRUE);

  UPDATE public.users
  SET
    role = 'BLOQUEADO',
    cargo = 'BLOQUEADO',
    bio = v_bio,
    experience = v_bio,
    education = v_bio,
    status = 'blocked',
    is_blocked = TRUE,
    block_reason = v_reason,
    updated_at = timezone('utc'::text, now())
  WHERE LOWER(TRIM(COALESCE(email, ''))) = v_clean;

  IF NOT FOUND THEN
    INSERT INTO public.users (email, name, role, cargo, bio, experience, education, status, is_blocked, block_reason)
    VALUES (v_clean, split_part(v_clean, '@', 1), 'BLOQUEADO', 'BLOQUEADO', v_bio, v_bio, v_bio, 'blocked', TRUE, v_reason);
  END IF;

  UPDATE public.companies
  SET status = 'blocked', updated_at = timezone('utc'::text, now())
  WHERE LOWER(TRIM(COALESCE(email, ''))) = v_clean;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.block_user_by_email(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.block_user_by_email(TEXT, TEXT) TO authenticated;

-- RPC administrativa para desbloqueio por e-mail
DROP FUNCTION IF EXISTS public.unblock_user_by_email(TEXT);
DROP FUNCTION IF EXISTS public.unblock_user_by_email(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.unblock_user_by_email(target_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_clean TEXT;
BEGIN
  IF NOT public.is_oportuniza_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem desbloquear contas.';
  END IF;

  v_clean := LOWER(TRIM(COALESCE(target_email, '')));
  IF v_clean = '' THEN
    RETURN FALSE;
  END IF;

  PERFORM set_config('oportuniza.bypass_guard', 'on', TRUE);

  UPDATE public.users
  SET
    role = CASE WHEN COALESCE(account_type, 'candidate') = 'company' THEN 'Empresa' ELSE 'Candidato' END,
    cargo = CASE WHEN COALESCE(account_type, 'candidate') = 'company' THEN 'Empresa' ELSE 'Estudante' END,
    bio = '',
    experience = 'Nenhuma registrada',
    education = 'Ensino Médio em andamento',
    status = 'active',
    is_blocked = FALSE,
    block_reason = NULL,
    updated_at = timezone('utc'::text, now())
  WHERE LOWER(TRIM(COALESCE(email, ''))) = v_clean;

  UPDATE public.companies
  SET status = 'active', updated_at = timezone('utc'::text, now())
  WHERE LOWER(TRIM(COALESCE(email, ''))) = v_clean;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.unblock_user_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unblock_user_by_email(TEXT) TO authenticated;

-- =====================================================================
-- 4. RLS ESTRITO E TRIGGERS DE PROTEÇÃO EM public.users
-- =====================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura de perfis" ON public.users;
DROP POLICY IF EXISTS "Permitir leitura pública de perfis" ON public.users;
DROP POLICY IF EXISTS "Permitir leitura de perfis para usuários autenticados" ON public.users;
DROP POLICY IF EXISTS "Usuários atualizam próprio perfil" ON public.users;
DROP POLICY IF EXISTS "Permitir que usuários gerenciem seu próprio perfil" ON public.users;
DROP POLICY IF EXISTS "Permitir inserção de perfil" ON public.users;
DROP POLICY IF EXISTS "Permitir acesso a todos os usuários" ON public.users;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;

DO $$ DECLARE p RECORD; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users;', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "users_select_policy"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = id::text OR
    LOWER(TRIM(COALESCE(email, ''))) = public.current_auth_email() OR
    public.is_oportuniza_admin() OR
    public.is_oportuniza_support() OR
    (
      public.is_oportuniza_company() AND
      EXISTS (
        SELECT 1
        FROM public.applications a
        WHERE (
          a.user_id::text = public.users.id::text OR
          LOWER(TRIM(COALESCE(a.candidate_email, ''))) = LOWER(TRIM(COALESCE(public.users.email, '')))
        )
        AND public.is_company_owner(a.company, a.job_id)
      )
    )
  );

CREATE POLICY "users_insert_policy"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      auth.uid()::text = id::text AND
      LOWER(TRIM(COALESCE(email, ''))) = public.current_auth_email()
    ) OR
    public.is_oportuniza_admin()
  );

CREATE POLICY "users_update_policy"
  ON public.users FOR UPDATE
  TO authenticated
  USING (
    auth.uid()::text = id::text OR
    LOWER(TRIM(COALESCE(email, ''))) = public.current_auth_email() OR
    public.is_oportuniza_admin()
  )
  WITH CHECK (
    auth.uid()::text = id::text OR
    LOWER(TRIM(COALESCE(email, ''))) = public.current_auth_email() OR
    public.is_oportuniza_admin()
  );

CREATE POLICY "users_delete_policy"
  ON public.users FOR DELETE
  TO authenticated
  USING (
    auth.uid()::text = id::text OR
    public.is_oportuniza_admin()
  );

-- Proteção em BEFORE INSERT para impedir injeção inicial de privilégios e normalizar e-mail
CREATE OR REPLACE FUNCTION public.guard_user_insert_defaults()
RETURNS trigger AS $$
DECLARE
  v_clean_email TEXT;
  v_is_service BOOLEAN;
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := NULLIF(LOWER(TRIM(NEW.email)), '');
  END IF;

  v_clean_email := LOWER(TRIM(COALESCE(NEW.email, '')));
  v_is_service := (
    current_setting('request.jwt.claim.role', TRUE) = 'service_role' OR
    current_setting('oportuniza.bypass_guard', TRUE) = 'on' OR
    session_user IN ('postgres', 'supabase_admin', 'service_role') OR
    public.is_oportuniza_admin()
  );

  IF NOT v_is_service THEN
    NEW.is_admin := (v_clean_email = 'oportunizahw@gmail.com');
    NEW.is_blocked := FALSE;
    NEW.block_reason := NULL;

    IF LOWER(COALESCE(NEW.account_type, '')) NOT IN ('candidate', 'company') THEN
      NEW.account_type := 'candidate';
    END IF;

    IF v_clean_email = 'oportunizahw@gmail.com' THEN
      NEW.role := 'Administrador';
      NEW.cargo := 'Administrador';
      NEW.status := 'active';
    ELSIF LOWER(COALESCE(NEW.account_type, '')) = 'company' THEN
      NEW.role := 'Empresa';
      NEW.cargo := 'Empresa';
      IF LOWER(COALESCE(NEW.status, '')) NOT IN ('pending', 'active') THEN
        NEW.status := 'active';
      END IF;
    ELSE
      NEW.role := 'Candidato';
      NEW.cargo := 'Estudante';
      IF LOWER(COALESCE(NEW.status, '')) NOT IN ('pending', 'active') THEN
        NEW.status := 'active';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_users_guard_insert ON public.users;
CREATE TRIGGER on_users_guard_insert
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.guard_user_insert_defaults();

-- Proteção em BEFORE UPDATE contra auto-promoção para Admin/Atendimento/Desbloqueio
CREATE OR REPLACE FUNCTION public.guard_user_privilege_columns()
RETURNS trigger AS $$
DECLARE
  v_is_privileged BOOLEAN;
  v_is_self_activating BOOLEAN;
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := NULLIF(LOWER(TRIM(NEW.email)), '');
  END IF;

  v_is_privileged := (
    current_setting('request.jwt.claim.role', TRUE) = 'service_role' OR
    current_setting('oportuniza.bypass_guard', TRUE) = 'on' OR
    session_user IN ('postgres', 'supabase_admin', 'service_role') OR
    public.is_oportuniza_admin()
  );

  IF v_is_privileged THEN
    RETURN NEW;
  END IF;

  -- Impede que usuários comuns alterem campos administrativos ou removam bloqueios
  NEW.is_admin := OLD.is_admin;
  NEW.is_blocked := OLD.is_blocked;
  NEW.block_reason := OLD.block_reason;

  v_is_self_activating := (
    LOWER(COALESCE(OLD.status, '')) IN ('', 'pending') AND
    LOWER(COALESCE(NEW.status, '')) = 'active' AND
    COALESCE(OLD.is_blocked, FALSE) = FALSE
  );

  IF v_is_self_activating THEN
    NEW.status := 'active';
    NEW.is_2fa_enabled := COALESCE(NEW.is_2fa_enabled, OLD.is_2fa_enabled, FALSE);
    IF LOWER(COALESCE(OLD.role, '')) ~ '(atendimento|suporte|moderador)'
       OR LOWER(COALESCE(OLD.cargo, '')) ~ '(atendimento|suporte|moderador)' THEN
      NEW.account_type := COALESCE(NULLIF(OLD.account_type, ''), 'candidate');
      NEW.role := OLD.role;
      NEW.cargo := OLD.cargo;
    -- Durante ativação inicial (OAuth/OTP), permite escolher apenas 'candidate' ou 'company'
    ELSIF LOWER(COALESCE(NEW.account_type, '')) = 'company' THEN
      NEW.account_type := 'company';
      NEW.role := 'Empresa';
      NEW.cargo := 'Empresa';
    ELSE
      NEW.account_type := 'candidate';
      NEW.role := 'Candidato';
      NEW.cargo := 'Estudante';
    END IF;
  ELSE
    NEW.status := OLD.status;
    NEW.account_type := OLD.account_type;
    NEW.role := OLD.role;
    NEW.cargo := OLD.cargo;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_users_guard_privileges ON public.users;
CREATE TRIGGER on_users_guard_privileges
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.guard_user_privilege_columns();

-- Trigger de criação/vinculação automática na entrada em auth.users:
-- SEMPRE preserva e vincula contas já existentes pelo e-mail normalizado em vez de criar conta em branco!
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_clean_email TEXT;
  v_provider TEXT;
  v_is_oauth BOOLEAN;
  v_is_master BOOLEAN;
  v_is_company BOOLEAN;
  v_requires_act BOOLEAN;
  v_role TEXT;
  v_cargo TEXT;
  v_account_type TEXT;
  v_status TEXT;
  v_is_2fa BOOLEAN;
  v_meta_name TEXT;
  v_meta_avatar TEXT;
  v_meta_phone TEXT;
  v_meta_bio TEXT;
  v_meta_edu TEXT;
  v_meta_exp TEXT;
  v_meta_company_name TEXT;
  v_meta_cnpj TEXT;
  v_meta_resp_name TEXT;
  v_meta_segment TEXT;
  v_meta_neighborhood TEXT;
  v_existing public.users%ROWTYPE;
  v_existing_found BOOLEAN := FALSE;
  v_dup_row RECORD;
  v_company public.companies%ROWTYPE;
  v_company_found BOOLEAN := FALSE;
BEGIN
  PERFORM set_config('oportuniza.bypass_guard', 'on', TRUE);

  v_clean_email := LOWER(TRIM(COALESCE(new.email, '')));
  v_provider := LOWER(COALESCE(new.raw_app_meta_data->>'provider', 'email'));
  v_is_oauth := (v_provider <> '' AND v_provider <> 'email');
  v_is_master := (v_clean_email = 'oportunizahw@gmail.com');

  v_meta_name := NULLIF(TRIM(COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), '');
  v_meta_avatar := NULLIF(TRIM(COALESCE(new.raw_user_meta_data->>'avatar_url', '')), '');
  v_meta_phone := NULLIF(TRIM(COALESCE(new.raw_user_meta_data->>'phone', '')), '');
  v_meta_bio := NULLIF(TRIM(COALESCE(new.raw_user_meta_data->>'bio', '')), '');
  v_meta_edu := NULLIF(TRIM(COALESCE(new.raw_user_meta_data->>'education', '')), '');
  v_meta_exp := NULLIF(TRIM(COALESCE(new.raw_user_meta_data->>'experience', '')), '');
  v_meta_company_name := NULLIF(TRIM(COALESCE(new.raw_user_meta_data->>'company_name', '')), '');
  v_meta_cnpj := NULLIF(TRIM(COALESCE(new.raw_user_meta_data->>'cnpj', '')), '');
  v_meta_resp_name := NULLIF(TRIM(COALESCE(new.raw_user_meta_data->>'responsible_name', '')), '');
  v_meta_segment := NULLIF(TRIM(COALESCE(new.raw_user_meta_data->>'company_segment', '')), '');
  v_meta_neighborhood := NULLIF(TRIM(COALESCE(new.raw_user_meta_data->>'company_neighborhood', new.raw_user_meta_data->>'neighborhood', '')), '');

  -- Verifica se o usuário JÁ POSSUI empresa cadastrada para este e-mail
  IF v_clean_email <> '' THEN
    SELECT * INTO v_company
    FROM public.companies c
    WHERE LOWER(TRIM(COALESCE(c.email, ''))) = v_clean_email
    ORDER BY COALESCE(c.verified, FALSE) DESC, c.updated_at DESC NULLS LAST
    LIMIT 1;
    v_company_found := FOUND;

    -- Verifica se o usuário JÁ POSSUI conta em public.users (mesmo com ID antigo / legado)
    SELECT * INTO v_existing
    FROM public.users u
    WHERE LOWER(TRIM(COALESCE(u.email, ''))) = v_clean_email
       OR u.id = new.id
    ORDER BY
      (CASE WHEN COALESCE(u.is_blocked, FALSE) OR LOWER(COALESCE(u.status, '')) IN ('blocked', 'bloqueado') THEN 0 ELSE 1 END),
      (CASE WHEN COALESCE(u.is_admin, FALSE) THEN 0 ELSE 1 END),
      (CASE WHEN LOWER(COALESCE(u.status, '')) = 'active' THEN 0 ELSE 1 END),
      (CASE WHEN TRIM(COALESCE(u.phone, '')) <> '' OR TRIM(COALESCE(u.bio, '')) <> '' OR TRIM(COALESCE(u.company_name, '')) <> '' THEN 0 ELSE 1 END),
      u.updated_at DESC NULLS LAST
    LIMIT 1;
    v_existing_found := FOUND;
  END IF;

  IF v_existing_found THEN
    -- Remove/re-vincula quaisquer outras linhas conflitantes com new.id ou mesmo e-mail normalizado antes de atualizar a conta principal
    FOR v_dup_row IN
      SELECT u.id
      FROM public.users u
      WHERE u.id <> v_existing.id
        AND (
          u.id = new.id OR
          (v_clean_email <> '' AND LOWER(TRIM(COALESCE(u.email, ''))) = v_clean_email)
        )
    LOOP
      PERFORM public.relink_user_id_references(v_dup_row.id::text, new.id::text);
      DELETE FROM public.users WHERE id = v_dup_row.id;
    END LOOP;

    -- Re-vincula registros filhos caso o ID anterior da conta principal seja diferente do novo auth.users.id
    IF v_existing.id::text <> new.id::text THEN
      PERFORM public.relink_user_id_references(v_existing.id::text, new.id::text);
    END IF;

    -- Preserva integralmente os dados, status, bloqueios e cargos da conta existente!
    UPDATE public.users
    SET
      id = new.id,
      email = COALESCE(NULLIF(v_clean_email, ''), email),
      name = COALESCE(NULLIF(TRIM(COALESCE(name, '')), ''), v_meta_name, split_part(v_clean_email, '@', 1)),
      avatar_url = COALESCE(NULLIF(TRIM(COALESCE(avatar_url, '')), ''), v_meta_avatar, ''),
      phone = COALESCE(NULLIF(TRIM(COALESCE(phone, '')), ''), v_meta_phone, ''),
      bio = COALESCE(NULLIF(TRIM(COALESCE(bio, '')), ''), v_meta_bio),
      education = COALESCE(NULLIF(TRIM(COALESCE(education, '')), ''), v_meta_edu),
      experience = COALESCE(NULLIF(TRIM(COALESCE(experience, '')), ''), v_meta_exp),
      company_name = COALESCE(NULLIF(TRIM(COALESCE(company_name, '')), ''), CASE WHEN v_company_found THEN v_company.company_name ELSE v_meta_company_name END),
      cnpj = COALESCE(NULLIF(TRIM(COALESCE(cnpj, '')), ''), CASE WHEN v_company_found THEN v_company.cnpj ELSE v_meta_cnpj END),
      is_admin = (v_is_master OR COALESCE(is_admin, FALSE)),
      status = CASE
        WHEN COALESCE(is_blocked, FALSE) OR LOWER(COALESCE(status, '')) IN ('blocked', 'bloqueado') THEN status
        WHEN v_is_master OR v_company_found THEN 'active'
        WHEN LOWER(COALESCE(status, '')) = 'active' THEN 'active'
        WHEN LENGTH(REGEXP_REPLACE(COALESCE(phone, ''), '\D', '', 'g')) >= 8
          OR TRIM(COALESCE(bio, '')) <> ''
          OR TRIM(COALESCE(company_name, '')) <> ''
          OR TRIM(COALESCE(cnpj, '')) <> ''
          OR COALESCE(array_length(skills, 1), 0) > 0
          OR COALESCE(is_2fa_enabled, FALSE) = TRUE THEN 'active'
        ELSE COALESCE(NULLIF(status, ''), 'pending')
      END,
      is_2fa_enabled = COALESCE(
        is_2fa_enabled,
        CASE
          WHEN NULLIF(TRIM(COALESCE(new.raw_user_meta_data->>'is_2fa_enabled', '')), '') IS NOT NULL
            THEN LOWER(TRIM(new.raw_user_meta_data->>'is_2fa_enabled')) IN ('true', '1', 'yes', 'on')
          ELSE FALSE
        END
      ),
      updated_at = timezone('utc'::text, now())
    WHERE id = v_existing.id;

    IF v_company_found AND COALESCE(v_company.user_id::text, '') <> new.id::text THEN
      PERFORM public.assign_company_user_id(v_company.id::text, new.id::text);
    END IF;

    RETURN new;
  END IF;

  -- Conta realmente nova: verifica metadados/empresa
  v_is_company := (v_company_found OR LOWER(COALESCE(new.raw_user_meta_data->>'account_type', '')) = 'company');
  v_requires_act := CASE
    WHEN v_is_master OR v_company_found THEN FALSE
    ELSE COALESCE((new.raw_user_meta_data->>'requires_activation')::boolean, v_is_oauth)
  END;

  v_account_type := CASE WHEN v_is_company THEN 'company' ELSE 'candidate' END;
  v_role := CASE
    WHEN v_is_master THEN 'Administrador'
    WHEN v_is_company THEN 'Empresa'
    ELSE 'Candidato'
  END;
  v_cargo := CASE
    WHEN v_is_master THEN 'Administrador'
    WHEN v_is_company THEN 'Empresa'
    ELSE 'Estudante'
  END;
  v_status := CASE
    WHEN v_is_master OR v_company_found THEN 'active'
    WHEN v_requires_act THEN 'pending'
    ELSE 'active'
  END;
  v_is_2fa := CASE
    WHEN NULLIF(TRIM(COALESCE(new.raw_user_meta_data->>'is_2fa_enabled', '')), '') IS NOT NULL
      THEN LOWER(TRIM(new.raw_user_meta_data->>'is_2fa_enabled')) IN ('true', '1', 'yes', 'on')
    ELSE FALSE
  END;

  INSERT INTO public.users (
    id, email, name, avatar_url, phone, bio, education, experience,
    company_name, cnpj, responsible_name, company_segment, company_neighborhood,
    is_admin, is_2fa_enabled, account_type, role, cargo, status
  )
  VALUES (
    new.id,
    v_clean_email,
    COALESCE(CASE WHEN v_company_found THEN NULLIF(v_company.company_name, '') ELSE NULL END, v_meta_name, split_part(v_clean_email, '@', 1)),
    COALESCE(v_meta_avatar, ''),
    COALESCE(CASE WHEN v_company_found THEN NULLIF(v_company.phone, '') ELSE NULL END, v_meta_phone, ''),
    COALESCE(CASE WHEN v_company_found THEN NULLIF(v_company.bio, '') ELSE NULL END, v_meta_bio),
    v_meta_edu,
    v_meta_exp,
    COALESCE(CASE WHEN v_company_found THEN v_company.company_name ELSE NULL END, v_meta_company_name),
    COALESCE(CASE WHEN v_company_found THEN v_company.cnpj ELSE NULL END, v_meta_cnpj),
    COALESCE(CASE WHEN v_company_found THEN v_company.responsible_name ELSE NULL END, v_meta_resp_name),
    COALESCE(CASE WHEN v_company_found THEN v_company.segment ELSE NULL END, v_meta_segment),
    COALESCE(CASE WHEN v_company_found THEN v_company.neighborhood ELSE NULL END, v_meta_neighborhood),
    v_is_master,
    v_is_2fa,
    v_account_type,
    v_role,
    v_cargo,
    v_status
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(NULLIF(EXCLUDED.email, ''), public.users.email),
    name = COALESCE(NULLIF(TRIM(COALESCE(public.users.name, '')), ''), EXCLUDED.name),
    avatar_url = COALESCE(NULLIF(TRIM(COALESCE(public.users.avatar_url, '')), ''), EXCLUDED.avatar_url),
    phone = COALESCE(NULLIF(TRIM(COALESCE(public.users.phone, '')), ''), EXCLUDED.phone),
    is_admin = (v_is_master OR COALESCE(public.users.is_admin, FALSE)),
    updated_at = timezone('utc'::text, now());

  IF v_company_found THEN
    PERFORM public.assign_company_user_id(v_company.id::text, new.id::text);
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =====================================================================
-- 5. RLS BLINDADO PARA VAGAS (public.jobs)
-- =====================================================================
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura pública de vagas" ON public.jobs;
DROP POLICY IF EXISTS "Gerenciamento de vagas" ON public.jobs;
DROP POLICY IF EXISTS "Administradores gerenciam vagas" ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_public" ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_all" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_policy" ON public.jobs;

DO $$ DECLARE p RECORD; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'jobs' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.jobs;', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "jobs_select_public"
  ON public.jobs FOR SELECT
  USING (TRUE);

CREATE POLICY "jobs_insert_policy"
  ON public.jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_oportuniza_admin() OR
    public.is_oportuniza_support() OR
    (public.is_oportuniza_company() AND public.is_company_owner(company, NULL))
  );

CREATE POLICY "jobs_update_policy"
  ON public.jobs FOR UPDATE
  TO authenticated
  USING (
    public.is_oportuniza_admin() OR
    public.is_oportuniza_support() OR
    (public.is_oportuniza_company() AND public.is_company_owner(company, id))
  )
  WITH CHECK (
    public.is_oportuniza_admin() OR
    public.is_oportuniza_support() OR
    (public.is_oportuniza_company() AND public.is_company_owner(company, id))
  );

CREATE POLICY "jobs_delete_policy"
  ON public.jobs FOR DELETE
  TO authenticated
  USING (
    public.is_oportuniza_admin() OR
    (public.is_oportuniza_company() AND public.is_company_owner(company, id))
  );

-- =====================================================================
-- 6. RLS BLINDADO PARA CURSOS (public.courses)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  duration TEXT,
  instructor TEXT,
  rating NUMERIC(3, 2) DEFAULT 5.0,
  level TEXT,
  logo TEXT,
  cover_image TEXT,
  lessons JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura pública de cursos" ON public.courses;
DROP POLICY IF EXISTS "Gerenciamento de cursos" ON public.courses;
DROP POLICY IF EXISTS "Administradores gerenciam cursos" ON public.courses;
DROP POLICY IF EXISTS "courses_select_public" ON public.courses;
DROP POLICY IF EXISTS "courses_admin_all" ON public.courses;

DO $$ DECLARE p RECORD; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'courses' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.courses;', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "courses_select_public"
  ON public.courses FOR SELECT
  USING (TRUE);

CREATE POLICY "courses_admin_all"
  ON public.courses FOR ALL
  TO authenticated
  USING (public.is_oportuniza_admin())
  WITH CHECK (public.is_oportuniza_admin());

-- =====================================================================
-- 7. RLS BLINDADO PARA CANDIDATURAS (public.applications)
-- =====================================================================
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Visualizar próprias candidaturas" ON public.applications;
DROP POLICY IF EXISTS "Criar candidaturas próprias" ON public.applications;
DROP POLICY IF EXISTS "Excluir candidaturas próprias" ON public.applications;
DROP POLICY IF EXISTS "Administradores gerenciam todas candidaturas" ON public.applications;
DROP POLICY IF EXISTS "Acesso às candidaturas" ON public.applications;
DROP POLICY IF EXISTS "apps_select_owner_or_admin" ON public.applications;
DROP POLICY IF EXISTS "apps_insert_owner" ON public.applications;
DROP POLICY IF EXISTS "apps_update_owner_or_admin" ON public.applications;
DROP POLICY IF EXISTS "apps_delete_owner_or_admin" ON public.applications;

DO $$ DECLARE p RECORD; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'applications' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.applications;', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "apps_select_owner_or_admin"
  ON public.applications FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = user_id::text OR
    LOWER(TRIM(COALESCE(candidate_email, ''))) = public.current_auth_email() OR
    public.is_oportuniza_admin() OR
    public.is_oportuniza_support() OR
    (public.is_oportuniza_company() AND public.is_company_owner(company, job_id))
  );

-- Usuário autenticado só pode criar candidatura para o próprio user_id
CREATE POLICY "apps_insert_owner"
  ON public.applications FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid()::text = user_id::text OR
    public.is_oportuniza_admin()
  );

CREATE POLICY "apps_update_owner_or_admin"
  ON public.applications FOR UPDATE
  TO authenticated
  USING (
    auth.uid()::text = user_id::text OR
    public.is_oportuniza_admin() OR
    (public.is_oportuniza_company() AND public.is_company_owner(company, job_id))
  )
  WITH CHECK (
    auth.uid()::text = user_id::text OR
    public.is_oportuniza_admin() OR
    (public.is_oportuniza_company() AND public.is_company_owner(company, job_id))
  );

CREATE POLICY "apps_delete_owner_or_admin"
  ON public.applications FOR DELETE
  TO authenticated
  USING (
    auth.uid()::text = user_id::text OR
    public.is_oportuniza_admin()
  );

-- =====================================================================
-- 8. RLS BLINDADO PARA INSCRIÇÕES EM CURSOS (public.enrollments)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.enrollments (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT,
  course_id TEXT NOT NULL,
  course_title TEXT,
  instructor TEXT,
  enrolled_date TEXT,
  status TEXT DEFAULT 'Iniciado',
  progress INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS course_id TEXT;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS course_title TEXT;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS instructor TEXT;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS enrolled_date TEXT;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Iniciado';
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_course_id_fkey;

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Visualizar próprias inscrições" ON public.enrollments;
DROP POLICY IF EXISTS "Criar próprias inscrições" ON public.enrollments;
DROP POLICY IF EXISTS "Atualizar próprias inscrições" ON public.enrollments;
DROP POLICY IF EXISTS "Administradores gerenciam inscrições" ON public.enrollments;
DROP POLICY IF EXISTS "Acesso às inscrições" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_select_policy" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_insert_policy" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_update_policy" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_delete_policy" ON public.enrollments;

DO $$ DECLARE p RECORD; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'enrollments' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.enrollments;', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "enrollments_select_policy"
  ON public.enrollments FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = user_id::text OR
    public.is_oportuniza_admin() OR
    public.is_oportuniza_support()
  );

CREATE POLICY "enrollments_insert_policy"
  ON public.enrollments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid()::text = user_id::text OR
    public.is_oportuniza_admin()
  );

CREATE POLICY "enrollments_update_policy"
  ON public.enrollments FOR UPDATE
  TO authenticated
  USING (
    auth.uid()::text = user_id::text OR
    public.is_oportuniza_admin()
  )
  WITH CHECK (
    auth.uid()::text = user_id::text OR
    public.is_oportuniza_admin()
  );

CREATE POLICY "enrollments_delete_policy"
  ON public.enrollments FOR DELETE
  TO authenticated
  USING (
    auth.uid()::text = user_id::text OR
    public.is_oportuniza_admin()
  );

-- =====================================================================
-- 9. RLS BLINDADO PARA PROGRESSO DE CURSOS (public.user_course_progress)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.user_course_progress (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  user_name TEXT,
  course_title TEXT,
  completed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.user_course_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Visualizar próprio progresso" ON public.user_course_progress;
DROP POLICY IF EXISTS "Registrar progresso próprio" ON public.user_course_progress;
DROP POLICY IF EXISTS "Administração visualiza progresso" ON public.user_course_progress;
DROP POLICY IF EXISTS "Acesso ao progresso" ON public.user_course_progress;
DROP POLICY IF EXISTS "progress_select_policy" ON public.user_course_progress;
DROP POLICY IF EXISTS "progress_insert_policy" ON public.user_course_progress;

DO $$ DECLARE p RECORD; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_course_progress' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_course_progress;', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "progress_select_policy"
  ON public.user_course_progress FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = user_id::text OR
    public.is_oportuniza_admin() OR
    public.is_oportuniza_support()
  );

CREATE POLICY "progress_insert_policy"
  ON public.user_course_progress FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid()::text = user_id::text OR
    public.is_oportuniza_admin()
  );

-- =====================================================================
-- 10. RLS BLINDADO PARA PEDIDOS E PLANOS (public.orders)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  customer_document TEXT,
  order_type TEXT NOT NULL,
  item_title TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  payment_method TEXT DEFAULT 'pix',
  status TEXT DEFAULT 'approved',
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all public for orders" ON public.orders;
DROP POLICY IF EXISTS "Acesso a pedidos" ON public.orders;
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_checkout" ON public.orders;
DROP POLICY IF EXISTS "orders_admin_modify" ON public.orders;
DROP POLICY IF EXISTS "orders_admin_update" ON public.orders;
DROP POLICY IF EXISTS "orders_admin_delete" ON public.orders;

DO $$ DECLARE p RECORD; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders;', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "orders_select_policy"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    LOWER(TRIM(COALESCE(customer_email, ''))) = public.current_auth_email() OR
    public.is_oportuniza_admin()
  );

CREATE POLICY "orders_insert_checkout"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (
    LOWER(TRIM(COALESCE(customer_email, ''))) = public.current_auth_email() OR
    public.is_oportuniza_admin()
  );

CREATE POLICY "orders_admin_update"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.is_oportuniza_admin())
  WITH CHECK (public.is_oportuniza_admin());

CREATE POLICY "orders_admin_delete"
  ON public.orders FOR DELETE
  TO authenticated
  USING (public.is_oportuniza_admin());

-- =====================================================================
-- 11. RLS BLINDADO PARA EMPRESAS (public.companies)
-- =====================================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura publica de empresas" ON public.companies;
DROP POLICY IF EXISTS "Permitir cadastro de empresas" ON public.companies;
DROP POLICY IF EXISTS "Permitir atualizacao de empresas" ON public.companies;
DROP POLICY IF EXISTS "Permitir exclusao de empresas" ON public.companies;
DROP POLICY IF EXISTS "companies_select_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_insert_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_update_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_delete_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_all_admin" ON public.companies;

DO $$ DECLARE p RECORD; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'companies' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.companies;', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "companies_select_policy"
  ON public.companies FOR SELECT
  TO authenticated
  USING (
    LOWER(TRIM(COALESCE(email, ''))) = public.current_auth_email() OR
    COALESCE(user_id::text, '') = COALESCE(auth.uid()::text, '') OR
    public.is_oportuniza_admin() OR
    public.is_oportuniza_support()
  );

CREATE POLICY "companies_insert_policy"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      LOWER(TRIM(COALESCE(email, ''))) = public.current_auth_email() AND
      (user_id IS NULL OR user_id::text = COALESCE(auth.uid()::text, ''))
    ) OR
    public.is_oportuniza_admin()
  );

CREATE POLICY "companies_update_policy"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (
    LOWER(TRIM(COALESCE(email, ''))) = public.current_auth_email() OR
    COALESCE(user_id::text, '') = COALESCE(auth.uid()::text, '') OR
    public.is_oportuniza_admin() OR
    public.is_oportuniza_support()
  )
  WITH CHECK (
    LOWER(TRIM(COALESCE(email, ''))) = public.current_auth_email() OR
    COALESCE(user_id::text, '') = COALESCE(auth.uid()::text, '') OR
    public.is_oportuniza_admin() OR
    public.is_oportuniza_support()
  );

CREATE POLICY "companies_delete_policy"
  ON public.companies FOR DELETE
  TO authenticated
  USING (public.is_oportuniza_admin());

-- Impede auto-verificação/auto-desbloqueio e normaliza e-mail em public.companies
CREATE OR REPLACE FUNCTION public.guard_company_verification()
RETURNS trigger AS $$
DECLARE
  v_privileged BOOLEAN;
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := LOWER(TRIM(NEW.email));
  END IF;

  v_privileged := (
    current_setting('request.jwt.claim.role', TRUE) = 'service_role' OR
    current_setting('oportuniza.bypass_guard', TRUE) = 'on' OR
    session_user IN ('postgres', 'supabase_admin', 'service_role') OR
    public.is_oportuniza_admin() OR
    public.is_oportuniza_support()
  );

  IF v_privileged THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.verified := FALSE;
    IF LOWER(COALESCE(NEW.status, '')) NOT IN ('active', 'pending') THEN
      NEW.status := 'active';
    END IF;
  ELSE
    NEW.verified := COALESCE(OLD.verified, FALSE);
    IF LOWER(COALESCE(OLD.status, '')) = 'blocked' THEN
      NEW.status := 'blocked';
    ELSIF LOWER(COALESCE(NEW.status, '')) = 'verified' THEN
      NEW.status := OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_companies_guard_verified ON public.companies;
CREATE TRIGGER on_companies_guard_verified
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE PROCEDURE public.guard_company_verification();

-- =====================================================================
-- 12. RLS BLINDADO PARA ATENDIMENTO / CHAMADOS (support_tickets & support_messages)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ticket_number TEXT,
  user_id TEXT,
  user_name TEXT,
  user_email TEXT,
  user_phone TEXT,
  user_role TEXT DEFAULT 'Candidato',
  subject TEXT NOT NULL,
  category TEXT DEFAULT 'Geral',
  priority TEXT DEFAULT 'Média',
  status TEXT DEFAULT 'Pendente',
  assigned_to TEXT,
  last_message TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT 'Candidato';
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS last_message TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS assigned_to TEXT;

DO $$ BEGIN
  ALTER TABLE public.support_tickets ALTER COLUMN ticket_number DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets_all" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_select_policy" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_insert_policy" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_update_policy" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_delete_policy" ON public.support_tickets;

DO $$ DECLARE p RECORD; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_tickets' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.support_tickets;', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "support_tickets_select_policy"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (
    COALESCE(user_id::text, '') = COALESCE(auth.uid()::text, '') OR
    LOWER(TRIM(COALESCE(user_email, ''))) = public.current_auth_email() OR
    public.is_oportuniza_admin() OR
    public.is_oportuniza_support()
  );

CREATE POLICY "support_tickets_insert_policy"
  ON public.support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE(user_id::text, '') = COALESCE(auth.uid()::text, '') OR
    LOWER(TRIM(COALESCE(user_email, ''))) = public.current_auth_email() OR
    public.is_oportuniza_admin() OR
    public.is_oportuniza_support()
  );

CREATE POLICY "support_tickets_update_policy"
  ON public.support_tickets FOR UPDATE
  TO authenticated
  USING (
    COALESCE(user_id::text, '') = COALESCE(auth.uid()::text, '') OR
    LOWER(TRIM(COALESCE(user_email, ''))) = public.current_auth_email() OR
    public.is_oportuniza_admin() OR
    public.is_oportuniza_support()
  )
  WITH CHECK (
    COALESCE(user_id::text, '') = COALESCE(auth.uid()::text, '') OR
    LOWER(TRIM(COALESCE(user_email, ''))) = public.current_auth_email() OR
    public.is_oportuniza_admin() OR
    public.is_oportuniza_support()
  );

CREATE POLICY "support_tickets_delete_policy"
  ON public.support_tickets FOR DELETE
  TO authenticated
  USING (
    public.is_oportuniza_admin() OR
    public.is_oportuniza_support()
  );


CREATE TABLE IF NOT EXISTS public.support_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ticket_id TEXT NOT NULL,
  sender_id TEXT,
  sender_type TEXT DEFAULT 'user',
  sender_name TEXT,
  sender_email TEXT,
  sender_role TEXT DEFAULT 'user',
  content TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS sender_type TEXT DEFAULT 'user';
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS sender_email TEXT;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS content TEXT;

DO $$ BEGIN
  ALTER TABLE public.support_messages ALTER COLUMN message DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_messages_all" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_select_policy" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_insert_policy" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_update_policy" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_delete_policy" ON public.support_messages;

DO $$ DECLARE p RECORD; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_messages' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.support_messages;', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "support_messages_select_policy"
  ON public.support_messages FOR SELECT
  TO authenticated
  USING (
    public.is_oportuniza_admin() OR
    public.is_oportuniza_support() OR
    EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id::text = public.support_messages.ticket_id::text
      AND (
        COALESCE(t.user_id::text, '') = COALESCE(auth.uid()::text, '') OR
        LOWER(TRIM(COALESCE(t.user_email, ''))) = public.current_auth_email()
      )
    )
  );

CREATE POLICY "support_messages_insert_policy"
  ON public.support_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_oportuniza_admin() OR
    public.is_oportuniza_support() OR
    (
      LOWER(COALESCE(sender_type, 'user')) <> 'agent' AND
      EXISTS (
        SELECT 1
        FROM public.support_tickets t
        WHERE t.id::text = public.support_messages.ticket_id::text
        AND (
          COALESCE(t.user_id::text, '') = COALESCE(auth.uid()::text, '') OR
          LOWER(TRIM(COALESCE(t.user_email, ''))) = public.current_auth_email()
        )
      )
    )
  );

CREATE POLICY "support_messages_update_policy"
  ON public.support_messages FOR UPDATE
  TO authenticated
  USING (public.is_oportuniza_admin() OR public.is_oportuniza_support())
  WITH CHECK (public.is_oportuniza_admin() OR public.is_oportuniza_support());

CREATE POLICY "support_messages_delete_policy"
  ON public.support_messages FOR DELETE
  TO authenticated
  USING (public.is_oportuniza_admin() OR public.is_oportuniza_support());

-- =====================================================================
-- 13. RLS BLINDADO PARA LOGS DE AUDITORIA (public.audit_logs)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT,
  actor_email TEXT,
  actor_name TEXT,
  actor_role TEXT DEFAULT 'Sistema',
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  target_name TEXT,
  status TEXT DEFAULT 'authorized',
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_role TEXT DEFAULT 'Sistema';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_name TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'authorized';

DO $$ BEGIN
  ALTER TABLE public.audit_logs ALTER COLUMN details DROP DEFAULT;
  ALTER TABLE public.audit_logs ALTER COLUMN details TYPE TEXT USING details::text;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_all" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_update_admin" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete_admin" ON public.audit_logs;

DO $$ DECLARE p RECORD; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_logs' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.audit_logs;', p.policyname);
  END LOOP;
END $$;

-- Somente Administrador e Equipe de Atendimento podem ler a trilha de auditoria (inclui IPs/detalhes)
CREATE POLICY "audit_logs_select_admin"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    public.is_oportuniza_admin() OR
    public.is_oportuniza_support()
  );

-- Permite registrar eventos de auditoria e anti-fraude (append-only, sem leitura para não-admins)
CREATE POLICY "audit_logs_insert_policy"
  ON public.audit_logs FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    action IS NOT NULL AND
    length(trim(action)) BETWEEN 2 AND 200
  );

-- Logs de auditoria não podem ser apagados ou alterados por usuários comuns
CREATE POLICY "audit_logs_delete_admin"
  ON public.audit_logs FOR DELETE
  TO authenticated
  USING (public.is_oportuniza_admin());

-- =====================================================================
-- 14. DEDUPLICAÇÃO, NORMALIZAÇÃO DE E-MAILS & RPCs DE RECUPERAÇÃO DE PERFIL
-- =====================================================================
DO $$
DECLARE
  v_grp RECORD;
  v_loser RECORD;
  v_winner public.users%ROWTYPE;
  v_comp_grp RECORD;
  v_comp_loser RECORD;
  v_comp_winner public.companies%ROWTYPE;
  v_best_company_uid TEXT;
  v_comp_sync RECORD;
  v_auth RECORD;
  v_existing public.users%ROWTYPE;
BEGIN
  PERFORM set_config('oportuniza.bypass_guard', 'on', TRUE);

  -- 14.1 Mescla contas duplicadas em public.users (mesmo e-mail com caixa/espaços diferentes)
  FOR v_grp IN
    SELECT LOWER(TRIM(COALESCE(email, ''))) AS clean_email
    FROM public.users
    WHERE TRIM(COALESCE(email, '')) <> ''
    GROUP BY LOWER(TRIM(COALESCE(email, '')))
    HAVING COUNT(*) > 1
  LOOP
    SELECT * INTO v_winner
    FROM public.users u
    WHERE LOWER(TRIM(COALESCE(u.email, ''))) = v_grp.clean_email
    ORDER BY
      (CASE WHEN COALESCE(u.is_blocked, FALSE) OR LOWER(COALESCE(u.status, '')) IN ('blocked', 'bloqueado') THEN 0 ELSE 1 END),
      (CASE WHEN COALESCE(u.is_admin, FALSE) THEN 0 ELSE 1 END),
      (CASE WHEN LOWER(COALESCE(u.status, '')) = 'active' THEN 0 ELSE 1 END),
      (
        (CASE WHEN LENGTH(REGEXP_REPLACE(COALESCE(u.phone, ''), '\D', '', 'g')) >= 8 THEN 1 ELSE 0 END) +
        (CASE WHEN TRIM(COALESCE(u.bio, '')) <> '' THEN 1 ELSE 0 END) +
        (CASE WHEN TRIM(COALESCE(u.company_name, '')) <> '' THEN 1 ELSE 0 END) +
        (CASE WHEN TRIM(COALESCE(u.cnpj, '')) <> '' THEN 1 ELSE 0 END) +
        (CASE WHEN TRIM(COALESCE(u.password, '')) <> '' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(u.is_2fa_enabled, FALSE) THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(array_length(u.skills, 1), 0) > 0 THEN 1 ELSE 0 END)
      ) DESC,
      (CASE WHEN EXISTS (SELECT 1 FROM auth.users au WHERE au.id::text = u.id::text) THEN 0 ELSE 1 END),
      u.updated_at DESC NULLS LAST,
      u.created_at ASC NULLS LAST
    LIMIT 1;

    FOR v_loser IN
      SELECT *
      FROM public.users u
      WHERE LOWER(TRIM(COALESCE(u.email, ''))) = v_grp.clean_email
        AND u.id <> v_winner.id
    LOOP
      PERFORM public.relink_user_id_references(v_loser.id::text, v_winner.id::text);

      UPDATE public.users
      SET
        name = COALESCE(NULLIF(TRIM(COALESCE(name, '')), ''), NULLIF(TRIM(COALESCE(v_loser.name, '')), '')),
        avatar_url = COALESCE(NULLIF(TRIM(COALESCE(avatar_url, '')), ''), NULLIF(TRIM(COALESCE(v_loser.avatar_url, '')), '')),
        phone = COALESCE(NULLIF(TRIM(COALESCE(phone, '')), ''), NULLIF(TRIM(COALESCE(v_loser.phone, '')), '')),
        bio = COALESCE(NULLIF(TRIM(COALESCE(bio, '')), ''), NULLIF(TRIM(COALESCE(v_loser.bio, '')), '')),
        education = COALESCE(NULLIF(TRIM(COALESCE(education, '')), ''), NULLIF(TRIM(COALESCE(v_loser.education, '')), '')),
        experience = COALESCE(NULLIF(TRIM(COALESCE(experience, '')), ''), NULLIF(TRIM(COALESCE(v_loser.experience, '')), '')),
        company_name = COALESCE(NULLIF(TRIM(COALESCE(company_name, '')), ''), NULLIF(TRIM(COALESCE(v_loser.company_name, '')), '')),
        cnpj = COALESCE(NULLIF(TRIM(COALESCE(cnpj, '')), ''), NULLIF(TRIM(COALESCE(v_loser.cnpj, '')), '')),
        responsible_name = COALESCE(NULLIF(TRIM(COALESCE(responsible_name, '')), ''), NULLIF(TRIM(COALESCE(v_loser.responsible_name, '')), '')),
        company_segment = COALESCE(NULLIF(TRIM(COALESCE(company_segment, '')), ''), NULLIF(TRIM(COALESCE(v_loser.company_segment, '')), '')),
        company_neighborhood = COALESCE(NULLIF(TRIM(COALESCE(company_neighborhood, '')), ''), NULLIF(TRIM(COALESCE(v_loser.company_neighborhood, '')), '')),
        company_address = COALESCE(NULLIF(TRIM(COALESCE(company_address, '')), ''), NULLIF(TRIM(COALESCE(v_loser.company_address, '')), '')),
        company_logo_url = COALESCE(NULLIF(TRIM(COALESCE(company_logo_url, '')), ''), NULLIF(TRIM(COALESCE(v_loser.company_logo_url, '')), '')),
        password = COALESCE(NULLIF(TRIM(COALESCE(password, '')), ''), NULLIF(TRIM(COALESCE(v_loser.password, '')), '')),
        skills = CASE WHEN COALESCE(array_length(skills, 1), 0) > 0 THEN skills ELSE COALESCE(v_loser.skills, '{}') END,
        favorites = CASE WHEN COALESCE(array_length(favorites, 1), 0) > 0 THEN favorites ELSE COALESCE(v_loser.favorites, '{}') END,
        is_admin = (COALESCE(is_admin, FALSE) OR COALESCE(v_loser.is_admin, FALSE)),
        is_2fa_enabled = COALESCE(is_2fa_enabled, v_loser.is_2fa_enabled, FALSE),
        status = CASE
          WHEN COALESCE(is_blocked, FALSE) OR LOWER(COALESCE(status, '')) IN ('blocked', 'bloqueado') THEN status
          WHEN LOWER(COALESCE(status, '')) = 'active' OR LOWER(COALESCE(v_loser.status, '')) = 'active' THEN 'active'
          ELSE status
        END,
        updated_at = timezone('utc'::text, now())
      WHERE id = v_winner.id;

      DELETE FROM public.users WHERE id = v_loser.id;
    END LOOP;
  END LOOP;

  -- Normaliza todos os e-mails em public.users
  UPDATE public.users
  SET email = LOWER(TRIM(email))
  WHERE email IS NOT NULL AND email <> LOWER(TRIM(email));

  -- 14.2 Mescla empresas duplicadas em public.companies
  FOR v_comp_grp IN
    SELECT LOWER(TRIM(COALESCE(email, ''))) AS clean_email
    FROM public.companies
    WHERE TRIM(COALESCE(email, '')) <> ''
    GROUP BY LOWER(TRIM(COALESCE(email, '')))
    HAVING COUNT(*) > 1
  LOOP
    SELECT * INTO v_comp_winner
    FROM public.companies c
    WHERE LOWER(TRIM(COALESCE(c.email, ''))) = v_comp_grp.clean_email
    ORDER BY
      (CASE WHEN LOWER(COALESCE(c.status, '')) = 'blocked' THEN 0 ELSE 1 END),
      COALESCE(c.verified, FALSE) DESC,
      c.updated_at DESC NULLS LAST,
      c.created_at ASC NULLS LAST
    LIMIT 1;

    FOR v_comp_loser IN
      SELECT *
      FROM public.companies c
      WHERE LOWER(TRIM(COALESCE(c.email, ''))) = v_comp_grp.clean_email
        AND c.id <> v_comp_winner.id
    LOOP
      v_best_company_uid := COALESCE(
        NULLIF(TRIM(COALESCE(v_comp_winner.user_id::text, '')), ''),
        NULLIF(TRIM(COALESCE(v_comp_loser.user_id::text, '')), '')
      );

      UPDATE public.companies
      SET
        cnpj = COALESCE(NULLIF(TRIM(COALESCE(cnpj, '')), ''), NULLIF(TRIM(COALESCE(v_comp_loser.cnpj, '')), '')),
        phone = COALESCE(NULLIF(TRIM(COALESCE(phone, '')), ''), NULLIF(TRIM(COALESCE(v_comp_loser.phone, '')), '')),
        address = COALESCE(NULLIF(TRIM(COALESCE(address, '')), ''), NULLIF(TRIM(COALESCE(v_comp_loser.address, '')), '')),
        bio = COALESCE(NULLIF(TRIM(COALESCE(bio, '')), ''), NULLIF(TRIM(COALESCE(v_comp_loser.bio, '')), '')),
        logo_url = COALESCE(NULLIF(TRIM(COALESCE(logo_url, '')), ''), NULLIF(TRIM(COALESCE(v_comp_loser.logo_url, '')), '')),
        verified = (COALESCE(verified, FALSE) OR COALESCE(v_comp_loser.verified, FALSE))
      WHERE id = v_comp_winner.id;

      IF v_best_company_uid IS NOT NULL AND COALESCE(v_comp_winner.user_id::text, '') <> v_best_company_uid THEN
        PERFORM public.assign_company_user_id(v_comp_winner.id::text, v_best_company_uid);
        SELECT * INTO v_comp_winner FROM public.companies WHERE id = v_comp_winner.id LIMIT 1;
      END IF;

      DELETE FROM public.companies WHERE id = v_comp_loser.id;
    END LOOP;
  END LOOP;

  UPDATE public.companies
  SET email = LOWER(TRIM(email))
  WHERE email IS NOT NULL AND email <> LOWER(TRIM(email));

  -- 14.3 Sincroniza IDs legados entre auth.users e public.users quando houver divergência de UUID para o mesmo e-mail
  FOR v_auth IN
    SELECT DISTINCT ON (LOWER(TRIM(COALESCE(au.email, ''))))
      au.id AS auth_id,
      LOWER(TRIM(COALESCE(au.email, ''))) AS clean_email
    FROM auth.users au
    WHERE TRIM(COALESCE(au.email, '')) <> ''
    ORDER BY LOWER(TRIM(COALESCE(au.email, ''))), au.last_sign_in_at DESC NULLS LAST, au.created_at DESC
  LOOP
    SELECT * INTO v_existing
    FROM public.users u
    WHERE LOWER(TRIM(COALESCE(u.email, ''))) = v_auth.clean_email
    LIMIT 1;

    IF FOUND AND v_existing.id::text <> v_auth.auth_id::text AND NOT EXISTS (SELECT 1 FROM public.users u2 WHERE u2.id::text = v_auth.auth_id::text) THEN
      PERFORM public.relink_user_id_references(v_existing.id::text, v_auth.auth_id::text);
      UPDATE public.users SET id = v_auth.auth_id WHERE id = v_existing.id;
    END IF;
  END LOOP;

  -- Sincroniza user_id na tabela companies respeitando tipagem UUID ou TEXT
  FOR v_comp_sync IN
    SELECT DISTINCT ON (c.id)
      c.id::text AS company_id,
      u.id::text AS target_uid
    FROM public.companies c
    JOIN public.users u
      ON LOWER(TRIM(COALESCE(c.email, ''))) = LOWER(TRIM(COALESCE(u.email, '')))
    WHERE COALESCE(c.user_id::text, '') <> u.id::text
    ORDER BY c.id, u.updated_at DESC NULLS LAST
  LOOP
    PERFORM public.assign_company_user_id(v_comp_sync.company_id, v_comp_sync.target_uid);
  END LOOP;

  -- 14.4 Garante status 'active' para contas existentes já preenchidas/ativas (preserva a escolha de 2FA do titular)
  UPDATE public.users u
  SET
    status = 'active',
    updated_at = timezone('utc'::text, now())
  WHERE COALESCE(u.is_blocked, FALSE) = FALSE
    AND LOWER(COALESCE(u.status, '')) NOT IN ('blocked', 'bloqueado', 'active')
    AND (
      COALESCE(u.is_admin, FALSE) = TRUE OR
      LOWER(TRIM(COALESCE(u.email, ''))) = 'oportunizahw@gmail.com' OR
      LENGTH(REGEXP_REPLACE(COALESCE(u.phone, ''), '\D', '', 'g')) >= 8 OR
      TRIM(COALESCE(u.bio, '')) <> '' OR
      TRIM(COALESCE(u.company_name, '')) <> '' OR
      TRIM(COALESCE(u.cnpj, '')) <> '' OR
      TRIM(COALESCE(u.password, '')) <> '' OR
      COALESCE(array_length(u.skills, 1), 0) > 0 OR
      EXISTS (SELECT 1 FROM public.companies c WHERE LOWER(TRIM(COALESCE(c.email, ''))) = LOWER(TRIM(COALESCE(u.email, ''))) OR COALESCE(c.user_id::text, '') = u.id::text) OR
      EXISTS (SELECT 1 FROM public.applications a WHERE a.user_id::text = u.id::text OR LOWER(TRIM(COALESCE(a.candidate_email, ''))) = LOWER(TRIM(COALESCE(u.email, '')))) OR
      EXISTS (SELECT 1 FROM public.enrollments e WHERE e.user_id::text = u.id::text) OR
      EXISTS (SELECT 1 FROM public.user_course_progress p WHERE p.user_id::text = u.id::text)
    );
END $$;

-- Índices únicos após deduplicação (mantém upsert por 'email' e blinda case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON public.users (email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_unique
  ON public.users (LOWER(TRIM(email)))
  WHERE email IS NOT NULL AND TRIM(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_email_unique ON public.companies (email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_email_lower_unique
  ON public.companies (LOWER(TRIM(email)))
  WHERE email IS NOT NULL AND TRIM(email) <> '';

-- RPC segura para buscar e auto-sincronizar a conta existente do usuário autenticado (resolve ID legado e evita falso-novo após 2FA)
CREATE OR REPLACE FUNCTION public.get_my_profile_bundle()
RETURNS JSONB AS $$
DECLARE
  v_auth_uid UUID;
  v_uid TEXT;
  v_email TEXT;
  v_winner public.users%ROWTYPE;
  v_winner_found BOOLEAN := FALSE;
  v_dup RECORD;
  v_company public.companies%ROWTYPE;
  v_company_found BOOLEAN := FALSE;
  v_has_activity BOOLEAN := FALSE;
  v_has_password BOOLEAN := FALSE;
  v_has_populated BOOLEAN := FALSE;
BEGIN
  v_auth_uid := auth.uid();
  v_uid := COALESCE(v_auth_uid::text, '');
  v_email := public.current_auth_email();

  IF v_uid = '' AND v_email = '' THEN
    RETURN jsonb_build_object(
      'found', FALSE,
      'user', NULL,
      'company', NULL,
      'has_activity', FALSE,
      'has_password', FALSE
    );
  END IF;

  PERFORM set_config('oportuniza.bypass_guard', 'on', TRUE);

  -- Seleciona a melhor conta correspondente por UID ou E-mail normalizado
  SELECT * INTO v_winner
  FROM public.users u
  WHERE (v_uid <> '' AND u.id::text = v_uid)
     OR (v_email <> '' AND LOWER(TRIM(COALESCE(u.email, ''))) = v_email)
  ORDER BY
    (CASE WHEN COALESCE(u.is_blocked, FALSE) OR LOWER(COALESCE(u.status, '')) IN ('blocked', 'bloqueado') THEN 0 ELSE 1 END),
    (CASE WHEN COALESCE(u.is_admin, FALSE) THEN 0 ELSE 1 END),
    (CASE WHEN LOWER(COALESCE(u.status, '')) = 'active' THEN 0 ELSE 1 END),
    (
      (CASE WHEN LENGTH(REGEXP_REPLACE(COALESCE(u.phone, ''), '\D', '', 'g')) >= 8 THEN 1 ELSE 0 END) +
      (CASE WHEN TRIM(COALESCE(u.bio, '')) <> '' THEN 1 ELSE 0 END) +
      (CASE WHEN TRIM(COALESCE(u.company_name, '')) <> '' THEN 1 ELSE 0 END) +
      (CASE WHEN TRIM(COALESCE(u.cnpj, '')) <> '' THEN 1 ELSE 0 END) +
      (CASE WHEN TRIM(COALESCE(u.password, '')) <> '' THEN 1 ELSE 0 END) +
      (CASE WHEN COALESCE(u.is_2fa_enabled, FALSE) THEN 1 ELSE 0 END) +
      (CASE WHEN COALESCE(array_length(u.skills, 1), 0) > 0 THEN 1 ELSE 0 END)
    ) DESC,
    (CASE WHEN v_uid <> '' AND u.id::text = v_uid THEN 0 ELSE 1 END),
    u.updated_at DESC NULLS LAST
  LIMIT 1;
  v_winner_found := FOUND;

  -- Caso haja linha duplicada/órfã para o mesmo usuário, mescla e re-vincula tudo ao auth.uid()
  IF v_winner_found THEN
    FOR v_dup IN
      SELECT *
      FROM public.users u
      WHERE u.id <> v_winner.id
        AND (
          (v_uid <> '' AND u.id::text = v_uid) OR
          (v_email <> '' AND LOWER(TRIM(COALESCE(u.email, ''))) = v_email)
        )
    LOOP
      PERFORM public.relink_user_id_references(v_dup.id::text, COALESCE(NULLIF(v_uid, ''), v_winner.id::text));

      UPDATE public.users
      SET
        name = COALESCE(NULLIF(TRIM(COALESCE(name, '')), ''), NULLIF(TRIM(COALESCE(v_dup.name, '')), '')),
        avatar_url = COALESCE(NULLIF(TRIM(COALESCE(avatar_url, '')), ''), NULLIF(TRIM(COALESCE(v_dup.avatar_url, '')), '')),
        phone = COALESCE(NULLIF(TRIM(COALESCE(phone, '')), ''), NULLIF(TRIM(COALESCE(v_dup.phone, '')), '')),
        bio = COALESCE(NULLIF(TRIM(COALESCE(bio, '')), ''), NULLIF(TRIM(COALESCE(v_dup.bio, '')), '')),
        education = COALESCE(NULLIF(TRIM(COALESCE(education, '')), ''), NULLIF(TRIM(COALESCE(v_dup.education, '')), '')),
        experience = COALESCE(NULLIF(TRIM(COALESCE(experience, '')), ''), NULLIF(TRIM(COALESCE(v_dup.experience, '')), '')),
        company_name = COALESCE(NULLIF(TRIM(COALESCE(company_name, '')), ''), NULLIF(TRIM(COALESCE(v_dup.company_name, '')), '')),
        cnpj = COALESCE(NULLIF(TRIM(COALESCE(cnpj, '')), ''), NULLIF(TRIM(COALESCE(v_dup.cnpj, '')), '')),
        responsible_name = COALESCE(NULLIF(TRIM(COALESCE(responsible_name, '')), ''), NULLIF(TRIM(COALESCE(v_dup.responsible_name, '')), '')),
        company_segment = COALESCE(NULLIF(TRIM(COALESCE(company_segment, '')), ''), NULLIF(TRIM(COALESCE(v_dup.company_segment, '')), '')),
        company_neighborhood = COALESCE(NULLIF(TRIM(COALESCE(company_neighborhood, '')), ''), NULLIF(TRIM(COALESCE(v_dup.company_neighborhood, '')), '')),
        company_address = COALESCE(NULLIF(TRIM(COALESCE(company_address, '')), ''), NULLIF(TRIM(COALESCE(v_dup.company_address, '')), '')),
        company_logo_url = COALESCE(NULLIF(TRIM(COALESCE(company_logo_url, '')), ''), NULLIF(TRIM(COALESCE(v_dup.company_logo_url, '')), '')),
        password = COALESCE(NULLIF(TRIM(COALESCE(password, '')), ''), NULLIF(TRIM(COALESCE(v_dup.password, '')), '')),
        skills = CASE WHEN COALESCE(array_length(skills, 1), 0) > 0 THEN skills ELSE COALESCE(v_dup.skills, '{}') END,
        favorites = CASE WHEN COALESCE(array_length(favorites, 1), 0) > 0 THEN favorites ELSE COALESCE(v_dup.favorites, '{}') END,
        is_admin = (COALESCE(is_admin, FALSE) OR COALESCE(v_dup.is_admin, FALSE)),
        is_2fa_enabled = COALESCE(is_2fa_enabled, v_dup.is_2fa_enabled, FALSE),
        updated_at = timezone('utc'::text, now())
      WHERE id = v_winner.id;

      DELETE FROM public.users WHERE id = v_dup.id;
    END LOOP;

    IF v_auth_uid IS NOT NULL AND v_winner.id::text <> v_uid THEN
      PERFORM public.relink_user_id_references(v_winner.id::text, v_uid);

      UPDATE public.users
      SET id = v_auth_uid, email = COALESCE(NULLIF(v_email, ''), email)
      WHERE id = v_winner.id;

      SELECT * INTO v_winner FROM public.users WHERE id = v_auth_uid LIMIT 1;
    ELSE
      SELECT * INTO v_winner FROM public.users WHERE id = v_winner.id LIMIT 1;
    END IF;
  END IF;

  -- Busca empresa vinculada por e-mail ou user_id
  SELECT * INTO v_company
  FROM public.companies c
  WHERE (v_email <> '' AND LOWER(TRIM(COALESCE(c.email, ''))) = v_email)
     OR (v_uid <> '' AND COALESCE(c.user_id::text, '') = v_uid)
  ORDER BY COALESCE(c.verified, FALSE) DESC, c.updated_at DESC NULLS LAST
  LIMIT 1;
  v_company_found := FOUND;

  IF v_company_found AND v_uid <> '' AND COALESCE(v_company.user_id::text, '') <> v_uid THEN
    PERFORM public.assign_company_user_id(v_company.id::text, v_uid);
    SELECT * INTO v_company FROM public.companies WHERE id = v_company.id LIMIT 1;
  END IF;

  IF v_winner_found THEN
    v_has_password := (TRIM(COALESCE(v_winner.password, '')) <> '');
  END IF;

  -- Verifica histórico de atividade do usuário
  v_has_activity := (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE (v_uid <> '' AND a.user_id::text = v_uid)
         OR (v_email <> '' AND LOWER(TRIM(COALESCE(a.candidate_email, ''))) = v_email)
    )
    OR (v_uid <> '' AND EXISTS (SELECT 1 FROM public.enrollments e WHERE e.user_id::text = v_uid))
    OR (v_uid <> '' AND EXISTS (SELECT 1 FROM public.user_course_progress p WHERE p.user_id::text = v_uid))
    OR (v_email <> '' AND EXISTS (SELECT 1 FROM public.orders o WHERE LOWER(TRIM(COALESCE(o.customer_email, ''))) = v_email))
  );

  -- Auto-saneamento de status caso conta existente já tenha dados/empresa/atividade mas estava marcada pendente
  IF v_winner_found AND COALESCE(v_winner.is_blocked, FALSE) = FALSE AND LOWER(COALESCE(v_winner.status, '')) NOT IN ('blocked', 'bloqueado') THEN
    v_has_populated := (
      v_company_found OR
      v_has_activity OR
      v_has_password OR
      COALESCE(v_winner.is_admin, FALSE) = TRUE OR
      v_email = 'oportunizahw@gmail.com' OR
      COALESCE(v_winner.is_2fa_enabled, FALSE) = TRUE OR
      LENGTH(REGEXP_REPLACE(COALESCE(v_winner.phone, ''), '\D', '', 'g')) >= 8 OR
      TRIM(COALESCE(v_winner.bio, '')) <> '' OR
      TRIM(COALESCE(v_winner.company_name, '')) <> '' OR
      TRIM(COALESCE(v_winner.cnpj, '')) <> '' OR
      COALESCE(array_length(v_winner.skills, 1), 0) > 0
    );

    IF v_has_populated AND LOWER(COALESCE(v_winner.status, '')) <> 'active' THEN
      UPDATE public.users
      SET
        status = 'active',
        email = COALESCE(NULLIF(v_email, ''), email),
        updated_at = timezone('utc'::text, now())
      WHERE id = v_winner.id
      RETURNING * INTO v_winner;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'found', (v_winner_found OR v_company_found),
    'user', CASE WHEN v_winner_found THEN (to_jsonb(v_winner) - 'password') ELSE NULL END,
    'company', CASE WHEN v_company_found THEN to_jsonb(v_company) ELSE NULL END,
    'has_activity', v_has_activity,
    'has_password', v_has_password
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.get_my_profile_bundle() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile_bundle() TO authenticated;

-- RPC segura para concluir/atualizar ativação inicial ou perfil sem conflito de e-mail/ID
CREATE OR REPLACE FUNCTION public.complete_my_profile_activation(payload JSONB)
RETURNS JSONB AS $$
DECLARE
  v_auth_uid UUID;
  v_uid TEXT;
  v_email TEXT;
  v_existing public.users%ROWTYPE;
  v_existing_found BOOLEAN := FALSE;
  v_dup_row RECORD;
  v_saved public.users%ROWTYPE;
  v_is_master BOOLEAN;
  v_account_type TEXT;
  v_role TEXT;
  v_cargo TEXT;
  v_name TEXT;
  v_phone TEXT;
  v_bio TEXT;
  v_edu TEXT;
  v_exp TEXT;
  v_avatar TEXT;
  v_company_name TEXT;
  v_cnpj TEXT;
  v_resp_name TEXT;
  v_segment TEXT;
  v_neighborhood TEXT;
  v_requested_2fa BOOLEAN;
BEGIN
  v_auth_uid := auth.uid();
  v_uid := COALESCE(v_auth_uid::text, '');
  v_email := COALESCE(NULLIF(public.current_auth_email(), ''), LOWER(TRIM(COALESCE(payload->>'email', ''))));

  IF v_auth_uid IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Sessão autenticada e e-mail são obrigatórios.';
  END IF;

  PERFORM set_config('oportuniza.bypass_guard', 'on', TRUE);

  SELECT * INTO v_existing
  FROM public.users u
  WHERE u.id = v_auth_uid
     OR LOWER(TRIM(COALESCE(u.email, ''))) = v_email
  ORDER BY
    (CASE WHEN COALESCE(u.is_blocked, FALSE) OR LOWER(COALESCE(u.status, '')) IN ('blocked', 'bloqueado') THEN 0 ELSE 1 END),
    (CASE WHEN u.id = v_auth_uid THEN 0 ELSE 1 END),
    u.updated_at DESC NULLS LAST
  LIMIT 1;
  v_existing_found := FOUND;

  IF v_existing_found AND (COALESCE(v_existing.is_blocked, FALSE) = TRUE OR LOWER(COALESCE(v_existing.status, '')) IN ('blocked', 'bloqueado')) THEN
    RAISE EXCEPTION 'Conta bloqueada pelo administrador.';
  END IF;

  v_is_master := (v_email = 'oportunizahw@gmail.com');
  v_account_type := CASE WHEN LOWER(COALESCE(payload->>'account_type', '')) = 'company' THEN 'company' ELSE 'candidate' END;
  v_role := CASE
    WHEN v_is_master THEN 'Administrador'
    WHEN v_account_type = 'company' THEN 'Empresa'
    ELSE 'Candidato'
  END;
  v_cargo := CASE
    WHEN v_is_master THEN 'Administrador'
    WHEN v_account_type = 'company' THEN 'Empresa'
    ELSE 'Estudante'
  END;

  v_name := NULLIF(TRIM(COALESCE(payload->>'name', '')), '');
  v_phone := TRIM(COALESCE(payload->>'phone', ''));
  v_bio := COALESCE(payload->>'bio', '');
  v_edu := COALESCE(payload->>'education', '');
  v_exp := COALESCE(payload->>'experience', '');
  v_avatar := COALESCE(payload->>'avatar_url', '');
  v_company_name := NULLIF(TRIM(COALESCE(payload->>'company_name', '')), '');
  v_cnpj := NULLIF(TRIM(COALESCE(payload->>'cnpj', '')), '');
  v_resp_name := NULLIF(TRIM(COALESCE(payload->>'responsible_name', '')), '');
  v_segment := NULLIF(TRIM(COALESCE(payload->>'company_segment', '')), '');
  v_neighborhood := NULLIF(TRIM(COALESCE(payload->>'company_neighborhood', '')), '');
  v_requested_2fa := CASE
    WHEN NULLIF(TRIM(COALESCE(payload->>'is_2fa_enabled', '')), '') IS NOT NULL
      THEN LOWER(TRIM(payload->>'is_2fa_enabled')) IN ('true', '1', 'yes', 'on')
    ELSE NULL
  END;

  IF v_existing_found THEN
    -- Re-vincula e remove quaisquer linhas duplicadas que compartilhem o UID autenticado ou o e-mail normalizado
    FOR v_dup_row IN
      SELECT u.id
      FROM public.users u
      WHERE u.id <> v_existing.id
        AND (
          u.id = v_auth_uid OR
          LOWER(TRIM(COALESCE(u.email, ''))) = v_email
        )
    LOOP
      PERFORM public.relink_user_id_references(v_dup_row.id::text, v_uid);
      DELETE FROM public.users WHERE id = v_dup_row.id;
    END LOOP;

    IF v_existing.id <> v_auth_uid THEN
      PERFORM public.relink_user_id_references(v_existing.id::text, v_uid);
    END IF;

    UPDATE public.users
    SET
      id = v_auth_uid,
      email = v_email,
      name = COALESCE(v_name, name),
      phone = CASE WHEN v_phone <> '' THEN v_phone ELSE COALESCE(phone, '') END,
      bio = CASE WHEN TRIM(v_bio) <> '' THEN v_bio ELSE bio END,
      education = CASE WHEN TRIM(v_edu) <> '' THEN v_edu ELSE education END,
      experience = CASE WHEN TRIM(v_exp) <> '' THEN v_exp ELSE experience END,
      avatar_url = CASE WHEN TRIM(v_avatar) <> '' THEN v_avatar ELSE avatar_url END,
      account_type = CASE
        WHEN LOWER(COALESCE(role, '')) ~ '(atendimento|suporte|moderador)' OR LOWER(COALESCE(cargo, '')) ~ '(atendimento|suporte|moderador)'
          THEN COALESCE(NULLIF(account_type, ''), v_account_type)
        ELSE v_account_type
      END,
      role = COALESCE(
        CASE
          WHEN COALESCE(is_admin, FALSE)
            OR LOWER(COALESCE(role, '')) ~ '(atendimento|suporte|moderador)'
          THEN NULLIF(role, '')
          ELSE NULL
        END,
        v_role
      ),
      cargo = COALESCE(
        CASE
          WHEN COALESCE(is_admin, FALSE)
            OR LOWER(COALESCE(cargo, '')) ~ '(atendimento|suporte|moderador)'
          THEN NULLIF(cargo, '')
          ELSE NULL
        END,
        v_cargo
      ),
      company_name = COALESCE(v_company_name, company_name),
      cnpj = COALESCE(v_cnpj, cnpj),
      responsible_name = COALESCE(v_resp_name, responsible_name),
      company_segment = COALESCE(v_segment, company_segment),
      company_neighborhood = COALESCE(v_neighborhood, company_neighborhood),
      is_admin = (v_is_master OR COALESCE(is_admin, FALSE)),
      is_2fa_enabled = COALESCE(v_requested_2fa, is_2fa_enabled, FALSE),
      status = 'active',
      updated_at = timezone('utc'::text, now())
    WHERE id = v_existing.id
    RETURNING * INTO v_saved;
  ELSE
    INSERT INTO public.users (
      id, email, name, avatar_url, phone, bio, education, experience,
      account_type, role, cargo, company_name, cnpj, responsible_name,
      company_segment, company_neighborhood, is_admin, is_2fa_enabled, status
    )
    VALUES (
      v_auth_uid,
      v_email,
      COALESCE(v_name, split_part(v_email, '@', 1)),
      v_avatar,
      v_phone,
      v_bio,
      v_edu,
      v_exp,
      v_account_type,
      v_role,
      v_cargo,
      v_company_name,
      v_cnpj,
      v_resp_name,
      v_segment,
      v_neighborhood,
      v_is_master,
      COALESCE(v_requested_2fa, FALSE),
      'active'
    )
    RETURNING * INTO v_saved;
  END IF;

  RETURN (to_jsonb(v_saved) - 'password');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.complete_my_profile_activation(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_my_profile_activation(JSONB) TO authenticated;

-- RPC exclusiva para o titular da conta ativar ou desativar seu próprio 2FA
DROP FUNCTION IF EXISTS public.set_my_2fa_enabled(BOOLEAN);
CREATE OR REPLACE FUNCTION public.set_my_2fa_enabled(p_enabled BOOLEAN)
RETURNS JSONB AS $$
DECLARE
  v_auth_uid UUID;
  v_uid TEXT;
  v_email TEXT;
  v_updated public.users%ROWTYPE;
  v_is_blocked BOOLEAN := FALSE;
  v_desired BOOLEAN := COALESCE(p_enabled, FALSE);
BEGIN
  v_auth_uid := auth.uid();
  v_uid := COALESCE(v_auth_uid::text, '');
  v_email := public.current_auth_email();

  IF v_uid = '' AND v_email = '' THEN
    RAISE EXCEPTION 'Sessão autenticada necessária para alterar a configuração de 2FA.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE (
      (v_uid <> '' AND u.id::text = v_uid) OR
      (v_email <> '' AND LOWER(TRIM(COALESCE(u.email, ''))) = v_email)
    )
    AND (
      COALESCE(u.is_blocked, FALSE) = TRUE OR
      LOWER(COALESCE(u.status, '')) IN ('blocked', 'bloqueado')
    )
  ) INTO v_is_blocked;

  IF v_is_blocked THEN
    RAISE EXCEPTION 'Conta bloqueada não pode alterar preferências de segurança.';
  END IF;

  PERFORM set_config('oportuniza.bypass_guard', 'on', TRUE);

  UPDATE public.users u
  SET
    is_2fa_enabled = v_desired,
    updated_at = timezone('utc'::text, now())
  WHERE (v_uid <> '' AND u.id::text = v_uid)
     OR (v_email <> '' AND LOWER(TRIM(COALESCE(u.email, ''))) = v_email);

  SELECT * INTO v_updated
  FROM public.users u
  WHERE (v_uid <> '' AND u.id::text = v_uid)
     OR (v_email <> '' AND LOWER(TRIM(COALESCE(u.email, ''))) = v_email)
  ORDER BY
    (CASE WHEN v_uid <> '' AND u.id::text = v_uid THEN 0 ELSE 1 END),
    u.updated_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND AND v_auth_uid IS NOT NULL AND v_email <> '' THEN
    INSERT INTO public.users (
      id, email, name, is_admin, is_2fa_enabled, account_type, role, cargo, status
    )
    VALUES (
      v_auth_uid,
      v_email,
      split_part(v_email, '@', 1),
      (v_email = 'oportunizahw@gmail.com'),
      v_desired,
      'candidate',
      CASE WHEN v_email = 'oportunizahw@gmail.com' THEN 'Administrador' ELSE 'Candidato' END,
      CASE WHEN v_email = 'oportunizahw@gmail.com' THEN 'Administrador' ELSE 'Estudante' END,
      'active'
    )
    RETURNING * INTO v_updated;
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'is_2fa_enabled', COALESCE(v_updated.is_2fa_enabled, v_desired)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.set_my_2fa_enabled(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_2fa_enabled(BOOLEAN) TO authenticated;

-- =====================================================================
-- 15. ÍNDICES DE PERFORMANCE E CONSULTAS RÁPIDAS
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_applications_user ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_job ON public.applications(job_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON public.companies(cnpj);
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON public.companies(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_email ON public.support_tickets(user_email);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON public.support_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_active ON public.jobs(active);
CREATE INDEX IF NOT EXISTS idx_courses_active ON public.courses(active);

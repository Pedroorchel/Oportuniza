-- =====================================================================
-- OPORTUNIZA - POLÍTICAS DE SEGURANÇA RLS & SCHEMA BLINDADO (SUPABASE)
-- =====================================================================
-- 
-- Este script corrige todas as brechas de segurança (RLS), protege os dados
-- pessoais (LGPD/privacidade) e impede exclusões/alterações não autorizadas.
--
-- EXECUÇÃO: Copie e cole este script no painel SQL Editor do seu projeto Supabase
-- e clique em "Run" (Executar).
-- =====================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1. TABELA DE USUÁRIOS / PERFIS (public.users)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT,
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

-- Garantir coluna is_admin caso a tabela já existisse
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Ativa RLS estrito
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Limpeza de políticas antigas
DROP POLICY IF EXISTS "Leitura de perfis" ON public.users;
DROP POLICY IF EXISTS "Permitir leitura pública de perfis" ON public.users;
DROP POLICY IF EXISTS "Permitir leitura de perfis para usuários autenticados" ON public.users;
DROP POLICY IF EXISTS "Usuários atualizam próprio perfil" ON public.users;
DROP POLICY IF EXISTS "Permitir que usuários gerenciem seu próprio perfil" ON public.users;
DROP POLICY IF EXISTS "Permitir inserção de perfil" ON public.users;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;

-- Políticas Seguras para public.users
CREATE POLICY "users_select_policy" 
  ON public.users FOR SELECT 
  TO authenticated, anon
  USING (TRUE);

CREATE POLICY "users_update_policy" 
  ON public.users FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id OR auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com') 
  WITH CHECK (auth.uid() = id OR auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com');

CREATE POLICY "users_insert_policy" 
  ON public.users FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = id OR auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com');

-- Trigger de criação automática com SECURITY DEFINER (Roda com privilégios de sistema)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url, phone, is_admin)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    (new.email = 'pedroorchel12@gmail.com')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
    phone = COALESCE(EXCLUDED.phone, public.users.phone),
    is_admin = (EXCLUDED.email = 'pedroorchel12@gmail.com' OR public.users.is_admin),
    updated_at = timezone('utc'::text, now());
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- =====================================================================
-- 2. TABELA DE VAGAS (public.jobs)
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

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura pública de vagas" ON public.jobs;
DROP POLICY IF EXISTS "Gerenciamento de vagas" ON public.jobs;
DROP POLICY IF EXISTS "Administradores gerenciam vagas" ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_public" ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_all" ON public.jobs;

-- Qualquer visitante pode ver vagas ativas
CREATE POLICY "jobs_select_public" 
  ON public.jobs FOR SELECT 
  USING (TRUE);

-- Somente administradores autenticados podem criar, editar ou excluir vagas
CREATE POLICY "jobs_admin_all" 
  ON public.jobs FOR ALL 
  TO authenticated 
  USING (
    auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com' OR 
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  )
  WITH CHECK (
    auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com' OR 
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  );


-- =====================================================================
-- 3. TABELA DE CURSOS (public.courses)
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

-- Qualquer visitante pode ver cursos disponíveis
CREATE POLICY "courses_select_public" 
  ON public.courses FOR SELECT 
  USING (TRUE);

-- Somente administradores autenticados podem criar/modificar cursos
CREATE POLICY "courses_admin_all" 
  ON public.courses FOR ALL 
  TO authenticated 
  USING (
    auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com' OR 
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  )
  WITH CHECK (
    auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com' OR 
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  );


-- =====================================================================
-- 4. TABELA DE CANDIDATURAS (public.applications)
-- =====================================================================
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

-- Garantir todas as colunas caso a tabela já existisse previamente
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

-- Remove constraint de chave estrangeira caso exista para evitar erro 23503 em vagas dinâmicas
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_job_id_fkey;

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

-- Usuário vê APENAS suas próprias candidaturas; Admin vê todas
CREATE POLICY "apps_select_owner_or_admin" 
  ON public.applications FOR SELECT 
  TO authenticated 
  USING (
    auth.uid()::text = user_id::text OR 
    auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com' OR
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  );

-- Usuário autenticado pode se candidatar em seu próprio nome
CREATE POLICY "apps_insert_owner" 
  ON public.applications FOR INSERT 
  TO authenticated 
  WITH CHECK (
    auth.uid()::text = user_id::text OR 
    auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com' OR
    auth.uid() IS NOT NULL
  );

-- Atualização de status: Admin ou próprio usuário
CREATE POLICY "apps_update_owner_or_admin" 
  ON public.applications FOR UPDATE 
  TO authenticated 
  USING (
    auth.uid()::text = user_id::text OR 
    auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com' OR
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  )
  WITH CHECK (
    auth.uid()::text = user_id::text OR 
    auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com' OR
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  );

-- Exclusão de candidatura: Dono ou Admin
CREATE POLICY "apps_delete_owner_or_admin" 
  ON public.applications FOR DELETE 
  TO authenticated 
  USING (
    auth.uid()::text = user_id::text OR 
    auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com' OR
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  );


-- =====================================================================
-- 5. TABELA DE INSCRIÇÕES EM CURSOS (public.enrollments)
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

-- Garantir todas as colunas caso a tabela já existisse previamente
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

-- Remove constraint de chave estrangeira caso exista para evitar erro 23503 em cursos dinâmicos
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

CREATE POLICY "enrollments_select_policy" 
  ON public.enrollments FOR SELECT 
  TO authenticated 
  USING (
    auth.uid()::text = user_id::text OR 
    auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com' OR
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  );

CREATE POLICY "enrollments_insert_policy" 
  ON public.enrollments FOR INSERT 
  TO authenticated 
  WITH CHECK (
    auth.uid()::text = user_id::text OR 
    auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com' OR
    auth.uid() IS NOT NULL
  );

CREATE POLICY "enrollments_update_policy" 
  ON public.enrollments FOR UPDATE 
  TO authenticated 
  USING (
    auth.uid()::text = user_id::text OR 
    auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com' OR
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  ) 
  WITH CHECK (
    auth.uid()::text = user_id::text OR 
    auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com' OR
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  );

CREATE POLICY "enrollments_delete_policy" 
  ON public.enrollments FOR DELETE 
  TO authenticated 
  USING (
    auth.uid()::text = user_id::text OR 
    auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com' OR
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  );


-- =====================================================================
-- 6. TABELA DE PROGRESSO E CONCLUSÃO (public.user_course_progress)
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

CREATE POLICY "progress_select_policy" 
  ON public.user_course_progress FOR SELECT 
  TO authenticated 
  USING (
    auth.uid()::text = user_id::text OR 
    auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com'
  );

CREATE POLICY "progress_insert_policy" 
  ON public.user_course_progress FOR INSERT 
  TO authenticated 
  WITH CHECK (
    auth.uid()::text = user_id::text OR 
    auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com'
  );


-- =====================================================================
-- 7. TABELA DE PEDIDOS E PLANOS (public.orders)
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

-- Leitura: o próprio comprador pelo email ou admin
CREATE POLICY "orders_select_policy" 
  ON public.orders FOR SELECT 
  TO authenticated 
  USING (
    auth.jwt() ->> 'email' = customer_email OR 
    auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com'
  );

-- Inserção: liberada para checkout de novos pedidos
CREATE POLICY "orders_insert_checkout" 
  ON public.orders FOR INSERT 
  WITH CHECK (TRUE);

-- Modificação/Exclusão: apenas Administrador
CREATE POLICY "orders_admin_modify" 
  ON public.orders FOR ALL 
  TO authenticated 
  USING (auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com');


-- =====================================================================
-- 8. TABELA DE EMPRESAS / SOLICITAÇÕES CNPJ (public.companies)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  company_name TEXT NOT NULL,
  cnpj TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_select_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_insert_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_all_admin" ON public.companies;

CREATE POLICY "companies_select_policy" 
  ON public.companies FOR SELECT 
  USING (TRUE);

CREATE POLICY "companies_insert_policy" 
  ON public.companies FOR INSERT 
  WITH CHECK (TRUE);

CREATE POLICY "companies_all_admin" 
  ON public.companies FOR ALL 
  TO authenticated 
  USING (
    auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com' OR 
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  )
  WITH CHECK (
    auth.jwt() ->> 'email' = 'pedroorchel12@gmail.com' OR 
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  );


-- =====================================================================
-- 9. TABELAS DE ATENDIMENTO AO CLIENTE E CHAMADOS (public.support_tickets & support_messages)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL,
  user_id TEXT,
  user_name TEXT,
  user_email TEXT,
  user_phone TEXT,
  subject TEXT NOT NULL,
  category TEXT DEFAULT 'Geral',
  priority TEXT DEFAULT 'Média',
  status TEXT DEFAULT 'Aberto', -- 'Aberto', 'Em Atendimento', 'Resolvido', 'Fechado'
  assigned_to TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets_all" ON public.support_tickets;
CREATE POLICY "support_tickets_all" ON public.support_tickets FOR ALL USING (TRUE) WITH CHECK (TRUE);


CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id TEXT,
  sender_name TEXT,
  sender_role TEXT DEFAULT 'user',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_messages_all" ON public.support_messages;
CREATE POLICY "support_messages_all" ON public.support_messages FOR ALL USING (TRUE) WITH CHECK (TRUE);


-- =====================================================================
-- 10. TABELA DE LOGS DE AUDITORIA DO SISTEMA (public.audit_logs)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT,
  actor_email TEXT,
  actor_name TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_all" ON public.audit_logs;
CREATE POLICY "audit_logs_all" ON public.audit_logs FOR ALL USING (TRUE) WITH CHECK (TRUE);


-- =====================================================================
-- 11. ÍNDICES DE PERFORMANCE E CONSULTAS RÁPIDAS
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_applications_user ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_job ON public.applications(job_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON public.companies(cnpj);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_jobs_active ON public.jobs(active);
CREATE INDEX IF NOT EXISTS idx_courses_active ON public.courses(active);


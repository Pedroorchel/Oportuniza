import React, { useState } from 'react';
import { supabase, getAppRedirectUrl } from '../lib/supabaseClient';
import { isAccountBlocked, isUserRecordBlocked, fetchAccountBlockReason, extractBlockReasonFromRecord } from '../lib/blockedAccounts';
import { saveCompanyProfile } from '../lib/companyService';
import { Mail, Lock, User, ArrowRight, AlertCircle, Loader2, ArrowLeft, Eye, EyeOff, ShieldAlert, Building2, Briefcase, Phone, MapPin, FileText, Sparkles, Headphones } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenId, User as AppUser } from '../types';
import { validateEmailAddress, validatePersonOrCompanyName, validateCnpj, containsOffensiveLanguage, validatePhoneNumber } from '../lib/securityValidation';
import { COMPANY_LGPD_DECLARATION_SUMMARY, COMPANY_LGPD_CLAUSES } from '../lib/companyLGPD';
import { recordAuditLog } from '../lib/auditLogService';
import { ShieldCheck as ShieldCheckIcon } from 'lucide-react';

const logo = 'https://www.image2url.com/r2/default/images/1781824138816-3fd9702f-4521-41d2-8411-d8fc61114350.png';

const ARAUCARIA_NEIGHBORHOODS = [
  'Centro',
  'Costeira',
  'Polo Industrial / CSN / Petrobras',
  'Cachoeira',
  'Iguaçu',
  'Campina da Barra',
  'Fazenda Velha',
  'Tindiquera',
  'Thomaz Coelho',
  'Passaúna',
  'Capela Velha',
  'Barigui',
  'Porto Laranjeiras',
  'Outro Bairro / Região Metropolitana'
];

const COMPANY_SEGMENTS = [
  'Comércio & Varejo',
  'Indústria, Manufatura & Metalmecânica',
  'Tecnologia, Informática & Software',
  'Serviços & Atendimento ao Cliente',
  'Saúde, Odontologia & Farmácia',
  'Alimentação, Restaurantes & Gastronomia',
  'Logística, Transporte & Armazém',
  'Construção Civil & Reformas',
  'Educação & Treinamentos',
  'Outro Segmento'
];

interface AuthScreenProps {
  onNavigate?: (screen: ScreenId) => void;
  defaultIsLogin?: boolean;
  onLoginSuccess?: (user: AppUser) => void;
  onAdminLoginSuccess?: (adminUser: any) => void;
}

export default function AuthScreen({ onNavigate, defaultIsLogin = true, onLoginSuccess, onAdminLoginSuccess }: AuthScreenProps) {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  
  const [isLogin, setIsLogin] = useState(defaultIsLogin);
  const [isRecover, setIsRecover] = useState(false);

  // Account Type: candidate vs company (only Admin can assign Level 2 Atendimento)
  const [accountType, setAccountType] = useState<'candidate' | 'company'>('candidate');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [neighborhood, setNeighborhood] = useState(ARAUCARIA_NEIGHBORHOODS[0]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Company specific fields
  const [companyName, setCompanyName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [companySegment, setCompanySegment] = useState(COMPANY_SEGMENTS[0]);
  const [companyNeighborhood, setCompanyNeighborhood] = useState(ARAUCARIA_NEIGHBORHOODS[0]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [showLgpdModal, setShowLgpdModal] = useState(false);

  const [verificationSent, setVerificationSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  // Format CNPJ as 00.000.000/0000-00
  const handleCnpjChange = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 14);
    if (raw.length <= 2) {
      setCnpj(raw);
    } else if (raw.length <= 5) {
      setCnpj(`${raw.slice(0, 2)}.${raw.slice(2)}`);
    } else if (raw.length <= 8) {
      setCnpj(`${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5)}`);
    } else if (raw.length <= 12) {
      setCnpj(`${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8)}`);
    } else {
      setCnpj(`${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12, 14)}`);
    }
  };

  // Format phone as (00) 00000-0000
  const handlePhoneChange = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 11);
    if (raw.length <= 2) {
      setPhone(raw.length ? `(${raw}` : '');
    } else if (raw.length <= 6) {
      setPhone(`(${raw.slice(0, 2)}) ${raw.slice(2)}`);
    } else if (raw.length <= 10) {
      setPhone(`(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`);
    } else {
      setPhone(`(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`);
    }
  };

  const handleResendConfirmation = async () => {
    setResendLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const displayName = accountType === 'company' ? (companyName.trim() || 'Empresa') : (fullName.trim() || (registeredEmail || '').split('@')[0]);
      const { error } = await supabase.auth.signUp({ 
        email: registeredEmail, 
        password: password,
        options: {
          data: {
            full_name: displayName,
            account_type: accountType
          }
        }
      });
      if (error) throw error;
      setSuccess('Uhu! Reenviamos o e-mail de confirmação com um novo link!');
    } catch (err: any) {
      setError(err.message || 'Erro ao reenviar e-mail de confirmação.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (adminPassword === '06042025') {
      setSuccess('Acesso administrativo autorizado! Carregando painel...');
      const adminUser = {
        id: '00000000-0000-4000-8000-000000000604',
        name: 'Administrador Orchent',
        email: 'orchel@gmail.com',
        avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        isAdmin: true
      };
      setTimeout(() => {
        setLoading(false);
        if (onAdminLoginSuccess) {
          onAdminLoginSuccess(adminUser);
        }
      }, 1000);
    } else {
      setLoading(false);
      setError('E-mail ou senha do administrador incorretos.');
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAppRedirectUrl(),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login com Google.');
      setLoading(false);
    }
  };

  const handleGitHubLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: getAppRedirectUrl(),
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login com GitHub.');
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const getFriendlyErrorMessage = (errMsg: string) => {
      if (!errMsg) return 'Ocorreu um erro na autenticação';
      const lower = errMsg.toLowerCase();
      if (lower.includes('rate limit') || lower.includes('email rate limit exceeded')) {
        return 'Limite de e-mails do Supabase excedido! Por segurança, o Supabase limita novas contas ou e-mails por hora. Por favor, aguarde de 5 a 10 minutos para tentar novamente com este e-mail.';
      }
      if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
        return 'E-mail ou senha incorretos.';
      }
      if (lower.includes('failed to fetch') || lower.includes('network error')) {
        return 'Erro de conexão: Não conseguimos falar com o servidor. Verifique sua internet ou tente novamente em instantes.';
      }
      if (lower.includes('user already registered') || lower.includes('already exists') || lower.includes('já está sendo utilizado') || lower.includes('bloqueado')) {
        return 'Este e-mail já está sendo utilizado ou encontra-se bloqueado.';
      }
      if (lower.includes('email not confirmed')) {
        return 'Por favor, confirme seu e-mail antes de fazer login.';
      }
      if (lower.includes('password should be') || lower.includes('password must be')) {
        return 'A senha deve conter pelo menos 6 caracteres.';
      }
      return errMsg;
    };

    if (isRecover) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setSuccess('E-mail de recuperação enviado!');
      } catch (err: any) {
        setError(getFriendlyErrorMessage(err.message || 'Erro ao enviar e-mail'));
      } finally {
        setLoading(false);
      }
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    // Registration validation
    if (!isLogin) {
      // 1. Email syntax & disposable domain check (Anti-Zaralho / Anti-Fake)
      const emailVal = validateEmailAddress(cleanEmail);
      if (!emailVal.isValid) {
        setError(emailVal.error || 'E-mail inválido ou descartável.');
        setLoading(false);
        recordAuditLog({
          actor_name: accountType === 'company' ? (companyName || 'Empresa') : (fullName || 'Candidato'),
          actor_email: cleanEmail,
          actor_role: 'Sistema Anti-Fraude',
          action: 'Tentativa de Cadastro Bloqueada',
          target_name: cleanEmail,
          target_type: 'security',
          details: `Bloqueado por: ${emailVal.error}`,
          status: 'blocked'
        });
        return;
      }

      if (accountType === 'candidate') {
        const nameVal = validatePersonOrCompanyName(fullName, false);
        if (!nameVal.isValid) {
          setError(nameVal.error || 'Por favor, informe seu nome completo real.');
          setLoading(false);
          return;
        }
        const offensiveName = containsOffensiveLanguage(fullName);
        if (offensiveName.found) {
          setError(`Cadastro bloqueado: O nome informado contém termo inapropriado ("${offensiveName.word}"). Nomes falsos, vulgares ou conteúdo +18 são proibidos.`);
          setLoading(false);
          return;
        }
        const phoneVal = validatePhoneNumber(phone);
        if (!phoneVal.isValid) {
          setError(phoneVal.error || 'Número de telefone inválido.');
          setLoading(false);
          return;
        }
        if (!lgpdAccepted) {
          setError('Atenção: É obrigatório aceitar o Termo de Proteção de Dados e Tratamento de Informações (LGPD Lei nº 13.709/18) para criar seu cadastro de candidato.');
          setLoading(false);
          return;
        }
      } else {
        // Company validations
        const compVal = validatePersonOrCompanyName(companyName, true);
        if (!compVal.isValid) {
          setError(compVal.error || 'Por favor, informe a Razão Social ou Nome Fantasia real.');
          setLoading(false);
          return;
        }
        const respVal = validatePersonOrCompanyName(responsibleName, false);
        if (!respVal.isValid) {
          setError(respVal.error || 'Por favor, informe o nome do Responsável ou RH.');
          setLoading(false);
          return;
        }
        const compOffensive = containsOffensiveLanguage(companyName);
        if (compOffensive.found) {
          setError(`Cadastro de Empresa bloqueado: Razão Social contém termo inapropriado ("${compOffensive.word}"). Publicação de conteúdos falsos ou +18 acarretará sanções cíveis e criminais.`);
          setLoading(false);
          return;
        }
        const respOffensive = containsOffensiveLanguage(responsibleName);
        if (respOffensive.found) {
          setError(`Cadastro de Empresa bloqueado: Nome do responsável contém termo inapropriado ("${respOffensive.word}").`);
          setLoading(false);
          return;
        }
        const phoneVal = validatePhoneNumber(phone);
        if (!phoneVal.isValid) {
          setError(phoneVal.error || 'Número de telefone comercial inválido.');
          setLoading(false);
          return;
        }
        const cnpjVal = validateCnpj(cnpj);
        if (!cnpjVal.isValid) {
          setError(cnpjVal.error || 'CNPJ inválido.');
          setLoading(false);
          return;
        }

        // LGPD and Legal Responsibility Term mandatory check
        if (!lgpdAccepted) {
          setError('Atenção: É obrigatório ler e aceitar o Termo de Responsabilidade Jurídica e a LGPD (Lei 13.709/18) para cadastrar sua empresa em Araucária.');
          setLoading(false);
          return;
        }
      }

      if (password !== confirmPassword) {
        setError('As senhas não coincidem');
        setLoading(false);
        return;
      }

      if (password.length < 4) {
        setError('A senha deve conter pelo menos 4 caracteres.');
        setLoading(false);
        return;
      }
    }

    try {
      if (isLogin) {
        // 1. Verificação prévia de bloqueio rigorosa (banco de dados e cache)
        const isPreBlocked = await isAccountBlocked({ email: cleanEmail });
        if (isPreBlocked) {
          const reason = await fetchAccountBlockReason({ email: cleanEmail });
          setError(`Esta conta foi bloqueada pelo administrador. Motivo: "${reason}". Acesso negado e revogado.`);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
        
        if (data && data.user) {
          // 2. Verificação pós-autenticação por ID e e-mail
          const isPostBlocked = await isAccountBlocked({ id: data.user.id, email: cleanEmail });
          if (isPostBlocked) {
            await supabase.auth.signOut();
            const reason = await fetchAccountBlockReason({ id: data.user.id, email: cleanEmail });
            setError(`Esta conta foi bloqueada pelo administrador. Motivo: "${reason}". Acesso negado e revogado.`);
            setLoading(false);
            return;
          }

          const meta = data.user.user_metadata || {};
          const isComp = meta.account_type === 'company';

          let userRole = meta.role || meta.cargo || (isComp ? 'Empresa' : 'Candidato');
          let userCargo = meta.cargo || meta.role || (isComp ? 'Empresa' : 'Estudante');

          try {
            const { data: dbUser } = await supabase.from('users').select('*').eq('id', data.user.id).maybeSingle();
            if (dbUser && (dbUser.role || dbUser.cargo)) {
              userRole = dbUser.role || dbUser.cargo;
              userCargo = dbUser.cargo || dbUser.role;
            }
          } catch (e) {}

          const loggedUser: AppUser = {
            id: data.user.id,
            name: meta.full_name || (isComp ? meta.company_name : null) || data.user.email?.split('@')[0] || 'Usuário',
            email: data.user.email || '',
            avatarUrl: meta.avatar_url || '',
            bio: meta.bio || (isComp ? `Empresa atuante no setor ${meta.company_segment || 'Comércio'} em Araucária` : ''),
            education: meta.education || (isComp ? 'Empresa / Empregador' : 'Ensino Médio em andamento'),
            experience: meta.experience || (isComp ? 'Empresa Contratante em Araucária' : 'Nenhuma registrada'),
            phone: meta.phone || '',
            skills: meta.skills || [],
            favorites: [],
            accountType: meta.account_type || 'candidate',
            companyName: meta.company_name,
            cnpj: meta.cnpj,
            companySegment: meta.company_segment,
            companyNeighborhood: meta.company_neighborhood,
            responsibleName: meta.responsible_name,
            role: userRole,
            cargo: userCargo
          };
          if (onLoginSuccess) {
            onLoginSuccess(loggedUser);
          }
        }
      } else {
        // 1. Verificação prévia de cadastro: se o email já existe ou está bloqueado no banco
        const isBlockedPreReg = await isAccountBlocked({ email: cleanEmail });
        if (isBlockedPreReg) {
          const reason = await fetchAccountBlockReason({ email: cleanEmail });
          setError(`Esta conta/e-mail foi bloqueada pelo administrador. Motivo: "${reason}". Novos cadastros estão impedidos.`);
          setLoading(false);
          return;
        }

        try {
          const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .ilike('email', cleanEmail)
            .maybeSingle();

          if (existingUser) {
            if (isUserRecordBlocked(existingUser)) {
              const reason = extractBlockReasonFromRecord(existingUser) || await fetchAccountBlockReason({ email: cleanEmail });
              setError(`Esta conta/e-mail foi bloqueada pelo administrador. Motivo: "${reason}". Novos cadastros estão impedidos.`);
            } else {
              setError('Este e-mail já está sendo utilizado ou encontra-se cadastrado.');
            }
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Aviso na verificação pré-cadastro:', e);
        }

        const displayName = accountType === 'company' ? companyName.trim() : fullName.trim();
        const isSupportRegistration = cleanEmail.includes('atendimento') || cleanEmail.includes('suporte') || cleanEmail.includes('atendente');

        const userMetadata: Record<string, any> = {
          full_name: displayName,
          account_type: accountType,
          phone: phone.trim(),
          role: isSupportRegistration ? 'Atendimento Oportuniza' : (accountType === 'company' ? 'Empresa' : 'Candidato'),
          cargo: isSupportRegistration ? 'Atendimento Oportuniza' : (accountType === 'company' ? 'Empresa' : 'Estudante')
        };

        if (accountType === 'company') {
          userMetadata.company_name = companyName.trim();
          userMetadata.cnpj = cnpj.trim();
          userMetadata.responsible_name = responsibleName.trim();
          userMetadata.company_segment = companySegment;
          userMetadata.company_neighborhood = companyNeighborhood;
        } else {
          userMetadata.neighborhood = neighborhood;
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ 
          email: cleanEmail, 
          password,
          options: {
            emailRedirectTo: getAppRedirectUrl(),
            data: userMetadata
          }
        });
        if (signUpError) {
          const lowerErr = (signUpError.message || '').toLowerCase();
          if (lowerErr.includes('already registered') || lowerErr.includes('already exists') || lowerErr.includes('duplicate')) {
            throw new Error('Este e-mail já está sendo utilizado ou encontra-se bloqueado.');
          }
          throw signUpError;
        }
        
        let activeSession = signUpData?.session || (signUpData && 'access_token' in signUpData ? signUpData : null);
        
        // Se a sessão não foi iniciada automaticamente, tentamos fazer o login automático
        if (!activeSession) {
          try {
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
            if (!signInError && (signInData?.session || (signInData && 'access_token' in signInData))) {
              activeSession = signInData.session || (signInData && 'access_token' in signInData ? signInData : null);
            }
          } catch (signInError) {
            console.warn("Auto-login falhou, mas cadastro deu certo:", signInError);
          }
        }
        
        if (activeSession && activeSession.user) {
          const isSessionBlocked = await isAccountBlocked({ id: activeSession.user.id, email: cleanEmail });
          if (isSessionBlocked) {
            await supabase.auth.signOut();
            setError('Esta conta/e-mail foi bloqueada pelo administrador e está permanentemente impedida de criar novos acessos.');
            setLoading(false);
            return;
          }

          // Caso com Login Automático / Sessão Ativa (Email confirmation desativado ou mock)
          const userObj = activeSession.user;
          const loggedUser: AppUser = {
            id: userObj.id,
            name: displayName || userObj.user_metadata?.full_name || cleanEmail.split('@')[0],
            email: cleanEmail,
            avatarUrl: '',
            bio: accountType === 'company' 
              ? `Empresa atuante no setor ${companySegment} em Araucária` 
              : `Candidato em Araucária (${neighborhood})`,
            education: accountType === 'company' ? 'Empresa / Empregador' : 'Ensino Médio em andamento',
            experience: accountType === 'company' ? 'Empresa Contratante em Araucária' : 'Nenhuma registrada',
            phone: phone.trim(),
            skills: [],
            favorites: [],
            accountType: accountType === 'company' ? 'company' : 'candidate',
            companyName: accountType === 'company' ? companyName.trim() : undefined,
            cnpj: accountType === 'company' ? cnpj.trim() : undefined,
            responsibleName: accountType === 'company' ? responsibleName.trim() : undefined,
            companySegment: accountType === 'company' ? companySegment : undefined,
            companyNeighborhood: accountType === 'company' ? companyNeighborhood : neighborhood,
            role: isSupportRegistration ? 'Atendimento Oportuniza' : (accountType === 'company' ? 'Empresa' : 'Candidato'),
            cargo: isSupportRegistration ? 'Atendimento Oportuniza' : (accountType === 'company' ? 'Empresa' : 'Estudante')
          };

          // Salva no banco de dados, pois estamos autenticados
          try {
            await supabase.from('users').upsert({
              id: userObj.id,
              name: loggedUser.name,
              email: loggedUser.email,
              education: loggedUser.education,
              experience: loggedUser.experience,
              phone: loggedUser.phone || '',
              account_type: accountType,
              role: accountType === 'company' ? 'Empresa' : 'Candidato',
              cargo: accountType === 'company' ? 'Empresa' : 'Estudante',
              skills: []
            }, { onConflict: 'id' });

            // Se for conta de Empresa/RH, salva na tabela dedicada 'companies' com status pendente para moderação
            if (accountType === 'company') {
              await saveCompanyProfile({
                user_id: userObj.id,
                company_name: companyName.trim(),
                cnpj: cnpj.trim() || undefined,
                responsible_name: responsibleName.trim(),
                responsible_role: 'RH / Recrutador',
                email: cleanEmail,
                phone: phone.trim() || undefined,
                segment: companySegment,
                neighborhood: companyNeighborhood,
                status: 'pending',
                verified: false,
                bio: `Empresa aguardando análise e liberação pela equipe de Atendimento Oportuniza.`
              });

              // Registra no Histórico de Auditoria
              await recordAuditLog({
                actor_name: responsibleName.trim(),
                actor_email: cleanEmail,
                actor_role: 'Empresa',
                action: 'Cadastro de Empresa & Aceite LGPD',
                target_name: companyName.trim(),
                target_type: 'company',
                details: `Termo de Responsabilidade Jurídica e LGPD aceito sob as penas do Art. 299 do Código Penal e Lei nº 13.709/2018. CNPJ: ${cnpj.trim() || 'Não informado'}. Bairro: ${companyNeighborhood}.`,
                status: 'authorized'
              });
            } else {
              // Registro de novo candidato no log
              await recordAuditLog({
                actor_name: loggedUser.name,
                actor_email: cleanEmail,
                actor_role: 'Candidato',
                action: 'Novo Candidato Cadastrado',
                target_name: cleanEmail,
                target_type: 'user',
                details: `Cadastro verificado e liberado em Araucária (${neighborhood}).`,
                status: 'authorized'
              });
            }
          } catch (e) {
            console.warn("Não foi possível salvar o perfil no banco:", e);
          }

          setSuccess(accountType === 'company' 
            ? 'Cadastro de empresa enviado com sucesso! Sua solicitação foi encaminhada para a Central de Atendimento Oportuniza para análise e liberação.' 
            : 'Cadastro realizado com sucesso! Seja bem-vindo ao Oportuniza.');
          
          setTimeout(() => {
            if (onLoginSuccess) {
              onLoginSuccess(loggedUser);
            }
          }, 1200);
        } else {
          // Caso onde Confirmação de E-mail é OBRIGATÓRIA (Sessão é nula)
          if (accountType === 'company') {
            try {
              await saveCompanyProfile({
                company_name: companyName.trim(),
                cnpj: cnpj.trim() || undefined,
                responsible_name: responsibleName.trim(),
                responsible_role: 'RH / Recrutador',
                email: cleanEmail,
                phone: phone.trim() || undefined,
                segment: companySegment,
                neighborhood: companyNeighborhood,
                status: 'pending',
                verified: false
              });

              await recordAuditLog({
                actor_name: responsibleName.trim(),
                actor_email: cleanEmail,
                actor_role: 'Empresa',
                action: 'Cadastro Pendente de Empresa & Aceite LGPD',
                target_name: companyName.trim(),
                target_type: 'company',
                details: `Pré-cadastro realizado com aceite do Termo LGPD. Aguardando confirmação de e-mail. CNPJ: ${cnpj.trim() || 'N/A'}.`,
                status: 'authorized'
              });
            } catch (err) {
              console.warn('Fallback pré-confirmação para empresa:', err);
            }
          }
          setRegisteredEmail(email);
          setVerificationSent(true);
        }
        return;
      }
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err.message || 'Ocorreu um erro na autenticação'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="h-full w-full bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 flex flex-col overflow-y-auto overflow-x-hidden custom-scroll p-0 md:p-4 relative transition-colors"
    >
      {/* Spacer desktop reduzido */}
      <div className="hidden md:block h-4 w-full shrink-0" />
      
      {onNavigate && (
        <div className="p-4 pb-0 md:p-0 z-10 shrink-0">
          <button 
            onClick={() => onNavigate('landing')}
            className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm w-fit hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-slate-300" />
          </button>
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col items-center justify-start pt-2 md:pt-8 pb-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white dark:bg-[#131E32] rounded-[32px] md:rounded-[40px] shadow-[0_10px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)] p-5 sm:p-7 md:p-9 border border-slate-100 dark:border-slate-800 relative mx-4 transition-colors"
        >
          {/* Indicador visual simples no topo */}
          <div className="w-12 h-1 bg-gray-100 dark:bg-slate-700 rounded-full mx-auto mb-6 md:hidden" />

          {verificationSent ? (
            <div className="flex flex-col items-center text-center animate-fadeIn py-2">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 relative shadow-inner">
                <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-25" />
                <Mail className="w-10 h-10 text-emerald-600 relative z-10" />
              </div>

              <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                Instruções Enviadas!
              </h1>
              <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                Enviamos um e-mail com o link de confirmação para ativar sua conta em nosso banco de dados:
              </p>

              <div className="my-5 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl inline-flex items-center gap-2 max-w-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-slate-800 text-xs font-mono font-bold truncate select-all">
                  {registeredEmail}
                </span>
              </div>

              {/* Relação organizada de passos */}
              <div className="w-full bg-slate-50/70 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 text-left mb-6 space-y-4">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Abra sua caixa de entrada</h3>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-normal mt-0.5">
                      Procure pela mensagem enviada por <strong className="text-slate-700 dark:text-slate-300">Supabase Auth</strong> com o assunto <span className="italic font-medium text-slate-600 dark:text-slate-300">"Confirm your email address"</span>.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 border-t border-slate-100/70 dark:border-slate-800 pt-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Clique no link de confirmação</h3>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-normal mt-0.5">
                      Abra a mensagem recebida e clique no botão azul escrito <strong className="text-blue-600 dark:text-blue-400">"Confirm email address"</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 border-t border-slate-100/70 dark:border-slate-800 pt-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Seja redirecionado com segurança</h3>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-normal mt-0.5">
                      O sistema identificará sua validação, criará o seu perfil no banco de dados e abrirá o painel de vagas automaticamente!
                    </p>
                  </div>
                </div>
              </div>

              {/* Box de dicas e notificações de erro/sucesso locais para re-envio */}
              {success && (
                <div className="w-full mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900 rounded-xl text-xs font-medium text-left">
                  {success}
                </div>
              )}
              {error && (
                <div className="w-full mb-4 p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border border-red-100 dark:border-red-900 rounded-xl text-xs font-medium text-left">
                  {error}
                </div>
              )}

              <div className="w-full bg-[#52A8C7]/10 dark:bg-[#52B4D8]/10 border border-[#52A8C7]/20 dark:border-[#52B4D8]/20 rounded-2xl p-3 text-[11px] text-slate-600 dark:text-slate-300 text-left leading-relaxed mb-6 font-medium">
                💡 <span className="font-bold text-[#3d90ad] dark:text-[#52B4D8]">Dica anti-spam:</span> Caso não veja o e-mail na entrada principal, certifique-se de olhar sua aba de <strong className="text-slate-800 dark:text-white">Promoções, Atualizações, Spam</strong> ou <strong className="text-slate-800 dark:text-white">Lixo Eletrônico</strong>. Geralmente ele chega em menos de 10 segundos!
              </div>

              <div className="w-full space-y-2.5">
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resendLoading}
                  className="w-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  {resendLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-500 dark:text-slate-400" />
                  ) : (
                    <span>Não recebi o e-mail. Reenviar agora</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setVerificationSent(false);
                    setIsLogin(true);
                    setError(null);
                    setSuccess(null);
                  }}
                  className="w-full text-slate-400 hover:text-slate-600 text-xs font-semibold py-2 block hover:underline"
                >
                  Voltar para a tela de login
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-5">
                <div 
                  onClick={() => {
                    setIsAdminMode(!isAdminMode);
                    setError(null);
                    setSuccess(null);
                  }}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 cursor-pointer select-none overflow-hidden shadow-xs border border-slate-200/80 dark:border-slate-700 transition-transform active:scale-95 ${isAdminMode ? 'bg-amber-500/10' : 'bg-white dark:bg-slate-800'}`}
                >
                  {isAdminMode ? (
                    <User className="w-7 h-7 text-amber-500" />
                  ) : (
                    <img src={logo} alt="Oportuniza" className="w-full h-full object-cover object-center block" />
                  )}
                </div>
                
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight font-sans">
                  {isAdminMode ? 'Painel Administrativo' : isRecover ? 'Recuperar Senha' : isLogin ? 'Seja bem-vindo de volta' : (accountType === 'candidate' ? 'Crie sua Conta' : 'Cadastrar Empresa')}
                </h1>
                <p className="text-gray-500 dark:text-slate-400 mt-1 text-xs">
                  {isAdminMode 
                    ? 'Inserir credenciais de administrador' 
                    : isRecover 
                      ? 'Instruções de acesso serão enviadas por e-mail' 
                      : isLogin 
                        ? 'Acesse suas vagas, cursos e histórico' 
                        : (accountType === 'candidate' ? 'Cadastre-se e inicie sua jornada profissional' : 'Divulgue vagas e recrute talentos de Araucária')
                  }
                </p>
              </div>

              {/* Selector de Tipo de Conta no Modo Cadastro */}
              {!isLogin && !isRecover && !isAdminMode && (
                <div className="mb-4 p-1 bg-slate-100 dark:bg-slate-900/90 rounded-2xl flex flex-wrap gap-1 border border-slate-200/70 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountType('candidate');
                      setError(null);
                    }}
                    className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                      accountType === 'candidate'
                        ? 'bg-white dark:bg-slate-800 text-[#52A8C7] dark:text-[#52B4D8] shadow-xs border border-slate-200/60 dark:border-slate-700'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Sou Candidato</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAccountType('company');
                      setError(null);
                    }}
                    className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                      accountType === 'company'
                        ? 'bg-white dark:bg-slate-800 text-[#52A8C7] dark:text-[#52B4D8] shadow-xs border border-slate-200/60 dark:border-slate-700'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Sou Empresa</span>
                  </button>
                </div>
              )}

              {/* Banner informativo de Empresa */}
              {!isLogin && !isRecover && !isAdminMode && accountType === 'company' && (
                <div className="mb-4 p-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/70 rounded-2xl text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2.5 shadow-2xs">
                  <Sparkles className="w-4 h-4 text-[#52A8C7] dark:text-[#52B4D8] shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-left">
                    <strong className="block font-bold text-slate-900 dark:text-white text-xs">Oportuniza para Empresas</strong>
                    <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                      Cadastre seu negócio em Araucária para anunciar vagas de menor aprendiz, estágio e CLT gratuitamente.
                    </p>
                  </div>
                </div>
              )}

              {isAdminMode ? (
                <form onSubmit={handleAdminAuth} className="space-y-4">
                  <AnimatePresence mode="wait">
                    {(error || success) && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`${error ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border-red-100 dark:border-red-900' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900'} border px-4 py-3 rounded-xl flex items-start gap-2 text-xs font-medium`}
                      >
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="flex-1">{error || success}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider ml-1">Código de Acesso Admin</label>
                    <div className="relative group flex items-center">
                      <Lock className="absolute left-4 w-4 h-4 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
                      <input 
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        required
                        placeholder="Digitar código..."
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-amber-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-4 text-sm"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>Acessar Painel Admin</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsAdminMode(false);
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-gray-500 dark:text-slate-400 text-xs font-bold hover:underline cursor-pointer"
                    >
                      Voltar ao Login de Usuário
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleAuth} className="space-y-3.5">
                  <AnimatePresence mode="wait">
                    {(error || success) && (
                      <div className="space-y-3">
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={`${
                            error
                              ? error.toLowerCase().includes('bloquead') || error.includes('Motivo:')
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-900 shadow-sm'
                                : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border-red-100 dark:border-red-900'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900'
                          } border px-4 py-3.5 rounded-xl flex items-start gap-2.5 text-xs font-medium`}
                        >
                          {error && (error.toLowerCase().includes('bloquead') || error.includes('Motivo:')) ? (
                            <>
                              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                              <div className="flex-1 space-y-1 text-left">
                                <strong className="block text-rose-900 dark:text-rose-100 font-bold text-xs uppercase tracking-wide">Conta Bloqueada</strong>
                                <p className="text-rose-800 dark:text-rose-300 leading-relaxed font-normal">{error}</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                              <div className="flex-1 text-left">{error || success}</div>
                            </>
                          )}
                        </motion.div>

                        {error && error.includes('limita novas contas') && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="p-3.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-xl text-[11px] text-slate-700 dark:text-slate-300 space-y-2 font-normal leading-relaxed text-left"
                          >
                            <span className="font-bold text-slate-950 dark:text-white flex items-center gap-1">
                              💡 Como resolver e permitir cadastros ilimitados:
                            </span>
                            <ol className="list-decimal pl-4 space-y-1 text-slate-600 dark:text-slate-400">
                              <li>Acesse o painel do seu projeto no <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-[#52A8C7] hover:underline font-bold">Supabase</a></li>
                              <li>No menu lateral esquerdo, vá em <span className="font-semibold text-slate-800 dark:text-slate-200">Authentication</span> → <span className="font-semibold text-slate-800 dark:text-slate-200">Providers</span> → <span className="font-semibold text-slate-800 dark:text-slate-200">Email</span></li>
                              <li>Desative a opção <span className="font-semibold text-slate-800 dark:text-slate-200">"Confirm Email"</span></li>
                              <li>Clique em <span className="font-semibold text-slate-800 dark:text-slate-200">Save</span> no canto inferior direito</li>
                            </ol>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </AnimatePresence>

                  {/* ---------------- CANDIDATE FIELDS ---------------- */}
                  {!isLogin && !isRecover && accountType === 'candidate' && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          Nome Completo <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative group flex items-center">
                          <User className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input 
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            placeholder="Seu nome completo"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">WhatsApp</label>
                        <div className="relative group flex items-center">
                          <Phone className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input 
                            type="tel"
                            value={phone}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            placeholder="(41) 99999-9999"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Bairro em Araucária</label>
                        <div className="relative group flex items-center">
                          <MapPin className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                          <select 
                            value={neighborhood}
                            onChange={(e) => setNeighborhood(e.target.value)}
                            className="w-full pl-10 pr-8 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white shadow-xs cursor-pointer appearance-none"
                          >
                            {ARAUCARIA_NEIGHBORHOODS.map(n => (
                              <option key={n} value={n} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{n}</option>
                            ))}
                          </select>
                          <div className="absolute right-3.5 pointer-events-none text-slate-400 text-xs">
                            ▼
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* ---------------- COMPANY FIELDS ---------------- */}
                  {!isLogin && !isRecover && accountType === 'company' && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          Razão Social ou Nome Fantasia <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative group flex items-center">
                          <Building2 className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input 
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            required
                            placeholder="Ex: Supermercado Araucária Ltda"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          CNPJ <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal lowercase">(opcional)</span>
                        </label>
                        <div className="relative group flex items-center">
                          <FileText className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input 
                            type="text"
                            value={cnpj}
                            onChange={(e) => handleCnpjChange(e.target.value)}
                            placeholder="00.000.000/0000-00"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          Responsável / RH <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative group flex items-center">
                          <User className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input 
                            type="text"
                            value={responsibleName}
                            onChange={(e) => setResponsibleName(e.target.value)}
                            required
                            placeholder="Ex: Ana Silva (Recrutamento)"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Segmento de Atuação</label>
                        <div className="relative group flex items-center">
                          <Briefcase className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                          <select 
                            value={companySegment}
                            onChange={(e) => setCompanySegment(e.target.value)}
                            className="w-full pl-10 pr-8 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white shadow-xs cursor-pointer appearance-none"
                          >
                            {COMPANY_SEGMENTS.map(s => (
                              <option key={s} value={s} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{s}</option>
                            ))}
                          </select>
                          <div className="absolute right-3.5 pointer-events-none text-slate-400 text-xs">
                            ▼
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Bairro em Araucária</label>
                        <div className="relative group flex items-center">
                          <MapPin className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                          <select 
                            value={companyNeighborhood}
                            onChange={(e) => setCompanyNeighborhood(e.target.value)}
                            className="w-full pl-10 pr-8 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white shadow-xs cursor-pointer appearance-none"
                          >
                            {ARAUCARIA_NEIGHBORHOODS.map(n => (
                              <option key={n} value={n} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{n}</option>
                            ))}
                          </select>
                          <div className="absolute right-3.5 pointer-events-none text-slate-400 text-xs">
                            ▼
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                          WhatsApp Comercial / RH <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative group flex items-center">
                          <Phone className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                          <input 
                            type="tel"
                            value={phone}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            required
                            placeholder="(41) 99999-9999"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                      {accountType === 'company' && !isLogin ? 'E-mail Corporativo / RH' : 'E-MAIL'}
                    </label>
                    <div className="relative group flex items-center">
                      <Mail className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                      <input 
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder={accountType === 'company' && !isLogin ? "rh@suaempresa.com.br" : "seu@email.com"}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                      />
                    </div>
                  </div>

                  {!isRecover && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">SENHA</label>
                        {isLogin && (
                          <button 
                            type="button"
                            onClick={() => setIsRecover(true)}
                            className="text-xs font-bold text-[#52A8C7] dark:text-[#52B4D8] hover:underline cursor-pointer"
                          >
                            Esqueceu?
                          </button>
                        )}
                      </div>
                      <div className="relative group flex items-center">
                        <Lock className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                        <input 
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          placeholder="••••••••"
                          className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {!isLogin && !isRecover && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Confirmar Senha</label>
                      <div className="relative group flex items-center">
                        <Lock className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-[#52A8C7] transition-colors" />
                        <input 
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          placeholder="••••••••"
                          className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#52A8C7]/20 focus:border-[#52A8C7] focus:bg-white dark:focus:bg-slate-900 transition-all text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          aria-label={showConfirmPassword ? 'Ocultar senha' : 'Ver senha'}
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ---------------- TERMOS DE USO & LGPD ---------------- */}
                  {!isLogin && !isRecover && (
                    <div className="pt-2 px-1">
                      <label className="flex items-start gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={lgpdAccepted}
                          onChange={(e) => setLgpdAccepted(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-[#52A8C7] focus:ring-[#52A8C7] bg-white dark:bg-slate-950 cursor-pointer shrink-0"
                        />
                        <span className="text-xs text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white leading-tight font-medium select-none">
                          Li e aceito os <button type="button" onClick={() => setShowLgpdModal(true)} className="text-[#52A8C7] dark:text-[#52B4D8] font-bold hover:underline cursor-pointer inline">Termos de Uso</button>.
                        </span>
                      </label>
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#52A8C7] hover:bg-[#3d90ad] text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-3 text-sm"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>{isRecover ? 'Enviar Instruções' : isLogin ? 'Entrar no Oportuniza' : (accountType === 'company' ? 'Cadastrar Empresa' : 'Criar minha Conta')}</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                  
                  {/* Google Login Button */}
                  <div className="relative mt-3">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase">
                      <span className="bg-white dark:bg-[#131E32] px-3 text-slate-400 font-semibold">Ou continuar com</span>
                    </div>
                  </div>

                  <button 
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full mt-2 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-xs text-xs sm:text-sm"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4B4B"/>
                    </svg>
                    <span>Entrar com Google</span>
                  </button>

                  <button 
                    type="button"
                    onClick={handleGitHubLogin}
                    disabled={loading}
                    className="w-full mt-2 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-xs text-xs sm:text-sm"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                    </svg>
                    <span>Entrar com GitHub</span>
                  </button>
                </form>
              )}

              {!isAdminMode && (
                <div className="mt-6 text-center">
                  {isRecover ? (
                    <button 
                      onClick={() => setIsRecover(false)}
                      className="text-[#52A8C7] dark:text-[#52B4D8] text-xs font-bold hover:underline cursor-pointer"
                    >
                      Voltar ao Login
                    </button>
                  ) : (
                    <p className="text-gray-500 dark:text-slate-400 text-xs font-medium">
                      {isLogin ? 'Novo por aqui?' : 'Já possui uma conta?'}
                      <button 
                        onClick={() => setIsLogin(!isLogin)}
                        className="ml-2 text-[#52A8C7] dark:text-[#52B4D8] font-bold hover:underline cursor-pointer"
                      >
                        {isLogin ? 'Cadastre-se grátis' : 'Faça Login'}
                      </button>
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
      
      {/* MODAL: ÍNTEGRA DO TERMO DE RESPONSABILIDADE & LGPD */}
      {showLgpdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                  <ShieldCheckIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Termo de Responsabilidade & LGPD</h3>
                  <p className="text-[10px] text-slate-400">Lei nº 13.709/2018 e Artigo 299 do Código Penal</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLgpdModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scroll space-y-4 text-xs leading-relaxed text-slate-300">
              <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-indigo-200 text-[11px]">
                {COMPANY_LGPD_DECLARATION_SUMMARY}
              </div>

              <div className="space-y-3">
                {COMPANY_LGPD_CLAUSES.map((clause, idx) => (
                  <div key={idx} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1">
                    <h4 className="font-bold text-white text-[11px]">{clause.title}</h4>
                    <p className="text-[11px] text-slate-400 leading-normal">{clause.content}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
              <span className="text-[10px] text-slate-400 font-mono">Versão 2026.1-LEGAL (Araucária/PR)</span>
              <button
                type="button"
                onClick={() => {
                  setLgpdAccepted(true);
                  setShowLgpdModal(false);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-md"
              >
                Compreendi e Aceito os Termos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Espaçador final para garantir que o scroll chegue até o fundo em qualquer tela */}
      <div className="h-20 w-full shrink-0 md:hidden" />
    </div>
  );
}

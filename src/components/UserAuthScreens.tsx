import React, { useState } from 'react';
import { 
  Mail, 
  Lock, 
  User as UserIcon, 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Loader2, 
  ShieldAlert, 
  Building2, 
  Briefcase, 
  Phone, 
  MapPin, 
  FileText, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { ScreenId, User } from '../types';
import { supabase, getAppRedirectUrl } from '../lib/supabaseClient';
import { isAccountBlocked, isUserRecordBlocked, fetchAccountBlockReason, extractBlockReasonFromRecord } from '../lib/blockedAccounts';
import { validateEmailAddress, validatePersonOrCompanyName, validateCnpj, containsOffensiveLanguage } from '../lib/securityValidation';
import { COMPANY_LGPD_DECLARATION_SUMMARY, COMPANY_LGPD_CLAUSES } from '../lib/companyLGPD';
import { recordAuditLog } from '../lib/auditLogService';

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

interface AuthProps {
  currentScreen: 'login' | 'register' | 'recover';
  onNavigate: (screen: ScreenId) => void;
  onSetUser: (user: User | null) => void;
}

export default function UserAuthScreens({
  currentScreen,
  onNavigate,
  onSetUser,
}: AuthProps) {
  // Account Type selector ('candidate' | 'company')
  const [accountType, setAccountType] = useState<'candidate' | 'company'>('candidate');

  // Common states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [neighborhood, setNeighborhood] = useState(ARAUCARIA_NEIGHBORHOODS[0]);

  // Company specific states
  const [companyName, setCompanyName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [companySegment, setCompanySegment] = useState(COMPANY_SEGMENTS[0]);
  const [companyNeighborhood, setCompanyNeighborhood] = useState(ARAUCARIA_NEIGHBORHOODS[0]);

  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
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

  const getFriendlyErrorMessage = (errMsg: string) => {
    if (!errMsg) return 'Ocorreu um erro na autenticação';
    const lower = errMsg.toLowerCase();
    if (lower.includes('rate limit') || lower.includes('email rate limit exceeded')) {
      return 'Limite de envio de e-mails atingido! Por favor, aguarde alguns minutos para tentar novamente.';
    }
    if (lower.includes('user already registered') || lower.includes('already exists')) {
      return 'Este e-mail já está cadastrado. Tente fazer login.';
    }
    if (lower.includes('password should be') || lower.includes('password must be')) {
      return 'A senha deve conter pelo menos 6 caracteres.';
    }
    if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
      return 'E-mail ou senha incorretos.';
    }
    if (lower.includes('email not confirmed')) {
      return 'Por favor, confirme seu e-mail antes de fazer login.';
    }
    return errMsg;
  };

  const handleResendConfirmation = async () => {
    setResendLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { error } = await supabase.auth.signUp({ 
        email: registeredEmail, 
        password: password,
        options: {
          emailRedirectTo: getAppRedirectUrl(),
          data: {
            full_name: accountType === 'company' ? (companyName.trim() || 'Empresa') : (name.trim() || (registeredEmail || '').split('@')[0]),
            account_type: accountType
          }
        }
      });
      if (error) throw error;
      setSuccessMsg('Uhu! Reenviamos o e-mail de confirmação com um novo link!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao reenviar e-mail de confirmação.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    if (!email || !password) {
      setErrorMsg('Por favor, preencha todos os campos.');
      setLoading(false);
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1. Verificação prévia de bloqueio
      const isPreBlocked = await isAccountBlocked({ email: cleanEmail });
      if (isPreBlocked) {
        const reason = await fetchAccountBlockReason({ email: cleanEmail });
        setErrorMsg(`Esta conta foi bloqueada pelo administrador. Motivo: "${reason}". Acesso negado e revogado.`);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password
      });

      if (error) {
        throw error;
      }

      if (data && data.user) {
        const isPostBlocked = await isAccountBlocked({ id: data.user.id, email: cleanEmail });
        if (isPostBlocked) {
          await supabase.auth.signOut();
          const reason = await fetchAccountBlockReason({ id: data.user.id, email: cleanEmail });
          setErrorMsg(`Esta conta foi bloqueada pelo administrador. Motivo: "${reason}". Acesso negado e revogado.`);
          setLoading(false);
          return;
        }
      }

      // App.tsx handles onAuthStateChange, so we just navigate if success
      onNavigate('home');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('invalid login credentials')) {
        setErrorMsg('E-mail ou senha incorretos!');
      } else {
        setErrorMsg(msg || 'E-mail ou senha incorretos!');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    // 1. Email syntax & disposable domain check (Anti-Zaralho / Anti-Fake)
    const emailVal = validateEmailAddress(cleanEmail);
    if (!emailVal.isValid) {
      setErrorMsg(emailVal.error || 'E-mail inválido ou descartável.');
      setLoading(false);
      recordAuditLog({
        actor_name: accountType === 'company' ? (companyName || 'Empresa') : (name || 'Candidato'),
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

    // Specific validation based on account type
    if (accountType === 'candidate') {
      const nameVal = validatePersonOrCompanyName(name, false);
      if (!nameVal.isValid) {
        setErrorMsg(nameVal.error || 'Por favor, informe seu nome completo.');
        setLoading(false);
        return;
      }
      const offensiveName = containsOffensiveLanguage(name);
      if (offensiveName.found) {
        setErrorMsg(`Cadastro bloqueado: O nome informado contém termo inapropriado ("${offensiveName.word}"). Nomes vulgares ou conteúdo +18 são proibidos.`);
        setLoading(false);
        return;
      }
      if (!lgpdAccepted) {
        setErrorMsg('É obrigatório aceitar o Termo de Proteção de Dados (LGPD Lei nº 13.709/18) para se cadastrar como candidato.');
        setLoading(false);
        return;
      }
      if (!password || !confirmPassword) {
        setErrorMsg('Por favor, informe sua senha de acesso.');
        setLoading(false);
        return;
      }
    } else {
      // Company
      const compVal = validatePersonOrCompanyName(companyName, true);
      if (!compVal.isValid) {
        setErrorMsg(compVal.error || 'Por favor, informe a Razão Social da empresa.');
        setLoading(false);
        return;
      }
      const respVal = validatePersonOrCompanyName(responsibleName, false);
      if (!respVal.isValid) {
        setErrorMsg(respVal.error || 'Por favor, informe o responsável de RH.');
        setLoading(false);
        return;
      }
      const compOffensive = containsOffensiveLanguage(companyName);
      if (compOffensive.found) {
        setErrorMsg(`Cadastro de Empresa bloqueado: Razão Social contém termo inapropriado ("${compOffensive.word}").`);
        setLoading(false);
        return;
      }
      const respOffensive = containsOffensiveLanguage(responsibleName);
      if (respOffensive.found) {
        setErrorMsg(`Cadastro de Empresa bloqueado: Nome do responsável contém termo inapropriado ("${respOffensive.word}").`);
        setLoading(false);
        return;
      }
      if (!phone.trim()) {
        setErrorMsg('Por favor, informe o WhatsApp ou Telefone comercial de contato em Araucária.');
        setLoading(false);
        return;
      }
      const cnpjVal = validateCnpj(cnpj);
      if (!cnpjVal.isValid) {
        setErrorMsg(cnpjVal.error || 'CNPJ inválido.');
        setLoading(false);
        return;
      }
      if (!lgpdAccepted) {
        setErrorMsg('É obrigatório aceitar o Termo de Responsabilidade Jurídica e a LGPD (Lei 13.709/18) para cadastrar sua empresa.');
        setLoading(false);
        return;
      }
    }

    if (password !== confirmPassword) {
      setErrorMsg('As senhas não coincidem!');
      setLoading(false);
      return;
    }

    if (password.length < 4) {
      setErrorMsg('A senha deve conter no mínimo 4 caracteres.');
      setLoading(false);
      return;
    }

    try {
      const cleanEmail = email.trim().toLowerCase();

      // Verificação prévia se email já existe ou está bloqueado
      const isBlocked = await isAccountBlocked({ email: cleanEmail });
      if (isBlocked) {
        const reason = await fetchAccountBlockReason({ email: cleanEmail });
        setErrorMsg(`Esta conta/e-mail foi bloqueada pelo administrador. Motivo: "${reason}". Novos cadastros estão impedidos.`);
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
            setErrorMsg(`Esta conta/e-mail foi bloqueada pelo administrador. Motivo: "${reason}". Novos cadastros estão impedidos.`);
          } else {
            setErrorMsg('Este e-mail já está sendo utilizado ou encontra-se bloqueado.');
          }
          setLoading(false);
          return;
        }
      } catch (checkErr) {
        console.warn('Aviso verificação pré-cadastro:', checkErr);
      }

      const displayName = accountType === 'company' ? companyName.trim() : name.trim();

      const userMetadata: Record<string, any> = {
        full_name: displayName,
        account_type: accountType,
        phone: phone.trim(),
        role: accountType === 'company' ? 'Empresa' : 'Candidato'
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

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          emailRedirectTo: getAppRedirectUrl(),
          data: userMetadata
        }
      });

      if (error) {
        const lower = (error.message || '').toLowerCase();
        if (lower.includes('already registered') || lower.includes('already exists') || lower.includes('duplicate')) {
          throw new Error('Este e-mail já está sendo utilizado ou encontra-se bloqueado.');
        }
        throw error;
      }

      let activeSession = data?.session;
      if (!activeSession) {
        try {
          const { data: signInData } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: password
          });
          if (signInData?.session) {
            activeSession = signInData.session;
          }
        } catch {
          // Email confirmation might be required by Supabase
        }
      }

      if (activeSession && activeSession.user) {
        const isSessionBlocked = await isAccountBlocked({ id: activeSession.user.id, email: cleanEmail });
        if (isSessionBlocked) {
          await supabase.auth.signOut();
          setErrorMsg('Esta conta/e-mail foi bloqueada pelo administrador e está impedida de criar novos acessos.');
          setLoading(false);
          return;
        }

        const loggedUser: User = {
          id: activeSession.user.id,
          name: displayName || activeSession.user.user_metadata?.full_name || cleanEmail.split('@')[0],
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
          accountType: accountType,
          companyName: accountType === 'company' ? companyName.trim() : undefined,
          cnpj: accountType === 'company' ? cnpj.trim() : undefined,
          responsibleName: accountType === 'company' ? responsibleName.trim() : undefined,
          companySegment: accountType === 'company' ? companySegment : undefined,
          companyNeighborhood: accountType === 'company' ? companyNeighborhood : neighborhood,
          role: accountType === 'company' ? 'Empresa' : 'Candidato',
          cargo: accountType === 'company' ? 'Empresa' : 'Estudante'
        };

        try {
          await supabase.from('users').upsert({
            id: activeSession.user.id,
            name: loggedUser.name,
            email: loggedUser.email,
            phone: loggedUser.phone || '',
            education: loggedUser.education,
            experience: loggedUser.experience,
            account_type: accountType,
            company_name: loggedUser.companyName,
            cnpj: loggedUser.cnpj,
            responsible_name: loggedUser.responsibleName,
            company_segment: loggedUser.companySegment,
            company_neighborhood: loggedUser.companyNeighborhood,
            role: accountType === 'company' ? 'Empresa' : 'Candidato',
            cargo: accountType === 'company' ? 'Empresa' : 'Estudante',
            skills: []
          }, { onConflict: 'id' });

          if (accountType === 'company') {
            await supabase.from('companies').upsert({
              user_id: activeSession.user.id,
              company_name: loggedUser.companyName || loggedUser.name,
              cnpj: loggedUser.cnpj,
              responsible_name: loggedUser.responsibleName || 'RH',
              email: loggedUser.email,
              phone: loggedUser.phone,
              segment: loggedUser.companySegment || 'Comércio & Varejo',
              neighborhood: loggedUser.companyNeighborhood || 'Centro',
              status: 'active',
              verified: true
            }, { onConflict: 'email' });
          }
        } catch (dbErr) {
          console.warn('Erro ao registrar perfil/empresa no banco:', dbErr);
        }

        setSuccessMsg(accountType === 'company' 
          ? 'Empresa cadastrada com sucesso! Bem-vindo ao Oportuniza Empresas.' 
          : 'Cadastro realizado com sucesso!');
        onSetUser(loggedUser);
        setTimeout(() => {
          onNavigate('home');
        }, 600);
        return;
      }

      setRegisteredEmail(cleanEmail);
      setVerificationSent(true);
      setSuccessMsg('Conta criada! Enviamos um e-mail com o link de confirmação para ativar seu acesso.');
    } catch (err: any) {
      setErrorMsg(getFriendlyErrorMessage(err.message || 'Erro ao criar conta.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email) {
      setErrorMsg('Informe o e-mail de cadastro para a recuperação.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getAppRedirectUrl(),
      });

      if (error) {
        throw error;
      }

      setSuccessMsg('Se o e-mail existir, você receberá um link de recuperação em instantes!');
      setEmail('');
    } catch (err: any) {
      setErrorMsg(getFriendlyErrorMessage(err.message || 'Erro ao solicitar recuperação.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto custom-scroll px-4 sm:px-6 py-6 bg-gradient-to-b from-[#eef7ff] to-white dark:from-[#0B1120] dark:to-[#0F172A] text-slate-900 dark:text-slate-100 pb-12 transition-colors">
      {/* Back button */}
      <header className="mb-4 sm:mb-6">
        <button
          onClick={() => onNavigate('landing')}
          className="p-2.5 rounded-full bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors shadow-sm text-gray-700 dark:text-slate-200 cursor-pointer border border-gray-100 dark:border-slate-700"
          aria-label="Voltar para a página inicial"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      </header>

      {/* Brand logo top spacing */}
      <div className="text-center flex flex-col items-center gap-2 mb-6 animate-fadeIn">
        <div className="w-28 h-28 bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden rounded-3xl shadow-[0_12px_32px_rgba(0,0,0,0.08)] border border-gray-100 dark:border-slate-700 p-1">
          <img src={logo} alt="Oportuniza" className="w-full h-full object-contain object-center block" />
        </div>
        <h2 className="text-xl font-black tracking-tight text-gray-950 dark:text-white font-sans">
          {currentScreen === 'login' && 'Seja bem-vindo de volta'}
          {currentScreen === 'register' && (accountType === 'candidate' ? 'Crie sua conta gratuita' : 'Cadastre sua Empresa')}
          {currentScreen === 'recover' && 'Recupere seus dados'}
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm">
          {currentScreen === 'login' && 'Acesse suas vagas, cursos, histórico ou painel de empresa.'}
          {currentScreen === 'register' && (accountType === 'candidate' 
            ? 'Cadastre-se para iniciar sua jornada profissional em Araucária.' 
            : 'Divulgue suas vagas e encontre talentos qualificados na cidade.')}
          {currentScreen === 'recover' && 'Te enviaremos as orientações por e-mail.'}
        </p>
      </div>

      {/* Dynamic forms container */}
      <div className="bg-white dark:bg-[#131E32] p-5 sm:p-6 rounded-[28px] shadow-[0_15px_35px_rgba(79,162,192,0.08)] border border-gray-100 dark:border-slate-800 max-w-md mx-auto transition-colors">
        
        {/* Account Type Selector Tabs on Register Screen */}
        {currentScreen === 'register' && !verificationSent && (
          <div className="mb-5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl flex gap-1 border border-slate-200/60 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                setAccountType('candidate');
                setErrorMsg('');
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                accountType === 'candidate'
                  ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-600'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Candidato</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAccountType('company');
                setErrorMsg('');
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                accountType === 'company'
                  ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-600'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Empresa / RH</span>
            </button>
          </div>
        )}

        {/* Company Benefit Highlight Banner */}
        {currentScreen === 'register' && !verificationSent && accountType === 'company' && (
          <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-100 dark:border-blue-900/60 rounded-2xl text-[11px] text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-primary dark:text-[#52B4D8] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="block font-bold">Oportuniza para Empresas de Araucária</strong>
              <p className="text-[10px] text-blue-700 dark:text-blue-300 leading-relaxed">
                Anuncie estágios, menor aprendiz e CLT gratuitamente para mais de 1.200 candidatos locais.
              </p>
            </div>
          </div>
        )}

        {/* Error / Success alerts */}
        {errorMsg && (
          <div className={`mb-4 p-3.5 rounded-xl text-xs font-medium border ${
            errorMsg.toLowerCase().includes('bloquead') || errorMsg.includes('Motivo:')
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200'
              : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border-red-100 dark:border-red-900'
          }`}>
            {errorMsg.toLowerCase().includes('bloquead') || errorMsg.includes('Motivo:') ? (
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-left">
                  <strong className="block text-rose-900 dark:text-rose-100 font-bold text-xs uppercase tracking-wide">Conta Bloqueada</strong>
                  <p className="text-rose-800 dark:text-rose-300 leading-relaxed font-normal">{errorMsg}</p>
                </div>
              </div>
            ) : (
              errorMsg
            )}
          </div>
        )}
        
        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 rounded-xl text-xs font-semibold border border-emerald-100 dark:border-emerald-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 animate-bounce shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* LOGIN FORM                                                                */}
        {/* ========================================================================= */}
        {currentScreen === 'login' && (
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300" htmlFor="login-email">E-mail</label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3 w-4 h-4 text-gray-400 dark:text-slate-500" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@email.com ou rh@empresa.com"
                  className="w-full bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-3 pl-10 pr-4 text-xs focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gray-700 dark:text-slate-300" htmlFor="login-password">Senha</label>
                <button
                  type="button"
                  onClick={() => onNavigate('recover')}
                  className="text-[10px] text-primary dark:text-[#52B4D8] hover:underline font-semibold cursor-pointer"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 w-4 h-4 text-gray-400 dark:text-slate-500" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Insira sua senha"
                  className="w-full bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-3 pl-10 pr-10 text-xs focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary select-none mt-2 text-xs py-3 rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Entrar no Oportuniza
            </button>

            <div className="text-center mt-2">
              <span className="text-[11px] text-gray-400 dark:text-slate-400">Não possui conta? </span>
              <button
                type="button"
                onClick={() => onNavigate('register')}
                className="text-[11px] text-primary dark:text-[#52B4D8] font-bold hover:underline cursor-pointer"
              >
                Cadastre-se grátis
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* REGISTER FORM                                                             */}
        {/* ========================================================================= */}
        {currentScreen === 'register' && !verificationSent && (
          <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3.5">
            
            {/* ---------------- CANDIDATE FORM ---------------- */}
            {accountType === 'candidate' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-slate-300" htmlFor="reg-name">Nome Completo</label>
                  <div className="relative flex items-center">
                    <UserIcon className="absolute left-3 w-4 h-4 text-gray-400 dark:text-slate-500" />
                    <input
                      id="reg-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: João da Silva"
                      className="w-full bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-2.5 pl-10 pr-4 text-xs focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-slate-300" htmlFor="reg-email">E-mail</label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3 w-4 h-4 text-gray-400 dark:text-slate-500" />
                    <input
                      id="reg-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seuemail@exemplo.com"
                      className="w-full bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-2.5 pl-10 pr-4 text-xs focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-slate-300" htmlFor="reg-phone">WhatsApp / Telefone</label>
                    <div className="relative flex items-center">
                      <Phone className="absolute left-3 w-4 h-4 text-gray-400 dark:text-slate-500" />
                      <input
                        id="reg-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder="(41) 99999-9999"
                        className="w-full bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-2.5 pl-10 pr-3 text-xs focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-slate-300" htmlFor="reg-neighborhood">Bairro em Araucária</label>
                    <div className="relative flex items-center">
                      <MapPin className="absolute left-3 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
                      <select
                        id="reg-neighborhood"
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-2.5 pl-10 pr-3 text-xs focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none cursor-pointer"
                      >
                        {ARAUCARIA_NEIGHBORHOODS.map(n => (
                          <option key={n} value={n} className="dark:bg-slate-800">{n}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ---------------- COMPANY FORM ---------------- */}
            {accountType === 'company' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-slate-300" htmlFor="reg-company-name">
                    Nome da Empresa / Razão Social <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <Building2 className="absolute left-3 w-4 h-4 text-gray-400 dark:text-slate-500" />
                    <input
                      id="reg-company-name"
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Ex: Supermercado Araucária Ltda"
                      className="w-full bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-2.5 pl-10 pr-4 text-xs focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-slate-300" htmlFor="reg-cnpj">
                      CNPJ <span className="text-[10px] text-gray-400 font-normal">(Opcional / MEI)</span>
                    </label>
                    <div className="relative flex items-center">
                      <FileText className="absolute left-3 w-4 h-4 text-gray-400 dark:text-slate-500" />
                      <input
                        id="reg-cnpj"
                        type="text"
                        value={cnpj}
                        onChange={(e) => handleCnpjChange(e.target.value)}
                        placeholder="00.000.000/0000-00"
                        className="w-full bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-2.5 pl-10 pr-3 text-xs focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-slate-300" htmlFor="reg-resp-name">
                      Responsável / RH <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <UserIcon className="absolute left-3 w-4 h-4 text-gray-400 dark:text-slate-500" />
                      <input
                        id="reg-resp-name"
                        type="text"
                        value={responsibleName}
                        onChange={(e) => setResponsibleName(e.target.value)}
                        placeholder="Ex: Ana Silva (Recrutadora)"
                        className="w-full bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-2.5 pl-10 pr-3 text-xs focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-slate-300" htmlFor="reg-company-segment">
                      Segmento da Empresa
                    </label>
                    <div className="relative flex items-center">
                      <Briefcase className="absolute left-3 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
                      <select
                        id="reg-company-segment"
                        value={companySegment}
                        onChange={(e) => setCompanySegment(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-2.5 pl-10 pr-3 text-xs focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none cursor-pointer"
                      >
                        {COMPANY_SEGMENTS.map(s => (
                          <option key={s} value={s} className="dark:bg-slate-800">{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-slate-300" htmlFor="reg-company-neighborhood">
                      Bairro em Araucária
                    </label>
                    <div className="relative flex items-center">
                      <MapPin className="absolute left-3 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
                      <select
                        id="reg-company-neighborhood"
                        value={companyNeighborhood}
                        onChange={(e) => setCompanyNeighborhood(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-2.5 pl-10 pr-3 text-xs focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none cursor-pointer"
                      >
                        {ARAUCARIA_NEIGHBORHOODS.map(n => (
                          <option key={n} value={n} className="dark:bg-slate-800">{n}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-slate-300" htmlFor="reg-email">
                      E-mail Corporativo / RH <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <Mail className="absolute left-3 w-4 h-4 text-gray-400 dark:text-slate-500" />
                      <input
                        id="reg-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="rh@suaempresa.com.br"
                        className="w-full bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-2.5 pl-10 pr-3 text-xs focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-slate-300" htmlFor="reg-phone">
                      WhatsApp Comercial <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <Phone className="absolute left-3 w-4 h-4 text-gray-400 dark:text-slate-500" />
                      <input
                        id="reg-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder="(41) 99999-9999"
                        className="w-full bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-2.5 pl-10 pr-3 text-xs focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Passwords for both types */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-slate-300" htmlFor="reg-password">Senha</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 w-4 h-4 text-gray-400 dark:text-slate-500" />
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mín. 4 caracteres"
                    className="w-full bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-2.5 pl-10 pr-9 text-xs focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-slate-300" htmlFor="reg-confirm-password">Confirmar Senha</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 w-4 h-4 text-gray-400 dark:text-slate-500" />
                  <input
                    id="reg-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita sua senha"
                    className="w-full bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-2.5 pl-10 pr-9 text-xs focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
              </div>
            </div>

            {/* TERMOS DE USO & LGPD EM DESTAQUE */}
            <div className="mt-1 p-4 bg-slate-900 border-2 border-primary/50 rounded-2xl text-left space-y-2.5 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-sm font-black tracking-wider text-white uppercase">
                  TERMOS DE USO
                </span>
                <span className="text-[11px] font-black tracking-widest text-primary dark:text-[#52B4D8] bg-primary/15 px-2.5 py-0.5 rounded-full border border-primary/30">
                  LGPD
                </span>
              </div>

              <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs uppercase">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Aviso Jurídico & Responsabilidade Penal</span>
                </div>
                <p className="text-[11px] text-rose-200/90 leading-relaxed font-normal">
                  Se a mesma pessoa ou empresa tentar criar cadastro ou cadastrar CNPJ com conta falsa, dados inválidos ou conta de zaralho, será <strong>imediatamente banida e poderá ser processada judicialmente</strong> nas esferas cível e criminal por falsidade ideológica (Art. 299 do Código Penal) e danos à comunidade.
                </p>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer pt-1 group">
                <input
                  type="checkbox"
                  checked={lgpdAccepted}
                  onChange={(e) => setLgpdAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-600 text-primary focus:ring-primary bg-slate-950 cursor-pointer shrink-0"
                />
                <span className="text-xs font-bold text-slate-200 group-hover:text-white leading-snug select-none">
                  Li e aceito termos de uso!
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary select-none mt-2 text-xs py-3 rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {accountType === 'company' ? (
                <>
                  <Building2 className="w-4 h-4" />
                  <span>Cadastrar Empresa Gratuitamente</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar & Criar Conta</span>
                </>
              )}
            </button>

            <div className="text-center mt-1">
              <span className="text-[11px] text-gray-400 dark:text-slate-400">Já é cadastrado? </span>
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="text-[11px] text-primary dark:text-[#52B4D8] font-bold hover:underline cursor-pointer"
              >
                Fazer login
              </button>
            </div>
          </form>
        )}

        {/* Verification Sent Feedback */}
        {currentScreen === 'register' && verificationSent && (
          <div className="flex flex-col items-center animate-fadeIn py-2 text-center">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mb-4 relative shadow-inner">
              <div className="absolute inset-0 bg-emerald-100 dark:bg-emerald-900 rounded-full animate-ping opacity-25" />
              <Mail className="w-8 h-8 text-emerald-600 dark:text-emerald-400 relative z-10" />
            </div>

            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              Verifique sua caixa de entrada
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-4 leading-relaxed">
              Enviamos um e-mail de confirmação para ativar sua conta {accountType === 'company' ? 'de empresa' : ''}:
            </p>

            <div className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 mb-6 inline-flex justify-center items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-800 dark:text-slate-200 text-xs font-mono font-bold truncate">
                {registeredEmail}
              </span>
            </div>

            {/* Steps */}
            <div className="w-full bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-left mb-6 space-y-3">
              <div className="flex gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/10 dark:bg-primary/20 text-primary dark:text-[#52B4D8] text-[10px] font-bold flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Abra o e-mail recebido</h4>
                  <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Procure a mensagem do <strong className="text-slate-700 dark:text-slate-300">Oportuniza Araucária (oportunizahw@gmail.com)</strong>.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 border-t border-slate-100/70 dark:border-slate-800 pt-2 text-left">
                <div className="w-5 h-5 rounded-full bg-primary/10 dark:bg-primary/20 text-primary dark:text-[#52B4D8] text-[10px] font-bold flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Clique para confirmar</h4>
                  <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Ao confirmar, você ativará seu perfil na base de dados.
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full p-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100/50 dark:border-blue-900/50 rounded-xl text-[10px] text-slate-600 dark:text-slate-300 text-left mb-6">
              💡 <b>Não encontrou?</b> Verifique sua aba de Spam ou Promoções.
            </div>

            <div className="w-full space-y-2">
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resendLoading}
                className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-[11px] cursor-pointer"
              >
                {resendLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
                ) : (
                  <span>Reenviar link de confirmação</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setVerificationSent(false);
                  onNavigate('login');
                }}
                className="w-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[11px] font-semibold py-2 cursor-pointer"
              >
                Voltar ao login
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* RECOVERY FORM                                                             */}
        {/* ========================================================================= */}
        {currentScreen === 'recover' && (
          <form onSubmit={handleRecoverySubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">Informe seu E-mail</label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3 w-4 h-4 text-gray-400 dark:text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="emaildocadastro@provedor.com"
                  className="w-full bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl py-3 pl-10 pr-4 text-xs font-medium focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 rounded-xl bg-gray-900 dark:bg-primary hover:bg-gray-800 dark:hover:bg-primary-dark text-white text-sm font-bold shadow-md active:scale-95 transition-all disabled:opacity-50 mt-2 cursor-pointer"
            >
              {loading ? 'Processando...' : 'Enviar Instruções'}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => onNavigate('login')}
              className="w-full px-6 py-3 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 text-sm font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer border border-gray-200 dark:border-slate-700"
            >
              Voltar ao Login
            </button>
          </form>
        )}
      </div>

      {/* Visual notice */}
      <div className="mt-8 text-center px-4 max-w-md mx-auto">
        <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-normal">
          Dica rápida: Para fins de teste e demonstração rápida de banca, use o login padrão pré-cadastrado abaixo:
          <br />
          <strong className="text-primary dark:text-[#52B4D8] font-mono select-all">oportunizahw@gmail.com</strong> com senha <strong className="text-primary dark:text-[#52B4D8] font-mono select-all">123</strong>
        </p>
      </div>

      {/* MODAL LGPD */}
      {showLgpdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/20 text-primary dark:text-[#52B4D8] rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
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
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-slate-200 text-[11px]">
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
              <span className="text-[10px] text-slate-400 font-mono">Oportuniza Araucária</span>
              <button
                type="button"
                onClick={() => {
                  setLgpdAccepted(true);
                  setShowLgpdModal(false);
                }}
                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-md"
              >
                Aceitar e Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


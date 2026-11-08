import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  User as UserIcon, 
  Mail, 
  Phone, 
  Bell, 
  BellRing, 
  Shield, 
  Lock, 
  Trash2, 
  LogOut, 
  ChevronRight, 
  Sparkles, 
  Heart, 
  FileText, 
  GraduationCap, 
  CheckCircle2, 
  Moon, 
  Sun, 
  Download, 
  HelpCircle, 
  MessageSquare, 
  Check, 
  Smartphone, 
  Globe, 
  Eye, 
  EyeOff, 
  ExternalLink,
  Info,
  Laptop
} from 'lucide-react';
import { User, ScreenId, Application, Enrollment } from '../types';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../lib/toast';
import { useTheme } from '../lib/theme';

interface SettingsScreenProps {
  user: User | null;
  onSetUser: (user: User | null) => void;
  onNavigate: (screen: ScreenId) => void;
  favorites: string[];
  applications: Application[];
  enrollments: Enrollment[];
  completedCourses?: any[];
  onDeleteAllData: () => Promise<void>;
  onSignOut?: () => void;
}

export default function SettingsScreen({
  user,
  onSetUser,
  onNavigate,
  favorites = [],
  applications = [],
  enrollments = [],
  completedCourses = [],
  onDeleteAllData,
  onSignOut
}: SettingsScreenProps) {
  const [theme, toggleTheme] = useTheme();

  // Notification states
  const [tiJobsPush, setTiJobsPush] = useState<boolean>(user?.tiJobsPushEnabled ?? false);
  const [generalNotifications, setGeneralNotifications] = useState<boolean>(user?.notificationsEnabled ?? true);
  const [marketingEmails, setMarketingEmails] = useState<boolean>(user?.marketingEmailsEnabled ?? false);
  const [courseAlerts, setCourseAlerts] = useState<boolean>(true);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>('default');

  // Password modal / inline states
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Clear cache confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check browser Notification support
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermission(Notification.permission);
    } else {
      setBrowserPermission('unsupported');
    }
  }, []);

  // Synchronize state with user prop
  useEffect(() => {
    if (user) {
      setTiJobsPush(user.tiJobsPushEnabled ?? false);
      setGeneralNotifications(user.notificationsEnabled ?? true);
      setMarketingEmails(user.marketingEmailsEnabled ?? false);
    }
  }, [user]);

  // Push Notifications Toggle Handler for TI Jobs
  const handleToggleTiJobsPush = async (enabled: boolean) => {
    setTiJobsPush(enabled);

    let perm = browserPermission;
    if (enabled && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        try {
          const requested = await Notification.requestPermission();
          setBrowserPermission(requested);
          perm = requested;
        } catch (err) {
          console.warn('Erro ao solicitar permissão de notificações:', err);
        }
      }
    }

    if (user) {
      const updatedUser: User = {
        ...user,
        tiJobsPushEnabled: enabled,
        updatedAt: new Date().toISOString()
      };
      onSetUser(updatedUser);

      try {
        if (user.id) {
          await supabase
            .from('users')
            .update({
              notifications_enabled: enabled,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);
        }
      } catch (err) {
        console.warn('Supabase sync warning:', err);
      }
    }

    if (enabled) {
      if (perm === 'denied') {
        toast.warning('Notificações de TI ativadas no perfil! (Alertas do navegador bloqueados pelo sistema).');
      } else {
        toast.success('🔔 Notificações para novas vagas de TI ativadas!');
      }
    } else {
      toast.info('Notificações de vagas de TI desativadas.');
    }
  };

  const handleToggleGeneralNotifications = async (enabled: boolean) => {
    setGeneralNotifications(enabled);
    if (user) {
      const updatedUser: User = {
        ...user,
        notificationsEnabled: enabled
      };
      onSetUser(updatedUser);

      try {
        if (user.id) {
          await supabase
            .from('users')
            .update({ notifications_enabled: enabled })
            .eq('id', user.id);
        }
      } catch (e) {
        console.warn(e);
      }
    }
    toast.info(enabled ? 'Alertas gerais ativados.' : 'Alertas gerais desativados.');
  };

  const handleToggleMarketing = async (enabled: boolean) => {
    setMarketingEmails(enabled);
    if (user) {
      const updatedUser: User = {
        ...user,
        marketingEmailsEnabled: enabled
      };
      onSetUser(updatedUser);

      try {
        if (user.id) {
          await supabase
            .from('users')
            .update({ marketing_emails_enabled: enabled })
            .eq('id', user.id);
        }
      } catch (e) {
        console.warn(e);
      }
    }
  };

  // Trigger real test push notification
  const handleTestTiNotification = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const res = await Notification.requestPermission();
        setBrowserPermission(res);
      }

      if (Notification.permission === 'granted') {
        try {
          new Notification('🚀 [OPORTUNIZA TECH] Nova Vaga de TI!', {
            body: 'Estágio / Suporte de TI em Araucária (R$ 2.400,00). Toque para se candidatar!',
            icon: '/vite.svg'
          });
        } catch (e) {
          console.warn('Falha no trigger nativo:', e);
        }
      }
    }

    toast.success('🚀 [TESTE PUSH]: Notificação de vaga de TI enviada com sucesso!');
  };

  // Change Password Handler
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('A senha deve conter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas digitadas não coincidem.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      if (user?.email) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      }
      toast.success('Senha atualizada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
    } catch (err: any) {
      toast.error(err.message || 'Não foi possível alterar a senha no momento.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleConfirmDeleteData = async () => {
    setIsDeleting(true);
    try {
      await onDeleteAllData();
      setShowDeleteModal(false);
      toast.success('Cache e histórico local limpos com sucesso!');
    } catch (e) {
      toast.error('Erro ao limpar cache local.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#F8FAFC] dark:bg-[#0B1120] text-gray-900 dark:text-gray-100 overflow-y-auto custom-scroll relative transition-colors duration-200">
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 px-5 pt-6 pb-4 bg-white/90 dark:bg-[#131E32]/90 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            id="btn-back-settings"
            onClick={() => onNavigate('home')}
            className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-center text-gray-600 dark:text-gray-300 active:scale-95 transition-all cursor-pointer outline-none"
            aria-label="Voltar para início"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              Configurações
            </h1>
            <p className="text-xs text-gray-400 dark:text-gray-400">
              Preferências, alertas e sua conta
            </p>
          </div>
        </div>

        {/* Quick Theme Toggle Icon */}
        <button
          onClick={toggleTheme}
          className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-center text-gray-600 dark:text-gray-300 active:scale-95 transition-all cursor-pointer outline-none border border-gray-100 dark:border-slate-700"
          title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Moon className="w-5 h-5 text-sky-500" />
          )}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="px-4 sm:px-6 py-6 flex flex-col gap-6 max-w-3xl mx-auto w-full pb-28">

        {/* 1. USER PROFILE CARD OVERVIEW */}
        <div className="bg-white dark:bg-[#131E32] rounded-3xl p-5 sm:p-6 border border-gray-100 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#4FA2C0] to-[#6C63FF] p-0.5 overflow-hidden shadow-sm">
                {user?.avatarUrl ? (
                  <img 
                    src={user.avatarUrl} 
                    alt={user.name || 'Usuário'} 
                    className="w-full h-full object-cover rounded-[14px] bg-white dark:bg-slate-800"
                  />
                ) : (
                  <div className="w-full h-full rounded-[14px] bg-white dark:bg-slate-800 flex items-center justify-center text-[#4FA2C0]">
                    <UserIcon className="w-8 h-8" />
                  </div>
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-[#131E32] rounded-full" title="Conta Conectada" />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  {user?.name || 'Candidato Oportuniza'}
                </h2>
                <span className="px-2 py-0.5 bg-[#4FA2C0]/10 text-[#4FA2C0] text-[11px] font-bold rounded-full">
                  {user?.isAdmin ? 'Admin' : 'Candidato'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span>{user?.email || 'email@exemplo.com'}</span>
              </p>
              {user?.phone && (
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{user.phone}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 border-t sm:border-t-0 border-gray-100 dark:border-slate-800 pt-3 sm:pt-0">
            <button
              onClick={() => onNavigate('profile')}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-[#4FA2C0]/10 hover:text-[#4FA2C0] text-gray-700 dark:text-gray-200 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-gray-100 dark:border-slate-700"
            >
              <span>Editar Perfil</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2. MEUS CONTEÚDOS & ATALHOS RÁPIDOS */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-400 font-mono">
              Meus Conteúdos & Carreira
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Favoritas */}
            <button
              id="card-settings-favorites"
              onClick={() => onNavigate('favorites')}
              className="p-4 rounded-2xl bg-white dark:bg-[#131E32] border border-gray-100 dark:border-slate-800 hover:border-pink-200 dark:hover:border-pink-900/50 shadow-xs hover:shadow-md transition-all flex flex-col items-start gap-2 group cursor-pointer text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xl font-black text-gray-900 dark:text-white block">
                  {favorites.length}
                </span>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Vagas Favoritas
                </span>
              </div>
            </button>

            {/* Candidaturas */}
            <button
              id="card-settings-applications"
              onClick={() => onNavigate('applications')}
              className="p-4 rounded-2xl bg-white dark:bg-[#131E32] border border-gray-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900/50 shadow-xs hover:shadow-md transition-all flex flex-col items-start gap-2 group cursor-pointer text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#4FA2C0] flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xl font-black text-gray-900 dark:text-white block">
                  {applications.length}
                </span>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Candidaturas
                </span>
              </div>
            </button>

            {/* Cursos Inscritos */}
            <button
              id="card-settings-enrollments"
              onClick={() => onNavigate('enrollments')}
              className="p-4 rounded-2xl bg-white dark:bg-[#131E32] border border-gray-100 dark:border-slate-800 hover:border-purple-200 dark:hover:border-purple-900/50 shadow-xs hover:shadow-md transition-all flex flex-col items-start gap-2 group cursor-pointer text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-[#6C63FF] flex items-center justify-center group-hover:scale-110 transition-transform">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xl font-black text-gray-900 dark:text-white block">
                  {enrollments.length}
                </span>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Cursos Inscritos
                </span>
              </div>
            </button>

            {/* Cursos Concluídos */}
            <button
              id="card-settings-completed"
              onClick={() => onNavigate('completed')}
              className="p-4 rounded-2xl bg-white dark:bg-[#131E32] border border-gray-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-900/50 shadow-xs hover:shadow-md transition-all flex flex-col items-start gap-2 group cursor-pointer text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xl font-black text-gray-900 dark:text-white block">
                  {completedCourses.length}
                </span>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Concluídos
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* 3. APARÊNCIA & TEMA DO APP */}
        <div className="bg-white dark:bg-[#131E32] rounded-3xl p-5 sm:p-6 border border-gray-100 dark:border-slate-800 shadow-xs flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-[#4FA2C0]">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Aparência da Interface
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Personalize a experiência visual entre o tema claro e escuro
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            {/* Light Mode Selector Card */}
            <button
              type="button"
              onClick={() => {
                if (theme === 'dark') toggleTheme();
              }}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all cursor-pointer ${
                theme === 'light'
                  ? 'border-[#4FA2C0] bg-[#4FA2C0]/5 shadow-xs'
                  : 'border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/40 hover:bg-gray-100/50'
              }`}
            >
              <div className="w-full h-14 rounded-xl bg-white border border-gray-200 flex flex-col p-2 gap-1 shadow-xs overflow-hidden">
                <div className="w-1/2 h-2 rounded-full bg-[#4FA2C0]" />
                <div className="w-3/4 h-1.5 rounded-full bg-gray-200" />
                <div className="w-full h-1.5 rounded-full bg-gray-100" />
              </div>
              <div className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Modo Claro</span>
                {theme === 'light' && <Check className="w-3.5 h-3.5 text-[#4FA2C0]" />}
              </div>
            </button>

            {/* Dark Mode Selector Card */}
            <button
              type="button"
              onClick={() => {
                if (theme === 'light') toggleTheme();
              }}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'border-[#4FA2C0] bg-[#4FA2C0]/10 shadow-xs'
                  : 'border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/40 hover:bg-gray-100/50'
              }`}
            >
              <div className="w-full h-14 rounded-xl bg-[#0B1120] border border-slate-700 flex flex-col p-2 gap-1 shadow-xs overflow-hidden">
                <div className="w-1/2 h-2 rounded-full bg-[#52B4D8]" />
                <div className="w-3/4 h-1.5 rounded-full bg-slate-700" />
                <div className="w-full h-1.5 rounded-full bg-slate-800" />
              </div>
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Modo Escuro</span>
                {theme === 'dark' && <Check className="w-3.5 h-3.5 text-[#52B4D8]" />}
              </div>
            </button>
          </div>
        </div>

        {/* 4. NOTIFICAÇÕES & ALERTAS INTELIGENTES */}
        <div className="bg-white dark:bg-[#131E32] rounded-3xl p-5 sm:p-6 border border-gray-100 dark:border-slate-800 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Notificações & Alertas
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Escolha quais avisos você deseja receber no seu aparelho
                </p>
              </div>
            </div>

            {/* Test Push Button */}
            <button
              onClick={handleTestTiNotification}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Testar envio de notificação push"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Testar</span>
            </button>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            
            {/* Toggle 1: Vagas de TI */}
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 flex items-center justify-between gap-3 border border-gray-100 dark:border-slate-800/80">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    Vagas de Tecnologia & TI
                  </span>
                  <span className="px-1.5 py-0.5 bg-[#4FA2C0]/15 text-[#4FA2C0] text-[10px] font-black rounded-md uppercase">
                    Destaque
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Receba alertas instantâneos de novos estágios e posições Tech em Araucária e Curitiba
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleTiJobsPush(!tiJobsPush)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
                  tiJobsPush ? 'bg-[#4FA2C0]' : 'bg-gray-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`h-5 w-5 rounded-full bg-white shadow-xs mt-0.5 ml-0.5 transition-transform ${
                    tiJobsPush ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 2: Vagas Gerais e Estágios */}
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 flex items-center justify-between gap-3 border border-gray-100 dark:border-slate-800/80">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  Vagas Gerais & Menor Aprendiz
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Notificações de vagas abertas no CIEE e empresas parceiras locais
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleGeneralNotifications(!generalNotifications)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
                  generalNotifications ? 'bg-[#4FA2C0]' : 'bg-gray-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`h-5 w-5 rounded-full bg-white shadow-xs mt-0.5 ml-0.5 transition-transform ${
                    generalNotifications ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 3: Novos Cursos & Dicas */}
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 flex items-center justify-between gap-3 border border-gray-100 dark:border-slate-800/80">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  Cursos & Dicas de Capacitação
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Avisos de novos módulos gratuitos de desenvolvimento profissional
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCourseAlerts(!courseAlerts)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
                  courseAlerts ? 'bg-[#4FA2C0]' : 'bg-gray-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`h-5 w-5 rounded-full bg-white shadow-xs mt-0.5 ml-0.5 transition-transform ${
                    courseAlerts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 4: Boletim Informativo / E-mail */}
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 flex items-center justify-between gap-3 border border-gray-100 dark:border-slate-800/80">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  Boletim Semanal por E-mail
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Resumo com as melhores oportunidades selecionadas para seu perfil
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleMarketing(!marketingEmails)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
                  marketingEmails ? 'bg-[#4FA2C0]' : 'bg-gray-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`h-5 w-5 rounded-full bg-white shadow-xs mt-0.5 ml-0.5 transition-transform ${
                    marketingEmails ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

          </div>
        </div>

        {/* 5. SEGURANÇA & ACESSO */}
        <div className="bg-white dark:bg-[#131E32] rounded-3xl p-5 sm:p-6 border border-gray-100 dark:border-slate-800 shadow-xs flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Segurança & Senha
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Gerencie sua senha de acesso e proteção da conta
              </p>
            </div>
          </div>

          {!showPasswordSection ? (
            <button
              onClick={() => setShowPasswordSection(true)}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-800 dark:text-gray-200 font-semibold transition-colors cursor-pointer group border border-gray-100 dark:border-slate-800/80"
            >
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-indigo-500" />
                <span className="text-sm">Alterar Senha de Acesso</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>
          ) : (
            <form onSubmit={handleUpdatePassword} className="flex flex-col gap-3 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 transition-all">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                  Nova Senha
                </span>
                <button
                  type="button"
                  onClick={() => setShowPasswordSection(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>

              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite sua nova senha (mín. 6 dígitos)"
                  className="w-full pl-4 pr-10 py-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm font-medium outline-none transition-all text-gray-800 dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme a nova senha"
                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm font-medium outline-none transition-all text-gray-800 dark:text-gray-100"
              />

              <button
                type="submit"
                disabled={isUpdatingPassword || !newPassword || newPassword !== confirmPassword}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-xs transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isUpdatingPassword ? 'Salvando Nova Senha...' : 'Salvar Nova Senha'}
              </button>
            </form>
          )}
        </div>

        {/* 6. PRIVACIDADE, TERMOS & SUPORTE */}
        <div className="bg-white dark:bg-[#131E32] rounded-3xl p-5 sm:p-6 border border-gray-100 dark:border-slate-800 shadow-xs flex flex-col gap-3">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-500">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Ajuda & Informações Legais
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Termos, privacidade e canal de suporte
              </p>
            </div>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {/* Mentor IA */}
            <button
              onClick={() => onNavigate('mentor')}
              className="w-full py-3 flex items-center justify-between text-left hover:text-[#4FA2C0] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-[#4FA2C0]" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-[#4FA2C0]">
                  Mentor Virtual de Carreira
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Suporte WhatsApp */}
            <button
              onClick={() => onNavigate('support')}
              className="w-full py-3 flex items-center justify-between text-left hover:text-emerald-500 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-emerald-500">
                  Falar com Suporte Oportuniza
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Termos de Uso */}
            <button
              onClick={() => onNavigate('terms')}
              className="w-full py-3 flex items-center justify-between text-left hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Termos de Uso do Serviço
                </span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {/* Política de Privacidade */}
            <button
              onClick={() => onNavigate('privacy')}
              className="w-full py-3 flex items-center justify-between text-left hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Política de Privacidade (LGPD)
                </span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* 7. DANGER ZONE & CACHE MANAGEMENT */}
        <div className="p-5 sm:p-6 rounded-3xl bg-red-50/60 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-2xl shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-900 dark:text-red-300">
                Limpeza de Cache Local
              </h4>
              <p className="text-xs text-red-700/70 dark:text-red-400/70 mt-0.5 leading-relaxed">
                Restaura o armazenamento temporário deste dispositivo caso haja algum dado em cache desatualizado.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-red-50 text-red-600 border border-red-200 dark:border-red-800 text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
          >
            Limpar Cache
          </button>
        </div>

        {/* 8. LOGOUT BUTTON (IF AVAILABLE) */}
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="w-full py-3.5 rounded-2xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <LogOut className="w-4 h-4 text-gray-500" />
            <span>Encerrar Sessão</span>
          </button>
        )}

        {/* App Version Info Footer */}
        <div className="text-center pt-2 pb-6">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-400">
            Oportuniza • Versão 2.4.0
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-400 mt-0.5">
            Conectando jovens a oportunidades reais de trabalho e aprendizado
          </p>
        </div>

      </main>

      {/* CONFIRMATION MODAL FOR CLEAR CACHE */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#131E32] rounded-3xl p-6 max-w-sm w-full border border-gray-100 dark:border-slate-800 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Limpar cache local?
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                Isso irá resetar dados temporários salvos no navegador. Sua conta e candidaturas no servidor permanecerão intactas.
              </p>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-200 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteData}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Limpando...' : 'Sim, Limpar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

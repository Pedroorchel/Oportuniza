import { Home, MessageSquare, Map, Settings, X, LogOut, Moon, Sun, Headphones, Briefcase, GraduationCap, FileText, User, Sparkles } from 'lucide-react';
import { ScreenId, User as UserType } from '../types';
import { useTheme } from '../lib/theme';
import { resolveUserHierarchyTier } from '../lib/hierarchyRoles';
const logo = 'https://www.image2url.com/r2/default/images/1781824138816-3fd9702f-4521-41d2-8411-d8fc61114350.png';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  unreadCount: number;
  user?: UserType | null;
  onSignOut: () => void;
  applicationsCount?: number;
}

export default function Sidebar({
  isOpen,
  onClose,
  currentScreen,
  onNavigate,
  unreadCount,
  user,
  onSignOut,
  applicationsCount = 0,
}: SidebarProps) {
  const [theme, toggleTheme] = useTheme();

  return (
    <>
      {/* Overlay */}
      <div
        className={`sidebar-overlay ${isOpen ? 'active' : ''}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`sidebar ${isOpen ? 'active' : ''} overflow-y-auto custom-scroll`}>
        <button
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          onClick={onClose}
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="sidebar-header mt-4">
          <div className="w-[60px] h-[60px] rounded-2xl bg-white flex items-center justify-center overflow-hidden shadow-sm shrink-0 border border-gray-100 dark:border-slate-800">
            <img src={logo} alt="Oportuniza" className="w-full h-full object-cover object-center block" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-gray-900 dark:text-white text-base block">
              Oportuniza
            </span>
            <p className="text-[10px] text-gray-400 dark:text-gray-400 font-medium">Araucária / PR</p>
          </div>
        </div>

        <nav className="sidebar-nav mt-4 flex flex-col gap-1">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Navegação
          </div>

          <button
            onClick={() => {
              onNavigate('home');
              onClose();
            }}
            className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-medium text-xs text-left transition-all cursor-pointer ${
              currentScreen === 'home'
                ? 'bg-primary/10 text-primary font-bold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Início</span>
          </button>

          <button
            onClick={() => {
              onNavigate('jobs');
              onClose();
            }}
            className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-medium text-xs text-left transition-all cursor-pointer ${
              currentScreen === 'jobs'
                ? 'bg-primary/10 text-primary font-bold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Vagas em Araucária</span>
          </button>

          <button
            onClick={() => {
              onNavigate('courses');
              onClose();
            }}
            className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-medium text-xs text-left transition-all cursor-pointer ${
              currentScreen === 'courses'
                ? 'bg-primary/10 text-primary font-bold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Cursos Gratuitos</span>
          </button>

          <button
            onClick={() => {
              onNavigate('applications');
              onClose();
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs text-left transition-all cursor-pointer ${
              currentScreen === 'applications'
                ? 'bg-primary/10 text-primary font-bold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <FileText className="w-4 h-4" />
              <span>Minhas Candidaturas</span>
            </div>
            {applicationsCount > 0 && (
              <span className="bg-sky-500 text-white font-bold text-[9px] rounded-full px-2 py-0.5">
                {applicationsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              onNavigate('mentor');
              onClose();
            }}
            className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-medium text-xs text-left transition-all cursor-pointer ${
              currentScreen === 'mentor'
                ? 'bg-primary/10 text-primary font-bold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Simulador de Entrevista</span>
          </button>

          <button
            onClick={() => {
              onNavigate('map');
              onClose();
            }}
            className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-medium text-xs text-left transition-all cursor-pointer ${
              currentScreen === 'map'
                ? 'bg-primary/10 text-primary font-bold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <Map className="w-4 h-4" />
            <span>Mapa de Empresas</span>
          </button>

          <button
            onClick={() => {
              onNavigate('messages');
              onClose();
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs text-left transition-all cursor-pointer ${
              currentScreen === 'messages'
                ? 'bg-primary/10 text-primary font-bold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <MessageSquare className="w-4 h-4" />
              <span>Mensagens & Avisos</span>
            </div>
            {unreadCount > 0 && (
              <span className="bg-rose-500 text-white font-bold text-[9px] rounded-full px-2 py-0.5 min-w-5 text-center">
                {unreadCount}
              </span>
            )}
          </button>

          <div className="my-2 border-t border-slate-100 dark:border-slate-800" />

          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Minha Conta
          </div>

          <button
            onClick={() => {
              onNavigate('profile');
              onClose();
            }}
            className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-medium text-xs text-left transition-all cursor-pointer ${
              currentScreen === 'profile'
                ? 'bg-primary/10 text-primary font-bold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Meu Perfil & Currículo</span>
          </button>

          <button
            onClick={() => {
              onNavigate('settings');
              onClose();
            }}
            className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-medium text-xs text-left transition-all cursor-pointer ${
              currentScreen === 'settings'
                ? 'bg-primary/10 text-primary font-bold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Configurações</span>
          </button>

          {/* Central de Atendimento Oportuniza (para Atendimento Nível 2 e Admins) */}
          {user && (
            (() => {
              const tier = resolveUserHierarchyTier(user);
              const isSupportUser = tier.id === 'support_service' || tier.id === 'admin_creator' || String(user.role || user.cargo || '').toLowerCase().includes('atendimento') || String(user.role || user.cargo || '').toLowerCase().includes('suporte');
              if (!isSupportUser) return null;

              return (
                <button
                  onClick={() => {
                    onNavigate('atendimento');
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm text-left transition-all ${
                    currentScreen === 'atendimento'
                      ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                      : 'text-sky-500 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Headphones className="w-4 h-4 text-sky-400" />
                    <span>Central de Atendimento</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 uppercase font-black">
                    Nível 2
                  </span>
                </button>
              );
            })()
          )}

          {/* Opção de Modo Escuro */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm text-left text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-4">
              {theme === 'dark' ? (
                <Moon className="w-4 h-4 text-sky-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
              <span>Modo Escuro</span>
            </div>
            <div 
              className={`w-8 h-4.5 rounded-full p-0.5 transition-colors flex items-center ${
                theme === 'dark' ? 'bg-primary justify-end' : 'bg-gray-300 dark:bg-slate-700 justify-start'
              }`}
            >
              <div className="w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform" />
            </div>
          </button>
          
          {user && (
            <button
              onClick={() => {
                onSignOut();
                onClose();
              }}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl font-medium text-sm text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          )}
        </nav>

        <div className="text-center text-[10px] text-gray-400 dark:text-gray-500 font-mono font-medium mt-auto pt-4 pb-4">
          Oportuniza | Versão 1.5.0
        </div>
      </div>
    </>
  );
}

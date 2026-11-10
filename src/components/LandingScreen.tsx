import { 
  ArrowRight, 
  Sparkles,
  Moon,
  Sun
} from 'lucide-react';
import { ScreenId } from '../types';
import DesktopLanding from './DesktopLanding';
import { useTheme } from '../lib/theme';
import { resolveAssetUrl } from '../lib/assets';

const logo = 'https://www.image2url.com/r2/default/images/1781824138816-3fd9702f-4521-41d2-8411-d8fc61114350.png';

const MOBILE_VACANCY_LOGOS = [
  { company: 'Petrobras REPAR', role: 'Operador Jr.', type: 'CLT', logoImg: '/assets/images/logo_petrobras_repar_1793965851183.jpg', location: 'Araucária' },
  { company: 'FarmaBem', role: 'Atendente', type: 'CLT', logoImg: '/assets/images/logo_farmabem_1793965852222.jpg', location: 'Centro' },
  { company: 'Berneck S.A.', role: 'Aprendiz', type: 'Aprendiz', logoImg: '/assets/images/logo_berneck_1793965852701.jpg', location: 'Thomaz C.' },
  { company: 'Indústria Metálika', role: 'Produção', type: 'CLT', logoImg: '/assets/images/logo_metalika_1793965852486.jpg', location: 'Distrito Ind.' },
  { company: 'Supermercados Sul', role: 'Caixa & Balcão', type: 'CLT', logoImg: '/assets/images/logo_super_sul_1793965854342.jpg', location: 'Costeira' },
  { company: 'Clínica Vida', role: 'Recepcionista', type: 'CLT', logoImg: '/assets/images/logo_clinica_vida_1793965854270.jpg', location: 'Fazenda V.' },
  { company: 'Logística Rápida', role: 'Assist. Log.', type: 'CLT', logoImg: '/assets/images/logo_logistica_rapida_1793965855652.jpg', location: 'Araucária' },
  { company: 'CSN Aços', role: 'Operador', type: 'CLT', logoImg: '/assets/images/logo_csn_araucaria_1793965855603.jpg', location: 'Araucária' },
  { company: 'Nexus Corp', role: 'Jovem Aprendiz', type: 'Aprendiz', logoImg: '/assets/images/logo_petrobras_repar_1793965851183.jpg', location: 'Capela Velha' },
];

interface LandingScreenProps {
  onNavigate: (screen: ScreenId) => void;
}

export default function LandingScreen({ onNavigate }: LandingScreenProps) {
  const [theme, toggleTheme] = useTheme();

  return (
    <div className="w-full h-full overflow-y-auto custom-scroll bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 relative select-none transition-colors">
      
      {/* Theme Toggle (Mobile only — Desktop header includes toggle inline) */}
      <div className="md:hidden absolute top-4 right-4 z-50">
        <button 
          type="button"
          onClick={toggleTheme}
          className="p-2.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-2xl shadow-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-all border border-gray-100 dark:border-slate-700 text-gray-700 dark:text-gray-300 cursor-pointer"
          title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-sky-500" />}
        </button>
      </div>
      {/* ========================================================================= */}
      {/* MOBILE VIEW (< md) - Modern, Native-Feel App Experience                  */}
      {/* ========================================================================= */}
      <div className="block md:hidden min-h-full pb-20">
        {/* Main Mobile Content Container */}
        <div className="px-4 pt-4 flex flex-col gap-4">
          {/* Hero Highlight Card */}
          <div className="bg-gradient-to-br from-white via-[#f0f8ff] to-[#f5f3ff] dark:from-[#131E32] dark:via-[#0F172A] dark:to-[#1E1B4B]/30 rounded-3xl p-5 border border-blue-100/80 dark:border-slate-800 shadow-[0_10px_30px_rgba(79,162,192,0.12)] flex flex-col gap-4">
            
            {/* Center Logo with glow */}
            <div className="w-full flex justify-center py-1">
              <div className="w-[180px] h-[180px] rounded-3xl shadow-[0_12px_32px_rgba(79,162,192,0.22)] overflow-hidden bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 relative p-1">
                <img 
                  src={logo} 
                  alt="Oportuniza Logo" 
                  className="w-full h-full object-contain object-center block select-none" 
                />
              </div>
            </div>

            {/* Title & Slogan */}
            <div className="text-center flex flex-col gap-1.5">
              <div className="inline-flex items-center justify-center gap-1.5 text-[11px] font-bold text-primary dark:text-[#52B4D8] bg-primary/10 dark:bg-primary/20 px-3 py-1 rounded-full w-fit mx-auto">
                <Sparkles className="w-3 h-3 text-primary dark:text-[#52B4D8]" />
                <span>Vagas, Cursos e IA em Araucária</span>
              </div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-snug pt-1">
                Seu futuro profissional começa aqui
              </h1>
              <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed px-1">
                Estágios, menor aprendiz e CLT, minicursos com certificado grátis em PDF e mentor IA de entrevista.
              </p>
            </div>

            {/* Quick Action CTA Buttons */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                className="w-full py-3.5 rounded-2xl bg-primary hover:bg-primary-dark text-white text-sm font-bold shadow-[0_8px_20px_rgba(79,162,192,0.35)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                onClick={() => onNavigate('login')}
              >
                <span>Começar Agora Gratuitamente</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              
              <button
                className="w-full py-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs font-semibold border border-gray-200 dark:border-slate-700 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                onClick={() => onNavigate('bio')}
              >
                Conhecer a Plataforma (Bio)
              </button>
            </div>

            {/* Infinite Marquee of Hiring Logos for Mobile (Larger, Single Row) */}
            <div className="pt-2.5 border-t border-gray-200/60 dark:border-slate-800 flex flex-col gap-2 overflow-hidden">
              <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-slate-300 px-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Vagas abertas em Araucária:
                </span>
                <button 
                  onClick={() => onNavigate('login')}
                  className="text-primary dark:text-[#52B4D8] font-bold text-[11px] hover:underline"
                >
                  Ver Todas
                </button>
              </div>

              <div className="relative w-full overflow-hidden py-1">
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-[#131E32] to-transparent z-10 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-[#131E32] to-transparent z-10 pointer-events-none" />
                <div className="animate-marquee-infinite flex gap-3">
                  {[...MOBILE_VACANCY_LOGOS, ...MOBILE_VACANCY_LOGOS, ...MOBILE_VACANCY_LOGOS, ...MOBILE_VACANCY_LOGOS].map((item, idx) => (
                    <div 
                      key={`mob-vac-${idx}`}
                      onClick={() => onNavigate('login')}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-gray-200/90 dark:border-slate-700 shadow-xs shrink-0 cursor-pointer text-left min-w-[220px]"
                    >
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xs shrink-0 p-0.5 flex items-center justify-center ring-2 ring-black/5 dark:ring-white/5">
                        <img 
                          src={resolveAssetUrl(item.logoImg)} 
                          alt={item.company} 
                          className="w-full h-full object-contain rounded-lg"
                          loading="lazy"
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-black text-gray-900 dark:text-white leading-tight truncate">
                          {item.company}
                        </span>
                        <span className="text-[10px] text-primary dark:text-[#52B4D8] font-bold leading-tight truncate">
                          {item.role} • {item.location}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3 Step Timeline */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#131E32] border border-gray-100 dark:border-slate-800 shadow-xs flex flex-col gap-3 mt-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-primary dark:text-[#52B4D8]">Como funciona em 3 passos</h2>
            
            <div className="flex flex-col gap-3.5 pl-1.5 border-l-2 border-primary/20 dark:border-primary/40">
              <div className="relative pl-3.5">
                <div className="absolute left-[-11px] top-0.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-[9px] font-bold shadow-xs">1</div>
                <strong className="text-xs font-bold text-gray-900 dark:text-white block">Crie sua Conta Grátis</strong>
                <span className="text-[10px] text-gray-500 dark:text-slate-400">Cadastre-se em menos de 1 minuto.</span>
              </div>
              
              <div className="relative pl-3.5">
                <div className="absolute left-[-11px] top-0.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-[9px] font-bold shadow-xs">2</div>
                <strong className="text-xs font-bold text-gray-900 dark:text-white block">Candidate-se & Estude</strong>
                <span className="text-[10px] text-gray-500 dark:text-slate-400">Envie currículo para vagas e assista minicursos.</span>
              </div>

              <div className="relative pl-3.5">
                <div className="absolute left-[-11px] top-0.5 w-5 h-5 rounded-full bg-[#6C63FF] flex items-center justify-center text-white text-[9px] font-bold shadow-xs">3</div>
                <strong className="text-xs font-bold text-gray-900 dark:text-white block">Emita seu Certificado</strong>
                <span className="text-[10px] text-gray-500 dark:text-slate-400">Gere PDF instantâneo com selo oficial.</span>
              </div>
            </div>
          </div>

          {/* Bottom Floating CTA Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-primary to-[#6C63FF] text-white flex flex-col gap-2.5 shadow-md text-center">
            <h3 className="text-sm font-bold">Pronto para conquistar sua vaga?</h3>
            <p className="text-[11px] text-blue-100">Junte-se à comunidade de Araucária agora mesmo.</p>
            <button
              onClick={() => onNavigate('register')}
              className="w-full py-2.5 rounded-xl bg-white text-gray-900 text-xs font-bold shadow-xs hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
            >
              Cadastrar Gratuitamente
            </button>
          </div>

          {/* Footer links */}
          <div className="text-center text-[10px] text-gray-400 dark:text-slate-500 py-3 flex items-center justify-center gap-4">
            <button onClick={() => onNavigate('privacy')} className="hover:text-primary dark:hover:text-primary cursor-pointer">Privacidade</button>
            <span>•</span>
            <button onClick={() => onNavigate('terms')} className="hover:text-primary dark:hover:text-primary cursor-pointer">Termos</button>
            <span>•</span>
            <button onClick={() => onNavigate('bio')} className="hover:text-primary dark:hover:text-primary cursor-pointer">Sobre</button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP VIEW (>= md) - Dedicated High-Performance PC Experience          */}
      {/* ========================================================================= */}
      <div className="hidden md:block w-full min-h-full">
        <DesktopLanding onNavigate={onNavigate} />
      </div>
    </div>
  );
}

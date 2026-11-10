import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, Filter, MapPin, Briefcase, Clock, DollarSign, Building, Heart, CheckCircle2, Bookmark, ChevronRight, ArrowLeft, Globe, Sparkles, Calendar } from 'lucide-react';
import { Job, Application } from '../types';
import { mockJobs, loadJobsFromSupabase } from '../data';
import { isImageAssetUrl, resolveAssetUrl } from '../lib/assets';

interface JobsSectionProps {
  applications: Application[];
  onApply: (job: Job) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onBack: () => void;
  onNavigateToDetailsJob: (job: Job) => void;
  initialSearchQuery?: string;
}

export default function JobsSection({
  applications,
  onApply,
  favorites,
  onToggleFavorite,
  onBack,
  onNavigateToDetailsJob,
  initialSearchQuery = '',
}: JobsSectionProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedType, setSelectedType] = useState<string>('Todos');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('Todos');
  const [activeTab, setActiveTab] = useState<'vagas' | 'favoritos' | 'candidaturas'>('vagas');
  const [jobsList, setJobsList] = useState<Job[]>(() => [...mockJobs]);

  useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  const ARAUCARIA_NEIGHBORHOODS = [
    'Todos',
    'Centro',
    'Costeira',
    'Capela Velha',
    'Fazenda Velha',
    'Thomaz Coelho',
    'Campina da Barra',
    'Iguaçu',
    'Polo Petrobras',
    'Tindiquera',
    'Barigui'
  ];

  useEffect(() => {
    loadJobsFromSupabase().then(() => {
      setJobsList([...mockJobs]);
    });

    const handleJobsChanged = () => {
      setJobsList([...mockJobs]);
    };

    window.addEventListener('oportuniza-jobs-changed', handleJobsChanged);
    return () => {
      window.removeEventListener('oportuniza-jobs-changed', handleJobsChanged);
    };
  }, []);

  const checkNeighborhoodMatch = (job: Job) => {
    if (!selectedNeighborhood || selectedNeighborhood === 'Todos') return true;
    const loc = (job.location || '').toLowerCase();
    const desc = (job.description || '').toLowerCase();
    const comp = (job.company || '').toLowerCase();

    if (selectedNeighborhood === 'Polo Petrobras') {
      return loc.includes('petrobras') || loc.includes('polo') || loc.includes('industrial') || desc.includes('petrobras');
    }
    const target = selectedNeighborhood.toLowerCase();
    return loc.includes(target) || desc.includes(target) || comp.includes(target);
  };

  // Filter logic for jobs
  const filteredJobs = jobsList.filter((job) => {
    // Hide job if user already applied to it
    const hasApplied = applications.some((app) => app.jobId === job.id);
    if (hasApplied) return false;

    const matchesSearch =
      (job.title || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (job.company || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (job.category || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (job.location || '').toLowerCase().includes((searchQuery || '').toLowerCase());

    const matchesType = 
      selectedType === 'Todos' ? true :
      selectedType === 'TI' ? (job.category === 'Tecnologia') :
      (job.type === selectedType);

    const matchesNeighborhood = checkNeighborhoodMatch(job);

    return matchesSearch && matchesType && matchesNeighborhood;
  });

  // Filter logic for favorited jobs
  const favoritedJobs = jobsList.filter((job) => {
    const isFav = favorites.includes(job.id);
    if (!isFav) return false;

    // Hide job if user already applied to it
    const hasApplied = applications.some((app) => app.jobId === job.id);
    if (hasApplied) return false;

    const matchesSearch =
      (job.title || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (job.company || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (job.location || '').toLowerCase().includes((searchQuery || '').toLowerCase());

    const matchesType = 
      selectedType === 'Todos' ? true :
      selectedType === 'TI' ? (job.category === 'Tecnologia') :
      (job.type === selectedType);

    const matchesNeighborhood = checkNeighborhoodMatch(job);

    return matchesSearch && matchesType && matchesNeighborhood;
  });

  const getApplicationStatus = (jobId: string) => {
    return applications.find((app) => app.jobId === jobId)?.status;
  };

  // Safe tab navigation that resets detail view
  const handleTabChange = (tab: 'vagas' | 'favoritos' | 'candidaturas') => {
    setActiveTab(tab);
  };

  const currentJobsList = activeTab === 'favoritos' ? favoritedJobs : filteredJobs;

  return (
    <div className="w-full h-full flex flex-col bg-[#F9FAFB] absolute inset-0">
      {/* Header with Sub-Tabs */}
      <header className="px-4 pt-5 pb-3.5 bg-white border-b border-gray-100 flex items-center justify-between shadow-sm shrink-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={onBack}
            className="p-1 px-1.5 rounded-lg hover:bg-gray-100 active:scale-95 transition-transform text-gray-600 hover:text-gray-900 cursor-pointer shrink-0"
            color="currentColor"
            aria-label="Voltar para o início"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-base font-bold text-gray-900 font-sans tracking-tight truncate">Vagas Disponíveis</h1>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scroll p-4">
        {/* List Views */}
        <div className="flex flex-col gap-4 animate-fadeIn">
          {/* Search and Filters */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
              <div className="relative flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={activeTab === 'favoritos' ? "Pesquisar nos favoritos..." : "Pesquisar cargo, empresa, bairro..."}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-base focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>

              {/* Badges filter: Tipo de Contrato */}
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 custom-scroll no-scrollbar select-none">
                {['Todos', 'TI', 'Estágio', 'Jovem Aprendiz', 'CLT'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`text-xs uppercase tracking-wider font-bold py-1.5 px-3 rounded-lg shrink-0 transition-colors cursor-pointer ${
                      selectedType === type
                        ? 'bg-primary/10 text-primary border border-primary/25'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Badges filter: Bairro de Araucária */}
              <div className="pt-2 border-t border-gray-100 flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scroll no-scrollbar select-none">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 flex items-center gap-1 shrink-0 pr-1">
                  <MapPin className="w-3.5 h-3.5 text-[#52A8C7]" /> Bairro:
                </span>
                {ARAUCARIA_NEIGHBORHOODS.map((nh) => (
                  <button
                    key={nh}
                    onClick={() => setSelectedNeighborhood(nh)}
                    className={`text-[11px] font-semibold py-1 px-2.5 rounded-lg shrink-0 transition-all cursor-pointer ${
                      selectedNeighborhood === nh
                        ? 'bg-[#52A8C7] text-white shadow-xs'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                    }`}
                  >
                    {nh === 'Todos' ? 'Todos os Bairros' : nh}
                  </button>
                ))}
              </div>
            </div>

            {/* List Header Count label */}
            <div className="flex justify-between items-center px-1">
              <span className="text-xs font-bold text-gray-400 font-mono tracking-wider">
                {activeTab === 'favoritos'
                  ? `${currentJobsList.length} VAGAS SALVAS`
                  : `${currentJobsList.length} VAGAS DISPONÍVEIS`}
              </span>
            </div>

            {/* Empty States */}
            {currentJobsList.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center">
                <Briefcase className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-sm font-semibold text-gray-700">
                  {activeTab === 'favoritos' ? 'Nenhuma vaga favorita' : 'Nenhuma vaga encontrada'}
                </p>
                <p className="text-xs text-gray-400 mt-1 max-w-[200px] mx-auto text-center leading-normal">
                  {activeTab === 'favoritos'
                    ? 'Marque o ícone de coração nas vagas para salvá-las aqui e acessá-las com facilidade.'
                    : 'Experimente buscar por outros termos ou redefinir seus filtros de busca.'}
                </p>
                {(selectedNeighborhood !== 'Todos' || selectedType !== 'Todos' || searchQuery) && (
                  <button
                    onClick={() => {
                      setSelectedNeighborhood('Todos');
                      setSelectedType('Todos');
                      setSearchQuery('');
                    }}
                    className="mt-3 text-xs font-bold text-[#52A8C7] hover:underline cursor-pointer"
                  >
                    Limpar filtros e ver todas as vagas
                  </button>
                )}
              </div>
            ) : (
              /* Jobs Cards Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
                {currentJobsList.map((job, index) => {
                  const hasApplied = getApplicationStatus(job.id);
                  const isFav = favorites.includes(job.id);

                  // Color mapping for contract type badges
                  const typeColors: Record<string, string> = {
                    'Estágio': 'bg-sky-50 text-sky-600 border-sky-100',
                    'Jovem Aprendiz': 'bg-teal-50 text-teal-600 border-teal-100',
                    'CLT': 'bg-indigo-50 text-indigo-600 border-indigo-100',
                    'Freelancer': 'bg-amber-50 text-amber-600 border-amber-100',
                  };
                  const typeStyle = typeColors[job.type] || 'bg-gray-50 text-gray-600 border-gray-100';

                  return (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                      whileHover={{ y: -6, scale: 1.01 }}
                      onClick={() => onNavigateToDetailsJob(job)}
                      className={`group bg-white rounded-3xl p-5 border border-gray-100/90 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between relative border-l-4 ${job.color || 'border-l-transparent'}`}
                    >
                      <div>
                        {/* Applied Tag Overlay if needed */}
                        {hasApplied && (
                          <div className="absolute top-4 right-4 bg-emerald-50 text-emerald-600 font-bold text-[10px] tracking-wider uppercase px-2.5 py-1 rounded-full shadow-sm border border-emerald-100 flex items-center gap-1 z-10">
                            <CheckCircle2 className="w-3.5 h-3.5 fill-current text-emerald-100 text-emerald-600" />
                            <span>Candidatado</span>
                          </div>
                        )}

                        {/* Card Header: Company Logo & Basic info */}
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 font-bold text-gray-600 font-sans text-lg shrink-0 overflow-hidden shadow-inner">
                            {isImageAssetUrl(job.logo) ? (
                              <img src={resolveAssetUrl(job.logo)} alt={job.company} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              job.company.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0 pr-16">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                              {job.category}
                            </span>
                            <h3 className="text-base font-bold text-gray-900 tracking-tight leading-snug truncate mt-0.5 group-hover:text-[#4EA8C7] transition-colors duration-200">
                              {job.title}
                            </h3>
                            <p className="text-xs font-semibold text-teal-600 mt-0.5 flex items-center gap-1">
                              <Building className="w-3.5 h-3.5" />
                              <span>{job.company}</span>
                            </p>
                          </div>
                        </div>

                        {/* Mid Row: Info tags */}
                        <div className="flex flex-wrap gap-1.5 mt-4">
                          <span className={`text-[11px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-lg border flex items-center gap-1 ${typeStyle}`}>
                            <Clock className="w-3 h-3" />
                            {job.type}
                          </span>
                          
                          <span className="bg-emerald-50 text-emerald-600 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-emerald-100/50 flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-emerald-500" />
                            {job.salary}
                          </span>

                          <span className="bg-gray-50 text-gray-500 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-gray-100 flex items-center gap-1 truncate max-w-[150px]">
                            <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                            <span>{job.location}</span>
                          </span>

                          {job.isRemote && (
                            <span className="bg-indigo-50 text-indigo-600 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-indigo-100/50 flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              <span>Remoto</span>
                            </span>
                          )}
                        </div>

                        {/* Short Description */}
                        <p className="text-xs text-gray-500 leading-relaxed mt-4 line-clamp-3">
                          {job.description}
                        </p>

                        {/* Key Requirements Highlights */}
                        {job.requirements && job.requirements.length > 0 && (
                          <div className="mt-4 flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-yellow-500" /> Requisitos do Perfil:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {job.requirements.slice(0, 2).map((req, rIdx) => (
                                <span key={rIdx} className="bg-slate-50 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded border border-slate-100 truncate max-w-full">
                                  • {req}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Start and End Dates */}
                        {job.startDate && job.endDate && (
                          <div className="mt-3 py-1.5 px-3 bg-teal-50/70 border border-teal-100 rounded-xl flex items-center justify-between text-[11px] text-teal-800 font-medium">
                            <span className="flex items-center gap-1 font-semibold">
                              <Calendar className="w-3.5 h-3.5 text-teal-600" /> Inscrições:
                            </span>
                            <span className="font-mono text-[10px] text-teal-700">
                              {job.startDate} até {job.endDate}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="flex flex-col gap-2 mt-5 pt-4 border-t border-gray-50/80">
                        <button 
                          onClick={() => onNavigateToDetailsJob(job)}
                          className="w-full bg-[#4EA8C7] text-white font-bold py-3 rounded-xl text-xs hover:bg-[#3d90ad] transition-all duration-200 flex items-center justify-center shadow-md shadow-teal-500/10 hover:shadow-lg hover:shadow-teal-500/20 active:scale-98">
                          Ver Detalhes da Vaga
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(job.id);
                          }}
                          className={`w-full font-bold py-3 rounded-xl text-xs transition-all duration-200 flex items-center justify-center gap-1.5 border active:scale-98 ${
                            isFav 
                              ? 'bg-rose-50 text-rose-600 border-rose-200/80 hover:bg-rose-100'
                              : 'bg-gray-50 text-gray-700 border-gray-200/50 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-gray-400 group-hover:text-gray-600'}`} />
                          <span>{isFav ? 'Remover dos Favoritos' : 'Salvar nos Favoritos'}</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

        {/* Candidaturas tracking timeline list */}
        {activeTab === 'candidaturas' && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            <span className="text-xs font-bold text-gray-400 font-mono tracking-wider px-1">
              {applications.length} PROCESSOS DE CANDIDATURA SEGUIDOS
            </span>

            {applications.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center">
                <CheckCircle2 className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-sm font-semibold text-gray-700">Nenhuma candidatura registrada</p>
                <p className="text-xs text-gray-400 mt-1 max-w-[210px] text-center leading-normal">
                  Navegue pelas vagas e clique em "Confirmar Candidatura" para ver seu progresso de análise em tempo real aqui.
                </p>
                <button
                  onClick={() => setActiveTab('vagas')}
                  className="mt-4 text-sm bg-primary text-white font-bold py-2 px-4 rounded-xl cursor-pointer hover:bg-primary-dark shadow"
                >
                  Ver vagas ativas
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {applications.map((app, index) => (
                  <motion.div
                    key={app.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    whileHover={{ scale: 1.01, translateY: -1 }}
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3.5"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-base font-bold text-gray-800 leading-tight pr-2">{app.jobTitle}</h4>
                        <p className="text-xs text-gray-400 font-medium mt-1">{app.company} • Candidatado em {app.appliedDate}</p>
                      </div>

                      <span
                        className={`text-[14px] uppercase font-bold tracking-wide px-2.5 py-1 rounded-full shrink-0 ${
                          app.status === 'Em análise'
                            ? 'bg-amber-50 text-amber-600 border border-amber-100/50'
                            : app.status === 'Entrevista'
                            ? 'bg-blue-50 text-blue-600 border border-blue-100/50'
                            : app.status === 'Aprovado'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50'
                            : 'bg-red-50 text-red-600 border border-red-100/50'
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>

                    {/* Simple Timeline Progress visualization */}
                    <div className="flex justify-between items-center px-1 mt-1 font-mono text-[14px] text-gray-400 font-semibold select-none">
                      <div className="flex flex-col items-center gap-1 flex-1 relative">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white ring-2 ring-emerald-500/20 z-10" />
                        <span className="mt-1">Enviado</span>
                        <div className="absolute top-[5px] left-[50%] right-[-50%] h-[1.5px] bg-emerald-500" />
                      </div>

                      <div className="flex flex-col items-center gap-1 flex-1 relative">
                        <div className={`w-2.5 h-2.5 rounded-full ${['Em análise', 'Entrevista', 'Aprovado'].includes(app.status) ? 'bg-emerald-500' : 'bg-gray-200'} border-2 border-white z-10`} />
                        <span className="mt-1">Em análise</span>
                        <div className={`absolute top-[5px] left-[50%] right-[-50%] h-[1.5px] ${['Entrevista', 'Aprovado'].includes(app.status) ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                      </div>

                      <div className="flex flex-col items-center gap-1 flex-1 relative">
                        <div className={`w-2.5 h-2.5 rounded-full ${['Entrevista', 'Aprovado'].includes(app.status) ? 'bg-emerald-500' : 'bg-gray-200'} border-2 border-white z-10`} />
                        <span className="mt-1">Entrevista</span>
                        <div className={`absolute top-[5px] left-[50%] right-[-50%] h-[1.5px] ${app.status === 'Aprovado' ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                      </div>

                      <div className="flex flex-col items-center gap-1 flex-1">
                        <div className={`w-2.5 h-2.5 rounded-full ${app.status === 'Aprovado' ? 'bg-emerald-500' : 'bg-gray-200'} border-2 border-white z-10`} />
                        <span className="mt-1">Aprovado</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

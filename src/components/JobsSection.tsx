import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Search,
  MapPin,
  Briefcase,
  Clock,
  DollarSign,
  Building,
  Heart,
  CheckCircle2,
  ArrowLeft,
  Globe,
  Sparkles,
  Calendar,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  Send,
  Compass,
  BookmarkCheck,
  Gift,
  XCircle,
} from 'lucide-react';
import { Job, Application } from '../types';
import { mockJobs, loadJobsFromSupabase } from '../data';
import { isImageAssetUrl, resolveAssetUrl } from '../lib/assets';
import { resolveJobCoordinates } from '../lib/araucariaLocations';

interface JobsSectionProps {
  applications: Application[];
  onApply: (job: Job) => void;
  onCancelApplication?: (id: string) => Promise<void> | void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onBack: () => void;
  onNavigateToDetailsJob: (job: Job) => void;
  onQuickApply?: (job: Job) => void;
  onViewOnMap?: (job?: Job) => void;
  initialSearchQuery?: string;
}

type SortOption = 'recent' | 'salary_desc' | 'alpha';
type ModalityFilter = 'all' | 'onsite' | 'remote';

const ARAUCARIA_NEIGHBORHOODS = [
  'Todos',
  'Centro',
  'Costeira',
  'Capela Velha',
  'Fazenda Velha',
  'Iguaçu',
  'Estação',
  'Passa Dois',
  'Thomaz Coelho',
  'Campina da Barra',
  'Tindiquera',
  'Barigui',
  'Boqueirão',
  'Itaqui',
  'Polo Petrobras',
  'Curitiba',
];

const CONTRACT_TYPES = ['Todos', 'CLT', 'Estágio', 'Jovem Aprendiz', 'Temporário', 'PJ', 'Freelancer'];

const formatPtBrDate = (value?: string): string => {
  if (!value) return '';
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  }
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    }
  }
  return str;
};

const parseSalaryValue = (salary?: string): number => {
  if (!salary) return 0;
  const cleaned = salary.replace(/[^\d,]/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
};

export default function JobsSection({
  applications,
  onCancelApplication,
  favorites,
  onToggleFavorite,
  onBack,
  onNavigateToDetailsJob,
  onQuickApply,
  onViewOnMap,
  initialSearchQuery = '',
}: JobsSectionProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedType, setSelectedType] = useState<string>('Todos');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('Todos');
  const [modality, setModality] = useState<ModalityFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [hideApplied, setHideApplied] = useState<boolean>(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'vagas' | 'favoritos' | 'candidaturas'>('vagas');
  const [jobsList, setJobsList] = useState<Job[]>(() => [...mockJobs]);

  useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

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

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    jobsList.forEach((j) => {
      if (j.category && j.category.trim()) {
        cats.add(j.category.trim());
      }
    });
    return ['Todas', ...Array.from(cats).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }, [jobsList]);

  const checkNeighborhoodMatch = (job: Job) => {
    if (!selectedNeighborhood || selectedNeighborhood === 'Todos') return true;
    const loc = `${job.location || ''} ${job.companyNeighborhood || ''} ${job.companyAddress || ''}`.toLowerCase();
    const desc = (job.description || '').toLowerCase();

    if (selectedNeighborhood === 'Polo Petrobras') {
      return (
        loc.includes('petrobras') ||
        loc.includes('polo') ||
        loc.includes('repar') ||
        loc.includes('industrial') ||
        desc.includes('petrobras')
      );
    }
    const target = selectedNeighborhood.toLowerCase();
    return loc.includes(target) || desc.includes(target);
  };

  const getApplicationForJob = (jobId: string) => {
    return applications.find((app) => app.jobId === jobId);
  };

  const applyFiltersAndSort = (source: Job[], onlyFavorites: boolean) => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = source.filter((job) => {
      if (onlyFavorites && !favorites.includes(job.id)) return false;

      const applied = applications.some((app) => app.jobId === job.id);
      if (hideApplied && applied) return false;

      if (modality === 'remote' && !job.isRemote) return false;
      if (modality === 'onsite' && job.isRemote) return false;

      if (selectedType !== 'Todos' && (job.type || '').toLowerCase() !== selectedType.toLowerCase()) {
        return false;
      }

      if (selectedCategory !== 'Todas' && (job.category || '').toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }

      if (!checkNeighborhoodMatch(job)) return false;

      if (q) {
        const reqText = Array.isArray(job.requirements) ? job.requirements.join(' ') : '';
        const haystack = `${job.title} ${job.company} ${job.category} ${job.location} ${job.companyNeighborhood || ''} ${job.description} ${reqText}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    if (sortBy === 'salary_desc') {
      return [...filtered].sort((a, b) => parseSalaryValue(b.salary) - parseSalaryValue(a.salary));
    }
    if (sortBy === 'alpha') {
      return [...filtered].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'pt-BR'));
    }
    return filtered;
  };

  const filteredJobs = useMemo(
    () => applyFiltersAndSort(jobsList, false),
    [jobsList, favorites, applications, hideApplied, modality, selectedType, selectedCategory, selectedNeighborhood, searchQuery, sortBy]
  );

  const favoritedJobs = useMemo(
    () => applyFiltersAndSort(jobsList, true),
    [jobsList, favorites, applications, hideApplied, modality, selectedType, selectedCategory, selectedNeighborhood, searchQuery, sortBy]
  );

  const currentJobsList = activeTab === 'favoritos' ? favoritedJobs : filteredJobs;

  const activeFiltersCount =
    (selectedType !== 'Todos' ? 1 : 0) +
    (selectedCategory !== 'Todas' ? 1 : 0) +
    (selectedNeighborhood !== 'Todos' ? 1 : 0) +
    (modality !== 'all' ? 1 : 0) +
    (hideApplied ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedType('Todos');
    setSelectedCategory('Todas');
    setSelectedNeighborhood('Todos');
    setModality('all');
    setHideApplied(false);
    setSearchQuery('');
    setSortBy('recent');
  };

  const remoteCount = useMemo(() => jobsList.filter((j) => j.isRemote).length, [jobsList]);

  return (
    <div className="w-full h-full flex flex-col bg-[#F4F7FA] dark:bg-[#0B1120] absolute inset-0 transition-colors">
      {/* Header + Sub-tabs */}
      <header className="px-4 sm:px-6 pt-4 pb-0 bg-white dark:bg-[#131E32] border-b border-gray-200/80 dark:border-slate-800 shadow-2xs shrink-0 transition-colors">
        <div className="max-w-6xl mx-auto flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={onBack}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 active:scale-95 transition-all text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white cursor-pointer shrink-0 border border-gray-200/70 dark:border-slate-700/80 dark:bg-slate-800/60"
                aria-label="Voltar para o início"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white font-sans tracking-tight truncate">
                  Vagas de Emprego
                </h1>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">
                  Araucária, Região Metropolitana e oportunidades remotas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onViewOnMap && (
                <button
                  type="button"
                  onClick={() => onViewOnMap()}
                  className="px-3 py-1.5 rounded-xl bg-sky-50/95 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-[#085C77] dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/60 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5 text-[#52A8C7] dark:text-sky-400" />
                  <span className="hidden sm:inline">Ver no Mapa</span>
                  <span className="sm:hidden">Mapa</span>
                </button>
              )}
            </div>
          </div>

          {/* Interactive Tab Switcher */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('vagas')}
              className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'vagas'
                  ? 'border-[#52A8C7] text-[#085C77] dark:text-sky-300'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Todas as Vagas</span>
              <span className="bg-gray-100/95 dark:bg-slate-800 text-gray-700 dark:text-slate-200 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold">
                {filteredJobs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('favoritos')}
              className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'favoritos'
                  ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${activeTab === 'favoritos' ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span>Salvas</span>
              <span className="bg-rose-50/95 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold">
                {favoritedJobs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('candidaturas')}
              className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'candidaturas'
                  ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
              }`}
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>Candidaturas</span>
              <span className="bg-emerald-50/95 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold">
                {applications.length}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Scroll Area */}
      <div className="flex-1 overflow-y-auto custom-scroll p-4 sm:p-6 pb-20">
        <div className="max-w-6xl mx-auto flex flex-col gap-5">
          {activeTab !== 'candidaturas' && (
            <>
              {/* Search + Quick Filters Card */}
              <div className="bg-white dark:bg-[#131E32] p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-slate-800 shadow-xs flex flex-col gap-3.5 transition-colors">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1 flex items-center">
                    <Search className="absolute left-3.5 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={
                        activeTab === 'favoritos'
                          ? 'Buscar nas vagas salvas...'
                          : 'Cargo, empresa, habilidade ou bairro (ex: Operador, TI, Costeira)...'
                      }
                      className="w-full bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-9 text-sm text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1120] focus:ring-2 focus:ring-[#52A8C7]/25 focus:border-[#52A8C7] outline-none transition-all"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-pointer"
                        aria-label="Limpar busca"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Sort dropdown */}
                    <div className="relative flex items-center bg-gray-50/95 dark:bg-[#0F172A] border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200">
                      <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400 mr-1.5 shrink-0" />
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="bg-transparent outline-none cursor-pointer pr-1 font-bold text-gray-700 dark:text-slate-100 dark:bg-[#0F172A]"
                        aria-label="Ordenar vagas"
                      >
                        <option value="recent" className="dark:bg-[#0F172A] dark:text-slate-100">Mais recentes</option>
                        <option value="salary_desc" className="dark:bg-[#0F172A] dark:text-slate-100">Maior salário</option>
                        <option value="alpha" className="dark:bg-[#0F172A] dark:text-slate-100">Ordem A-Z</option>
                      </select>
                    </div>

                    {/* Advanced Filters Toggle */}
                    <button
                      type="button"
                      onClick={() => setShowFiltersPanel((prev) => !prev)}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        showFiltersPanel || selectedCategory !== 'Todas' || modality !== 'all' || hideApplied
                          ? 'bg-[#52A8C7]/15 border-[#52A8C7]/45 text-[#085C77] dark:text-sky-300'
                          : 'bg-gray-50/95 dark:bg-slate-800/80 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Filtros</span>
                      {activeFiltersCount > 0 && (
                        <span className="bg-[#52A8C7] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-black">
                          {activeFiltersCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Contract Types Strip */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar select-none">
                  {CONTRACT_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSelectedType(type)}
                      className={`text-xs font-bold py-1.5 px-3 rounded-lg shrink-0 transition-colors cursor-pointer border ${
                        selectedType === type
                          ? 'bg-[#085C77] dark:bg-[#52A8C7] text-white border-[#085C77] dark:border-[#52A8C7] shadow-2xs'
                          : 'bg-gray-50/95 dark:bg-slate-800/80 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 border-gray-200/70 dark:border-slate-700/80'
                      }`}
                    >
                      {type}
                    </button>
                  ))}

                  <div className="h-4 w-px bg-gray-200 dark:bg-slate-700 mx-1 shrink-0" />

                  <button
                    type="button"
                    onClick={() => setModality(modality === 'remote' ? 'all' : 'remote')}
                    className={`text-xs font-bold py-1.5 px-3 rounded-lg shrink-0 transition-colors cursor-pointer border flex items-center gap-1 ${
                      modality === 'remote'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border-indigo-200/60 dark:border-indigo-800/60'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Remoto ({remoteCount})</span>
                  </button>
                </div>

                {/* Expandable Extra Filters Panel */}
                {showFiltersPanel && (
                  <div className="pt-3 border-t border-gray-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fadeIn">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-slate-400">
                        Área / Categoria
                      </label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 dark:text-slate-100 outline-none focus:border-[#52A8C7] cursor-pointer"
                      >
                        {availableCategories.map((cat) => (
                          <option key={cat} value={cat} className="dark:bg-[#0F172A] dark:text-slate-100">
                            {cat === 'Todas' ? 'Todas as Áreas' : cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-slate-400">
                        Modalidade de Trabalho
                      </label>
                      <select
                        value={modality}
                        onChange={(e) => setModality(e.target.value as ModalityFilter)}
                        className="bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 dark:text-slate-100 outline-none focus:border-[#52A8C7] cursor-pointer"
                      >
                        <option value="all" className="dark:bg-[#0F172A] dark:text-slate-100">Presencial e Remoto</option>
                        <option value="onsite" className="dark:bg-[#0F172A] dark:text-slate-100">Apenas Presencial</option>
                        <option value="remote" className="dark:bg-[#0F172A] dark:text-slate-100">Apenas Remoto / Híbrido</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center gap-2 bg-gray-50/95 dark:bg-[#0F172A] border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 w-full cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                        <input
                          type="checkbox"
                          checked={hideApplied}
                          onChange={(e) => setHideApplied(e.target.checked)}
                          className="w-4 h-4 accent-[#52A8C7] rounded cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-gray-700 dark:text-slate-200">
                          Ocultar vagas já candidatadas
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Neighborhood Filter Strip */}
                <div className="pt-2.5 border-t border-gray-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar select-none">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-slate-400 flex items-center gap-1 shrink-0 pr-1">
                    <MapPin className="w-3.5 h-3.5 text-[#52A8C7]" /> Bairro:
                  </span>
                  {ARAUCARIA_NEIGHBORHOODS.map((nh) => (
                    <button
                      key={nh}
                      type="button"
                      onClick={() => setSelectedNeighborhood(nh)}
                      className={`text-[11px] font-semibold py-1 px-2.5 rounded-lg shrink-0 transition-all cursor-pointer border ${
                        selectedNeighborhood === nh
                          ? 'bg-[#52A8C7] text-white border-[#52A8C7] shadow-2xs'
                          : 'bg-gray-100/95 dark:bg-slate-800/80 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 border-transparent dark:border-slate-700/60'
                      }`}
                    >
                      {nh === 'Todos' ? 'Todos os Bairros' : nh}
                    </button>
                  ))}
                </div>
              </div>

              {/* Count + Reset Row */}
              <div className="flex flex-wrap justify-between items-center gap-2 px-1">
                <span className="text-xs font-bold text-gray-500 dark:text-slate-400 tracking-wide uppercase">
                  {activeTab === 'favoritos'
                    ? `${currentJobsList.length} ${currentJobsList.length === 1 ? 'vaga salva' : 'vagas salvas'}`
                    : `${currentJobsList.length} ${currentJobsList.length === 1 ? 'vaga encontrada' : 'vagas encontradas'}`}
                </span>

                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-xs font-bold text-[#52A8C7] hover:text-[#085C77] dark:text-sky-400 dark:hover:text-sky-300 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Limpar filtros ({activeFiltersCount})
                  </button>
                )}
              </div>

              {/* Empty States */}
              {currentJobsList.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-[#131E32] rounded-2xl border border-gray-200/70 dark:border-slate-800 p-6 flex flex-col items-center">
                  <Briefcase className="w-10 h-10 text-gray-300 dark:text-slate-600 mb-3" />
                  <p className="text-base font-bold text-gray-800 dark:text-slate-100">
                    {activeTab === 'favoritos' ? 'Nenhuma vaga salva nos favoritos' : 'Nenhuma vaga encontrada com esses filtros'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm mx-auto text-center leading-relaxed">
                    {activeTab === 'favoritos'
                      ? 'Toque no ícone de coração em qualquer vaga para guardá-la aqui e acompanhar com facilidade.'
                      : 'Tente ampliar a busca removendo o filtro de bairro ou tipo de contrato.'}
                  </p>
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="mt-4 px-4 py-2 rounded-xl bg-[#52A8C7] hover:bg-[#3d90ad] text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Limpar filtros e mostrar vagas
                    </button>
                  )}
                </div>
              ) : (
                /* Jobs Cards Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {currentJobsList.map((job, index) => {
                    const existingApp = getApplicationForJob(job.id);
                    const isFav = favorites.includes(job.id);

                    const typeColors: Record<string, string> = {
                      'Estágio': 'bg-sky-50/95 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200/70 dark:border-sky-800/60',
                      'Jovem Aprendiz': 'bg-teal-50/95 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200/70 dark:border-teal-800/60',
                      'CLT': 'bg-indigo-50/95 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200/70 dark:border-indigo-800/60',
                      'Temporário': 'bg-amber-50/95 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200/70 dark:border-amber-800/60',
                      'PJ': 'bg-purple-50/95 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200/70 dark:border-purple-800/60',
                      'Freelancer': 'bg-orange-50/95 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border-orange-200/70 dark:border-orange-800/60',
                    };
                    const typeStyle = typeColors[job.type] || 'bg-gray-50/95 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700';
                    const resolvedCoords = resolveJobCoordinates(job);

                    return (
                      <motion.div
                        key={job.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.03, 0.25), duration: 0.25 }}
                        onClick={() => onNavigateToDetailsJob(job)}
                        className={`group bg-white dark:bg-[#131E32] rounded-2xl p-5 border border-gray-200/80 dark:border-slate-800 shadow-2xs hover:shadow-lg dark:hover:shadow-black/40 hover:border-[#52A8C7]/50 dark:hover:border-[#52A8C7]/60 transition-all duration-200 cursor-pointer flex flex-col justify-between relative border-l-4 ${
                          job.color || 'border-l-[#52A8C7]'
                        }`}
                      >
                        <div>
                          {/* Top Row: Company Logo, Title & Favorite Heart */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3.5 min-w-0">
                              <div className="w-12 h-12 bg-slate-50/95 dark:bg-slate-800/90 rounded-xl flex items-center justify-center border border-gray-200/70 dark:border-slate-700 font-extrabold text-[#085C77] dark:text-sky-300 font-sans text-sm shrink-0 overflow-hidden">
                                {isImageAssetUrl(job.logo) ? (
                                  <img
                                    src={resolveAssetUrl(job.logo)}
                                    alt={job.company}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  (job.company || 'OP').substring(0, 2).toUpperCase()
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                                    {job.category || 'Geral'}
                                  </span>
                                  {job.dateString && (
                                    <span className="text-[10px] text-gray-400 dark:text-slate-400">• {job.dateString}</span>
                                  )}
                                </div>
                                <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white tracking-tight leading-snug line-clamp-2 mt-0.5 group-hover:text-[#085C77] dark:group-hover:text-sky-300 transition-colors">
                                  {job.title}
                                </h3>
                                <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 mt-0.5 flex items-center gap-1 truncate">
                                  <Building className="w-3.5 h-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
                                  <span className="truncate">{job.company}</span>
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite(job.id);
                              }}
                              className={`p-2 rounded-xl border transition-all shrink-0 cursor-pointer ${
                                isFav
                                  ? 'bg-rose-50/95 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/70 text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                                  : 'bg-gray-50/95 dark:bg-slate-800/80 border-gray-200/70 dark:border-slate-700 text-gray-400 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50/60 dark:hover:bg-rose-950/40'
                              }`}
                              aria-label={isFav ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
                              title={isFav ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
                            >
                              <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                            </button>
                          </div>

                          {/* Applied Status Banner if already applied */}
                          {existingApp && (
                            <div className="mt-3 px-3 py-1.5 rounded-xl bg-emerald-50/95 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                Candidatura enviada
                              </span>
                              <span className="uppercase text-[10px] bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300">
                                {existingApp.status}
                              </span>
                            </div>
                          )}

                          {/* Info Badges */}
                          <div className="flex flex-wrap gap-1.5 mt-3.5">
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 ${typeStyle}`}>
                              <Clock className="w-3 h-3" />
                              {job.type}
                            </span>

                            <span className="bg-emerald-50/95 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-emerald-200/70 dark:border-emerald-800/60 flex items-center gap-1">
                              <DollarSign className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              {job.salary || 'A combinar'}
                            </span>

                            <span className="bg-gray-50/95 dark:bg-slate-800/80 text-gray-600 dark:text-slate-300 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-gray-200/70 dark:border-slate-700 flex items-center gap-1 max-w-[180px] truncate">
                              <MapPin className="w-3 h-3 text-[#52A8C7] dark:text-sky-400 shrink-0" />
                              <span className="truncate">{job.location}</span>
                            </span>

                            {job.isRemote ? (
                              <span className="bg-indigo-50/95 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-indigo-200/70 dark:border-indigo-800/60 flex items-center gap-1">
                                <Globe className="w-3 h-3" />
                                <span>Remoto</span>
                              </span>
                            ) : null}
                          </div>

                          {/* Short Description */}
                          <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed mt-3 line-clamp-2">
                            {job.description}
                          </p>

                          {/* Key Requirements & Benefits Highlights */}
                          {job.requirements && job.requirements.length > 0 && (
                            <div className="mt-3 flex flex-col gap-1">
                              <span className="text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-500" /> Requisitos:
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {job.requirements.slice(0, 2).map((req, rIdx) => (
                                  <span
                                    key={rIdx}
                                    className="bg-slate-50/95 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 text-[10px] font-medium px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700 truncate max-w-[200px]"
                                  >
                                    {req}
                                  </span>
                                ))}
                                {job.requirements.length > 2 && (
                                  <span className="bg-slate-100/95 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                    +{job.requirements.length - 2}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Work Hours or Benefits summary */}
                          {(job.workHours || (job.benefits && job.benefits.length > 0)) && (
                            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-slate-400">
                              {job.workHours && (
                                <span className="flex items-center gap-1 truncate max-w-full">
                                  <Clock className="w-3 h-3 text-gray-400 dark:text-slate-500 shrink-0" />
                                  <span className="truncate">{job.workHours}</span>
                                </span>
                              )}
                              {job.benefits && job.benefits.length > 0 && (
                                <span className="flex items-center gap-1 text-teal-700 dark:text-teal-400 font-medium">
                                  <Gift className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />
                                  {job.benefits.length} {job.benefits.length === 1 ? 'benefício' : 'benefícios'}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Start and End Dates (formatted pt-BR) */}
                          {job.startDate && job.endDate && (
                            <div className="mt-3 py-1.5 px-3 bg-teal-50/70 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-800/50 rounded-xl flex items-center justify-between text-[11px] text-teal-800 dark:text-teal-200 font-medium">
                              <span className="flex items-center gap-1 font-semibold">
                                <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /> Inscrições:
                              </span>
                              <span className="font-mono text-[10px] text-teal-700 dark:text-teal-300 font-bold">
                                {formatPtBrDate(job.startDate)} até {formatPtBrDate(job.endDate)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Footer Actions */}
                        <div className="flex items-center gap-2 mt-4 pt-3.5 border-t border-gray-100 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToDetailsJob(job);
                            }}
                            className="flex-1 bg-gray-100/95 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-100 font-bold py-2.5 px-3 rounded-xl text-xs transition-colors cursor-pointer text-center"
                          >
                            Ver Detalhes
                          </button>

                          {existingApp ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTab('candidaturas');
                              }}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Acompanhar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onQuickApply) {
                                  onQuickApply(job);
                                } else {
                                  onNavigateToDetailsJob(job);
                                }
                              }}
                              className="flex-1 bg-[#52A8C7] hover:bg-[#3d90ad] text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Candidatar</span>
                            </button>
                          )}

                          {onViewOnMap && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewOnMap({
                                  ...job,
                                  lat: resolvedCoords.lat,
                                  lng: resolvedCoords.lng,
                                });
                              }}
                              className="p-2.5 rounded-xl bg-sky-50/95 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-[#085C77] dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/60 transition-colors cursor-pointer shrink-0"
                              title="Ver localização desta vaga no Mapa"
                              aria-label="Ver localização no mapa"
                            >
                              <MapPin className="w-4 h-4 text-[#52A8C7] dark:text-sky-400" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Candidaturas tracking timeline list */}
          {activeTab === 'candidaturas' && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-gray-500 dark:text-slate-400 tracking-wider uppercase">
                  {applications.length} {applications.length === 1 ? 'candidatura enviada' : 'candidaturas enviadas'}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('vagas')}
                  className="text-xs font-bold text-[#52A8C7] hover:underline cursor-pointer"
                >
                  Explorar novas vagas
                </button>
              </div>

              {applications.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-[#131E32] rounded-2xl border border-gray-200/70 dark:border-slate-800 p-6 flex flex-col items-center">
                  <CheckCircle2 className="w-9 h-9 text-gray-300 dark:text-slate-600 mb-2" />
                  <p className="text-base font-bold text-gray-800 dark:text-slate-100">Nenhuma candidatura registrada</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-xs text-center leading-relaxed">
                    Navegue pelas vagas e clique em &ldquo;Candidatar&rdquo; para acompanhar cada etapa da sua seleção em tempo real aqui.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('vagas')}
                    className="mt-4 text-xs bg-[#52A8C7] hover:bg-[#3d90ad] text-white font-bold py-2.5 px-5 rounded-xl cursor-pointer shadow-xs transition-colors"
                  >
                    Ver vagas disponíveis
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {applications.map((app, index) => {
                    const matchedJob = jobsList.find((j) => j.id === app.jobId);
                    return (
                      <motion.div
                        key={app.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04, duration: 0.25 }}
                        className="bg-white dark:bg-[#131E32] p-5 rounded-2xl border border-gray-200/80 dark:border-slate-800 shadow-2xs flex flex-col gap-4"
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0">
                            <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white leading-snug truncate">
                              {app.jobTitle}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mt-0.5">
                              {app.company} • Enviada em {app.appliedDate}
                            </p>
                          </div>

                          <span
                            className={`text-[11px] uppercase font-bold tracking-wide px-2.5 py-1 rounded-full shrink-0 border ${
                              app.status === 'Em análise'
                                ? 'bg-amber-50/95 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200/70 dark:border-amber-800/60'
                                : app.status === 'Entrevista'
                                ? 'bg-blue-50/95 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200/70 dark:border-blue-800/60'
                                : app.status === 'Aprovado'
                                ? 'bg-emerald-50/95 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-800/60'
                                : 'bg-rose-50/95 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200/70 dark:border-rose-800/60'
                            }`}
                          >
                            {app.status}
                          </span>
                        </div>

                        {/* Timeline Progress Visualization */}
                        <div className="flex justify-between items-center px-1 pt-1 text-[11px] text-gray-500 dark:text-slate-400 font-semibold select-none">
                          <div className="flex flex-col items-center gap-1 flex-1 relative">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-[#131E32] ring-2 ring-emerald-500/20 z-10" />
                            <span>Enviado</span>
                            <div className="absolute top-[5px] left-[50%] right-[-50%] h-[2px] bg-emerald-500" />
                          </div>

                          <div className="flex flex-col items-center gap-1 flex-1 relative">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                ['Em análise', 'Entrevista', 'Aprovado'].includes(app.status) ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-slate-700'
                              } border-2 border-white dark:border-[#131E32] z-10`}
                            />
                            <span>Análise</span>
                            <div
                              className={`absolute top-[5px] left-[50%] right-[-50%] h-[2px] ${
                                ['Entrevista', 'Aprovado'].includes(app.status) ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-slate-700'
                              }`}
                            />
                          </div>

                          <div className="flex flex-col items-center gap-1 flex-1 relative">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                ['Entrevista', 'Aprovado'].includes(app.status) ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-slate-700'
                              } border-2 border-white dark:border-[#131E32] z-10`}
                            />
                            <span>Entrevista</span>
                            <div
                              className={`absolute top-[5px] left-[50%] right-[-50%] h-[2px] ${
                                app.status === 'Aprovado' ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-slate-700'
                              }`}
                            />
                          </div>

                          <div className="flex flex-col items-center gap-1 flex-1">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                app.status === 'Aprovado' ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-slate-700'
                              } border-2 border-white dark:border-[#131E32] z-10`}
                            />
                            <span>Aprovado</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2">
                          {onCancelApplication ? (
                            <button
                              type="button"
                              onClick={() => onCancelApplication(app.id)}
                              className="flex items-center gap-1.5 text-red-600 dark:text-red-400 hover:text-red-700 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Cancelar Candidatura
                            </button>
                          ) : <span />}

                          {matchedJob && (
                            <button
                              type="button"
                              onClick={() => onNavigateToDetailsJob(matchedJob)}
                              className="text-xs font-bold text-[#52A8C7] hover:text-[#085C77] dark:text-sky-400 dark:hover:text-sky-300 hover:underline cursor-pointer"
                            >
                              Ver detalhes da vaga
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

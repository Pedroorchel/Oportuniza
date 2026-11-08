import { useState } from 'react';
import { Heart, Briefcase, GraduationCap, Clock, MapPin, DollarSign, Building, Star, ChevronRight, ArrowLeft } from 'lucide-react';
import { Job, Course, Application } from '../types';
import { mockJobs, mockCourses } from '../data';

interface FavoritesSectionProps {
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onNavigateToJob: (job: Job) => void;
  onNavigateToCourse: (course: Course) => void;
  onBack: () => void;
  applications?: Application[];
}

export default function FavoritesSection({
  favorites,
  onToggleFavorite,
  onNavigateToJob,
  onNavigateToCourse,
  onBack,
  applications = [],
}: FavoritesSectionProps) {
  const [activeTab, setActiveTab] = useState<'jobs' | 'courses'>('jobs');

  // Filter jobs that are favorited and not yet applied to
  const favoritedJobs = mockJobs.filter((job) => {
    const isFav = favorites.includes(job.id);
    if (!isFav) return false;
    
    const hasApplied = applications.some((app) => app.jobId === job.id);
    return !hasApplied;
  });

  // Filter courses that are favorited
  const favoritedCourses = mockCourses.filter((course) => favorites.includes(course.id) && course.active !== false);

  return (
    <div className="w-full h-full flex flex-col bg-[#F9FAFB] absolute inset-0">
      {/* Header with Switcher */}
      <header className="px-5 pt-6 pb-4 bg-white border-b border-gray-100 flex flex-col gap-3.5 shadow-sm shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              onClick={onBack}
              className="p-1 px-1.5 rounded-lg hover:bg-gray-100 active:scale-95 transition-transform text-gray-600 hover:text-gray-900 cursor-pointer shrink-0"
              aria-label="Voltar para o início"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-bold text-gray-900 font-sans tracking-tight truncate">Favoritos</h1>
          </div>
          <span className="text-xs font-bold text-red-500 bg-red-50 px-2.5 py-1 rounded-full flex items-center gap-1 border border-red-100/30">
            <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
            <span>Itens Salvos</span>
          </span>
        </div>

        {/* Tab switch buttons */}
        <div className="flex bg-gray-50 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`flex-1 py-2 text-center text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'jobs'
                ? 'bg-white text-primary shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Vagas ({favoritedJobs.length})</span>
          </button>
          
          <button
            onClick={() => setActiveTab('courses')}
            className={`flex-1 py-2 text-center text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'courses'
                ? 'bg-white text-teal-600 shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Cursos ({favoritedCourses.length})</span>
          </button>
        </div>
      </header>

      {/* Favorites Display list */}
      <div className="flex-1 overflow-y-auto custom-scroll p-4">
        {activeTab === 'jobs' ? (
          /* FAVORITED JOBS LIST */
          <div className="flex flex-col gap-3 animate-fadeIn">
            {favoritedJobs.length === 0 ? (
              <div className="text-center py-14 bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center">
                <Heart className="w-8 h-8 text-gray-300 mb-2.5" />
                <p className="text-sm font-semibold text-gray-700">Nenhuma vaga favoritada</p>
                <p className="text-xs text-gray-400 mt-1 max-w-[200px] leading-normal">
                  Marque com o coração as vagas que você gostou para salvá-las aqui e consultá-las a qualquer momento!
                </p>
              </div>
            ) : (
              favoritedJobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => onNavigateToJob(job)}
                  className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col gap-3 hover:border-primary/20 hover:shadow-md transition-all duration-200 cursor-pointer relative"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center font-bold text-primary font-sans text-base border border-primary/5 shrink-0">
                      {job.company.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <h3 className="text-base font-bold text-gray-800 tracking-tight leading-normal truncate">
                        {job.title}
                      </h3>
                      <p className="text-xs text-primary font-semibold mt-0.5 flex items-center gap-1">
                        <Building className="w-3 h-3 text-primary-dark/60" />
                        {job.company}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="bg-gray-100 text-gray-600 text-[14px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {job.type}
                    </span>
                    <span className="bg-emerald-50 text-emerald-600 text-[14px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-100/30">
                      <DollarSign className="w-2.5 h-2.5" />
                      {job.salary}
                    </span>
                    <span className="bg-gray-100 text-gray-500 text-[14px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 truncate max-w-[150px]">
                      <MapPin className="w-2.5 h-2.5 shrink-0" />
                      {job.location}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-50 pt-2.5 mt-1">
                    <span className="text-[14px] text-gray-400 font-mono font-medium">Postada {job.dateString}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(job.id);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-all z-10"
                      >
                        <Heart className="w-[14px] h-[14px] fill-red-500 text-red-500" />
                        Remover Favorito
                      </button>
                      <span className="text-xs text-primary font-bold flex items-center gap-0.5 hover:underline">
                        Ver Detalhes <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* FAVORITED COURSES LIST */
          <div className="flex flex-col gap-3 animate-fadeIn">
            {favoritedCourses.length === 0 ? (
              <div className="text-center py-14 bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center">
                <Heart className="w-8 h-8 text-gray-300 mb-2.5" />
                <p className="text-sm font-semibold text-gray-700">Nenhum curso favoritado</p>
                <p className="text-xs text-gray-400 mt-1 max-w-[200px] leading-normal">
                  Marque com o coração os minicursos que você deseja estudar depois para listá-los nesta seção!
                </p>
              </div>
            ) : (
              favoritedCourses.map((course) => (
                <div
                  key={course.id}
                  onClick={() => onNavigateToCourse(course)}
                  className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col gap-3.5 hover:border-teal-500/20 hover:shadow-md transition-all duration-200 cursor-pointer relative overflow-hidden"
                >
                  <span className="absolute left-0 top-0 bottom-0 w-[5px] bg-teal-500" />
                  
                  <div className="flex justify-between items-start pl-1.5 pr-1">
                    <div className="min-w-0 flex-1 pr-4">
                      <span className="text-[14px] uppercase font-bold tracking-wider text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100/20">
                        {course.category}
                      </span>
                      <h3 className="text-base font-bold text-gray-800 tracking-tight mt-1 px-0.5 leading-normal truncate">
                        {course.title}
                      </h3>
                      <p className="text-xs text-gray-400 font-medium px-0.5 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-teal-500" />
                        {course.duration} • {course.instructor}
                      </p>
                    </div>

                    <div className="flex items-center gap-0.5 text-xs bg-amber-50 text-amber-600 font-bold px-2 py-0.5 rounded-lg border border-amber-100/30 shrink-0 select-none">
                      <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                      <span>{course.rating.toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-50 pt-2.5 mt-0.5 pl-1.5">
                    <span className="text-xs font-mono font-medium text-gray-400 uppercase tracking-tight">
                      {course.lessons.length} AULAS • {course.level}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(course.id);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-all z-10"
                      >
                        <Heart className="w-[14px] h-[14px] fill-red-500 text-red-500" />
                        Remover Favorito
                      </button>
                      <span className="text-xs text-teal-600 font-bold flex items-center gap-0.5 hover:underline">
                        Estudar Curso <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

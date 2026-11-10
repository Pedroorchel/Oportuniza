import React, { useState } from 'react';
import { ArrowLeft, Send, FileText, MessageSquare, Table2, Terminal, BookOpen, CheckCircle, AlertCircle, MapPin, Play, Heart, Briefcase, DollarSign, Calendar, Clock, Award, Shield, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Job, Course, Enrollment } from '../types';
import { isImageAssetUrl, resolveAssetUrl } from '../lib/assets';

interface DetailsScreenProps {
  job?: Job;
  course?: Course;
  onBack: () => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onNavigateToApply?: (job: Job) => void;
  onViewOnMap?: (job: Job) => void;
  onNavigateToCoursePlayer?: (course: Course) => void;
  onEnrollInCourse?: (course: Course) => Promise<boolean> | void;
  enrollments?: Enrollment[];
}

export default function DetailsScreen({ 
  job, 
  course, 
  onBack,
  favorites,
  onToggleFavorite,
  onNavigateToApply,
  onViewOnMap,
  onNavigateToCoursePlayer,
  onEnrollInCourse,
  enrollments = []
}: DetailsScreenProps) {
  const [enrolling, setEnrolling] = useState(false);
  const [enrollToast, setEnrollToast] = useState<{ show: boolean; msg: string; type: 'success' | 'info' | 'error' }>({
    show: false,
    msg: '',
    type: 'success'
  });
  
  if (!job && !course) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <div className="text-center p-6 bg-white rounded-2xl shadow-sm border border-gray-100 max-w-sm">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
          <p className="text-gray-900 font-bold">Conteúdo não encontrado.</p>
          <button onClick={onBack} className="mt-4 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-sm">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // Determine current favorited status
  const itemId = course?.id || job?.id || '';
  const isFavorited = favorites.includes(itemId);

  const [isLocalEnrolled, setIsLocalEnrolled] = useState(false);
  const isEnrolled = !!(enrollments.some(e => e.courseId === course?.id) || isLocalEnrolled);

  // 1. COURSE DETAILS SCREEN
  if (course) {
    return (
      <div className="w-full h-full flex flex-col bg-[#F8F9FB] overflow-y-auto custom-scroll relative">
        {/* Navigation Top Bar */}
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-2 shrink-0 flex items-center justify-between">
          <button
            onClick={onBack}
            className="w-11 h-11 bg-white shadow-sm rounded-xl border border-gray-100 flex items-center justify-center text-[#085C77] hover:bg-gray-50 active:scale-95 transition-all outline-none cursor-pointer"
            id="back-btn-course"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => onToggleFavorite(course.id)}
            className={`w-11 h-11 shadow-sm rounded-xl border flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
              isFavorited 
                ? 'bg-rose-50 border-rose-100 text-rose-500 hover:bg-rose-100' 
                : 'bg-white border-gray-100 text-gray-450 hover:bg-gray-50'
            }`}
            id="favorite-btn-course"
            title={isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Heart className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Course Layout Wrapper */}
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-24 mt-4 flex-1 flex flex-col">
          {/* Hero Banner Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start w-full">
            
            {/* Main Course Content: Left/middle (Span 2) */}
            <div className="md:col-span-2 flex flex-col gap-6">
              
              {/* Main Card with branding & overview */}
              <div className="bg-white rounded-[24px] p-6 sm:p-8 shadow-sm border border-gray-100/80 relative overflow-hidden">
                <span className="absolute left-0 top-0 bottom-0 w-2.5 bg-[#4EA8C7]" />
                
                <div className="pl-2 sm:pl-3">
                  {/* Category Pill */}
                  <div className="mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-teal-600 bg-teal-50 border border-teal-100 uppercase tracking-wider">
                      <BookOpen className="w-3 h-3 text-teal-600" />
                      {course.category}
                    </span>
                  </div>

                  {/* Title & Instructor */}
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 tracking-tight leading-tight mb-2">
                    {course.title}
                  </h1>
                  
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#8793A1] font-medium mb-4">
                    <span className="flex items-center gap-1 grayscale opacity-80">
                      <img 
                        src="https://www.image2url.com/r2/default/images/1781824138816-3fd9702f-4521-41d2-8411-d8fc61114350.png" 
                        alt="Oportuniza" 
                        className="w-4 h-4 object-contain"
                      />
                      {course.instructor}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-teal-600 bg-teal-50/50 px-2 py-0.5 rounded-lg border border-teal-100/50 text-[10px]">
                      {course.level}
                    </span>
                  </div>

                  {/* Course Promo Banner / Thumbnail */}
                  {course.coverImage && (
                    <div className="w-full h-40 sm:h-56 rounded-xl overflow-hidden mb-4 border border-gray-100 relative shadow-sm">
                      <img src={course.coverImage} alt={course.title} className="w-full h-full object-cover select-none" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/10 hover:bg-black/5 transition-colors pointer-events-none" />
                    </div>
                  )}

                  <hr className="border-t border-gray-100 my-4" />

                  {/* About details */}
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-[#4EA8C7]" />
                      Sobre o Curso
                    </h3>
                    <p className="text-xs text-gray-600 leading-relaxed font-normal">
                      {course.desc}
                    </p>
                  </div>

                  <hr className="border-t border-gray-100 my-4" />

                  {/* Módulos e Aulas List */}
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center mb-0.5">
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-emerald-500" />
                        Módulos ({course.lessons.length})
                      </h3>
                      <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        YouTube
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {course.lessons.map((lesson, idx) => (
                        <div 
                          key={idx} 
                          className="p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-100/80 flex items-start gap-2 transition-all"
                        >
                          <div className="w-5 h-5 rounded-md bg-teal-500/10 text-teal-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                            {idx + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-gray-800 leading-tight truncate">
                              {lesson.title}
                            </p>
                            <span className="text-[9px] text-gray-400 font-medium flex items-center gap-0.5 mt-0.5">
                              <Clock className="w-2.5 h-2.5 text-gray-400" />
                              {lesson.duration}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

            </div>

            {/* Quick Actions Side Panel: Right (Span 1) */}
            <div className="md:col-span-1 flex flex-col gap-5 md:sticky md:top-6">
              
              {/* Specifications Card */}
              <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100/80 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-3">
                  Informações de Ensino
                </h3>
                
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-gray-400" />
                      Carga Horária
                    </span>
                    <strong className="text-gray-800 font-bold">{course.duration}</strong>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-gray-400" />
                      Módulos
                    </span>
                    <strong className="text-gray-800 font-bold">{course.lessons.length} aulas</strong>
                  </div>

                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-gray-400" />
                      Certificado
                    </span>
                    <strong className="text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-[10px] uppercase">
                      Incluso
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-gray-400" />
                      Acesso
                    </span>
                    <strong className="text-[#085C77] font-bold">Vitalício / Grátis</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                {(() => {
                  if (isEnrolled) {
                    return (
                      <button 
                        onClick={() => {
                          console.log("Navigating to course:", course.title);
                          if (onNavigateToCoursePlayer) {
                            onNavigateToCoursePlayer(course);
                          }
                        }}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-[20px] text-sm shadow-sm hover:shadow-md transform hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border-b-2 border-emerald-600"
                        id="watch-course-btn"
                      >
                        <Play className="w-4 h-4 fill-current text-white" />
                        Acessar Curso!
                      </button>
                    );
                  }

                  return (
                    <button 
                      onClick={async () => {
                        console.log("Enroll button clicked for:", course.id);
                        if (enrolling) return;
                        setEnrolling(true);
                        try {
                          if (onEnrollInCourse) {
                            const success = await onEnrollInCourse(course);
                            if (success !== false) {
                              setIsLocalEnrolled(true);
                              setEnrollToast({
                                show: true,
                                msg: "Inscrição realizada com sucesso!",
                                type: "success"
                              });
                              setTimeout(() => {
                                setEnrollToast(prev => ({ ...prev, show: false }));
                              }, 2000);
                            }
                          }
                        } catch (e: any) {
                          console.error("Error during enrollment click:", e);
                        } finally {
                          setEnrolling(false);
                        }
                      }}
                      disabled={enrolling}
                      className="w-full bg-[#52A8C7] hover:bg-[#3d90ad] text-white font-bold py-4 rounded-[20px] text-sm shadow-sm hover:shadow-md transform hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border-b-2 border-[#3d90ad] disabled:opacity-75 disabled:cursor-not-allowed"
                      id="enroll-course-btn"
                    >
                      {enrolling ? 'Inscrevendo no curso...' : 'Inscrever-se no Curso Grátis'}
                    </button>
                  );
                })()}

                <button 
                  onClick={() => onToggleFavorite(course.id)}
                  className="w-full bg-white text-[#52A8C7] border-2 border-[#52A8C7] hover:bg-gray-50 font-bold py-4 rounded-[20px] text-sm shadow-sm transform hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  id="favorite-toggle-btn"
                >
                  {isFavorited ? 'Remover dos Favoritos' : 'Salvar nos Favoritos'}
                </button>
              </div>

            </div>

          </div>
        </div>

        {/* Custom Animated Notification Toast */}
        <AnimatePresence>
          {enrollToast.show && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="absolute top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[340px] px-4"
            >
              <div className={`p-4 rounded-2xl shadow-xl flex items-center gap-3 border ${
                enrollToast.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                  : 'bg-amber-50 border-amber-100 text-amber-800'
              }`}>
                {enrollToast.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold">{enrollToast.msg}</p>
                  {enrollToast.type === 'success' && (
                    <p className="text-xs opacity-85 mt-0.5">Bons estudos! Redirecionando...</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 2. JOB DETAILS SCREEN
  return (
    <div className="w-full h-full flex flex-col bg-[#F8F9FB] overflow-y-auto custom-scroll relative">
      {/* Navigation Top Bar */}
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-2 shrink-0 flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-11 h-11 bg-white shadow-sm rounded-xl border border-gray-100 flex items-center justify-center text-[#085C77] hover:bg-gray-50 active:scale-95 transition-all outline-none cursor-pointer"
          id="back-btn-job"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => onToggleFavorite(job?.id || '')}
          className={`w-11 h-11 shadow-sm rounded-xl border flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
            isFavorited 
              ? 'bg-rose-50 border-rose-100 text-rose-500 hover:bg-rose-100' 
              : 'bg-white border-gray-100 text-gray-450 hover:bg-gray-50'
          }`}
          id="favorite-btn-job"
          title={isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <Heart className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Screen Layout Wrapper */}
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-24 mt-4 flex-1 flex flex-col">
        {/* Responsive Grid System: Split left column details and right sticky sidepanel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start w-full">
          
          {/* Main Card Content (Left portion - Spans 2 cols on md+) */}
          <div className="md:col-span-2 flex flex-col gap-6">
            
            {/* Branding & Base info */}
            <div className="bg-white rounded-[24px] p-6 sm:p-8 shadow-sm border border-gray-100/80 relative overflow-hidden">
              <span className="absolute left-0 top-0 bottom-0 w-2.5 bg-[#4EA8C7]" />
              
              <div className="pl-2 sm:pl-4">
                {/* Logo and Titles */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl border border-gray-100 flex items-center justify-center bg-white shadow-sm shrink-0 overflow-hidden select-none">
                    {isImageAssetUrl(job?.logo) ? (
                      <img src={resolveAssetUrl(job?.logo)} alt={job?.company || 'Empresa'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-[#E20015] font-black text-sm tracking-tighter uppercase">
                        {job?.company.substring(0, 5) || 'VAGA'}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    {/* Category tag */}
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#085C77] bg-[#085C77]/5 px-2.5 py-0.5 rounded-md border border-[#085C77]/10 w-fit mb-1.5">
                      {job?.category || 'Carreira'}
                    </span>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight leading-snug">
                      {job?.title || 'Desenvolvedor Full Stack'}
                    </h1>
                    <div className="flex items-center gap-1.5 text-xs text-[#8793A1] font-medium mt-1 truncate">
                      <span className="text-gray-800 font-semibold">{job?.company || 'Empresa parceira'}</span>
                      <span className="text-gray-300">•</span>
                      <span className="flex items-center gap-0.5 text-gray-500">
                        <MapPin className="w-3.5 h-3.5" />
                        {job?.location || 'Araucária, PR'}
                      </span>
                    </div>
                  </div>
                </div>

                <hr className="border-t border-gray-100 my-6" />

                {/* Descrição da Vaga */}
                {job?.description && (
                  <div className="flex flex-col gap-3 mb-6">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <Compass className="w-4 h-4 text-[#52A8C7]" />
                      Descrição do Cargo
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed font-normal">
                      {job.description}
                    </p>
                  </div>
                )}

                <hr className="border-t border-gray-100 my-6" />

                {/* Requisitos List */}
                <div className="flex flex-col gap-3.5">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#52A8C7]" />
                    Requisitos e Habilidades
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(job?.requirements || ['Ensino médio completo', 'Disponibilidade total']).map((req, idx) => (
                      <div 
                        key={idx} 
                        className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100/60 flex items-start gap-2.5 leading-relaxed"
                      >
                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{req}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <hr className="border-t border-gray-100 my-6" />

                {/* Beneficios List */}
                <div className="flex flex-col gap-3.5">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#52A8C7]" />
                    Benefícios Ofertados
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {['Vale Transporte Integrado', 'Vale Alimentação / Refeição', 'Seguro de Vida Coletivo', 'Assistência Médica Familiar', 'Plano de Carreira e Treinamentos'].map((ben, idx) => (
                      <div 
                        key={idx} 
                        className="text-xs text-gray-700 bg-teal-500/[0.02] p-3 rounded-xl border border-teal-500/10 flex items-start gap-2.5 leading-relaxed"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0 mt-2" />
                        <span>{ben}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Sticky Side Card (Right portion - Spans 1 col on md+) */}
          <div className="md:col-span-1 flex flex-col gap-5 md:sticky md:top-6">
            
            {/* Quick Summary Spec Dashboard Card */}
            <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100/80 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-3">
                Resumo da Oportunidade
              </h3>
              
              <div className="flex flex-col gap-3.5">
                <div className="flex flex-col py-1 border-b border-gray-50">
                  <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    Salário / Bolsa Auxílio
                  </span>
                  <strong className="text-lg font-extrabold text-[#007BFF] tracking-tight mt-0.5">
                    {job?.salary !== 'A combinar' ? job?.salary : 'Consultar na Entrevista'}
                  </strong>
                </div>

                <div className="flex items-center justify-between text-xs py-1 border-b border-gray-50">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-gray-400" />
                    Contrato
                  </span>
                  <strong className="text-gray-800 font-bold bg-blue-50 border border-blue-100 px-2 py-0.5 rounded text-[10px]">
                    {job?.type || 'CLT'}
                  </strong>
                </div>

                <div className="flex items-center justify-between text-xs py-1 border-b border-gray-50">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    Modalidade
                  </span>
                  <strong className="text-gray-800 font-bold">
                    {job?.isRemote ? 'Contratação Remota' : 'Presencial'}
                  </strong>
                </div>

                <div className="flex items-center justify-between text-xs py-1 border-b border-gray-50">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    Cidade Principal
                  </span>
                  <strong className="text-gray-800 font-bold max-w-[120px] truncate" title={job?.location}>
                    {job?.location || 'Paraná'}
                  </strong>
                </div>

                {/* Período de Inscrição (Data Início e Término) */}
                {job?.startDate && job?.endDate && (
                  <div className="flex flex-col py-2 border-b border-gray-50 bg-teal-50/50 -mx-6 px-6">
                    <span className="text-[10px] uppercase font-bold text-teal-700 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-teal-600" />
                      Período de Inscrição
                    </span>
                    <strong className="text-xs font-bold text-teal-900 mt-0.5">
                      {job.startDate} até {job.endDate}
                    </strong>
                  </div>
                )}

                {/* Horário de Trabalho */}
                {job?.workHours && (
                  <div className="flex items-center justify-between text-xs py-1 border-b border-gray-50">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-gray-400" />
                      Horário
                    </span>
                    <strong className="text-gray-800 font-bold text-[11px] truncate max-w-[140px]" title={job.workHours}>
                      {job.workHours}
                    </strong>
                  </div>
                )}

                {/* Endereço da Empresa em Araucária */}
                {job?.companyAddress && (
                  <div className="flex flex-col py-1 text-xs">
                    <span className="text-gray-400 flex items-center gap-1.5 text-[10px] uppercase font-bold">
                      <MapPin className="w-3.5 h-3.5 text-amber-500" />
                      Endereço da Empresa
                    </span>
                    <span className="text-gray-700 text-xs font-medium mt-0.5">
                      {job.companyAddress}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Application CTAs */}
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => job && onNavigateToApply?.(job)}
                className="w-full bg-[#52A8C7] hover:bg-[#3d90ad] text-white font-bold py-4 rounded-[20px] text-sm shadow-sm hover:shadow-md transform hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border-b-2 border-[#3d90ad]"
                id="apply-job-main-btn"
              >
                <Send className="w-4 h-4 fill-current text-white shrink-0" />
                Candidatar-se para Vaga
              </button>
              
              <button 
                onClick={() => job && onViewOnMap?.(job)}
                className="w-full bg-white text-[#52A8C7] border-2 border-[#52A8C7] hover:bg-gray-50 font-bold py-4 rounded-[20px] text-sm shadow-sm transform hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                id="map-location-btn"
              >
                <MapPin className="w-4 h-4 shrink-0" />
                Ver Localização no Mapa
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

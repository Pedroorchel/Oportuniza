import { useState } from 'react';
import { Search, Play, CheckCircle, GraduationCap, Clock, Award, Star, BookOpen, ArrowLeft, Heart, ChevronRight, Share2, Lock, Unlock, Check, FileText, MessageSquare, Table2, Terminal, Wrench, TrendingUp, Palette } from 'lucide-react';
import { Course, User, Enrollment } from '../types';
import { mockCourses } from '../data';

interface CoursesProps {
  user: User;
  onUpdateProgress: (courseId: string, progress: number) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onBack: () => void;
  onNavigateToDetailsCourse: (course: Course) => void;
  courses: Course[];
  enrollments: Enrollment[];
}

export default function CoursesSection({
  user,
  onUpdateProgress,
  favorites,
  onToggleFavorite,
  onBack,
  onNavigateToDetailsCourse,
  courses,
  enrollments,
}: CoursesProps) {
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Helper calculation
  const getCompletedLessonsCount = (course: Course) => {
    return course.lessons.filter((les) => les.done).length;
  };

  const calculateCourseProgress = (course: Course) => {
    const total = course.lessons.length;
    if (total === 0) return 0;
    return Math.round((getCompletedLessonsCount(course) / total) * 100);
  };

  // Main Filter criteria
  const getSubTabFilteredCourses = () => {
    return courses.filter((course) => {
      // Must be active
      if (course.active === false) return false;

      // Search matching
      const matchesSearch =
        (course.title || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
        (course.instructor || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
        (course.desc || '').toLowerCase().includes((searchQuery || '').toLowerCase());

      // Category matching
      const matchesCategory =
        selectedCategory === 'Todos' || course.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  };

  const displayCourses = getSubTabFilteredCourses();
  
  const enrolledIds = enrollments.map(e => e.courseId);

  return (
    <div className="w-full h-full flex flex-col bg-[#F9FAFB] absolute inset-0">
      {/* Header with Consistent Sub-Tabs */}
      <header className="px-4 pt-5 pb-3.5 bg-white border-b border-gray-100 flex items-center shadow-sm shrink-0 gap-2">
        <button
          onClick={onBack}
          className="p-1 px-1.5 rounded-lg hover:bg-gray-100 active:scale-95 transition-transform text-gray-600 hover:text-gray-900 cursor-pointer shrink-0"
          aria-label="Voltar para o início"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-sm font-bold text-gray-900 font-sans tracking-tight truncate">Cursos</h1>
      </header>

      {/* Main Container Scroll Area */}
      <div className="flex-1 overflow-y-auto custom-scroll p-4">
          <div className="flex flex-col gap-4 animate-fadeIn">
            {/* Search and Category buttons */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
              <div className="relative flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar minicursos e temas..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-xs focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 custom-scroll no-scrollbar select-none">
                {['Todos', 'Carreira', 'Soft Skills', 'Tecnologia'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`text-[9px] uppercase tracking-wider font-bold py-1.5 px-3 rounded-lg shrink-0 transition-colors cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-teal-500/10 text-teal-700 border border-teal-500/25'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex justify-between items-center px-1 mb-2">
              <span className="text-[22px] font-bold text-gray-900 tracking-tight">
                Cursos Disponíveis
              </span>
            </div>

            {/* Courses visual grid listings */}
            {displayCourses.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center">
                <GraduationCap className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-xs font-semibold text-gray-700">
                  Nenhum curso encontrado
                </p>
                <p className="text-[10px] text-gray-400 mt-1 max-w-[200px] mx-auto text-center leading-normal">
                  Experimente buscar por outros termos ou redefinir seus filtros categóricos.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
                {displayCourses.map((course) => {
                  const isFav = favorites.includes(course.id);
                  const isEnrolled = enrolledIds.includes(course.id);
                  const progressVal = calculateCourseProgress(course);

                  return (
                    <div
                      key={course.id}
                      onClick={() => {
                        onNavigateToDetailsCourse(course);
                      }}
                      className="group bg-white rounded-3xl overflow-hidden border border-gray-100/90 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer flex flex-col justify-between"
                    >
                      {/* Header Cover */}
                      <div className="relative h-60 bg-slate-900 overflow-hidden shrink-0">
                        {course.coverImage ? (
                          <img 
                            src={course.coverImage} 
                            alt={course.title} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                        ) : (course.title || '').toLowerCase().includes('python') ? (
                          <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-90 overflow-hidden bg-[#18181b] transition-transform duration-500 group-hover:scale-105">
                            {/* Decorative background code snippet for python */}
                            <div className="absolute inset-0 overflow-hidden opacity-10 font-mono text-[8px] text-teal-400 p-2 leading-none">
                              def function():<br/>
                              {'  '}return True<br/>
                              import json<br/>
                              data = json.loads(text)<br/>
                              print("hello world")
                            </div>
                            <img src="https://upload.wikimedia.org/wikipedia/commons/c/c3/Python-logo-notext.svg" alt="Python" className="w-[85px] object-contain drop-shadow-xl z-10" />
                            <span className="text-white text-[44px] font-extralight tracking-wide z-10 mt-2">python</span>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center p-6 text-white bg-gradient-to-br from-teal-500 to-teal-400 transition-transform duration-500 group-hover:scale-105">
                             {course.logo === 'FileText' && <FileText className="w-14 h-14 opacity-90 drop-shadow-md" />}
                             {course.logo === 'MessageSquare' && <MessageSquare className="w-14 h-14 opacity-90 drop-shadow-md" />}
                             {course.logo === 'Table2' && <Table2 className="w-14 h-14 opacity-90 drop-shadow-md" />}
                             {course.logo === 'Wrench' && <Wrench className="w-14 h-14 opacity-90 drop-shadow-md" />}
                             {course.logo === 'TrendingUp' && <TrendingUp className="w-14 h-14 opacity-90 drop-shadow-md" />}
                             {course.logo === 'Palette' && <Palette className="w-14 h-14 opacity-90 drop-shadow-md" />}
                             {(course.logo === 'Terminal' || course.logo === 'Megaphone') && (
                               <img src="https://www.image2url.com/r2/default/images/1781824138816-3fd9702f-4521-41d2-8411-d8fc61114350.png" alt="Oportuniza" className="w-[100px] object-contain drop-shadow-xl z-10" />
                             )}
                             {(!course.logo || (course.logo !== 'FileText' && course.logo !== 'MessageSquare' && course.logo !== 'Table2' && course.logo !== 'Wrench' && course.logo !== 'TrendingUp' && course.logo !== 'Palette' && course.logo !== 'Terminal' && course.logo !== 'Megaphone' && course.logo !== 'Python')) && <BookOpen className="w-14 h-14 opacity-90 drop-shadow-md" />}
                          </div>
                        )}

                        {/* Level badge */}
                        <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur-md text-teal-400 text-[10px] font-black tracking-wider uppercase px-3 py-1.5 rounded-full border border-teal-500/20 shadow-lg">
                          {course.level}
                        </div>
                      </div>
                      
                      {/* Card Content */}
                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 tracking-tight leading-snug group-hover:text-[#5FB0C7] transition-colors duration-200">
                            {course.title}
                          </h3>
                          <p className="text-xs font-semibold text-teal-600 mt-1 uppercase tracking-wider">{course.instructor}</p>
                          
                          <p className="text-xs text-gray-500 leading-relaxed mt-3 line-clamp-3">
                            {course.desc}
                          </p>
                        </div>

                        <div>
                          {isEnrolled && (
                            <div className="mt-4 flex flex-col gap-1.5">
                              <div className="flex justify-between items-center text-[10px] font-bold text-teal-600 font-mono tracking-tight">
                                <span>PROGRESSO</span>
                                <span>{progressVal}% ASSISTIDO</span>
                              </div>
                              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-teal-500 h-full transition-all duration-300" style={{ width: `${progressVal}%` }} />
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-50/80">
                            <div className="flex items-center gap-1.5 text-gray-500 font-medium text-xs">
                              <Clock className="w-3.5 h-3.5 text-teal-500" />
                              <span>{(course.duration || '').split(' ')[0] || 'N/A'} Horas</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-gray-500 font-medium text-xs">
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                              <span>{course.rating.toFixed(1)} / 5.0</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2 mt-4">
                            <button className="w-full bg-[#5FB0C7] text-white font-bold py-3 rounded-xl text-xs hover:bg-[#4a9db5] transition-all duration-200 flex items-center justify-center shadow-md shadow-teal-500/10 hover:shadow-lg hover:shadow-teal-500/20 active:scale-98">
                              Ver Detalhes
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite(course.id);
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
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      </div>
    );
}

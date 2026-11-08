import { CheckCircle2, GraduationCap, Calendar, ChevronRight, ArrowLeft, BookOpen } from 'lucide-react';
import { Enrollment } from '../types';

interface EnrollmentsSectionProps {
  enrollments: Enrollment[];
  onNavigateToCourses: () => void;
  onBack: () => void;
  onContinueCourse: (id: string) => void;
  onUnsubscribe: (id: string) => void;
}

export default function EnrollmentsSection({
  enrollments,
  onNavigateToCourses,
  onBack,
  onContinueCourse,
  onUnsubscribe,
}: EnrollmentsSectionProps) {
  return (
    <div className="w-full h-full flex flex-col bg-[#F9FAFB] absolute inset-0">
      {/* Header bar */}
      <header className="px-5 pt-6 pb-4 bg-white border-b border-gray-100 flex items-center justify-between shadow-sm shrink-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={onBack}
            className="p-1 px-1.5 rounded-lg hover:bg-gray-100 active:scale-95 transition-transform text-gray-600 hover:text-gray-900 cursor-pointer shrink-0"
            aria-label="Voltar para o início"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-bold text-gray-900 font-sans tracking-tight truncate">Inscrições</h1>
        </div>
        <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full flex items-center gap-1 border border-teal-100">
          <GraduationCap className="w-3.5 h-3.5 text-teal-600" />
          <span>Meus Cursos</span>
        </span>
      </header>

      {/* Main body scroll view */}
      <div className="flex-1 overflow-y-auto custom-scroll p-4">
        <span className="text-[10px] font-bold text-gray-400 font-mono tracking-wider px-1">
          {enrollments.length} CURSOS EM ANDAMENTO
        </span>

        {/* Enrollments items list */}
        {enrollments.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center mt-3">
            <GraduationCap className="w-8 h-8 text-gray-300 mb-2.5" />
            <p className="text-xs font-semibold text-gray-700">Nenhuma inscrição registrada</p>
            <p className="text-[10px] text-gray-400 mt-1 max-w-[210px] text-center leading-normal">
              Navegue pelos cursos e clique em "Inscrever-se" para começar sua jornada de aprendizado.
            </p>
            <button
              onClick={onNavigateToCourses}
              className="mt-4 text-[10px] bg-teal-600 text-white font-bold py-2.5 px-4 rounded-xl cursor-pointer hover:bg-teal-700 shadow transition-all duration-200"
            >
              Ver Catálogo de Cursos
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5 mt-3">
            {enrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4 animate-fadeIn"
              >
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-gray-800 leading-tight pr-2 truncate">{enrollment.courseTitle}</h4>
                    <p className="text-[9px] text-gray-400 font-medium mt-1 flex items-center gap-1">
                      <BookOpen className="w-3 h-3 text-gray-400" />
                      Prof. {enrollment.instructor}
                    </p>
                    <p className="text-[9px] text-gray-400 font-medium mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      Inscrito em {enrollment.enrolledDate}
                    </p>
                  </div>

                  <span
                    className={`text-[8px] uppercase font-bold tracking-wide px-2.5 py-1 rounded-full shrink-0 ${
                      enrollment.status === 'Iniciado'
                        ? 'bg-amber-50 text-amber-600 border border-amber-100/50'
                        : enrollment.status === 'Em andamento'
                        ? 'bg-blue-50 text-blue-600 border border-blue-100/50'
                        : 'bg-emerald-50 text-emerald-600 border border-emerald-100/50'
                    }`}
                  >
                    {enrollment.status}
                  </span>
                </div>

                {/* Progress Tracker */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[8px] font-bold text-gray-400 font-mono">
                    <span>PROGRESSO</span>
                    <span>{enrollment.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${enrollment.progress === 100 ? 'bg-emerald-500' : 'bg-teal-500'}`} 
                      style={{ width: `${enrollment.progress}%` }} 
                    />
                  </div>
                </div>

                {/* Continue Action */}
                <div className="mt-1 pt-3 border-t border-gray-100 flex justify-between items-center">
                  <button 
                    onClick={() => onUnsubscribe(enrollment.id)}
                    className="text-[9px] font-bold text-red-400 hover:text-red-500 transition-colors px-1 py-1"
                  >
                    Desinscrever-se
                  </button>
                  <button 
                    onClick={() => onContinueCourse(enrollment.id)}
                    className="flex items-center gap-1.5 text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors text-[10px] font-bold"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    {enrollment.progress === 0 ? 'Começar Curso' : enrollment.progress === 100 ? 'Revisar Aulas' : 'Continuar Aprendendo'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { CheckCircle2, Briefcase, Calendar, ChevronRight, ArrowLeft, XCircle } from 'lucide-react';
import { Application } from '../types';

interface ApplicationsSectionProps {
  applications: Application[];
  onNavigateToJobs: () => void;
  onBack: () => void;
  onCancelApplication: (id: string) => void;
}

export default function ApplicationsSection({
  applications,
  onNavigateToJobs,
  onBack,
  onCancelApplication,
}: ApplicationsSectionProps) {
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
          <h1 className="text-sm font-bold text-gray-900 font-sans tracking-tight truncate">Candidaturas</h1>
        </div>
        <span className="text-[10px] font-bold text-brand-purple bg-brand-purple/10 px-2.5 py-1 rounded-full flex items-center gap-1 border border-brand-purple/20">
          <CheckCircle2 className="w-3.5 h-3.5 text-brand-purple" />
          <span>Vagas Inscritas</span>
        </span>
      </header>

      {/* Main body scroll view */}
      <div className="flex-1 overflow-y-auto custom-scroll p-4">
        <span className="text-[10px] font-bold text-gray-400 font-mono tracking-wider px-1">
          {applications.length} PROCESSOS DE CANDIDATURA SEGUIDOS
        </span>

        {/* Candidacies items list */}
        {applications.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center mt-3">
            <CheckCircle2 className="w-8 h-8 text-gray-300 mb-2.5" />
            <p className="text-xs font-semibold text-gray-700">Nenhuma candidatura registrada</p>
            <p className="text-[10px] text-gray-400 mt-1 max-w-[210px] text-center leading-normal">
              Navegue pelas vagas e clique em "Confirmar Candidatura" para ver seu progresso de análise em tempo real aqui.
            </p>
            <button
              onClick={onNavigateToJobs}
              className="mt-4 text-[10px] bg-primary text-white font-bold py-2.5 px-4 rounded-xl cursor-pointer hover:bg-primary-dark shadow transition-all duration-200"
            >
              Ver Vagas Ativas
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5 mt-3">
            {applications.map((app) => (
              <div
                key={app.id}
                className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4 animate-fadeIn"
              >
                <div className="flex justify-between items-start">
                  <div>
                    {app.candidateName && (
                      <div className="mb-1.5 flex">
                        <span className="inline-flex items-center gap-1 text-[8px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md uppercase tracking-wider font-sans">
                          Candidato: {app.candidateName}
                        </span>
                      </div>
                    )}
                    <h4 className="text-xs font-bold text-gray-800 leading-tight pr-2">{app.jobTitle}</h4>
                    <p className="text-[9px] text-gray-400 font-medium mt-1 flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-gray-400" />
                      {app.company}
                    </p>
                    <p className="text-[9px] text-gray-400 font-medium mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      Candidatado em {app.appliedDate}
                    </p>
                  </div>

                  {(() => {
                    const rawSt = (app.status || '').toLowerCase();
                    const isInterview = rawSt.includes('entrevista');
                    const isApproved = rawSt.includes('aprovad');
                    const isRejected = rawSt.includes('reprovad');
                    const displayStatus = isApproved ? 'Aprovado' : isInterview ? 'Entrevista' : isRejected ? 'Reprovado' : 'Em análise';

                    return (
                      <span
                        className={`text-[8px] uppercase font-bold tracking-wide px-2.5 py-1 rounded-full shrink-0 ${
                          isInterview
                            ? 'bg-blue-50 text-blue-600 border border-blue-100/50'
                            : isApproved
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50'
                            : isRejected
                            ? 'bg-red-50 text-red-600 border border-red-100/50'
                            : 'bg-amber-50 text-amber-600 border border-amber-100/50'
                        }`}
                      >
                        {displayStatus}
                      </span>
                    );
                  })()}
                </div>

                {/* Timeline Progress Tracker circles */}
                {(() => {
                  const rawSt = (app.status || '').toLowerCase();
                  const isInterview = rawSt.includes('entrevista');
                  const isApproved = rawSt.includes('aprovad');

                  return (
                    <div className="flex justify-between items-center px-1 mt-1 font-mono text-[8px] text-gray-400 font-semibold select-none">
                      <div className="flex flex-col items-center gap-1 flex-1 relative">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white ring-2 ring-emerald-500/20 z-10" />
                        <span className="mt-1">Enviado</span>
                        <div className="absolute top-[5px] left-[50%] right-[-50%] h-[1.5px] bg-emerald-500" />
                      </div>

                      <div className="flex flex-col items-center gap-1 flex-1 relative">
                        <div className={`w-2.5 h-2.5 rounded-full ${isInterview || isApproved || rawSt.includes('análise') || rawSt.includes('analise') ? 'bg-emerald-500' : 'bg-gray-200'} border-2 border-white z-10`} />
                        <span className="mt-1">Em análise</span>
                        <div className={`absolute top-[5px] left-[50%] right-[-50%] h-[1.5px] ${isInterview || isApproved ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                      </div>

                      <div className="flex flex-col items-center gap-1 flex-1 relative">
                        <div className={`w-2.5 h-2.5 rounded-full ${isInterview || isApproved ? 'bg-emerald-500' : 'bg-gray-200'} border-2 border-white z-10`} />
                        <span className="mt-1">Entrevista</span>
                        <div className={`absolute top-[5px] left-[50%] right-[-50%] h-[1.5px] ${isApproved ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                      </div>

                      <div className="flex flex-col items-center gap-1 flex-1">
                        <div className={`w-2.5 h-2.5 rounded-full ${isApproved ? 'bg-emerald-500' : 'bg-gray-200'} border-2 border-white z-10`} />
                        <span className="mt-1">Aprovado</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Status Guidance Banner */}
                {((app.status || '').toLowerCase().includes('entrevista')) && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 flex items-start gap-2">
                    <span className="text-base">💬</span>
                    <div>
                      <strong className="block font-bold">Convite para Entrevista!</strong>
                      <span className="text-[11px] text-blue-700">A empresa {app.company} selecionou seu currículo. Fique com seu WhatsApp e telefone atentos para o agendamento.</span>
                    </div>
                  </div>
                )}

                {((app.status || '').toLowerCase().includes('aprovad')) && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                    <span className="text-base">🎉</span>
                    <div>
                      <strong className="block font-bold">Parabéns, você foi Aprovado(a)!</strong>
                      <span className="text-[11px] text-emerald-700">A empresa {app.company} aprovou sua candidatura. Aguarde o contato com as orientações de contratação.</span>
                    </div>
                  </div>
                )}

                {/* Cancel Action */}
                <div className="mt-2 pt-3 border-t border-gray-100 flex justify-end">
                  <button 
                    onClick={() => onCancelApplication(app.id)}
                    className="flex items-center gap-1.5 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors text-[10px] font-bold cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Cancelar Candidatura
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

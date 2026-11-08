import { useState } from 'react';
import { CheckCircle, GraduationCap, ArrowLeft, BookOpen, Award, Eye, Download, X, BookmarkCheck, ShieldCheck, CornerDownRight } from 'lucide-react';
import { UserCourseProgress } from '../types';
import { jsPDF } from 'jspdf';
import { mockCourses } from '../data';

interface CompletedCoursesSectionProps {
  completedCourses: UserCourseProgress[];
  onBack: () => void;
}

export default function CompletedCoursesSection({
  completedCourses,
  onBack,
}: CompletedCoursesSectionProps) {
  const [selectedProgress, setSelectedProgress] = useState<UserCourseProgress | null>(null);

  // Generate a premium certificate PDF (landscape) matching the high-fidelity template in CoursePlayerScreen
  const handleDownloadPDF = async (progress: UserCourseProgress) => {
    // Find course from mock to fetch duration information
    const matchedCourse = mockCourses.find(c => c.id === progress.course_id);
    const duration = matchedCourse ? matchedCourse.duration : '10 horas';

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    let hasPinyon = false;
    try {
      // Dynamic fetch of the luxury Pinyon Script cursive font from stable CDN (jsDelivr)
      const fontRes = await fetch('https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/pinyonscript/PinyonScript-Regular.ttf');
      if (fontRes.ok) {
        const arrayBuffer = await fontRes.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(arrayBuffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        doc.addFileToVFS('PinyonScript-Regular.ttf', base64);
        doc.addFont('PinyonScript-Regular.ttf', 'PinyonScript', 'normal');
        hasPinyon = true;
      }
    } catch (err) {
      console.warn('Network limits prevented loading cursive font, falling back to Times Italic', err);
    }

    // Convert Name to fine, mixed title-case casing for calligraphic lettering
    const toTitleCase = (str: string) => {
      return str.toLowerCase().replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
    };
    const nameToUse = progress.user_name || 'Aluno Oportuniza';
    const formattedUserName = toTitleCase(nameToUse);

    // 1. Base background: Premium light linen cream
    doc.setFillColor(254, 253, 250);
    doc.rect(0, 0, 297, 210, 'F');

    // 2. Extra outer thick frame (Elegant Deep Navy)
    doc.setLineWidth(5);
    doc.setDrawColor(22, 38, 59); // Deep Navy
    doc.rect(8, 8, 281, 194);

    // 3. Middle fine frame (Bright Gold)
    doc.setLineWidth(0.8);
    doc.setDrawColor(194, 155, 68); // Rich Luxury Gold
    doc.rect(12, 12, 273, 186);

    // 4. Inner secondary fine frame (Bright Gold)
    doc.setLineWidth(0.3);
    doc.setDrawColor(194, 155, 68);
    doc.rect(14, 14, 269, 182);

    // 5. Draw decorative Golden Corner Ornaments at each of the 4 inner corners
    const drawCornerOrnament = (cx: number, cy: number, isRight: boolean, isBottom: boolean) => {
      const size = 12;
      const signX = isRight ? -1 : 1;
      const signY = isBottom ? -1 : 1;
      
      doc.setLineWidth(1.2);
      doc.setDrawColor(194, 155, 68);
      // L shape
      doc.line(cx, cy, cx + (size * signX), cy);
      doc.line(cx, cy, cx, cy + (size * signY));
      
      // Secondary nested L-shape
      doc.setLineWidth(0.4);
      doc.line(cx + (3 * signX), cy + (3 * signY), cx + ((size - 2) * signX), cy + (3 * signY));
      doc.line(cx + (3 * signX), cy + (3 * signY), cx + (3 * signX), cy + ((size - 2) * signY));
      
      // Diamond accent
      doc.setFillColor(194, 155, 68);
      doc.triangle(
        cx + (1.5 * signX), cy + (1.5 * signY),
        cx + (4.5 * signX), cy + (0.5 * signY),
        cx + (0.5 * signX), cy + (4.5 * signY),
        'F'
      );
    };

    drawCornerOrnament(14, 14, false, false);   // Top Left
    drawCornerOrnament(283, 14, true, false);   // Top Right
    drawCornerOrnament(14, 196, false, true);   // Bottom Left
    drawCornerOrnament(283, 196, true, true);   // Bottom Right

    // 6. Subdued subtle background watermark
    doc.setFont("times", "bolditalic");
    doc.setFontSize(54);
    doc.setTextColor(245, 241, 233); // Extremely soft watermark beige
    doc.text("OPORTUNIZA ACADEMY", 148.5, 110, { align: "center" });

    // 7. Academic shield emblem centered at the top
    const embX = 148.5;
    const embY = 28;
    doc.setLineWidth(0.6);
    doc.setDrawColor(194, 155, 68);
    doc.setFillColor(22, 38, 59); // Deep Navy Shield
    doc.triangle(embX, embY - 8, embX - 6, embY - 1, embX + 6, embY - 1, 'F');
    doc.triangle(embX, embY + 4, embX - 6, embY - 1, embX + 6, embY - 1, 'F');
    doc.setFillColor(194, 155, 68); // Gold inner star/dot
    doc.circle(embX, embY - 1.2, 1.5, 'F');

    // 8. Platform Title / Credential Brand
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 38, 59); // Deep Navy
    doc.setFontSize(18);
    doc.text("OPORTUNIZA", 148.5, 38, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(8);
    doc.text("PLATAFORMA DE ENSINO E FORMAÇÃO PROFISSIONAL", 148.5, 43, { align: "center" });

    // Elegant spacer line
    doc.setLineWidth(0.3);
    doc.setDrawColor(194, 155, 68);
    doc.line(105, 47, 192, 47);

    // 9. Main Certificate Header
    doc.setFont("times", "bolditalic");
    doc.setTextColor(22, 38, 59);
    doc.setFontSize(32);
    doc.text("Certificado de Conclusão", 148.5, 65, { align: "center" });

    // 10. Statement
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.text("Certificamos para os devidos fins de comprovação e capacitação curricular que", 148.5, 82, { align: "center" });

    // 11. Student Name
    if (hasPinyon) {
      doc.setFont("PinyonScript", "normal");
      doc.setFontSize(44);
    } else {
      doc.setFont("times", "bolditalic");
      doc.setFontSize(28);
    }
    doc.setTextColor(194, 155, 68); // Gold
    doc.text(formattedUserName, 148.5, 100, { align: "center" });

    // Underline
    doc.setLineWidth(0.4);
    doc.setDrawColor(194, 155, 68);
    doc.line(70, 104, 227, 104);

    // 12. Explanation
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text("concluiu com êxito e aproveitamento pleno o programa de capacitação livre do", 148.5, 114, { align: "center" });

    // 13. Course Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(22, 38, 59);
    doc.text((progress.course_title || '').toUpperCase(), 148.5, 124, { align: "center" });

    // 14. Course Details
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const formattedDate = new Date(progress.completed_at).toLocaleDateString('pt-BR');
    doc.text(`Carga Horária Estimada: ${duration}   •   Emissão: ${formattedDate}   •   Registrado sob nº OP-${progress.course_id.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`, 148.5, 134, { align: "center" });

    // 15. Premium Golden Seal
    const sealX = 148.5;
    const sealY = 162;

    doc.setFillColor(194, 155, 68);
    doc.triangle(sealX - 4, sealY, sealX - 9, sealY + 22, sealX, sealY + 18, 'F');
    doc.setFillColor(153, 115, 34);
    doc.triangle(sealX + 4, sealY, sealX + 9, sealY + 22, sealX, sealY + 18, 'F');

    doc.setFillColor(218, 181, 101);
    doc.circle(sealX, sealY, 13, 'F');
    doc.setDrawColor(165, 125, 45);
    doc.setLineWidth(0.6);
    doc.circle(sealX, sealY, 13, 'D');

    for (let deg = 0; deg < 360; deg += 12) {
      const rad = deg * Math.PI / 180;
      doc.circle(sealX + 11.2 * Math.cos(rad), sealY + 11.2 * Math.sin(rad), 1.2, 'F');
    }

    doc.setFillColor(22, 38, 59);
    doc.circle(sealX, sealY, 9, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5);
    doc.setTextColor(218, 181, 101);
    doc.text("OPORTUNIZA", sealX, sealY - 2, { align: "center" });
    doc.text("VALIDADO", sealX, sealY + 1.2, { align: "center" });
    doc.setFontSize(4);
    doc.text("OFICIAL", sealX, sealY + 4.2, { align: "center" });

    // 16. Signatures
    doc.setLineWidth(0.4);
    doc.setDrawColor(120, 120, 120);

    // Left Signature
    doc.line(35, 172, 95, 172);
    if (hasPinyon) {
      doc.setFont("PinyonScript", "normal");
      doc.setFontSize(26);
    } else {
      doc.setFont("times", "italic");
      doc.setFontSize(22);
    }
    doc.setTextColor(22, 38, 59);
    doc.text("Pedro Orchel", 65, 166, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(22, 38, 59);
    doc.text("Pedro Orchel", 65, 177, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text("Diretor de Ensino", 65, 181, { align: "center" });
    doc.text("Oportuniza Franchising", 65, 184, { align: "center" });

    // Right Signature
    doc.line(202, 172, 262, 172);
    if (hasPinyon) {
      doc.setFont("PinyonScript", "normal");
      doc.setFontSize(26);
    } else {
      doc.setFont("times", "italic");
      doc.setFontSize(22);
    }
    doc.setTextColor(22, 38, 59);
    doc.text("Elena S. Ramos", 232, 166, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(22, 38, 59);
    doc.text("Elena S. Ramos", 232, 177, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text("Coordenação Geral Acadêmica", 232, 181, { align: "center" });
    doc.text("Conselho Oficial Oportuniza", 232, 184, { align: "center" });

    // 17. Security Hash
    const verifyHash = `CHAVE DE VALIDAÇÃO: OPT-HASH-${progress.course_id.toUpperCase()}-${Math.floor(10000000 + Math.random() * 90000000)}`;
    doc.setFont("monospace", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(140, 140, 140);
    doc.text(verifyHash, 148.5, 192, { align: "center" });

    doc.save(`Certificado_Oportuniza_${progress.course_title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#F3F4F6] absolute inset-0">
      <header className="px-5 pt-6 pb-4 bg-white border-b border-gray-100 flex items-center justify-between shadow-sm shrink-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={onBack}
            className="p-1 px-1.5 rounded-lg hover:bg-gray-100 active:scale-95 transition-transform text-gray-600 hover:text-gray-900 cursor-pointer shrink-0"
            aria-label="Voltar para as configurações"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-bold text-gray-900 font-sans tracking-tight truncate">Seus Certificados</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scroll p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-bold text-gray-400 font-mono tracking-wider px-1">
            {completedCourses.length} CERTIFICADOS CONCLUÍDOS
          </span>
          {completedCourses.length > 0 && (
            <span className="text-[10px] text-teal-600 font-bold bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100/50 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> 100% Autenticados
            </span>
          )}
        </div>

        {completedCourses.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center mt-3 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
              <GraduationCap className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-xs font-bold text-gray-700">Nenhum certificado ativo no momento</p>
            <p className="text-[10px] text-gray-400 mt-1 max-w-[210px] text-center leading-normal">
              Conclua 100% das aulas de qualquer curso na plataforma e seu certificado oficial será gerado instantaneamente aqui.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {completedCourses.map((progress) => {
              const matchedC = mockCourses.find(c => c.id === progress.course_id);
              const duration = matchedC ? matchedC.duration : 'Capacitação Livre';
              
              return (
                <div
                  key={progress.id}
                  className="bg-white p-4 rounded-2xl border border-gray-100 hover:border-amber-200/60 shadow-sm hover:shadow transition-all flex flex-col gap-3 group animate-fadeIn"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1 flex gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100/40 flex items-center justify-center shrink-0 group-hover:bg-amber-100/20 transition-colors">
                        <Award className="w-5 h-5 text-amber-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-extrabold text-gray-900 leading-tight group-hover:text-amber-800 transition-colors truncate">
                          {progress.course_title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[9px] text-gray-400 font-medium">
                          <span className="flex items-center gap-0.5">
                            <BookOpen className="w-3 h-3 text-gray-400" />
                            {duration}
                          </span>
                          <span>•</span>
                          <span>Concluído em: {new Date(progress.completed_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50 shrink-0" title="Confirmado e Assinado" />
                  </div>

                  <hr className="border-gray-50 -mx-4" />

                  {/* Actions Bar */}
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setSelectedProgress(progress)}
                      className="flex items-center justify-center gap-1.5 bg-gray-50 hover:bg-amber-50 hover:text-amber-700 text-gray-600 text-[11px] font-bold px-3 py-2 rounded-xl border border-gray-100 hover:border-amber-100 transition-all cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Visualizar
                    </button>
                    <button
                      onClick={() => handleDownloadPDF(progress)}
                      className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-[11px] font-extrabold px-3 py-2 rounded-xl shadow-sm shadow-amber-500/20 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar PDF
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Interactive, Luxurious Certificate Preview Modal */}
      {selectedProgress && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#111C2D] border border-[#1E2E44] w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[96vh] animate-fadeIn scale-up select-none">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-[#1C2C42] border-b border-[#253954] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-amber-400">
                <Award className="w-5 h-5" />
                <span className="text-xs font-bold tracking-tight text-white">Visualização de Certificado Digital</span>
              </div>
              <button
                onClick={() => setSelectedProgress(null)}
                className="p-1 px-1.5 rounded-lg bg-[#273B54] hover:bg-[#344D6C] text-gray-300 hover:text-white transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content - Scrollable if screen is very small */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center bg-[#070D19] justify-center">
              
              {/* Responsive Container mimicking Landscape Certificate A4 */}
              <div className="w-full aspect-[1.414/1] max-w-2xl bg-[#FEFDFB] text-[#16263B] rounded-xl relative shadow-2xl border-4 border-[#16263B] p-2 sm:p-5 flex flex-col justify-between overflow-hidden">
                
                {/* Gold Inner Borders */}
                <div className="absolute inset-1 sm:inset-2 border border-[#C29B44] pointer-events-none rounded-lg" />
                <div className="absolute inset-1.5 sm:inset-3 border-[0.5px] border-[#C29B44] pointer-events-none rounded-lg" />

                {/* Corner Golden Ornaments (Simulated via divs) */}
                <div className="absolute top-3 sm:top-5 left-3 sm:left-5 w-4 sm:w-6 h-4 sm:h-6 border-t-2 border-l-2 border-[#C29B44] pointer-events-none" />
                <div className="absolute top-3 sm:top-5 right-3 sm:right-5 w-4 sm:w-6 h-4 sm:h-6 border-t-2 border-r-2 border-[#C29B44] pointer-events-none" />
                <div className="absolute bottom-3 sm:bottom-5 left-3 sm:left-5 w-4 sm:w-6 h-4 sm:h-6 border-b-2 border-l-2 border-[#C29B44] pointer-events-none" />
                <div className="absolute bottom-3 sm:bottom-5 right-3 sm:right-5 w-4 sm:w-6 h-4 sm:h-6 border-b-2 border-r-2 border-[#C29B44] pointer-events-none" />

                {/* Soft watermark bg */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] select-none pointer-events-none">
                  <span className="font-serif font-black italic text-4xl sm:text-6xl text-center transform -rotate-12">
                    OPORTUNIZA ACADEMY
                  </span>
                </div>

                {/* Top Shield Emblem & Header */}
                <div className="text-center mt-1 z-10 flex flex-col items-center">
                  <div className="w-5 sm:w-7 h-5 sm:h-7 rounded-sm bg-[#16263B] border border-[#C29B44] rotate-45 flex items-center justify-center mb-1 sm:mb-2 shadow-sm shrink-0">
                    <span className="text-[6px] sm:text-[8px] text-[#FEFDFB] -rotate-45 font-bold">OP</span>
                  </div>
                  <h3 className="text-[12px] sm:text-[14px] font-sans font-black tracking-widest text-[#16263B]">
                    OPORTUNIZA
                  </h3>
                  <p className="text-[5px] sm:text-[7px] text-[#A0A0A0] leading-none uppercase tracking-widest mt-0.5">
                    PLATAFORMA DE ENSINO E FORMAÇÃO PROFISSIONAL
                  </p>
                  <div className="w-16 sm:w-32 h-[1px] bg-[#C29B44] mt-1 sm:mt-1.5 mx-auto" />
                </div>

                {/* Central Title */}
                <div className="text-center my-1 z-10">
                  <h2 className="font-serif font-bold italic text-md sm:text-2xl text-[#16263B] leading-none">
                    Certificado de Conclusão
                  </h2>
                  <p className="text-[6px] sm:text-[9.5px] text-[#555] mt-1.5 sm:mt-2.5">
                    Certificamos para os devidos fins de comprovação e capacitação curricular que
                  </p>
                </div>

                {/* Course & Student Name */}
                <div className="text-center z-10 my-1">
                  <h1 className="font-pinyon text-2xl sm:text-5xl text-[#C29B44] tracking-normal normal-case leading-none my-1">
                    {(() => {
                      const toTitleCase = (str: string) => str.toLowerCase().replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
                      return toTitleCase(selectedProgress.user_name || 'Aluno Oportuniza');
                    })()}
                  </h1>
                  <div className="w-24 sm:w-48 h-[0.5px] bg-[#C29B44] mx-auto opacity-70" />
                  <p className="text-[6px] sm:text-[9px] text-[#555] mt-1 sm:mt-1.5">
                    concluiu com êxito e aproveitamento pleno o programa de capacitação livre do
                  </p>
                  <h4 className="font-sans font-black text-[9px] sm:text-lg text-[#16263B] tracking-wide mt-1 uppercase leading-snug">
                    {selectedProgress.course_title}
                  </h4>
                </div>

                {/* Academic stamp/ribbon + Signatures */}
                <div className="grid grid-cols-3 items-end content-end justify-between px-4 sm:px-10 z-10 h-10 sm:h-[68px] mt-1">
                  
                  {/* Left Sig: Pedro Orchel */}
                  <div className="text-center flex flex-col justify-end">
                    <span className="font-pinyon text-[18px] sm:text-4xl text-[#16263B] leading-none select-none tracking-normal pt-1 sm:pt-2">
                      Pedro Orchel
                    </span>
                    <div className="w-full border-t border-gray-400 mt-0.5 sm:mt-1" />
                    <p className="text-[5px] sm:text-[7.5px] font-bold text-[#16263B] leading-tight mt-0.5 sm:mt-1">
                      Pedro Orchel
                    </p>
                    <p className="text-[4px] sm:text-[6.5px] text-gray-500 leading-none">
                      Diretor de Ensino
                    </p>
                  </div>

                  {/* Golden stamp replica in center */}
                  <div className="flex flex-col items-center justify-end relative h-full">
                    {/* Ribbon ends */}
                    <div className="absolute bottom-[2px] w-6 sm:w-9 flex justify-between pointer-events-none">
                      <div className="w-[6px] sm:w-[9px] h-4 sm:h-7 bg-[#C29B44] origin-bottom -rotate-12 translate-x-1" />
                      <div className="w-[6px] sm:w-[9px] h-4 sm:h-7 bg-[#997322] origin-bottom rotate-12 -translate-x-1" />
                    </div>
                    {/* Seal circle */}
                    <div className="w-6 sm:w-10 h-6 sm:h-10 rounded-full bg-gradient-to-r from-[#DAB565] to-[#C29B44] border-[0.5px] border-[#997322] flex items-center justify-center shadow z-10 shrink-0">
                      <div className="w-4 sm:w-7 h-4 sm:h-7 rounded-full bg-[#16263B] border-[0.3px] border-[#DAB565] flex flex-col items-center justify-center">
                        <span className="text-[2px] sm:text-[3.5px] text-[#DAB565] font-black leading-none uppercase">OP</span>
                        <span className="text-[1.5px] sm:text-[2.5px] text-yellow-100 uppercase opacity-90 font-bold tracking-wider">VALIDADO</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Sig: Elena Ramos */}
                  <div className="text-center flex flex-col justify-end">
                    <span className="font-pinyon text-[18px] sm:text-4xl text-[#16263B] leading-none select-none tracking-normal pt-1 sm:pt-2">
                      Elena S. Ramos
                    </span>
                    <div className="w-full border-t border-gray-400 mt-0.5 sm:mt-1" />
                    <p className="text-[5px] sm:text-[7.5px] font-bold text-[#16263B] leading-tight mt-0.5 sm:mt-1">
                      Elena S. Ramos
                    </p>
                    <p className="text-[4px] sm:text-[6.5px] text-gray-500 leading-none">
                      Coordenação Geral Acadêmica
                    </p>
                  </div>

                </div>

                {/* Validation Info footer */}
                <div className="text-center z-10 pb-0.5 sm:pb-1">
                  <p className="text-[4.5px] sm:text-[6px] font-mono text-gray-400 uppercase tracking-widest leading-none mt-2 sm:mt-0">
                    SISTEMA DE SEGURANÇA OPORTUNIZA • HASH VÁLIDO: OPT-HASH-{selectedProgress.course_id.toUpperCase()}
                  </p>
                </div>

              </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="px-5 py-4 bg-[#152336] border-t border-[#1E2E44] flex flex-col sm:flex-row gap-2.5 sm:justify-end shrink-0">
              <button
                onClick={() => setSelectedProgress(null)}
                className="w-full sm:w-auto px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
              >
                Voltar
              </button>
              <button
                onClick={() => handleDownloadPDF(selectedProgress)}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-amber-500/10 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                <Download className="w-4 h-4" />
                Baixar Certificado Oficial PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


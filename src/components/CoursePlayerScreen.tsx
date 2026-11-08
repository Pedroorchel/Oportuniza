import React, { useState } from 'react';
import { ArrowLeft, Play, CheckCircle2, Circle, Clock, Award, Share2, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Course } from '../types';

interface CoursePlayerScreenProps {
  course: Course;
  onBack: () => void;
  onToggleLessonCompletion: (courseId: string, lessonTitle: string) => void;
  lessonProgress: Record<string, boolean>; // e.g. { "lesson title": true }
  userName?: string;
  userId?: string;
  onCompleteCourse?: (userId: string, courseId: string, userName: string, courseTitle: string) => Promise<void>;
}

export default function CoursePlayerScreen({
  course,
  onBack,
  onToggleLessonCompletion,
  lessonProgress,
  userName = 'Aluno de Honra',
  userId,
  onCompleteCourse,
}: CoursePlayerScreenProps) {
  const [justCompleted, setJustCompleted] = useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Find first lesson with a youtubeId, default to index 0
  const [activeLessonIndex, setActiveLessonIndex] = useState(() => {
    const firstWithId = course.lessons.findIndex((l) => l.youtubeId);
    return firstWithId !== -1 ? firstWithId : 0;
  });

  const activeLesson = course.lessons[activeLessonIndex];
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  // Calculate total completed in local state
  const completedLessonsCount = course.lessons.filter((l) => lessonProgress[l.title]).length;
  const progressPercent = Math.round((completedLessonsCount / course.lessons.length) * 100);

  const handleComplete = async () => {
    if (userId && onCompleteCourse) {
      await onCompleteCourse(userId, course.id, userName, course.title);
      setJustCompleted(true);
    }
  };

  // Keep fresh references of state/callbacks to avoid re-registering and missing postMessage listeners
  const refs = React.useRef({
    activeLesson,
    activeLessonIndex,
    lessons: course.lessons,
    courseId: course.id,
    lessonProgress,
    onToggleLessonCompletion,
    handleComplete,
    justCompleted
  });

  React.useEffect(() => {
    refs.current = {
      activeLesson,
      activeLessonIndex,
      lessons: course.lessons,
      courseId: course.id,
      lessonProgress,
      onToggleLessonCompletion,
      handleComplete,
      justCompleted
    };
  });

  // Periodic subscription to YouTube iframe state events
  React.useEffect(() => {
    if (!activeLesson?.youtubeId) return;

    const interval = setInterval(() => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        try {
          // Tell the YouTube Player to send us onStateChange events
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({
              event: 'command',
              func: 'addEventListener',
              args: ['onStateChange']
            }),
            '*'
          );
          
          // Also send standard YT API listening handshake
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({
              event: 'listening',
              id: 1,
              channel: 'widget'
            }),
            '*'
          );

          // Tell the YouTube Player to send us onStateChange with widget channel info
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({
              event: 'command',
              func: 'addEventListener',
              args: ['onStateChange'],
              id: 1,
              channel: 'widget'
            }),
            '*'
          );
        } catch (e) {
          // Safe lock
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeLesson]);

  // Handle auto-completing lesson when YouTube video ends
  React.useEffect(() => {
    let timeoutId: any = null;

    const handleMessage = (event: MessageEvent) => {
      try {
        let data = event.data;
        if (!data) return;

        let parsed: any = null;
        if (typeof data === 'string') {
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            // Raw string checks if JSON parsing fails but contains event hints
            if (
              (data.includes('"event":"onStateChange"') && data.includes('"info":0')) ||
              (data.includes('"playerState":0') || data.includes('\"playerState\":0')) ||
              (data.includes('onStateChange') && data.includes('info:0'))
            ) {
              parsed = { event: 'onStateChange', info: 0 };
            }
          }
        } else if (typeof data === 'object') {
          parsed = data;
        }

        if (!parsed) return;

        let isEnded = false;

        // 1. Standard onStateChange with state 0 (ended)
        if (parsed.event === 'onStateChange' && (parsed.info === 0 || parsed.info?.playerState === 0)) {
          isEnded = true;
        }
        // 2. infoDelivery events with playerState 0 (ended)
        else if (parsed.event === 'infoDelivery' && parsed.info && parsed.info.playerState === 0) {
          isEnded = true;
        }
        // 3. Simple playerState fields at the root
        else if (parsed.playerState === 0 || (parsed.info === 0 && parsed.event === 'onStateChange')) {
          isEnded = true;
        }

        if (isEnded) {
          const current = refs.current;
          const lesson = current.activeLesson;
          if (!lesson) return;

          const isCompleted = current.lessonProgress[lesson.title] || false;
          if (!isCompleted) {
            current.onToggleLessonCompletion(current.courseId, lesson.title);
          }

          // Clear any pending transitions/timeouts
          if (timeoutId) clearTimeout(timeoutId);

          // Auto-advance to the next lesson/module after a small delay to show completion feedback
          timeoutId = setTimeout(() => {
            const nextIndex = refs.current.activeLessonIndex + 1;
            if (nextIndex < refs.current.lessons.length) {
              setActiveLessonIndex(nextIndex);
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
              }
            } else {
              // If this is the last lesson, let's automatically trigger overall course completion!
              if (!refs.current.justCompleted) {
                refs.current.handleComplete();
              }
            }
          }, 1200);
        }
      } catch (err) {
        // Safe lock
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const handleToggleDone = (e: React.MouseEvent, title: string) => {
    e.stopPropagation();
    onToggleLessonCompletion(course.id, title);
  };

  const handleShare = () => {
    if (activeLesson?.youtubeId) {
      const link = `https://www.youtube.com/watch?v=${activeLesson.youtubeId}`;
      navigator.clipboard.writeText(link);
      alert('Link do vídeo copiado para a área de transferência!');
    }
  };

  const handleSelectLesson = (idx: number) => {
    setActiveLessonIndex(idx);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDownloadCertificate = async () => {
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
    const formattedUserName = toTitleCase(userName || 'Aluno Oportuniza');

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

    // 11. Student Name (Large, elegant and prominent from reference photo font style)
    if (hasPinyon) {
      doc.setFont("PinyonScript", "normal");
      doc.setFontSize(44); // Cursive looks beautiful at larger scale
    } else {
      doc.setFont("times", "bolditalic");
      doc.setFontSize(28);
    }
    doc.setTextColor(194, 155, 68); // Elegant Gold Accent Color
    doc.text(formattedUserName, 148.5, 100, { align: "center" });

    // Fine underline under the name
    doc.setLineWidth(0.4);
    doc.setDrawColor(194, 155, 68);
    doc.line(70, 104, 227, 104);

    // 12. Explanation text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text("concluiu com êxito e aproveitamento pleno o programa de capacitação livre do", 148.5, 114, { align: "center" });

    // 13. Course Name (Large and impactful)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(22, 38, 59); // Deep Navy
    doc.text((course.title || '').toUpperCase(), 148.5, 124, { align: "center" });

    // 14. Course Details & Dates
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const dateStr = new Date().toLocaleDateString('pt-BR');
    doc.text(`Carga Horária Estimada: ${course.duration}   •   Emissão: ${dateStr}   •   Registrado sob nº OP-${course.id.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`, 148.5, 134, { align: "center" });

    // 15. Premium Golden Seal at the bottom center
    const sealX = 148.5;
    const sealY = 162;

    // Draw seal ribbons pointing downwards
    doc.setFillColor(194, 155, 68); // Gold Ribbon 1
    doc.triangle(sealX - 4, sealY, sealX - 9, sealY + 22, sealX, sealY + 18, 'F');
    doc.setFillColor(153, 115, 34); // Ribbons Shadow (Darker Gold)
    doc.triangle(sealX + 4, sealY, sealX + 9, sealY + 22, sealX, sealY + 18, 'F');

    // Seal Outer Ring
    doc.setFillColor(218, 181, 101); // bright gold base
    doc.circle(sealX, sealY, 13, 'F');
    doc.setDrawColor(165, 125, 45); // dark gold edge
    doc.setLineWidth(0.6);
    doc.circle(sealX, sealY, 13, 'D');

    // Rosette star-like patterns
    doc.setLineWidth(0.2);
    for (let deg = 0; deg < 360; deg += 12) {
      const rad = deg * Math.PI / 180;
      doc.circle(sealX + 11.2 * Math.cos(rad), sealY + 11.2 * Math.sin(rad), 1.2, 'F');
    }

    doc.setFillColor(22, 38, 59); // deep navy core
    doc.circle(sealX, sealY, 9, 'F');
    
    // In-seal initials/stars
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5);
    doc.setTextColor(218, 181, 101); // Bright Gold text
    doc.text("OPORTUNIZA", sealX, sealY - 2, { align: "center" });
    doc.text("VALIDADO", sealX, sealY + 1.2, { align: "center" });
    doc.setFontSize(4);
    doc.text("OFICIAL", sealX, sealY + 4.2, { align: "center" });

    // 16. Signature Blocks (Left: Pedro Orchel, Right: Coordenação Acadêmica)
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

    // 17. Security Hash at the very bottom
    const verifyHash = `CHAVE DE VALIDAÇÃO: OPT-HASH-${course.id.toUpperCase()}-${Math.floor(10000000 + Math.random() * 90000000)}`;
    doc.setFont("monospace", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(140, 140, 140);
    doc.text(verifyHash, 148.5, 192, { align: "center" });

    // Save
    doc.save(`Certificado_Oportuniza_${course.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  };

  const renderPlaylistLessons = () => {
    return course.lessons.map((lesson, idx) => {
      const isPlaying = idx === activeLessonIndex;
      const isCompleted = lessonProgress[lesson.title] || false;

      return (
        <div
          key={idx}
          onClick={() => handleSelectLesson(idx)}
          className={`p-3.5 rounded-xl flex items-center justify-between gap-3 transition-colors cursor-pointer text-left ${
            isPlaying 
              ? 'bg-teal-500/10 border border-teal-500/30 text-white' 
              : 'bg-[#152336] hover:bg-[#1E2E44]/80 text-gray-200 border border-transparent'
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-gray-400">
              <span>MÓDULO {idx + 1}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-gray-400">
                <Clock className="w-3 h-3 text-gray-400" />
                {lesson.duration}
              </span>
            </div>
            <p className={`text-xs font-bold tracking-tight leading-tight transition-colors ${
              isPlaying ? 'text-teal-400' : 'text-gray-100'
            }`}>
              {lesson.title}
            </p>
          </div>

          <button
            onClick={(e) => handleToggleDone(e, lesson.title)}
            className="p-1 px-1.5 focus:outline-none shrink-0"
            title={isCompleted ? "Marcar como não assistido" : "Marcar como assistido"}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-teal-400 fill-teal-400/10" />
            ) : (
              <Circle className="w-5 h-5 text-gray-400 hover:text-teal-400 transition-colors" />
            )}
          </button>
        </div>
      );
    });
  };

  const originParam = typeof window !== 'undefined' && window.location.origin && window.location.origin !== "null"
    ? `&origin=${encodeURIComponent(window.location.origin)}`
    : '';

  return (
    <div id="course-player-root" className="w-full h-full flex flex-col bg-[#0B1523] text-white absolute inset-0 font-sans z-50 overflow-hidden">
      {/* Header */}
      <header className="px-5 py-4 bg-[#111C2D] border-b border-[#1E2E44] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-[#1E2E44] hover:bg-[#2A3E59] active:scale-95 transition-transform text-gray-300 hover:text-white cursor-pointer shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">Assistindo Curso</span>
            <h1 className="text-sm font-bold text-white tracking-tight truncate leading-tight">
              {course.title}
            </h1>
          </div>
        </div>
        <button
          onClick={handleShare}
          className="p-2 rounded-xl bg-[#1E2E44] hover:bg-[#2A3E59] text-gray-300 hover:text-white transition-all cursor-pointer"
          title="Compartilhar Aula"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </header>

      {/* Main Container - Collapsed on Mobile, side-by-side on large */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left pane: Video player + description */}
        <div ref={scrollContainerRef} className="flex-1 flex flex-col overflow-y-auto custom-scroll min-w-0">
          {/* Responsive 16:9 Aspect Video Player */}
          <div className="w-full bg-black aspect-video shrink-0 relative border-b border-[#1E2E44]">
            {activeLesson?.youtubeId ? (
              <iframe
                ref={iframeRef}
                key={activeLesson.youtubeId}
                id="ytplayer"
                src={`https://www.youtube.com/embed/${activeLesson.youtubeId}?autoplay=1&rel=0&modestbranding=1&vq=hd1080&enablejsapi=1${originParam}`}
                title={activeLesson.title}
                className="w-full h-full absolute inset-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-gray-400 bg-slate-950">
                <Play className="w-12 h-12 text-gray-600 mb-2.5 animate-pulse" />
                <p className="text-sm font-bold">Nenhum vídeo disponível para esta aula</p>
                <p className="text-xs text-gray-500 mt-1">Este módulo é composto por leituras e testes práticos.</p>
              </div>
            )}
          </div>

          {/* Under player metadata */}
          <div className="p-5 flex-1 bg-[#0E1B2D]">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="bg-[#1D314A] text-teal-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-teal-500/10">
                  AULA {activeLessonIndex + 1} DE {course.lessons.length}
                </span>
                <h2 className="text-[19px] font-bold text-white tracking-tight mt-3 leading-snug">
                  {activeLesson?.title || 'Selecionar uma aula'}
                </h2>
                <p className="text-[13px] text-gray-400 mt-1">
                  Ministrado por <strong className="text-gray-200">{course.instructor}</strong>
                </p>
              </div>

              {/* Progress Indicator Card */}
              <div className="bg-[#152336] p-4 rounded-2xl border border-[#23354E] min-w-[200px] shrink-0">
                <div className="flex justify-between items-center text-xs font-bold text-[#A0ABB6] font-mono tracking-tight mb-2">
                  <span>SEU PROGRESSO</span>
                  <span className="text-teal-400">{progressPercent}%</span>
                </div>
                <div className="w-full bg-[#0E1B2D] h-2 rounded-full overflow-hidden mb-2">
                  <div 
                    className="bg-gradient-to-r from-teal-400 to-[#5FB0C7] h-full transition-all duration-300" 
                    style={{ width: `${progressPercent}%` }} 
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1 leading-normal text-right">
                  {completedLessonsCount} de {course.lessons.length} concluídas
                </p>
              </div>
            </div>

            <hr className="border-[#1E2E44] my-5" />

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold text-white tracking-tight">Sobre o Curso</h3>
              <p className="text-[13.5px] text-gray-300 leading-relaxed">
                {course.desc}
              </p>
            </div>

            {/* Mobile Playlist Rendered Here in unified stream */}
            <div className="block md:hidden mt-8">
              <div className="p-4 bg-[#152336] rounded-t-2xl border border-[#1E2E44] flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">Playlist de Aulas</h3>
                <span className="text-[10px] text-teal-400 font-mono font-bold">
                  {course.lessons.length} Módulos
                </span>
              </div>
              <div className="bg-[#111C2D] border border-t-0 border-[#1E2E44] p-3 space-y-2 rounded-b-2xl">
                {renderPlaylistLessons()}
              </div>
            </div>

            {/* Special bottom completion badge on mobile */}
            {progressPercent === 100 && (
              <div className="block md:hidden mt-4 p-4 bg-teal-500/10 border border-teal-500/30 rounded-2xl flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Award className="w-8 h-8 text-teal-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-teal-400">Parabéns! Curso Concluído!</p>
                    <p className="text-[10px] text-gray-300 mt-0.5 leading-normal">Você domina todo o conteúdo deste curso com maestria.</p>
                  </div>
                </div>
                <button
                  onClick={handleDownloadCertificate}
                  className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-xs font-bold py-2.5 rounded-xl transition-colors mt-1 active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  Baixar Certificado PDF
                </button>
                {!justCompleted && (
                  <button
                    onClick={handleComplete}
                    className="w-full flex items-center justify-center gap-2 bg-[#1E2E44] hover:bg-[#2A3E59] text-white text-xs font-bold py-2.5 rounded-xl transition-colors mt-2 active:scale-[0.98]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Concluir o Curso
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right pane / Bottom panel on mobile: Playlist */}
        <div className="hidden md:flex w-full md:w-[320px] bg-[#111C2D] border-t md:border-t-0 md:border-l border-[#1E2E44] flex-col overflow-hidden shrink-0">
          <div className="p-4 bg-[#152336] border-b border-[#1E2E44] flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">Playlist de Aulas</h3>
            <span className="text-[10px] text-gray-400 font-mono font-bold">
              {course.lessons.length} Módulos
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scroll p-2 space-y-1.5">
            {renderPlaylistLessons()}
          </div>

          {/* Special bottom completion badge */}
          {progressPercent === 100 && (
            <div className="p-4 bg-teal-500/10 border-t border-teal-500/30 flex flex-col shrink-0 gap-3">
              <div className="flex items-center gap-3">
                <Award className="w-8 h-8 text-teal-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-teal-400">Parabéns! Curso Concluído!</p>
                  <p className="text-[10px] text-gray-300 mt-0.5 leading-normal">Você domina todo o conteúdo deste curso com maestria.</p>
                </div>
              </div>
              <button
                onClick={handleDownloadCertificate}
                className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-xs font-bold py-2.5 rounded-xl transition-colors mt-1 active:scale-[0.98]"
              >
                <Download className="w-4 h-4" />
                Baixar Certificado
              </button>
              {!justCompleted && (
                <button
                  onClick={handleComplete}
                  className="w-full flex items-center justify-center gap-2 bg-[#1E2E44] hover:bg-[#2A3E59] text-white text-xs font-bold py-2.5 rounded-xl transition-colors mt-2 active:scale-[0.98]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Concluir o Curso
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

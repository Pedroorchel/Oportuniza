import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, MapPin, Building, GraduationCap, Compass, Briefcase, HelpCircle, Phone, ArrowRight, MessageSquare, Sparkles, Loader, ArrowLeft } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChatMessage, User, Job } from '../types';
import { MAP_PARTNERS, mockJobs } from '../data';
import { createSupportTicket } from '../lib/supportService';

// Custom high-contrast marker icon
const createCustomIcon = (isSelected: boolean, isJob: boolean = false) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative flex items-center justify-center">
        <div class="absolute w-8 h-8 rounded-full ${isSelected ? 'bg-[#6C63FF]/30 animate-ping' : isJob ? 'bg-emerald-400/20' : 'bg-blue-400/20'}"></div>
        <div class="w-6 h-6 rounded-full ${isSelected ? 'bg-[#6C63FF]' : isJob ? 'bg-emerald-500' : 'bg-blue-500'} border-2 border-white shadow-lg flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            ${isJob ? 
              '<path d="M12 12h.01"></path><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path><path d="M22 13a18.15 18.15 0 0 1-20 0"></path><rect width="20" height="14" x="2" y="6" rx="2"></rect>' :
              '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle>'
            }
          </svg>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

interface MapUpdaterProps {
  center: [number, number];
  zoom: number;
}

function MapUpdater({ center, zoom }: MapUpdaterProps) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

interface CareerMapAndMessagesProps {
  user: User;
  tabType: 'map' | 'mentor' | 'support';
  focusedJob?: Job;
  onBack: () => void;
  onViewJob?: (job: Job) => void;
}

export default function CareerMapAndMessages({
  user,
  tabType,
  focusedJob,
  onBack,
  onViewJob,
}: CareerMapAndMessagesProps) {
  // Chat States
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages from localStorage when user.email or tabType changes to keep it account-dependent
  useEffect(() => {
    if (tabType === 'mentor' || tabType === 'support') {
      const key = `oportuniza-chat-${tabType}-${user.email || 'anon'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
            return; // Successfully loaded, skip creating default
          }
        } catch (e) {
          console.error("Error loading chat history:", e);
        }
      }

      // Fallback: If no history saved for this account, initialize defaults
      if (tabType === 'mentor') {
        const welcome: ChatMessage[] = [
          {
            id: 'welcome-mentor',
            role: 'model',
            content: `Olá, ${user.name}! Sou o **Mentor IA de Carreira** do Oportuniza. 🚀
      
Estou conectado com os modelos inteligentes Gemini da Google e posso te apoiar com:
* Ajustar seu currículo (fazer um CV de alto nível!)
* Simular respostas para perguntas difíceis de recrutadores
* Recomendar áreas e cursos com maior empregabilidade
      
O que gostaria de planejar hoje? Escreva sua dúvida abaixo!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ];
        setMessages(welcome);
        localStorage.setItem(key, JSON.stringify(welcome));
      } else if (tabType === 'support') {
        const welcome: ChatMessage[] = [
          {
            id: 'welcome-support',
            role: 'model',
            content: `Olá! Canal de **Suporte Geral Oportuniza** aberto. 🛠️
          
Dúvidas sobre como usar a plataforma, reportar erros ou enviar sugestões? Digite abaixo:`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        ];
        setMessages(welcome);
        localStorage.setItem(key, JSON.stringify(welcome));
      }
    }
  }, [tabType, user.email, user.name]);

  // Save messages to localStorage whenever they are updated
  useEffect(() => {
    if ((tabType === 'mentor' || tabType === 'support') && messages.length > 0) {
      const key = `oportuniza-chat-${tabType}-${user.email || 'anon'}`;
      localStorage.setItem(key, JSON.stringify(messages));
    }
  }, [messages, tabType, user.email]);

  // Map States
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    if (focusedJob) {
      setSelectedJob(focusedJob);
      setSelectedPartner(null);
    }
  }, [focusedJob]);

  // Auto-scroll inside chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    const inputContent = chatInput.trim();
    setChatInput('');
    setIsTyping(true);

    if (tabType === 'support') {
      try {
        await createSupportTicket({
          user_id: user.id,
          user_name: user.name || user.email,
          user_email: user.email,
          user_phone: user.phone,
          user_role: user.accountType === 'company' ? 'Empresa' : (user.role || 'Candidato'),
          subject: `Dúvida de ${user.name || user.email}`,
          category: user.accountType === 'company' ? 'Suporte Empresa' : 'Geral',
          initial_message: inputContent
        });

        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: `support-reply-${Date.now()}`,
              role: 'model',
              content: `Sua mensagem foi enviada com sucesso para a **Central de Atendimento Oportuniza (🎧 Nível 2)**! Um de nossos atendentes municipais de Araucária foi notificado e te responderá em breve.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
          ]);
          setIsTyping(false);
        }, 800);
      } catch (err) {
        setIsTyping(false);
      }
      return;
    }

    try {
      // Gather relevant host context in chat
      const chatHistory = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Call our secure backend endpoint
      const response = await fetch('/api/mentor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatHistory,
        }),
      });

      const data = await response.json();
      
      const replyMsg: ChatMessage = {
        id: `mentor-${Date.now()}`,
        role: 'model',
        content: data.text || 'Desculpe, não consegui raciocinar. Poderia enviar novamente?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, replyMsg]);
    } catch (err: any) {
      if (err.message && (err.message === 'Failed to fetch' || err.message.includes('fetch'))) {
        console.warn('Career mentor connection failed');
      } else {
        console.error('Error fetching career mentor:', err);
      }
      // Fallback offline message support
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'model',
            content: `Oi, estou com pequenas interrupções no acesso aos dados agora, mas gostaria de adiantar: preencha seu perfil corporativo no Oportuniza! Quais habilidades (como Word, Excel ou HTML) você já domina?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }, 1000);
    } finally {
      setIsTyping(false);
    }
  };

  const mapCenter: [number, number] = useMemo(() => {
    if (selectedJob && selectedJob.lat && selectedJob.lng) return [selectedJob.lat, selectedJob.lng];
    if (selectedPartner) return [selectedPartner.lat, selectedPartner.lng];
    return [-25.50, -49.32];
  }, [selectedPartner, selectedJob]);

  const renderMap = () => {
    return (
      <div className="w-full h-full relative z-0">
        <MapContainer
          center={mapCenter}
          zoom={11}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapUpdater center={mapCenter} zoom={selectedPartner || selectedJob ? 15 : 11} />
          {MAP_PARTNERS.map((partner) => (
            <Marker
              key={partner.id}
              position={[partner.lat, partner.lng]}
              icon={createCustomIcon(selectedPartner?.id === partner.id, false)}
              eventHandlers={{
                click: () => {
                  setSelectedPartner(partner);
                  setSelectedJob(null);
                },
              }}
            >
              <Popup>
                <div className="p-1 font-sans">
                  <h3 className="font-bold text-base">{partner.name}</h3>
                  <p className="text-xs text-gray-500 m-0">{partner.address}</p>
                </div>
              </Popup>
            </Marker>
          ))}
          {/* Job Vacancy Markers */}
          {mockJobs.filter(j => j.lat && j.lng).map((job) => (
            <Marker
                key={job.id}
                position={[job.lat!, job.lng!]}
                icon={createCustomIcon(selectedJob?.id === job.id, true)}
                eventHandlers={{
                    click: () => {
                        setSelectedJob(job);
                        setSelectedPartner(null);
                    },
                }}
            >
                <Popup>
                    <div className="p-1 font-sans">
                        <h3 className="font-bold text-base">{job.title}</h3>
                        <p className="text-xs text-emerald-600 font-bold m-0">{job.company}</p>
                        <p className="text-xs text-gray-500 m-0">{job.location}</p>
                    </div>
                </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Floating map controls */}
        <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2">
          <div className="bg-white/90 backdrop-blur shadow-sm rounded-lg px-2 py-1 border border-gray-100">
             <div className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Vista Satélite</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#F9FAFB] absolute inset-0">
      {/* Header bar */}
      <header className="px-5 pt-6 pb-4 bg-white border-b border-gray-100 flex items-center justify-between shadow-sm shrink-0 gap-2 font-sans sticky top-0 z-10">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={onBack}
            className="p-1 px-1.5 rounded-lg hover:bg-gray-100 active:scale-95 transition-transform text-gray-600 hover:text-gray-900 cursor-pointer shrink-0"
            aria-label="Voltar para o início"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-base font-bold text-gray-900 font-sans tracking-tight truncate">
            {tabType === 'mentor' ? 'Mentor IA Carreira' : tabType === 'support' ? 'Suporte Geral' : 'Mapa de Ajuda'}
          </h1>
        </div>
        {tabType === 'mentor' ? (
          <span className="text-sm font-bold text-brand-purple bg-brand-purple/10 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-brand-purple animate-pulse" />
            Mentor Inteligente
          </span>
        ) : tabType === 'support' ? (
           <span className="text-sm font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
            Suporte Online
          </span>
        ) : (
          <span className="text-sm font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-primary" />
            Postos de Apoio
          </span>
        )}
      </header>

      {/* Main Container based on view context */}
      <div className="flex-1 flex flex-col min-h-0 bg-gray-50/50">
        {(tabType === 'mentor' || tabType === 'support') && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Chat message box display viewport */}
            <div className="flex-1 overflow-y-auto custom-scroll p-4 flex flex-col gap-3.5 min-h-0">
              {messages
                .map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] ${
                        isUser ? 'self-end items-end' : 'self-start items-start'
                      } animate-fadeIn`}
                    >
                      {/* Avatar name badge */}
                      <div className={`flex items-center gap-1.5 mb-1 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                        {isUser ? (
                          user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt="Você"
                              className="w-4 h-4 rounded-full object-cover border border-[#6C63FF]/30"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[12px] font-bold font-sans">
                              {user.name.substring(0, 1).toUpperCase()}
                            </div>
                          )
                        ) : (
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[12px] font-bold text-white font-sans ${tabType === 'mentor' ? 'bg-[#6C63FF]' : 'bg-emerald-500'}`}>
                            {tabType === 'mentor' ? 'M' : 'S'}
                          </div>
                        )}
                        <span className="text-xs font-bold text-gray-400 font-sans tracking-wide uppercase">
                          {isUser ? user.name : tabType === 'mentor' ? 'IA Mentor' : 'Suporte Oportuniza'}
                        </span>
                      </div>

                      {/* Content Bubble */}
                      <div
                        className={`p-3.5 rounded-2xl text-[16px] leading-relaxed shadow-sm whitespace-pre-line border ${
                          isUser
                            ? 'bg-primary text-white border-primary-dark/10 rounded-br-none'
                            : tabType === 'mentor'
                            ? 'bg-white text-gray-800 border-purple-100 rounded-bl-none'
                            : 'bg-white text-gray-800 border-gray-100 rounded-bl-none'
                        }`}
                      >
                        {msg.content}
                      </div>

                      {/* Timestamp labels */}
                      <span className="text-[14px] text-gray-400 mt-0.5 px-1">{msg.timestamp}</span>
                    </div>
                  );
                })}

              {isTyping && (
                <div className="flex flex-col items-start max-w-[85%] self-start animate-pulse">
                  <span className="text-xs font-bold text-gray-400 font-mono tracking-wide uppercase mb-1">
                    Mentor inteligente está pensando...
                  </span>
                  <div className="bg-white p-3.5 rounded-2xl border border-gray-100 rounded-bl-none flex items-center gap-2">
                    <Loader className="w-4 h-4 text-brand-purple animate-spin" />
                    <span className="text-sm text-gray-400 font-medium">Analisando dicas de currículo</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Sticky Chat input box */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-100 flex items-center gap-2.5 shrink-0 select-none">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={tabType === 'mentor' ? "Como destacar que tenho Excel Básico?" : "Minha dúvida..."}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-[16px] focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
              <button
                type="submit"
                className="bg-primary text-white p-2.5 rounded-xl hover:bg-primary-dark cursor-pointer transition-colors shrink-0 shadow-md"
                aria-label="Enviar mensagem"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* HELPMAP TAB SCREEN */}
        {tabType === 'map' && (
          <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto custom-scroll min-h-0">
            {/* Guide introduction */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-1.5 shrink-0">
              <h3 className="text-base font-bold text-gray-800 uppercase tracking-wide">Passe no parceiro mais próximo</h3>
              <p className="text-sm text-gray-500 leading-normal">
                Nossos postos físicos oferecem laboratórios de computadores de graça de uso público, impressão de currículos sem custo e inscrições em programas governamentais locais de estágio.
              </p>
            </div>

            {/* FUNCTIONAL LEAFLET MAP */}
            <div className="w-full h-80 bg-slate-100 border border-gray-200 rounded-2xl relative overflow-hidden shrink-0 shadow-sm flex-none z-0">
               {renderMap()}
               
               {!selectedPartner && (
                 <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-sm text-white font-bold flex items-center gap-2 z-[401]">
                   <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                   <span>Explore os postos em Curitiba e Araucária</span>
                 </div>
               )}
            </div>

            {/* Selected Partner/Job Details block */}
            {(selectedPartner || selectedJob) ? (
              <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-md flex flex-col gap-4 animate-scaleUp shrink-0">
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`text-sm uppercase font-bold tracking-wider ${selectedJob ? 'text-emerald-600 bg-emerald-50' : 'text-[#6C63FF] bg-[#6C63FF]/10'} px-2 py-0.5 rounded-md`}>
                      {selectedJob ? 'Vaga em Destaque' : (selectedPartner.type || 'Parceiro')}
                    </span>
                    <h4 className="text-base font-bold text-gray-800 mt-1.5 font-sans">{selectedJob ? selectedJob.title : selectedPartner.name}</h4>
                    <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-300" />
                      {selectedJob ? selectedJob.location : selectedPartner.address}
                    </p>
                  </div>
                  {selectedJob && (
                    <div className="w-9 h-9 rounded-lg overflow-hidden border border-gray-100 flex items-center justify-center p-1 bg-white">
                      <img src={selectedJob.logo} alt="" className="w-full h-full object-contain" />
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">{selectedJob ? 'Empresa parceira:' : 'Oportunidades associadas lá:'}</span>
                  <strong className={`${selectedJob ? 'text-emerald-700' : 'text-primary'} font-bold`}>{selectedJob ? selectedJob.company : `${selectedPartner.jobsCount} vagas de estágio`}</strong>
                </div>

                {/* Routing Actions */}
                <div className="flex flex-col gap-2.5">
                  {selectedJob && onViewJob && (
                    <button
                      onClick={() => onViewJob(selectedJob)}
                      className="w-full bg-[#52A8C7] hover:bg-[#3d8ba8] text-white py-3 text-sm uppercase tracking-wider font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <Briefcase className="w-4 h-4" />
                      Ver a vaga
                    </button>
                  )}

                  <div className="flex gap-2.5">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selectedJob ? selectedJob.lat : selectedPartner.lat},${selectedJob ? selectedJob.lng : selectedPartner.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-primary text-white py-3 text-sm uppercase tracking-wider font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary-dark transition-all shadow-lg shadow-primary/20"
                    >
                      <Compass className="w-4 h-4" />
                      Abrir no GPS
                    </a>

                    <button
                      onClick={() => {
                        setSelectedPartner(null);
                        setSelectedJob(null);
                      }}
                      className="bg-gray-50 text-gray-500 py-3 px-6 text-sm uppercase font-bold rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 text-center flex flex-col items-center gap-3 shrink-0">
                    <div className="w-10 h-10 bg-slate-50 flex items-center justify-center rounded-full">
                        <Compass className="w-5 h-5 text-gray-300" />
                    </div>
                    <div>
                        <p className="text-base font-bold text-gray-800">Nenhum ponto selecionado</p>
                        <p className="text-sm text-gray-400 mt-1 leading-relaxed px-4">Utilize o mapa acima para localizar postos de apoio físico ou vagas de emprego em sua região.</p>
                    </div>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

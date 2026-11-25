import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, MapPin, Building, GraduationCap, Compass, Briefcase, HelpCircle, Phone, ArrowRight, MessageSquare, Sparkles, Loader, ArrowLeft, Search, Layers, Globe, Navigation, X } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChatMessage, User, Job } from '../types';
import { MAP_PARTNERS, mockJobs, loadJobsFromSupabase } from '../data';
import { createSupportTicket, fetchAllSupportTickets, fetchTicketMessages } from '../lib/supportService';
import { buildApiEndpoint } from '../lib/emailVerificationService';
import { toast } from '../lib/toast';
import { isImageAssetUrl, resolveAssetUrl } from '../lib/assets';
import { resolveJobCoordinates } from '../lib/araucariaLocations';

type MarkerKind = 'partner' | 'onsite' | 'remote';
type MapFilter = 'all' | 'araucaria' | 'curitiba' | 'remote' | 'partners';
type RegionPreset = 'araucaria' | 'curitiba' | 'overview';

const REGION_PRESETS: Record<RegionPreset, { center: [number, number]; zoom: number; label: string }> = {
  araucaria: { center: [-25.5859, -49.4047], zoom: 13, label: 'Araucária' },
  curitiba: { center: [-25.4420, -49.2760], zoom: 12, label: 'Curitiba' },
  overview: { center: [-25.5150, -49.3450], zoom: 11, label: 'Visão Geral' },
};

// Custom high-contrast marker icon
const createCustomIcon = (isSelected: boolean, kind: MarkerKind = 'partner') => {
  const ringColor = isSelected
    ? 'bg-[#6C63FF]/35 animate-ping'
    : kind === 'onsite'
    ? 'bg-emerald-400/25'
    : kind === 'remote'
    ? 'bg-indigo-400/25'
    : 'bg-blue-400/25';

  const bgColor = isSelected
    ? 'bg-[#6C63FF]'
    : kind === 'onsite'
    ? 'bg-emerald-500'
    : kind === 'remote'
    ? 'bg-indigo-500'
    : 'bg-blue-500';

  const iconSvg =
    kind === 'partner'
      ? '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle>'
      : kind === 'remote'
      ? '<circle cx="12" cy="12" r="9"></circle><path d="M3.6 9h16.8"></path><path d="M3.6 15h16.8"></path><path d="M11.5 3a17 17 0 0 0 0 18"></path><path d="M12.5 3a17 17 0 0 1 0 18"></path>'
      : '<path d="M12 12h.01"></path><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path><path d="M22 13a18.15 18.15 0 0 1-20 0"></path><rect width="20" height="14" x="2" y="6" rx="2"></rect>';

  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative flex items-center justify-center">
        <div class="absolute w-8 h-8 rounded-full ${ringColor}"></div>
        <div class="w-6 h-6 rounded-full ${bgColor} border-2 border-white shadow-lg flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            ${iconSvg}
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
    map.setView(center, zoom, { animate: true });
  }, [center[0], center[1], zoom, map]);
  return null;
}

function normalizeJobWithCoords(job: Job): Job {
  const coords = resolveJobCoordinates(job);
  if (job.lat === coords.lat && job.lng === coords.lng) {
    return job;
  }
  return {
    ...job,
    lat: coords.lat,
    lng: coords.lng,
  };
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
  const [liveJobs, setLiveJobs] = useState<Job[]>(() => mockJobs.map(normalizeJobWithCoords));
  const [mapFilter, setMapFilter] = useState<MapFilter>('all');
  const [mapSearch, setMapSearch] = useState('');
  const [mapLayerMode, setMapLayerMode] = useState<'street' | 'satellite'>('street');
  const [regionPreset, setRegionPreset] = useState<RegionPreset>('araucaria');

  useEffect(() => {
    const syncJobs = () => setLiveJobs(mockJobs.map(normalizeJobWithCoords));
    window.addEventListener('oportuniza-jobs-changed', syncJobs);
    if (tabType === 'map') {
      loadJobsFromSupabase().then(syncJobs).catch(() => {});
    }
    return () => window.removeEventListener('oportuniza-jobs-changed', syncJobs);
  }, [tabType]);

  // Sync replies sent by Municipal Support Staff in AtendimentoPanelScreen
  useEffect(() => {
    if (tabType !== 'support' || !user.email) return;

    const syncAgentReplies = async () => {
      try {
        const allTickets = await fetchAllSupportTickets();
        const userEmailLower = user.email.trim().toLowerCase();
        const myTickets = allTickets.filter(
          (t) =>
            (t.user_id && user.id && t.user_id === user.id) ||
            (t.user_email && t.user_email.trim().toLowerCase() === userEmailLower)
        );
        if (myTickets.length === 0) return;

        const fetchedMsgs = (
          await Promise.all(myTickets.slice(0, 5).map((t) => fetchTicketMessages(t.id)))
        ).flat();

        const agentReplies = fetchedMsgs
          .filter((m) => m.sender_type === 'agent' && !m.content.includes('[NOTA INTERNA'))
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        if (agentReplies.length === 0) return;

        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const additions: ChatMessage[] = [];
          for (const rep of agentReplies) {
            const msgId = `ticket-msg-${rep.id}`;
            if (!existingIds.has(msgId)) {
              additions.push({
                id: msgId,
                role: 'model',
                content: `${rep.sender_name || 'Atendimento Oportuniza'}: ${rep.content}`,
                timestamp: new Date(rep.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              });
            }
          }
          return additions.length > 0 ? [...prev, ...additions] : prev;
        });
      } catch {
        // Silent background sync fallback
      }
    };

    syncAgentReplies();
    window.addEventListener('oportuniza-support-tickets-updated', syncAgentReplies);
    return () => window.removeEventListener('oportuniza-support-tickets-updated', syncAgentReplies);
  }, [tabType, user.email, user.id]);

  useEffect(() => {
    if (focusedJob) {
      const normalized = normalizeJobWithCoords(focusedJob);
      setSelectedJob(normalized);
      setSelectedPartner(null);
      setMapFilter('all');
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
      } catch (err: any) {
        console.error('Erro ao enviar chamado de suporte:', err);
        toast.error('Não foi possível registrar seu chamado agora. Verifique sua conexão e tente novamente.');
        setMessages((prev) => [
          ...prev,
          {
            id: `support-err-${Date.now()}`,
            role: 'model',
            content: 'Não consegui enviar sua mensagem para a Central neste instante. Verifique sua conexão e tente enviar novamente.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        ]);
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
      const response = await fetch(buildApiEndpoint('/api/mentor'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`Mentor endpoint unavailable (${response.status})`);
      }

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

  const normalizedSearch = mapSearch.trim().toLowerCase();

  const filteredPartners = useMemo(() => {
    return MAP_PARTNERS.filter((partner) => {
      if (mapFilter === 'remote') return false;
      if (mapFilter === 'araucaria' && !partner.address.toLowerCase().includes('araucária')) return false;
      if (mapFilter === 'curitiba' && !partner.address.toLowerCase().includes('curitiba')) return false;
      if (normalizedSearch) {
        const hay = `${partner.name} ${partner.address} ${partner.type}`.toLowerCase();
        if (!hay.includes(normalizedSearch)) return false;
      }
      return true;
    });
  }, [mapFilter, normalizedSearch]);

  const filteredJobs = useMemo(() => {
    if (mapFilter === 'partners') return [];
    const baseJobs = liveJobs.map(normalizeJobWithCoords);
    return baseJobs.filter((job) => {
      const locLower = `${job.location || ''} ${job.companyNeighborhood || ''} ${job.companyAddress || ''}`.toLowerCase();
      if (mapFilter === 'araucaria' && !locLower.includes('araucária') && !locLower.includes('araucaria')) return false;
      if (mapFilter === 'curitiba' && !locLower.includes('curitiba')) return false;
      if (mapFilter === 'remote' && !job.isRemote && !locLower.includes('remoto')) return false;
      if (normalizedSearch) {
        const hay = `${job.title} ${job.company} ${job.location} ${job.companyNeighborhood || ''} ${job.category || ''}`.toLowerCase();
        if (!hay.includes(normalizedSearch)) return false;
      }
      return true;
    });
  }, [liveJobs, mapFilter, normalizedSearch]);

  const activeJobCoords = useMemo(() => {
    if (!selectedJob) return null;
    return resolveJobCoordinates(selectedJob);
  }, [selectedJob]);

  const mapCenter: [number, number] = useMemo(() => {
    if (activeJobCoords) return [activeJobCoords.lat, activeJobCoords.lng];
    if (selectedPartner) return [selectedPartner.lat, selectedPartner.lng];
    return REGION_PRESETS[regionPreset].center;
  }, [selectedPartner, activeJobCoords, regionPreset]);

  const mapZoom = useMemo(() => {
    if (activeJobCoords || selectedPartner) return 15;
    return REGION_PRESETS[regionPreset].zoom;
  }, [activeJobCoords, selectedPartner, regionPreset]);

  const handleSelectRegion = (preset: RegionPreset) => {
    setSelectedJob(null);
    setSelectedPartner(null);
    setRegionPreset(preset);
    if (preset === 'araucaria') setMapFilter('araucaria');
    else if (preset === 'curitiba') setMapFilter('curitiba');
    else setMapFilter('all');
  };

  const renderMap = () => {
    return (
      <div className="w-full h-full relative z-0">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
          scrollWheelZoom={true}
        >
          {mapLayerMode === 'satellite' ? (
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          ) : (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          )}
          <MapUpdater center={mapCenter} zoom={mapZoom} />

          {filteredPartners.map((partner) => (
            <Marker
              key={partner.id}
              position={[partner.lat, partner.lng]}
              icon={createCustomIcon(selectedPartner?.id === partner.id, 'partner')}
              eventHandlers={{
                click: () => {
                  setSelectedPartner(partner);
                  setSelectedJob(null);
                },
              }}
            >
              <Popup>
                <div className="p-1 font-sans">
                  <span className="text-[10px] font-bold uppercase text-blue-600">{partner.type}</span>
                  <h3 className="font-bold text-sm text-gray-900">{partner.name}</h3>
                  <p className="text-xs text-gray-500 m-0">{partner.address}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Job Vacancy Markers */}
          {filteredJobs.map((job) => {
            const coords = resolveJobCoordinates(job);
            const markerKind: MarkerKind = job.isRemote ? 'remote' : 'onsite';
            return (
              <Marker
                key={job.id}
                position={[coords.lat, coords.lng]}
                icon={createCustomIcon(selectedJob?.id === job.id, markerKind)}
                eventHandlers={{
                  click: () => {
                    setSelectedJob({ ...job, lat: coords.lat, lng: coords.lng });
                    setSelectedPartner(null);
                  },
                }}
              >
                <Popup>
                  <div className="p-1 font-sans">
                    <h3 className="font-bold text-sm text-gray-900">{job.title}</h3>
                    <p className="text-xs text-emerald-600 font-bold m-0">{job.company}</p>
                    <p className="text-xs text-gray-500 m-0">{job.location}</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Floating map controls */}
        <div className="absolute top-3 right-3 z-[400] flex items-center gap-1.5">
          <div className="bg-white/95 backdrop-blur shadow-md rounded-xl p-1 border border-gray-200 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMapLayerMode('street')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                mapLayerMode === 'street' ? 'bg-primary text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Mapa
            </button>
            <button
              type="button"
              onClick={() => setMapLayerMode('satellite')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer ${
                mapLayerMode === 'satellite' ? 'bg-primary text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Layers className="w-3 h-3" />
              Satélite
            </button>
          </div>
          {(selectedJob || selectedPartner) && (
            <button
              type="button"
              onClick={() => {
                setSelectedJob(null);
                setSelectedPartner(null);
              }}
              className="bg-white/95 backdrop-blur shadow-md rounded-xl px-2.5 py-1.5 border border-gray-200 text-[10px] font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer flex items-center gap-1"
              title="Voltar para visão da cidade"
            >
              <Navigation className="w-3 h-3 text-primary" />
              Centralizar
            </button>
          )}
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
                    {tabType === 'support' ? 'Conectando com a Central...' : 'Mentor inteligente está pensando...'}
                  </span>
                  <div className="bg-white p-3.5 rounded-2xl border border-gray-100 rounded-bl-none flex items-center gap-2">
                    <Loader className="w-4 h-4 text-brand-purple animate-spin" />
                    <span className="text-sm text-gray-400 font-medium">
                      {tabType === 'support' ? 'Registrando atendimento' : 'Analisando dicas de currículo'}
                    </span>
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
          <div className="flex-1 flex flex-col p-4 gap-3.5 overflow-y-auto custom-scroll min-h-0">
            {/* Guide introduction & Region Quick Jump */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-2.5 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Mapa de Vagas e Postos de Apoio</h3>
                <div className="flex items-center gap-1.5">
                  {(['araucaria', 'curitiba', 'overview'] as RegionPreset[]).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSelectRegion(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        regionPreset === preset && !selectedJob && !selectedPartner
                          ? 'bg-primary text-white shadow-xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {REGION_PRESETS[preset].label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Explore vagas presenciais e remotas por bairro em Araucária e Curitiba, além de postos físicos com computadores gratuitos e impressão de currículo.
              </p>

              {/* Search & Type Filter */}
              <div className="flex flex-col gap-2 pt-1">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={mapSearch}
                    onChange={(e) => setMapSearch(e.target.value)}
                    placeholder="Buscar por vaga, empresa, bairro ou posto..."
                    className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  {mapSearch && (
                    <button
                      type="button"
                      onClick={() => setMapSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      aria-label="Limpar busca"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {([
                    { id: 'all', label: `Todos (${liveJobs.length + MAP_PARTNERS.length})` },
                    { id: 'araucaria', label: 'Araucária' },
                    { id: 'curitiba', label: 'Curitiba' },
                    { id: 'remote', label: 'Remoto / Híbrido' },
                    { id: 'partners', label: `Postos (${MAP_PARTNERS.length})` },
                  ] as { id: MapFilter; label: string }[]).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setMapFilter(f.id);
                        if (f.id === 'araucaria') setRegionPreset('araucaria');
                        else if (f.id === 'curitiba') setRegionPreset('curitiba');
                        else if (f.id === 'all' || f.id === 'remote') setRegionPreset('overview');
                      }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                        mapFilter === f.id
                          ? 'bg-primary/10 text-primary border-primary/30'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* FUNCTIONAL LEAFLET MAP */}
            <div className="w-full h-80 sm:h-96 bg-slate-100 border border-gray-200 rounded-2xl relative overflow-hidden shrink-0 shadow-sm flex-none z-0">
              {renderMap()}

              {!selectedPartner && !selectedJob && (
                <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-black/65 backdrop-blur-md px-3 py-1.5 rounded-full text-xs text-white font-bold flex items-center gap-2 z-[401] whitespace-nowrap pointer-events-none">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <span>{filteredJobs.length} vagas e {filteredPartners.length} postos no mapa</span>
                </div>
              )}
            </div>

            {/* Map Pin Legend */}
            <div className="bg-white px-3.5 py-2.5 rounded-xl border border-gray-100 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-gray-600 shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Vaga Presencial
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" /> Remoto / Híbrido
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Posto de Apoio
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#6C63FF] inline-block" /> Selecionado
              </span>
            </div>

            {/* Selected Partner/Job Details block */}
            {(selectedPartner || selectedJob) ? (
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-md flex flex-col gap-3.5 animate-scaleUp shrink-0">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <span className={`text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md inline-block ${
                      selectedJob
                        ? selectedJob.isRemote
                          ? 'text-indigo-600 bg-indigo-50'
                          : 'text-emerald-600 bg-emerald-50'
                        : 'text-[#6C63FF] bg-[#6C63FF]/10'
                    }`}>
                      {selectedJob
                        ? selectedJob.isRemote
                          ? 'Vaga Remota / Híbrida'
                          : 'Vaga Presencial'
                        : (selectedPartner.type || 'Posto de Apoio')}
                    </span>
                    <h4 className="text-base font-bold text-gray-800 mt-1.5 font-sans leading-snug">
                      {selectedJob ? selectedJob.title : selectedPartner.name}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                      <span>
                        {selectedJob
                          ? `${selectedJob.location}${selectedJob.companyAddress ? ` • ${selectedJob.companyAddress}` : ''}`
                          : selectedPartner.address}
                      </span>
                    </p>
                  </div>
                  {selectedJob && (
                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-gray-100 flex items-center justify-center p-1 bg-slate-50 shrink-0">
                      {isImageAssetUrl(selectedJob.logo) ? (
                        <img src={resolveAssetUrl(selectedJob.logo)} alt={selectedJob.company} className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <Briefcase className="w-5 h-5 text-emerald-600" />
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl flex justify-between items-center text-xs gap-2">
                  <span className="text-gray-500 font-medium">
                    {selectedJob ? 'Empresa / Bolsa:' : 'Oportunidades associadas:'}
                  </span>
                  <strong className={`${selectedJob ? 'text-emerald-700' : 'text-primary'} font-bold text-right`}>
                    {selectedJob
                      ? `${selectedJob.company} • ${selectedJob.salary}`
                      : `${selectedPartner.jobsCount} vagas de estágio`}
                  </strong>
                </div>

                {/* Routing Actions */}
                <div className="flex flex-col gap-2">
                  {selectedJob && onViewJob && (
                    <button
                      type="button"
                      onClick={() => onViewJob(selectedJob)}
                      className="w-full bg-[#52A8C7] hover:bg-[#3d8ba8] text-white py-2.5 text-xs uppercase tracking-wider font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <Briefcase className="w-4 h-4" />
                      Ver detalhes da vaga
                    </button>
                  )}

                  <div className="flex gap-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${
                        selectedJob && activeJobCoords
                          ? `${activeJobCoords.lat},${activeJobCoords.lng}`
                          : `${selectedPartner.lat},${selectedPartner.lng}`
                      }`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-primary text-white py-2.5 text-xs uppercase tracking-wider font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary-dark transition-all shadow-md shadow-primary/20"
                    >
                      <Compass className="w-4 h-4" />
                      Abrir no GPS
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPartner(null);
                        setSelectedJob(null);
                      }}
                      className="bg-gray-50 text-gray-600 py-2.5 px-5 text-xs uppercase font-bold rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-4 rounded-2xl border border-gray-100 text-center flex items-center gap-3 shrink-0">
                <div className="w-9 h-9 bg-slate-50 flex items-center justify-center rounded-full shrink-0">
                  <Compass className="w-4 h-4 text-primary" />
                </div>
                <p className="text-xs text-gray-500 text-left leading-relaxed">
                  Toque em um pino no mapa ou selecione uma opção na lista abaixo para ver o endereço exato e traçar rota no GPS.
                </p>
              </div>
            )}

            {/* Quick Clickable Directory of Filtered Points */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  Pontos no Mapa ({filteredJobs.length + filteredPartners.length})
                </h4>
                <span className="text-[11px] text-gray-400">Clique para focar</span>
              </div>

              {filteredPartners.length === 0 && filteredJobs.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">
                  Nenhum ponto encontrado para esse filtro ou busca.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
                  {filteredPartners.map((partner) => (
                    <button
                      key={partner.id}
                      type="button"
                      onClick={() => {
                        setSelectedPartner(partner);
                        setSelectedJob(null);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        selectedPartner?.id === partner.id
                          ? 'bg-blue-50/70 border-blue-300'
                          : 'bg-gray-50/70 border-gray-100 hover:bg-gray-100/80'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{partner.name}</p>
                        <p className="text-[11px] text-gray-500 truncate">{partner.address}</p>
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-100/70 px-2 py-0.5 rounded-md shrink-0">
                        Posto
                      </span>
                    </button>
                  ))}

                  {filteredJobs.map((job) => {
                    const coords = resolveJobCoordinates(job);
                    return (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => {
                          setSelectedJob({ ...job, lat: coords.lat, lng: coords.lng });
                          setSelectedPartner(null);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          selectedJob?.id === job.id
                            ? 'bg-emerald-50/80 border-emerald-300'
                            : 'bg-gray-50/70 border-gray-100 hover:bg-gray-100/80'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{job.title}</p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {job.company} • {job.location}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 ${
                          job.isRemote
                            ? 'text-indigo-600 bg-indigo-100/70'
                            : 'text-emerald-700 bg-emerald-100/70'
                        }`}>
                          {job.isRemote ? <Globe className="w-2.5 h-2.5" /> : <MapPin className="w-2.5 h-2.5" />}
                          {job.isRemote ? 'Remoto' : 'Vaga'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

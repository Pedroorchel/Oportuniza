import React, { useState, useEffect, useRef } from 'react';
import { 
  Headphones, Search, Filter, MessageSquare, CheckCircle, Clock, 
  AlertCircle, Phone, Mail, User as UserIcon, Building2, Send, 
  RefreshCw, LogOut, CheckCircle2, Shield, Sparkles, ChevronRight, 
  ArrowLeft, Plus, ExternalLink, Archive, AlertTriangle, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { 
  SupportTicket, 
  SupportTicketMessage, 
  fetchAllSupportTickets, 
  fetchTicketMessages, 
  sendSupportTicketMessage, 
  updateSupportTicketStatus, 
  createSupportTicket 
} from '../lib/supportService';
import { supabase } from '../lib/supabaseClient';
import { resolveUserHierarchyTier } from '../lib/hierarchyRoles';

interface AtendimentoPanelScreenProps {
  user: User;
  onLogout: () => void;
  onNavigateHome?: () => void;
}

export default function AtendimentoPanelScreen({ user, onLogout, onNavigateHome }: AtendimentoPanelScreenProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages] = useState<SupportTicketMessage[]>([]);
  const [replyInput, setReplyInput] = useState('');
  const [autoResolveOnReply, setAutoResolveOnReply] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [roleFilter, setRoleFilter] = useState<string>('Todos');

  // Loading & Action states
  const [loading, setLoading] = useState(true);
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // New Manual Ticket Modal
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [newTicketForm, setNewTicketForm] = useState({
    user_name: '',
    user_email: '',
    user_phone: '',
    user_role: 'Candidato',
    subject: '',
    category: 'Geral' as any,
    initial_message: ''
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const userTier = resolveUserHierarchyTier(user);

  // Load tickets on mount & subscribe to changes
  useEffect(() => {
    loadTicketsData();

    const handleUpdated = () => {
      loadTicketsData();
    };

    window.addEventListener('oportuniza-support-tickets-updated', handleUpdated);

    // Supabase real-time listener for incoming support tickets
    const channel = supabase
      .channel('public:support_tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        loadTicketsData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => {
        loadTicketsData();
      })
      .subscribe();

    return () => {
      window.removeEventListener('oportuniza-support-tickets-updated', handleUpdated);
      supabase.removeChannel(channel);
    };
  }, []);

  const loadTicketsData = async () => {
    try {
      setLoading(true);
      const data = await fetchAllSupportTickets();
      setTickets(data);
      if (data.length > 0 && !selectedTicketId) {
        setSelectedTicketId(data[0].id);
      }
    } catch (err) {
      console.error('Error loading tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load thread messages whenever selected ticket changes
  useEffect(() => {
    if (!selectedTicketId) {
      setTicketMessages([]);
      return;
    }

    const loadMessages = async () => {
      const msgs = await fetchTicketMessages(selectedTicketId);
      setTicketMessages(msgs);
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    };

    loadMessages();
  }, [selectedTicketId]);

  // Selected Ticket object
  const selectedTicket = tickets.find(t => t.id === selectedTicketId) || null;

  // Filtered tickets
  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      t.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.user_phone || '').includes(searchQuery) ||
      (t.last_message || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = 
      statusFilter === 'Todos' ? true :
      statusFilter === 'Pendentes' ? t.status === 'Pendente' :
      statusFilter === 'Em Atendimento' ? t.status === 'Em Atendimento' :
      statusFilter === 'Resolvidos' ? t.status === 'Resolvido' :
      statusFilter === 'Arquivados' ? t.status === 'Arquivado' : true;

    const matchesRole = 
      roleFilter === 'Todos' ? true :
      roleFilter === 'Candidatos' ? (t.user_role === 'Candidato' || t.user_role === 'Estudante') :
      roleFilter === 'Empresas' ? t.user_role === 'Empresa' : true;

    return matchesSearch && matchesStatus && matchesRole;
  });

  // KPI Calculations
  const totalCount = tickets.length;
  const pendingCount = tickets.filter(t => t.status === 'Pendente').length;
  const inProgressCount = tickets.filter(t => t.status === 'Em Atendimento').length;
  const resolvedCount = tickets.filter(t => t.status === 'Resolvido').length;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Handle Send Reply by Operator
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyInput.trim()) return;

    setIsSendingMsg(true);
    try {
      const nextSt = autoResolveOnReply ? 'Resolvido' : 'Em Atendimento';
      await sendSupportTicketMessage({
        ticket_id: selectedTicket.id,
        sender_type: 'agent',
        sender_name: user.name || 'Atendimento Oportuniza',
        sender_email: user.email || 'suporte@oportuniza.araucaria.br',
        content: replyInput.trim(),
        next_status: nextSt
      });

      setReplyInput('');
      showToast(autoResolveOnReply ? 'Resposta enviada e chamado marcado como Resolvido!' : 'Resposta enviada ao munícipe com sucesso!');
      await loadTicketsData();
      
      const updatedMsgs = await fetchTicketMessages(selectedTicket.id);
      setTicketMessages(updatedMsgs);
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      console.error('Error sending reply:', err);
      showToast(`Erro ao enviar resposta: ${err.message || 'Erro de conexão'}`);
    } finally {
      setIsSendingMsg(false);
    }
  };

  // Handle Ticket Status Change
  const handleChangeStatus = async (newSt: 'Pendente' | 'Em Atendimento' | 'Resolvido' | 'Arquivado') => {
    if (!selectedTicket) return;
    setStatusUpdating(true);
    try {
      await updateSupportTicketStatus(selectedTicket.id, newSt, user.name || 'Atendimento Oportuniza');
      showToast(`Status do chamado alterado para "${newSt}".`);
      await loadTicketsData();
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setStatusUpdating(false);
    }
  };

  // Quick Preset Insert
  const handleApplyPreset = (text: string) => {
    setReplyInput(text);
  };

  // Submit New Manual Ticket
  const handleCreateNewTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketForm.user_name || !newTicketForm.subject || !newTicketForm.initial_message) {
      alert('Por favor, preencha o nome do solicitante, o assunto e a mensagem.');
      return;
    }

    try {
      const ticket = await createSupportTicket({
        user_name: newTicketForm.user_name,
        user_email: newTicketForm.user_email || 'atendimento.presencial@araucaria.pr.gov.br',
        user_phone: newTicketForm.user_phone,
        user_role: newTicketForm.user_role,
        subject: newTicketForm.subject,
        category: newTicketForm.category,
        initial_message: newTicketForm.initial_message
      });

      setShowNewTicketModal(false);
      setNewTicketForm({
        user_name: '',
        user_email: '',
        user_phone: '',
        user_role: 'Candidato',
        subject: '',
        category: 'Geral',
        initial_message: ''
      });

      showToast(`Novo atendimento para "${ticket.user_name}" registrado com sucesso!`);
      await loadTicketsData();
      setSelectedTicketId(ticket.id);
    } catch (err: any) {
      alert(`Erro ao criar chamado: ${err.message || 'Erro desconhecido'}`);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* TOP BAR / NAVIGATION HEADER */}
      <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Branding & Role Title */}
          <div className="flex items-center gap-3.5">
            {onNavigateHome && (
              <button 
                onClick={onNavigateHome}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
                title="Voltar ao site"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 shadow-lg shadow-sky-950/40">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-black text-white tracking-tight">Central de Atendimento Oportuniza</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center gap-1">
                  <Headphones className="w-3 h-3" /> 🎧 Nível 2 — Atendimento Oportuniza
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Suporte ao jovem munícipe, moderação de vagas e esclarecimento de dúvidas das empresas em Araucária.
              </p>
            </div>
          </div>

          {/* User info & Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-200">{user.name || 'Operador de Atendimento'}</span>
              <span className="text-[10px] text-sky-400 font-mono">{user.email}</span>
            </div>

            <button
              onClick={() => loadTicketsData()}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
              <span className="hidden md:inline">Atualizar</span>
            </button>

            <button
              onClick={() => setShowNewTicketModal(true)}
              className="px-3.5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Atendimento</span>
            </button>

            <button
              onClick={onLogout}
              className="p-2.5 bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 rounded-xl transition-colors cursor-pointer"
              title="Sair da conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* TOAST NOTIFICATION */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-sky-500 text-slate-950 px-4 py-2.5 rounded-2xl shadow-xl font-bold text-xs flex items-center gap-2 border border-sky-400"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* METRICS KPI SUMMARY ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0">
              <Headphones className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total de Chamados</span>
              <span className="text-2xl font-black text-white">{totalCount}</span>
            </div>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">Pendentes (Aguardando)</span>
              <span className="text-2xl font-black text-amber-400">{pendingCount}</span>
            </div>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 block">Em Atendimento</span>
              <span className="text-2xl font-black text-sky-400">{inProgressCount}</span>
            </div>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">Resolvidos</span>
              <span className="text-2xl font-black text-emerald-400">{resolvedCount}</span>
            </div>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome do jovem, e-mail, telefone, assunto ou mensagem..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-400 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none"
              />
            </div>

            {/* Filter Tabs Status */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll pb-1 md:pb-0">
              {['Todos', 'Pendentes', 'Em Atendimento', 'Resolvidos', 'Arquivados'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    statusFilter === st 
                      ? 'bg-sky-500 text-slate-950 font-black' 
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Filter Role (Candidato vs Empresa) */}
            <div className="flex items-center gap-1.5 shrink-0">
              {['Todos', 'Candidatos', 'Empresas'].map(rl => (
                <button
                  key={rl}
                  onClick={() => setRoleFilter(rl)}
                  className={`px-2.5 py-2 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                    roleFilter === rl 
                      ? 'bg-slate-800 text-sky-400 border border-sky-500/40' 
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {rl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2-COLUMN SPLIT INBOX & CHAT THREAD */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: INBOX TICKETS LIST (5 COLS) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3 max-h-[720px] flex flex-col">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sky-400" />
                Chamados de Munícipes & Empresas ({filteredTickets.length})
              </span>
            </div>

            {filteredTickets.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Headphones className="w-10 h-10 mx-auto opacity-30 text-sky-400" />
                <p className="text-xs font-bold">Nenhum chamado encontrado nesta filtragem.</p>
                <p className="text-[11px] text-slate-500">Altere o termo de busca ou o filtro de status acima.</p>
              </div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto custom-scroll pr-1 flex-1">
                {filteredTickets.map(ticket => {
                  const isSelected = ticket.id === selectedTicketId;
                  const isComp = ticket.user_role === 'Empresa';

                  return (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left space-y-2 ${
                        isSelected 
                          ? 'bg-sky-500/10 border-sky-500/50 shadow-md shadow-sky-950/30 ring-1 ring-sky-500/40' 
                          : 'bg-slate-950/70 border-slate-800/80 hover:bg-slate-950 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isComp ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                          }`}>
                            {isComp ? <Building2 className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate">{ticket.user_name}</h4>
                            <span className="text-[10px] text-slate-400 truncate block font-mono">{ticket.user_email}</span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                          ticket.status === 'Pendente' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          ticket.status === 'Em Atendimento' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' :
                          ticket.status === 'Resolvido' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {ticket.status}
                        </span>
                      </div>

                      {/* Subject */}
                      <p className="text-xs font-bold text-slate-200 line-clamp-1">
                        {ticket.subject}
                      </p>

                      {/* Last Message Excerpt */}
                      {ticket.last_message && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed bg-slate-900/60 p-2 rounded-xl border border-slate-800/50">
                          {ticket.last_message}
                        </p>
                      )}

                      {/* Footer Info & WhatsApp Link */}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                        <span className="font-mono">
                          {new Date(ticket.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(ticket.updated_at).toLocaleDateString()}
                        </span>
                        {ticket.user_phone && (
                          <a
                            href={`https://wa.me/55${ticket.user_phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-emerald-400 hover:underline font-bold"
                          >
                            <Phone className="w-3 h-3 text-emerald-400" />
                            WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: ACTIVE CHAT THREAD & OPERATOR REPLY (7 COLS) */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col min-h-[720px] max-h-[720px] space-y-4">
            {!selectedTicket ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 p-8 space-y-3">
                <Headphones className="w-12 h-12 text-sky-400 opacity-40 animate-pulse" />
                <h3 className="text-base font-bold text-white">Nenhum chamado selecionado</h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  Selecione uma solicitação da lista à esquerda para visualizar a conversa completa, responder ao jovem munícipe ou à empresa parceira.
                </p>
              </div>
            ) : (
              <>
                {/* TICKET DETAIL HEADER */}
                <div className="pb-4 border-b border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          selectedTicket.user_role === 'Empresa' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        }`}>
                          {selectedTicket.user_role || 'Candidato'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">ID: {selectedTicket.id}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(selectedTicket.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-white">{selectedTicket.subject}</h3>
                    </div>

                    {/* Status Dropdown */}
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status:</label>
                      <select
                        value={selectedTicket.status}
                        disabled={statusUpdating}
                        onChange={e => handleChangeStatus(e.target.value as any)}
                        className="bg-slate-950 border border-slate-700 text-xs font-bold rounded-xl px-3 py-1.5 text-slate-200 focus:border-sky-400 focus:outline-none cursor-pointer"
                      >
                        <option value="Pendente">🟡 Pendente</option>
                        <option value="Em Atendimento">🔵 Em Atendimento</option>
                        <option value="Resolvido">🟢 Resolvido</option>
                        <option value="Arquivado">⚪ Arquivado</option>
                      </select>
                    </div>
                  </div>

                  {/* Applicant Details Info Strip */}
                  <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-4 text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5 text-sky-400" />
                        <span className="font-bold text-white">{selectedTicket.user_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-slate-400">
                        <Mail className="w-3.5 h-3.5 text-sky-400" />
                        <span>{selectedTicket.user_email}</span>
                      </div>
                    </div>

                    {selectedTicket.user_phone && (
                      <a
                        href={`https://wa.me/55${selectedTicket.user_phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        WhatsApp Direto ({selectedTicket.user_phone})
                      </a>
                    )}
                  </div>
                </div>

                {/* THREAD MESSAGES CHAT AREA */}
                <div className="flex-1 overflow-y-auto custom-scroll space-y-3 p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                  {ticketMessages.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      Sem mensagens registradas nesta conversa.
                    </div>
                  ) : (
                    ticketMessages.map((msg, mIdx) => {
                      const isAgent = msg.sender_type === 'agent';

                      return (
                        <div
                          key={msg.id || mIdx}
                          className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'} space-y-1`}
                        >
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono px-1">
                            <span className="font-bold text-slate-300">{msg.sender_name}</span>
                            {isAgent && (
                              <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-400 font-bold">
                                🎧 Atendimento Oportuniza
                              </span>
                            )}
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>

                          <div className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed text-left ${
                            isAgent 
                              ? 'bg-sky-950/60 border border-sky-500/40 text-sky-100 rounded-tr-none shadow-md shadow-sky-950/20' 
                              : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                          }`}>
                            {msg.content}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* QUICK PRESETS CHIPS */}
                <div className="space-y-1.5 text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block pl-1">
                    Respostas Rápida Prontas da Prefeitura:
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto custom-scroll pb-1">
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(`Olá, ${selectedTicket.user_name}! Seu atendimento foi recebido pela equipe municipal do Oportuniza Araucária. Como podemos ajudar?`)}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-[10px] font-medium whitespace-nowrap cursor-pointer transition-colors"
                    >
                      👋 Boas-Vindas Atendimento
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(`Olá! Verificamos a documentação da empresa e sua vaga foi homologada e publicada com sucesso no Feed do Oportuniza Araucária!`)}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-[10px] font-medium whitespace-nowrap cursor-pointer transition-colors"
                    >
                      🏢 Vaga Homologada
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(`Seu certificado de conclusão de curso já se encontra disponível para download em PDF no portal do aluno. Parabéns!`)}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-[10px] font-medium whitespace-nowrap cursor-pointer transition-colors"
                    >
                      🎓 Certificado Liberado
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(`Sua solicitação foi analisada e concluída com sucesso por nossa equipe. Permanecemos à disposição!`)}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-[10px] font-medium whitespace-nowrap cursor-pointer transition-colors"
                    >
                      ✅ Conclusão do Chamado
                    </button>
                  </div>
                </div>

                {/* REPLY INPUT FORM */}
                <form onSubmit={handleSendReply} className="space-y-3 pt-1 text-left">
                  <div className="relative">
                    <textarea
                      rows={3}
                      required
                      value={replyInput}
                      onChange={e => setReplyInput(e.target.value)}
                      placeholder={`Escreva sua resposta de atendimento para ${selectedTicket.user_name}...`}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-400 rounded-2xl p-3.5 text-xs text-slate-200 focus:outline-none resize-none font-sans"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoResolveOnReply}
                        onChange={e => setAutoResolveOnReply(e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-950 border-slate-800 accent-sky-400 cursor-pointer"
                      />
                      <span>Marcar chamado como "Resolvido" ao enviar resposta</span>
                    </label>

                    <button
                      type="submit"
                      disabled={isSendingMsg || !replyInput.trim()}
                      className="px-5 py-3 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      {isSendingMsg ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Enviar Resposta ao Munícipe</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

        </div>
      </main>

      {/* MODAL: REGISTRAR NOVO ATENDIMENTO MANUAL */}
      <AnimatePresence>
        {showNewTicketModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 my-8 text-left"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-sky-400">Central de Atendimento</span>
                  <h3 className="text-base font-black text-white">Registrar Novo Atendimento Manual</h3>
                </div>
                <button
                  onClick={() => setShowNewTicketModal(false)}
                  className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateNewTicketSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">Nome do Solicitante *</label>
                    <input
                      type="text"
                      required
                      value={newTicketForm.user_name}
                      onChange={e => setNewTicketForm({...newTicketForm, user_name: e.target.value})}
                      placeholder="Ex: Gabriel Santos"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-400 rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">Tipo de Perfil</label>
                    <select
                      value={newTicketForm.user_role}
                      onChange={e => setNewTicketForm({...newTicketForm, user_role: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-400 rounded-xl px-3 py-2.5 text-xs focus:outline-none text-slate-300"
                    >
                      <option value="Candidato">🎓 Candidato / Jovem</option>
                      <option value="Empresa">🏢 Empresa Contratante</option>
                      <option value="Estudante">📚 Estudante de Cursos</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">E-mail de Contato</label>
                    <input
                      type="email"
                      value={newTicketForm.user_email}
                      onChange={e => setNewTicketForm({...newTicketForm, user_email: e.target.value})}
                      placeholder="email@exemplo.com"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-400 rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">WhatsApp / Telefone</label>
                    <input
                      type="text"
                      value={newTicketForm.user_phone}
                      onChange={e => setNewTicketForm({...newTicketForm, user_phone: e.target.value})}
                      placeholder="(41) 99650-2358"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-400 rounded-xl px-3 py-2.5 text-xs focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Assunto da Solicitação *</label>
                  <input
                    type="text"
                    required
                    value={newTicketForm.subject}
                    onChange={e => setNewTicketForm({...newTicketForm, subject: e.target.value})}
                    placeholder="Ex: Dúvida sobre Inscrição em Vaga"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-400 rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Descrição Detalhada / Mensagem *</label>
                  <textarea
                    rows={3}
                    required
                    value={newTicketForm.initial_message}
                    onChange={e => setNewTicketForm({...newTicketForm, initial_message: e.target.value})}
                    placeholder="Escreva a dúvida ou relato do munícipe..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-400 rounded-xl p-3 text-xs focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNewTicketModal(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl text-xs transition-colors cursor-pointer text-center"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black py-3 rounded-xl text-xs transition-all cursor-pointer text-center shadow-md active:scale-95"
                  >
                    Registrar Chamado
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

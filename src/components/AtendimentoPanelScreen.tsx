import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Headphones, Search, Filter, MessageSquare, CheckCircle, Clock, 
  AlertCircle, Phone, Mail, User as UserIcon, Building2, Send, 
  RefreshCw, LogOut, CheckCircle2, Shield, Sparkles, ChevronRight, 
  ArrowLeft, Plus, ExternalLink, Archive, AlertTriangle, FileText,
  UserCheck, Download, StickyNote, Lock, Star, MapPin, Tag, Share2, Printer, X
} from 'lucide-react';
import { jsPDF } from 'jspdf';
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
import { updateOwn2FASetting } from '../lib/twoFactorSettingsService';

interface AtendimentoPanelScreenProps {
  user: User;
  onLogout: () => void;
  onNavigateHome?: () => void;
  onUpdateUser?: (updatedUser: User) => void;
}

export default function AtendimentoPanelScreen({ user, onLogout, onNavigateHome, onUpdateUser }: AtendimentoPanelScreenProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages] = useState<SupportTicketMessage[]>([]);
  const [replyInput, setReplyInput] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [autoResolveOnReply, setAutoResolveOnReply] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [roleFilter, setRoleFilter] = useState<string>('Todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todos');
  const [assignedToMeOnly, setAssignedToMeOnly] = useState<boolean>(false);

  // Loading & Action states
  const [loading, setLoading] = useState(true);
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type?: 'success' | 'info' | 'warning' } | null>(null);

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
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
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

      const matchesCategory =
        categoryFilter === 'Todos' ? true : t.category === categoryFilter;

      const matchesAssigned =
        !assignedToMeOnly ? true : t.assigned_to === user.name;

      return matchesSearch && matchesStatus && matchesRole && matchesCategory && matchesAssigned;
    });
  }, [tickets, searchQuery, statusFilter, roleFilter, categoryFilter, assignedToMeOnly, user.name]);

  // Previous tickets history for the selected user (same email/phone)
  const previousTicketsForUser = useMemo(() => {
    if (!selectedTicket) return [];
    return tickets.filter(
      t => t.id !== selectedTicket.id && 
      (t.user_email.toLowerCase() === selectedTicket.user_email.toLowerCase() ||
       (t.user_phone && selectedTicket.user_phone && t.user_phone === selectedTicket.user_phone))
    );
  }, [tickets, selectedTicket]);

  // KPI Calculations
  const totalCount = tickets.length;
  const pendingCount = tickets.filter(t => t.status === 'Pendente').length;
  const inProgressCount = tickets.filter(t => t.status === 'Em Atendimento').length;
  const resolvedCount = tickets.filter(t => t.status === 'Resolvido').length;

  const showToast = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Handle Send Reply or Internal Note by Operator
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyInput.trim()) return;

    setIsSendingMsg(true);
    try {
      const nextSt = autoResolveOnReply ? 'Resolvido' : 'Em Atendimento';
      
      const messageContent = isInternalNote 
        ? `🔒 [NOTA INTERNA DE ATENDIMENTO]: ${replyInput.trim()}`
        : replyInput.trim();

      await sendSupportTicketMessage({
        ticket_id: selectedTicket.id,
        sender_type: isInternalNote ? 'system' : 'agent',
        sender_name: isInternalNote ? `Nota de ${user.name.split(' ')[0]}` : (user.name || 'Atendimento Oportuniza'),
        sender_email: user.email || 'atendimento@araucaria.pr.gov.br',
        content: messageContent,
        next_status: isInternalNote ? selectedTicket.status : nextSt
      });

      setReplyInput('');
      setIsInternalNote(false);

      showToast(
        isInternalNote 
          ? 'Nota interna salva na ficha do chamado!'
          : (autoResolveOnReply ? 'Resposta enviada e chamado concluído com sucesso!' : 'Resposta enviada ao munícipe com sucesso!')
      );

      await loadTicketsData();
      
      const updatedMsgs = await fetchTicketMessages(selectedTicket.id);
      setTicketMessages(updatedMsgs);
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      console.error('Error sending reply:', err);
      showToast(`Erro ao enviar: ${err.message || 'Erro de conexão'}`, 'warning');
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
    const formatted = text
      .replace('{nome}', selectedTicket ? selectedTicket.user_name.split(' ')[0] : 'Munícipe')
      .replace('{operador}', user.name ? user.name.split(' ')[0] : 'Atendimento');
    setReplyInput(formatted);
  };

  // Submit New Manual Ticket (Balcão Presencial / Telefone)
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

  // Generate Receipt PDF
  const handleGenerateReceiptPDF = () => {
    if (!selectedTicket) return;

    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Prefeitura Municipal de Araucaria", 14, 18);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Secretaria Municipal de Trabalho e Emprego - Oportuniza Araucaria", 14, 25);
      doc.text(`Ficha Oficial de Atendimento ao Municupe - Chamado #${selectedTicket.id.substring(0, 8)}`, 14, 32);
      doc.line(14, 36, 196, 36);

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("1. DADOS DO SOLICITANTE:", 14, 44);
      doc.setFont("helvetica", "normal");
      doc.text(`Nome Completo: ${selectedTicket.user_name}`, 14, 51);
      doc.text(`E-mail: ${selectedTicket.user_email}`, 14, 57);
      doc.text(`WhatsApp / Telefone: ${selectedTicket.user_phone || "Nao informado"}`, 14, 63);
      doc.text(`Perfil: ${selectedTicket.user_role || "Candidato"}`, 14, 69);
      doc.text(`Categoria: ${selectedTicket.category || "Geral"}`, 14, 75);

      doc.setFont("helvetica", "bold");
      doc.text("2. RESUMO DO CHAMADO:", 14, 85);
      doc.setFont("helvetica", "normal");
      doc.text(`Assunto: ${selectedTicket.subject}`, 14, 92);
      doc.text(`Status Atual: ${selectedTicket.status}`, 14, 98);
      doc.text(`Atendente Responsavel: ${selectedTicket.assigned_to || user.name || 'Central de Atendimento'}`, 14, 104);
      doc.text(`Data de Abertura: ${new Date(selectedTicket.created_at).toLocaleString('pt-BR')}`, 14, 110);
      doc.line(14, 115, 196, 115);

      doc.setFont("helvetica", "bold");
      doc.text("3. HISTORICO DE INTERACOES:", 14, 123);
      let y = 131;

      ticketMessages.forEach((m) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFont("helvetica", "bold");
        const isAgent = m.sender_type === 'agent';
        const isNote = m.sender_type === 'system' || m.content.includes('[NOTA INTERNA');
        const tag = isNote ? '[NOTA INTERNA]' : isAgent ? '[ATENDIMENTO PREFEITURA]' : `[${m.sender_name}]`;
        const dateStr = new Date(m.created_at).toLocaleString('pt-BR');
        
        doc.text(`${tag} - ${dateStr}:`, 14, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        const cleanContent = m.content.replace('🔒 [NOTA INTERNA DE ATENDIMENTO]: ', '');
        const splitText = doc.splitTextToSize(cleanContent, 180);
        doc.text(splitText, 14, y);
        y += splitText.length * 5 + 4;
      });

      doc.save(`Atendimento_Araucaria_${selectedTicket.user_name.replace(/\s+/g, '_')}.pdf`);
      showToast('Relatório em PDF gerado com sucesso!');
    } catch (err) {
      console.error('Error generating PDF:', err);
      showToast('Erro ao gerar relatório PDF.', 'warning');
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      
      {/* TOP HEADER BAR */}
      <header className="bg-slate-900/95 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          
          {/* Brand & Role */}
          <div className="flex items-center gap-3.5">
            {onNavigateHome && (
              <button 
                onClick={onNavigateHome}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
                title="Voltar ao site principal"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-xs">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">Central de Atendimento Oportuniza</h1>
                <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 px-2 py-0.5 rounded-md hidden sm:inline">
                  Prefeitura de Araucária · Nível 2
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Suporte ao jovem munícipe, moderação de vagas e atendimento presencial e digital.
              </p>
            </div>
          </div>

          {/* User Profile & Global Controls */}
          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex flex-col text-right leading-tight pr-1">
              <span className="text-xs font-bold text-slate-200">{user.name || 'Operador de Atendimento'}</span>
              <span className="text-[10px] text-cyan-400 font-mono">{user.email}</span>
            </div>

            <button
              type="button"
              onClick={async () => {
                const next = !Boolean(user.is2FAEnabled);
                await updateOwn2FASetting(user, next, onUpdateUser);
                showToast(
                  next
                    ? 'Verificação em Duas Etapas (2FA) ativada para sua conta.'
                    : 'Verificação em Duas Etapas (2FA) desativada na sua conta.',
                  next ? 'success' : 'info'
                );
              }}
              title={
                user.is2FAEnabled
                  ? '2FA Ativo na sua conta (clique para desativar)'
                  : '2FA Desativado na sua conta (clique para ativar)'
              }
              className={`px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                user.is2FAEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{user.is2FAEnabled ? '2FA Ativo' : '2FA Off'}</span>
            </button>

            <button
              onClick={() => loadTicketsData()}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
              title="Recarregar chamados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>

            <button
              onClick={() => setShowNewTicketModal(true)}
              className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Atendimento</span>
            </button>

            <button
              onClick={onLogout}
              className="p-2.5 bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 rounded-xl transition-colors cursor-pointer"
              title="Sair do painel"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* TOAST FEEDBACK FLOATER */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-xl font-bold text-xs flex items-center gap-2 border ${
              toastMsg.type === 'warning'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-cyan-500 text-slate-950 border-cyan-400'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>{toastMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT WORKSPACE */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 sm:p-6 space-y-5">
        
        {/* TOP METRICS KPI BAR */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div 
            onClick={() => { setStatusFilter('Todos'); setRoleFilter('Todos'); }}
            className="p-4 bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl flex items-center gap-3.5 shadow-xs cursor-pointer transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0">
              <Headphones className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 block">Total de Chamados</span>
              <span className="text-xl font-black text-white">{totalCount}</span>
            </div>
          </div>

          <div 
            onClick={() => setStatusFilter('Pendentes')}
            className={`p-4 bg-slate-900/90 border rounded-2xl flex items-center gap-3.5 shadow-xs cursor-pointer transition-all ${
              statusFilter === 'Pendentes' ? 'border-amber-500/60 bg-amber-950/20' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-amber-400 block">Aguardando Resposta</span>
              <span className="text-xl font-black text-amber-400">{pendingCount}</span>
            </div>
          </div>

          <div 
            onClick={() => setStatusFilter('Em Atendimento')}
            className={`p-4 bg-slate-900/90 border rounded-2xl flex items-center gap-3.5 shadow-xs cursor-pointer transition-all ${
              statusFilter === 'Em Atendimento' ? 'border-cyan-500/60 bg-cyan-950/20' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-cyan-400 block">Em Atendimento</span>
              <span className="text-xl font-black text-cyan-400">{inProgressCount}</span>
            </div>
          </div>

          <div 
            onClick={() => setStatusFilter('Resolvidos')}
            className={`p-4 bg-slate-900/90 border rounded-2xl flex items-center gap-3.5 shadow-xs cursor-pointer transition-all ${
              statusFilter === 'Resolvidos' ? 'border-emerald-500/60 bg-emerald-950/20' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-emerald-400 block">Concluídos com Sucesso</span>
              <span className="text-xl font-black text-emerald-400">{resolvedCount}</span>
            </div>
          </div>
        </div>

        {/* SEARCH & SEGMENTATION CONTROL BAR */}
        <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center gap-3">
          
          {/* Real Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome do munícipe, e-mail, telefone, assunto ou mensagem..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl pl-10 pr-8 py-2 text-xs text-slate-200 focus:outline-hidden"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Segment Buttons (Status) */}
          <div className="flex items-center gap-1 overflow-x-auto custom-scroll pb-1 md:pb-0">
            {['Todos', 'Pendentes', 'Em Atendimento', 'Resolvidos', 'Arquivados'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === st 
                    ? 'bg-cyan-600 text-white font-bold shadow-xs' 
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Filter Role (Candidatos vs Empresas) */}
          <div className="flex items-center gap-1 shrink-0">
            {['Todos', 'Candidatos', 'Empresas'].map(rl => (
              <button
                key={rl}
                onClick={() => setRoleFilter(rl)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  roleFilter === rl 
                    ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40' 
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800/80'
                }`}
              >
                {rl}
              </button>
            ))}
          </div>
        </div>

        {/* 3-PANE DESKTOP GRID LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* PANE 1: INBOX TICKETS FEED (4 COLS) */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 max-h-[740px] flex flex-col">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <span>Chamados ({filteredTickets.length})</span>
              </span>
              <span className="text-[10px] text-slate-500">
                {statusFilter !== 'Todos' ? statusFilter : 'Todas Categorias'}
              </span>
            </div>

            {filteredTickets.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Headphones className="w-10 h-10 mx-auto opacity-30 text-cyan-400" />
                <p className="text-xs font-bold">Nenhum chamado nesta filtragem.</p>
                <p className="text-[11px] text-slate-500">Tente buscar por outro termo ou alterar os filtros.</p>
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
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left space-y-2 ${
                        isSelected 
                          ? 'bg-cyan-950/40 border-cyan-500/50 ring-1 ring-cyan-500/30' 
                          : 'bg-slate-950/70 border-slate-800/80 hover:bg-slate-950 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isComp ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          }`}>
                            {isComp ? <Building2 className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate">{ticket.user_name}</h4>
                            <span className="text-[11px] text-slate-400 truncate block font-mono">{ticket.user_email}</span>
                          </div>
                        </div>

                        {/* Unboxed status indicator text */}
                        <span className={`text-[10px] font-bold ${
                          ticket.status === 'Pendente' ? 'text-amber-400' :
                          ticket.status === 'Em Atendimento' ? 'text-cyan-400' :
                          ticket.status === 'Resolvido' ? 'text-emerald-400' :
                          'text-slate-400'
                        }`}>
                          {ticket.status}
                        </span>
                      </div>

                      {/* Subject */}
                      <p className="text-xs font-bold text-slate-200 line-clamp-1">
                        {ticket.subject}
                      </p>

                      {/* Excerpt */}
                      {ticket.last_message && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                          {ticket.last_message}
                        </p>
                      )}

                      {/* Footer Info */}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                        <span className="font-mono">
                          {new Date(ticket.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(ticket.updated_at).toLocaleDateString()}
                        </span>
                        {ticket.user_phone && (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <Phone className="w-3 h-3 text-emerald-400" />
                            <span>WhatsApp</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* PANE 2: ACTIVE CONVERSATION THREAD & OPERATOR EDITOR (5 COLS) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col min-h-[740px] max-h-[740px] space-y-3.5">
            {!selectedTicket ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 p-8 space-y-3">
                <Headphones className="w-12 h-12 text-cyan-400 opacity-40 animate-pulse" />
                <h3 className="text-sm font-bold text-white">Nenhum chamado selecionado</h3>
                <p className="text-xs text-slate-400 max-w-xs">
                  Selecione uma solicitação da lista para visualizar a conversa completa, encaminhar para os setores ou responder.
                </p>
              </div>
            ) : (
              <>
                {/* TICKET DETAIL HEADER */}
                <div className="pb-3 border-b border-slate-800 space-y-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-0.5 text-left min-w-0">
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="font-bold text-cyan-400">{selectedTicket.user_role || 'Candidato'}</span>
                        <span>·</span>
                        <span className="font-mono">#{selectedTicket.id.substring(0, 8)}</span>
                        <span>·</span>
                        <span>{new Date(selectedTicket.created_at).toLocaleString('pt-BR')}</span>
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-white truncate">{selectedTicket.subject}</h3>
                    </div>

                    {/* Status Dropdown */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] text-slate-400 font-medium">Status:</span>
                      <select
                        value={selectedTicket.status}
                        disabled={statusUpdating}
                        onChange={e => handleChangeStatus(e.target.value as any)}
                        className="bg-slate-950 border border-slate-700 text-xs font-bold rounded-lg px-2.5 py-1 text-slate-200 focus:border-cyan-500 focus:outline-hidden cursor-pointer"
                      >
                        <option value="Pendente">🟡 Pendente</option>
                        <option value="Em Atendimento">🔵 Em Atendimento</option>
                        <option value="Resolvido">🟢 Resolvido</option>
                        <option value="Arquivado">⚪ Arquivado</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* THREAD MESSAGES CHAT AREA */}
                <div className="flex-1 overflow-y-auto custom-scroll space-y-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  {ticketMessages.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      Sem mensagens registradas nesta conversa.
                    </div>
                  ) : (
                    ticketMessages.map((msg, mIdx) => {
                      const isAgent = msg.sender_type === 'agent';
                      const isInternal = msg.sender_type === 'system' || msg.content.includes('[NOTA INTERNA');

                      return (
                        <div
                          key={msg.id || mIdx}
                          className={`flex flex-col ${isAgent ? 'items-end' : (isInternal ? 'items-center' : 'items-start')} space-y-1`}
                        >
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono px-1">
                            <span className="font-bold text-slate-300">{msg.sender_name}</span>
                            {isAgent && (
                              <span className="text-cyan-400 font-bold">
                                · Atendimento Prefeitura
                              </span>
                            )}
                            {isInternal && (
                              <span className="text-amber-400 font-bold">
                                · Nota Interna do Atendente
                              </span>
                            )}
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>

                          <div className={`p-3 rounded-xl max-w-[90%] text-xs leading-relaxed text-left ${
                            isInternal
                              ? 'bg-amber-950/40 border border-amber-500/40 text-amber-100 font-sans shadow-xs'
                              : isAgent 
                              ? 'bg-cyan-950/50 border border-cyan-500/40 text-cyan-100 rounded-tr-none shadow-xs' 
                              : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                          }`}>
                            {msg.content.replace('🔒 [NOTA INTERNA DE ATENDIMENTO]: ', '')}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* QUICK PRESETS DROPDOWN & PRESET CHIPS */}
                <div className="space-y-1 text-left">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold">Respostas Rápida Prontas:</span>
                    <button
                      type="button"
                      onClick={() => setIsInternalNote(!isInternalNote)}
                      className={`text-[11px] font-bold cursor-pointer transition-colors ${
                        isInternalNote ? 'text-amber-400 underline' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {isInternalNote ? '🔒 Modo Nota Interna Ativo' : '📝 Alternar para Nota Interna'}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll pb-1">
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(`Olá, {nome}! Seu chamado foi recebido pela Central de Atendimento Oportuniza Araucária. Como podemos orientar você hoje?`)}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-[10px] font-medium whitespace-nowrap cursor-pointer transition-colors"
                    >
                      👋 Boas-Vindas
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(`Olá, {nome}! Verificamos os dados do seu cadastro e a vaga anunciada foi homologada com sucesso no Portal!`)}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-[10px] font-medium whitespace-nowrap cursor-pointer transition-colors"
                    >
                      🏢 Homologação de Vaga
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(`Olá, {nome}! Seu certificado de conclusão com carga horária está liberado para download em PDF no seu Perfil!`)}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-[10px] font-medium whitespace-nowrap cursor-pointer transition-colors"
                    >
                      🎓 Liberação de Certificado
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(`Encaminhamos sua solicitação para a equipe do SINE / CIEE de Araucária para agendamento presencial.`)}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-[10px] font-medium whitespace-nowrap cursor-pointer transition-colors"
                    >
                      🏛️ Encaminhar SINE/CIEE
                    </button>
                  </div>
                </div>

                {/* REPLY INPUT FORM */}
                <form onSubmit={handleSendReply} className="space-y-2.5 text-left">
                  <div className="relative">
                    <textarea
                      rows={3}
                      required
                      value={replyInput}
                      onChange={e => setReplyInput(e.target.value)}
                      placeholder={
                        isInternalNote 
                          ? `Escreva uma nota interna (privada aos atendentes) sobre o chamado de ${selectedTicket.user_name}...`
                          : `Escreva sua resposta para ${selectedTicket.user_name}...`
                      }
                      className={`w-full border rounded-xl p-3 text-xs text-slate-200 focus:outline-hidden resize-none font-sans ${
                        isInternalNote
                          ? 'bg-amber-950/30 border-amber-500/50 focus:border-amber-400 placeholder-amber-400/60'
                          : 'bg-slate-950 border-slate-800 focus:border-cyan-500 placeholder-slate-500'
                      }`}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoResolveOnReply}
                        onChange={e => setAutoResolveOnReply(e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-950 border-slate-800 accent-cyan-500 cursor-pointer"
                      />
                      <span>Concluir chamado ao enviar</span>
                    </label>

                    <button
                      type="submit"
                      disabled={isSendingMsg || !replyInput.trim()}
                      className={`px-4 py-2 disabled:opacity-50 font-bold rounded-xl text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-95 ${
                        isInternalNote
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                      }`}
                    >
                      {isSendingMsg ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          {isInternalNote ? <StickyNote className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                          <span>{isInternalNote ? 'Salvar Nota Interna' : 'Enviar Resposta'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* PANE 3: SOLICITANTE DOSSIER & QUICK ACTIONS (3 COLS) */}
          <div className="lg:col-span-3 space-y-4">
            {!selectedTicket ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center text-slate-500 text-xs">
                Selecione um chamado para ver a ficha completa.
              </div>
            ) : (
              <>
                {/* Solicitante Profile Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 text-left">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                    <div className="w-11 h-11 rounded-xl bg-cyan-700 text-white font-black text-base flex items-center justify-center shrink-0 shadow-2xs">
                      {selectedTicket.user_name.substring(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{selectedTicket.user_name}</h4>
                      <p className="text-xs text-slate-400 truncate">{selectedTicket.user_email}</p>
                      <span className="inline-block mt-0.5 text-[10px] font-semibold text-cyan-400">
                        {selectedTicket.user_role || 'Candidato'} em Araucária
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">WhatsApp:</span>
                      {selectedTicket.user_phone ? (
                        <a
                          href={`https://wa.me/55${selectedTicket.user_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${selectedTicket.user_name.split(' ')[0]}! Sou do Atendimento Oportuniza Araucária a respeito da sua solicitação "${selectedTicket.subject}".`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{selectedTicket.user_phone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-500">Não informado</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Categoria:</span>
                      <span className="font-semibold text-white">{selectedTicket.category || 'Geral'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Atendente:</span>
                      <span className="font-semibold text-cyan-400">{selectedTicket.assigned_to || 'Fila Geral'}</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={handleGenerateReceiptPDF}
                      className="w-full py-2 px-3 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors cursor-pointer text-center flex items-center justify-center gap-2 border border-slate-700"
                    >
                      <Printer className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Gerar Comprovante PDF</span>
                    </button>

                    {selectedTicket.user_phone && (
                      <a
                        href={`https://wa.me/55${selectedTicket.user_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá, ${selectedTicket.user_name.split(' ')[0]}! Aqui é a equipe de atendimento do Oportuniza Araucária.`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2 px-3 text-xs font-bold bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 rounded-xl transition-colors cursor-pointer text-center flex items-center justify-center gap-2"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Abrir WhatsApp Web</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Previous History for the same user */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5 text-left">
                  <h4 className="text-xs font-bold text-slate-300">
                    Histórico do Munícipe ({previousTicketsForUser.length})
                  </h4>

                  {previousTicketsForUser.length === 0 ? (
                    <p className="text-[11px] text-slate-500">Nenhum atendimento anterior registrado para este usuário.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scroll pr-1">
                      {previousTicketsForUser.map(pt => (
                        <div
                          key={pt.id}
                          onClick={() => setSelectedTicketId(pt.id)}
                          className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors cursor-pointer text-left space-y-1"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-slate-300 truncate max-w-[120px]">{pt.subject}</span>
                            <span className="text-cyan-400 font-mono">{pt.status}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block font-mono">
                            {new Date(pt.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

        </div>
      </main>

      {/* MODAL: REGISTRAR NOVO ATENDIMENTO MANUAL (BALCÃO / TELEFONE) */}
      <AnimatePresence>
        {showNewTicketModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 my-8 text-left"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <div>
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Atendimento Balcão / Telefone</span>
                  <h3 className="text-base font-bold text-white">Registrar Novo Atendimento</h3>
                </div>
                <button
                  onClick={() => setShowNewTicketModal(false)}
                  className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
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
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2.5 text-xs focus:outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">Tipo de Perfil</label>
                    <select
                      value={newTicketForm.user_role}
                      onChange={e => setNewTicketForm({...newTicketForm, user_role: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2.5 text-xs focus:outline-hidden text-slate-300 cursor-pointer"
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
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2.5 text-xs focus:outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">WhatsApp / Telefone</label>
                    <input
                      type="text"
                      value={newTicketForm.user_phone}
                      onChange={e => setNewTicketForm({...newTicketForm, user_phone: e.target.value})}
                      placeholder="(41) 99650-2358"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2.5 text-xs focus:outline-hidden font-mono"
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
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2.5 text-xs focus:outline-hidden"
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
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl p-3 text-xs focus:outline-hidden"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNewTicketModal(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer text-center"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer text-center shadow-xs active:scale-95"
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

import { supabase } from './supabaseClient';
import { recordAuditLog } from './auditLogService';

export interface SupportTicket {
  id: string;
  user_id?: string;
  user_name: string;
  user_email: string;
  user_phone?: string;
  user_role?: string; // 'Candidato' | 'Empresa' | 'Estudante' | 'Outro'
  subject: string;
  category?: 'Geral' | 'Dúvida em Vagas' | 'Currículo & Cadastro' | 'Suporte Empresa' | 'Cursos' | 'Outros';
  status: 'Pendente' | 'Em Atendimento' | 'Resolvido' | 'Arquivado';
  assigned_to?: string; // Operator name
  last_message?: string;
  created_at: string;
  updated_at: string;
  messages?: SupportTicketMessage[];
}

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  sender_type: 'user' | 'agent' | 'system';
  sender_name: string;
  sender_email?: string;
  content: string;
  created_at: string;
}

const LOCAL_TICKETS_KEY = 'oportuniza-support-tickets-v2';
const LOCAL_MESSAGES_KEY = 'oportuniza-support-messages-v2';

// Standard seed support tickets for initial demonstration & fallback
const INITIAL_SEED_TICKETS: SupportTicket[] = [
  {
    id: 'st-101',
    user_id: 'usr-cand-1',
    user_name: 'Lucas Gabriel da Silva',
    user_email: 'lucas.silva.araucaria@gmail.com',
    user_phone: '(41) 99876-5432',
    user_role: 'Candidato',
    subject: 'Dúvida sobre envio do currículo para vaga no Polo Petrobras',
    category: 'Currículo & Cadastro',
    status: 'Pendente',
    last_message: 'Olá, gostaria de saber se o meu currículo foi enviado com sucesso para a vaga de Auxiliar de Produção.',
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    messages: [
      {
        id: 'msg-101-1',
        ticket_id: 'st-101',
        sender_type: 'user',
        sender_name: 'Lucas Gabriel da Silva',
        sender_email: 'lucas.silva.araucaria@gmail.com',
        content: 'Olá! Me candidatai para a vaga de Auxiliar de Produção no Polo Petrobras. Onde posso verificar se o recrutador já abriu meu PDF?',
        created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString()
      }
    ]
  },
  {
    id: 'st-102',
    user_id: 'usr-comp-1',
    user_name: 'Supermassa Alimentos (Ana Paula - RH)',
    user_email: 'supermassa@gmail.com',
    user_phone: '(41) 99650-2358',
    user_role: 'Empresa',
    subject: 'Solicitação de homologação acelerada para Vaga de Repositor',
    category: 'Suporte Empresa',
    status: 'Em Atendimento',
    assigned_to: 'Atendimento Oportuniza',
    last_message: 'Estamos verificando os dados do CNPJ da Supermassa para liberar o anúncio.',
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    messages: [
      {
        id: 'msg-102-1',
        ticket_id: 'st-102',
        sender_type: 'user',
        sender_name: 'Supermassa Alimentos',
        sender_email: 'supermassa@gmail.com',
        content: 'Boa tarde! Cadastramos uma vaga urgente de Repositor de Estoque para a loja do Centro de Araucária. Precisamos da aprovação do ADM.',
        created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString()
      },
      {
        id: 'msg-102-2',
        ticket_id: 'st-102',
        sender_type: 'agent',
        sender_name: 'Equipe de Atendimento Oportuniza',
        sender_email: 'atendimento@oportuniza.araucaria.br',
        content: 'Olá, Ana Paula! Tudo bem? Estamos verificando o CNPJ da Supermassa. Em poucos minutos a vaga estará aceita e visível no Feed dos alunos.',
        created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString()
      }
    ]
  },
  {
    id: 'st-103',
    user_id: 'usr-cand-2',
    user_name: 'Mariana Oliveira Souza',
    user_email: 'mariana.souza.araucaria@outlook.com',
    user_phone: '(41) 98822-1144',
    user_role: 'Estudante',
    subject: 'Emissão de certificado do Curso de Qualidade no Atendimento',
    category: 'Cursos',
    status: 'Resolvido',
    assigned_to: 'Equipe Atendimento',
    last_message: 'Seu certificado foi gerado com sucesso! Acesse a aba Meus Cursos.',
    created_at: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    messages: [
      {
        id: 'msg-103-1',
        ticket_id: 'st-103',
        sender_type: 'user',
        sender_name: 'Mariana Oliveira Souza',
        sender_email: 'mariana.souza.araucaria@outlook.com',
        content: 'Concluí todas as aulas do curso de Atendimento ao Cliente. Como faço para baixar o certificado com a chancela municipal?',
        created_at: new Date(Date.now() - 1000 * 60 * 600).toISOString()
      },
      {
        id: 'msg-103-2',
        ticket_id: 'st-103',
        sender_type: 'agent',
        sender_name: 'Atendimento Oportuniza',
        sender_email: 'suporte@oportuniza.araucaria.br',
        content: 'Parabéns pela conclusão, Mariana! O certificado já está liberado automaticamente na sua aba "Cursos Concluídos" com opção de PDF.',
        created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString()
      }
    ]
  }
];

/**
 * Reads all support tickets from Supabase database and merges with local fallback
 */
export async function fetchAllSupportTickets(): Promise<SupportTicket[]> {
  let dbTickets: SupportTicket[] = [];

  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!error && data && Array.isArray(data) && data.length > 0) {
      dbTickets = data.map((t: any) => ({
        id: String(t.id),
        user_id: t.user_id ? String(t.user_id) : undefined,
        user_name: String(t.user_name || t.user_email || 'Solicitante'),
        user_email: String(t.user_email || ''),
        user_phone: t.user_phone ? String(t.user_phone) : undefined,
        user_role: String(t.user_role || 'Candidato'),
        subject: String(t.subject || 'Dúvida de Atendimento'),
        category: t.category || 'Geral',
        status: t.status || 'Pendente',
        assigned_to: t.assigned_to ? String(t.assigned_to) : undefined,
        last_message: t.last_message ? String(t.last_message) : undefined,
        created_at: t.created_at || new Date().toISOString(),
        updated_at: t.updated_at || new Date().toISOString()
      }));
    }
  } catch (err) {
    console.warn('Error fetching support tickets from Supabase:', err);
  }

  // Load local tickets fallback
  let localTickets: SupportTicket[] = [];
  try {
    const raw = localStorage.getItem(LOCAL_TICKETS_KEY);
    if (raw) {
      localTickets = JSON.parse(raw);
    }
  } catch (e) {}

  if (localTickets.length === 0) {
    localTickets = INITIAL_SEED_TICKETS;
    try {
      localStorage.setItem(LOCAL_TICKETS_KEY, JSON.stringify(localTickets));
    } catch (e) {}
  }

  // Merge dbTickets and localTickets
  const dbIds = new Set(dbTickets.map(t => t.id));
  const merged = [...dbTickets];
  for (const lt of localTickets) {
    if (!dbIds.has(lt.id)) {
      merged.push(lt);
    }
  }

  // Sort by updated_at descending
  merged.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return merged;
}

/**
 * Fetch messages for a specific ticket
 */
export async function fetchTicketMessages(ticketId: string): Promise<SupportTicketMessage[]> {
  try {
    const { data, error } = await supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (!error && data && Array.isArray(data) && data.length > 0) {
      return data.map((m: any) => ({
        id: String(m.id),
        ticket_id: String(m.ticket_id),
        sender_type: m.sender_type || 'user',
        sender_name: String(m.sender_name || 'Solicitante'),
        sender_email: m.sender_email ? String(m.sender_email) : undefined,
        content: String(m.content || ''),
        created_at: m.created_at || new Date().toISOString()
      }));
    }
  } catch (err) {
    console.warn('Error fetching ticket messages from Supabase:', err);
  }

  // Fallback to local storage
  try {
    const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
    if (raw) {
      const allMsgs: SupportTicketMessage[] = JSON.parse(raw);
      const filtered = allMsgs.filter(m => m.ticket_id === ticketId);
      if (filtered.length > 0) return filtered;
    }

    const localTickets = await fetchAllSupportTickets();
    const found = localTickets.find(t => t.id === ticketId);
    if (found && found.messages && found.messages.length > 0) {
      return found.messages;
    }
  } catch (e) {}

  return [];
}

/**
 * Creates a new support ticket (from candidate or company user)
 */
export async function createSupportTicket(params: {
  user_id?: string;
  user_name: string;
  user_email: string;
  user_phone?: string;
  user_role?: string;
  subject: string;
  category?: 'Geral' | 'Dúvida em Vagas' | 'Currículo & Cadastro' | 'Suporte Empresa' | 'Cursos' | 'Outros';
  initial_message: string;
}): Promise<SupportTicket> {
  const newTicketId = `st-${Date.now()}`;
  const now = new Date().toISOString();

  const newTicket: SupportTicket = {
    id: newTicketId,
    user_id: params.user_id,
    user_name: params.user_name || 'Solicitante',
    user_email: params.user_email || 'usuario@araucaria.br',
    user_phone: params.user_phone,
    user_role: params.user_role || 'Candidato',
    subject: params.subject || 'Atendimento Oportuniza',
    category: params.category || 'Geral',
    status: 'Pendente',
    last_message: params.initial_message,
    created_at: now,
    updated_at: now,
    messages: [
      {
        id: `msg-${Date.now()}`,
        ticket_id: newTicketId,
        sender_type: 'user',
        sender_name: params.user_name || 'Solicitante',
        sender_email: params.user_email,
        content: params.initial_message,
        created_at: now
      }
    ]
  };

  // Attempt Supabase insert
  try {
    await supabase.from('support_tickets').insert({
      id: newTicketId,
      user_id: params.user_id,
      user_name: params.user_name,
      user_email: params.user_email,
      user_phone: params.user_phone,
      user_role: params.user_role || 'Candidato',
      subject: params.subject,
      category: params.category || 'Geral',
      status: 'Pendente',
      last_message: params.initial_message,
      created_at: now,
      updated_at: now
    });

    await supabase.from('support_messages').insert({
      id: `msg-${Date.now()}`,
      ticket_id: newTicketId,
      sender_type: 'user',
      sender_name: params.user_name,
      sender_email: params.user_email,
      content: params.initial_message,
      created_at: now
    });
  } catch (err) {
    console.warn('Supabase support ticket insert fallback to local:', err);
  }

  // Update local storage
  try {
    const all = await fetchAllSupportTickets();
    all.unshift(newTicket);
    localStorage.setItem(LOCAL_TICKETS_KEY, JSON.stringify(all));

    const rawMsgs = localStorage.getItem(LOCAL_MESSAGES_KEY);
    const msgs: SupportTicketMessage[] = rawMsgs ? JSON.parse(rawMsgs) : [];
    if (newTicket.messages) msgs.push(...newTicket.messages);
    localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(msgs));
  } catch (e) {}

  notifySupportUpdated();
  return newTicket;
}

/**
 * Sends a message in a ticket thread
 */
export async function sendSupportTicketMessage(params: {
  ticket_id: string;
  sender_type: 'user' | 'agent' | 'system';
  sender_name: string;
  sender_email?: string;
  content: string;
  next_status?: 'Pendente' | 'Em Atendimento' | 'Resolvido' | 'Arquivado';
}): Promise<SupportTicketMessage> {
  const newMsgId = `msg-${Date.now()}`;
  const now = new Date().toISOString();

  const newMsg: SupportTicketMessage = {
    id: newMsgId,
    ticket_id: params.ticket_id,
    sender_type: params.sender_type,
    sender_name: params.sender_name,
    sender_email: params.sender_email,
    content: params.content,
    created_at: now
  };

  const statusToSet = params.next_status || (params.sender_type === 'agent' ? 'Em Atendimento' : 'Pendente');

  // Supabase update
  try {
    await supabase.from('support_messages').insert({
      id: newMsgId,
      ticket_id: params.ticket_id,
      sender_type: params.sender_type,
      sender_name: params.sender_name,
      sender_email: params.sender_email,
      content: params.content,
      created_at: now
    });

    await supabase
      .from('support_tickets')
      .update({
        last_message: params.content,
        status: statusToSet,
        updated_at: now
      })
      .eq('id', params.ticket_id);
  } catch (err) {
    console.warn('Error inserting support message in Supabase:', err);
  }

  // Local storage update
  try {
    const rawMsgs = localStorage.getItem(LOCAL_MESSAGES_KEY);
    const msgs: SupportTicketMessage[] = rawMsgs ? JSON.parse(rawMsgs) : [];
    msgs.push(newMsg);
    localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(msgs));

    const tickets = await fetchAllSupportTickets();
    const updatedTickets = tickets.map(t => {
      if (t.id === params.ticket_id) {
        return {
          ...t,
          last_message: params.content,
          status: statusToSet,
          updated_at: now,
          messages: [...(t.messages || []), newMsg]
        };
      }
      return t;
    });
    localStorage.setItem(LOCAL_TICKETS_KEY, JSON.stringify(updatedTickets));
  } catch (e) {}

  notifySupportUpdated();
  return newMsg;
}

/**
 * Updates status of a ticket (e.g. Pendente -> Em Atendimento -> Resolvido)
 */
export async function updateSupportTicketStatus(
  ticketId: string,
  newStatus: 'Pendente' | 'Em Atendimento' | 'Resolvido' | 'Arquivado',
  operatorName: string
): Promise<boolean> {
  const now = new Date().toISOString();

  try {
    await supabase
      .from('support_tickets')
      .update({
        status: newStatus,
        assigned_to: operatorName,
        updated_at: now
      })
      .eq('id', ticketId);
  } catch (err) {
    console.warn('Supabase ticket status update fallback to local:', err);
  }

  try {
    const tickets = await fetchAllSupportTickets();
    const updated = tickets.map(t => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: newStatus,
          assigned_to: operatorName,
          updated_at: now
        };
      }
      return t;
    });
    localStorage.setItem(LOCAL_TICKETS_KEY, JSON.stringify(updated));
  } catch (e) {}

  await recordAuditLog({
    actor_name: operatorName || 'Atendimento Oportuniza',
    actor_email: 'suporte@oportuniza.araucaria.br',
    actor_role: 'Atendimento Oportuniza (Nível 2)',
    action: 'Atualização de Status de Atendimento',
    target_name: `Chamado #${ticketId}`,
    target_type: 'system',
    details: `Status do chamado de suporte alterado para "${newStatus}" por ${operatorName}.`,
    status: 'authorized'
  });

  notifySupportUpdated();
  return true;
}

export function notifySupportUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('oportuniza-support-tickets-updated'));
  }
}

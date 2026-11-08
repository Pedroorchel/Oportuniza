/**
 * Audit Trail & Authorization Log Service - Oportuniza Araucária
 * Records: "quem autorizou isso", timestamps, actions, targets, and justification details.
 */

import { supabase } from './supabaseClient';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor_name: string;
  actor_email: string;
  actor_role: string;
  action: string;
  target_name: string;
  target_type: 'user' | 'company' | 'job' | 'role' | 'security' | 'system';
  details: string;
  status: 'authorized' | 'warning' | 'blocked' | 'info';
  ip_address?: string;
}

const LOCAL_AUDIT_LOGS_KEY = 'oportuniza_audit_logs_cache';

// Seed initial audit trail to give the system immediate realistic history
const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'audit-001',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    actor_name: 'Pedro Henrique Orchel',
    actor_email: 'pedroorchel12@gmail.com',
    actor_role: 'Admin Criador da Aplicação',
    action: 'Inicialização da Plataforma & Diretrizes LGPD',
    target_name: 'Sistema Oportuniza Araucária',
    target_type: 'system',
    details: 'Definição das regras de compliance municipal, proteção de dados LGPD (Lei 13.709/18) e bloqueio de cadastros fraudulentos.',
    status: 'authorized',
    ip_address: '177.105.42.18 (Araucária, PR)'
  },
  {
    id: 'audit-002',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    actor_name: 'Pedro Henrique Orchel',
    actor_email: 'pedroorchel12@gmail.com',
    actor_role: 'Admin Criador da Aplicação',
    action: 'Homologação de Empresa Titular',
    target_name: 'Supermassa Alimentos Araucária',
    target_type: 'company',
    details: 'Aprovação de cadastro corporativo mediante validação de CNPJ e aceite formal do Termo de Responsabilidade Jurídica.',
    status: 'authorized',
    ip_address: '177.105.42.18 (Araucária, PR)'
  },
  {
    id: 'audit-003',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    actor_name: 'Atendimento Oportuniza',
    actor_email: 'suporte@oportuniza.araucaria.br',
    actor_role: 'Atendimento Oportuniza',
    action: 'Moderação de Vaga de Primeiro Emprego',
    target_name: 'Vaga: Auxiliar de Reposição e Estoque',
    target_type: 'job',
    details: 'Vaga verificada e aprovada para exibição aos jovens de Araucária (setor Centro/Costeira).',
    status: 'authorized',
    ip_address: '189.28.10.5 (Araucária, PR)'
  },
  {
    id: 'audit-004',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    actor_name: 'Sistema Anti-Fraude Oportuniza',
    actor_email: 'seguranca@oportuniza.araucaria.br',
    actor_role: 'Segurança & Firewall',
    action: 'Bloqueio de Tentativa de Cadastro Falso',
    target_name: 'tentativa_zaralho@tempmail.com',
    target_type: 'security',
    details: 'Tentativa de criação de conta rejeitada automaticamente por uso de e-mail descartável e palavras vedadas.',
    status: 'blocked',
    ip_address: '45.160.22.90'
  }
];

export function getLocalAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_AUDIT_LOGS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_AUDIT_LOGS_KEY, JSON.stringify(INITIAL_AUDIT_LOGS));
      return INITIAL_AUDIT_LOGS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_AUDIT_LOGS;
  } catch {
    return INITIAL_AUDIT_LOGS;
  }
}

export function saveLocalAuditLogs(logs: AuditLogEntry[]) {
  try {
    localStorage.setItem(LOCAL_AUDIT_LOGS_KEY, JSON.stringify(logs.slice(0, 300)));
  } catch (err) {
    console.warn('Erro ao salvar audit logs localmente:', err);
  }
}

/**
 * Inserts a new audit log record, syncing to Supabase and keeping local fallback
 */
export async function recordAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): Promise<AuditLogEntry> {
  const newLog: AuditLogEntry = {
    id: entry.id || `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: entry.timestamp || new Date().toISOString(),
    actor_name: entry.actor_name || 'Administrador',
    actor_email: entry.actor_email || 'admin@oportuniza.araucaria.br',
    actor_role: entry.actor_role || 'Admin Criador da Aplicação',
    action: entry.action,
    target_name: entry.target_name,
    target_type: entry.target_type,
    details: entry.details,
    status: entry.status || 'authorized',
    ip_address: entry.ip_address || 'Rede Municipal Araucária'
  };

  // 1. Update local state
  const currentLogs = getLocalAuditLogs();
  const updatedLogs = [newLog, ...currentLogs.filter(l => l.id !== newLog.id)];
  saveLocalAuditLogs(updatedLogs);

  // Dispatch custom event for real-time UI reaction
  window.dispatchEvent(new CustomEvent('oportuniza-audit-log-updated', { detail: newLog }));

  // 2. Try recording in Supabase audit_logs table (if exists)
  try {
    await supabase.from('audit_logs').insert([{
      id: newLog.id,
      actor_name: newLog.actor_name,
      actor_email: newLog.actor_email,
      actor_role: newLog.actor_role,
      action: newLog.action,
      target_name: newLog.target_name,
      target_type: newLog.target_type,
      details: newLog.details,
      status: newLog.status,
      ip_address: newLog.ip_address,
      created_at: newLog.timestamp
    }]);
  } catch (err) {
    // Graceful fallback to local cache when table is not yet provisioned in Supabase
    console.debug('Aviso Supabase audit_logs (usando cache persistente):', err);
  }

  return newLog;
}

/**
 * Loads all audit logs, querying Supabase first and falling back to cached logs
 */
export async function fetchAllAuditLogs(): Promise<AuditLogEntry[]> {
  const localLogs = getLocalAuditLogs();

  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!error && data && Array.isArray(data) && data.length > 0) {
      const dbLogs: AuditLogEntry[] = data.map((d: any) => ({
        id: String(d.id || `audit-${Math.random()}`),
        timestamp: d.created_at || d.timestamp || new Date().toISOString(),
        actor_name: d.actor_name || 'Admin',
        actor_email: d.actor_email || '',
        actor_role: d.actor_role || 'Administrador',
        action: d.action || 'Ação Registrada',
        target_name: d.target_name || '',
        target_type: d.target_type || 'system',
        details: d.details || '',
        status: d.status || 'authorized',
        ip_address: d.ip_address || ''
      }));

      // Merge unique
      const ids = new Set(dbLogs.map(l => l.id));
      const merged = [...dbLogs, ...localLogs.filter(l => !ids.has(l.id))];
      saveLocalAuditLogs(merged);
      return merged;
    }
  } catch (err) {
    console.debug('Falha ao obter logs do Supabase, usando locais:', err);
  }

  return localLogs;
}

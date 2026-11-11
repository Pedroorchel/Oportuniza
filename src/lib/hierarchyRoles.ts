/**
 * Organizational Hierarchy & Roles for Oportuniza Araucária
 * 
 * Strict 5-tier hierarchy defined by user specification:
 * 1. Admin Criador da Aplicação (Master / Plataforma / Pedro Orchel)
 * 2. Atendimento Oportuniza (Suporte, moderação e atendimento municipal)
 * 3. Empresa (Empresas contratantes titulares com CNPJ)
 * 4. Usuários da Empresa Cadastrados (Recrutadores e membros de RH das empresas)
 * 5. Candidato (Jovens e candidatos em busca de oportunidades)
 */

import { Crown, Headphones, Building2, Users, GraduationCap } from 'lucide-react';

export type HierarchyTierKey = 
  | 'admin_creator' 
  | 'support_service' 
  | 'company_master' 
  | 'company_user' 
  | 'candidate';

export interface HierarchyTier {
  id: HierarchyTierKey;
  level: number; // 1 = highest authority
  title: string;
  shortLabel: string;
  description: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  badgeDot: string;
  iconName: string;
  permissions: string[];
}

export const HIERARCHY_TIERS: Record<HierarchyTierKey, HierarchyTier> = {
  admin_creator: {
    id: 'admin_creator',
    level: 1,
    title: 'Admin Criador da Aplicação',
    shortLabel: 'Admin Criador',
    description: 'Criador e administrador master do Oportuniza Araucária. Autoridade máxima sobre o sistema, banco de dados, permissões e registros de auditoria.',
    badgeBg: 'bg-amber-500/15',
    badgeBorder: 'border-amber-500/40',
    badgeText: 'text-amber-400',
    badgeDot: 'bg-amber-400',
    iconName: 'Crown',
    permissions: [
      'Acesso irrestrito a todos os dados do banco',
      'Gerenciamento de toda a hierarquia e atribuição de cargos',
      'Bloqueio e desbloqueio sumário de contas e e-mails',
      'Auditoria de registros de uso e logs de autorizações',
      'Aprovação e fiscalização de empresas parceiras'
    ]
  },
  support_service: {
    id: 'support_service',
    level: 2,
    title: 'Atendimento Oportuniza',
    shortLabel: 'Atendimento',
    description: 'Equipe de moderação, atendimento ao jovem e suporte institucional de Araucária. Auxilia candidatos e atende dúvidas de empresas.',
    badgeBg: 'bg-sky-500/15',
    badgeBorder: 'border-sky-500/40',
    badgeText: 'text-sky-400',
    badgeDot: 'bg-sky-400',
    iconName: 'Headphones',
    permissions: [
      'Moderação de vagas de empresas antes da publicação',
      'Atendimento e esclarecimento de dúvidas via suporte',
      'Visualização de candidaturas e inscrições em cursos',
      'Emissão de relatórios de empregabilidade municipal'
    ]
  },
  company_master: {
    id: 'company_master',
    level: 3,
    title: 'Empresa',
    shortLabel: 'Empresa',
    description: 'Pessoa jurídica titular cadastrada com CNPJ em Araucária. Responsável legal pelos processos seletivos e aceite dos termos de LGPD.',
    badgeBg: 'bg-indigo-500/15',
    badgeBorder: 'border-indigo-500/40',
    badgeText: 'text-indigo-400',
    badgeDot: 'bg-indigo-400',
    iconName: 'Building2',
    permissions: [
      'Publicação e gestão de vagas de emprego/estágio',
      'Acesso ao painel exclusivo de RH da empresa',
      'Agendamento de entrevistas e contato via WhatsApp',
      'Vinculação de usuários de recrutamento de sua equipe'
    ]
  },
  company_user: {
    id: 'company_user',
    level: 4,
    title: 'Usuários da Empresa Cadastrados',
    shortLabel: 'Recrutador RH',
    description: 'Recrutadores, analistas de RH e membros da equipe cadastrados e autorizados pela empresa titular.',
    badgeBg: 'bg-emerald-500/15',
    badgeBorder: 'border-emerald-500/40',
    badgeText: 'text-emerald-400',
    badgeDot: 'bg-emerald-400',
    iconName: 'Users',
    permissions: [
      'Triagem de currículos de candidatos',
      'Alteração de status do processo seletivo (Entrevista/Aprovado)',
      'Contato direto com candidatos inscritos',
      'Visualização de candidaturas recebidas pela empresa'
    ]
  },
  candidate: {
    id: 'candidate',
    level: 5,
    title: 'Candidato',
    shortLabel: 'Candidato',
    description: 'Jovem munícipe de Araucária em busca do primeiro emprego, estágio, jovem aprendiz e qualificação profissional.',
    badgeBg: 'bg-slate-800',
    badgeBorder: 'border-slate-700',
    badgeText: 'text-slate-300',
    badgeDot: 'bg-slate-400',
    iconName: 'GraduationCap',
    permissions: [
      'Inscrição em vagas de emprego e estágios de Araucária',
      'Matrícula e realização de cursos gratuitos com certificado',
      'Acompanhamento do status de suas candidaturas em tempo real',
      'Criação e edição do currículo profissional'
    ]
  }
};

export const HIERARCHY_LIST: HierarchyTier[] = [
  HIERARCHY_TIERS.admin_creator,
  HIERARCHY_TIERS.support_service,
  HIERARCHY_TIERS.company_master,
  HIERARCHY_TIERS.company_user,
  HIERARCHY_TIERS.candidate
];

/**
 * Resolves a user's role string to a standardized HierarchyTier
 */
export function resolveUserHierarchyTier(user: any): HierarchyTier {
  if (!user) return HIERARCHY_TIERS.candidate;

  const emailLower = String(user.email || '').trim().toLowerCase();
  const roleLower = String(user.role || user.cargo || '').trim().toLowerCase();
  const accountType = String(user.accountType || user.account_type || '').toLowerCase();

  // Tier 1: Admin Criador da Aplicação
  if (
    emailLower === 'oportunizahw@gmail.com' ||
    roleLower.includes('criador') ||
    roleLower.includes('super admin') ||
    roleLower === 'admin criador da aplicação' ||
    roleLower === 'admin criador' ||
    (user.isAdmin && !roleLower.includes('atendimento'))
  ) {
    return HIERARCHY_TIERS.admin_creator;
  }

  // Tier 2: Atendimento Oportuniza (strictly explicit DB/Admin-assigned role or exact official support address)
  const officialSupportEmails = new Set([
    'atendimento@oportuniza.araucaria.br',
    'suporte@oportuniza.araucaria.br',
    'atendimento@oportunizaehw.com.br',
    'suporte@oportunizaehw.com.br'
  ]);
  if (
    roleLower.includes('atendimento') ||
    roleLower.includes('suporte') ||
    roleLower.includes('moderador') ||
    roleLower.includes('atendente') ||
    roleLower === 'atendimento oportuniza' ||
    officialSupportEmails.has(emailLower)
  ) {
    return HIERARCHY_TIERS.support_service;
  }

  // Tier 3: Empresa (Empresa titular com CNPJ)
  if (
    accountType === 'company' ||
    roleLower === 'empresa' ||
    roleLower.includes('empresa titular') ||
    Boolean(user.cnpj && !roleLower.includes('recrutador'))
  ) {
    return HIERARCHY_TIERS.company_master;
  }

  // Tier 4: Usuários da Empresa Cadastrados (Recrutadores / RH)
  if (
    roleLower.includes('recrutador') ||
    roleLower.includes('rh') ||
    roleLower.includes('usuário da empresa') ||
    roleLower.includes('usuario da empresa') ||
    roleLower === 'usuários da empresa cadastrados'
  ) {
    return HIERARCHY_TIERS.company_user;
  }

  // Tier 5: Candidato (default)
  return HIERARCHY_TIERS.candidate;
}

import React, { useState, useEffect } from 'react';
import { 
  Users, Briefcase, GraduationCap, ShieldAlert, LogOut, Plus, Trash2, 
  Edit3, CheckCircle, Clock, XCircle, ChevronRight, FileText, Search,
  TrendingUp, MapPin, DollarSign, BookOpen, Layers, BarChart2, Filter, 
  Calendar, Award, ListFilter, Check, ExternalLink, AlertOctagon, Info, Star, Play,
  Mail, Phone, Smartphone, ClipboardCheck, ArrowUpRight, CheckCircle2, UserCheck,
  Menu, X, Eye, EyeOff, Shield, ShieldCheck, Tag, Sparkles, ChevronDown, UserCog,
  Lock, Unlock, Ban, AlertTriangle, UserX, Building2, Crown, Headphones, History,
  MessageSquare, User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Job, Course, Application, User, Enrollment } from '../types';
import { mockJobs, mockCourses, saveAdminJobs, saveAdminCourses, deleteJobPermanently } from '../data';
import { supabase } from '../lib/supabaseClient';
import { 
  blockUserAccount, 
  unblockUserAccount, 
  isUserRecordBlocked, 
  getLocalBlockedEmails, 
  getLocalBlockedIds,
  getAccountBlockReason 
} from '../lib/blockedAccounts';
import { HIERARCHY_TIERS, HIERARCHY_LIST, resolveUserHierarchyTier, HierarchyTierKey } from '../lib/hierarchyRoles';
import { AuditLogEntry, fetchAllAuditLogs, recordAuditLog } from '../lib/auditLogService';

interface AdminPanelScreenProps {
  user: User;
  onLogout: () => void;
}

export default function AdminPanelScreen({ user, onLogout }: AdminPanelScreenProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'jobs' | 'company_jobs' | 'courses' | 'applications' | 'enrollments' | 'accounts' | 'audit_logs'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Real dynamic in-memory states
  const [jobsList, setJobsList] = useState<Job[]>([]);
  const [coursesList, setCoursesList] = useState<Course[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [enrollmentsList, setEnrollmentsList] = useState<Enrollment[]>([]);
  const [userList, setUserList] = useState<User[]>([]);

  // Audit Logs state ("Quem autorizou isso")
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilterTier, setAuditFilterTier] = useState('Todos');

  // Modal de Exclusão Definitiva de Vaga com confirmação e auditoria
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [isDeletingJob, setIsDeletingJob] = useState(false);

  // Modal de Ficha Cadastral da Empresa (Usuário da empresa, contatos, logo, endereço completo)
  const [companyProfileModal, setCompanyProfileModal] = useState<{
    companyName: string;
    cnpj?: string;
    responsibleName?: string;
    responsibleRole?: string;
    email?: string;
    phone?: string;
    address?: string;
    neighborhood?: string;
    segment?: string;
    logoUrl?: string;
    jobs: Job[];
    acceptedCount: number;
  } | null>(null);

  // Job add/edit modal state
  const [showJobModal, setShowJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [jobForm, setJobForm] = useState({
    title: '',
    company: '',
    category: 'Saúde',
    description: '',
    requirements: '',
    salary: '',
    type: 'CLT',
    isRemote: false,
    location: '',
    lat: '',
    lng: '',
    startDate: '',
    endDate: '',
    workHours: '',
    companyAddress: '',
    companyContactPhone: '',
    companyContactEmail: '',
    companyResponsibleName: '',
    companyResponsibleRole: '',
    companyLogoUrl: ''
  });
  const [auditFilterStatus, setAuditFilterStatus] = useState('Todos');
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Accounts Hierarchy sub-view
  const [accountsViewMode, setAccountsViewMode] = useState<'table' | 'hierarchy'>('table');
  const [selectedHierarchyTierFilter, setSelectedHierarchyTierFilter] = useState<string>('Todos');

  // Company Jobs Tab states
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('Todas');
  const [companyJobsSearch, setCompanyJobsSearch] = useState<string>('');
  
  // Accounts / Roles Management states
  const [usersSearch, setUsersSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('Todos');
  const [editingRoleUser, setEditingRoleUser] = useState<User | null>(null);
  const [selectedRoleInModal, setSelectedRoleInModal] = useState<string>('Estudante');
  const [customRoleInput, setCustomRoleInput] = useState<string>('');
  const [savingRoleUserId, setSavingRoleUserId] = useState<string | null>(null);

  // Quick Block Email Direct Input
  const [quickBlockEmailInput, setQuickBlockEmailInput] = useState('');
  const [isQuickBlocking, setIsQuickBlocking] = useState(false);

  // Block and Delete account states
  const [userToBlockModal, setUserToBlockModal] = useState<User | null>(null);
  const [blockReasonInput, setBlockReasonInput] = useState<string>('Violação das diretrizes da comunidade');
  const [userToDeleteModal, setUserToDeleteModal] = useState<User | null>(null);
  const [isProcessingActionId, setIsProcessingActionId] = useState<string | null>(null);
  
  // Category selections
  const [selectedJobCategory, setSelectedJobCategory] = useState<string>('Todos');
  const [selectedCourseCategory, setSelectedCourseCategory] = useState<string>('Todos');

  // Loading/feedback indicators
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search queries
  const [jobsSearch, setJobsSearch] = useState('');
  const [coursesSearch, setCoursesSearch] = useState('');
  const [appSearch, setAppSearch] = useState('');

  // Spotlights and inline previews
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [previewingCourseLessons, setPreviewingCourseLessons] = useState<Course | null>(null);



  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState({
    title: '',
    desc: '',
    category: 'Sistemas',
    duration: '',
    instructor: '',
    rating: '5.0',
    level: 'Iniciante',
    coverImage: '',
    lessonsInput: '',
    active: true
  });

  // Load initial jobs/courses from mock files or localStorage
  useEffect(() => {
    setJobsList([...mockJobs]);
    setCoursesList([...mockCourses]);

    // Also listen to events in case live fetch finishes after admin mounts
    const handleJobsChanged = () => setJobsList([...mockJobs]);
    const handleCoursesChanged = () => setCoursesList([...mockCourses]);

    window.addEventListener('oportuniza-jobs-changed', handleJobsChanged);
    window.addEventListener('oportuniza-courses-changed', handleCoursesChanged);

    return () => {
      window.removeEventListener('oportuniza-jobs-changed', handleJobsChanged);
      window.removeEventListener('oportuniza-courses-changed', handleCoursesChanged);
    };
  }, []);

  // Fetch all applications across all users from Supabase for real administration
  const fetchAllApplications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('applications')
        .select('*');

      if (error) {
        console.error('Error fetching applications from supabase:', error);
        throw error;
      }
      if (data && Array.isArray(data)) {
        const mapped: Application[] = data.map(item => {
          let cName = String(item.candidate_name || (item.user_id ? String(item.user_id).substring(0, 8) : '') || 'Candidato');
          let cEmail = item.candidate_email ? String(item.candidate_email) : '';
          let cPhone = item.candidate_phone ? String(item.candidate_phone) : '';
          if (typeof cName === 'string' && cName.includes('|')) {
            const parts = cName.split('|');
            cName = parts[0].trim();
            if (parts.length > 1 && !cEmail) cEmail = parts[1].trim();
            if (parts.length > 2 && !cPhone) cPhone = parts[2].trim();
          }

          return {
            id: String(item.id ?? `app-${Math.random()}`),
            jobId: String(item.job_id || ''),
            jobTitle: String(item.job_title || 'Vaga'),
            company: String(item.company || 'Empresa'),
            appliedDate: String(item.created_at || item.applied_date || new Date().toISOString()),
            status: item.status || 'Em análise',
            candidateName: cName,
            cvLink: item.cv_link ? String(item.cv_link) : undefined,
            cvFileName: item.cv_file_name ? String(item.cv_file_name) : undefined,
            candidateEmail: cEmail || undefined,
            candidatePhone: cPhone || undefined
          };
        });
        setApplications(mapped);
      }
    } catch (err: any) {
      console.error('Error fetching applications:', err);
      setErrorMsg('Erro ao sincronizar candidaturas do banco em tempo real.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllEnrollments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('enrollments')
        .select('*');

      if (error) throw error;
      if (data && Array.isArray(data)) {
        const mapped: Enrollment[] = data.map(item => ({
          id: String(item.id ?? `enr-${Math.random()}`),
          courseId: String(item.course_id || ''),
          courseTitle: String(item.course_title || 'Curso'),
          instructor: String(item.instructor || 'Instrutor'),
          enrolledDate: String(item.enrolled_date || item.created_at || ''),
          status: item.status || 'Em andamento',
          progress: Number(item.progress) || 0,
          userName: String(item.user_name || (item.user_id ? String(item.user_id).substring(0, 8) : '') || 'Aluno')
        }));
        setEnrollmentsList(mapped);
      }
    } catch (err: any) {
      console.error('Error fetching enrollments:', err);
      setErrorMsg('Erro ao buscar inscrições de cursos.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*');
      
      if (error) {
        console.error('Supabase error fetching users:', error);
        setErrorMsg(`Erro Supabase: ${error.message} - ${error.details || ''}`);
        throw error;
      }
      console.log('Fetched users raw data:', data);
      if (data && Array.isArray(data)) {
        const localEmails = getLocalBlockedEmails();
        const localIds = getLocalBlockedIds();

        const usersWithAdmin = (data as any[]).map(u => {
          const emailLower = String(u.email || '').trim().toLowerCase();
          const idStr = String(u.id || '').trim();
          const isAdm = Boolean(
            u.is_admin || 
            u.isAdmin || 
            u.role === 'Administrador' || 
            u.cargo === 'Administrador' || 
            emailLower === 'pedroorchel12@gmail.com'
          );
          const isBlocked = Boolean(
            isUserRecordBlocked(u) ||
            (emailLower && localEmails.includes(emailLower)) ||
            (idStr && localIds.includes(idStr))
          );
          const userRole = isBlocked ? 'BLOQUEADO' : String(u.role || u.cargo || (isAdm ? 'Administrador' : 'Estudante'));
          
          let resolvedReason = u.block_reason || u.blockReason || '';
          if (!resolvedReason && typeof u.bio === 'string' && u.bio.includes('[[ACCOUNT_BLOCKED]]:')) {
            resolvedReason = u.bio.replace('[[ACCOUNT_BLOCKED]]:', '').trim();
          }
          if (!resolvedReason && isBlocked) {
            resolvedReason = getAccountBlockReason({ id: idStr, email: emailLower });
          }

          return {
            ...u,
            id: idStr,
            name: String(u.name || u.email || 'Usuário'),
            email: String(u.email || ''),
            isAdmin: isAdm && !isBlocked,
            isBlocked: isBlocked,
            blockReason: isBlocked ? resolvedReason : undefined,
            status: isBlocked ? 'blocked' : (u.status || 'active'),
            role: userRole,
            cargo: userRole
          };
        });
        setUserList(usersWithAdmin as User[]);
        if (usersWithAdmin.length === 0) {
          setSuccessMsg("Nenhum usuário encontrado na base de dados.");
        }
      } else {
        setSuccessMsg("Nenhum dado retornado.");
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setErrorMsg(`Erro ao buscar usuários: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlockUser = async (targetUser: User, shouldBlock: boolean, customReason?: string) => {
    if (!targetUser) return;
    const targetId = targetUser.id || targetUser.email;
    setIsProcessingActionId(targetId);

    const reasonToUse = customReason !== undefined 
      ? customReason 
      : (blockReasonInput.trim() || 'Violação das diretrizes da comunidade');

    // Optimistic local state update
    setUserList(prev => prev.map(u => {
      const idMatch = u.id && targetUser.id && u.id === targetUser.id;
      const emailMatch = u.email && targetUser.email && u.email.toLowerCase() === targetUser.email.toLowerCase();
      if (idMatch || emailMatch) {
        return {
          ...u,
          isBlocked: shouldBlock,
          blockReason: shouldBlock ? reasonToUse : undefined,
          status: shouldBlock ? 'blocked' : 'active',
          role: shouldBlock ? 'BLOQUEADO' : (u.role === 'BLOQUEADO' ? 'Estudante' : u.role),
          cargo: shouldBlock ? 'BLOQUEADO' : (u.cargo === 'BLOQUEADO' ? 'Estudante' : u.cargo)
        };
      }
      return u;
    }));

    try {
      if (shouldBlock) {
        await blockUserAccount(targetUser.id, targetUser.email, targetUser.name, reasonToUse);
      } else {
        await unblockUserAccount(targetUser.id, targetUser.email);
      }

      await recordAuditLog({
        actor_name: user.name || 'Admin Criador',
        actor_email: user.email || 'admin@oportuniza.araucaria.br',
        actor_role: user.role || 'Admin Criador da Aplicação',
        action: shouldBlock ? 'Bloqueio de Conta & Revogação' : 'Desbloqueio de Conta & Reativação',
        target_name: `${targetUser.name} (${targetUser.email})`,
        target_type: 'security',
        details: shouldBlock ? `Conta bloqueada pelo administrador. Motivo informado: "${reasonToUse}".` : 'Conta reativada pela administração.',
        status: shouldBlock ? 'blocked' : 'authorized'
      });

      setSuccessMsg(
        shouldBlock 
          ? `Conta de ${targetUser.name} (${targetUser.email}) foi bloqueada com sucesso! Motivo registrado: "${reasonToUse}".`
          : `Conta de ${targetUser.name} foi desbloqueada com sucesso!`
      );
      setTimeout(() => setSuccessMsg(null), 5000);
      setUserToBlockModal(null);
      await fetchAllUsers();
    } catch (err: any) {
      console.error('Error updating blocked status:', err);
      setErrorMsg(`Erro ao alterar status de bloqueio: ${err.message || 'Erro de conexão'}`);
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setIsProcessingActionId(null);
    }
  };

  const handleQuickBlockEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = quickBlockEmailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Digite um e-mail válido para bloquear.');
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    if (cleanEmail === 'pedroorchel12@gmail.com') {
      setErrorMsg('Não é permitido bloquear a conta do Administrador Principal.');
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    setIsQuickBlocking(true);
    try {
      await blockUserAccount(undefined, cleanEmail, cleanEmail.split('@')[0], 'Bloqueio rápido direto pelo Administrador');
      setSuccessMsg(`O e-mail "${cleanEmail}" foi bloqueado e banido com sucesso da plataforma.`);
      setQuickBlockEmailInput('');
      setTimeout(() => setSuccessMsg(null), 5000);
      await fetchAllUsers();
    } catch (err: any) {
      setErrorMsg(`Erro ao bloquear e-mail: ${err.message || 'Erro desconhecido'}`);
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setIsQuickBlocking(false);
    }
  };

  const handleDeleteUser = async (targetUser: User) => {
    if (!targetUser) return;
    const targetId = targetUser.id || targetUser.email;
    setIsProcessingActionId(targetId);

    // Optimistic local removal
    setUserList(prev => prev.filter(u => u.id !== targetUser.id && u.email !== targetUser.email));

    try {
      if (targetUser.id) {
        // Cascade remove applications if any
        try {
          await supabase.from('applications').delete().eq('user_id', targetUser.id);
        } catch (e) {
          console.warn('Cascade delete applications notice:', e);
        }

        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', targetUser.id);

        if (error) {
          console.warn('Notice deleting user record:', error);
        }
      }

      setSuccessMsg(`Conta de ${targetUser.name} (${targetUser.email}) foi excluída permanentemente.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setUserToDeleteModal(null);
    } catch (err: any) {
      console.error('Error deleting user:', err);
      setErrorMsg(`Erro ao excluir conta: ${err.message || 'Erro de conexão'}`);
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setIsProcessingActionId(null);
    }
  };

  const handleSaveUserRole = async (targetUser: User, newRole: string) => {
    if (!targetUser) return;
    const finalRole = newRole.trim() || 'Estudante';
    const isAdm = finalRole === 'Administrador' || targetUser.email === 'pedroorchel12@gmail.com';
    const targetId = targetUser.id || 'target-user';
    setSavingRoleUserId(targetId);

    // Optimistic local state update
    setUserList(prev => prev.map(u => {
      if (u.id === targetUser.id || (u.email && u.email === targetUser.email)) {
        return {
          ...u,
          role: finalRole,
          cargo: finalRole,
          isAdmin: isAdm
        };
      }
      return u;
    }));

    try {
      if (targetUser.id) {
        // Attempt update with role, cargo, is_admin
        const { error } = await supabase
          .from('users')
          .update({
            role: finalRole,
            cargo: finalRole,
            is_admin: isAdm,
            updated_at: new Date().toISOString()
          })
          .eq('id', targetUser.id);

        if (error) {
          console.warn('Fallback update for is_admin if role/cargo column is restricted:', error);
          await supabase
            .from('users')
            .update({
              is_admin: isAdm,
              updated_at: new Date().toISOString()
            })
            .eq('id', targetUser.id);
        }
      }

      await recordAuditLog({
        actor_name: user.name || 'Admin Criador',
        actor_email: user.email || 'admin@oportuniza.araucaria.br',
        actor_role: user.role || 'Admin Criador da Aplicação',
        action: 'Alteração de Nível Hierárquico',
        target_name: `${targetUser.name} (${targetUser.email})`,
        target_type: 'role',
        details: `Cargo/Nível alterado para "${finalRole}" (Privilégio Admin: ${isAdm ? 'Ativo' : 'Inativo'}). Autorizado no painel de controle.`,
        status: 'authorized'
      });

      setSuccessMsg(`Cargo de ${targetUser.name} definido para "${finalRole}" e salvo com sucesso!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setEditingRoleUser(null);
    } catch (err: any) {
      console.error('Error saving user role in database:', err);
      setErrorMsg(`Erro ao salvar cargo: ${err.message || 'Erro de conexão'}`);
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setSavingRoleUserId(null);
    }
  };

  const handleOpenEditRoleModal = (targetUser: User) => {
    setEditingRoleUser(targetUser);
    const currRole = targetUser.role || targetUser.cargo || (targetUser.isAdmin ? 'Administrador' : 'Estudante');
    setSelectedRoleInModal(currRole);
    if (!['Administrador', 'Recrutador / Empresa', 'Instrutor / Professor', 'Moderador', 'Estudante / Candidato', 'Estudante'].includes(currRole)) {
      setCustomRoleInput(currRole);
    } else {
      setCustomRoleInput('');
    }
  };

  const getRoleBadgeStyle = (roleName?: string, isAdm?: boolean) => {
    const r = (roleName || (isAdm ? 'Admin Criador da Aplicação' : 'Candidato')).toLowerCase();

    // 1. Admin Criador da Aplicação
    if (r.includes('criador') || r.includes('super admin') || (r.includes('admin') && !r.includes('atendimento')) || isAdm) {
      return {
        bg: 'bg-amber-500/15 border border-amber-500/40 text-amber-300',
        dot: 'bg-amber-400',
        label: '👑 Admin Criador',
        fullLabel: 'Admin Criador da Aplicação',
        tierLevel: 1,
        icon: Crown
      };
    }

    // 2. Atendimento Oportuniza
    if (r.includes('atendimento') || r.includes('suporte') || r.includes('moderador')) {
      return {
        bg: 'bg-sky-500/15 border border-sky-500/40 text-sky-300',
        dot: 'bg-sky-400',
        label: '🎧 Atendimento',
        fullLabel: 'Atendimento Oportuniza',
        tierLevel: 2,
        icon: Headphones
      };
    }

    // 3. Empresa (Titular com CNPJ)
    if (r === 'empresa' || r.includes('empresa titular') || r.includes('pj')) {
      return {
        bg: 'bg-indigo-500/15 border border-indigo-500/40 text-indigo-300',
        dot: 'bg-indigo-400',
        label: '🏢 Empresa',
        fullLabel: 'Empresa',
        tierLevel: 3,
        icon: Building2
      };
    }

    // 4. Usuários da Empresa Cadastrados (Recrutadores / RH)
    if (r.includes('recrutador') || r.includes('rh') || r.includes('usuário da empresa') || r.includes('usuario da empresa')) {
      return {
        bg: 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300',
        dot: 'bg-emerald-400',
        label: '👥 Recrutador RH',
        fullLabel: 'Usuários da Empresa Cadastrados',
        tierLevel: 4,
        icon: Users
      };
    }

    // 5. Candidato (Padrão)
    return {
      bg: 'bg-slate-800/80 border border-slate-700/80 text-slate-300',
      dot: 'bg-slate-400',
      label: '🎓 Candidato',
      fullLabel: 'Candidato',
      tierLevel: 5,
      icon: GraduationCap
    };
  };

  // Fetch all jobs directly from Supabase for real-time synchronization
  const fetchAllJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*');

      if (!error && data && Array.isArray(data) && data.length > 0) {
        const dbJobs: Job[] = data.map((item: any) => ({
          id: String(item.id ?? `job-${Math.random()}`),
          title: String(item.title || 'Vaga'),
          company: String(item.company || item.company_name || 'Empresa Cadastrada'),
          category: String(item.category || 'Geral'),
          description: String(item.description || ''),
          requirements: Array.isArray(item.requirements) ? item.requirements : (typeof item.requirements === 'string' ? item.requirements.split('\n') : ['Ensino Médio']),
          salary: String(item.salary || 'A combinar'),
          type: String(item.type || 'CLT'),
          isRemote: Boolean(item.is_remote || item.isRemote),
          location: String(item.location || 'Araucária - PR'),
          lat: item.lat ? Number(item.lat) : undefined,
          lng: item.lng ? Number(item.lng) : undefined,
          logo: item.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.company || 'Empresa')}&background=52A8C7&color=fff&size=128&bold=true`,
          dateString: String(item.dateString || item.posted_date || 'Recente'),
          color: item.color || 'border-l-[#52A8C7]',
          startDate: item.startDate || item.start_date || undefined,
          endDate: item.endDate || item.end_date || undefined,
          workHours: item.workHours || item.work_hours || undefined,
          companyAddress: item.companyAddress || item.company_address || undefined,
          companyNeighborhood: item.companyNeighborhood || item.company_neighborhood || undefined,
          companyContactPhone: item.companyContactPhone || item.company_contact_phone || undefined,
          companyContactEmail: item.companyContactEmail || item.company_contact_email || undefined,
          companyResponsibleName: item.companyResponsibleName || item.company_responsible_name || undefined,
          companyResponsibleRole: item.companyResponsibleRole || item.company_responsible_role || undefined,
          companyLogoUrl: item.companyLogoUrl || item.company_logo_url || item.logo || undefined,
          cnpj: item.cnpj || undefined,
          approvalStatus: item.approvalStatus || item.approval_status || 'accepted',
          approvedBy: item.approvedBy || item.approved_by || undefined,
          approvedAt: item.approvedAt || item.approved_at || undefined,
          acceptedCandidatesCount: Number(item.acceptedCandidatesCount || item.accepted_candidates_count || 0)
        }));

        const dbIds = new Set(dbJobs.map(j => j.id));
        const filteredMock = mockJobs.filter(m => !dbIds.has(m.id));
        const merged = [...dbJobs, ...filteredMock];
        setJobsList(merged);
      }
    } catch (err) {
      console.warn('Error fetching jobs for admin:', err);
    }
  };

  // Group jobs by company for "Vagas por Empresas" view
  const companyJobsStats = React.useMemo(() => {
    const map: Record<string, { companyName: string; count: number; jobs: Job[]; logo?: string; lastDate: string }> = {};
    
    jobsList.forEach(job => {
      const cName = (job.company || 'Empresa').trim();
      if (!map[cName]) {
        map[cName] = {
          companyName: cName,
          count: 0,
          jobs: [],
          logo: job.logo,
          lastDate: job.dateString || 'Recente'
        };
      }
      map[cName].count += 1;
      map[cName].jobs.push(job);
    });

    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [jobsList]);

  useEffect(() => {
    fetchAllApplications();
    fetchAllEnrollments();
    fetchAllUsers();
    fetchAllJobs();
    loadAuditLogs();
    
    const appsChannel = supabase
      .channel('public:applications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => {
        fetchAllApplications();
      })
      .subscribe();

    const jobsChannel = supabase
      .channel('public:jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        fetchAllJobs();
      })
      .subscribe();

    const handleAuditUpdated = () => {
      loadAuditLogs();
    };
    window.addEventListener('oportuniza-audit-log-updated', handleAuditUpdated);

    return () => {
      supabase.removeChannel(appsChannel);
      supabase.removeChannel(jobsChannel);
      window.removeEventListener('oportuniza-audit-log-updated', handleAuditUpdated);
    };
  }, []);

  const loadAuditLogs = async () => {
    try {
      setLoadingAudit(true);
      const logs = await fetchAllAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.warn('Erro ao carregar logs de auditoria:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Update application status directly in Supabase
  const handleUpdateAppStatus = async (appId: string, nextStatus: 'Em análise' | 'Entrevista' | 'Aprovado' | 'Reprovado') => {
    try {
      setErrorMsg(null);
      setSuccessMsg(null);
      const { error } = await supabase
        .from('applications')
        .update({ status: nextStatus })
        .eq('id', appId);

      if (error) throw error;
      
      setSuccessMsg(`Status atualizado com sucesso para "${nextStatus}"!`);
      
      // Update local state and the selected spotlight if applicable
      setApplications(prev => prev.map(app => app.id === appId ? { ...app, status: nextStatus } : app));
      if (selectedApplication && selectedApplication.id === appId) {
        setSelectedApplication(prev => prev ? { ...prev, status: nextStatus } : null);
      }
      
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg('Falha ao atualizar status na nuvem.');
    }
  };

  // JOB CRUD Handlers
  const handleOpenAddJobParams = () => {
    setEditingJob(null);
    const today = new Date().toISOString().split('T')[0];
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    setJobForm({
      title: '',
      company: '',
      category: 'Saúde',
      description: 'Responsável pelas funções de suporte ao setor do estabelecimento municipal, assegurando pontualidade e dedicação.',
      requirements: 'Ensino médio completo\nResidir em Araucária ou região metropolitana\nBoa comunicação interpessoal\nDisponibilidade de horários flexíveis',
      salary: 'R$ 1.800,00',
      type: 'CLT',
      isRemote: false,
      location: 'Araucária - Centro',
      lat: '-25.5920',
      lng: '-49.4140',
      startDate: today,
      endDate: in30Days.toISOString().split('T')[0],
      workHours: '08:00 às 17:00 (Segunda a Sexta)',
      companyAddress: 'Centro, Araucária - PR',
      companyContactPhone: '(41) 99650-2358',
      companyContactEmail: 'contato@empresa.com.br',
      companyResponsibleName: 'Recrutador Oportuniza',
      companyResponsibleRole: 'Gestor de Recursos Humanos',
      companyLogoUrl: ''
    });
    setShowJobModal(true);
  };

  const handleOpenEditJob = (job: Job) => {
    setEditingJob(job);
    const today = new Date().toISOString().split('T')[0];
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    setJobForm({
      title: job.title,
      company: job.company,
      category: job.category,
      description: job.description,
      requirements: Array.isArray(job.requirements) ? job.requirements.join('\n') : String(job.requirements || ''),
      salary: job.salary,
      type: job.type,
      isRemote: job.isRemote,
      location: job.location,
      lat: job.lat?.toString() || '',
      lng: job.lng?.toString() || '',
      startDate: job.startDate || today,
      endDate: job.endDate || in30Days.toISOString().split('T')[0],
      workHours: job.workHours || '08:00 às 17:00 (Segunda a Sexta)',
      companyAddress: job.companyAddress || job.location,
      companyContactPhone: job.companyContactPhone || '',
      companyContactEmail: job.companyContactEmail || '',
      companyResponsibleName: job.companyResponsibleName || '',
      companyResponsibleRole: job.companyResponsibleRole || '',
      companyLogoUrl: job.companyLogoUrl || job.logo || ''
    });
    setShowJobModal(true);
  };

  // Abrir modal de exclusão para qualquer vaga
  const handleDeleteJob = (jobOrId: Job | string) => {
    if (typeof jobOrId === 'string') {
      const found = jobsList.find(j => j.id === jobOrId);
      if (found) {
        setJobToDelete(found);
      } else {
        setJobToDelete({
          id: jobOrId,
          title: 'Vaga Selecionada',
          company: 'Empresa',
          category: 'Geral',
          description: '',
          requirements: [],
          salary: '',
          type: 'CLT',
          isRemote: false,
          location: 'Araucária',
          logo: '',
          dateString: 'Hoje'
        });
      }
    } else {
      setJobToDelete(jobOrId);
    }
  };

  // Execução definitiva da exclusão no banco e auditoria
  const handleConfirmDeleteJob = async () => {
    if (!jobToDelete) return;
    setIsDeletingJob(true);
    try {
      await deleteJobPermanently(jobToDelete.id);
      const filtered = jobsList.filter(j => j.id !== jobToDelete.id);
      setJobsList(filtered);

      await recordAuditLog({
        actor_name: user.name || 'Admin Criador',
        actor_email: user.email || 'admin@oportuniza.araucaria.br',
        actor_role: user.role || 'Admin Criador da Aplicação',
        action: 'Exclusão Definitiva de Vaga',
        target_name: `${jobToDelete.title} (${jobToDelete.company})`,
        target_type: 'job',
        details: `Vaga ID "${jobToDelete.id}" excluída definitivamente da base de dados e do mural de Araucária por ${user.name}.`,
        status: 'authorized'
      });

      setSuccessMsg(`Vaga "${jobToDelete.title}" da empresa "${jobToDelete.company}" excluída com sucesso!`);
      setJobToDelete(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Erro ao excluir vaga:', err);
      setErrorMsg(`Erro ao excluir vaga: ${err.message || 'Erro desconhecido'}`);
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setIsDeletingJob(false);
    }
  };

  // Homologar e Aceitar vaga cadastrada por empresa
  const handleApproveCompanyJob = async (job: Job) => {
    try {
      const updatedList = jobsList.map(j => {
        if (j.id === job.id) {
          return {
            ...j,
            approvalStatus: 'accepted' as const,
            approvedBy: user.name || 'Admin Criador',
            approvedAt: new Date().toISOString()
          };
        }
        return j;
      });

      setJobsList(updatedList);
      await saveAdminJobs(updatedList);

      await recordAuditLog({
        actor_name: user.name || 'Admin Criador',
        actor_email: user.email || 'admin@oportuniza.araucaria.br',
        actor_role: user.role || 'Admin Criador da Aplicação',
        action: 'Homologação e Aceite de Vaga',
        target_name: `${job.title} (${job.company})`,
        target_type: 'job',
        details: `Vaga homologada e autorizada pelo Painel ADM por ${user.name} para exibição aos candidatos de Araucária.`,
        status: 'authorized'
      });

      setSuccessMsg(`Vaga "${job.title}" da empresa "${job.company}" foi aceita e homologada com sucesso!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(`Erro ao aprovar vaga: ${err.message || 'Erro desconhecido'}`);
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // Abrir Ficha Cadastral da Empresa (Usuário da empresa, perfil, contatos, logo e endereço)
  const handleOpenCompanyProfileModal = (companyName: string) => {
    const cleanComp = (companyName || '').trim().toLowerCase();
    const matchedUser = userList.find(u => 
      (u.companyName && u.companyName.trim().toLowerCase() === cleanComp) ||
      (u.name && u.name.trim().toLowerCase() === cleanComp)
    );
    const compJobs = jobsList.filter(j => (j.company || '').trim().toLowerCase() === cleanComp);
    const sampleJob = compJobs[0];

    const acceptedCount = applications.filter(a => 
      (a.company && a.company.trim().toLowerCase() === cleanComp) && a.status === 'Aprovado'
    ).length;

    setCompanyProfileModal({
      companyName: companyName,
      cnpj: matchedUser?.cnpj || sampleJob?.cnpj || '12.345.678/0001-90',
      responsibleName: matchedUser?.responsibleName || matchedUser?.name || sampleJob?.companyResponsibleName || 'Gestor de RH',
      responsibleRole: matchedUser?.responsibleRole || sampleJob?.companyResponsibleRole || 'Responsável pelo Recrutamento',
      email: matchedUser?.email || sampleJob?.companyContactEmail || 'rh@empresa.com.br',
      phone: matchedUser?.phone || sampleJob?.companyContactPhone || '(41) 99650-2358',
      address: matchedUser?.companyAddress || sampleJob?.companyAddress || 'Av. Dr. Victor do Amaral, Centro - Araucária, PR',
      neighborhood: matchedUser?.companyNeighborhood || sampleJob?.companyNeighborhood || 'Centro',
      segment: matchedUser?.companySegment || 'Comércio & Serviços',
      logoUrl: matchedUser?.companyLogoUrl || matchedUser?.avatarUrl || sampleJob?.logo,
      jobs: compJobs,
      acceptedCount
    });
  };

  const handleSaveJobSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobForm.title || !jobForm.company) {
      alert('Por favor, preencha o título e a empresa.');
      return;
    }

    if (!jobForm.startDate || !jobForm.endDate) {
      alert('Por favor, preencha a Data de Início e a Data Final das inscrições da vaga.');
      return;
    }

    const jobData: Job = {
      id: editingJob ? editingJob.id : `job-${Date.now()}`,
      title: jobForm.title,
      company: jobForm.company,
      category: jobForm.category,
      description: jobForm.description,
      requirements: (jobForm.requirements || '').split('\n').filter(r => r.trim() !== ''),
      salary: jobForm.salary,
      type: jobForm.type,
      isRemote: jobForm.isRemote,
      location: jobForm.location,
      lat: jobForm.lat ? parseFloat(jobForm.lat) : undefined,
      lng: jobForm.lng ? parseFloat(jobForm.lng) : undefined,
      logo: jobForm.companyLogoUrl || (editingJob ? editingJob.logo : `https://ui-avatars.com/api/?name=${encodeURIComponent(jobForm.company)}&background=52A8C7&color=fff&size=128&bold=true`),
      dateString: editingJob ? editingJob.dateString : 'Hoje',
      color: 'border-l-[#52A8C7]',
      startDate: jobForm.startDate,
      endDate: jobForm.endDate,
      workHours: jobForm.workHours,
      companyAddress: jobForm.companyAddress,
      companyContactPhone: jobForm.companyContactPhone,
      companyContactEmail: jobForm.companyContactEmail,
      companyResponsibleName: jobForm.companyResponsibleName,
      companyResponsibleRole: jobForm.companyResponsibleRole,
      companyLogoUrl: jobForm.companyLogoUrl,
      approvalStatus: editingJob?.approvalStatus || 'accepted',
      approvedBy: editingJob?.approvedBy || user.name || 'Admin Criador',
      approvedAt: editingJob?.approvedAt || new Date().toISOString()
    };

    let updatedList: Job[];
    if (editingJob) {
      updatedList = jobsList.map(j => j.id === editingJob.id ? jobData : j);
      setSuccessMsg('Vaga atualizada com sucesso!');
    } else {
      updatedList = [jobData, ...jobsList];
      setSuccessMsg('Nova vaga com datas de início e término cadastrada com sucesso!');
    }

    setJobsList(updatedList);
    saveAdminJobs(updatedList);
    setShowJobModal(false);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // COURSE CRUD Handlers
  const handleOpenAddCourseParams = () => {
    setEditingCourse(null);
    setCourseForm({
      title: '',
      desc: '',
      category: 'Atendimento',
      duration: '4 horas',
      instructor: 'Instrutor Oportuniza',
      rating: '5.0',
      level: 'Iniciante',
      coverImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80',
      lessonsInput: 'Boas-vindas ao Curso;10:00;I2taMQ3j6qo\nFundamentos Teóricos;15:30;OHM4CJbea54\nAtendimento e Prática Assistencial;25:00;I2taMQ3j6qo',
      active: true
    });
    setShowCourseModal(true);
  };

  const handleOpenEditCourse = (course: Course) => {
    setEditingCourse(course);
    const lessonsStr = course.lessons.map(l => `${l.title};${l.duration};${l.youtubeId || 'I2taMQ3j6qo'}`).join('\n');
    setCourseForm({
      title: course.title,
      desc: course.desc,
      category: course.category,
      duration: course.duration,
      instructor: course.instructor,
      rating: course.rating.toString(),
      level: course.level,
      coverImage: course.coverImage || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80',
      lessonsInput: lessonsStr,
      active: course.active !== false
    });
    setShowCourseModal(true);
  };

  const handleDeleteCourse = (id: string) => {
    const course = coursesList.find(c => c.id === id);
    if (!course) return;
    const isCurrentlyActive = course.active !== false;
    
    if (isCurrentlyActive) {
      if (window.confirm(`Deseja desativar o curso de capacitação "${course.title}"? Ele ficará oculto para os alunos.`)) {
        handleToggleCourseActive(id);
      }
    } else {
      handleToggleCourseActive(id);
    }
  };

  const handleToggleCourseActive = (id: string) => {
    const updatedList = coursesList.map(c => {
      if (c.id === id) {
        const isCurrentlyActive = c.active !== false;
        return { ...c, active: !isCurrentlyActive };
      }
      return c;
    });
    setCoursesList(updatedList);
    saveAdminCourses(updatedList);
    const targetCourse = updatedList.find(c => c.id === id);
    const statusMsg = targetCourse?.active !== false ? 'ativado' : 'desativado';
    setSuccessMsg(`Curso "${targetCourse?.title}" ${statusMsg} com sucesso!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSaveCourseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseForm.title) {
      alert('Por favor, insira um título para o curso.');
      return;
    }

    // Parse lessons
    const parsedLessons = (courseForm.lessonsInput || '').split('\n').filter(line => line.trim() !== '').map(line => {
      const parts = line.split(';');
      return {
        title: parts[0] || 'Aula Teórica',
        duration: parts[1] || '10:00',
        done: false,
        youtubeId: parts[2] || 'I2taMQ3j6qo'
      };
    });

    const courseData: Course = {
      id: editingCourse ? editingCourse.id : `course-${Date.now()}`,
      title: courseForm.title,
      desc: courseForm.desc,
      category: courseForm.category,
      duration: courseForm.duration,
      instructor: courseForm.instructor,
      rating: parseFloat(courseForm.rating) || 5.0,
      level: courseForm.level,
      logo: 'BookOpen',
      coverImage: courseForm.coverImage || `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80`,
      lessons: parsedLessons,
      completed: false,
      active: courseForm.active
    };

    let updatedList: Course[];
    if (editingCourse) {
      updatedList = coursesList.map(c => c.id === editingCourse.id ? courseData : c);
      setSuccessMsg('Curso de capacitação atualizado com sucesso!');
    } else {
      updatedList = [courseData, ...coursesList];
      setSuccessMsg('Novo curso adicionado com sucesso!');
    }

    setCoursesList(updatedList);
    saveAdminCourses(updatedList);
    setShowCourseModal(false);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // Metrics calculators
  const approvedCount = applications.filter(a => a.status === 'Aprovado').length;
  const analysisCount = applications.filter(a => a.status === 'Em análise').length;
  const interviewCount = applications.filter(a => a.status === 'Entrevista').length;
  const rejectedCount = applications.filter(a => a.status === 'Reprovado').length;

  // Job specific metrics
  const cltCount = jobsList.filter(j => j.type === 'CLT' || j.type === 'Jovem Aprendiz').length;
  const internshipCount = jobsList.filter(j => j.type === 'Estágio').length;
  const remoteJobsCount = jobsList.filter(j => j.isRemote).length;

  // Helper date string
  const getFormattedDate = () => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('pt-BR', options);
  };

  // Safe date formatter for Brasília time
  const formatBrasiliaTime = (dateString?: string | null) => {
    try {
      if (!dateString) return 'Data não informada';
      const str = String(dateString);
      // Check if it's already in DD/MM/YYYY format and missing timestamp (legacy)
      if (str.includes('/') && str.length <= 10) {
        return str;
      }
      // If it's the recent ISO format or standard date
      const d = new Date(str);
      if (isNaN(d.getTime())) return str;
      return d.toLocaleString('pt-BR', { 
        timeZone: 'America/Sao_Paulo',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return String(dateString || '');
    }
  };

  // Get WhatsApp redirect link
  const getCandidateWhatsAppLink = (candidateName: string, jobTitle: string, candidatePhone?: string) => {
    const defaultPhone = '5541996502358';
    let p = candidatePhone ? String(candidatePhone).replace(/\D/g, '') : defaultPhone;
    if (candidatePhone && p.length >= 10 && p.length <= 11) p = '55' + p;
    const textMsg = `Olá, ${candidateName || 'Candidato'}! Aqui é do setor administrativo da Oportuniza Araucária. Entramos em contato para conversar sobre a sua candidatura para a vaga de *${jobTitle || 'Vaga'}*.`;
    return `https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(textMsg)}`;
  };

  // Categorization collections
  const jobCategories = ['Todos', 'Saúde', 'Administração', 'Serviços Gerais', 'Alimentação', 'Comércio', 'Logística', 'Indústria', 'Estágios', 'Produtividade'];
  const courseCategories = ['Todos', 'Produtividade', 'Sistemas', 'Atendimento', 'Comércio', 'Saúde'];

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-[#52A8C7] selection:text-white">
      
      {/* 1. Header component - Pristine dashboard frame */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 sticky top-0 py-3 md:py-4.5 px-4 md:px-6 flex justify-between items-center z-40 shrink-0">
        <div className="flex items-center gap-3 md:gap-4">
          {/* Mobile hamburger menu button */}
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2 bg-slate-800 hover:bg-slate-700 hover:text-[#52A8C7] border border-slate-700/60 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
            title="Abrir Menu Lateral"
          >
            <Menu className="w-5 h-5 text-[#52A8C7]" />
          </button>

          <div className="p-2.5 md:p-3 bg-gradient-to-tr from-[#52A8C7] to-[#4EA8C7] rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-[#52A8C7]/20 transition-transform hover:rotate-6 hidden xs:flex">
            <Users className="w-4.5 h-4.5 md:w-5.5 md:h-5.5 text-slate-950 stroke-[2.5px]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="text-[8px] md:text-[9px] font-black bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 px-1.5 md:p-2 py-0.5 rounded md:rounded-md tracking-wider">
                ADMIN
              </span>
              <h1 className="text-sm md:text-lg font-black tracking-tight text-white flex items-center gap-1">
                Oportuniza <span className="text-[#52A8C7] font-semibold text-xs md:text-sm">Control</span>
              </h1>
            </div>
            <p className="text-[9px] md:text-[11px] text-slate-400 font-medium">Painel Unificado de Empregabilidade Municipal</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 md:gap-4">
          <div className="hidden lg:flex flex-col text-right pr-4 border-r border-slate-800">
            <span className="text-xs font-bold text-slate-200">{user.name}</span>
            <span className="text-[10px] text-slate-400 font-mono">{user.email}</span>
          </div>
          
          <button 
            onClick={onLogout}
            id="admin-logout-btn"
            className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 bg-slate-800 hover:bg-red-500/10 hover:text-red-400 border border-slate-705/60 hover:border-red-500/20 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold transition-all cursor-pointer active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair do Painel</span>
          </button>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 relative overflow-hidden">
        
        {/* Navigation Sidebar (Desktop only, statically placed on the left side) */}
        <aside className="hidden md:flex w-64 bg-slate-900/40 border-r border-slate-800/80 p-5 shrink-0 flex-col gap-6 justify-between overflow-y-auto custom-scroll">
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-[9px] font-black tracking-widest text-[#52A8C7] uppercase px-1">
                Menu de Navegação
              </span>
              
              <div className="space-y-1">
                <button
                  id="tab-dashboard"
                  onClick={() => {
                    setActiveTab('dashboard');
                    setSelectedApplication(null);
                    setPreviewingCourseLessons(null);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === 'dashboard' 
                    ? 'bg-[#52A8C7] text-slate-950 shadow-lg shadow-[#52A8C7]/15 translate-x-1' 
                    : 'text-slate-400 hover:bg-slate-900/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <BarChart2 className="w-4 h-4" />
                    <span>Indicadores Gerais</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${activeTab === 'dashboard' ? 'rotate-90 opacity-80' : 'opacity-40'}`} />
                </button>

                <button
                  id="tab-jobs"
                  onClick={() => {
                    setActiveTab('jobs');
                    setSelectedApplication(null);
                    setPreviewingCourseLessons(null);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === 'jobs' 
                    ? 'bg-[#52A8C7] text-slate-950 shadow-lg shadow-[#52A8C7]/15 translate-x-1' 
                    : 'text-slate-400 hover:bg-slate-900/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-4 h-4" />
                    <span>Gerenciar Vagas</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${activeTab === 'jobs' ? 'bg-slate-900 text-[#52A8C7]' : 'bg-slate-800 text-slate-400'}`}>
                    {jobsList.length}
                  </span>
                </button>

                <button
                  id="tab-company-jobs"
                  onClick={() => {
                    setActiveTab('company_jobs');
                    setSelectedApplication(null);
                    setPreviewingCourseLessons(null);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === 'company_jobs' 
                    ? 'bg-[#52A8C7] text-slate-950 shadow-lg shadow-[#52A8C7]/15 translate-x-1' 
                    : 'text-slate-400 hover:bg-slate-900/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4" />
                    <span>Vagas de Empresas</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${activeTab === 'company_jobs' ? 'bg-slate-900 text-[#52A8C7]' : 'bg-slate-800 text-slate-400'}`}>
                    {companyJobsStats.length} emp.
                  </span>
                </button>

                <button
                  id="tab-courses"
                  onClick={() => {
                    setActiveTab('courses');
                    setSelectedApplication(null);
                    setPreviewingCourseLessons(null);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === 'courses' 
                    ? 'bg-[#52A8C7] text-slate-950 shadow-lg shadow-[#52A8C7]/15 translate-x-1' 
                    : 'text-slate-400 hover:bg-slate-900/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GraduationCap className="w-4 h-4" />
                    <span>Cursos Disponíveis</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${activeTab === 'courses' ? 'bg-slate-900 text-[#52A8C7]' : 'bg-slate-800 text-slate-400'}`}>
                    {coursesList.length}
                  </span>
                </button>

                <button
                  id="tab-applications"
                  onClick={() => {
                    setActiveTab('applications');
                    setSelectedApplication(null);
                    setPreviewingCourseLessons(null);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === 'applications' 
                    ? 'bg-[#52A8C7] text-slate-950 shadow-lg shadow-[#52A8C7]/15 translate-x-1' 
                    : 'text-slate-400 hover:bg-slate-900/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4" />
                    <span>Candidaturas</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${activeTab === 'applications' ? 'bg-slate-950 text-[#52A8C7]' : 'bg-slate-800 text-slate-400'}`}>
                    {applications.length}
                  </span>
                </button>

                <button
                  id="tab-enrollments"
                  onClick={() => {
                    setActiveTab('enrollments');
                    setSelectedApplication(null);
                    setPreviewingCourseLessons(null);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === 'enrollments' 
                    ? 'bg-[#52A8C7] text-slate-950 shadow-lg shadow-[#52A8C7]/15 translate-x-1' 
                    : 'text-slate-400 hover:bg-slate-900/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GraduationCap className="w-4 h-4" />
                    <span>Inscrições</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${activeTab === 'enrollments' ? 'bg-slate-950 text-[#52A8C7]' : 'bg-slate-800 text-slate-400'}`}>
                    {enrollmentsList.length}
                  </span>
                </button>

                <button
                  id="tab-accounts"
                  onClick={() => {
                    setActiveTab('accounts');
                    setSelectedApplication(null);
                    setPreviewingCourseLessons(null);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === 'accounts' 
                    ? 'bg-[#52A8C7] text-slate-950 shadow-lg shadow-[#52A8C7]/15 translate-x-1' 
                    : 'text-slate-400 hover:bg-slate-900/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4" />
                    <span>Contas Cadastradas</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${activeTab === 'accounts' ? 'bg-slate-950 text-[#52A8C7]' : 'bg-slate-800 text-slate-400'}`}>
                    {userList.length}
                  </span>
                </button>

                <button
                  id="tab-audit-logs"
                  onClick={() => {
                    setActiveTab('audit_logs');
                    setSelectedApplication(null);
                    setPreviewingCourseLessons(null);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === 'audit_logs' 
                    ? 'bg-[#52A8C7] text-slate-950 shadow-lg shadow-[#52A8C7]/15 translate-x-1' 
                    : 'text-slate-400 hover:bg-slate-900/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <History className="w-4 h-4 text-amber-400" />
                    <span>Quem Autorizou (Logs)</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${activeTab === 'audit_logs' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                    {auditLogs.length}
                  </span>
                </button>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="border-t border-slate-800/85 pt-5 space-y-2">
              <span className="text-[9px] font-black tracking-widest text-[#52A8C7] uppercase px-1 block mb-1">
                Ações Administrativas
              </span>
              <button 
                onClick={handleOpenAddJobParams}
                className="w-full flex items-center justify-between bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold py-2.5 px-3.5 rounded-xl text-xs transition-all cursor-pointer active:scale-[0.97]"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5 text-[#52A8C7]" />
                  <span>Publicar Nova Vaga</span>
                </div>
              </button>
              <button 
                onClick={handleOpenAddCourseParams}
                className="w-full flex items-center justify-between bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold py-2.5 px-3.5 rounded-xl text-xs transition-all cursor-pointer active:scale-[0.97]"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5 text-[#52A8C7]" />
                  <span>Cadastrar Curso</span>
                </div>
              </button>
            </div>
          </div>

          {/* Connected Cloud DB indicators */}
          <div className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800/80 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-12 h-12 bg-[#52A8C7]/5 rounded-bl-full transition-transform group-hover:scale-110" />
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
              <h4 className="text-[11px] font-extrabold text-slate-300">
                Sincronização Ativa
              </h4>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal font-medium">
              Acompanhamento de candidaturas municipais em tempo real integradas com o Supabase.
            </p>
          </div>
        </aside>

        {/* Mobile slide-out drawer inside AnimatePresence overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 md:hidden flex">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileMenuOpen(false)}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              />
              {/* Sliding sheet */}
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="relative w-72 max-w-[80vw] h-full bg-slate-900 border-r border-slate-800/80 p-5 flex flex-col gap-6 justify-between overflow-y-auto custom-scroll z-51 text-left"
              >
                <div className="space-y-6">
                  {/* Drawer header */}
                  <div className="flex justify-between items-center pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#52A8C7]" />
                      <span className="text-[10px] font-black tracking-widest text-[#52A8C7] uppercase">
                        Navegação
                      </span>
                    </div>
                    <button 
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-1 px-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer text-[10px] font-bold"
                    >
                      Fechar ✕
                    </button>
                  </div>

                  {/* Sidebar Navigation */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black tracking-widest text-[#52A8C7] uppercase px-1">
                      Menu de Navegação
                    </span>
                    
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setActiveTab('dashboard');
                          setSelectedApplication(null);
                          setPreviewingCourseLessons(null);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'dashboard' 
                          ? 'bg-[#52A8C7] text-slate-950 shadow-lg shadow-[#52A8C7]/15 translate-x-1' 
                          : 'text-slate-400 hover:bg-slate-950 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <BarChart2 className="w-4 h-4" />
                          <span>Indicadores Gerais</span>
                        </div>
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${activeTab === 'dashboard' ? 'rotate-90 opacity-80' : 'opacity-40'}`} />
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('jobs');
                          setSelectedApplication(null);
                          setPreviewingCourseLessons(null);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'jobs' 
                          ? 'bg-[#52A8C7] text-slate-950 shadow-lg shadow-[#52A8C7]/15 translate-x-1' 
                          : 'text-slate-400 hover:bg-slate-950 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Briefcase className="w-4 h-4" />
                          <span>Gerenciar Vagas</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${activeTab === 'jobs' ? 'bg-slate-800 text-[#52A8C7]' : 'bg-slate-800 text-slate-400'}`}>
                          {jobsList.length}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('company_jobs');
                          setSelectedApplication(null);
                          setPreviewingCourseLessons(null);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'company_jobs' 
                          ? 'bg-[#52A8C7] text-slate-950 shadow-lg shadow-[#52A8C7]/15 translate-x-1' 
                          : 'text-slate-400 hover:bg-slate-950 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Building2 className="w-4 h-4" />
                          <span>Vagas de Empresas</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${activeTab === 'company_jobs' ? 'bg-slate-800 text-[#52A8C7]' : 'bg-slate-800 text-slate-400'}`}>
                          {companyJobsStats.length}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('courses');
                          setSelectedApplication(null);
                          setPreviewingCourseLessons(null);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'courses' 
                          ? 'bg-[#52A8C7] text-slate-950 shadow-lg shadow-[#52A8C7]/15 translate-x-1' 
                          : 'text-slate-400 hover:bg-slate-950 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <GraduationCap className="w-4 h-4" />
                          <span>Cursos Disponíveis</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${activeTab === 'courses' ? 'bg-slate-850 text-[#52A8C7]' : 'bg-slate-800 text-slate-400'}`}>
                          {coursesList.length}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('applications');
                          setSelectedApplication(null);
                          setPreviewingCourseLessons(null);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'applications' 
                          ? 'bg-[#52A8C7] text-slate-950 shadow-lg shadow-[#52A8C7]/15 translate-x-1' 
                          : 'text-slate-400 hover:bg-slate-950 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4" />
                          <span>Candidaturas</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${activeTab === 'applications' ? 'bg-slate-855 text-[#52A8C7]' : 'bg-slate-800 text-slate-400'}`}>
                          {applications.length}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('enrollments');
                          setSelectedApplication(null);
                          setPreviewingCourseLessons(null);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'enrollments' 
                          ? 'bg-[#52A8C7] text-slate-950 shadow-lg shadow-[#52A8C7]/15 translate-x-1' 
                          : 'text-slate-400 hover:bg-slate-950 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <GraduationCap className="w-4 h-4" />
                          <span>Inscrições</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${activeTab === 'enrollments' ? 'bg-slate-955 text-[#52A8C7]' : 'bg-slate-800 text-slate-400'}`}>
                          {enrollmentsList.length}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('accounts');
                          setSelectedApplication(null);
                          setPreviewingCourseLessons(null);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'accounts' 
                          ? 'bg-[#52A8C7] text-slate-950 shadow-lg shadow-[#52A8C7]/15 translate-x-1' 
                          : 'text-slate-400 hover:bg-slate-950 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Users className="w-4 h-4" />
                          <span>Contas Cadastradas</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${activeTab === 'accounts' ? 'bg-slate-855 text-[#52A8C7]' : 'bg-slate-800 text-slate-400'}`}>
                          {userList.length}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('audit_logs');
                          setSelectedApplication(null);
                          setPreviewingCourseLessons(null);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'audit_logs' 
                          ? 'bg-[#52A8C7] text-slate-950 shadow-lg shadow-[#52A8C7]/15 translate-x-1' 
                          : 'text-slate-400 hover:bg-slate-950 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <History className="w-4 h-4 text-amber-400" />
                          <span>Quem Autorizou (Logs)</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${activeTab === 'audit_logs' ? 'bg-slate-855 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                          {auditLogs.length}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Actions Drawer */}
                  <div className="border-t border-slate-800/85 pt-4 space-y-2">
                    <span className="text-[9px] font-black tracking-widest text-[#52A8C7] uppercase px-1 block mb-1">
                      Ações Administrativas
                    </span>
                    <button 
                      onClick={() => {
                        handleOpenAddJobParams();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-200 font-bold py-2 px-3 rounded-xl text-xs transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5 text-[#52A8C7]" />
                        <span>Publicar Nova Vaga</span>
                      </div>
                    </button>
                    <button 
                      onClick={() => {
                        handleOpenAddCourseParams();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-200 font-bold py-2 px-3 rounded-xl text-xs transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5 text-[#52A8C7]" />
                        <span>Cadastrar Curso</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Cloud DB indicator */}
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-850 relative overflow-hidden">
                  <div className="flex items-center gap-1.5 mb-1 text-xs">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                    <span className="font-extrabold text-slate-300">Sincronização de Dados</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Conectado ao Supabase municipal.
                  </p>
                </div>
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* Display Screens - Each option is separated and tidy */}
        <main className="flex-1 overflow-y-auto custom-scroll p-6 lg:p-8 flex flex-col gap-6 bg-slate-950">
          
          {/* Notifications Feedback */}
          <AnimatePresence>
            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-xl shadow-emerald-500/5 select-none"
              >
                <CheckCircle className="w-4.5 h-4.5 shrink-0 stroke-[2.5px]" />
                <span>{successMsg}</span>
              </motion.div>
            )}
            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-xl shadow-red-500/5 select-none"
              >
                <ShieldAlert className="w-4.5 h-4.5 shrink-0 stroke-[2.5px]" />
                <span>{errorMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* SCREEN 1: INDICATORS DASHBOARD */}
          {activeTab === 'dashboard' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              {/* Profile Welcome Header */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center p-6 bg-gradient-to-r from-slate-900 to-slate-900/40 border border-slate-800 rounded-3xl gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#52A8C7]/5 rounded-bl-full" />
                <div>
                  <h2 className="text-xl lg:text-2xl font-black text-white tracking-tight">
                    Bem-vindo de volta, {(user?.name || '').split(' ')[0] || 'Administrador'}! 👋
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Sua atuação ajuda os jovens de Araucária a se colocarem profissionalmente e se capacitarem.</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-950/80 px-4 py-2.5 border border-slate-800 rounded-2xl text-slate-300 font-semibold text-xs">
                  <Calendar className="w-4 h-4 text-[#52A8C7]" />
                  <span>{getFormattedDate()}</span>
                </div>
              </div>

              {/* Bento Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                
                {/* Stat 1: Jobs published */}
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl relative overflow-hidden group hover:border-[#52A8C7]/50 transition-all duration-300">
                  <span className="text-[9px] font-black text-[#52A8C7] uppercase tracking-widest block">
                    Vagas Disponíveis
                  </span>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-3xl font-black text-white tracking-tight">{jobsList.length}</span>
                    <Briefcase className="w-5.5 h-5.5 text-slate-500 group-hover:text-[#52A8C7] transition-colors" />
                  </div>
                  <div className="mt-3.5 flex items-center gap-1 text-[10px] text-slate-400">
                    <span className="text-slate-200 font-semibold font-mono">{cltCount}</span> CLT ou Aprendiz • <span className="text-slate-200 font-semibold font-mono">{internshipCount}</span> Estágio
                  </div>
                </div>

                {/* Stat 2: Active Courses */}
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl relative overflow-hidden group hover:border-violet-500/50 transition-all duration-300">
                  <span className="text-[9px] font-black text-violet-400 uppercase tracking-widest block">
                    Cursos Livres
                  </span>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-3xl font-black text-white tracking-tight">{coursesList.length}</span>
                    <GraduationCap className="w-5.5 h-5.5 text-slate-500 group-hover:text-violet-400 transition-colors" />
                  </div>
                  <div className="mt-3.5 text-[10px] text-slate-400">
                    Capacitação EAD gratuita cadastrada
                  </div>
                </div>

                {/* Stat 3: Total Submissions */}
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl relative overflow-hidden group hover:border-amber-500/50 transition-all duration-300">
                  <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest block">
                    Candidatos Totais
                  </span>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-3xl font-black text-white tracking-tight">{applications.length}</span>
                    <FileText className="w-5.5 h-5.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
                  </div>
                  <div className="mt-3.5 text-[10px] text-slate-450 flex items-center gap-1 text-amber-400/80">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Integrado ao WhatsApp</span>
                  </div>
                </div>

                {/* Stat 5: Enrollments */}
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl relative overflow-hidden group hover:border-[#52A8C7]/50 transition-all duration-300">
                  <span className="text-[9px] font-black text-[#52A8C7] uppercase tracking-widest block">
                    Matrículas em Cursos
                  </span>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-3xl font-black text-white tracking-tight">{enrollmentsList.length}</span>
                    <GraduationCap className="w-5.5 h-5.5 text-slate-500 group-hover:text-[#52A8C7] transition-colors" />
                  </div>
                  <div className="mt-3.5 text-[10px] text-slate-400">
                    Alunos ativos em trilhas de aprendizado
                  </div>
                </div>

                {/* Stat 4: Fast selections */}
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl relative overflow-hidden group hover:border-emerald-500/50 transition-all duration-300">
                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block">
                    Aprovados / Convocados
                  </span>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-3xl font-black text-emerald-400 tracking-tight">{(approvedCount + interviewCount)}</span>
                    <UserCheck className="w-5.5 h-5.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <div className="mt-3.5 text-[10px] text-slate-400">
                    <span className="text-emerald-400 font-bold font-mono">{approvedCount}</span> contratados e <span className="text-blue-400 font-bold font-mono">{interviewCount}</span> em entrevista
                  </div>
                </div>

              </div>

              {/* Status workflow chart and info blocks */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Proportions widget */}
                <div className="lg:col-span-2 p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-5">
                  <div className="flex justify-between items-center">
                    <div className="space-y-0.5">
                      <h3 className="text-xs font-black text-white uppercase tracking-widest">Pipeline de Sucesso Seletivo</h3>
                      <p className="text-[10px] text-slate-400">Distribuição percentual dos candidatos em Araucária-PR.</p>
                    </div>
                    <span className="text-[10px] font-bold text-[#52A8C7] bg-[#52A8C7]/10 px-2.5 py-1 rounded-full">{applications.length} Inscritos</span>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Em análise */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-amber-400">Em Análise Curricular</span>
                        <span className="text-slate-305 font-black">{analysisCount} ({applications.length ? Math.round((analysisCount / applications.length) * 100) : 0}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-800/60">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${applications.length ? (analysisCount / applications.length) * 105 : 0}%` }}
                          className="bg-amber-400 h-full rounded-full"
                        />
                      </div>
                    </div>

                    {/* Entrevista */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-blue-400">Agendados para Entrevista</span>
                        <span className="text-slate-305 font-black">{interviewCount} ({applications.length ? Math.round((interviewCount / applications.length) * 100) : 0}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-800/60">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${applications.length ? (interviewCount / applications.length) * 105 : 0}%` }}
                          className="bg-blue-400 h-full rounded-full"
                        />
                      </div>
                    </div>

                    {/* Aprovado */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-emerald-400 font-semibold">Admitidos & Contratados</span>
                        <span className="text-slate-305 font-black">{approvedCount} ({applications.length ? Math.round((approvedCount / applications.length) * 100) : 0}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-800/60">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${applications.length ? (approvedCount / applications.length) * 105 : 0}%` }}
                          className="bg-emerald-400 h-full rounded-full"
                        />
                      </div>
                    </div>

                    {/* Reprovado */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-red-400">Reprovados ou Desqualificados</span>
                        <span className="text-slate-305 font-black">{rejectedCount} ({applications.length ? Math.round((rejectedCount / applications.length) * 100) : 0}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-800/60">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${applications.length ? (rejectedCount / applications.length) * 105 : 0}%` }}
                          className="bg-red-500/80 h-full rounded-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Info card */}
                <div className="p-6 bg-[#52A8C7]/5 border border-[#52A8C7]/15 rounded-3xl flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="w-11 h-11 bg-[#52A8C7]/10 rounded-2xl flex items-center justify-center text-[#52A8C7]">
                      <Info className="w-5.5 h-5.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-white uppercase tracking-widest">
                        Gestão Descentralizada
                      </h3>
                      <p className="text-xs text-slate-300 leading-relaxed mt-2">
                        Como administrador, você pode interagir com os candidatos do portal enviando mensagens diretas, alterando o status de suas candidaturas de análise no Supabase, e mantendo o feed de incentivos e capacitações municipais sempre preenchido.
                      </p>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block mb-1.5 font-mono">Araucária Control System v2.1</span>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                      <span className="text-[10px] font-bold text-emerald-400">Serviços municipais online</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Applications table excerpt */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl">
                  <div className="flex justify-between items-center mb-5">
                    <div className="space-y-0.5">
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">Últimas Candidaturas</h3>
                      <p className="text-[10px] text-slate-400">Estudantes cadastrados em processos seletivos locais.</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('applications')}
                      className="text-[10px] font-bold text-[#52A8C7] hover:underline flex items-center gap-1 transition-all hover:gap-1.5 cursor-pointer"
                    >
                      <span>Ver Todas</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {loading ? (
                    <p className="text-xs text-slate-400 text-center py-6">Carregando...</p>
                  ) : applications.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">Nenhuma candidatura registrada.</p>
                  ) : (
                    <div className="divide-y divide-slate-800/80">
                      {applications.slice(0, 4).map((app) => (
                        <div key={app.id} className="py-3 flex justify-between items-center group">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 font-black text-[10px] flex items-center justify-center text-[#52A8C7] uppercase">
                              {String(app.candidateName || 'C').substring(0, 1)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-slate-200 truncate group-hover:text-[#52A8C7] transition-colors">{app.jobTitle}</p>
                              <p className="text-[9px] text-slate-450 mt-0.5 truncate">
                                {app.candidateName}
                              </p>
                            </div>
                          </div>
                          <span className={`text-[8px] font-black uppercase tracking-tight px-2 py-0.5 rounded-md ${
                            app.status === 'Aprovado' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            app.status === 'Entrevista' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                            'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {app.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Enrollment Excerpt */}
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl">
                  <div className="flex justify-between items-center mb-5">
                    <div className="space-y-0.5">
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">Últimas Inscrições</h3>
                      <p className="text-[10px] text-slate-400">Jovens matriculados em cursos de capacitação.</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('enrollments')}
                      className="text-[10px] font-bold text-[#52A8C7] hover:underline flex items-center gap-1 transition-all hover:gap-1.5 cursor-pointer"
                    >
                      <span>Ver Todas</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {loading ? (
                    <p className="text-xs text-slate-400 text-center py-6">Carregando...</p>
                  ) : enrollmentsList.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">Nenhuma matrícula registrada.</p>
                  ) : (
                    <div className="divide-y divide-slate-800/80">
                      {enrollmentsList.slice(0, 4).map((enr) => (
                        <div key={enr.id} className="py-3 flex justify-between items-center group">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 font-black text-[10px] flex items-center justify-center text-violet-400 uppercase">
                              {String(enr.userName || 'A').substring(0, 1)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-slate-200 truncate group-hover:text-violet-400 transition-colors">{enr.courseTitle}</p>
                              <p className="text-[9px] text-slate-450 mt-0.5 truncate">
                                Aluno(a): <span className="text-slate-300 font-bold">{enr.userName}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[8px] font-mono font-bold text-slate-500">{enr.enrolledDate}</span>
                            <span className="text-[8px] text-[#52A8C7] font-bold uppercase">{enr.progress}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* SCREEN 2: JOBS MANAGEMENT */}
          {activeTab === 'jobs' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* Header section */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Painel de Mudança de Vagas</h2>
                  <p className="text-xs text-slate-400 mt-1">Gerencie os postos de estágio e admissões em tempo real voltados ao ambiente jovem.</p>
                </div>
                <button 
                  onClick={handleOpenAddJobParams}
                  className="bg-[#52A8C7] hover:bg-[#3d91ad] text-slate-950 font-black py-3.5 px-5 rounded-2xl text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-[#52A8C7]/15 active:scale-95"
                >
                  <Plus className="w-4 h-4 stroke-[3px]" />
                  <span>Cadastrar Nova Vaga</span>
                </button>
              </div>

              {/* Jobs quick indicator row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4.5 bg-slate-900 border border-slate-800 rounded-3xl text-xs font-semibold">
                <div className="p-3 bg-slate-950/50 rounded-2xl border border-slate-850">
                  <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Total Vagas</p>
                  <p className="text-xl font-bold text-white mt-1">{jobsList.length}</p>
                </div>
                <div className="p-3 bg-slate-950/50 rounded-2xl border border-slate-850">
                  <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Regime CLT</p>
                  <p className="text-xl font-bold text-[#52A8C7] mt-1">{jobsList.filter(j=>j.type==='CLT').length}</p>
                </div>
                <div className="p-3 bg-slate-950/50 rounded-2xl border border-slate-850">
                  <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Estágio / Aprendiz</p>
                  <p className="text-xl font-bold text-amber-400 mt-1">{jobsList.filter(j=>j.type==='Estágio' || j.type==='Jovem Aprendiz').length}</p>
                </div>
                <div className="p-3 bg-slate-950/50 rounded-2xl border border-slate-850">
                  <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Permite Remoto</p>
                  <p className="text-xl font-bold text-emerald-400 mt-1">{remoteJobsCount}</p>
                </div>
              </div>

              {/* Selection query filters */}
              <div className="space-y-3.5 p-5 bg-slate-900 border border-slate-800 rounded-3xl">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Pesquisar vaga por cargo, empresa, localização ou tags de seleção..."
                    value={jobsSearch}
                    onChange={(e) => setJobsSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl text-xs focus:outline-none text-slate-100 placeholder-slate-500"
                  />
                </div>

                {/* Quick categories pills slider */}
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">
                    filtrar por categoria curricular:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {jobCategories.map((catKey) => (
                      <button
                        key={catKey}
                        onClick={() => setSelectedJobCategory(catKey)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          selectedJobCategory === catKey 
                            ? 'bg-[#52A8C7] text-slate-950 font-black' 
                            : 'bg-slate-951 text-slate-400 hover:bg-slate-950 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {catKey}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Grid List of jobs */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {jobsList
                  .filter(job => {
                    const textMatch = (job.title || '').toLowerCase().includes((jobsSearch || '').toLowerCase()) || 
                                      (job.company || '').toLowerCase().includes((jobsSearch || '').toLowerCase()) ||
                                      (job.location || '').toLowerCase().includes((jobsSearch || '').toLowerCase());
                    const categoryMatch = selectedJobCategory === 'Todos' || job.category === selectedJobCategory;
                    return textMatch && categoryMatch;
                  })
                  .map((job) => (
                    <div 
                      key={job.id} 
                      className="p-5 bg-slate-900 border border-slate-800 rounded-3xl hover:border-slate-700/80 transition-all flex flex-col justify-between gap-5 relative group"
                    >
                      <div className="flex items-start gap-4">
                        <img 
                          referrerPolicy="no-referrer"
                          src={job.logo} 
                          alt={job.company} 
                          className="w-12 h-12 rounded-xl object-contain bg-slate-950 border border-slate-800 shrink-0" 
                        />
                        <div className="space-y-1 overflow-hidden flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black tracking-widest text-[#52A8C7] uppercase">{job.category}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-950 text-slate-400 rounded border border-slate-800 capitalize">{job.type}</span>
                          </div>
                          
                          <h3 className="text-sm font-bold text-white tracking-tight line-clamp-1 group-hover:text-[#52A8C7] transition-colors">{job.title}</h3>
                          <p className="text-xs text-slate-300 font-medium">{job.company}</p>

                          {/* Datas de Início e Término */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-mono text-slate-400">
                            <span className="flex items-center gap-1 text-[#52A8C7]">
                              <Calendar className="w-3 h-3" /> Início: {job.startDate || job.dateString}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-amber-400">
                              <Clock className="w-3 h-3" /> Término: {job.endDate || 'Em aberto'}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[10px] text-slate-400 font-semibold font-mono">
                            <span className="flex items-center gap-0.5"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5"><DollarSign className="w-3.5 h-3.5" /> {job.salary}</span>
                            {job.isRemote && (
                              <React.Fragment>
                                <span>•</span>
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 rounded text-[8px] font-bold">Remoto</span>
                              </React.Fragment>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-3.5 border-t border-slate-800/80">
                        <span className="text-[9px] font-mono text-slate-500 font-bold">REG: {job.id}</span>
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => handleOpenEditJob(job)}
                            className="p-2 bg-slate-950 border border-slate-850 hover:border-slate-700/80 rounded-xl hover:bg-[#52A8C7]/10 hover:text-[#52A8C7] transition-all text-slate-400 cursor-pointer active:scale-95"
                            title="Editar Atributos da Vaga"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteJob(job)}
                            className="p-2 bg-slate-950 border border-slate-850 hover:border-slate-700/80 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all text-slate-400 cursor-pointer active:scale-95"
                            title="Excluir Definitivamente esta vaga com registro de auditoria"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>

              {jobsList.filter(job => {
                const textMatch = (job.title || '').toLowerCase().includes((jobsSearch || '').toLowerCase()) || 
                                  (job.company || '').toLowerCase().includes((jobsSearch || '').toLowerCase());
                const categoryMatch = selectedJobCategory === 'Todos' || job.category === selectedJobCategory;
                return textMatch && categoryMatch;
              }).length === 0 && (
                <div className="py-12 text-center bg-slate-900 border border-slate-800 rounded-3xl">
                  <ShieldAlert className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Nenhuma vaga atende aos filtros de emprego definidos no momento.</p>
                </div>
              )}
            </motion.div>
          )}

          {/* SCREEN: COMPANY JOBS MONITOR */}
          {activeTab === 'company_jobs' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* Header Banner */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900/60 border border-slate-800 rounded-3xl relative overflow-hidden">
                <div className="space-y-1 z-10">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-[#52A8C7]/15 text-[#52A8C7] border border-[#52A8C7]/30 text-[10px] font-black uppercase rounded-full tracking-wider flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> Monitor Corporativo
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-full flex items-center gap-1 animate-pulse">
                      ● Sincronizado ao Vivo
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Vagas Adicionadas por Empresas</h2>
                  <p className="text-xs text-slate-400">Acompanhe em tempo real todas as vagas cadastradas pelas empresas parceiras de Araucária e o número de vagas de cada uma.</p>
                </div>
                
                <button 
                  onClick={handleOpenAddJobParams}
                  className="bg-[#52A8C7] hover:bg-[#3d91ad] text-slate-950 font-black py-3.5 px-5 rounded-2xl text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-[#52A8C7]/15 active:scale-95 z-10 shrink-0"
                >
                  <Plus className="w-4 h-4 stroke-[3px]" />
                  <span>Cadastrar Nova Vaga</span>
                </button>
              </div>

              {/* KPI Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Vagas de Empresas</span>
                    <span className="text-3xl font-black text-white tracking-tight mt-1 block">{jobsList.length}</span>
                    <span className="text-[10px] text-slate-400 mt-1 block">Cadastradas e salvas</span>
                  </div>
                  <div className="w-12 h-12 bg-[#52A8C7]/10 rounded-2xl flex items-center justify-center text-[#52A8C7]">
                    <Briefcase className="w-6 h-6" />
                  </div>
                </div>

                <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">Vagas Aceitas pelo ADM</span>
                    <span className="text-3xl font-black text-emerald-400 tracking-tight mt-1 block">
                      {jobsList.filter(j => j.approvalStatus === 'accepted' || j.approvalStatus === 'approved').length}
                    </span>
                    <span className="text-[10px] text-emerald-500/80 mt-1 block">Homologadas para o público</span>
                  </div>
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                </div>

                <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">Vagas c/ Candidato Aceito</span>
                    <span className="text-3xl font-black text-amber-400 tracking-tight mt-1 block">
                      {jobsList.filter(j => applications.some(a => (a.jobId === j.id || a.jobTitle === j.title) && a.status === 'Aprovado')).length}
                    </span>
                    <span className="text-[10px] text-amber-400/80 mt-1 block">Contratação concluída</span>
                  </div>
                  <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400">
                    <Award className="w-6 h-6" />
                  </div>
                </div>

                <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest block">Empresas Parceiras</span>
                    <span className="text-3xl font-black text-white tracking-tight mt-1 block">{companyJobsStats.length}</span>
                    <span className="text-[10px] text-slate-400 mt-1 block">Com vagas ativas em Araucária</span>
                  </div>
                  <div className="w-12 h-12 bg-violet-500/10 rounded-2xl flex items-center justify-center text-violet-400">
                    <Building2 className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Empresa Cards Summary with "X vagas adicionadas" Badge */}
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#52A8C7]" />
                      Empresas e Contagem de Vagas Cadastradas
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Clique em uma empresa para filtrar e visualizar suas vagas publicadas.</p>
                  </div>
                  {selectedCompanyFilter !== 'Todas' && (
                    <button 
                      onClick={() => setSelectedCompanyFilter('Todas')}
                      className="text-[10px] font-bold text-[#52A8C7] hover:underline bg-[#52A8C7]/10 px-3 py-1.5 rounded-xl border border-[#52A8C7]/20 cursor-pointer"
                    >
                      Exibir Todas as Empresas ({companyJobsStats.length})
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {companyJobsStats.map(stat => {
                    const isSelected = selectedCompanyFilter === stat.companyName;
                    return (
                      <button
                        key={stat.companyName}
                        onClick={() => setSelectedCompanyFilter(isSelected ? 'Todas' : stat.companyName)}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected 
                            ? 'bg-[#52A8C7]/15 border-[#52A8C7] text-white shadow-lg shadow-[#52A8C7]/10 ring-1 ring-[#52A8C7]' 
                            : 'bg-slate-950/70 hover:bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                            {stat.logo ? (
                              <img src={stat.logo} alt={stat.companyName} className="w-full h-full object-contain" />
                            ) : (
                              <Building2 className="w-5 h-5 text-[#52A8C7]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate text-white">{stat.companyName}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">Última: {stat.lastDate}</p>
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-end">
                          <span className="px-2.5 py-1 bg-[#52A8C7] text-slate-950 font-black text-[11px] rounded-xl shadow-xs">
                            {stat.count} {stat.count === 1 ? 'vaga' : 'vagas'}
                          </span>
                          <span className="text-[8px] text-slate-400 font-bold uppercase mt-1">adicionadas</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Feed of All Jobs Posted by Companies */}
              <div className="space-y-4 p-6 bg-slate-900 border border-slate-800 rounded-3xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-[#52A8C7]" />
                      {selectedCompanyFilter === 'Todas' ? 'Todas as Vagas Novas Cadastradas' : `Vagas Publicadas por "${selectedCompanyFilter}"`}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Mostrando {jobsList.filter(j => selectedCompanyFilter === 'Todas' || j.company === selectedCompanyFilter).length} vaga(s) salvas no sistema.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="Buscar por cargo, empresa ou localização..."
                        value={companyJobsSearch}
                        onChange={(e) => setCompanyJobsSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Cards List */}
                <div className="space-y-3">
                  {jobsList
                    .filter(job => {
                      const companyMatch = selectedCompanyFilter === 'Todas' || job.company === selectedCompanyFilter;
                      const textMatch = (job.title || '').toLowerCase().includes(companyJobsSearch.toLowerCase()) || 
                                        (job.company || '').toLowerCase().includes(companyJobsSearch.toLowerCase()) ||
                                        (job.location || '').toLowerCase().includes(companyJobsSearch.toLowerCase());
                      return companyMatch && textMatch;
                    })
                    .map(job => {
                      const companyStat = companyJobsStats.find(s => s.companyName === job.company);
                      const totalCompanyJobs = companyStat ? companyStat.count : 1;

                      return (
                        <div 
                          key={job.id}
                          className="p-4 bg-slate-950/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
                        >
                          <div className="flex items-start gap-3.5 min-w-0">
                            <img 
                              src={job.logo} 
                              alt={job.company} 
                              className="w-11 h-11 rounded-xl object-contain bg-slate-900 border border-slate-800 shrink-0 mt-0.5"
                            />
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[12px] font-black text-white">{job.company}</span>
                                <span className="px-2.5 py-0.5 bg-[#52A8C7]/15 border border-[#52A8C7]/30 text-[#52A8C7] text-[10px] font-extrabold rounded-full flex items-center gap-1">
                                  <Building2 className="w-3 h-3" /> {totalCompanyJobs} {totalCompanyJobs === 1 ? 'vaga' : 'vagas'}
                                </span>

                                {/* Status de Homologação / Aceite */}
                                {(job.approvalStatus === 'accepted' || job.approvalStatus === 'approved') ? (
                                  <span className="px-2.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black rounded-full flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Vaga Aceita
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold rounded-full flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Aguardando Homologação
                                  </span>
                                )}

                                {/* Candidatos Aceitos */}
                                {(() => {
                                  const acceptedCount = applications.filter(a => (a.jobId === job.id || a.jobTitle === job.title) && a.status === 'Aprovado').length;
                                  if (acceptedCount > 0) {
                                    return (
                                      <span className="px-2.5 py-0.5 bg-emerald-500 text-slate-950 text-[10px] font-black rounded-full flex items-center gap-1 shadow-xs animate-pulse">
                                        <Award className="w-3 h-3" /> {acceptedCount} {acceptedCount === 1 ? 'Candidato Aceito' : 'Candidatos Aceitos'}
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}

                                <span className="px-2 py-0.5 bg-slate-900 text-slate-400 border border-slate-800 text-[10px] font-semibold rounded-md">
                                  {job.category}
                                </span>
                              </div>

                              <h4 className="text-sm font-extrabold text-white">{job.title}</h4>

                              {/* Datas de Início e Término */}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-slate-400">
                                <span className="flex items-center gap-1 text-[#52A8C7]">
                                  <Calendar className="w-3 h-3" /> Início: {job.startDate || job.dateString}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-amber-400">
                                  <Clock className="w-3 h-3" /> Término: {job.endDate || 'Em aberto'}
                                </span>
                                {job.workHours && (
                                  <React.Fragment>
                                    <span>•</span>
                                    <span className="text-slate-300">{job.workHours}</span>
                                  </React.Fragment>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 font-mono">
                                <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-[#52A8C7]" /> {job.location}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1"><DollarSign className="w-3 h-3 text-emerald-400" /> {job.salary}</span>
                                <span>•</span>
                                <span className="text-slate-300 font-bold">{job.type}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-center">
                            {/* Botão Homologar Vaga se pendente */}
                            {!(job.approvalStatus === 'accepted' || job.approvalStatus === 'approved') && (
                              <button 
                                onClick={() => handleApproveCompanyJob(job)}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95"
                                title="Aceitar e Homologar esta vaga para todos os candidatos"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3px]" />
                                <span>Aceitar Vaga</span>
                              </button>
                            )}

                            <button 
                              onClick={() => handleOpenCompanyProfileModal(job.company)}
                              className="p-2.5 bg-slate-900 border border-slate-800 hover:border-[#52A8C7] text-slate-300 hover:text-[#52A8C7] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                              title="Ver Ficha Cadastral, Usuário, Logo, Contatos e Endereço da Empresa"
                            >
                              <Building2 className="w-3.5 h-3.5 text-[#52A8C7]" />
                              <span className="hidden lg:inline">Perfil Empresa</span>
                            </button>

                            <button 
                              onClick={() => handleOpenEditJob(job)}
                              className="p-2.5 bg-slate-900 border border-slate-800 hover:border-[#52A8C7] text-slate-300 hover:text-[#52A8C7] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Editar</span>
                            </button>

                            <button 
                              onClick={() => handleDeleteJob(job)}
                              className="p-2.5 bg-red-500/10 border border-red-500/30 hover:border-red-500 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                              title="Excluir Definitivamente esta vaga da base de dados com auditoria"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Excluir</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  {jobsList.filter(job => {
                    const companyMatch = selectedCompanyFilter === 'Todas' || job.company === selectedCompanyFilter;
                    const textMatch = (job.title || '').toLowerCase().includes(companyJobsSearch.toLowerCase()) || 
                                      (job.company || '').toLowerCase().includes(companyJobsSearch.toLowerCase());
                    return companyMatch && textMatch;
                  }).length === 0 && (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      Nenhuma vaga encontrada para os critérios de busca especificados.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* SCREEN 3: COURSES PORTFOLIO */}
          {activeTab === 'courses' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* Header layout */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Capacitações Livres Araucária</h2>
                  <p className="text-xs text-slate-400 mt-1">Gerencie trilhas e canais de palestras educacionais gratuitas e estimule o currículo.</p>
                </div>
                <button 
                  onClick={handleOpenAddCourseParams}
                  className="bg-[#52A8C7] hover:bg-[#3d91ad] text-slate-950 font-black py-3.5 px-5 rounded-2xl text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-[#52A8C7]/15 active:scale-95"
                >
                  <Plus className="w-4 h-4 stroke-[3px]" />
                  <span>Novo Curso Gratuito</span>
                </button>
              </div>

              {/* Indicator block for courses */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-violet-500/10 rounded-xl flex items-center justify-center text-violet-400">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black tracking-widest text-[#52A8C7] uppercase block">Grade Profissional Geral</span>
                    <span className="text-xs font-semibold text-slate-305">{coursesList.length} trilhas EAD publicadas</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 text-right">
                  Média de <span className="text-white font-bold">5.0 ★</span> em avaliações
                </div>
              </div>

              {/* Filters container */}
              <div className="space-y-3 p-5 bg-slate-900 border border-slate-800 rounded-3xl">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Filtrar por nome de curso, instrutor ou ramos profissionais específicos..."
                    value={coursesSearch}
                    onChange={(e) => setCoursesSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl text-xs focus:outline-none text-slate-100 placeholder-slate-500"
                  />
                </div>

                <div className="space-y-1.5 pt-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">
                    filtrar por ramo profissional:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {courseCategories.map((catKey) => (
                      <button
                        key={catKey}
                        onClick={() => setSelectedCourseCategory(catKey)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          selectedCourseCategory === catKey 
                            ? 'bg-[#52A8C7] text-slate-950 font-black' 
                            : 'bg-slate-951 text-slate-400 hover:bg-slate-950 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {catKey}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Render collection lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {coursesList
                  .filter(course => {
                    const textMatch = (course.title || '').toLowerCase().includes((coursesSearch || '').toLowerCase()) || 
                                      (course.instructor || '').toLowerCase().includes((coursesSearch || '').toLowerCase());
                    const categoryMatch = selectedCourseCategory === 'Todos' || course.category === selectedCourseCategory;
                    return textMatch && categoryMatch;
                  })
                  .map((course) => (
                    <div 
                      key={course.id} 
                      className={`bg-slate-900 border rounded-3xl overflow-hidden hover:border-slate-700 transition-all flex flex-col justify-between group ${
                        course.active !== false ? 'border-slate-800' : 'border-[#F87171]/20 bg-slate-900/60 opacity-70'
                      }`}
                    >
                      <div>
                        {/* Course cover banner */}
                        <div className="h-32 w-full bg-slate-950 relative flex items-center justify-center border-b border-slate-800 overflow-hidden">
                          {course.coverImage ? (
                            <img src={course.coverImage} alt={course.title} className="w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform" />
                          ) : (
                            <BookOpen className="w-8 h-8 text-slate-600" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent opacity-90" />
                          
                          {/* Active / Inactive Status Badge */}
                          <span className={`absolute top-3 left-3 px-2 py-0.5 rounded text-[8px] md:text-[9px] font-black border backdrop-blur-sm shadow-sm ${
                            course.active !== false 
                              ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-400' 
                              : 'bg-rose-955/80 border-rose-500/30 text-rose-400'
                          }`}>
                            {course.active !== false ? '● ATIVO' : '○ INATIVO'}
                          </span>

                          <span className="absolute top-3 right-3 px-2 py-0.5 bg-slate-950/80 backdrop-blur-sm border border-slate-800/60 rounded text-[9px] font-black text-[#52A8C7]">
                            {course.level}
                          </span>
                        </div>

                        {/* Title and duration */}
                        <div className="p-5 space-y-2">
                          <span className="text-[9px] font-black text-[#52A8C7] uppercase tracking-wider">{course.category}</span>
                          <h3 className="text-sm font-bold text-white tracking-tight leading-snug line-clamp-2 h-10">{course.title}</h3>
                          
                          <div className="flex items-center gap-1.5 pt-1 text-[10px] text-slate-400 font-semibold">
                            <span className="flex items-center gap-1 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800/80">
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> {course.rating.toFixed(1)}
                            </span>
                            <span>•</span>
                            <span>{course.duration}</span>
                            <span>•</span>
                            <span className="text-indigo-400 font-mono text-[9px]">{course.lessons.length} aulas</span>
                          </div>
                          
                          <p className="text-[10px] text-slate-400 mt-1">Por {course.instructor}</p>
                        </div>
                      </div>

                      {/* Lesson Preview Button - Neat and integrated */}
                      <div className="px-5 pb-1">
                        <button 
                          onClick={() => setPreviewingCourseLessons(course)}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-800 hover:text-[#52A8C7] transition-all text-[11px] font-extrabold rounded-xl cursor-pointer"
                        >
                          <Play className="w-3 h-3 text-[#52A8C7]" />
                          <span>Ver Grade de Aulas ({course.lessons.length})</span>
                        </button>
                      </div>

                      {/* Card manipulation footer */}
                      <div className="p-4 px-5 bg-slate-950/40 border-t border-slate-800/80 flex justify-between items-center mt-3">
                        <span className="text-[9px] font-mono text-slate-500 font-semibold">COD: {course.id}</span>
                        <div className="flex items-center gap-2">
                          {/* Active Toggle Button */}
                          <button 
                            onClick={() => handleToggleCourseActive(course.id)}
                            className={`px-2.5 py-1.5 bg-slate-900 border rounded-lg text-[10px] font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                              course.active !== false 
                                ? 'border-slate-800 text-slate-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400' 
                                : 'border-emerald-900 text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/10'
                            }`}
                            title={course.active !== false ? "Desativar Curso (Ocultar dos alunos)" : "Ativar Curso (Exibir para os alunos)"}
                          >
                            {course.active !== false ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                                <span>Desativar</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Ativar</span>
                              </>
                            )}
                          </button>

                          <button 
                            onClick={() => handleOpenEditCourse(course)}
                            className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-lg hover:bg-[#52A8C7]/10 hover:text-[#52A8C7] transition-all text-slate-400 cursor-pointer active:scale-95 flex items-center gap-1.5 text-[10px] font-bold"
                            title="Editar Atributos do Curso"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>

              {coursesList.filter(course => {
                const textMatch = (course.title || '').toLowerCase().includes((coursesSearch || '').toLowerCase());
                const categoryMatch = selectedCourseCategory === 'Todos' || course.category === selectedCourseCategory;
                return textMatch && categoryMatch;
              }).length === 0 && (
                <div className="py-12 text-center bg-slate-900 border border-slate-800 rounded-3xl">
                  <ShieldAlert className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Nenhum curso atende aos critérios do filtro atualmente.</p>
                </div>
              )}
            </motion.div>
          )}

          {/* SCREEN 4: SUBMISSIONS AND CANDIDATURES (ATS tracking system) */}
          {activeTab === 'applications' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Candidaturas Ativas</h2>
                  <p className="text-xs text-slate-400 mt-1">Gerencie os status e perfis curriculares cadastrados no banco de vagas.</p>
                </div>

                <button 
                  onClick={fetchAllApplications}
                  className="px-5 py-3.5 bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 font-bold rounded-2xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Clock className="w-4 h-4 text-[#52A8C7]" />
                  <span>Sincronizar Cloud</span>
                </button>
              </div>

              {/* Advanced candidate tracker and metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900 p-4.5 border border-slate-800 rounded-3xl text-xs font-semibold">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Triagem Inicial</p>
                  <p className="text-xl font-black text-amber-400">{analysisCount} vagas</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entrevistas Ativas</p>
                  <p className="text-xl font-black text-blue-400">{interviewCount} convocados</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admitidos</p>
                  <p className="text-xl font-black text-emerald-400">{approvedCount} contratados</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispensas</p>
                  <p className="text-xl font-black text-slate-400">{rejectedCount} perfis</p>
                </div>
              </div>

              {/* Search inputs */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Pesquisar por nome do aluno, vaga concorrida ou nome da empresa parceira..."
                  value={appSearch}
                  onChange={(e) => setAppSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-900 border border-slate-850 focus:border-[#52A8C7] rounded-2xl text-xs focus:outline-none text-slate-100 placeholder-slate-500"
                />
              </div>

              {/* Main DB Table */}
              {loading ? (
                <div className="py-20 text-center space-y-3">
                  <div className="w-9 h-9 border-3 border-[#52A8C7] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">Verificando banco de dados...</p>
                </div>
              ) : applications.length === 0 ? (
                <div className="py-16 text-center bg-slate-900 border border-slate-850 rounded-3xl">
                  <ShieldAlert className="w-12 h-12 text-slate-655 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-300">Nenhum registro encontrado</p>
                  <p className="text-xs text-slate-500 mt-1">Os candidatos cadastrados aparecerão aqui em tempo real.</p>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-black tracking-widest block py-3 px-6 sm:table-row">
                          <th className="py-4.5 px-6 table-cell">Identificação / Data</th>
                          <th className="py-4.5 px-6 table-cell">Estudante Candidato</th>
                          <th className="py-4.5 px-6 table-cell">Cargo Desejado</th>
                          <th className="py-4.5 px-6 table-cell">Status Seletivo</th>
                          <th className="py-4.5 px-6 text-right table-cell">Ações de Triagem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50 text-xs">
                        {applications
                          .filter(app => 
                            String(app.jobTitle || '').toLowerCase().includes(String(appSearch || '').toLowerCase()) || 
                            String(app.company || '').toLowerCase().includes(String(appSearch || '').toLowerCase()) ||
                            String(app.candidateName || '').toLowerCase().includes(String(appSearch || '').toLowerCase())
                          )
                          .map((app) => (
                            <tr key={app.id} className="hover:bg-slate-950/40 transition-colors flex flex-col sm:table-row py-4 px-6 sm:p-0">
                              <td className="py-1 sm:py-4 px-0 sm:px-6 block sm:table-cell">
                                <div className="flex sm:flex-col items-center sm:items-start gap-2 sm:gap-0.5">
                                  <span className="font-mono text-[9px] text-slate-500 font-bold">#{String(app.id || '').substring(0, 8).toUpperCase()}</span>
                                  <span className="text-[10px] text-slate-400">{formatBrasiliaTime(app.appliedDate)}</span>
                                </div>
                              </td>
                              <td className="py-1.5 sm:py-4 px-0 sm:px-6 block sm:table-cell font-bold text-slate-100">
                                <button 
                                  onClick={() => setSelectedApplication(app)}
                                  className="text-left text-[#52A8C7] hover:underline flex items-center gap-1 cursor-pointer font-bold text-xs"
                                  title="Ver Ficha Cadastral do Candidato"
                                >
                                  <span>{app.candidateName || 'Estudante'}</span>
                                  <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
                                </button>
                              </td>
                              <td className="py-1 sm:py-4 px-0 sm:px-6 block sm:table-cell">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-slate-205">{app.jobTitle}</span>
                                  <span className="text-[10px] text-slate-400">{app.company}</span>
                                </div>
                              </td>
                              <td className="py-1 sm:py-4 px-0 sm:px-6 block sm:table-cell">
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-tight ${
                                  app.status === 'Aprovado' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                  app.status === 'Entrevista' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                  app.status === 'Reprovado' ? 'bg-red-500/10 text-red-500/20 text-red-400 border border-red-500/20' :
                                  'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}>
                                  {app.status}
                                </span>
                              </td>
                              <td className="py-2 sm:py-4 px-0 sm:px-6 block sm:table-cell text-right">
                                <div className="flex flex-wrap gap-1 md:justify-end">
                                  <button 
                                    onClick={() => handleUpdateAppStatus(app.id, 'Em análise')}
                                    className="px-2 py-1 text-[9px] font-black bg-slate-950 hover:bg-amber-400 hover:text-slate-950 border border-slate-800 hover:border-amber-400 rounded-lg text-amber-400 transition-all cursor-pointer active:scale-95"
                                  >
                                    Análise
                                  </button>
                                  <button 
                                    onClick={() => handleUpdateAppStatus(app.id, 'Entrevista')}
                                    className="px-2 py-1 text-[9px] font-black bg-slate-950 hover:bg-blue-400 hover:text-slate-950 border border-slate-800 hover:border-blue-400 rounded-lg text-blue-400 transition-all cursor-pointer active:scale-95"
                                  >
                                    Entrevista
                                  </button>
                                  <button 
                                    onClick={() => handleUpdateAppStatus(app.id, 'Aprovado')}
                                    className="px-2 py-1 text-[9px] font-black bg-slate-950 hover:bg-emerald-400 hover:text-slate-950 border border-slate-800 hover:border-emerald-400 rounded-lg text-emerald-450 transition-all cursor-pointer active:scale-95"
                                  >
                                    Aprovar
                                  </button>
                                  <button 
                                    onClick={() => handleUpdateAppStatus(app.id, 'Reprovado')}
                                    className="px-2 py-1 text-[9px] font-black bg-slate-950 hover:bg-red-500/20 hover:text-red-400 border border-slate-800 hover:border-red-400 rounded-lg text-slate-400 transition-all cursor-pointer active:scale-95"
                                  >
                                    Reprovar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* SCREEN 5: ENROLLMENTS DATABASE */}
          {activeTab === 'enrollments' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Inscrições em Cursos</h2>
                  <p className="text-xs text-slate-400 mt-1">Veja quem está matriculado nos cursos de capacitação do Oportuniza.</p>
                </div>

                <button 
                  onClick={fetchAllEnrollments}
                  className="px-5 py-3.5 bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 font-bold rounded-2xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Clock className="w-4 h-4 text-[#52A8C7]" />
                  <span>Sincronizar Cloud</span>
                </button>
              </div>

              {enrollmentsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-6 bg-slate-900 border border-slate-800 rounded-[32px] text-center">
                  <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 text-slate-500">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-2">Sem inscrições registradas</h3>
                  <p className="text-[10px] text-slate-400 max-w-xs">Aguarde até que os alunos comecem a se inscrever em cursos.</p>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden">
                  <div className="overflow-x-auto custom-scroll">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead>
                        <tr className="bg-slate-950/50 border-b border-slate-800/80">
                          <th className="px-5 py-4 text-[10px] font-black text-[#52A8C7] uppercase tracking-widest">Aluno</th>
                          <th className="px-5 py-4 text-[10px] font-black text-[#52A8C7] uppercase tracking-widest">Curso</th>
                          <th className="px-5 py-4 text-[10px] font-black text-[#52A8C7] uppercase tracking-widest">Instrutor</th>
                          <th className="px-5 py-4 text-[10px] font-black text-[#52A8C7] uppercase tracking-widest text-center">Data</th>
                          <th className="px-5 py-4 text-[10px] font-black text-[#52A8C7] uppercase tracking-widest text-center">Progresso</th>
                          <th className="px-5 py-4 text-[10px] font-black text-[#52A8C7] uppercase tracking-widest text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enrollmentsList.map((enr) => (
                          <tr key={enr.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors group">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-200">
                                  {String(enr.userName || 'A').substring(0, 1)}
                                </div>
                                <span className="text-xs font-bold text-white whitespace-nowrap">{enr.userName}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <span className="text-xs font-medium text-slate-300">{enr.courseTitle}</span>
                            </td>
                            <td className="px-5 py-4">
                              <span className="text-[10px] font-mono text-slate-400">{enr.instructor}</span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className="text-[10px] font-mono text-slate-400">{enr.enrolledDate}</span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-[#52A8C7]" style={{ width: `${enr.progress}%` }} />
                                </div>
                                <span className="text-[10px] font-mono text-slate-300">{enr.progress}%</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                enr.status === 'Concluído' ? 'bg-emerald-500/10 text-emerald-400' :
                                enr.status === 'Em andamento' ? 'bg-blue-500/10 text-blue-400' :
                                'bg-slate-800 text-slate-400'
                              }`}>
                                {enr.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* SCREEN 6: ACCOUNTS DATABASE & ROLE MANAGEMENT */}
          {activeTab === 'accounts' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-sm">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#52A8C7]/15 border border-[#52A8C7]/30 flex items-center justify-center text-[#52A8C7]">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Contas Cadastradas & Gestão de Cargos</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Defina permissões, atribua cargos oficiais e salve as alterações em tempo real no banco de dados.</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={fetchAllUsers}
                    className="px-5 py-3 bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700 font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-sm"
                  >
                    <Clock className="w-4 h-4 text-[#52A8C7]" />
                    <span>Sincronizar Banco</span>
                  </button>
                </div>
              </div>

              {/* Organograma da Hierarquia Oficial (5 Níveis de Acesso) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#52A8C7] flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span>Hierarquia Oficial & Estrutura de Permissões</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Total: {userList.length} contas
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {/* Tier 1 */}
                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('Admin Criador')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      userRoleFilter === 'Admin Criador'
                        ? 'border-amber-400 bg-amber-500/20 shadow-lg shadow-amber-500/10'
                        : 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">Nível 1</span>
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="mt-1">
                      <span className="text-xl font-black text-amber-300 block">
                        {userList.filter(u => String(u.email || '').toLowerCase() === 'pedroorchel12@gmail.com' || String(u.role || u.cargo || '').toLowerCase().includes('criador') || (u.isAdmin && !String(u.role || u.cargo || '').toLowerCase().includes('atendimento'))).length}
                      </span>
                      <span className="text-[10px] font-bold text-slate-300 block truncate">Admin Criador</span>
                    </div>
                  </button>

                  {/* Tier 2 */}
                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('Atendimento Oportuniza')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      userRoleFilter === 'Atendimento Oportuniza'
                        ? 'border-sky-400 bg-sky-500/20 shadow-lg shadow-sky-500/10'
                        : 'border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-wider text-sky-400">Nível 2</span>
                      <Headphones className="w-3.5 h-3.5 text-sky-400" />
                    </div>
                    <div className="mt-1">
                      <span className="text-xl font-black text-sky-300 block">
                        {userList.filter(u => String(u.role || u.cargo || '').toLowerCase().includes('atendimento') || String(u.role || u.cargo || '').toLowerCase().includes('suporte') || String(u.role || u.cargo || '').toLowerCase().includes('moderador')).length}
                      </span>
                      <span className="text-[10px] font-bold text-slate-300 block truncate">Atendimento</span>
                    </div>
                  </button>

                  {/* Tier 3 */}
                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('Empresa')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      userRoleFilter === 'Empresa'
                        ? 'border-indigo-400 bg-indigo-500/20 shadow-lg shadow-indigo-500/10'
                        : 'border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-wider text-indigo-400">Nível 3</span>
                      <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <div className="mt-1">
                      <span className="text-xl font-black text-indigo-300 block">
                        {userList.filter(u => u.accountType === 'company' || String(u.role || u.cargo || '').toLowerCase() === 'empresa' || Boolean(u.cnpj && !String(u.role || u.cargo || '').toLowerCase().includes('recrutador'))).length}
                      </span>
                      <span className="text-[10px] font-bold text-slate-300 block truncate">Empresas (PJ)</span>
                    </div>
                  </button>

                  {/* Tier 4 */}
                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('Recrutador RH')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      userRoleFilter === 'Recrutador RH'
                        ? 'border-emerald-400 bg-emerald-500/20 shadow-lg shadow-emerald-500/10'
                        : 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">Nível 4</span>
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="mt-1">
                      <span className="text-xl font-black text-emerald-300 block">
                        {userList.filter(u => String(u.role || u.cargo || '').toLowerCase().includes('recrutador') || String(u.role || u.cargo || '').toLowerCase().includes('rh') || String(u.role || u.cargo || '').toLowerCase().includes('usuário da empresa') || String(u.role || u.cargo || '').toLowerCase().includes('usuario da empresa')).length}
                      </span>
                      <span className="text-[10px] font-bold text-slate-300 block truncate">Membros RH</span>
                    </div>
                  </button>

                  {/* Tier 5 */}
                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('Candidato')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      userRoleFilter === 'Candidato'
                        ? 'border-slate-500 bg-slate-800 shadow-lg'
                        : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Nível 5</span>
                      <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="mt-1">
                      <span className="text-xl font-black text-slate-200 block">
                        {userList.filter(u => !u.isAdmin && !u.isBlocked && u.status !== 'blocked' && !String(u.role || u.cargo || '').toLowerCase().includes('recrutador') && !String(u.role || u.cargo || '').toLowerCase().includes('empresa') && !String(u.role || u.cargo || '').toLowerCase().includes('atendimento')).length}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 block truncate">Candidatos</span>
                    </div>
                  </button>

                  {/* Bloqueados */}
                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('Bloqueados')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      userRoleFilter === 'Bloqueados'
                        ? 'border-rose-500 bg-rose-500/20 shadow-lg shadow-rose-900/30'
                        : 'border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-wider text-rose-400">Suspensas</span>
                      <Lock className="w-3.5 h-3.5 text-rose-400" />
                    </div>
                    <div className="mt-1">
                      <span className="text-xl font-black text-rose-400 block">
                        {userList.filter(u => u.isBlocked || u.status === 'blocked').length}
                      </span>
                      <span className="text-[10px] font-bold text-rose-300 block truncate">Bloqueadas</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Quick Block By Email Banner */}
              <form onSubmit={handleQuickBlockEmail} className="bg-slate-900 border border-rose-500/30 p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white flex items-center gap-2">
                      <span>Bloquear E-mail / Impedir Acesso</span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[9px] font-black uppercase">Segurança</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Bloqueie instantaneamente qualquer e-mail (trava login com Google, e-mail/senha e novos cadastros).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="email"
                    value={quickBlockEmailInput}
                    onChange={(e) => setQuickBlockEmailInput(e.target.value)}
                    placeholder="exemplo@gmail.com"
                    className="flex-1 sm:w-64 bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isQuickBlocking || !quickBlockEmailInput.trim()}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-black text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 active:scale-95 shadow-md shadow-rose-900/30"
                  >
                    {isQuickBlocking ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Bloquear E-mail</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Filters & Search Toolbar */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={usersSearch}
                    onChange={(e) => setUsersSearch(e.target.value)}
                    placeholder="Buscar por nome, email, cargo ou status..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl pl-9 pr-8 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
                  />
                  {usersSearch && (
                    <button 
                      onClick={() => setUsersSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills based on 5-level hierarchy */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scroll text-xs">
                  {['Todos', 'Admin Criador', 'Atendimento Oportuniza', 'Empresa', 'Recrutador RH', 'Candidato', 'Bloqueados'].map((roleKey) => {
                    const isSelected = userRoleFilter === roleKey;
                    return (
                      <button
                        key={roleKey}
                        onClick={() => setUserRoleFilter(roleKey)}
                        className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer text-xs ${
                          isSelected 
                            ? 'bg-[#52A8C7] text-slate-950 shadow-md shadow-[#52A8C7]/20 font-black' 
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {roleKey}
                      </button>
                    );
                  })}
                </div>
              </div>

              {loading ? (
                <div className="py-20 text-center space-y-3 bg-slate-900 border border-slate-800 rounded-3xl">
                  <div className="w-9 h-9 border-3 border-[#52A8C7] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">Sincronizando contas com o banco de dados...</p>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                          <th className="py-4 px-6">Usuário</th>
                          <th className="py-4 px-6">Status da Conta</th>
                          <th className="py-4 px-6">Nível na Hierarquia</th>
                          <th className="py-4 px-6 text-center">Permissão Admin</th>
                          <th className="py-4 px-6 text-right">Ações Rápidas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {userList
                          .filter(u => {
                            const q = usersSearch.toLowerCase();
                            const isUserBlocked = Boolean(u.isBlocked || u.status === 'blocked');
                            const matchesSearch = 
                              String(u.name || '').toLowerCase().includes(q) ||
                              String(u.email || '').toLowerCase().includes(q) ||
                              String(u.role || u.cargo || '').toLowerCase().includes(q) ||
                              (isUserBlocked && q.includes('bloq')) ||
                              (!isUserBlocked && q.includes('ativ'));

                            if (!matchesSearch) return false;

                            const roleText = String(u.role || u.cargo || '').toLowerCase();
                            const emailText = String(u.email || '').toLowerCase();
                            const isAppCreator = emailText === 'pedroorchel12@gmail.com' || roleText.includes('criador') || (u.isAdmin && !roleText.includes('atendimento'));
                            const isSupport = roleText.includes('atendimento') || roleText.includes('suporte') || roleText.includes('moderador');
                            const isCompany = !isAppCreator && (u.accountType === 'company' || roleText === 'empresa' || Boolean(u.cnpj && !roleText.includes('recrutador')));
                            const isCompanyUser = roleText.includes('recrutador') || roleText.includes('rh') || roleText.includes('usuário da empresa') || roleText.includes('usuario da empresa');
                            const isCandidate = !isAppCreator && !isSupport && !isCompany && !isCompanyUser;

                            if (userRoleFilter === 'Todos') return true;
                            if (userRoleFilter === 'Bloqueados') return isUserBlocked;
                            if (userRoleFilter === 'Admin Criador') return isAppCreator;
                            if (userRoleFilter === 'Atendimento Oportuniza') return isSupport;
                            if (userRoleFilter === 'Empresa') return isCompany;
                            if (userRoleFilter === 'Recrutador RH') return isCompanyUser;
                            if (userRoleFilter === 'Candidato') return isCandidate;
                            return true;
                          })
                          .map((u) => {
                            const isUserBlocked = Boolean(u.isBlocked || u.status === 'blocked');
                            const badge = getRoleBadgeStyle(u.role || u.cargo, u.isAdmin);
                            const BadgeIcon = badge.icon;
                            const isCurrentUser = (user && (user.id === u.id || user.email === u.email));
                            const isSavingThis = savingRoleUserId === u.id;
                            const isProcessingThis = isProcessingActionId === (u.id || u.email);

                            return (
                              <tr key={u.id || u.email} className={`transition-colors ${isUserBlocked ? 'bg-rose-950/15 hover:bg-rose-950/25' : 'hover:bg-slate-950/40'}`}>
                                <td className="py-4 px-6">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-black text-xs uppercase shadow-sm ${
                                      isUserBlocked 
                                        ? 'bg-rose-950/50 border-rose-800/60 text-rose-400' 
                                        : 'bg-slate-950 border-slate-800 text-[#52A8C7]'
                                    }`}>
                                      {String(u.name || u.email || 'U').substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-2">
                                        <span className={`font-bold text-xs ${isUserBlocked ? 'text-rose-200 line-through' : 'text-slate-100'}`}>
                                          {u.name || 'Usuário'}
                                        </span>
                                        {isCurrentUser && (
                                          <span className="px-1.5 py-0.5 bg-[#52A8C7]/20 border border-[#52A8C7]/40 text-[#52A8C7] text-[9px] font-black rounded-md uppercase">
                                            Você
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                                        <span className="text-[11px] font-mono text-slate-400 truncate max-w-[200px]">
                                          {u.email}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td className="py-4 px-6">
                                  {isUserBlocked ? (
                                    <div className="space-y-1">
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-500/15 border border-rose-500/30 text-rose-400">
                                        <Lock className="w-3 h-3" />
                                        <span>Bloqueado</span>
                                      </span>
                                      {u.blockReason && (
                                        <p className="text-[10px] text-rose-300/80 line-clamp-1 max-w-[180px]" title={`Motivo: ${u.blockReason}`}>
                                          <span className="font-semibold text-rose-400">Motivo:</span> {u.blockReason}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Ativo & Liberado</span>
                                    </span>
                                  )}
                                </td>

                                <td className="py-4 px-6">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleOpenEditRoleModal(u)}
                                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 ${badge.bg}`}
                                      title="Clique para alterar cargo"
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                      <BadgeIcon className="w-3.5 h-3.5" />
                                      <span>{u.role || u.cargo || (u.isAdmin ? 'Administrador' : 'Estudante')}</span>
                                      <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                                    </button>
                                  </div>
                                </td>

                                <td className="py-4 px-6 text-center">
                                  <button
                                    onClick={() => {
                                      const nextRole = u.isAdmin ? 'Estudante' : 'Administrador';
                                      handleSaveUserRole(u, nextRole);
                                    }}
                                    disabled={isSavingThis || isUserBlocked}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black transition-all cursor-pointer active:scale-95 disabled:opacity-40 ${
                                      u.isAdmin
                                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25'
                                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                                    }`}
                                    title={u.isAdmin ? 'Clique para revogar privilégios de Admin' : 'Clique para conceder privilégios de Admin'}
                                  >
                                    {isSavingThis ? (
                                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    ) : u.isAdmin ? (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>Administrador</span>
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="w-3.5 h-3.5 text-slate-500" />
                                        <span>Usuário Padrão</span>
                                      </>
                                    )}
                                  </button>
                                </td>

                                <td className="py-4 px-6 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {/* Edit Role Button */}
                                    <button
                                      onClick={() => handleOpenEditRoleModal(u)}
                                      className="px-2.5 py-1.5 bg-slate-950 hover:bg-[#52A8C7] text-slate-300 hover:text-slate-950 border border-slate-800 hover:border-[#52A8C7] rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 active:scale-95 shadow-sm"
                                      title="Definir Cargo"
                                    >
                                      <UserCog className="w-3.5 h-3.5" />
                                      <span className="hidden xl:inline">Cargo</span>
                                    </button>

                                    {/* Block / Unblock Button */}
                                    {isUserBlocked ? (
                                      <button
                                        onClick={() => handleToggleBlockUser(u, false)}
                                        disabled={isProcessingThis}
                                        className="px-2.5 py-1.5 bg-rose-500/20 hover:bg-emerald-600 hover:text-white text-emerald-400 border border-rose-500/40 hover:border-emerald-600 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95 shadow-sm"
                                        title="Desbloquear conta de usuário"
                                      >
                                        {isProcessingThis ? (
                                          <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                          <>
                                            <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                                            <span>Desbloquear</span>
                                          </>
                                        )}
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setUserToBlockModal(u);
                                          setBlockReasonInput(u.blockReason || 'Violação das diretrizes da comunidade');
                                        }}
                                        disabled={isCurrentUser || isProcessingThis}
                                        className={`px-2.5 py-1.5 bg-slate-950 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30 hover:border-rose-600 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95 shadow-sm ${
                                          isCurrentUser ? 'opacity-30 cursor-not-allowed' : ''
                                        }`}
                                        title={isCurrentUser ? "Você não pode bloquear sua própria conta" : "Bloquear conta (impede login e recriação)"}
                                      >
                                        <Lock className="w-3.5 h-3.5" />
                                        <span>Bloquear</span>
                                      </button>
                                    )}

                                    {/* Delete Account Button */}
                                    <button
                                      onClick={() => setUserToDeleteModal(u)}
                                      disabled={isCurrentUser || isProcessingThis}
                                      className={`p-2 bg-slate-950 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center active:scale-95 ${
                                        isCurrentUser ? 'opacity-30 cursor-not-allowed' : ''
                                      }`}
                                      title={isCurrentUser ? "Você não pode apagar sua própria conta" : "Excluir conta permanentemente"}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {userList.length === 0 && (
                    <div className="py-16 text-center text-slate-400 space-y-2">
                      <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                      <p className="text-sm font-bold text-white">Nenhum usuário cadastrado encontrado.</p>
                      <p className="text-xs text-slate-500">Quando novos usuários criarem contas, eles aparecerão aqui automaticamente.</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 8: AUDIT LOGS & AUTHORIZATIONS (HISTÓRICO DE USO E QUEM AUTORIZOU) */}
          {activeTab === 'audit_logs' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 md:p-8 space-y-6 max-w-7xl mx-auto text-left"
            >
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-400">
                      <History className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                        Histórico de Uso & Quem Autorizou
                      </h2>
                      <p className="text-xs text-slate-400">
                        Auditoria de governança e rastreabilidade: saiba quem autorizou cadastros, termos LGPD, bloqueios e alterações na plataforma.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={loadAuditLogs}
                    disabled={loadingAudit}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
                  >
                    <Clock className={`w-3.5 h-3.5 text-amber-400 ${loadingAudit ? 'animate-spin' : ''}`} />
                    <span>Atualizar Histórico</span>
                  </button>
                </div>
              </div>

              {/* Metrics Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Total de Eventos</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-white">{auditLogs.length}</span>
                    <History className="w-4 h-4 text-slate-500" />
                  </div>
                </div>

                <div className="bg-slate-900 border border-emerald-500/25 bg-emerald-500/5 p-4 rounded-2xl space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-widest text-emerald-400">Autorizações Homologadas</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-emerald-400">
                      {auditLogs.filter(a => a.status === 'authorized').length}
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>

                <div className="bg-slate-900 border border-rose-500/25 bg-rose-500/5 p-4 rounded-2xl space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-widest text-rose-400">Bloqueios & Anti-Fraude</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-rose-400">
                      {auditLogs.filter(a => a.status === 'blocked').length}
                    </span>
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                  </div>
                </div>

                <div className="bg-slate-900 border border-indigo-500/25 bg-indigo-500/5 p-4 rounded-2xl space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400">Termos LGPD Firmados</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-indigo-300">
                      {auditLogs.filter(a => (a.action || '').toLowerCase().includes('lgpd') || (a.details || '').toLowerCase().includes('lgpd')).length}
                    </span>
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  </div>
                </div>
              </div>

              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Filtrar por quem autorizou, alvo, ação ou detalhes..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl pl-9 pr-8 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
                  />
                  {auditSearch && (
                    <button 
                      onClick={() => setAuditSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scroll text-xs">
                  {['Todos', 'Admin Criador', 'Atendimento', 'Empresa', 'Anti-Fraude', 'LGPD'].map((tier) => {
                    const isSelected = auditFilterTier === tier;
                    return (
                      <button
                        key={tier}
                        onClick={() => setAuditFilterTier(tier)}
                        className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer text-xs ${
                          isSelected 
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black' 
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {tier}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Logs Timeline Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                        <th className="py-4 px-5">Data & Hora</th>
                        <th className="py-4 px-5">Quem Autorizou (Operador)</th>
                        <th className="py-4 px-5">Ação Realizada</th>
                        <th className="py-4 px-5">Alvo / Beneficiário</th>
                        <th className="py-4 px-5">Justificativa & Detalhes Legais</th>
                        <th className="py-4 px-5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {auditLogs
                        .filter(log => {
                          const q = auditSearch.toLowerCase();
                          const matches = 
                            String(log.actor_name || '').toLowerCase().includes(q) ||
                            String(log.actor_email || '').toLowerCase().includes(q) ||
                            String(log.actor_role || '').toLowerCase().includes(q) ||
                            String(log.action || '').toLowerCase().includes(q) ||
                            String(log.target_name || '').toLowerCase().includes(q) ||
                            String(log.details || '').toLowerCase().includes(q);

                          if (!matches) return false;

                          if (auditFilterTier === 'Todos') return true;
                          if (auditFilterTier === 'Admin Criador') return String(log.actor_role || '').toLowerCase().includes('criador') || String(log.actor_name || '').toLowerCase().includes('pedro');
                          if (auditFilterTier === 'Atendimento') return String(log.actor_role || '').toLowerCase().includes('atendimento');
                          if (auditFilterTier === 'Empresa') return String(log.actor_role || '').toLowerCase().includes('empresa');
                          if (auditFilterTier === 'Anti-Fraude') return String(log.actor_role || '').toLowerCase().includes('anti') || log.status === 'blocked';
                          if (auditFilterTier === 'LGPD') return String(log.action || '').toLowerCase().includes('lgpd') || String(log.details || '').toLowerCase().includes('lgpd');
                          return true;
                        })
                        .map((entry) => {
                          const isBlocked = entry.status === 'blocked';
                          const isLgpd = (entry.action || '').toLowerCase().includes('lgpd') || (entry.details || '').toLowerCase().includes('lgpd');

                          return (
                            <tr key={entry.id} className="hover:bg-slate-950/40 transition-colors">
                              {/* Data e Hora */}
                              <td className="py-4 px-5 whitespace-nowrap">
                                <div className="space-y-0.5">
                                  <span className="font-mono text-slate-300 font-bold block text-[11px]">
                                    {formatBrasiliaTime(entry.timestamp)}
                                  </span>
                                  {entry.ip_address && (
                                    <span className="text-[9px] text-slate-500 font-mono block">
                                      {entry.ip_address}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Quem Autorizou */}
                              <td className="py-4 px-5">
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                                    (entry.actor_role || '').toLowerCase().includes('criador')
                                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                      : (entry.actor_role || '').toLowerCase().includes('atendimento')
                                      ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                                      : (entry.actor_role || '').toLowerCase().includes('empresa')
                                      ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                                      : 'bg-slate-950 border-slate-800 text-slate-400'
                                  }`}>
                                    {(entry.actor_role || '').toLowerCase().includes('criador') ? (
                                      <Crown className="w-4 h-4 text-amber-400" />
                                    ) : (entry.actor_role || '').toLowerCase().includes('atendimento') ? (
                                      <Headphones className="w-4 h-4 text-sky-400" />
                                    ) : (entry.actor_role || '').toLowerCase().includes('empresa') ? (
                                      <Building2 className="w-4 h-4 text-indigo-400" />
                                    ) : (
                                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                                    )}
                                  </div>
                                  <div>
                                    <span className="font-bold text-white block text-xs leading-tight">
                                      {entry.actor_name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono block truncate max-w-[180px]">
                                      {entry.actor_email}
                                    </span>
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold mt-0.5 bg-slate-950 text-slate-300 border border-slate-800">
                                      {entry.actor_role}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Ação */}
                              <td className="py-4 px-5">
                                <div className="space-y-1">
                                  <span className="font-bold text-slate-100 block text-xs">
                                    {entry.action}
                                  </span>
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                    isLgpd
                                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                      : isBlocked
                                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  }`}>
                                    {entry.target_type}
                                  </span>
                                </div>
                              </td>

                              {/* Alvo */}
                              <td className="py-4 px-5">
                                <span className="font-semibold text-slate-300 block text-xs max-w-[160px] truncate" title={entry.target_name}>
                                  {entry.target_name}
                                </span>
                              </td>

                              {/* Justificativa / Detalhes */}
                              <td className="py-4 px-5 max-w-md">
                                <p className="text-[11px] text-slate-300/90 leading-relaxed bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                                  {entry.details}
                                </p>
                              </td>

                              {/* Status */}
                              <td className="py-4 px-5 text-right whitespace-nowrap">
                                {isBlocked ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                    <Lock className="w-3 h-3" />
                                    <span>Bloqueado</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Homologado</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {auditLogs.length === 0 && (
                  <div className="py-16 text-center text-slate-400 space-y-2">
                    <History className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="text-sm font-bold text-white">Nenhum registro de auditoria encontrado.</p>
                    <p className="text-xs text-slate-500">As autorizações e eventos da plataforma serão gravados automaticamente aqui.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

        </main>
      </div>

      {/* MODAL / DRAWER 1: DETAILED STUDENT CV CARD ("Sua Ficha Cadastral") */}
      <AnimatePresence>
        {selectedApplication && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-end z-50">
            <motion.div 
              initial={{ opacity: 0, x: 280 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 280 }}
              className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto"
            >
              <div className="space-y-6 text-left">
                {/* Header panel */}
                <div className="flex justify-between items-center pb-4 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-[#52A8C7]" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Perfil do Candidato</h3>
                  </div>
                  <button 
                    onClick={() => setSelectedApplication(null)}
                    className="p-1 px-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer text-xs"
                  >
                    Fechar ✕
                  </button>
                </div>

                {/* Candidate main contact info card */}
                <div className="p-5 bg-slate-950 rounded-2xl border border-slate-850 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#52A8C7]/15 flex items-center justify-center text-xl font-bold text-[#52A8C7] uppercase select-none">
                      {String(selectedApplication.candidateName || 'C').substring(0, 2)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{selectedApplication.candidateName}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] font-mono font-bold text-slate-500">ID: {String(selectedApplication.id || '').substring(0, 8).toUpperCase()}</span>
                        <span className="w-1.5 h-1.5 bg-slate-700 rounded-full" />
                        <span className="text-[10px] text-slate-400">Cidade: Araucária - PR</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 space-y-2 text-[11px] text-slate-300">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-[#52A8C7]" />
                      <span className="font-mono">{selectedApplication.candidateEmail || 'Email não informado'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[#52A8C7]" />
                      <span>{selectedApplication.candidatePhone || 'Telefone não informado'}</span>
                    </div>
                  </div>

                  {/* Direct WhatsApp connect */}
                  <div className="pt-1">
                    <a 
                      href={getCandidateWhatsAppLink(selectedApplication.candidateName || 'Candidato', selectedApplication.jobTitle, selectedApplication.candidatePhone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-[#25D366] hover:bg-[#20ba56] text-white font-extrabold py-2.5 rounded-xl text-[10px] transition-colors flex items-center justify-center gap-2 cursor-pointer text-center"
                    >
                      <span>Abrir Conversa no WhatsApp</span>
                    </a>
                  </div>
                </div>

                {/* Applied details */}
                <div className="space-y-3.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Vaga Interposta</span>
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                    <p className="text-xs font-bold text-slate-200">{selectedApplication.jobTitle}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{selectedApplication.company}</p>
                    <div className="flex items-center gap-1.5 pt-2 mt-2 border-t border-slate-800/60 text-[10px] text-slate-455 font-mono">
                      <span>Candidatou-se em: {formatBrasiliaTime(selectedApplication.appliedDate)}</span>
                    </div>
                  </div>
                </div>

                {/* Synthetic Student Profile Resume */}
                <div className="space-y-3.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Currículo & Qualificações</span>
                  <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl space-y-3 text-[11px] leading-relaxed text-slate-300">
                    
                    {/* Exibe o CV se houver link */}
                    {(selectedApplication.cvLink || selectedApplication.cvFileName) && (
                      <div className="mb-4 pb-3 border-b border-slate-800">
                        <strong className="text-white block mb-2">Currículo Anexado</strong>
                        {selectedApplication.cvLink ? (
                          <a href={selectedApplication.cvLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[#52A8C7] hover:underline font-medium">
                            <span className="truncate max-w-[200px]">{selectedApplication.cvLink}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400">{selectedApplication.cvFileName} (Arquivo)</span>
                        )}
                      </div>
                    )}
                    
                    <div>
                      <strong className="text-white block mb-0.5">Objetivo Profissional</strong>
                      <p className="text-slate-400">Jovem estudante proativo em busca de sua primeira oportunidade profissional no município para aplicar conhecimentos básicos de informática e atendimento.</p>
                    </div>
                    <div>
                      <strong className="text-white block mb-0.5">Educação e Escolaridade</strong>
                      <p className="text-slate-400">Ensino Médio - Colégio Estadual de Araucária (Cursando no período noturno).</p>
                    </div>
                    <div>
                      <strong className="text-white block mb-1">Qualidades e Hard Skills</strong>
                      <div className="flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 bg-slate-900 rounded font-mono text-[9px] text-[#52A8C7]">Pacote Office</span>
                        <span className="px-2 py-0.5 bg-slate-900 rounded font-mono text-[9px] text-[#52A8C7]">Atendimento comercial</span>
                        <span className="px-2 py-0.5 bg-slate-900 rounded font-mono text-[9px] text-[#52A8C7]">Trabalho em grupo</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* State timeline visualization */}
                <div className="space-y-3.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Status Seletivo Atual</span>
                  <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">Estado atual:</span>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${
                      selectedApplication.status === 'Aprovado' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      selectedApplication.status === 'Entrevista' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      selectedApplication.status === 'Reprovado' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {selectedApplication.status}
                    </span>
                  </div>
                </div>

              </div>

              {/* Status fast action change options */}
              <div className="pt-4 border-t border-slate-800/80 space-y-2 mt-6">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Alterar Status do Candidato:</span>
                <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-bold">
                  <button 
                    onClick={() => handleUpdateAppStatus(selectedApplication.id, 'Em análise')}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                      selectedApplication.status === 'Em análise' 
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400' 
                        : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-amber-450 hover:bg-slate-900'
                    }`}
                  >
                    Mover para Análise
                  </button>
                  <button 
                    onClick={() => handleUpdateAppStatus(selectedApplication.id, 'Entrevista')}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                      selectedApplication.status === 'Entrevista' 
                        ? 'bg-blue-500/20 border-blue-500 text-blue-400' 
                        : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-blue-450 hover:bg-slate-900'
                    }`}
                  >
                    Mover para Entrevista
                  </button>
                  <button 
                    onClick={() => handleUpdateAppStatus(selectedApplication.id, 'Aprovado')}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                      selectedApplication.status === 'Aprovado' 
                        ? 'bg-emerald-500/20 border-emerald-505 text-emerald-400' 
                        : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-emerald-450 hover:bg-slate-900'
                    }`}
                  >
                    Aprovar Candidato
                  </button>
                  <button 
                    onClick={() => handleUpdateAppStatus(selectedApplication.id, 'Reprovado')}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                      selectedApplication.status === 'Reprovado' 
                        ? 'bg-red-500/20 border-red-500 text-red-400' 
                        : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-red-450 hover:bg-slate-900'
                    }`}
                  >
                    Reprovar Candidato
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL / DRAWER 2: INTERACTIVE COURSE LESSON PREVIEW ("Grade de Aulas") */}
      <AnimatePresence>
        {previewingCourseLessons && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-800/80">
                <div className="text-left space-y-0.5">
                  <span className="text-[9px] font-black tracking-widest text-[#52A8C7] uppercase">{previewingCourseLessons.category}</span>
                  <h3 className="text-base font-black text-white">{previewingCourseLessons.title}</h3>
                </div>
                <button 
                  onClick={() => setPreviewingCourseLessons(null)}
                  className="p-1 px-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer text-xs"
                >
                  Fechar
                </button>
              </div>

              {/* Course curriculum description */}
              <p className="text-xs text-slate-400 leading-relaxed text-left">
                {previewingCourseLessons.desc || 'Sem resumo cadastrado para esta capacitação escolar.'}
              </p>

              <div className="space-y-2 max-h-72 overflow-y-auto custom-scroll pt-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block text-left">Grade de Aulas Cadastrada ({previewingCourseLessons.lessons.length}):</span>
                {previewingCourseLessons.lessons.map((lesson, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-850 rounded-xl">
                    <div className="flex items-center gap-2.5 min-w-0 text-left">
                      <div className="w-6 h-6 rounded-lg bg-[#52A8C7]/10 flex items-center justify-center text-[#52A8C7] text-xs font-bold shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-200 truncate">{lesson.title}</p>
                        <p className="text-[9px] font-mono text-slate-500">YouTube Video ID: {lesson.youtubeId || 'I2taMQ3j6qo'}</p>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0">{lesson.duration || '10:00'}</span>
                  </div>
                ))}
              </div>

              {/* Video verification play simulator */}
              <div className="p-3 bg-[#52A8C7]/5 border border-[#52A8C7]/15 rounded-2xl flex items-center gap-2 text-slate-350 text-[11px] leading-snug">
                <Play className="w-4.5 h-4.5 text-[#52A8C7] shrink-0" />
                <p className="text-left">
                  Como administrador, as aulas acima podem ser vistas pelos alunos cadastrados utilizando o reprodutor nativo incorporado do YouTube.
                </p>
              </div>

              <div className="pt-2">
                <button 
                  onClick={() => {
                    handleOpenEditCourse(previewingCourseLessons);
                    setPreviewingCourseLessons(null);
                  }}
                  className="w-full bg-[#52A8C7] hover:bg-[#3d91ad] text-slate-950 font-black py-3 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Editar Dados e Grade Teórica do Curso
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* JOB MODAL (ADD / EDIT) */}
      <AnimatePresence>
        {showJobModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl p-6 shadow-2xl space-y-5 my-8"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-800/80">
                <div className="text-left space-y-0.5">
                  <h3 className="text-base font-black text-white">
                    {editingJob ? 'Alterar Atributos da Vaga' : 'Publicar Novo Cadastro de Vaga'}
                  </h3>
                  <p className="text-[10px] text-slate-400">Preencha os dados abaixo que serão refletidos no Feed de Vagas do aluno correspondente.</p>
                </div>
                <button 
                  onClick={() => setShowJobModal(false)}
                  className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveJobSubmit} className="space-y-4 text-left">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Título do Cargo</label>
                    <input 
                      type="text" 
                      required
                      value={jobForm.title} 
                      onChange={e => setJobForm({...jobForm, title: e.target.value})}
                      placeholder="Ex: Auxiliar de Mecânico"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Empresa Contratante</label>
                    <input 
                      type="text" 
                      required
                      value={jobForm.company} 
                      onChange={e => setJobForm({...jobForm, company: e.target.value})}
                      placeholder="Ex: Transportadora Araucária"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Categoria</label>
                    <select 
                      value={jobForm.category} 
                      onChange={e => setJobForm({...jobForm, category: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3 py-2.5 text-xs focus:outline-none text-slate-350"
                    >
                      <option value="Saúde">Saúde</option>
                      <option value="Administração">Administração</option>
                      <option value="Serviços Gerais">Serviços Gerais</option>
                      <option value="Alimentação">Alimentação</option>
                      <option value="Comércio">Comércio</option>
                      <option value="Logística">Logística</option>
                      <option value="Indústria">Indústria</option>
                      <option value="Estágios">Estágios</option>
                      <option value="Produtividade">Produtividade</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tipo de Vaga</label>
                    <select 
                      value={jobForm.type} 
                      onChange={e => setJobForm({...jobForm, type: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3 py-2.5 text-xs focus:outline-none text-slate-350"
                    >
                      <option value="Estágio">Estágio</option>
                      <option value="CLT">CLT</option>
                      <option value="Jovem Aprendiz">Jovem Aprendiz</option>
                      <option value="Freelancer">Freelancer</option>
                    </select>
                  </div>

                  <div className="col-span-2 sm:col-span-1 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Remuneração</label>
                    <input 
                      type="text" 
                      value={jobForm.salary} 
                      onChange={e => setJobForm({...jobForm, salary: e.target.value})}
                      placeholder="R$ 1.650,00 + VT"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Descrição Breve do Cargo</label>
                  <textarea 
                    rows={2}
                    value={jobForm.description} 
                    onChange={e => setJobForm({...jobForm, description: e.target.value})}
                    placeholder="Descrição sobre a rotina diária no setor correspondente..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl p-3 text-xs focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Requisitos Mandatórios (Um por linha)</label>
                  <textarea 
                    rows={3}
                    value={jobForm.requirements} 
                    onChange={e => setJobForm({...jobForm, requirements: e.target.value})}
                    placeholder="Ensino médio concluído&#10;Residir em Araucária-PR&#10;Noções básicas de Pacote Office"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl p-3 text-xs focus:outline-none font-sans"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Local do Trabalho</label>
                    <input 
                      type="text" 
                      value={jobForm.location} 
                      onChange={e => setJobForm({...jobForm, location: e.target.value})}
                      placeholder="Araucária - PR"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none"
                    />
                  </div>
                  
                  <div className="flex items-center pt-4">
                    <input 
                      id="is-remote-input"
                      type="checkbox" 
                      checked={jobForm.isRemote} 
                      onChange={e => setJobForm({...jobForm, isRemote: e.target.checked})}
                      className="w-4 h-4 bg-slate-950 border-slate-800 rounded focus:ring-[#52A8C7] accent-[#52A8C7] mr-2.5"
                    />
                    <label htmlFor="is-remote-input" className="text-xs font-semibold text-slate-300">Essa vaga permite trabalhar Remoto</label>
                  </div>
                </div>

                {/* Datas de Início e Término (Obrigatórias) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800/80">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-[#52A8C7] uppercase tracking-widest pl-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Data de Início das Inscrições *
                    </label>
                    <input 
                      type="date" 
                      required
                      value={jobForm.startDate} 
                      onChange={e => setJobForm({...jobForm, startDate: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Data Final / Encerramento *
                    </label>
                    <input 
                      type="date" 
                      required
                      value={jobForm.endDate} 
                      onChange={e => setJobForm({...jobForm, endDate: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-200"
                    />
                  </div>
                </div>

                {/* Horário de Trabalho & Endereço Completo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Horário / Jornada de Trabalho
                    </label>
                    <input 
                      type="text" 
                      value={jobForm.workHours} 
                      onChange={e => setJobForm({...jobForm, workHours: e.target.value})}
                      placeholder="Ex: 08:00 às 17:00 (Seg a Sex)"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Endereço em Araucária
                    </label>
                    <input 
                      type="text" 
                      value={jobForm.companyAddress} 
                      onChange={e => setJobForm({...jobForm, companyAddress: e.target.value})}
                      placeholder="Ex: Rua Dr. Victor do Amaral, 450 - Centro"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                {/* Contatos & Responsável da Empresa */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800/80">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-400" /> WhatsApp / Telefone da Empresa
                    </label>
                    <input 
                      type="text" 
                      value={jobForm.companyContactPhone} 
                      onChange={e => setJobForm({...jobForm, companyContactPhone: e.target.value})}
                      placeholder="(41) 99650-2358"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                      <Mail className="w-3 h-3 text-sky-400" /> E-mail de Contato da Empresa
                    </label>
                    <input 
                      type="email" 
                      value={jobForm.companyContactEmail} 
                      onChange={e => setJobForm({...jobForm, companyContactEmail: e.target.value})}
                      placeholder="rh@empresa.com.br"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-200"
                    />
                  </div>
                </div>

                {/* Responsável da Empresa & Logo */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nome do Responsável</label>
                    <input 
                      type="text" 
                      value={jobForm.companyResponsibleName} 
                      onChange={e => setJobForm({...jobForm, companyResponsibleName: e.target.value})}
                      placeholder="Ex: Carlos Mendes"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Cargo do Responsável</label>
                    <input 
                      type="text" 
                      value={jobForm.companyResponsibleRole} 
                      onChange={e => setJobForm({...jobForm, companyResponsibleRole: e.target.value})}
                      placeholder="Ex: Gerente de RH"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Logo URL (Opcional)</label>
                    <input 
                      type="text" 
                      value={jobForm.companyLogoUrl} 
                      onChange={e => setJobForm({...jobForm, companyLogoUrl: e.target.value})}
                      placeholder="https://..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Latitude do Mapa (opcional)</label>
                    <input 
                      type="text" 
                      value={jobForm.lat} 
                      onChange={e => setJobForm({...jobForm, lat: e.target.value})}
                      placeholder="-25.5920"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Longitude do Mapa (opcional)</label>
                    <input 
                      type="text" 
                      value={jobForm.lng} 
                      onChange={e => setJobForm({...jobForm, lng: e.target.value})}
                      placeholder="-49.4140"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-300"
                    />
                  </div>
                </div>

                <div className="pt-3 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setShowJobModal(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-705 text-slate-300 font-bold py-3.5 rounded-xl text-xs transition-colors cursor-pointer select-none text-center"
                  >
                    Descartar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-[#52A8C7] hover:bg-[#3d91ad] text-slate-950 font-black py-3.5 rounded-xl text-xs transition-colors cursor-pointer select-none"
                  >
                    {editingJob ? 'Salvar Mudanças' : 'Publicar Vaga Agora'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* COURSE MODAL (ADD / EDIT) */}
      <AnimatePresence>
        {showCourseModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl p-6 shadow-2xl space-y-5 my-8"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-800/80">
                <div className="text-left space-y-0.5">
                  <h3 className="text-base font-black text-white">
                    {editingCourse ? 'Configurações de Capacitação' : 'Adicionar Novo Curso Profissional'}
                  </h3>
                  <p className="text-[10px] text-slate-400">Preencha as aulas e vídeos de capacitação oferecidos gratuitamente.</p>
                </div>
                <button 
                  onClick={() => setShowCourseModal(false)}
                  className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveCourseSubmit} className="space-y-4 text-left">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Título do Curso</label>
                    <input 
                      type="text" 
                      required
                      value={courseForm.title} 
                      onChange={e => setCourseForm({...courseForm, title: e.target.value})}
                      placeholder="Ex: Boas Práticas em Supermercados"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Palestrante / Instrutor</label>
                    <input 
                      type="text" 
                      required
                      value={courseForm.instructor} 
                      onChange={e => setCourseForm({...courseForm, instructor: e.target.value})}
                      placeholder="Ex: Oportuniza Capacita"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Ramo de Atuação</label>
                    <select 
                      value={courseForm.category} 
                      onChange={e => setCourseForm({...courseForm, category: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3 py-2.5 text-xs focus:outline-none text-slate-300"
                    >
                      <option value="Produtividade">Produtividade</option>
                      <option value="Sistemas">Sistemas</option>
                      <option value="Atendimento">Atendimento</option>
                      <option value="Comércio">Comércio</option>
                      <option value="Saúde">Saúde</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Carga Horária</label>
                    <input 
                      type="text" 
                      required
                      value={courseForm.duration} 
                      onChange={e => setCourseForm({...courseForm, duration: e.target.value})}
                      placeholder="Ex: 5 horas"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nível de Estudo</label>
                    <select 
                      value={courseForm.level} 
                      onChange={e => setCourseForm({...courseForm, level: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3 py-2.5 text-xs focus:outline-none text-slate-350"
                    >
                      <option value="Iniciante">Iniciante</option>
                      <option value="Intermediário">Intermediário</option>
                      <option value="Avançado">Avançado</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Imagem de Capa (URL)</label>
                  <input 
                    type="url" 
                    value={courseForm.coverImage} 
                    onChange={e => setCourseForm({...courseForm, coverImage: e.target.value})}
                    placeholder="https://images.unsplash.com/photo-1516321318423-f06f85e504b3"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Resumo Curricular (Descrição)</label>
                  <textarea 
                    rows={2}
                    value={courseForm.desc} 
                    onChange={e => setCourseForm({...courseForm, desc: e.target.value})}
                    placeholder="Nesta capacitação, você aprenderá sobre..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-[#52A8C7] rounded-xl p-3 text-xs focus:outline-none"
                  />
                </div>

                <div className="space-y-1 p-3.5 bg-slate-950 border border-slate-850 rounded-2xl">
                  <label className="text-[10px] font-black text-[#52A8C7] uppercase tracking-wider block mb-1">
                    Configuração de Aulas e IDs do YouTube
                  </label>
                  <span className="text-[9px] text-slate-400 block mb-2 leading-relaxed">
                    Formato por linha: <strong>Título da Palestra;Tempo;ID_do_Youtube_Video</strong>
                  </span>
                  <textarea 
                    rows={4}
                    required
                    value={courseForm.lessonsInput} 
                    onChange={e => setCourseForm({...courseForm, lessonsInput: e.target.value})}
                    placeholder="Introdução à Atividade;08:35;I2taMQ3j6qo&#10;Melhoria Contínua;14:20;OHM4CJbea54"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-[#52A8C7] rounded-xl p-2.5 text-xs font-mono focus:outline-none text-slate-200"
                  />
                </div>

                {/* Active Toggle Option */}
                <div className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-850 rounded-2xl">
                  <input 
                    type="checkbox" 
                    id="course-active-checkbox"
                    checked={courseForm.active} 
                    onChange={e => setCourseForm({...courseForm, active: e.target.checked})}
                    className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-[#52A8C7] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <div className="flex flex-col text-left">
                    <label htmlFor="course-active-checkbox" className="text-xs font-bold text-white cursor-pointer pl-0.5 select-none font-sans">
                      Curso Ativo (Disponível aos Alunos)
                    </label>
                    <span className="text-[10px] text-slate-400 pl-0.5 leading-tight font-sans">
                      Se desmarcado, este curso ficará inativo e oculto na página de trilhas de capacitação dos alunos.
                    </span>
                  </div>
                </div>

                <div className="pt-3 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setShowCourseModal(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3.5 rounded-xl text-xs transition-colors cursor-pointer select-none text-center"
                  >
                    Descartar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-[#52A8C7] hover:bg-[#3d91ad] text-slate-950 font-black py-3.5 rounded-xl text-xs transition-colors cursor-pointer select-none"
                  >
                    {editingCourse ? 'Gravar Alterações' : 'Salvar e Cadastrar Curso'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* MODAL 4: ROLE AND CARGO ASSIGNMENT MODAL */}
        {editingRoleUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto custom-scroll"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-slate-800/80 pb-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#52A8C7]/15 border border-[#52A8C7]/30 flex items-center justify-center font-black text-sm text-[#52A8C7] uppercase shadow-inner">
                    {String(editingRoleUser.name || editingRoleUser.email || 'U').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-widest text-[#52A8C7] block">
                      Gestão de Permissões & Cargos
                    </span>
                    <h3 className="text-lg font-black text-white">{editingRoleUser.name}</h3>
                    <p className="text-xs font-mono text-slate-400">{editingRoleUser.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingRoleUser(null)}
                  className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Role Presets Selection */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">
                  Selecione o Cargo Oficial:
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  {[
                    {
                      id: 'Admin Criador da Aplicação',
                      title: '👑 Nível 1: Admin Criador da Aplicação',
                      desc: 'Criador e administrador master. Acesso irrestrito a bancos, autorizações, cadastros e auditoria total.',
                      icon: Crown,
                      color: 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    },
                    {
                      id: 'Atendimento Oportuniza',
                      title: '🎧 Nível 2: Atendimento Oportuniza',
                      desc: 'Equipe de moderação, atendimento ao jovem munícipe e suporte institucional às empresas.',
                      icon: Headphones,
                      color: 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                    },
                    {
                      id: 'Empresa',
                      title: '🏢 Nível 3: Empresa',
                      desc: 'Empresa contratante titular cadastrada com CNPJ em Araucária e aceite formal dos termos LGPD.',
                      icon: Building2,
                      color: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
                    },
                    {
                      id: 'Usuários da Empresa Cadastrados',
                      title: '👥 Nível 4: Usuários da Empresa Cadastrados',
                      desc: 'Recrutadores, analistas de RH e membros autorizados pela empresa titular para triar vagas.',
                      icon: Users,
                      color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    },
                    {
                      id: 'Candidato',
                      title: '🎓 Nível 5: Candidato',
                      desc: 'Jovens de Araucária em busca do primeiro emprego, estágio, menor aprendiz e cursos gratuitos.',
                      icon: GraduationCap,
                      color: 'border-slate-700 bg-slate-950 text-slate-300'
                    },
                    {
                      id: 'Personalizado',
                      title: 'Cargo Personalizado...',
                      desc: 'Digite um cargo específico sob medida (ex: Coordenador Pedagógico, Auditor de Vagas, etc).',
                      icon: Tag,
                      color: 'border-violet-500/40 bg-violet-500/10 text-violet-300'
                    }
                  ].map((preset) => {
                    const PresetIcon = preset.icon;
                    const isSelected = selectedRoleInModal === preset.id || (preset.id === 'Personalizado' && !['Admin Criador da Aplicação', 'Atendimento Oportuniza', 'Empresa', 'Usuários da Empresa Cadastrados', 'Candidato'].includes(selectedRoleInModal));

                    return (
                      <div
                        key={preset.id}
                        onClick={() => {
                          if (preset.id === 'Personalizado') {
                            setSelectedRoleInModal('Personalizado');
                          } else {
                            setSelectedRoleInModal(preset.id);
                            setCustomRoleInput('');
                          }
                        }}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 select-none ${
                          isSelected 
                            ? `${preset.color} ring-2 ring-[#52A8C7]/50 shadow-lg` 
                            : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className={`p-2 rounded-xl mt-0.5 ${isSelected ? 'bg-white/10' : 'bg-slate-900 border border-slate-800'}`}>
                          <PresetIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-white">{preset.title}</span>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-[#52A8C7]" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{preset.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Role Input field when selected */}
              {(selectedRoleInModal === 'Personalizado' || (!['Administrador', 'Recrutador / Empresa', 'Instrutor / Professor', 'Moderador', 'Estudante / Candidato'].includes(selectedRoleInModal))) && (
                <div className="space-y-1.5 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                  <label className="text-[10px] font-black text-[#52A8C7] uppercase tracking-widest pl-1 block">
                    Nome do Cargo Personalizado
                  </label>
                  <input
                    type="text"
                    value={customRoleInput}
                    onChange={(e) => setCustomRoleInput(e.target.value)}
                    placeholder="Ex: Coordenador Pedagógico, Gestor de RH, etc."
                    className="w-full bg-slate-900 border border-slate-700 focus:border-[#52A8C7] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                    autoFocus
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex gap-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setEditingRoleUser(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3.5 rounded-xl text-xs transition-colors cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={Boolean(savingRoleUserId)}
                  onClick={() => {
                    const finalRole = selectedRoleInModal === 'Personalizado' ? (customRoleInput.trim() || 'Estudante') : selectedRoleInModal;
                    handleSaveUserRole(editingRoleUser, finalRole);
                  }}
                  className="flex-1 bg-[#52A8C7] hover:bg-[#3d91ad] disabled:opacity-50 text-slate-950 font-black py-3.5 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#52A8C7]/20 active:scale-95"
                >
                  {savingRoleUserId ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Salvando no Banco...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Salvar Cargo no Banco</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* MODAL 5: CONFIRM USER ACCOUNT BLOCKING */}
        {userToBlockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl relative space-y-6"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="space-y-1 flex-1">
                  <span className="text-[10px] uppercase font-black tracking-widest text-rose-400 block">
                    Bloqueio de Segurança
                  </span>
                  <h3 className="text-lg font-black text-white">Bloquear Conta de Usuário?</h3>
                  <p className="text-xs text-slate-300">
                    Você está prestes a bloquear o acesso de <strong className="text-white">{userToBlockModal.name}</strong> (<span className="font-mono text-[#52A8C7]">{userToBlockModal.email}</span>).
                  </p>
                </div>
              </div>

              {/* Informative Restrictions box */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2.5 text-xs">
                <div className="flex items-start gap-2 text-rose-300">
                  <Ban className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <p><strong>Acesso Imediatamente Revogado:</strong> O usuário será desconectado e não conseguirá mais efetuar login no aplicativo.</p>
                </div>
                <div className="flex items-start gap-2 text-amber-300">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <p><strong>Novo Cadastro Impedido:</strong> O e-mail permanece registrado no banco e bloqueado, impedindo a criação de uma nova conta com este mesmo e-mail (informará que o e-mail já está em uso).</p>
                </div>
              </div>

              {/* MOTIVO DO BLOQUEIO */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-rose-400" />
                    <span>Motivo do Bloqueio:</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Salvo no banco de dados</span>
                </div>
                <textarea
                  rows={2}
                  value={blockReasonInput}
                  onChange={(e) => setBlockReasonInput(e.target.value)}
                  placeholder="Ex: Violação dos termos de uso, conduta inapropriada..."
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-rose-500 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors resize-none"
                />
                
                {/* Sugestões rápidas de motivos */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block">Sugestões rápidas:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Violação das diretrizes',
                      'Spam / Conta falsa',
                      'Comportamento inadequado',
                      'Fraude / Atividade suspeita',
                      'Solicitação do titular'
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setBlockReasonInput(preset)}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          blockReasonInput === preset 
                            ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 font-bold shadow-sm' 
                            : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUserToBlockModal(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3.5 rounded-xl text-xs transition-colors cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={Boolean(isProcessingActionId)}
                  onClick={() => handleToggleBlockUser(userToBlockModal, true)}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black py-3.5 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30 active:scale-95"
                >
                  {isProcessingActionId ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Bloqueando...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Confirmar Bloqueio</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* MODAL 6: CONFIRM PERMANENT USER DELETION */}
        {userToDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl relative space-y-6"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="space-y-1 flex-1">
                  <span className="text-[10px] uppercase font-black tracking-widest text-rose-400 block">
                    Exclusão Definitiva
                  </span>
                  <h3 className="text-lg font-black text-white">Excluir Conta do Sistema?</h3>
                  <p className="text-xs text-slate-300">
                    Tem certeza de que deseja apagar a conta de <strong className="text-white">{userToDeleteModal.name}</strong> (<span className="font-mono text-slate-400">{userToDeleteModal.email}</span>)?
                  </p>
                </div>
              </div>

              <div className="p-4 bg-rose-950/20 border border-rose-500/30 rounded-2xl space-y-2 text-xs text-rose-200">
                <p className="font-bold flex items-center gap-2 text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  Esta ação é permanente e irreversível!
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Os dados de perfil, histórico e candidaturas associadas a este usuário serão removidos da base de dados.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUserToDeleteModal(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3.5 rounded-xl text-xs transition-colors cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={Boolean(isProcessingActionId)}
                  onClick={() => handleDeleteUser(userToDeleteModal)}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black py-3.5 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30 active:scale-95"
                >
                  {isProcessingActionId ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Excluindo...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Excluir Definitivamente</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* MODAL 7: CONFIRMAR EXCLUSÃO DEFINITIVA DE VAGA PELO ADM */}
        {jobToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl relative space-y-6"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="space-y-1 flex-1 text-left">
                  <span className="text-[10px] uppercase font-black tracking-widest text-rose-400 block">
                    Painel ADM • Exclusão de Vaga
                  </span>
                  <h3 className="text-lg font-black text-white">Excluir Vaga Definitivamente?</h3>
                  <p className="text-xs text-slate-300">
                    Você está prestes a excluir a vaga <strong className="text-white">"{jobToDelete.title}"</strong> da empresa <strong className="text-[#52A8C7]">{jobToDelete.company}</strong>.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-rose-950/20 border border-rose-500/30 rounded-2xl space-y-2 text-xs text-rose-200 text-left">
                <p className="font-bold flex items-center gap-2 text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  Remoção total e imediata do sistema
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  A vaga será apagada da base de dados do Supabase e do mural público de Araucária. Esta ação será registrada no histórico de auditoria (<span className="text-slate-350">"Quem Autorizou"</span>) com sua assinatura administrativa.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setJobToDelete(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3.5 rounded-xl text-xs transition-colors cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeletingJob}
                  onClick={handleConfirmDeleteJob}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black py-3.5 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30 active:scale-95"
                >
                  {isDeletingJob ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Excluindo do BD...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Excluir Vaga Agora</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* MODAL 8: FICHA CADASTRAL COMPLETA DA EMPRESA (Perfil, Contato, Logo, Endereço e Vagas) */}
        {companyProfileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl relative space-y-6 my-8 text-left"
            >
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0 p-1">
                    {companyProfileModal.logoUrl ? (
                      <img src={companyProfileModal.logoUrl} alt="Logo" className="w-full h-full object-contain rounded-xl" />
                    ) : (
                      <Building2 className="w-8 h-8 text-[#52A8C7]" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black text-[#52A8C7] uppercase tracking-widest">Ficha da Empresa Parceira</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                        Araucária - PR
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-white">{companyProfileModal.companyName}</h3>
                    <p className="text-xs text-slate-400 font-mono">CNPJ: {companyProfileModal.cnpj || 'Não informado'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setCompanyProfileModal(null)}
                  className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Informações do Usuário da Empresa e Contato */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-2xl space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-[#52A8C7]" /> Usuário Responsável da Empresa
                  </span>
                  <p className="text-sm font-bold text-white">{companyProfileModal.responsibleName || 'Responsável não nomeado'}</p>
                  <p className="text-xs text-slate-400">{companyProfileModal.responsibleRole || 'Gestão de RH & Recrutamento'}</p>
                  <div className="pt-2 text-xs flex items-center gap-2 text-slate-300">
                    <Mail className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="truncate">{companyProfileModal.email || 'Não informado'}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-2xl space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" /> Contato Direto & WhatsApp
                  </span>
                  <p className="text-sm font-bold text-slate-200">{companyProfileModal.phone || '(41) 99650-2358'}</p>
                  <p className="text-xs text-slate-400">Atendimento rápido com o RH da empresa</p>
                  {companyProfileModal.phone && (
                    <div className="pt-2">
                      <a 
                        href={`https://wa.me/55${companyProfileModal.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                        Abrir WhatsApp do RH
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Endereço Completo em Araucária */}
              <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-2xl space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" /> Endereço em Araucária-PR
                </span>
                <p className="text-xs font-semibold text-white">{companyProfileModal.address || 'Araucária - PR'}</p>
                <p className="text-[11px] text-slate-400">Bairro: <strong className="text-slate-300">{companyProfileModal.neighborhood || 'Centro'}</strong> • Cidade: Araucária - Estado: Paraná</p>
              </div>

              {/* Métricas de Vagas & Vagas Aceitas */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Vagas</span>
                  <span className="text-xl font-black text-white">{companyProfileModal.jobs.length}</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                  <span className="text-[10px] text-emerald-400 uppercase font-black tracking-wider block">Vagas Aceitas</span>
                  <span className="text-xl font-black text-emerald-400">
                    {companyProfileModal.jobs.filter(j => j.approvalStatus === 'accepted' || j.approvalStatus === 'approved').length}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                  <span className="text-[10px] text-blue-400 uppercase font-black tracking-wider block">Candidatos Aceitos</span>
                  <span className="text-xl font-black text-blue-400">{companyProfileModal.acceptedCount}</span>
                </div>
              </div>

              {/* Vagas Desta Empresa com Botão de Excluir */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                  Vagas Cadastradas por esta Empresa ({companyProfileModal.jobs.length}):
                </span>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {companyProfileModal.jobs.map(job => (
                    <div key={job.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white truncate">{job.title}</h4>
                          <span className="text-[9px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">{job.type}</span>
                          {job.approvalStatus === 'accepted' || job.approvalStatus === 'approved' ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">Aceita pelo ADM</span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold">Em Análise</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {job.startDate && job.endDate ? `Prazo: ${job.startDate} até ${job.endDate}` : job.salary}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {job.approvalStatus !== 'accepted' && job.approvalStatus !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => {
                              handleApproveCompanyJob(job);
                              setCompanyProfileModal(prev => prev ? {
                                ...prev,
                                jobs: prev.jobs.map(j => j.id === job.id ? { ...j, approvalStatus: 'accepted' } : j)
                              } : null);
                            }}
                            className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            Aceitar Vaga
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setCompanyProfileModal(null);
                            handleDeleteJob(job);
                          }}
                          className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setCompanyProfileModal(null)}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 rounded-xl text-xs transition-colors cursor-pointer text-center"
                >
                  Fechar Ficha Cadastral
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

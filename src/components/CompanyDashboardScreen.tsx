import React, { useState, useEffect } from 'react';
import { 
  Building2, Briefcase, Users, Plus, CheckCircle2, Clock, XCircle, 
  MapPin, Phone, Mail, FileText, Trash2, Edit3, Eye, LogOut, Search,
  AlertCircle, ShieldCheck, Award, ChevronRight, Check, X, Sparkles, Maximize2, Minimize2, Loader2,
  Upload, Image as ImageIcon, Calendar, DollarSign, UserCheck, CheckCircle, TrendingUp, Filter, ArrowUpRight
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { User, Job, Application } from '../types';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../lib/toast';
import { mockJobs, deleteJobPermanently } from '../data';
import { sanitizePostgrestFilterValue } from '../lib/securityValidation';
import { ARAUCARIA_NEIGHBORHOOD_COORDS, resolveJobCoordinates } from '../lib/araucariaLocations';

interface CompanyDashboardScreenProps {
  user: User;
  onLogout: () => void;
  onUpdateUser: (updatedUser: User) => void;
}

const ARAUCARIA_NEIGHBORHOODS = [
  'Centro', 'Costeira', 'Capela Velha', 'Fazenda Velha', 'Iguaçu',
  'Estação', 'Passa Dois', 'Tindiquera', 'Campina da Barra', 'Barigui', 'Boqueirão',
  'Thomaz Coelho', 'Itaqui', 'Polo Industrial / Petrobras', 'Araucária Sede', 'Outros'
];

const COMPANY_SEGMENTS = [
  'Comércio & Varejo', 'Indústria & Manufatura', 'Logística & Transportes',
  'Alimentação & Supermercados', 'Saúde & Farmácias', 'Tecnologia & TI',
  'Serviços Gerais & Limpeza', 'Construção Civil', 'Administrativo & Financeiro', 'Outros'
];

const NEIGHBORHOOD_COORDS = ARAUCARIA_NEIGHBORHOOD_COORDS;

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

const customJobIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="w-7 h-7 rounded-full bg-emerald-600 border-2 border-white shadow-xl flex items-center justify-center text-white font-bold text-xs">🏢</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const customNewJobIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="w-9 h-9 rounded-full bg-cyan-500 border-2 border-white shadow-2xl flex items-center justify-center text-white font-extrabold animate-bounce">🎯</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

export default function CompanyDashboardScreen({ user, onLogout, onUpdateUser }: CompanyDashboardScreenProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'candidates' | 'profile'>('overview');
  const [companyJobs, setCompanyJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJobFilter, setSelectedJobFilter] = useState<string>('all');

  // Modal para Informar Telefone do Candidato caso esteja ausente
  const [phoneModalApp, setPhoneModalApp] = useState<Application | null>(null);
  const [manualPhoneInput, setManualPhoneInput] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  // Modal de confirmação de exclusão de vaga e link direto WhatsApp
  const [jobToDeleteId, setJobToDeleteId] = useState<string | null>(null);
  const [deletingJob, setDeletingJob] = useState(false);
  const [whatsappReady, setWhatsappReady] = useState<{
    candidateName: string;
    jobTitle: string;
    phoneDisplay: string;
    url: string;
  } | null>(null);

  // Modal para Criar/Editar Vaga
  const [showJobModal, setShowJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobSalary, setJobSalary] = useState('');
  const [jobNeighborhood, setJobNeighborhood] = useState(user.companyNeighborhood || 'Centro');
  const [jobType, setJobType] = useState('CLT');
  const [jobRequirements, setJobRequirements] = useState('');
  const [jobLat, setJobLat] = useState<number>(-25.5859);
  const [jobLng, setJobLng] = useState<number>(-49.4047);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [searchAddress, setSearchAddress] = useState('');
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  const [jobStartDate, setJobStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [jobEndDate, setJobEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [jobWorkHours, setJobWorkHours] = useState('08:00 às 17:00 (Segunda a Sexta)');
  const [jobBenefits, setJobBenefits] = useState('Vale Transporte, Vale Refeição');
  const [jobWorkAddress, setJobWorkAddress] = useState(user.companyAddress || 'Centro, Araucária - PR');
  const [jobContactPhone, setJobContactPhone] = useState(user.phone || '');

  // Perfil da Empresa
  const [companyName, setCompanyName] = useState(user.companyName || user.name || '');
  const [cnpj, setCnpj] = useState(user.cnpj || '');
  const [responsibleName, setResponsibleName] = useState(user.responsibleName || user.name || '');
  const [responsibleRole, setResponsibleRole] = useState(user.responsibleRole || 'Gestor de Recursos Humanos');
  const [phone, setPhone] = useState(user.phone || '');
  const [companyEmail, setCompanyEmail] = useState(user.email || '');
  const [companyAddress, setCompanyAddress] = useState(user.companyAddress || 'Rua Major Sezino Pereira de Souza, Centro - Araucária');
  const [segment, setSegment] = useState(user.companySegment || 'Comércio & Varejo');
  const [neighborhood, setNeighborhood] = useState(user.companyNeighborhood || 'Centro');
  const [bio, setBio] = useState(user.bio || '');
  const [companyLogoUrl, setCompanyLogoUrl] = useState(user.companyLogoUrl || user.avatarUrl || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const companyIdentifier = user.companyName || user.name || 'Empresa';

  useEffect(() => {
    setCompanyName(user.companyName || user.name || '');
    setCnpj(user.cnpj || '');
    setResponsibleName(user.responsibleName || user.name || '');
    setResponsibleRole(user.responsibleRole || 'Gestor de Recursos Humanos');
    setPhone(user.phone || '');
    setCompanyEmail(user.email || '');
    setCompanyAddress(user.companyAddress || 'Rua Major Sezino Pereira de Souza, Centro - Araucária');
    setSegment(user.companySegment || 'Comércio & Varejo');
    setNeighborhood(user.companyNeighborhood || 'Centro');
    setBio(user.bio || '');
    setCompanyLogoUrl(user.companyLogoUrl || user.avatarUrl || '');
    fetchCompanyData();
  }, [user]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png');
          setCompanyLogoUrl(dataUrl);
          toast.success('Logo carregada! Clique em "Salvar Alterações" para salvar seu perfil.');
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setCompanyLogoUrl('');
    toast.info('Logo removida. Clique em "Salvar Alterações" para confirmar.');
  };

  const fetchCompanyData = async () => {
    setLoading(true);
    try {
      const safeCompany = sanitizePostgrestFilterValue(companyIdentifier);
      const safeUserName = sanitizePostgrestFilterValue(user.name);
      const safeEmail = sanitizePostgrestFilterValue((user.email || '').trim().toLowerCase());
      const filterParts: string[] = [];
      if (safeCompany) filterParts.push(`company.ilike.%${safeCompany}%`, `company_name.ilike.%${safeCompany}%`);
      if (safeUserName && safeUserName !== safeCompany) filterParts.push(`company.ilike.%${safeUserName}%`);
      if (safeEmail) filterParts.push(`company_contact_email.eq.${safeEmail}`);

      const jobsQuery = supabase.from('jobs').select('*');
      const { data: jobsData, error: jobsErr } = filterParts.length > 0
        ? await jobsQuery.or(filterParts.join(','))
        : await jobsQuery;

      let loadedJobs: Job[] = [];
      if (!jobsErr && jobsData && jobsData.length > 0) {
        loadedJobs = jobsData.map(j => {
          const baseJob: Job = {
            id: j.id,
            title: j.title,
            company: j.company || j.company_name || companyIdentifier,
            location: j.location,
            lat: j.lat ? Number(j.lat) : undefined,
            lng: j.lng ? Number(j.lng) : undefined,
            type: j.type,
            salary: j.salary,
            description: j.description,
            requirements: j.requirements ? (Array.isArray(j.requirements) ? j.requirements : [j.requirements]) : [],
            category: j.category || 'Geral',
            isRemote: Boolean(j.is_remote),
            logo: j.logo || j.company_logo_url || companyLogoUrl || 'Briefcase',
            dateString: j.posted_date || j.created_at || 'Hoje',
            active: true,
            startDate: j.start_date || j.startDate || undefined,
            endDate: j.end_date || j.endDate || undefined,
            workHours: j.work_hours || j.workHours || undefined,
            benefits: j.benefits ? (Array.isArray(j.benefits) ? j.benefits : [j.benefits]) : [],
            companyAddress: j.company_address || j.companyAddress || undefined,
            companyNeighborhood: j.company_neighborhood || j.companyNeighborhood || undefined,
            companyContactPhone: j.company_contact_phone || j.companyContactPhone || phone,
            companyContactEmail: j.company_contact_email || j.companyContactEmail || user.email,
            companyResponsibleName: j.company_responsible_name || j.companyResponsibleName || responsibleName,
            companyResponsibleRole: j.company_responsible_role || j.companyResponsibleRole || responsibleRole,
            companyLogoUrl: j.company_logo_url || j.companyLogoUrl || companyLogoUrl,
            cnpj: j.cnpj || cnpj,
            approvalStatus: j.approval_status || j.approvalStatus || 'accepted',
            approvedBy: j.approved_by || j.approvedBy,
            approvedAt: j.approved_at || j.approvedAt,
            acceptedCandidatesCount: j.accepted_candidates_count || 0
          };
          const resolved = resolveJobCoordinates(baseJob);
          return {
            ...baseJob,
            lat: resolved.lat,
            lng: resolved.lng
          };
        });
      } else {
        loadedJobs = mockJobs.filter(j => j.company.toLowerCase().includes(companyIdentifier.toLowerCase()));
      }
      setCompanyJobs(loadedJobs);

      const jobIds = loadedJobs.map(j => j.id);
      if (jobIds.length > 0) {
        const { data: appsData, error: appsErr } = await supabase
          .from('applications')
          .select('*')
          .in('job_id', jobIds);

        if (!appsErr && appsData) {
          const mappedApps: Application[] = appsData.map(app => ({
            id: app.id,
            jobId: app.job_id,
            jobTitle: app.job_title || loadedJobs.find(j => j.id === app.job_id)?.title || 'Vaga',
            company: companyName,
            appliedDate: app.applied_at || app.created_at || 'Hoje',
            status: (app.status === 'accepted' ? 'Aprovado' : app.status === 'hired' ? 'Aprovado' : app.status === 'rejected' ? 'Reprovado' : 'Em análise') as Application['status'],
            candidateName: app.candidate_name || 'Candidato',
            candidateEmail: app.candidate_email || '',
            candidatePhone: app.candidate_phone || app.phone || ''
          }));
          setApplications(mappedApps);
        } else {
          setApplications([]);
        }
      } else {
        setApplications([]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados da empresa.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !cnpj.trim()) {
      toast.error('Preencha o Nome da Empresa e o CNPJ.');
      return;
    }

    setSavingProfile(true);
    try {
      const updatedUser: User = {
        ...user,
        companyName,
        name: companyName,
        cnpj,
        responsibleName,
        responsibleRole,
        phone,
        companyAddress,
        companySegment: segment,
        companyNeighborhood: neighborhood,
        bio,
        companyLogoUrl,
        avatarUrl: companyLogoUrl || user.avatarUrl
      };

      if (user.id && !user.id.startsWith('mock-')) {
        await supabase.from('users').update({
          name: companyName,
          company_name: companyName,
          cnpj,
          responsible_name: responsibleName,
          responsible_role: responsibleRole,
          phone,
          company_address: companyAddress,
          company_segment: segment,
          company_neighborhood: neighborhood,
          bio,
          company_logo_url: companyLogoUrl,
          avatar_url: companyLogoUrl
        }).eq('id', user.id);
      }

      onUpdateUser(updatedUser);
      toast.success('Perfil da empresa atualizado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar perfil.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOpenNewJobModal = () => {
    setEditingJob(null);
    setJobTitle('');
    setJobDescription('');
    setJobSalary('');
    setJobNeighborhood(neighborhood || 'Centro');
    setJobType('CLT');
    setJobRequirements('');
    setJobStartDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setJobEndDate(d.toISOString().split('T')[0]);
    setJobWorkHours('08:00 às 17:00 (Segunda a Sexta)');
    setJobBenefits('Vale Transporte, Vale Refeição, Plano de Saúde');
    setJobWorkAddress(companyAddress || 'Centro, Araucária - PR');
    setJobContactPhone(phone || '');
    
    const defCoords = NEIGHBORHOOD_COORDS[neighborhood || 'Centro'] || [-25.5859, -49.4047];
    setJobLat(defCoords[0]);
    setJobLng(defCoords[1]);
    setShowJobModal(true);
  };

  const handleOpenEditJob = (job: Job) => {
    setEditingJob(job);
    setJobTitle(job.title);
    setJobDescription(job.description);
    setJobSalary(job.salary);
    setJobNeighborhood(job.companyNeighborhood || job.location.split(',')[0]?.trim() || 'Centro');
    setJobType(job.type);
    setJobRequirements(job.requirements?.join(', ') || '');
    setJobStartDate(job.startDate || new Date().toISOString().split('T')[0]);
    setJobEndDate(job.endDate || new Date().toISOString().split('T')[0]);
    setJobWorkHours(job.workHours || '08:00 às 17:00');
    setJobBenefits(job.benefits?.join(', ') || '');
    setJobWorkAddress(job.companyAddress || job.location);
    setJobContactPhone(job.companyContactPhone || phone);
    setJobLat(job.lat || -25.5859);
    setJobLng(job.lng || -49.4047);
    setShowJobModal(true);
  };

  const handleSaveJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim() || !jobDescription.trim() || !jobSalary.trim()) {
      toast.error('Preencha os campos obrigatórios da vaga (Título, Descrição e Salário).');
      return;
    }

    try {
      const requirementsArr = jobRequirements.split(',').map(r => r.trim()).filter(Boolean);
      const benefitsArr = jobBenefits.split(',').map(b => b.trim()).filter(Boolean);
      const locationStr = `${jobNeighborhood}, Araucária - PR`;

      const jobPayload = {
        title: jobTitle.trim(),
        company: companyName,
        company_name: companyName,
        location: locationStr,
        lat: jobLat,
        lng: jobLng,
        type: jobType,
        salary: jobSalary.trim(),
        description: jobDescription.trim(),
        requirements: requirementsArr,
        category: segment,
        is_remote: false,
        logo: companyLogoUrl || 'Briefcase',
        posted_date: 'Hoje',
        start_date: jobStartDate,
        end_date: jobEndDate,
        work_hours: jobWorkHours,
        benefits: benefitsArr,
        company_address: jobWorkAddress,
        company_neighborhood: jobNeighborhood,
        company_contact_phone: jobContactPhone,
        company_contact_email: companyEmail,
        company_responsible_name: responsibleName,
        company_responsible_role: responsibleRole,
        company_logo_url: companyLogoUrl,
        cnpj: cnpj,
        approval_status: 'accepted',
        accepted_candidates_count: editingJob ? (editingJob.acceptedCandidatesCount || 0) : 0
      };

      if (editingJob && !editingJob.id.startsWith('mock-')) {
        const { error } = await supabase.from('jobs').update(jobPayload).eq('id', editingJob.id);
        if (error) throw error;
        toast.success('Vaga atualizada com sucesso!');
      } else {
        const { error } = await supabase.from('jobs').insert([jobPayload]);
        if (error) throw error;
        toast.success('Nova vaga publicada com sucesso no mural de Araucária!');
      }

      setShowJobModal(false);
      fetchCompanyData();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar vaga.');
    }
  };

  const handleConfirmDeleteJob = async () => {
    if (!jobToDeleteId) return;
    setDeletingJob(true);
    try {
      if (!jobToDeleteId.startsWith('mock-')) {
        const { error } = await supabase.from('jobs').delete().eq('id', jobToDeleteId);
        if (error) throw error;
      }
      deleteJobPermanently(jobToDeleteId);
      toast.success('Vaga excluída com sucesso.');
      setJobToDeleteId(null);
      fetchCompanyData();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir vaga.');
    } finally {
      setDeletingJob(false);
    }
  };

  const handleUpdateApplicationStatus = async (appId: string, newStatus: Application['status']) => {
    try {
      const dbStatus = newStatus === 'Aprovado' ? 'accepted' : newStatus === 'Reprovado' ? 'rejected' : 'pending';
      if (!appId.startsWith('mock-')) {
        const { error } = await supabase.from('applications').update({ status: dbStatus }).eq('id', appId);
        if (error) throw error;
      }
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
      toast.success(`Status do candidato atualizado para: ${newStatus}`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar status.');
    }
  };

  const handleOpenWhatsApp = (app: Application) => {
    const rawPhone = app.candidatePhone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setPhoneModalApp(app);
      setManualPhoneInput('');
      return;
    }

    const job = companyJobs.find(j => j.id === app.jobId);
    const jTitle = job?.title || app.jobTitle || 'Vaga em Araucária';
    const message = encodeURIComponent(`Olá ${app.candidateName}! Entramos em contato da empresa ${companyName} referente à vaga de ${jTitle} no Portal Araucária Oportuniza. Podemos conversar?`);
    const waUrl = `https://wa.me/55${cleanPhone}?text=${message}`;

    setWhatsappReady({
      candidateName: app.candidateName || 'Candidato',
      jobTitle: jTitle,
      phoneDisplay: rawPhone,
      url: waUrl
    });
  };

  const handleSavePhoneAndOpenWhatsApp = async () => {
    if (!phoneModalApp) return;
    const clean = manualPhoneInput.replace(/\D/g, '');
    if (clean.length < 10) {
      toast.error('Digite um número de WhatsApp válido com DDD (ex: 41999998888).');
      return;
    }

    setSavingPhone(true);
    try {
      if (!phoneModalApp.id.startsWith('mock-')) {
        await supabase.from('applications').update({ candidate_phone: manualPhoneInput }).eq('id', phoneModalApp.id);
      }
      setApplications(prev => prev.map(a => a.id === phoneModalApp.id ? { ...a, candidatePhone: manualPhoneInput } : a));
      
      const job = companyJobs.find(j => j.id === phoneModalApp.jobId);
      const jTitle = job?.title || phoneModalApp.jobTitle || 'Vaga';
      const message = encodeURIComponent(`Olá ${phoneModalApp.candidateName || 'Candidato'}! Entramos em contato da empresa ${companyName} referente à vaga de ${jTitle} no Portal Araucária Oportuniza.`);
      const waUrl = `https://wa.me/55${clean}&text=${message}`;

      setPhoneModalApp(null);
      setWhatsappReady({
        candidateName: phoneModalApp.candidateName || 'Candidato',
        jobTitle: jTitle,
        phoneDisplay: manualPhoneInput,
        url: waUrl
      });
      toast.success('Telefone salvo com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar telefone.');
    } finally {
      setSavingPhone(false);
    }
  };

  const totalJobsCount = companyJobs.length;
  const acceptedJobsCount = companyJobs.filter(j => j.approvalStatus === 'accepted' || !j.approvalStatus).length;
  const totalAppsCount = applications.length;
  const hiredCount = applications.filter(a => a.status === 'Aprovado').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Header Corporativo Ultra Profissional */}
      <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-xl sticky top-0 z-40 px-4 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center shadow-xl shadow-emerald-950/50">
              {companyLogoUrl ? (
                <img src={companyLogoUrl} alt="Logo" className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <Building2 className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">{companyName}</h1>
                <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Painel RH & Empresas
                </span>
              </div>
              <p className="text-xs text-slate-400">CNPJ: {cnpj || 'Não informado'} • Araucária, PR</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={handleOpenNewJobModal}
              className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Publicar Nova Vaga</span>
            </button>
            <button
              onClick={onLogout}
              className="p-2.5 bg-slate-800/80 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-800/50 border border-slate-700/80 rounded-xl transition-all text-slate-400 cursor-pointer"
              title="Sair da Conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div className="max-w-7xl mx-auto flex items-center gap-2 mt-4 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'overview'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Visão Geral</span>
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'jobs'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Minhas Vagas ({totalJobsCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('candidates')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'candidates'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Candidatos Inscritos ({totalAppsCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'profile'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Dados da Empresa & Endereço</span>
          </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto w-full p-4 lg:p-8 flex-1 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        )}

        {!loading && activeTab === 'overview' && (
          <div className="space-y-6 animate-fadeIn">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-emerald-500/50 transition-all">
                <div className="absolute right-3 top-3 w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                  <Briefcase className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-400">Vagas Cadastradas</p>
                <h3 className="text-2xl font-black text-white mt-2">{totalJobsCount}</h3>
                <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" /> Ativas no portal Araucária
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-cyan-500/50 transition-all">
                <div className="absolute right-3 top-3 w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-400">Vagas Publicadas</p>
                <h3 className="text-2xl font-black text-white mt-2">{acceptedJobsCount}</h3>
                <p className="text-[11px] text-cyan-400 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Aprovadas pela administração
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-amber-500/50 transition-all">
                <div className="absolute right-3 top-3 w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-400">Candidatos Aprovados</p>
                <h3 className="text-2xl font-black text-white mt-2">{hiredCount}</h3>
                <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Vagas preenchidas com sucesso
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-purple-500/50 transition-all">
                <div className="absolute right-3 top-3 w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-400">Total de Inscritos</p>
                <h3 className="text-2xl font-black text-white mt-2">{totalAppsCount}</h3>
                <p className="text-[11px] text-purple-400 mt-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> Currículos recebidos
                </p>
              </div>
            </div>

            {/* Painel Principal com Ações Rápidas & Candidatos Recentes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" /> Candidatos Recentes nas Vagas
                  </h3>
                  <button
                    onClick={() => setActiveTab('candidates')}
                    className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Ver todos ({totalAppsCount}) <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {applications.length === 0 ? (
                  <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-slate-800/80">
                    <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-300">Nenhum candidato inscrito ainda.</p>
                    <p className="text-xs text-slate-500 mt-1">Publique novas vagas para atrair talentos qualificados em Araucária.</p>
                    <button
                      onClick={handleOpenNewJobModal}
                      className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Publicar Vaga Agora
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {applications.slice(0, 5).map(app => (
                      <div key={app.id} className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-700 transition-all">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                            {(app.candidateName || 'C').charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white">{app.candidateName || 'Candidato'}</h4>
                            <p className="text-[11px] text-emerald-400 font-medium">Vaga: {app.jobTitle}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{app.candidatePhone || 'Telefone não informado'} • {app.candidateEmail}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            app.status === 'Aprovado' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                            app.status === 'Entrevista' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' :
                            app.status === 'Reprovado' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                            'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          }`}>
                            {app.status}
                          </span>
                          <button
                            onClick={() => handleOpenWhatsApp(app)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                          >
                            <Phone className="w-3.5 h-3.5 fill-current" />
                            <span>WhatsApp</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cartão de Resumo da Empresa */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-cyan-400" /> Dados Corporativos
                  </h3>
                  <button
                    onClick={() => setActiveTab('profile')}
                    className="text-xs font-bold text-cyan-400 hover:underline cursor-pointer"
                  >
                    Editar Perfil
                  </button>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                      {companyLogoUrl ? (
                        <img src={companyLogoUrl} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{companyName}</h4>
                      <p className="text-[10px] text-emerald-400 font-medium">Conta Verificada no Portal</p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">CNPJ:</span>
                      <span className="font-mono font-bold">{cnpj || 'Não informado'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">Responsável:</span>
                      <span className="font-medium">{responsibleName}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">E-mail:</span>
                      <span className="font-medium truncate max-w-[180px]">{companyEmail}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">Telefone:</span>
                      <span className="font-mono font-medium">{phone || 'Não informado'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">Endereço:</span>
                      <span className="truncate max-w-[180px]">{companyAddress}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleOpenNewJobModal}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Publicar Nova Vaga Agora</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && activeTab === 'jobs' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquisar nas suas vagas por título ou bairro..."
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              </div>

              <button
                onClick={handleOpenNewJobModal}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Nova Vaga</span>
              </button>
            </div>

            {companyJobs.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
                <Briefcase className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-white">Nenhuma vaga cadastrada ainda</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">Clique no botão abaixo para criar sua primeira oportunidade de emprego em Araucária.</p>
                <button
                  onClick={handleOpenNewJobModal}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Publicar Primeira Vaga
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {companyJobs
                  .filter(j => j.title.toLowerCase().includes(searchTerm.toLowerCase()) || j.location.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map(job => {
                    const jobAppsCount = applications.filter(a => a.jobId === job.id).length;
                    return (
                      <div key={job.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold rounded-full">
                                {job.type}
                              </span>
                              <h3 className="text-sm font-bold text-white mt-2">{job.title}</h3>
                            </div>
                            <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-800 px-3 py-1 rounded-xl">
                              {job.salary}
                            </span>
                          </div>

                          <div className="space-y-1.5 text-xs text-slate-400">
                            <p className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-500" /> {job.location}
                            </p>
                            <p className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-500" /> Início: {job.startDate || 'Imediato'} • Término: {job.endDate || 'Indeterminado'}
                            </p>
                          </div>

                          <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{job.description}</p>
                        </div>

                        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                          <span className="text-xs font-bold text-purple-400 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" /> {jobAppsCount} candidatos inscritos
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenEditJob(job)}
                              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors cursor-pointer"
                              title="Editar Vaga"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setJobToDeleteId(job.id)}
                              className="p-2 bg-slate-800 hover:bg-rose-950/50 text-rose-400 rounded-xl transition-colors cursor-pointer"
                              title="Excluir Vaga"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'candidates' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquisar candidato por nome ou vaga..."
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              </div>

              <select
                value={selectedJobFilter}
                onChange={(e) => setSelectedJobFilter(e.target.value)}
                className="px-4 py-2.5 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs font-medium focus:outline-none"
              >
                <option value="all">Todas as Vagas</option>
                {companyJobs.map(j => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
            </div>

            {applications.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
                <Users className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-white">Nenhum candidato inscrito</h3>
                <p className="text-xs text-slate-400">Os currículos enviados pelos candidatos aparecerão aqui.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {applications
                  .filter(app => {
                    const matchesSearch = (app.candidateName || '').toLowerCase().includes(searchTerm.toLowerCase()) || app.jobTitle.toLowerCase().includes(searchTerm.toLowerCase());
                    const matchesJob = selectedJobFilter === 'all' || app.jobId === selectedJobFilter;
                    return matchesSearch && matchesJob;
                  })
                  .map(app => (
                    <div key={app.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-cyan-500 text-white flex items-center justify-center font-black text-lg shadow-lg shrink-0">
                          {(app.candidateName || 'C').charAt(0)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white">{app.candidateName || 'Candidato'}</h3>
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-full">
                              Vaga: {app.jobTitle}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">
                            {app.candidatePhone || 'Telefone não informado'} • {app.candidateEmail}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto justify-end">
                        <select
                          value={app.status || 'Em análise'}
                          onChange={(e) => handleUpdateApplicationStatus(app.id, e.target.value as Application['status'])}
                          className="px-3 py-2 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs font-bold focus:outline-none"
                        >
                          <option value="Em análise">Em Análise</option>
                          <option value="Entrevista">Entrevista</option>
                          <option value="Aprovado">Aprovado</option>
                          <option value="Reprovado">Reprovado</option>
                        </select>

                        <button
                          onClick={() => handleOpenWhatsApp(app)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
                        >
                          <Phone className="w-4 h-4 fill-current" />
                          <span>WhatsApp</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 lg:p-8 shadow-xl space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-400" /> Perfil Corporativo & Endereço em Araucária
                </h3>
                <p className="text-xs text-slate-400">Atualize os dados da sua empresa exibidos para os candidatos no portal.</p>
              </div>
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Salvar Alterações</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Logo Upload */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-300 block">Logo da Empresa</label>
                <div className="flex flex-col items-center justify-center p-6 bg-slate-950 border-2 border-dashed border-slate-800 rounded-2xl text-center space-y-3">
                  <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shadow-xl">
                    {companyLogoUrl ? (
                      <img src={companyLogoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-8 h-8 text-slate-500" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <label className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors inline-flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" /> Enviar Logo
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                    {companyLogoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-3 py-2 bg-rose-600/20 text-rose-400 border border-rose-800 hover:bg-rose-600/30 font-bold text-xs rounded-xl transition-colors"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Dados Principais */}
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Nome da Empresa *</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">CNPJ *</label>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      placeholder="00.000.000/0001-00"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Nome do Responsável RH</label>
                    <input
                      type="text"
                      value={responsibleName}
                      onChange={(e) => setResponsibleName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Cargo do Responsável</label>
                    <input
                      type="text"
                      value={responsibleRole}
                      onChange={(e) => setResponsibleRole(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Telefone / WhatsApp Comercial</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(41) 3642-0000"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">E-mail de Contato</label>
                    <input
                      type="email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Segmento de Atuação</label>
                    <select
                      value={segment}
                      onChange={(e) => setSegment(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none"
                    >
                      {COMPANY_SEGMENTS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Bairro em Araucária</label>
                    <select
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none"
                    >
                      {ARAUCARIA_NEIGHBORHOODS.map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Endereço Completo</label>
                  <input
                    type="text"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Sobre a Empresa (Apresentação)</label>
                  <textarea
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Descreva a história, missão e valores da empresa..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </form>
        )}
      </main>

      {/* Modal Criar / Editar Vaga */}
      {showJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 lg:p-8 max-w-3xl w-full shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-emerald-400" /> {editingJob ? 'Editar Vaga de Emprego' : 'Publicar Nova Vaga em Araucária'}
                </h3>
                <p className="text-xs text-slate-400">Preencha os detalhes da oportunidade para divulgar aos candidatos locais.</p>
              </div>
              <button
                onClick={() => setShowJobModal(false)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveJobSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Título da Vaga *</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Ex: Operador de Empilhadeira"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Salário / Remuneração *</label>
                  <input
                    type="text"
                    value={jobSalary}
                    onChange={(e) => setJobSalary(e.target.value)}
                    placeholder="Ex: R$ 2.800,00 + Benefícios"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Tipo de Contrato</label>
                  <select
                    value={jobType}
                    onChange={(e) => setJobType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none"
                  >
                    <option value="CLT">CLT Efetivo</option>
                    <option value="PJ">PJ (Pessoa Jurídica)</option>
                    <option value="Temporário">Temporário</option>
                    <option value="Estágio">Estágio</option>
                    <option value="Menor Aprendiz">Menor Aprendiz</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Bairro em Araucária</label>
                  <select
                    value={jobNeighborhood}
                    onChange={(e) => {
                      setJobNeighborhood(e.target.value);
                      const coords = NEIGHBORHOOD_COORDS[e.target.value] || [-25.5859, -49.4047];
                      setJobLat(coords[0]);
                      setJobLng(coords[1]);
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none"
                  >
                    {ARAUCARIA_NEIGHBORHOODS.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Horário de Trabalho</label>
                  <input
                    type="text"
                    value={jobWorkHours}
                    onChange={(e) => setJobWorkHours(e.target.value)}
                    placeholder="Ex: 08:00 às 17:00"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Data de Início das Inscrições</label>
                  <input
                    type="date"
                    value={jobStartDate}
                    onChange={(e) => setJobStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Data Limite / Encerramento</label>
                  <input
                    type="date"
                    value={jobEndDate}
                    onChange={(e) => setJobEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Benefícios Oferecidos (separados por vírgula)</label>
                <input
                  type="text"
                  value={jobBenefits}
                  onChange={(e) => setJobBenefits(e.target.value)}
                  placeholder="Ex: Vale Transporte, Vale Refeição, Plano de Saúde"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Descrição Detalhada das Atividades *</label>
                <textarea
                  rows={3}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Descreva as responsabilidades, rotina e exigências da vaga..."
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Requisitos e Experiência Exigida (separados por vírgula)</label>
                <input
                  type="text"
                  value={jobRequirements}
                  onChange={(e) => setJobRequirements(e.target.value)}
                  placeholder="Ex: Ensino Médio Completo, Categoria D, 1 ano de experiência"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none"
                />
              </div>

              {/* Mapa Interativo Leaflet para Escolher Localização da Vaga */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-400" /> Localização Exata no Mapa de Araucária
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsMapFullscreen(true)}
                    className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" /> Tela Cheia
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">Clique no mapa para marcar o endereço exato da empresa/vaga em Araucária.</p>

                <div className="h-48 rounded-2xl overflow-hidden border border-slate-800 relative z-0">
                  {(() => {
                    const safeLat = typeof jobLat === 'number' && !isNaN(jobLat) ? jobLat : -25.5859;
                    const safeLng = typeof jobLng === 'number' && !isNaN(jobLng) ? jobLng : -49.4047;
                    return (
                      <MapContainer
                        center={[safeLat, safeLng]}
                        zoom={13}
                        style={{ width: '100%', height: '100%' }}
                        zoomControl={false}
                      >
                        <MapController center={[safeLat, safeLng]} />
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapClickHandler onMapClick={(lat, lng) => {
                          setJobLat(lat);
                          setJobLng(lng);
                          toast.success(`Localização da vaga definida: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                        }} />
                        <Marker position={[safeLat, safeLng]} icon={customNewJobIcon}>
                          <Popup>
                            <div className="text-xs font-bold text-emerald-600">Local da Vaga</div>
                          </Popup>
                        </Marker>
                      </MapContainer>
                    );
                  })()}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowJobModal(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
                >
                  {editingJob ? 'Salvar Alterações' : 'Publicar Vaga no Mural'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tela Cheia do Mapa */}
      {isMapFullscreen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col p-4 md:p-8">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-400" /> Selecionar Localização da Vaga em Tela Cheia
                </h3>
                <p className="text-xs text-slate-400">Clique em qualquer ponto do mapa para definir a posição exata.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-3 py-1.5 rounded-xl border border-emerald-800">
                  {typeof jobLat === 'number' && !isNaN(jobLat) ? jobLat.toFixed(4) : '-25.5859'}, {typeof jobLng === 'number' && !isNaN(jobLng) ? jobLng.toFixed(4) : '-49.4047'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsMapFullscreen(false)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Confirmar
                </button>
              </div>
            </div>
            <div className="flex-1 relative z-0">
              {(() => {
                const safeLat = typeof jobLat === 'number' && !isNaN(jobLat) ? jobLat : -25.5859;
                const safeLng = typeof jobLng === 'number' && !isNaN(jobLng) ? jobLng : -49.4047;
                return (
                  <MapContainer
                    center={[safeLat, safeLng]}
                    zoom={14}
                    style={{ width: '100%', height: '100%' }}
                    zoomControl={true}
                  >
                    <MapController center={[safeLat, safeLng]} />
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapClickHandler onMapClick={(lat, lng) => {
                      setJobLat(lat);
                      setJobLng(lng);
                      toast.success(`Localização definida: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                    }} />
                    <Marker position={[safeLat, safeLng]} icon={customNewJobIcon}>
                      <Popup>
                        <div className="text-xs font-bold text-emerald-600">Local da Vaga</div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal Telefone Candidato */}
      {phoneModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Chamar no WhatsApp</h3>
                  <p className="text-xs text-slate-400">{phoneModalApp.candidateName || 'Candidato'}</p>
                </div>
              </div>
              <button onClick={() => setPhoneModalApp(null)} className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              O candidato <strong>{phoneModalApp.candidateName || 'Candidato'}</strong> ainda não informou o telefone. Digite o WhatsApp com DDD abaixo:
            </p>

            <input
              type="tel"
              value={manualPhoneInput}
              onChange={(e) => setManualPhoneInput(e.target.value)}
              placeholder="(41) 99999-9999"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPhoneModalApp(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSavePhoneAndOpenWhatsApp}
                disabled={savingPhone}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                {savingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                <span>Salvar e Abrir WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação Exclusão Vaga */}
      {jobToDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Excluir vaga definitivamente?</h3>
              <p className="text-xs text-slate-400 mt-1">Esta ação removerá a vaga do mural público.</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={deletingJob}
                onClick={() => setJobToDeleteId(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingJob}
                onClick={handleConfirmDeleteJob}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                {deletingJob ? 'Excluindo...' : 'Excluir Vaga'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal WhatsApp Pronto */}
      {whatsappReady && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Conversa no WhatsApp Pronta</h3>
                  <p className="text-xs text-slate-400">{whatsappReady.candidateName}</p>
                </div>
              </div>
              <button onClick={() => setWhatsappReady(null)} className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300 space-y-1">
              <p>Vaga: <strong>{whatsappReady.jobTitle}</strong></p>
              <p>Telefone: <strong className="font-mono">{whatsappReady.phoneDisplay}</strong></p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setWhatsappReady(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Fechar
              </button>
              <a
                href={whatsappReady.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setWhatsappReady(null)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md"
              >
                <Phone className="w-4 h-4 fill-current" />
                <span>Abrir no WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

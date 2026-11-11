import React, { useState, useEffect } from 'react';
import { 
  Building2, Briefcase, Users, Plus, CheckCircle2, Clock, XCircle, 
  MapPin, Phone, Mail, FileText, Trash2, Edit3, Eye, LogOut, Search,
  AlertCircle, ShieldCheck, Award, ChevronRight, Check, X, Sparkles, Maximize2, Minimize2, Loader2,
  Upload, Image as ImageIcon, Calendar, DollarSign, UserCheck, CheckCircle
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { User, Job, Application } from '../types';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../lib/toast';
import { mockJobs, deleteJobPermanently } from '../data';
import { sanitizeExternalUrl } from '../lib/securityValidation';

interface CompanyDashboardScreenProps {
  user: User;
  onLogout: () => void;
  onUpdateUser: (updatedUser: User) => void;
}

const ARAUCARIA_NEIGHBORHOODS = [
  'Centro', 'Costeira', 'Capela Velha', 'Fazenda Velha', 'Iguaçu',
  'Passa Dois', 'Tindiquera', 'Campina da Barra', 'Barigui', 'Boqueirão',
  'Thomaz Coelho', 'Itaqui', 'Araucária Sede', 'Outros'
];

const COMPANY_SEGMENTS = [
  'Comércio & Varejo', 'Indústria & Manufatura', 'Logística & Transportes',
  'Alimentação & Supermercados', 'Saúde & Farmácias', 'Tecnologia & TI',
  'Serviços Gerais & Limpeza', 'Construção Civil', 'Administrativo & Financeiro', 'Outros'
];

const NEIGHBORHOOD_COORDS: Record<string, { lat: number; lng: number }> = {
  'Centro': { lat: -25.5890, lng: -49.4150 },
  'Costeira': { lat: -25.5650, lng: -49.4020 },
  'Capela Velha': { lat: -25.6100, lng: -49.3900 },
  'Fazenda Velha': { lat: -25.5780, lng: -49.4250 },
  'Iguaçu': { lat: -25.5500, lng: -49.3800 },
  'Passa Dois': { lat: -25.5200, lng: -49.3700 },
  'Tindiquera': { lat: -25.5350, lng: -49.4400 },
  'Campina da Barra': { lat: -25.5320, lng: -49.3500 },
  'Barigui': { lat: -25.5900, lng: -49.3600 },
  'Boqueirão': { lat: -25.5800, lng: -49.3400 },
  'Thomaz Coelho': { lat: -25.5450, lng: -49.4100 },
  'Itaqui': { lat: -25.5150, lng: -49.4200 },
  'Araucária Sede': { lat: -25.5890, lng: -49.4150 },
  'Outros': { lat: -25.5890, lng: -49.4150 }
};

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
  html: `<div class="w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs">📍</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const customNewJobIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-white font-extrabold animate-bounce">🎯</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
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

  // Modal para Criar/Editar Vaga
  const [showJobModal, setShowJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobSalary, setJobSalary] = useState('');
  const [jobNeighborhood, setJobNeighborhood] = useState(user.companyNeighborhood || 'Centro');
  const [jobType, setJobType] = useState('CLT');
  const [jobRequirements, setJobRequirements] = useState('');
  const [jobLat, setJobLat] = useState<number>(-25.5890);
  const [jobLng, setJobLng] = useState<number>(-49.4150);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [searchAddress, setSearchAddress] = useState('');
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  // Novos campos obrigatórios solicitados: Data de Início e Final, jornada, endereço e benefícios
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

  const handleSearchStreet = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchAddress.trim()) return;

    setIsSearchingAddress(true);
    try {
      const query = `${searchAddress}, Araucária, Paraná, Brasil`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
        headers: {
          'Accept-Language': 'pt-BR'
        }
      });
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setJobLat(lat);
        setJobLng(lon);
        toast.success(`Rua encontrada: ${data[0].display_name}`);
        setSearchAddress('');
      } else {
        const res2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}&limit=1`, {
          headers: {
            'Accept-Language': 'pt-BR'
          }
        });
        const data2 = await res2.json();
        if (data2 && data2.length > 0) {
          const lat = parseFloat(data2[0].lat);
          const lon = parseFloat(data2[0].lon);
          setJobLat(lat);
          setJobLng(lon);
          toast.success(`Endereço encontrado: ${data2[0].display_name}`);
          setSearchAddress('');
        } else {
          toast.error('Endereço ou rua não encontrado. Tente digitar o nome da rua e o bairro.');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao buscar endereço.');
    } finally {
      setIsSearchingAddress(false);
    }
  };

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
      // 1. Carregar vagas da empresa
      const { data: jobsData, error: jobsErr } = await supabase
        .from('jobs')
        .select('*')
        .or(`company.ilike.%${companyIdentifier}%,company.ilike.%${user.name}%`);

      if (!jobsErr && jobsData) {
        const mappedJobs: Job[] = jobsData.map(j => ({
          id: j.id,
          title: j.title,
          company: j.company || j.company_name || companyIdentifier,
          location: j.location,
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
        }));
        setCompanyJobs(mappedJobs);

        // 2. Carregar candidaturas para estas vagas
        const jobTitles = mappedJobs.map(j => j.title);
        const jobIds = mappedJobs.map(j => j.id);

        if (jobTitles.length > 0 || jobIds.length > 0) {
          const [appsRes, usersRes] = await Promise.all([
            supabase.from('applications').select('*'),
            supabase.from('users').select('id, name, email, phone')
          ]);

          const appsData = appsRes.data;
          const usersList = usersRes.data || [];

          if (appsData && Array.isArray(appsData)) {
            const filteredApps = appsData.filter(app => {
              const matchesCompany = app.company && app.company.toLowerCase().includes(companyIdentifier.toLowerCase());
              const matchesJobId = jobIds.includes(app.job_id);
              return matchesCompany || matchesJobId;
            });

            const mappedApps: Application[] = filteredApps.map(app => {
              let cName = app.candidate_name || 'Candidato';
              let cEmail = '';
              let cPhone = '';
              if (cName.includes('|')) {
                const parts = cName.split('|');
                cName = parts[0].trim();
                if (parts.length > 1) cEmail = parts[1].trim();
                if (parts.length > 2) cPhone = parts[2].trim();
              }

              // Match candidate in users table to retrieve phone if missing
              const matchedUser = usersList.find(u => 
                (app.user_id && u.id === app.user_id) ||
                (cEmail && u.email && u.email.toLowerCase() === cEmail.toLowerCase()) ||
                (cName && u.name && u.name.trim().toLowerCase() === cName.trim().toLowerCase())
              );

              const resolvedPhone = cPhone || app.candidate_phone || matchedUser?.phone || undefined;
              const resolvedEmail = cEmail || app.candidate_email || matchedUser?.email || undefined;

              const rawSt = (app.status || 'Em análise').toLowerCase();
              let normalizedSt: 'Em análise' | 'Entrevista' | 'Aprovado' | 'Reprovado' = 'Em análise';
              if (rawSt.includes('entrevista')) normalizedSt = 'Entrevista';
              else if (rawSt.includes('aprovad')) normalizedSt = 'Aprovado';
              else if (rawSt.includes('reprovad')) normalizedSt = 'Reprovado';

              return {
                id: app.id,
                jobId: app.job_id,
                jobTitle: app.job_title,
                company: app.company,
                appliedDate: app.created_at ? new Date(app.created_at).toLocaleDateString('pt-BR') : 'Hoje',
                status: normalizedSt,
                candidateName: cName,
                candidateEmail: resolvedEmail,
                candidatePhone: resolvedPhone,
                cvLink: app.cv_link,
                cvFileName: app.cv_file_name
              };
            });
            setApplications(mappedApps);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados da empresa:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNewJobModal = () => {
    setEditingJob(null);
    setJobTitle('');
    setJobDescription('');
    setJobSalary('');
    setJobRequirements('');
    setJobStartDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setJobEndDate(d.toISOString().split('T')[0]);
    setJobWorkHours('08:00 às 17:00 (Segunda a Sexta)');
    setJobBenefits('Vale Transporte, Vale Alimentação');
    setJobWorkAddress(companyAddress || 'Centro, Araucária - PR');
    setJobContactPhone(phone || '');
    const initialNeigh = (user.companyNeighborhood || 'Centro').trim();
    setJobNeighborhood(initialNeigh);
    const defCoords = NEIGHBORHOOD_COORDS[initialNeigh] || NEIGHBORHOOD_COORDS['Centro'];
    setJobLat(defCoords.lat);
    setJobLng(defCoords.lng);
    setShowJobModal(true);
  };

  const handleOpenEditJobModal = (job: Job) => {
    setEditingJob(job);
    setJobTitle(job.title);
    setJobDescription(job.description);
    setJobSalary(job.salary);
    setJobRequirements(job.requirements ? job.requirements.join('\n') : '');
    setJobStartDate(job.startDate || new Date().toISOString().split('T')[0]);
    setJobEndDate(job.endDate || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().split('T')[0];
    })());
    setJobWorkHours(job.workHours || '08:00 às 17:00 (Segunda a Sexta)');
    setJobBenefits(job.benefits ? (Array.isArray(job.benefits) ? job.benefits.join(', ') : String(job.benefits)) : 'Vale Transporte, Vale Refeição');
    setJobWorkAddress(job.companyAddress || companyAddress || job.location);
    setJobContactPhone(job.companyContactPhone || phone || '');

    let nName = 'Centro';
    if (job.location) {
      const parts = job.location.split('-');
      if (parts.length > 1) {
        nName = parts[parts.length - 1].trim();
      } else {
        nName = job.location.trim();
      }
    }
    setJobNeighborhood(nName);

    const coords = NEIGHBORHOOD_COORDS[nName] || NEIGHBORHOOD_COORDS['Centro'];
    setJobLat(job.lat || coords.lat);
    setJobLng(job.lng || coords.lng);
    setShowJobModal(true);
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim() || !jobDescription.trim()) {
      toast.error('Preencha o título e a descrição da vaga.');
      return;
    }

    if (!jobStartDate || !jobEndDate) {
      toast.error('É obrigatório informar a Data de Início e a Data Final das inscrições da vaga.');
      return;
    }

    if (new Date(jobEndDate) < new Date(jobStartDate)) {
      toast.error('A Data Final de encerramento não pode ser anterior à Data de Início.');
      return;
    }

    try {
      const reqList = jobRequirements.split('\n').filter(r => r.trim().length > 0);
      const benList = jobBenefits.split(',').map(b => b.trim()).filter(b => b.length > 0);
      const cleanNeighborhood = (jobNeighborhood || 'Centro').trim();
      const coords = NEIGHBORHOOD_COORDS[cleanNeighborhood] || NEIGHBORHOOD_COORDS['Centro'];
      const finalLat = (typeof jobLat === 'number' && !isNaN(jobLat)) ? jobLat : coords.lat;
      const finalLng = (typeof jobLng === 'number' && !isNaN(jobLng)) ? jobLng : coords.lng;
      const jobId = editingJob ? editingJob.id : `job-company-${Date.now()}`;

      const jobPayload = {
        id: jobId,
        title: jobTitle.trim(),
        company: companyIdentifier,
        company_name: companyIdentifier,
        category: 'Geral',
        description: jobDescription.trim(),
        requirements: reqList.length > 0 ? reqList : ['Ensino Médio', 'Disponibilidade de horário'],
        salary: jobSalary.trim() || 'A combinar',
        type: jobType,
        is_remote: false,
        location: `Araucária - ${cleanNeighborhood}`,
        lat: finalLat,
        lng: finalLng,
        logo: companyLogoUrl || 'Building2',
        dateString: 'Hoje',
        posted_date: new Date().toLocaleDateString('pt-BR'),
        start_date: jobStartDate,
        end_date: jobEndDate,
        work_hours: jobWorkHours.trim(),
        benefits: benList,
        company_address: jobWorkAddress.trim() || `${cleanNeighborhood}, Araucária - PR`,
        company_neighborhood: cleanNeighborhood,
        company_contact_phone: jobContactPhone.trim() || phone,
        company_contact_email: companyEmail || user.email,
        company_responsible_name: responsibleName || user.name,
        company_responsible_role: responsibleRole,
        company_logo_url: companyLogoUrl,
        cnpj: cnpj,
        approval_status: editingJob?.approvalStatus || 'accepted',
        approved_by: editingJob?.approvedBy || 'Homologação Automática Oportuniza',
        approved_at: editingJob?.approvedAt || new Date().toISOString()
      };

      let { error } = await supabase
        .from('jobs')
        .upsert([jobPayload]);

      if (error) {
        console.warn('First job upsert failed, retrying with core payload:', error);
        const basicPayload = {
          id: jobId,
          title: jobTitle.trim(),
          company: companyIdentifier,
          company_name: companyIdentifier,
          description: jobDescription.trim(),
          location: `Araucária - ${cleanNeighborhood}`,
          salary: jobSalary.trim() || 'A combinar',
          type: jobType,
          lat: finalLat,
          lng: finalLng
        };
        const retryRes = await supabase.from('jobs').upsert([basicPayload]);
        if (retryRes.error) {
          throw error;
        }
      }

      // Calculate new total jobs count for this company
      const updatedJobsCount = companyJobs.filter(j => j.id !== jobId).length + 1;

      // Sync company name and posted jobs count to Supabase 'companies' table
      try {
        await supabase
          .from('companies')
          .upsert({
            company_name: companyIdentifier,
            email: user.email.trim().toLowerCase(),
            responsible_name: responsibleName || user.name || 'RH',
            vagas_postadas: updatedJobsCount,
            posted_jobs_count: updatedJobsCount,
            updated_at: new Date().toISOString()
          }, { onConflict: 'email' });
      } catch (cErr) {
        console.warn('Companies count sync warning:', cErr);
      }

      // Sync to Supabase 'users' table
      try {
        await supabase
          .from('users')
          .update({
            company_name: companyIdentifier,
            vagas_postadas: updatedJobsCount,
            posted_jobs_count: updatedJobsCount
          })
          .eq('id', user.id);
      } catch (uErr) {
        console.warn('Users count sync warning:', uErr);
      }

      window.dispatchEvent(new Event('oportuniza-jobs-changed'));
      toast.success(editingJob ? 'Vaga atualizada e sincronizada com sucesso!' : 'Vaga publicada com início e término definidos!');

      setShowJobModal(false);
      setEditingJob(null);
      setJobTitle('');
      setJobDescription('');
      setJobSalary('');
      setJobRequirements('');
      fetchCompanyData();
    } catch (err: any) {
      toast.error('Erro ao salvar vaga: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta vaga definitivamente?')) return;
    try {
      await deleteJobPermanently(jobId);
      setCompanyJobs(prev => prev.filter(j => j.id !== jobId));
      toast.success('Vaga excluída com sucesso do mural e da base de dados!');
      fetchCompanyData();
    } catch (err) {
      toast.error('Erro ao excluir vaga.');
    }
  };

  const handleUpdateAppStatus = async (appId: string, newStatus: 'Em análise' | 'Entrevista' | 'Aprovado' | 'Reprovado') => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({ status: newStatus })
        .eq('id', appId);

      if (error) throw error;
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
      
      // Dispatch event so candidate screens update in real time
      window.dispatchEvent(new CustomEvent('oportuniza-application-updated', {
        detail: { appId, status: newStatus }
      }));

      toast.success(`Candidatura atualizada para: ${newStatus}`);
    } catch (err) {
      toast.error('Erro ao atualizar status do candidato.');
    }
  };

  const handleOpenWhatsApp = (app: Application) => {
    const rawDigits = (app.candidatePhone || '').replace(/\D/g, '');
    if (rawDigits && rawDigits.length >= 8) {
      const fullPhone = rawDigits.startsWith('55') ? rawDigits : `55${rawDigits}`;
      const whatsappMsg = `Olá ${app.candidateName}! Somos da equipe de RH da empresa ${companyIdentifier} pelo portal Oportuniza Araucária. Analisamos seu currículo para a vaga "${app.jobTitle}" e gostaríamos de agendar uma entrevista. Você tem disponibilidade?`;
      const waUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(whatsappMsg)}`;
      window.open(waUrl, '_blank');
    } else {
      setPhoneModalApp(app);
      setManualPhoneInput('');
    }
  };

  const handleSavePhoneAndOpenWhatsApp = async () => {
    if (!phoneModalApp) return;
    const rawDigits = manualPhoneInput.replace(/\D/g, '');
    if (rawDigits.length < 8) {
      toast.error('Por favor, informe um número com DDD (ex: 41 99999-9999).');
      return;
    }

    setSavingPhone(true);
    try {
      const formattedPhone = manualPhoneInput.trim();
      await supabase
        .from('applications')
        .update({ candidate_phone: formattedPhone })
        .eq('id', phoneModalApp.id);

      setApplications(prev => prev.map(a => a.id === phoneModalApp.id ? { ...a, candidatePhone: formattedPhone } : a));

      const fullPhone = rawDigits.startsWith('55') ? rawDigits : `55${rawDigits}`;
      const whatsappMsg = `Olá ${phoneModalApp.candidateName}! Somos da equipe de RH da empresa ${companyIdentifier} pelo portal Oportuniza Araucária. Analisamos seu currículo para a vaga "${phoneModalApp.jobTitle}" e gostaríamos de agendar uma entrevista. Você tem disponibilidade?`;
      const waUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(whatsappMsg)}`;
      window.open(waUrl, '_blank');

      toast.success('Telefone salvo e WhatsApp aberto!');
      setPhoneModalApp(null);
    } catch (err) {
      toast.error('Erro ao salvar telefone.');
    } finally {
      setSavingPhone(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatedUser: User = {
        ...user,
        name: companyName,
        companyName,
        companyLogoUrl: companyLogoUrl,
        avatarUrl: companyLogoUrl || user.avatarUrl,
        cnpj,
        responsibleName,
        responsibleRole,
        phone,
        companyAddress,
        companySegment: segment,
        companyNeighborhood: neighborhood,
        bio
      };

      try {
        localStorage.setItem('oportuniza-current-user', JSON.stringify(updatedUser));
      } catch (lsErr) {
        console.warn('LocalStorage save warning:', lsErr);
      }

      try {
        const userPayload = {
          id: user.id,
          name: companyName,
          email: user.email.trim().toLowerCase(),
          avatar_url: companyLogoUrl,
          company_logo_url: companyLogoUrl,
          company_name: companyName,
          cnpj,
          responsible_name: responsibleName,
          responsible_role: responsibleRole,
          phone,
          company_address: companyAddress,
          company_segment: segment,
          company_neighborhood: neighborhood,
          bio
        };

        const { error: upsertErr } = await supabase.from('users').upsert(userPayload, { onConflict: 'id' });
        if (upsertErr) {
          console.warn('Users upsert error, attempting update by email:', upsertErr);
          await supabase.from('users').update(userPayload).ilike('email', user.email.trim().toLowerCase());
        }
      } catch (uErr) {
        console.warn('Users table save error:', uErr);
      }

      try {
        await supabase.from('companies').upsert({
          company_name: companyName,
          email: user.email.trim().toLowerCase(),
          logo_url: companyLogoUrl,
          avatar_url: companyLogoUrl,
          cnpj,
          phone,
          segment,
          neighborhood,
          address: companyAddress,
          responsible_name: responsibleName,
          responsible_role: responsibleRole,
          bio
        }, { onConflict: 'email' });
      } catch (cErr) {
        console.warn('Companies table save error:', cErr);
      }

      onUpdateUser(updatedUser);
      toast.success('Perfil, contatos e endereço da empresa salvos com sucesso!');
    } catch (err) {
      toast.error('Erro ao salvar perfil.');
    }
  };

  const filteredApplications = applications.filter(app => {
    const matchesSearch = app.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          app.jobTitle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesJob = selectedJobFilter === 'all' || app.jobId === selectedJobFilter;
    return matchesSearch && matchesJob;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white flex flex-col">
      {/* Top Header */}
      <header className="bg-white dark:bg-[#131E32] border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#52A8C7] to-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
            {companyLogoUrl ? (
              <img src={companyLogoUrl} alt={companyIdentifier} className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight">{companyIdentifier}</h1>
              <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-[#52A8C7] text-[10px] font-extrabold uppercase rounded-full border border-blue-100 dark:border-blue-900">
                Portal RH & Empresas
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Painel exclusivo de recrutamento e vagas em Araucária</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenNewJobModal}
            className="px-4 py-2 bg-[#52A8C7] hover:bg-[#3d90ad] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Publicar Nova Vaga</span>
          </button>

          <button
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Sair da conta"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-[#131E32] border-b border-slate-200 dark:border-slate-800 px-6 flex gap-8">
        {[
          { id: 'overview', label: 'Visão Geral', icon: Building2, count: null },
          { id: 'jobs', label: 'Minhas Vagas', icon: Briefcase, count: companyJobs.length },
          { id: 'candidates', label: 'Candidatos Inscritos', icon: Users, count: applications.length },
          { id: 'profile', label: 'Dados da Empresa', icon: Edit3, count: null }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3.5 border-b-2 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                isActive
                  ? 'border-[#52A8C7] text-[#52A8C7]'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  isActive ? 'bg-[#52A8C7]/10 text-[#52A8C7]' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-[#131E32] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-[#52A8C7] flex items-center justify-center shrink-0">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vagas Cadastradas</p>
                  <h3 className="text-2xl font-black mt-0.5">{companyJobs.length}</h3>
                </div>
              </div>

              <div className="bg-white dark:bg-[#131E32] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-500 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vagas Aceitas / ADM</p>
                  <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {companyJobs.filter(j => j.approvalStatus === 'accepted' || j.approvalStatus === 'approved').length}
                  </h3>
                </div>
              </div>

              <div className="bg-white dark:bg-[#131E32] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center shrink-0">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Candidatos Aceitos</p>
                  <h3 className="text-2xl font-black text-amber-500 mt-0.5">
                    {applications.filter(a => a.status === 'Aprovado').length}
                  </h3>
                </div>
              </div>

              <div className="bg-white dark:bg-[#131E32] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-500 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Inscritos</p>
                  <h3 className="text-2xl font-black mt-0.5">{applications.length}</h3>
                </div>
              </div>
            </div>

            {/* Quick Actions & Recent Applications */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-[#131E32] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Candidatos Recentes</h2>
                  <button 
                    onClick={() => setActiveTab('candidates')}
                    className="text-xs font-bold text-[#52A8C7] hover:underline"
                  >
                    Ver todos ({applications.length})
                  </button>
                </div>

                {applications.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium">Nenhum candidato inscrito nas suas vagas ainda.</p>
                    <p className="text-xs mt-1">Publique novas vagas para atrair talentos em Araucária.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {applications.slice(0, 5).map(app => (
                      <div key={app.id} className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-[#52A8C7] font-bold flex items-center justify-center text-xs shrink-0">
                            {app.candidateName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold">{app.candidateName}</h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{app.jobTitle}</p>
                            {app.candidatePhone && (
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5" /> {app.candidatePhone}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {/* Green WhatsApp Contact Button - ALWAYS VISIBLE */}
                          <button
                            type="button"
                            onClick={() => handleOpenWhatsApp(app)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer text-xs font-bold shrink-0"
                            title="Chamar candidato no WhatsApp"
                          >
                            <Phone className="w-3.5 h-3.5 fill-current" />
                            <span>WhatsApp</span>
                          </button>

                          {/* Quick Status Selector */}
                          <select
                            value={app.status || 'Em análise'}
                            onChange={(e) => handleUpdateAppStatus(app.id, e.target.value as any)}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border cursor-pointer ${
                              app.status === 'Aprovado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800' :
                              app.status === 'Entrevista' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800' :
                              app.status === 'Reprovado' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:border-rose-800' :
                              'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:border-amber-800'
                            }`}
                          >
                            <option value="Em análise">Em análise</option>
                            <option value="Entrevista">Entrevista</option>
                            <option value="Aprovado">Aprovado</option>
                            <option value="Reprovado">Reprovado</option>
                          </select>

                          <button
                            onClick={() => setActiveTab('candidates')}
                            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 cursor-pointer"
                            title="Ver ficha completa"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Company Info Card */}
              <div className="bg-white dark:bg-[#131E32] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                    {companyLogoUrl ? (
                      <img src={companyLogoUrl} alt={companyName} className="w-full h-full object-contain p-1" />
                    ) : (
                      <Building2 className="w-6 h-6 text-[#52A8C7]" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{companyName}</h2>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Conta Verificada
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
                    <FileText className="w-4 h-4 text-[#52A8C7] shrink-0" />
                    <span>CNPJ: {cnpj || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
                    <UserCheck className="w-4 h-4 text-[#52A8C7] shrink-0" />
                    <span>Responsável: <strong>{responsibleName}</strong> ({responsibleRole})</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
                    <Mail className="w-4 h-4 text-[#52A8C7] shrink-0" />
                    <span className="truncate">{companyEmail || user.email}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
                    <Phone className="w-4 h-4 text-[#52A8C7] shrink-0" />
                    <span>{phone || 'Não informado'}</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-slate-600 dark:text-slate-400">
                    <MapPin className="w-4 h-4 text-[#52A8C7] shrink-0 mt-0.5" />
                    <span className="leading-snug">{companyAddress || `Araucária - ${neighborhood}`}</span>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('profile')}
                  className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Editar Perfil & Endereço
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">Vagas Publicadas pela Empresa</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Gerencie as oportunidades de emprego abertas para candidatos em Araucária.</p>
              </div>
              <button
                onClick={handleOpenNewJobModal}
                className="px-4 py-2.5 bg-[#52A8C7] hover:bg-[#3d90ad] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Vaga</span>
              </button>
            </div>

            {companyJobs.length === 0 ? (
              <div className="bg-white dark:bg-[#131E32] border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhuma vaga cadastrada</h3>
                <p className="text-xs mt-1 mb-4">Clique no botão abaixo para publicar sua primeira vaga.</p>
                <button
                  onClick={handleOpenNewJobModal}
                  className="px-4 py-2 bg-[#52A8C7] text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Criar Primeira Vaga
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {companyJobs.map(job => {
                  const jobAcceptedCount = applications.filter(a => (a.jobId === job.id || a.jobTitle === job.title) && a.status === 'Aprovado').length;
                  const isAcceptedByAdmin = job.approvalStatus === 'accepted' || job.approvalStatus === 'approved';

                  return (
                    <div key={job.id} className="bg-white dark:bg-[#131E32] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
                      <div className="space-y-2">
                        {/* Status Badges Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isAcceptedByAdmin ? (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Vaga Aceita pelo ADM
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-[10px] font-bold rounded-full flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Em análise pelo ADM
                              </span>
                            )}

                            {jobAcceptedCount > 0 && (
                              <span className="px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-black rounded-full flex items-center gap-1 shadow-xs">
                                <Award className="w-3 h-3" /> {jobAcceptedCount} {jobAcceptedCount === 1 ? 'Candidato Aceito' : 'Candidatos Aceitos'}
                              </span>
                            )}
                          </div>

                          <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-[#52A8C7] text-[10px] font-bold rounded-full">
                            {job.type}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{job.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{job.description}</p>

                        {/* Datas de Início e Término */}
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
                          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                            <Calendar className="w-3.5 h-3.5 text-[#52A8C7]" />
                            Início: <strong>{job.startDate || job.dateString}</strong>
                          </span>
                          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            Término: <strong className="text-amber-600 dark:text-amber-400">{job.endDate || 'Em aberto'}</strong>
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-[#52A8C7]" /> {job.location}</span>
                          <span>•</span>
                          <span className="font-semibold text-emerald-600">{job.salary}</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <span className="text-[10px] text-slate-400 font-mono">ID: {job.id.substring(0, 14)}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditJobModal(job)}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button
                            onClick={() => handleDeleteJob(job.id)}
                            className="p-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg transition-colors cursor-pointer"
                            title="Excluir Vaga Definitivamente"
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

        {activeTab === 'candidates' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold">Candidatos Inscritos</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Analise os currículos e atualize o status dos candidatos.</p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar candidato..."
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#131E32] border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#52A8C7]"
                  />
                </div>
                <select
                  value={selectedJobFilter}
                  onChange={(e) => setSelectedJobFilter(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-[#131E32] border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  <option value="all">Todas as Vagas</option>
                  {companyJobs.map(j => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {filteredApplications.length === 0 ? (
              <div className="bg-white dark:bg-[#131E32] border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum candidato encontrado</h3>
                <p className="text-xs mt-1">Os candidatos que se inscreverem nas suas vagas aparecerão aqui.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredApplications.map(app => (
                  <div key={app.id} className="bg-white dark:bg-[#131E32] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold">{app.candidateName}</h4>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          app.status === 'Aprovado' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                          app.status === 'Entrevista' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                          app.status === 'Reprovado' ? 'bg-rose-50 text-rose-600 border border-rose-200' :
                          'bg-amber-50 text-amber-600 border border-amber-200'
                        }`}>
                          {app.status || 'Em Análise'}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[#52A8C7]">Vaga: {app.jobTitle}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                        {app.candidateEmail && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {app.candidateEmail}</span>}
                        {app.candidatePhone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {app.candidatePhone}</span>}
                        <span>Inscrito em: {app.appliedDate}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
                      {/* WhatsApp Direct Chat Button - ALWAYS VISIBLE */}
                      <button
                        type="button"
                        onClick={() => handleOpenWhatsApp(app)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer active:scale-95"
                        title="Abrir WhatsApp para agendar entrevista"
                      >
                        <Phone className="w-3.5 h-3.5 fill-current" />
                        <span>WhatsApp</span>
                      </button>

                      <select
                        value={app.status || 'Em análise'}
                        onChange={(e) => handleUpdateAppStatus(app.id, e.target.value as any)}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        <option value="Em análise">Em análise</option>
                        <option value="Entrevista">Agendar Entrevista</option>
                        <option value="Aprovado">Aprovado</option>
                        <option value="Reprovado">Reprovado</option>
                      </select>

                      {app.cvLink && (() => {
                        const safeCvUrl = sanitizeExternalUrl(app.cvLink);
                        return safeCvUrl ? (
                          <a
                            href={safeCvUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-[#52A8C7]/10 hover:bg-[#52A8C7]/20 text-[#52A8C7] text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5" /> Currículo
                          </a>
                        ) : (
                          <span
                            className="px-3 py-1.5 bg-rose-500/10 text-rose-500 text-xs font-bold rounded-xl flex items-center gap-1"
                            title="Link bloqueado pela política de segurança"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" /> Link inválido bloqueado
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="bg-white dark:bg-[#131E32] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-2xl mx-auto shadow-xs">
            <h2 className="text-base font-bold mb-1">Dados da Empresa e Recrutador</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Atualize as informações corporativas exibidas aos candidatos.</p>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Logo da Empresa */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                  Logo / Logotipo da Empresa
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative w-24 h-24 rounded-2xl bg-white dark:bg-slate-950 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                    {companyLogoUrl ? (
                      <img src={companyLogoUrl} alt="Logo da empresa" className="w-full h-full object-contain p-1.5" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 gap-1 p-2 text-center">
                        <Building2 className="w-8 h-8 text-slate-400" />
                        <span className="text-[10px] font-semibold leading-tight">Sem Logo</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <label className="px-4 py-2.5 bg-[#52A8C7] hover:bg-[#3d90ad] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        <span>{companyLogoUrl ? 'Alterar Logo da Empresa' : 'Enviar Foto da Logo'}</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleLogoUpload} 
                          className="hidden" 
                        />
                      </label>

                      {companyLogoUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="px-3 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-red-500/10 hover:text-red-500 text-slate-600 dark:text-slate-400 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remover</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Selecione uma imagem da sua empresa (PNG, JPG, WEBP). Ela será salva no seu perfil e associada às suas vagas.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Razão Social ou Nome Fantasia</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">CNPJ</label>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Nome do Usuário / Recrutador</label>
                  <input
                    type="text"
                    value={responsibleName}
                    onChange={(e) => setResponsibleName(e.target.value)}
                    required
                    placeholder="Ex: Pedro Henrique"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Cargo do Usuário na Empresa</label>
                  <input
                    type="text"
                    value={responsibleRole}
                    onChange={(e) => setResponsibleRole(e.target.value)}
                    placeholder="Ex: Gestor de RH, Proprietário, Analista de Seleção"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">E-mail Corporativo</label>
                  <input
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    placeholder="rh@empresa.com.br"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Segmento</label>
                  <select
                    value={segment}
                    onChange={(e) => setSegment(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    {COMPANY_SEGMENTS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Bairro em Araucária</label>
                  <select
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    {ARAUCARIA_NEIGHBORHOODS.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Endereço Completo em Araucária (Rua, Nº, Bairro, CEP)</label>
                <input
                  type="text"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="Ex: Rua Major Sezino Pereira de Souza, 150 - Centro, Araucária - PR, CEP 83702-000"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">WhatsApp Comercial / RH</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(41) 99999-9999"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Sobre a Empresa (Bio)</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  placeholder="Breve descrição da empresa..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-[#52A8C7] hover:bg-[#3d90ad] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Salvar Alterações
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Modal Criar/Editar Vaga */}
      {showJobModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#131E32] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold">{editingJob ? 'Editar Vaga' : 'Publicar Nova Vaga'}</h3>
              <button 
                onClick={() => setShowJobModal(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveJob} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Título da Vaga <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  required
                  placeholder="Ex: Operador de Caixa, Auxiliar Logístico..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Tipo</label>
                  <select
                    value={jobType}
                    onChange={(e) => setJobType(e.target.value)}
                    className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    <option value="CLT">CLT</option>
                    <option value="Temporário">Temporário</option>
                    <option value="Estágio">Estágio</option>
                    <option value="PJ">PJ</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Salário</label>
                  <input
                    type="text"
                    value={jobSalary}
                    onChange={(e) => setJobSalary(e.target.value)}
                    placeholder="Ex: R$ 2.500"
                    className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Bairro</label>
                  <select
                    value={jobNeighborhood}
                    onChange={(e) => {
                      const selected = e.target.value.trim();
                      setJobNeighborhood(selected);
                      const coords = NEIGHBORHOOD_COORDS[selected] || NEIGHBORHOOD_COORDS['Centro'];
                      if (coords) {
                        setJobLat(coords.lat);
                        setJobLng(coords.lng);
                      }
                    }}
                    className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    {ARAUCARIA_NEIGHBORHOODS.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Datas de Início e Final (Obrigatórias) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 rounded-xl">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#52A8C7]" />
                    Data de Início da Vaga <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={jobStartDate}
                    onChange={(e) => setJobStartDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
                  />
                  <p className="text-[10px] text-slate-500">Início do processo seletivo</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    Data Final / Término <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={jobEndDate}
                    onChange={(e) => setJobEndDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
                  />
                  <p className="text-[10px] text-slate-500">Prazo final para inscrições</p>
                </div>
              </div>

              {/* Informações adicionais completas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Horário / Jornada</label>
                  <input
                    type="text"
                    value={jobWorkHours}
                    onChange={(e) => setJobWorkHours(e.target.value)}
                    placeholder="Ex: 08:00 às 17:00 (Seg a Sex)"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Benefícios Oferecidos</label>
                  <input
                    type="text"
                    value={jobBenefits}
                    onChange={(e) => setJobBenefits(e.target.value)}
                    placeholder="Ex: VT, VR, Seguro de Vida"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Endereço do Local de Trabalho</label>
                  <input
                    type="text"
                    value={jobWorkAddress}
                    onChange={(e) => setJobWorkAddress(e.target.value)}
                    placeholder="Ex: Rua Central, 200 - Araucária"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">WhatsApp / Contato do RH</label>
                  <input
                    type="text"
                    value={jobContactPhone}
                    onChange={(e) => setJobContactPhone(e.target.value)}
                    placeholder="(41) 99999-9999"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Descrição da Vaga <span className="text-rose-500">*</span></label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  required
                  rows={3}
                  placeholder="Detalhes sobre as atividades, rotina diária e qualificações..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Requisitos (um por linha)</label>
                <textarea
                  value={jobRequirements}
                  onChange={(e) => setJobRequirements(e.target.value)}
                  rows={2}
                  placeholder="Ensino Médio Completo&#10;Experiência na função"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Localização no Mapa <span className="text-[10px] lowercase font-normal text-slate-400">(mesmo mapa dos candidatos)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsMapFullscreen(true)}
                      className="px-2.5 py-1 bg-[#52A8C7]/10 hover:bg-[#52A8C7]/20 text-[#52A8C7] rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3" /> Tela Cheia
                    </button>
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {jobLat.toFixed(4)}, {jobLng.toFixed(4)}
                    </span>
                  </div>
                </div>
                <div 
                  onClick={() => setIsMapFullscreen(true)}
                  className="w-full h-48 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 relative z-0 cursor-pointer group"
                  title="Clique para abrir em tela cheia"
                >
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                    <span className="bg-slate-900/80 text-white text-xs font-bold px-3 py-1.5 rounded-xl backdrop-blur-sm shadow-lg flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5" /> Ampliar em Tela Cheia
                    </span>
                  </div>
                  <MapContainer
                    center={[jobLat, jobLng]}
                    zoom={13}
                    style={{ width: '100%', height: '100%' }}
                    zoomControl={true}
                    scrollWheelZoom={true}
                  >
                    <MapController center={[jobLat, jobLng]} />
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapClickHandler onMapClick={(lat, lng) => {
                      setJobLat(lat);
                      setJobLng(lng);
                      toast.success(`Localização ajustada no mapa: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                    }} />

                    <div className="absolute top-3 left-3 right-3 z-[400] flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={searchAddress}
                          onChange={(e) => setSearchAddress(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSearchStreet();
                            }
                          }}
                          placeholder="Pesquisar rua ou endereço..."
                          className="w-full pl-9 pr-4 py-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold shadow-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#52A8C7]"
                        />
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSearchStreet()}
                        disabled={isSearchingAddress}
                        className="px-3.5 py-2 bg-[#52A8C7] hover:bg-[#3d90ad] text-white font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isSearchingAddress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">Ir</span>
                      </button>
                    </div>

                    {/* Existing jobs markers */}
                    {mockJobs.filter(j => j.lat && j.lng && j.id !== editingJob?.id).map(j => (
                      <Marker 
                        key={j.id} 
                        position={[j.lat!, j.lng!]} 
                        icon={customJobIcon}
                      >
                        <Popup>
                          <div className="text-xs font-sans">
                            <p className="font-bold">{j.title}</p>
                            <p className="text-gray-500">{j.company}</p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}

                    {/* New or editing job marker */}
                    <Marker 
                      position={[jobLat, jobLng]} 
                      icon={customNewJobIcon}
                    >
                      <Popup>
                        <div className="text-xs font-sans font-bold text-emerald-600">
                          Sua Nova Vaga (Aqui)
                        </div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
              </div>

              {/* Fullscreen Map Modal */}
              {isMapFullscreen && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col p-4 md:p-8">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex-1 flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-[#52A8C7]" /> Selecionar Localização da Vaga em Tela Cheia
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Clique em qualquer ponto do mapa para definir a posição exata da vaga.</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                          {jobLat.toFixed(4)}, {jobLng.toFixed(4)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsMapFullscreen(false)}
                          className="px-4 py-2 bg-[#52A8C7] hover:bg-[#3d90ad] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-md"
                        >
                          <Check className="w-4 h-4" /> Confirmar e Fechar
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 relative z-0">
                      <MapContainer
                        center={[jobLat, jobLng]}
                        zoom={14}
                        style={{ width: '100%', height: '100%' }}
                        zoomControl={true}
                        scrollWheelZoom={true}
                      >
                        <MapController center={[jobLat, jobLng]} />
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapClickHandler onMapClick={(lat, lng) => {
                          setJobLat(lat);
                          setJobLng(lng);
                          toast.success(`Localização definida em tela cheia: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                        }} />

                        <div className="absolute top-4 left-4 right-4 md:w-96 z-[400] flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={searchAddress}
                              onChange={(e) => setSearchAddress(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSearchStreet();
                                }
                              }}
                              placeholder="Pesquisar rua ou endereço..."
                              className="w-full pl-9 pr-4 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold shadow-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#52A8C7]"
                            />
                            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSearchStreet()}
                            disabled={isSearchingAddress}
                            className="px-4 py-2.5 bg-[#52A8C7] hover:bg-[#3d90ad] text-white font-bold text-xs rounded-xl shadow-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {isSearchingAddress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            <span>Buscar</span>
                          </button>
                        </div>

                        {mockJobs.filter(j => j.lat && j.lng && j.id !== editingJob?.id).map(j => (
                          <Marker 
                            key={j.id} 
                            position={[j.lat!, j.lng!]} 
                            icon={customJobIcon}
                          >
                            <Popup>
                              <div className="text-xs font-sans">
                                <p className="font-bold">{j.title}</p>
                                <p className="text-gray-500">{j.company}</p>
                              </div>
                            </Popup>
                          </Marker>
                        ))}

                        <Marker 
                          position={[jobLat, jobLng]} 
                          icon={customNewJobIcon}
                        >
                          <Popup>
                            <div className="text-xs font-sans font-bold text-emerald-600">
                              Sua Nova Vaga (Aqui)
                            </div>
                          </Popup>
                        </Marker>
                      </MapContainer>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJobModal(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#52A8C7] hover:bg-[#3d90ad] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {editingJob ? 'Salvar Alterações' : 'Publicar Vaga'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Informar Telefone do Candidato caso esteja ausente */}
      {phoneModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#131E32] rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                  <Phone className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Chamar no WhatsApp</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{phoneModalApp.candidateName}</p>
                </div>
              </div>
              <button 
                onClick={() => setPhoneModalApp(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              O candidato <strong>{phoneModalApp.candidateName}</strong> ainda não informou o telefone no currículo. Digite o WhatsApp dele com DDD abaixo para abrir a conversa e salvar na vaga:
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                WhatsApp com DDD:
              </label>
              <input
                type="tel"
                value={manualPhoneInput}
                onChange={(e) => setManualPhoneInput(e.target.value)}
                placeholder="(41) 99999-9999"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSavePhoneAndOpenWhatsApp();
                  }
                }}
              />
              <p className="text-[11px] text-slate-400">Ex: 41996502358 ou (41) 98888-7777</p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPhoneModalApp(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSavePhoneAndOpenWhatsApp}
                disabled={savingPhone}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {savingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4 fill-current" />}
                <span>Abrir WhatsApp e Salvar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

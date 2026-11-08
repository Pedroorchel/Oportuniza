import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  ArrowLeft, 
  User as UserIcon, 
  Mail, 
  Phone, 
  GraduationCap, 
  Briefcase, 
  Save, 
  Shield, 
  Bell, 
  BellRing, 
  Code, 
  Check, 
  AlertTriangle, 
  Send,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Info,
  Camera,
  FileText,
  Download,
  MapPin,
  Heart,
  Moon,
  Sun,
  Building2,
  Globe
} from 'lucide-react';
import { User, ScreenId, Application, Enrollment, Course } from '../types';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../lib/toast';
import { useTheme } from '../lib/theme';
import { isAccountBlocked } from '../lib/blockedAccounts';
import { saveCompanyProfile } from '../lib/companyService';

interface ProfileAndSettingsProps {
  user: User | null;
  onSetUser: (user: User | null) => void;
  onNavigate: (screen: ScreenId) => void;
  tabType: string;
  setTabType: (tab: any) => void;
  favorites: string[];
  onToggleFavorite: (jobId: string) => Promise<void>;
  applications: Application[];
  onDeleteAllData: () => Promise<void>;
  enrollments: Enrollment[];
  onContinueCourse: (courseId: string) => void;
  onUnsubscribeCourse: (courseId: string) => void;
  onNavigateToJob: () => void;
  onNavigateToCourse: () => void;
  onNavigateToJobs: () => void;
  onNavigateToCourses: () => void;
  onCancelApplication: (appId: string) => void;
  completedCourses: any[];
}

export default function ProfileAndSettings({
  user,
  onSetUser,
  onNavigate,
  tabType,
  setTabType,
  favorites,
  onToggleFavorite,
  applications,
  onDeleteAllData,
  enrollments,
  onContinueCourse,
  onUnsubscribeCourse,
  onNavigateToJob,
  onNavigateToCourse,
  onNavigateToJobs,
  onNavigateToCourses,
  onCancelApplication,
  completedCourses
}: ProfileAndSettingsProps) {
  const [theme, toggleTheme] = useTheme();

  // Form profile states
  const isCompanyAccount = user?.accountType === 'company' || user?.role === 'Empresa' || user?.cargo === 'Empresa';
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [education, setEducation] = useState(user?.education || 'Ensino Médio Incompleto / Cursando');
  const [experience, setExperience] = useState(user?.experience || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [skills, setSkills] = useState<string[]>(user?.skills || []);
  const [newSkill, setNewSkill] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [isSaving, setIsSaving] = useState(false);

  // Company-specific profile states
  const [companyName, setCompanyName] = useState(user?.companyName || user?.name || '');
  const [cnpj, setCnpj] = useState(user?.cnpj || '');
  const [responsibleName, setResponsibleName] = useState(user?.responsibleName || user?.name || '');
  const [responsibleRole, setResponsibleRole] = useState(user?.responsibleRole || 'RH / Recrutamento');
  const [companySegment, setCompanySegment] = useState(user?.companySegment || 'Comércio & Varejo');
  const [companyNeighborhood, setCompanyNeighborhood] = useState(user?.companyNeighborhood || 'Centro');
  const [companyAddress, setCompanyAddress] = useState(user?.companyAddress || '');
  const [companyWebsite, setCompanyWebsite] = useState(user?.companyWebsite || '');

  // Push Notifications state (Specifically for TI / Tech Jobs)
  const [tiJobsPush, setTiJobsPush] = useState<boolean>(user?.tiJobsPushEnabled ?? false);
  const [generalNotifications, setGeneralNotifications] = useState<boolean>(user?.notificationsEnabled ?? true);
  const [marketingEmails, setMarketingEmails] = useState<boolean>(user?.marketingEmailsEnabled ?? false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>('default');

  // Password update states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Check browser Notification support
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermission(Notification.permission);
    } else {
      setBrowserPermission('unsupported');
    }
  }, []);

  // Update internal fields when user prop changes
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setEducation(user.education || 'Ensino Médio Incompleto / Cursando');
      setExperience(user.experience || '');
      setBio(user.bio || '');
      setSkills(user.skills || []);
      setAvatarUrl(user.avatarUrl || '');
      setTiJobsPush(user.tiJobsPushEnabled ?? false);
      setGeneralNotifications(user.notificationsEnabled ?? true);
      setMarketingEmails(user.marketingEmailsEnabled ?? false);
    }
  }, [user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida (JPEG, PNG).');
      return;
    }

    // Resize image and convert to Base64
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setAvatarUrl(dataUrl);
        }
      };
      if (ev.target?.result) {
        img.src = ev.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle skill tags
  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  // Logic to activate or deactivate push notifications for TI & Technology jobs
  const handleToggleTiJobsPush = async (enabled: boolean) => {
    setTiJobsPush(enabled);

    let perm = browserPermission;
    if (enabled && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        try {
          const requested = await Notification.requestPermission();
          setBrowserPermission(requested);
          perm = requested;
        } catch (err) {
          console.warn('Erro ao solicitar permissão de notificações do navegador:', err);
        }
      }
    }

    if (user) {
      const updatedUser: User = {
        ...user,
        tiJobsPushEnabled: enabled,
        updatedAt: new Date().toISOString()
      };

      onSetUser(updatedUser);

      // Sync with Supabase if user exists
      try {
        if (user.id) {
          await supabase
            .from('users')
            .update({
              notifications_enabled: enabled,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);
        }
      } catch (err) {
        console.warn('Supabase update warning:', err);
      }
    }

    if (enabled) {
      if (perm === 'denied') {
        toast.warning('Notificações de TI ativadas no perfil! (Nota: seu navegador bloqueou alertas do sistema operacional, mas você receberá notificações internas no app).');
      } else {
        toast.success('🔔 Notificações Push para novas vagas de TI ativadas com sucesso!');
      }
    } else {
      toast.info('Notificações de novas vagas de TI desativadas.');
    }
  };

  const handleToggleGeneralNotifications = (enabled: boolean) => {
    setGeneralNotifications(enabled);
    if (user) {
      const updatedUser: User = {
        ...user,
        notificationsEnabled: enabled
      };
      onSetUser(updatedUser);
    }
    toast.info(enabled ? 'Alertas gerais ativados.' : 'Alertas gerais desativados.');
  };

  const handleToggleMarketing = (enabled: boolean) => {
    setMarketingEmails(enabled);
    if (user) {
      const updatedUser: User = {
        ...user,
        marketingEmailsEnabled: enabled
      };
      onSetUser(updatedUser);
    }
  };

  // Test push notification trigger for TI vacancy
  const handleTestTiNotification = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const res = await Notification.requestPermission();
        setBrowserPermission(res);
      }

      if (Notification.permission === 'granted') {
        try {
          new Notification('🚀 [NOVA VAGA TI] Araucária Tech', {
            body: 'Estágio / Júnior em Desenvolvimento & Suporte de TI em Araucária (R$ 2.400,00). Clique para ver!',
            icon: '/vite.svg'
          });
        } catch (e) {
          console.warn('Falha no trigger nativo:', e);
        }
      }
    }

    toast.success('🚀 [TESTE PUSH TI]: Nova vaga aberta: Desenvolvedor Júnior / Suporte TI (R$ 2.400,00) em Araucária!');
  };

  // Save complete profile
  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      // Security check: ensure account is not blocked
      const isBlocked = await isAccountBlocked({ id: user.id, email: user.email });
      if (isBlocked) {
        toast.error('Esta conta foi bloqueada pelo administrador.');
        return;
      }

      const updatedUser: User = {
        ...user,
        name,
        email,
        phone,
        education,
        experience,
        bio,
        skills,
        avatarUrl,
        tiJobsPushEnabled: tiJobsPush,
        notificationsEnabled: generalNotifications,
        marketingEmailsEnabled: marketingEmails,
        updatedAt: new Date().toISOString()
      };

      onSetUser(updatedUser);

      if (user.id) {
        await supabase
          .from('users')
          .update({
            name,
            phone,
            education,
            experience,
            bio,
            skills,
            avatar_url: avatarUrl,
            notifications_enabled: generalNotifications,
            marketing_emails_enabled: marketingEmails,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
      }

      toast.success('Perfil e preferências salvos com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar dados do perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  // Update password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('A senha deve conter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas digitadas não coincidem.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      if (user?.email) {
        await supabase.auth.updateUser({ password: newPassword });
      }
      toast.success('Senha atualizada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error('Não foi possível alterar a senha no momento.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const cvRef = useRef<HTMLDivElement>(null);

  const handleGeneratePDF = async () => {
    if (!cvRef.current) return;
    setIsGeneratingPDF(true);
    toast.success('Gerando PDF...');
    
    try {
      const element = cvRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Curriculo_${name.replace(/\s+/g, '_')}.pdf`);
      
      toast.success('PDF baixado com sucesso!');
    } catch (err) {
      console.error('Error generating PDF', err);
      toast.error('Erro ao gerar PDF do currículo.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#F9FAFB] absolute inset-0">
      {/* Top Header */}
      <header className="px-5 pt-6 pb-4 bg-white border-b border-gray-100 flex items-center justify-between shadow-xs shrink-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={() => onNavigate('home')}
            className="p-1 px-1.5 rounded-lg hover:bg-gray-100 active:scale-95 transition-transform text-gray-600 hover:text-gray-900 cursor-pointer shrink-0"
            aria-label="Voltar para o início"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-bold text-gray-900 font-sans tracking-tight truncate">
            {tabType === 'profile' ? 'Meu Perfil' : 'Configurações da Conta'}
          </h1>
        </div>

        {/* Tab switch buttons */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setTabType('profile')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              tabType === 'profile'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Perfil
          </button>
          <button
            onClick={() => onNavigate('settings')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              tabType === 'settings'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Bell className="w-3 h-3" />
            <span>Configurações</span>
          </button>
          <button
            onClick={() => setTabType('cv')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              tabType === 'cv'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Currículo PDF</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scroll p-4 md:p-6 max-w-3xl mx-auto w-full">
        
        {/* TAB 1: PROFILE EDIT */}
        {tabType === 'profile' && (
          <div className="flex flex-col gap-5">
            {/* Header summary card */}
            <div className="rounded-2xl bg-white border border-gray-200/80 shadow-xs overflow-hidden">
              {/* Cover Banner */}
              <div className="h-24 sm:h-32 bg-gradient-to-r from-primary-dark via-primary to-blue-400 relative">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
              </div>
              
              <div className="px-5 pb-5 sm:px-8 sm:pb-8 relative flex flex-col sm:flex-row gap-4 sm:items-end -mt-12 sm:-mt-16">
                <div className="relative group shrink-0 self-start sm:self-auto">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-white p-1.5 shadow-md">
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-100 to-gray-200 text-gray-500 flex items-center justify-center text-4xl font-black overflow-hidden relative">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        name ? name.charAt(0).toUpperCase() : 'U'
                      )}
                    </div>
                  </div>
                  <label className="absolute inset-0 m-1.5 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center rounded-full cursor-pointer z-10" title="Trocar foto">
                    <Camera className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold">Alterar</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </label>
                </div>
                
                <div className="min-w-0 flex-1 pt-1 sm:pt-0 sm:pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-black text-gray-900 truncate tracking-tight">{name || 'Seu Nome'}</h2>
                    {user?.isAdmin && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate mt-1 flex items-center gap-1.5 font-medium">
                    <Mail className="w-4 h-4 text-gray-400" />
                    {email || 'Sem e-mail informado'}
                  </p>
                </div>

                <div className="sm:self-end sm:pb-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Currículo Ativo
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Form Fields - Personal Data */}
            <div className="p-6 rounded-2xl bg-white border border-gray-200/80 shadow-xs flex flex-col gap-5">
              <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <UserIcon className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">Dados Pessoais</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Nome Completo</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-medium text-gray-800 transition-all bg-gray-50 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Telefone / WhatsApp</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(41) 99999-9999"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-medium text-gray-800 transition-all bg-gray-50 focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Form Fields - Professional Data */}
            <div className="p-6 rounded-2xl bg-white border border-gray-200/80 shadow-xs flex flex-col gap-5">
              <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Briefcase className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">Perfil Profissional</h3>
              </div>

              <div className="flex flex-col gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Escolaridade</label>
                  <div className="relative">
                    <GraduationCap className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <select
                      value={education}
                      onChange={(e) => setEducation(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-medium text-gray-800 bg-gray-50 focus:bg-white appearance-none transition-all"
                    >
                      <option value="Ensino Fundamental Incompleto">Ensino Fundamental Incompleto</option>
                      <option value="Ensino Fundamental Completo">Ensino Fundamental Completo</option>
                      <option value="Ensino Médio Incompleto / Cursando">Ensino Médio Incompleto / Cursando</option>
                      <option value="Ensino Médio Completo">Ensino Médio Completo</option>
                      <option value="Ensino Técnico Cursando / Completo">Ensino Técnico Cursando / Completo</option>
                      <option value="Ensino Superior Cursando / Completo">Ensino Superior Cursando / Completo</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Resumo Profissional / Experiência</label>
                  <textarea
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    rows={4}
                    placeholder="Conte sobre suas experiências profissionais ou seus projetos de estudo..."
                    className="w-full p-4 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-medium text-gray-800 transition-all bg-gray-50 focus:bg-white resize-none"
                  />
                </div>
              </div>

              {/* Skills Tags */}
              <div className="flex flex-col gap-3 pt-2">
                <label className="block text-xs font-bold text-gray-700">Habilidades e Conhecimentos</label>
                <form onSubmit={handleAddSkill} className="flex gap-2 relative">
                  <Sparkles className="w-4 h-4 text-primary absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    placeholder="Adicionar habilidade (ex: Excel, Python...)"
                    className="flex-1 pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-medium text-gray-800 transition-all bg-gray-50 focus:bg-white"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold rounded-xl cursor-pointer transition-all shadow-md active:scale-95"
                  >
                    Adicionar
                  </button>
                </form>

                <div className="flex flex-wrap gap-2 pt-2">
                  {skills.map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 text-xs font-bold transition-colors"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="text-primary/60 hover:text-red-500 cursor-pointer transition-colors"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {skills.length === 0 && (
                    <span className="text-sm text-gray-400 italic">Nenhuma habilidade cadastrada ainda.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Save Action Sticky or Bottom */}
            <div className="flex justify-end pt-2 pb-6">
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="px-8 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold shadow-lg shadow-primary/30 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 active:scale-95"
              >
                <Save className="w-5 h-5" />
                <span>{isSaving ? 'Salvando Alterações...' : 'Salvar Alterações'}</span>
              </button>
            </div>

          </div>
        )}

        {/* TAB 2: SETTINGS & PUSH NOTIFICATIONS */}
        {tabType === 'settings' && (
          <div className="flex flex-col gap-6">
            {/* NOTIFICATIONS SECTION */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="bg-white rounded-[12px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                <div className="px-4 md:px-6 py-4 md:py-5 border-b border-gray-50 flex items-center gap-3">
                  <div className="p-2 bg-amber-50 text-amber-500 rounded-[12px]">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Notificações</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Gerencie seus alertas.</p>
                  </div>
                </div>

                <div className="p-3 md:p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between p-3 rounded-[12px] bg-gray-50">
                    <span className="text-sm text-gray-700">Vagas de TI</span>
                    <button
                      type="button"
                      onClick={() => handleToggleTiJobsPush(!tiJobsPush)}
                      className={`relative inline-flex h-6 w-11 rounded-[12px] transition-colors ${tiJobsPush ? 'bg-indigo-400' : 'bg-gray-200'}`}
                    >
                      <span className={`h-5 w-5 rounded-[10px] bg-white mt-0.5 ml-0.5 transition-transform ${tiJobsPush ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-[12px] bg-gray-50">
                    <span className="text-sm text-gray-700">Vagas Gerais</span>
                    <button
                      type="button"
                      onClick={() => handleToggleGeneralNotifications(!generalNotifications)}
                      className={`relative inline-flex h-6 w-11 rounded-[12px] transition-colors ${generalNotifications ? 'bg-indigo-400' : 'bg-gray-200'}`}
                    >
                      <span className={`h-5 w-5 rounded-[10px] bg-white mt-0.5 ml-0.5 transition-transform ${generalNotifications ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-[12px] bg-gray-50">
                    <span className="text-sm text-gray-700">Boletim Semanal</span>
                    <button
                      type="button"
                      onClick={() => handleToggleMarketing(!marketingEmails)}
                      className={`relative inline-flex h-6 w-11 rounded-[12px] transition-colors ${marketingEmails ? 'bg-indigo-400' : 'bg-gray-200'}`}
                    >
                      <span className={`h-5 w-5 rounded-[10px] bg-white mt-0.5 ml-0.5 transition-transform ${marketingEmails ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* MEUS CONTEUDOS SECTION */}
              <div className="bg-white rounded-[12px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                <div className="px-4 md:px-6 py-4 md:py-5 border-b border-gray-50 flex items-center gap-3">
                  <div className="p-2 bg-purple-50 text-purple-500 rounded-[12px]">
                    <Heart className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Meus Conteúdos</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Itens salvos e cursos.</p>
                  </div>
                </div>
                <div className="p-3 md:p-4 grid grid-cols-2 gap-2 md:gap-3 flex-1">
                  <button onClick={() => onNavigate('favorites')} className="flex flex-col items-center justify-center gap-1 md:gap-2 p-3 md:p-4 rounded-[12px] bg-gray-50 hover:bg-purple-50 transition-colors cursor-pointer group text-center">
                    <Heart className="w-5 h-5 text-purple-400" />
                    <span className="text-[10px] md:text-xs font-semibold text-gray-700 group-hover:text-purple-700">Favoritas</span>
                  </button>
                  <button onClick={() => onNavigate('applications')} className="flex flex-col items-center justify-center gap-1 md:gap-2 p-3 md:p-4 rounded-[12px] bg-gray-50 hover:bg-purple-50 transition-colors cursor-pointer group text-center">
                    <FileText className="w-5 h-5 text-purple-400" />
                    <span className="text-[10px] md:text-xs font-semibold text-gray-700 group-hover:text-purple-700">Candidaturas</span>
                  </button>
                  <button onClick={() => onNavigate('enrollments')} className="flex flex-col items-center justify-center gap-1 md:gap-2 p-3 md:p-4 rounded-[12px] bg-gray-50 hover:bg-purple-50 transition-colors cursor-pointer group text-center">
                    <GraduationCap className="w-5 h-5 text-purple-400" />
                    <span className="text-[10px] md:text-xs font-semibold text-gray-700 group-hover:text-purple-700">Inscritos</span>
                  </button>
                  <button onClick={() => onNavigate('completed')} className="flex flex-col items-center justify-center gap-1 md:gap-2 p-3 md:p-4 rounded-[12px] bg-gray-50 hover:bg-purple-50 transition-colors cursor-pointer group text-center">
                    <CheckCircle2 className="w-5 h-5 text-purple-400" />
                    <span className="text-[10px] md:text-xs font-semibold text-gray-700 group-hover:text-purple-700">Completos</span>
                  </button>
                </div>
              </div>
            </div>

            {/* APPEARANCE / DARK MODE SECTION */}
            <div className="bg-white rounded-[12px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="px-4 md:px-6 py-4 md:py-5 border-b border-gray-50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-50 dark:bg-sky-950/50 text-sky-500 rounded-[12px]">
                    {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Aparência do Aplicativo</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Alterne entre o tema claro e o modo escuro.</p>
                  </div>
                </div>
              </div>

              <div className="p-4 md:p-6 flex items-center justify-between bg-gray-50/50">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-800">
                    {theme === 'dark' ? 'Modo Escuro Ativado' : 'Modo Claro Ativado'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {theme === 'dark' ? 'Descanso visual para ambientes escuros' : 'Interface padrão com fundo claro'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`relative inline-flex h-7 w-13 rounded-full transition-colors cursor-pointer items-center p-0.5 ${
                    theme === 'dark' ? 'bg-primary justify-end' : 'bg-gray-300 dark:bg-slate-700 justify-start'
                  }`}
                  aria-label="Alternar tema"
                >
                  <div className="w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center transition-transform">
                    {theme === 'dark' ? (
                      <Moon className="w-3.5 h-3.5 text-sky-500" />
                    ) : (
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* SECURITY SECTION */}
            <div className="bg-white rounded-[12px] border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 flex items-center gap-3 border-b border-gray-50">
                <div className="p-2 bg-slate-50 text-slate-500 rounded-[12px]">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Segurança & Acesso</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Gerencie seu acesso.</p>
                </div>
              </div>

              <div className="p-6">
                <button
                  onClick={() => onNavigate('change-password')}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-[12px] bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100 transition-colors cursor-pointer group"
                >
                  <span className="text-sm">Alterar Senha</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* DANGER ZONE / DATA RESET */}
            <div className="mt-2 p-6 rounded-[12px] bg-red-50/50 border border-red-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative overflow-hidden">
              <div className="flex items-start gap-4 z-10">
                <div className="p-3 bg-red-100 text-red-500 rounded-[12px] shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-red-900">Apagar Dados Locais</h4>
                  <p className="text-xs text-red-600/70 mt-1 max-w-md leading-relaxed">
                    Limpe o cache local deste dispositivo. Isso apagará o histórico de cursos e vagas salvas, mas não excluirá sua conta.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onDeleteAllData}
                className="z-10 shrink-0 w-full sm:w-auto px-6 py-2.5 rounded-[12px] bg-white hover:bg-red-50 text-red-600 border border-red-200 text-sm font-semibold transition-all shadow-sm"
              >
                Limpar Cache
              </button>
            </div>

          </div>
        )}

        {/* TAB 3: CURRICULO PDF */}
        {tabType === 'cv' && (
          <div className="flex flex-col gap-6 items-center w-full max-w-4xl mx-auto pb-12">
            <div className="w-full flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-5 rounded-2xl shadow-xs border border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Seu Currículo Profissional</h3>
                <p className="text-sm text-gray-500">Visualize e exporte seus dados como um PDF pronto para enviar a empresas.</p>
              </div>
              <button
                onClick={handleGeneratePDF}
                disabled={isGeneratingPDF}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                {isGeneratingPDF ? 'Gerando PDF...' : 'Baixar Currículo PDF'}
              </button>
            </div>

            {/* CURRICULUM PREVIEW (A4 Aspect Ratio approx) */}
            <div className="w-full max-w-full bg-white shadow-xl rounded-sm border border-gray-200 overflow-x-auto relative">
              <div ref={cvRef} className="w-full min-w-[700px] p-8 sm:p-12 bg-white text-gray-900" style={{ minHeight: '1122px' }}>
                {/* Header */}
                <div className="border-b-2 border-gray-200 pb-6 mb-8 flex items-center gap-6">
                  {avatarUrl && (
                    <div className="w-24 h-24 rounded-full overflow-hidden shrink-0 border-4 border-gray-50">
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-4xl font-black tracking-tight text-gray-900 uppercase">{name || 'Seu Nome'}</h1>
                    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-gray-600">
                      {email && <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> {email}</span>}
                      {phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> {phone}</span>}
                    </div>
                  </div>
                </div>

                {/* Resumo/Bio */}
                {bio && (
                  <div className="mb-8">
                    <h2 className="text-lg font-bold uppercase tracking-widest text-gray-800 mb-3 border-l-4 border-primary pl-3">Resumo Profissional</h2>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{bio}</p>
                  </div>
                )}

                {/* Experiência */}
                <div className="mb-8">
                  <h2 className="text-lg font-bold uppercase tracking-widest text-gray-800 mb-3 border-l-4 border-primary pl-3">Experiência Profissional</h2>
                  {experience ? (
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{experience}</p>
                  ) : (
                    <p className="text-gray-400 italic">Nenhuma experiência registrada.</p>
                  )}
                </div>

                {/* Educação */}
                <div className="mb-8">
                  <h2 className="text-lg font-bold uppercase tracking-widest text-gray-800 mb-3 border-l-4 border-primary pl-3">Formação Acadêmica</h2>
                  {education ? (
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{education}</p>
                  ) : (
                    <p className="text-gray-400 italic">Nenhuma formação registrada.</p>
                  )}
                </div>

                {/* Habilidades */}
                <div className="mb-8">
                  <h2 className="text-lg font-bold uppercase tracking-widest text-gray-800 mb-4 border-l-4 border-primary pl-3">Competências & Habilidades</h2>
                  {skills && skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill, index) => (
                        <span key={index} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-md text-sm font-semibold border border-gray-200">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 italic">Nenhuma habilidade cadastrada.</p>
                  )}
                </div>
                
                {/* Footer brand */}
                <div className="mt-16 pt-6 border-t border-gray-100 text-center">
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Currículo gerado via Oportuniza</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export type ScreenId =
  | 'landing'
  | 'bio'
  | 'login'
  | 'register'
  | 'recover'
  | 'home'
  | 'jobs'
  | 'courses'
  | 'profile'
  | 'favorites'
  | 'applications'
  | 'messages'
  | 'mentor'
  | 'support'
  | 'map'
  | 'settings'
  | 'details'
  | 'enrollments'
  | 'privacy'
  | 'course-player'
  | 'terms'
  | 'apply'
  | 'change-password'
  | 'admin'
  | 'atendimento'
  | 'completed';

export interface User {
  id?: string;
  name: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  experience?: string;
  education?: string;
  skills?: string[];
  phone?: string;
  notificationsEnabled?: boolean;
  marketingEmailsEnabled?: boolean;
  tiJobsPushEnabled?: boolean;
  isAdmin?: boolean;
  isBlocked?: boolean;
  blockReason?: string;
  status?: 'active' | 'blocked' | string;
  role?: string;
  cargo?: string;
  favorites?: string[];
  updatedAt?: string;
  accountType?: 'candidate' | 'company';
  companyName?: string;
  cnpj?: string;
  companySegment?: string;
  companyNeighborhood?: string;
  companyAddress?: string;
  companyWebsite?: string;
  responsibleName?: string;
  responsibleRole?: string;
  companyLogoUrl?: string;
}

export interface Company {
  id: string;
  user_id?: string;
  company_name: string;
  cnpj?: string;
  responsible_name: string;
  responsible_role?: string;
  email: string;
  phone?: string;
  segment?: string;
  neighborhood?: string;
  address?: string;
  website?: string;
  status?: 'active' | 'pending' | 'blocked' | 'verified' | string;
  verified?: boolean;
  bio?: string;
  logo_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  category: string;
  description: string;
  requirements: string[];
  salary: string;
  type: string; // "Estágio" | "CLT" | "Jovem Aprendiz" | "Freelancer"
  isRemote: boolean;
  location: string;
  lat?: number;
  lng?: number;
  logo: string; // Lucide icon name or emoji or path
  dateString: string;
  color?: string; // Border color class
  active?: boolean;
  // Detalhes completos solicitados:
  startDate?: string; // Data de Início da seleção / inscrições
  endDate?: string; // Data Final / Encerramento das inscrições
  workHours?: string; // Horário de trabalho / jornada
  benefits?: string[]; // Benefícios oferecidos
  companyAddress?: string; // Endereço completo em Araucária (Rua, Número, Bairro, CEP)
  companyNeighborhood?: string; // Bairro em Araucária
  companyContactPhone?: string; // Telefone / WhatsApp da empresa
  companyContactEmail?: string; // E-mail corporativo da empresa
  companyResponsibleName?: string; // Nome do usuário responsável pelo RH
  companyResponsibleRole?: string; // Cargo do usuário na empresa
  companyLogoUrl?: string; // Logo/imagem da empresa
  cnpj?: string; // CNPJ da empresa
  // Status de homologação/aceite da vaga pelo Painel ADM
  approvalStatus?: 'pending' | 'accepted' | 'approved' | 'rejected';
  approvedBy?: string; // Quem autorizou a vaga no Painel ADM
  approvedAt?: string; // Data de autorização
  acceptedCandidatesCount?: number; // Contagem de candidatos aceitos/contratados nesta vaga
}

export interface Course {
  id: string;
  title: string;
  desc: string;
  category: string;
  duration: string;
  instructor: string;
  rating: number;
  level: string; // "Iniciante" | "Intermediário" | "Avançado"
  logo?: string;
  coverImage?: string;
  lessons: { title: string; duration: string; done?: boolean; youtubeId?: string }[];
  completed?: boolean;
  active?: boolean;
}

export interface Application {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  appliedDate: string;
  status: 'Em análise' | 'Entrevista' | 'Aprovado' | 'Reprovado';
  candidateName?: string;
  cvLink?: string;
  cvFileName?: string;
  candidateEmail?: string;
  candidatePhone?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export interface Enrollment {
  id: string;
  courseId: string;
  courseTitle: string;
  instructor: string;
  enrolledDate: string;
  status: 'Iniciado' | 'Em andamento' | 'Concluído';
  progress: number;
  userName?: string;
}

export interface UserCourseProgress {
  id: string;
  user_id: string;
  course_id: string;
  user_name: string;
  course_title: string;
  completed_at: string;
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Menu, User as UserIcon, Briefcase, GraduationCap, ChevronRight, Award, LogOut, CheckCircle, CheckCircle2, Lock, ShieldAlert, Sparkles, Bell, Search, MapPin, Play, BookOpen, Star, FileText, ArrowRight, ExternalLink, Headphones, X, Download, Phone, Mail, Building } from 'lucide-react';
import { ScreenId, User, Job, Application, Course, Enrollment, UserCourseProgress } from './types';
import { mockJobs, mockCourses, loadJobsFromSupabase, loadCoursesFromSupabase } from './data';
import { supabase } from './lib/supabaseClient';
import { isAccountBlocked, isUserRecordBlocked, fetchAccountBlockReason, extractBlockReasonFromRecord } from './lib/blockedAccounts';
import { toast } from './lib/toast';
import { useTheme } from './lib/theme';
import ToastContainer from './components/ToastContainer';

// Import our modular subcomponents
import SidebarComponent from './components/Sidebar';
import DetailsScreen from './components/DetailsScreen';
import LandingScreen from './components/LandingScreen';
import BioScreen from './components/BioScreen';
import UserAuthScreens from './components/UserAuthScreens';
import AuthScreen from './components/AuthScreen';
import AdminPanelScreen from './components/AdminPanelScreen';
import Admin2FAScreen from './components/Admin2FAScreen';
import CompanyDashboardScreen from './components/CompanyDashboardScreen';
import ErrorBoundary from './components/ErrorBoundary';
import JobsSection from './components/JobsSection';
import CoursesSection from './components/CoursesSection';
import ProfileAndSettings from './components/ProfileAndSettings';
import CareerMapAndMessages from './components/CareerMapAndMessages';
import FavoritesSection from './components/FavoritesSection';
import ApplicationsSection from './components/ApplicationsSection';
import EnrollmentsSection from './components/EnrollmentsSection';
import CompletedCoursesSection from './components/CompletedCoursesSection';
import ApplyScreen from './components/ApplyScreen';
import { PrivacyPolicyScreen, TermsOfServiceScreen } from './components/LegalScreens';
import MessagesListScreen from './components/MessagesListScreen';
import ChangePasswordScreen from './components/ChangePasswordScreen';
import CoursePlayerScreen from './components/CoursePlayerScreen';
import SettingsScreen from './components/SettingsScreen';
import AtendimentoPanelScreen from './components/AtendimentoPanelScreen';
import { resolveUserHierarchyTier } from './lib/hierarchyRoles';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('landing');
  const [history, setHistory] = useState<ScreenId[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin2FAVerified, setIsAdmin2FAVerified] = useState(false);
  const [activePerk, setActivePerk] = useState<string | null>(null);
  const [jobsVersion, setJobsVersion] = useState(0);
  const [blockedNotice, setBlockedNotice] = useState<{ email: string; name?: string; reason?: string } | null>(null);
  const [, toggleDarkMode] = useTheme();

  useEffect(() => {
    if (user?.email) {
      try {
        const saved = localStorage.getItem(`oportuniza-shop-perks-${user.email}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setActivePerk(parsed.activePerk || null);
        } else {
          setActivePerk(null);
        }
      } catch {
        setActivePerk(null);
      }
    } else {
      setActivePerk(null);
    }
  }, [user, currentScreen]);

  // Candidacies tracking state
  const [applications, setApplications] = useState<Application[]>([]);
  // Enrollments tracking state
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  // Favorites tracking state
  const [favorites, setFavorites] = useState<string[]>([]);
  // Courses tracking progress
  const [courses, setCourses] = useState<Course[]>(() => [...mockCourses]);

  const [completedCourses, setCompletedCourses] = useState<UserCourseProgress[]>([]);
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [jobSearchFilter, setJobSearchFilter] = useState('');

  const fetchUserData = useCallback(async () => {
    if (!user?.id || user.isAdmin) return;

    try {
      const orFilters: string[] = [`user_id.eq.${user.id}`];
      if (user.email) orFilters.push(`candidate_email.ilike.%${user.email.trim()}%`);
      if (user.name) orFilters.push(`candidate_name.ilike.%${user.name.trim()}%`);

      const [compResult, enrResult, appsResult] = await Promise.all([
        supabase.from('user_course_progress').select('*').eq('user_id', user.id),
        supabase.from('enrollments').select('*').eq('user_id', user.id),
        supabase.from('applications').select('*').or(orFilters.join(','))
      ]);

      if (compResult.data) {
        setCompletedCourses(compResult.data);
      } else if (compResult.error) {
        console.error('Error fetching completed courses:', compResult.error);
      }
      
      if (enrResult.data) {
        const mappedEnr: Enrollment[] = enrResult.data.map(enr => ({
          id: enr.id,
          courseId: enr.course_id,
          courseTitle: enr.course_title,
          instructor: enr.instructor,
          enrolledDate: enr.enrolled_date,
          status: enr.status,
          progress: enr.progress,
          userName: enr.user_name
        }));
        setEnrollments(mappedEnr);
      } else if (enrResult.error) {
        console.error('Error fetching enrollments:', enrResult.error);
      }

      if (appsResult.data) {
        const mappedApps: Application[] = appsResult.data.map(app => {
          let cName = app.candidate_name || 'Usuário';
          let cEmail = '';
          let cPhone = '';
          if (cName.includes('|')) {
            const parts = cName.split('|');
            cName = parts[0].trim();
            if (parts.length > 1) cEmail = parts[1].trim();
            if (parts.length > 2) cPhone = parts[2].trim();
          }

          let finalDate = app.created_at || app.applied_date;
          if (app.created_at) {
            try {
              finalDate = new Date(app.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            } catch (e) {}
          }

          const rawSt = (app.status || 'Em análise').toLowerCase();
          let normalizedStatus: 'Em análise' | 'Entrevista' | 'Aprovado' | 'Reprovado' = 'Em análise';
          if (rawSt.includes('entrevista')) normalizedStatus = 'Entrevista';
          else if (rawSt.includes('aprovad')) normalizedStatus = 'Aprovado';
          else if (rawSt.includes('reprovad')) normalizedStatus = 'Reprovado';

          return {
            id: app.id,
            jobId: app.job_id,
            jobTitle: app.job_title,
            company: app.company,
            appliedDate: finalDate,
            status: normalizedStatus,
            candidateName: cName,
            candidateEmail: cEmail || app.candidate_email || undefined,
            candidatePhone: cPhone || app.candidate_phone || undefined,
            cvLink: app.cv_link,
            cvFileName: app.cv_file_name
          };
        });
        setApplications(mappedApps);
      } else if (appsResult.error) {
        console.error('Error fetching applications:', appsResult.error);
      }
    } catch (err) {
      console.error("Parallel fetch failed:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Real-time synchronization & interval polling for candidate applications
  useEffect(() => {
    if (!user?.id || user.isAdmin) return;

    // 1. Listen for cross-component update events
    const handleLocalUpdate = () => {
      fetchUserData();
    };
    window.addEventListener('oportuniza-application-updated', handleLocalUpdate);

    // 2. Real-time postgres changes listener
    const channel = supabase
      .channel(`candidate-apps-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        () => {
          fetchUserData();
        }
      )
      .subscribe();

    // 3. Fallback interval polling every 10 seconds
    const interval = setInterval(() => {
      fetchUserData();
    }, 10000);

    return () => {
      window.removeEventListener('oportuniza-application-updated', handleLocalUpdate);
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user, fetchUserData]);

  // Re-fetch data on screen navigation to home or applications
  useEffect(() => {
    if (currentScreen === 'home' || currentScreen === 'applications') {
      fetchUserData();
    }
  }, [currentScreen, fetchUserData]);

  // Keyboard shortcut listener: Ctrl + Shift + A to navigate to admin panel if user is admin
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isKeyA = e.key === 'a' || e.key === 'A' || e.code === 'KeyA';
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && isKeyA) {
        const isUserAdmin = Boolean(
          user && (
            user.isAdmin ||
            user.role?.toLowerCase() === 'administrador' ||
            user.role?.toLowerCase() === 'admin' ||
            user.cargo?.toLowerCase() === 'administrador' ||
            user.email?.toLowerCase() === 'oportunizahw@gmail.com'
          )
        );

        if (isUserAdmin) {
          e.preventDefault();
          setUser(prev => prev ? { ...prev, isAdmin: true } : prev);
          setCurrentScreen('admin');
          toast.info('Acessando painel de administração...');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [user]);

  // Synchronize courses changes when admin acts
  useEffect(() => {
    const handleCoursesChanged = () => {
      setCourses([...mockCourses]);
    };

    window.addEventListener('oportuniza-courses-changed', handleCoursesChanged);
    return () => {
      window.removeEventListener('oportuniza-courses-changed', handleCoursesChanged);
    };
  }, []);

  // Details navigation state
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [detailCourse, setDetailCourse] = useState<Course | null>(null);
  const [settingsTabType, setSettingsTabType] = useState<'profile' | 'settings' | 'favorites' | 'applications' | 'enrollments' | 'completed' | 'cv'>('settings');
  const [focusedJob, setFocusedJob] = useState<Job | null>(null);
  
  // Real-time matching jobs for search bar live dropdown preview
  const matchedLiveJobs = useMemo(() => {
    const q = homeSearchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return mockJobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        (j.location || '').toLowerCase().includes(q) ||
        (j.description || '').toLowerCase().includes(q)
    ).slice(0, 4);
  }, [homeSearchQuery]);

  const handleHomeSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setJobSearchFilter(homeSearchQuery.trim());
    handleScreenNavigation('jobs');
  };

  const handleQuickTagClick = (tag: string) => {
    setHomeSearchQuery(tag);
    setJobSearchFilter(tag);
    handleScreenNavigation('jobs');
  };
  
  // Unread messages context counts
  const [unreadMessages, setUnreadMessages] = useState(1);
  const [isInitializing, setIsInitializing] = useState(true);

  // Toast notifications trigger function
  const setNotification = (msg: string | null) => {
    if (!msg) return;
    if (msg.toLowerCase().includes('erro') || msg.toLowerCase().includes('falha') || msg.toLowerCase().includes('incorrect')) {
      toast.error(msg);
    } else if (msg.toLowerCase().includes('cancelad') || msg.toLowerCase().includes('excluí') || msg.toLowerCase().includes('vaga') || msg.toLowerCase().includes('reunidos')) {
      toast.warning(msg);
    } else if (msg.toLowerCase().includes('sucesso') || msg.toLowerCase().includes('adicionado') || msg.toLowerCase().includes('salvo') || msg.toLowerCase().includes('concluí') || msg.toLowerCase().includes('concluído')) {
      toast.success(msg);
    } else {
      toast.info(msg);
    }
  };

  const fetchApplications = async () => {
    if (!user || user.isAdmin) return;
    try {
      const { data: appsData, error: appsError } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user.id);
      
      if (appsError) {
        if (appsError.code === 'PGRST303') {
          console.warn("JWT issued at future (PGRST303), refreshing session...");
          await supabase.auth.refreshSession();
        }
        if (appsError.message?.includes('fetch') || appsError.message?.includes('network')) {
          console.warn("Supabase applications fetch failed due to connection.");
        } else {
          console.error('Error fetching applications:', appsError);
        }
        return;
      }

      if (appsData) {
        const mappedApps: Application[] = appsData.map(app => {
          let cName = app.candidate_name || 'Usuário';
          let cEmail = '';
          let cPhone = '';
          if (cName.includes('|')) {
            const parts = cName.split('|');
            cName = parts[0].trim();
            if (parts.length > 1) cEmail = parts[1].trim();
            if (parts.length > 2) cPhone = parts[2].trim();
          }

          let finalDate = app.created_at || app.applied_date;
          if (app.created_at) {
            try {
              finalDate = new Date(app.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            } catch (e) {}
          }

          return {
            id: app.id,
            jobId: app.job_id,
            jobTitle: app.job_title,
            company: app.company,
            appliedDate: finalDate,
            status: app.status,
            candidateName: cName,
            cvLink: app.cv_link,
            cvFileName: app.cv_file_name,
            candidateEmail: cEmail || undefined,
            candidatePhone: cPhone || undefined
          };
        });
        setApplications(mappedApps);
      }
    } catch (err) {
      console.warn("Applications sync fetch error:", err);
    }
  };

  useEffect(() => {
    if (user) {
      const tier = resolveUserHierarchyTier(user);
      if (tier.id === 'support_service' && (currentScreen === 'landing' || currentScreen === 'login' || currentScreen === 'register' || currentScreen === 'home')) {
        setCurrentScreen('atendimento');
      } else if (currentScreen === 'landing' || currentScreen === 'login' || currentScreen === 'register') {
        setCurrentScreen('home');
      }
    }
  }, [user, currentScreen]);

  // Real-time watcher: Kick out user immediately if they get blocked while browsing or in another tab
  useEffect(() => {
    if (!user) return;
    const checkActiveUserBlocked = async () => {
      try {
        const isBlocked = await isAccountBlocked({ id: user.id, email: user.email });
        if (isBlocked) {
          console.warn("Active user is blocked. Logging out immediately:", user.email);
          await supabase.auth.signOut();
          setUser(null);
          setApplications([]);
          setEnrollments([]);
          setFavorites([]);
          setCompletedCourses([]);
          setBlockedNotice({
            email: user.email || 'Sua conta',
            name: user.name || user.email
          });
          setCurrentScreen('landing');
        }
      } catch (e) {
        console.warn("Error in checkActiveUserBlocked:", e);
      }
    };

    const interval = setInterval(checkActiveUserBlocked, 4000);
    window.addEventListener('storage', checkActiveUserBlocked);
    window.addEventListener('focus', checkActiveUserBlocked);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', checkActiveUserBlocked);
      window.removeEventListener('focus', checkActiveUserBlocked);
    };
  }, [user]);

  useEffect(() => {
    // Supabase Auth Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // If the event is USER_UPDATED, it might have been triggered by our proprio handleSaveProfile.
      if (event === 'USER_UPDATED' && user) {
        console.log("Auth event: USER_UPDATED. Skipping full profile re-fetch to avoid race conditions.");
        return;
      }

      if (session) {
        // Clean URL hash containing OAuth access_token after Supabase extracts it
        if (typeof window !== 'undefined' && window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('error_description'))) {
          try {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          } catch (e) {
            console.warn('Could not clean URL hash:', e);
          }
        }

        const supabaseUser = session.user;
        const cleanEmail = (supabaseUser.email || '').trim().toLowerCase();
        const userId = supabaseUser.id;

        // 1. CRITICAL GATEKEEPER: Check if user/email is blocked BEFORE setting user state or DB upserts
        const blocked = await isAccountBlocked({ id: userId, email: cleanEmail });
        if (blocked) {
          console.warn("Blocked user attempted login/session (Google or email):", cleanEmail, userId);
          await supabase.auth.signOut();
          setUser(null);
          setApplications([]);
          setEnrollments([]);
          setFavorites([]);
          setCompletedCourses([]);
          setBlockedNotice({
            email: cleanEmail || 'Sua conta',
            name: supabaseUser.user_metadata?.full_name || cleanEmail
          });
          setCurrentScreen('landing');
          setIsInitializing(false);
          return;
        }

        const rawType = String(supabaseUser.user_metadata?.account_type || supabaseUser.user_metadata?.accountType || '').toLowerCase();
        const rawRole = String(supabaseUser.user_metadata?.role || supabaseUser.user_metadata?.cargo || '').toLowerCase();
        const isCompMeta = rawType === 'company' || rawRole === 'empresa';

        const initialUser: User = {
          id: supabaseUser.id,
          name: supabaseUser.user_metadata?.full_name || cleanEmail.split('@')[0] || 'Usuário',
          email: cleanEmail,
          avatarUrl: supabaseUser.user_metadata?.avatar_url || '',
          bio: '',
          education: isCompMeta ? 'Empresa / Empregador' : 'Ensino Médio em andamento',
          experience: isCompMeta ? 'Empresa Contratante em Araucária' : 'Nenhuma registrada',
          phone: supabaseUser.user_metadata?.phone || '',
          skills: [],
          favorites: [],
          accountType: isCompMeta ? 'company' : 'candidate',
          role: isCompMeta ? 'Empresa' : 'Candidato',
          cargo: isCompMeta ? 'Empresa' : 'Estudante'
        };
        
        // Fetch profile with database validation
        const fetchProfile = async () => {
          try {
            let { data } = await supabase
              .from('users')
              .select('*')
              .eq('id', supabaseUser.id)
              .maybeSingle();

            if (!data && cleanEmail) {
              const { data: byEmail } = await supabase
                .from('users')
                .select('*')
                .ilike('email', cleanEmail)
                .maybeSingle();
              if (byEmail) {
                data = byEmail;
              }
            }

            let companyData: any = null;
            if (cleanEmail) {
              const { data: cRow } = await supabase
                .from('companies')
                .select('*')
                .ilike('email', cleanEmail)
                .maybeSingle();
              if (cRow) {
                companyData = cRow;
              }
            }

            if (data || companyData) {
              let cachedUser: any = null;
              try {
                const raw = localStorage.getItem('oportuniza-current-user');
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (parsed && parsed.email && parsed.email.trim().toLowerCase() === cleanEmail.toLowerCase()) {
                    cachedUser = parsed;
                  }
                }
              } catch (e) {}

              const isBlocked = isUserRecordBlocked(data || {});
              if (isBlocked) {
                console.warn("Usuário bloqueado no banco tentou acessar:", cleanEmail);
                const blockReason = extractBlockReasonFromRecord(data) || await fetchAccountBlockReason({ id: supabaseUser.id, email: cleanEmail });
                await supabase.auth.signOut();
                setUser(null);
                setApplications([]);
                setEnrollments([]);
                setFavorites([]);
                setCompletedCourses([]);
                setBlockedNotice({
                  email: cleanEmail || 'Sua conta',
                  name: data?.name || cleanEmail,
                  reason: blockReason
                });
                setCurrentScreen('landing');
                return;
              }

              const isAdminUser = Boolean(
                data?.is_admin ||
                data?.isAdmin ||
                data?.role === 'Administrador' ||
                data?.cargo === 'Administrador' ||
                cleanEmail === 'oportunizahw@gmail.com'
              );

              // Accurately determine if the user is a Company account
              const explicitType = String(data?.account_type || data?.accountType || supabaseUser.user_metadata?.account_type || '').toLowerCase();
              const roleLower = String(data?.role || data?.cargo || supabaseUser.user_metadata?.role || '').toLowerCase();

              let isCompanyAccount = false;
              if (explicitType === 'company' || roleLower === 'empresa') {
                isCompanyAccount = true;
              } else if (explicitType === 'candidate' || roleLower === 'candidato' || roleLower === 'estudante') {
                isCompanyAccount = false;
              } else if (cachedUser?.accountType === 'company' && cachedUser?.email?.toLowerCase() === cleanEmail) {
                isCompanyAccount = true;
              } else if (companyData && companyData.user_id === supabaseUser.id && (data?.account_type === 'company' || data?.role === 'Empresa')) {
                isCompanyAccount = true;
              }

              const rawDbRole = data?.role || data?.cargo;
              const userRole = rawDbRole || (isAdminUser ? 'Administrador' : (isCompanyAccount ? 'Empresa' : 'Candidato'));
              const userCargo = data?.cargo || rawDbRole || (isAdminUser ? 'Administrador' : (isCompanyAccount ? 'Empresa' : 'Estudante'));
              const logoUrl = isCompanyAccount 
                ? (data?.company_logo_url || data?.companyLogoUrl || data?.avatar_url || companyData?.logo_url || companyData?.avatar_url || cachedUser?.companyLogoUrl || cachedUser?.avatarUrl || '') 
                : (data?.avatar_url || cachedUser?.avatarUrl || initialUser.avatarUrl || '');

              const dbLoadedUser: User = {
                id: supabaseUser.id,
                name: isCompanyAccount 
                  ? (companyData?.company_name || data?.company_name || data?.name || cachedUser?.name || initialUser.name)
                  : (data?.name || cachedUser?.name || initialUser.name),
                email: data?.email || cleanEmail || initialUser.email,
                avatarUrl: logoUrl,
                companyLogoUrl: isCompanyAccount ? logoUrl : undefined,
                companyName: isCompanyAccount ? (companyData?.company_name || data?.company_name || data?.companyName || cachedUser?.companyName || '') : undefined,
                cnpj: isCompanyAccount ? (companyData?.cnpj || data?.cnpj || cachedUser?.cnpj || '') : undefined,
                responsibleName: isCompanyAccount ? (companyData?.responsible_name || data?.responsible_name || data?.responsibleName || cachedUser?.responsibleName || '') : undefined,
                companySegment: isCompanyAccount ? (companyData?.segment || data?.company_segment || data?.companySegment || cachedUser?.companySegment || '') : undefined,
                companyNeighborhood: isCompanyAccount ? (companyData?.neighborhood || data?.company_neighborhood || data?.companyNeighborhood || cachedUser?.companyNeighborhood || '') : undefined,
                accountType: isCompanyAccount ? 'company' : 'candidate',
                bio: data?.bio || (isCompanyAccount ? companyData?.bio : '') || cachedUser?.bio || '',
                education: data?.education || (isCompanyAccount ? 'Empresa / Empregador' : 'Ensino Médio em andamento'),
                experience: data?.experience || (isCompanyAccount ? 'Empresa Contratante em Araucária' : 'Nenhuma registrada'),
                phone: (isCompanyAccount ? companyData?.phone : null) || data?.phone || supabaseUser.user_metadata?.phone || '',
                skills: Array.isArray(data?.skills) ? data.skills : [],
                favorites: initialUser.favorites || [],
                notificationsEnabled: data?.notifications_enabled ?? true,
                marketingEmailsEnabled: data?.marketing_emails_enabled ?? false,
                updatedAt: data?.updated_at,
                isAdmin: isAdminUser,
                isBlocked: false,
                status: 'active',
                role: userRole,
                cargo: userCargo
              };

              setUser(dbLoadedUser);
              const loadedTier = resolveUserHierarchyTier(dbLoadedUser);
              if (loadedTier.id === 'support_service') {
                setCurrentScreen('atendimento');
              }
              try {
                localStorage.setItem('oportuniza-current-user', JSON.stringify(dbLoadedUser));
              } catch (e) {}
              if (dbLoadedUser.favorites) {
                setFavorites(dbLoadedUser.favorites);
              }
            } else {
              // Check if user is blocked before attempting default row creation
              const isStillBlocked = await isAccountBlocked({ id: supabaseUser.id, email: cleanEmail });
              if (isStillBlocked) {
                console.warn("Blocked user attempted profile auto-creation:", cleanEmail);
                const blockReason = await fetchAccountBlockReason({ id: supabaseUser.id, email: cleanEmail });
                await supabase.auth.signOut();
                setUser(null);
                setApplications([]);
                setEnrollments([]);
                setFavorites([]);
                setCompletedCourses([]);
                setBlockedNotice({
                  email: cleanEmail || 'Sua conta',
                  name: initialUser.name || cleanEmail,
                  reason: blockReason
                });
                setCurrentScreen('landing');
                return;
              }

              // Create default row in the 'users' table ONLY if user is verified NOT blocked
              try {
                await supabase
                  .from('users')
                  .upsert({
                    id: supabaseUser.id,
                    name: initialUser.name,
                    email: initialUser.email,
                    avatar_url: initialUser.avatarUrl,
                    education: 'Ensino Médio em andamento',
                    experience: 'Nenhuma registrada',
                    phone: '',
                    skills: []
                  }, { onConflict: 'id' });
                console.log("Profile created successfully in database for:", initialUser.email);
              } catch (upsertErr) {
                console.error("Failed to auto-upsert user on session change:", upsertErr);
              }
              setUser(initialUser);
            }

            setFavorites(prev => (prev.length > 0 ? prev : []));
            fetchApplications();
          } catch (err: any) {
            if (err.message && (err.message === 'Failed to fetch' || err.message.includes('fetch'))) {
              console.warn("Supabase connection failed. Check your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
            } else {
              console.error("Profile fetch error:", err);
            }
          } finally {
            setIsInitializing(false);
          }
        };

        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000));
        
        Promise.race([fetchProfile(), timeout])
          .catch(() => setIsInitializing(false));

      } else {
        // No session exists, clear everything to maintain strict isolation
        setUser(null);
        setApplications([]);
        setEnrollments([]);
        setFavorites([]);
        setCompletedCourses([]);
        
        localStorage.removeItem('oportuniza-current-user');
        localStorage.removeItem('oportuniza-applications');
        localStorage.removeItem('oportuniza-enrollments');
        localStorage.removeItem('oportuniza-favorites');
        localStorage.removeItem('oportuniza-courses-progress');
        
        setIsInitializing(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Load live data from Supabase if available
    loadJobsFromSupabase();
    loadCoursesFromSupabase();

    // Poll every 10 seconds to ensure real-time synchronization with HR published jobs
    const pollInterval = setInterval(() => {
      loadJobsFromSupabase();
    }, 10000);

    return () => clearInterval(pollInterval);
  }, []);

  useEffect(() => {
    const handleCoursesChanged = () => {
      setCourses([...mockCourses]);
    };

    window.addEventListener('oportuniza-courses-changed', handleCoursesChanged);
    return () => {
      window.removeEventListener('oportuniza-courses-changed', handleCoursesChanged);
    };
  }, []);

  useEffect(() => {
    const handleJobsChanged = () => {
      setJobsVersion(v => v + 1);
    };

    window.addEventListener('oportuniza-jobs-changed', handleJobsChanged);
    return () => {
      window.removeEventListener('oportuniza-jobs-changed', handleJobsChanged);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Logout error:", err);
    }
    
    // Clear all app specific local storage for protection and isolation
    try {
      localStorage.removeItem('oportuniza-current-user');
      localStorage.removeItem('oportuniza-applications');
      localStorage.removeItem('oportuniza-enrollments');
      localStorage.removeItem('oportuniza-favorites');
      localStorage.removeItem('oportuniza-courses-progress');
      
      // Remove any leftover supabase session keys from storage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth-token'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.warn("Error cleaning storage during logout:", e);
    }
    
    // Reset all isolated state
    setUser(null);
    setApplications([]);
    setEnrollments([]);
    setFavorites([]);
    setCompletedCourses([]);
    setHistory([]);
    setIsAdmin2FAVerified(false);
    setCurrentScreen('landing');
  };

  const handleApply = async (job: Job, cvInfo?: { link?: string, fileName?: string }): Promise<boolean> => {
    if (!user?.id) {
      setNotification('Você precisa entrar ou criar uma conta para se candidatar!');
      setTimeout(() => setNotification(null), 2500);
      handleScreenNavigation('login');
      return false;
    }
    const isAlreadyApplied = applications.some((app) => app.jobId === job.id);
    if (isAlreadyApplied) {
      setNotification('Você já se candidatou para esta vaga!');
      setTimeout(() => setNotification(null), 2000);
      return false;
    }

    // Tentativas progressivas de payload para suportar qualquer versão do schema da tabela applications no Supabase
    const candidateFullInfo = `${user.name || 'Usuário'} | ${user.email} | ${user.phone || ''}`;
    const cvInfoString = cvInfo?.link ? `Link: ${cvInfo.link}` : (cvInfo?.fileName ? `Arquivo: ${cvInfo.fileName}` : '');

    const payloadsToTry = [
      // 1. Schema completo
      {
        user_id: user.id,
        job_id: job.id,
        job_title: job.title,
        company: job.company,
        applied_date: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        status: 'Em análise',
        candidate_name: candidateFullInfo,
        candidate_email: user.email,
        candidate_phone: user.phone || null,
        cv_link: cvInfo?.link || null,
        cv_file_name: cvInfo?.fileName || null
      },
      // 2. Sem candidate_email / candidate_phone (tabelas intermediárias)
      {
        user_id: user.id,
        job_id: job.id,
        job_title: job.title,
        company: job.company,
        applied_date: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        status: 'Em análise',
        candidate_name: candidateFullInfo,
        cv_link: cvInfo?.link || null,
        cv_file_name: cvInfo?.fileName || null
      },
      // 3. Sem cv_file_name (armazena informação do arquivo dentro de cv_link ou candidate_name)
      {
        user_id: user.id,
        job_id: job.id,
        job_title: job.title,
        company: job.company,
        applied_date: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        status: 'Em análise',
        candidate_name: cvInfoString ? `${candidateFullInfo} | ${cvInfoString}` : candidateFullInfo,
        cv_link: cvInfo?.link || (cvInfo?.fileName ? `Arquivo: ${cvInfo.fileName}` : null)
      },
      // 4. Apenas colunas básicas
      {
        user_id: user.id,
        job_id: job.id,
        job_title: job.title,
        company: job.company,
        applied_date: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        status: 'Em análise',
        candidate_name: cvInfoString ? `${candidateFullInfo} | ${cvInfoString}` : candidateFullInfo
      },
      // 5. Bare minimum
      {
        user_id: user.id,
        job_id: job.id,
        job_title: job.title,
        company: job.company
      }
    ];

    // 1. Tentar garantir previamente que o registro da vaga existe na tabela jobs para satisfazer possíveis Foreign Keys
    try {
      await supabase.from('jobs').upsert([{
        id: String(job.id),
        title: job.title || 'Vaga',
        company: job.company || 'Empresa',
        location: job.location || '',
        type: job.type || 'Tempo Integral',
        salary: job.salary || '',
        description: job.description || ''
      }], { onConflict: 'id' });
    } catch (jErr) {
      console.warn('Auto-sync job to DB returned:', jErr);
    }

    let data = null;
    let lastError: any = null;

    for (const payload of payloadsToTry) {
      try {
        const res = await supabase
          .from('applications')
          .insert([payload])
          .select('*')
          .single();

        if (!res.error && res.data) {
          data = res.data;
          lastError = null;
          break;
        } else if (res.error) {
          lastError = res.error;

          // Se o erro for de Chave Estrangeira (23503: job_id inexistente na tabela jobs), tenta criar a vaga e re-inserir
          if (res.error.code === '23503' || res.error.message?.includes('foreign key')) {
            try {
              await supabase.from('jobs').upsert([{
                id: String(job.id),
                title: job.title || 'Vaga',
                company: job.company || 'Empresa',
                location: job.location || '',
                type: job.type || 'Tempo Integral',
                salary: job.salary || '',
                description: job.description || ''
              }], { onConflict: 'id' });

              const retryRes = await supabase
                .from('applications')
                .insert([payload])
                .select('*')
                .single();

              if (!retryRes.error && retryRes.data) {
                data = retryRes.data;
                lastError = null;
                break;
              }
            } catch (retryErr) {
              console.warn('Retry after 23503 failed:', retryErr);
            }
          }

          const isColumnMissing = 
            res.error.code === 'PGRST204' || 
            (res.error as any).code === '42703' || 
            res.error.message?.includes('column') || 
            res.error.message?.includes('schema cache');
          
          if (!isColumnMissing && res.error.code !== '23503') {
            break;
          }
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (lastError && !data) {
      console.error('Error applying for job - Supabase error:', lastError);
      setNotification(`Erro ao salvar candidatura: ${lastError.message || 'Verifique a conexão.'}`);
      setTimeout(() => setNotification(null), 3000);
      return false;
    }

    if (data) {
      console.log('Application saved to DB:', data);
      let cName = data.candidate_name || candidateFullInfo;
      let cEmail = data.candidate_email || user.email;
      let cPhone = data.candidate_phone || user.phone || '';
      if (cName.includes('|')) {
        const parts = cName.split('|');
        cName = parts[0].trim();
        if (parts.length > 1 && !cEmail) cEmail = parts[1].trim();
        if (parts.length > 2 && !cPhone) cPhone = parts[2].trim();
      }

      let finalDate = data.created_at || data.applied_date || new Date().toLocaleString('pt-BR');
      if (data.created_at) {
        try {
          finalDate = new Date(data.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) {}
      }

      const newApp: Application = {
        id: String(data.id || Date.now()),
        jobId: data.job_id || job.id,
        jobTitle: data.job_title || job.title,
        company: data.company || job.company,
        appliedDate: finalDate,
        status: data.status || 'Em análise',
        candidateName: cName,
        cvLink: data.cv_link || cvInfo?.link,
        cvFileName: data.cv_file_name || cvInfo?.fileName,
        candidateEmail: cEmail || undefined,
        candidatePhone: cPhone || undefined
      };
      setApplications(prev => [...prev, newApp]);
      setNotification('Candidatura enviada com sucesso!');
      setTimeout(() => setNotification(null), 2000);
      return true;
    } else {
      console.error('Error applying for job: No data returned.');
      setNotification('Erro ao salvar candidatura. Tente novamente.');
      setTimeout(() => setNotification(null), 2000);
      return false;
    }
  };

  const handleCancelApplication = async (id: string) => {
    try {
      const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', id);
      
      if (!error) {
        const updated = applications.filter(app => app.id !== id);
        setApplications(updated);
        setNotification('Candidatura cancelada com sucesso!');
        setTimeout(() => setNotification(null), 2000);
      } else {
        console.error('Error canceling application:', error);
        setNotification('Erro ao cancelar candidatura. Tente novamente.');
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (err: any) {
      console.error('Exception canceling application:', err);
      setNotification('Erro ao se conectar ao banco de dados.');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleContinueCourse = (enrollmentId: string) => {
    const enrollment = enrollments.find(e => e.id === enrollmentId);
    if (enrollment) {
      // Find corresponding parent course
      const parentCourse = courses.find(c => c.id === enrollment.courseId);
      if (parentCourse) {
        setDetailCourse(parentCourse);
        handleScreenNavigation('course-player');
        setNotification('Retomando seu curso...');
        setTimeout(() => setNotification(null), 2000);
        return;
      }
    }
    // Fallback if not found
    handleScreenNavigation('courses');
    setNotification('Retomando seu curso...');
    setTimeout(() => setNotification(null), 2000);
  };

  const handleEnrollInCourse = async (course: Course): Promise<boolean> => {
    if (!user?.id) {
      setNotification('Você precisa entrar ou criar uma conta para se inscrever no curso!');
      setTimeout(() => setNotification(null), 2500);
      handleScreenNavigation('login');
      return false;
    }
    const exists = enrollments.some(e => e.courseId === course.id);
    if (exists) {
      setNotification('Você já está inscrito neste curso!');
      setTimeout(() => setNotification(null), 2000);
      return false;
    }

    const payloadsToTry = [
      // 1. Schema completo
      {
        user_id: user.id,
        user_name: user.name || 'Usuário',
        course_id: course.id,
        course_title: course.title,
        instructor: course.instructor,
        enrolled_date: new Date().toLocaleDateString('pt-BR'),
        status: 'Iniciado',
        progress: 0
      },
      // 2. Sem instructor/user_name
      {
        user_id: user.id,
        course_id: course.id,
        course_title: course.title,
        enrolled_date: new Date().toLocaleDateString('pt-BR'),
        status: 'Iniciado',
        progress: 0
      },
      // 3. Mínimo
      {
        user_id: user.id,
        course_id: course.id,
        course_title: course.title
      }
    ];

    // 1. Tentar garantir previamente que o registro do curso existe na tabela courses para satisfazer possíveis Foreign Keys
    try {
      await supabase.from('courses').upsert([{
        id: String(course.id),
        title: course.title || 'Curso',
        description: (course as any).description || course.desc || '',
        category: course.category || 'Geral',
        duration: course.duration || '10 horas',
        instructor: course.instructor || 'Oportuniza',
        active: true
      }], { onConflict: 'id' });
    } catch (cErr) {
      console.warn('Auto-sync course to DB returned:', cErr);
    }

    let data = null;
    let lastError: any = null;

    for (const payload of payloadsToTry) {
      try {
        const res = await supabase
          .from('enrollments')
          .insert([payload])
          .select('*')
          .single();

        if (!res.error && res.data) {
          data = res.data;
          lastError = null;
          break;
        } else if (res.error) {
          lastError = res.error;

          // Se o erro for de Chave Estrangeira (23503: course_id inexistente na tabela courses), tenta criar o curso e re-inserir
          if (res.error.code === '23503' || res.error.message?.includes('foreign key')) {
            try {
              await supabase.from('courses').upsert([{
                id: String(course.id),
                title: course.title || 'Curso',
                description: (course as any).description || course.desc || '',
                category: course.category || 'Geral',
                duration: course.duration || '10 horas',
                instructor: course.instructor || 'Oportuniza',
                active: true
              }], { onConflict: 'id' });

              const retryRes = await supabase
                .from('enrollments')
                .insert([payload])
                .select('*')
                .single();

              if (!retryRes.error && retryRes.data) {
                data = retryRes.data;
                lastError = null;
                break;
              }
            } catch (retryErr) {
              console.warn('Retry after 23503 failed:', retryErr);
            }
          }

          const isColumnMissing = 
            res.error.code === 'PGRST204' || 
            (res.error as any).code === '42703' || 
            res.error.message?.includes('column') || 
            res.error.message?.includes('schema cache');
          
          if (!isColumnMissing && res.error.code !== '23503') {
            break;
          }
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (lastError && !data) {
      console.error('Error enrolling in course:', lastError);
      setNotification(`Erro ao salvar inscrição no banco: ${lastError.message || 'Verifique a conexão.'}`);
      setTimeout(() => setNotification(null), 3000);
      return false;
    }

    if (data) {
      const newEnr: Enrollment = {
        id: String(data.id || Date.now()),
        courseId: data.course_id || course.id,
        courseTitle: data.course_title || course.title,
        instructor: data.instructor || course.instructor,
        enrolledDate: data.enrolled_date || new Date().toLocaleDateString('pt-BR'),
        status: data.status || 'Iniciado',
        progress: data.progress || 0,
        userName: data.user_name || user.name
      };
      setEnrollments(prev => [...prev, newEnr]);
      setNotification('Inscrito no curso com sucesso!');
      setTimeout(() => setNotification(null), 2000);
      return true;
    } else {
      console.error('Error enrolling in course: No data returned');
      return false;
    }
  };

  const handleToggleLessonCompletion = async (courseId: string, lessonTitle: string) => {
    if (!user?.id) return;
    
    const updatedCourses = courses.map(c => {
      if (c.id === courseId) {
        const updatedLessons = c.lessons.map(l => {
          if (l.title === lessonTitle) {
            return { ...l, done: !l.done };
          }
          return l;
        });

        const completedCount = updatedLessons.filter(l => l.done).length;
        const progressVal = Math.round((completedCount / updatedLessons.length) * 100);
        const statusVal = progressVal === 100 ? ('Concluído' as const) : progressVal > 0 ? ('Em andamento' as const) : ('Iniciado' as const);

        // Update enrollment progress in state & storage
        const updatedEnrollments = enrollments.map(e => {
          if (e.courseId === courseId) {
            return {
              ...e,
              progress: progressVal,
              status: statusVal
            };
          }
          return e;
        });

        setEnrollments(updatedEnrollments);

        // Sync with Supabase enrollments table
        const syncEnrollment = async () => {
          try {
            await supabase
              .from('enrollments')
              .update({ 
                progress: progressVal, 
                status: statusVal,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user.id)
              .eq('course_id', courseId);
          } catch (err) {
            console.warn("Failed to sync enrollment progress to DB:", err);
          }
        };
        syncEnrollment();

        return { ...c, lessons: updatedLessons, completed: progressVal === 100 };
      }
      return c;
    });

    setCourses(updatedCourses);
  };

  const handleCompleteCourse = async (userId: string, courseId: string, userName: string, courseTitle: string) => {
    try {
      const { error } = await supabase
        .from('user_course_progress')
        .insert([{ user_id: userId, course_id: courseId, user_name: userName, course_title: courseTitle }]);
      if (error) {
        console.error('Error saving course completion:', error);
      } else {
        setNotification('Curso concluído com sucesso e salvo em sua conta!');
        // Update local state immediately
        const newCompleted: UserCourseProgress = {
          id: Math.random().toString(36).substr(2, 9),
          user_id: userId,
          course_id: courseId,
          user_name: userName,
          course_title: courseTitle,
          completed_at: new Date().toISOString()
        };
        setCompletedCourses(prev => [newCompleted, ...prev]);
      }
    } catch (err: any) {
      console.error('Exception saving course completion:', err);
    }
  };

  const handleUnsubscribeCourse = (id: string) => {
    const updated = enrollments.filter(e => e.id !== id);
    setEnrollments(updated);
    setNotification('Inscrição cancelada com sucesso');
    setTimeout(() => setNotification(null), 2000);
  };

  const handleDeleteAllData = async () => {
    if (user?.id) {
      try {
        await supabase
          .from('users')
          .delete()
          .eq('id', user.id);
      } catch (err) {
        console.error("Error deleting user from database:", err);
      }
    }

    await handleSignOut();
    
    setNotification('Todos os seus dados foram excluídos permanentemente');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleToggleFavorite = async (jobId: string) => {
    if (!user?.id) return;
    
    const isAdding = !favorites.includes(jobId);
    let updated: string[];
    if (favorites.includes(jobId)) {
      updated = favorites.filter((id) => id !== jobId);
    } else {
      updated = [...favorites, jobId];
    }
    setFavorites(updated);

    // Persist to DB users table under a JSONB column or similar
    // We removed DB sync because the column 'favorites' might not exist in the 'users' table.
    // Local storage is sufficient for now.

    if (isAdding) {
      setNotification('Adicionado aos favoritos!');
      setTimeout(() => setNotification(null), 2000);
    }
  };

  // Profile completion meter ratio calculation
  const calculateCompletionPercent = () => {
    if (!user) return 0;
    let pts = 10; // base points
    
    // Avatar: 15 pts
    if (user.avatarUrl && user.avatarUrl.length > 0) pts += 15;
    
    // Phone: 15 pts
    if (user.phone && user.phone.trim().length > 5) pts += 15;
    
    // Skills: 20 pts
    if (user.skills && Array.isArray(user.skills) && user.skills.length > 0) pts += 20;
    
    // Education: 15 pts
    if (user.education && user.education.trim() !== 'Nenhuma' && user.education.trim() !== '') pts += 15;
    
    // Experience (Resumo Profissional / Experiência): 25 pts
    if (user.experience && user.experience.trim() !== 'Nenhuma registrada' && user.experience.trim() !== '') pts += 25;
    
    return Math.min(pts, 100);
  };

  const handleScreenNavigation = (screen: ScreenId) => {
    console.log('Navigating to screen:', screen);
    setHistory((prev) => {
      if (prev[prev.length - 1] === currentScreen) {
        return prev;
      }
      return [...prev, currentScreen];
    });
    setCurrentScreen(screen);
    if (screen === 'settings') setSettingsTabType('settings');
    // Clear unread count when reading messages
    if (screen === 'messages') {
      setUnreadMessages(0);
    }
  };

  const handleGoBack = (fallback: ScreenId = 'home') => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((prevStack) => prevStack.slice(0, -1));
      setCurrentScreen(prev);
    } else {
      setCurrentScreen(fallback);
    }
  };

  return (
    <div className="device-frame">
      {isInitializing && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-[44px]">
          <div className="w-12 h-12 border-4 border-[#52A8C7]/20 border-t-[#52A8C7] rounded-full animate-spin mb-4" />
          <p className="text-xs font-bold text-gray-400 animate-pulse tracking-widest uppercase">Sincronizando...</p>
        </div>
      )}
      <div className="app-container relative bg-[var(--bg-light)] select-none text-[var(--text-main)]">
        
        {/* Drawer Sidebar */}
        <SidebarComponent
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          currentScreen={currentScreen}
          onNavigate={handleScreenNavigation}
          unreadCount={unreadMessages}
          user={user}
          onSignOut={handleSignOut}
          applicationsCount={applications.length}
        />

        {/* Main Core Router */}
        <div className="w-full h-full relative">
          
          {/* Global Notification Toast */}
          <ToastContainer />

          {/* Landing Screen */}
          {currentScreen === 'landing' && (
            <LandingScreen 
                onNavigate={handleScreenNavigation} 
            />
          )}

          {/* Story Bio Screen */}
          {currentScreen === 'bio' && (
            <BioScreen onNavigate={handleScreenNavigation} />
          )}

          {/* Change Password Screen */}
          {currentScreen === 'change-password' && (
            <ChangePasswordScreen 
              user={user}
              onBack={() => handleGoBack('settings')} 
            />
          )}

          {/* Privacy Policy Screen */}
          {currentScreen === 'privacy' && (
            <PrivacyPolicyScreen onBack={() => handleGoBack('settings')} />
          )}

          {/* Terms of Service Screen */}
          {currentScreen === 'terms' && (
            <TermsOfServiceScreen onBack={() => handleGoBack('settings')} />
          )}

          {/* Auth Screens */}
          {!user && !['landing', 'bio', 'privacy', 'terms'].includes(currentScreen) && (
            <AuthScreen 
              onNavigate={handleScreenNavigation}
              defaultIsLogin={currentScreen !== 'register'}
              onLoginSuccess={(loggedInUser) => {
                setUser(loggedInUser);
                setCurrentScreen('home');
              }}
              onAdminLoginSuccess={(adminUser) => {
                setUser(adminUser);
                setCurrentScreen('admin');
              }}
            />
          )}

          {/* Admin Panel (Guarded by 2FA) */}
          {user && (user.isAdmin || currentScreen === 'admin') && (
            <ErrorBoundary fallbackTitle="Erro ao carregar o Painel Administrativo">
              {!isAdmin2FAVerified ? (
                <Admin2FAScreen
                  user={user}
                  onVerified={() => setIsAdmin2FAVerified(true)}
                  onCancel={() => {
                    setIsAdmin2FAVerified(false);
                    setCurrentScreen('home');
                  }}
                />
              ) : (
                <AdminPanelScreen 
                  user={user}
                  onLogout={handleSignOut}
                />
              )}
            </ErrorBoundary>
          )}

          {/* Company Dashboard (Exclusive Company / RH Workspace) */}
          {user && !user.isAdmin && (user.accountType === 'company' || user.role?.toLowerCase() === 'empresa' || user.cargo?.toLowerCase() === 'empresa') && (
            <ErrorBoundary fallbackTitle="Erro ao carregar o Painel da Empresa">
              <CompanyDashboardScreen
                user={user}
                onLogout={handleSignOut}
                onUpdateUser={(updated) => setUser(updated)}
              />
            </ErrorBoundary>
          )}

          {/* Main App (Protected Student View) */}
          {user && !user.isAdmin && !(user.accountType === 'company' || user.role?.toLowerCase() === 'empresa' || user.cargo?.toLowerCase() === 'empresa') && currentScreen !== 'admin' && (
            <>
              {/* Home */}
              {currentScreen === 'home' && (
            <div className="w-full h-full overflow-y-auto custom-scroll px-4 sm:px-6 md:px-8 py-5 md:py-8 bg-slate-100/60 dark:bg-slate-950 pb-20 flex flex-col items-center animate-fadeIn text-slate-900 dark:text-slate-100">
              
              <div className="w-full max-w-6xl flex flex-col gap-6">

                {/* Top Nav Header */}
                <header className="flex justify-between items-center shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-800 dark:text-slate-100 cursor-pointer font-semibold text-xs shrink-0"
                      aria-label="Abrir menu"
                    >
                      <Menu className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <span>Menu</span>
                    </button>

                    <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs flex items-center justify-center p-0.5 shrink-0">
                        <img 
                          src="https://www.image2url.com/r2/default/images/1781824138816-3fd9702f-4521-41d2-8411-d8fc61114350.png" 
                          alt="Oportuniza Araucária" 
                          className="w-full h-full object-contain" 
                        />
                      </div>
                      <div className="flex flex-col leading-tight">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Oportuniza Araucária
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                          Portal de Emprego & Qualificação
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      onClick={() => handleScreenNavigation('map')}
                      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Mapa de Vagas</span>
                    </button>

                    <button
                      onClick={() => handleScreenNavigation('messages')}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300 relative cursor-pointer"
                      aria-label="Mensagens"
                    >
                      <Bell className="w-4 h-4" />
                      {unreadMessages > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-800" />
                      )}
                    </button>

                    <button 
                      onClick={() => {
                        setSettingsTabType('profile');
                        handleScreenNavigation('profile');
                      }}
                      className="cursor-pointer flex items-center gap-2 pl-2 sm:pl-3 pr-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left group"
                      title="Abrir Meu Perfil e Currículo"
                    >
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt="Sua foto de perfil"
                          className="w-7 h-7 rounded-lg object-cover border border-slate-200 dark:border-slate-600 shadow-2xs"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-cyan-700 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                          {user.name.substring(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="hidden sm:flex flex-col leading-none">
                        <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors truncate max-w-[120px]">
                          {user.name.split(' ')[0]}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Meu Perfil & CV</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform hidden sm:block" />
                    </button>
                  </div>
                </header>

                {/* Hero Showcase Banner with Real Search */}
                <div className="relative rounded-3xl overflow-visible border border-[#16364D] dark:border-slate-800 bg-[#0B1E2D] dark:bg-slate-900 text-white p-6 sm:p-8 flex flex-col gap-6 shadow-sm">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-cyan-300 text-xs font-semibold">
                      <Building className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>Prefeitura de Araucária · Secretaria Municipal de Trabalho e Emprego</span>
                    </div>

                    <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white max-w-2xl leading-tight">
                      Olá, {user.name}! Encontre sua próxima oportunidade em Araucária
                    </h1>

                    <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                      Mais de 120 vagas de emprego CLT, estágios, jovem aprendiz e cursos profissionalizantes gratuitos para impulsionar seu currículo.
                    </p>
                  </div>

                  {/* Real Interactive Search Form inside Hero */}
                  <form onSubmit={handleHomeSearchSubmit} className="relative z-20 flex flex-col gap-2.5">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-2 sm:p-2.5 shadow-xl flex items-center gap-2 border border-slate-200 dark:border-slate-800 transition-all focus-within:ring-2 focus-within:ring-cyan-500">
                      <div className="p-2 sm:p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-400 shrink-0">
                        <Search className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={homeSearchQuery}
                        onChange={(e) => setHomeSearchQuery(e.target.value)}
                        placeholder="Qual cargo ou empresa você procura? (ex: Produção, Soldador, TI, Farmácia, Estágio...)"
                        className="w-full bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden py-1 px-1"
                      />
                      {homeSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setHomeSearchQuery('')}
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          aria-label="Limpar pesquisa"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="submit"
                        className="px-4 py-2 sm:py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shrink-0 transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                      >
                        <span>Buscar Vagas</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Live Preview Dropdown when typing */}
                    {homeSearchQuery.trim().length >= 2 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 text-slate-900 dark:text-slate-100 animate-fadeIn">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            Sugestões encontradas para &ldquo;{homeSearchQuery}&rdquo;
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {matchedLiveJobs.length} {matchedLiveJobs.length === 1 ? 'vaga' : 'vagas'}
                          </span>
                        </div>

                        {matchedLiveJobs.length > 0 ? (
                          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
                            {matchedLiveJobs.map((job) => (
                              <div
                                key={job.id}
                                onClick={() => {
                                  setDetailJob(job);
                                  setDetailCourse(null);
                                  handleScreenNavigation('details');
                                }}
                                className="p-3 hover:bg-cyan-50/50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer flex items-center justify-between gap-3 text-left"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 shrink-0">
                                    {job.logo ? (
                                      <img src={job.logo} alt={job.company} className="w-full h-full object-cover rounded" />
                                    ) : (
                                      <Briefcase className="w-4 h-4 text-slate-400" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                                      {job.title}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                      {job.company} · {job.location || 'Araucária'}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 block">
                                    {job.salary || 'A combinar'}
                                  </span>
                                  <span className="text-[10px] text-slate-400">{job.type || 'CLT'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                            Nenhuma vaga específica com o termo &ldquo;{homeSearchQuery}&rdquo;. Pressione <strong>Buscar Vagas</strong> para ver todas as opções disponíveis.
                          </div>
                        )}

                        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                          <button
                            type="submit"
                            className="font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <span>Ver todas as vagas para &ldquo;{homeSearchQuery}&rdquo;</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setHomeSearchQuery('')}
                            className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            Fechar sugestões
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Popular filter suggestions */}
                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                      <span className="text-slate-300 text-[11px] font-medium mr-0.5">Buscas frequentes:</span>
                      {['Auxiliar de Produção', 'Estágio / Aprendiz', 'Logística', 'Atendente', 'Soldador', 'Motorista'].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleQuickTagClick(tag)}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] transition-colors cursor-pointer border border-white/10"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </form>

                  {/* 3 Real-time KPI Metric Badges */}
                  <div className="relative z-10 grid grid-cols-3 gap-3 pt-4 border-t border-white/10 text-center sm:text-left">
                    <div className="flex flex-col">
                      <span className="text-lg sm:text-2xl font-black text-white tabular-nums tracking-tight">120+</span>
                      <span className="text-[11px] text-slate-300">Vagas em Aberto</span>
                    </div>
                    <div className="flex flex-col border-l border-white/10 pl-3 sm:pl-4">
                      <span className="text-lg sm:text-2xl font-black text-white tabular-nums tracking-tight">{applications.length}</span>
                      <span className="text-[11px] text-slate-300">Minhas Candidaturas</span>
                    </div>
                    <div className="flex flex-col border-l border-white/10 pl-3 sm:pl-4">
                      <span className="text-lg sm:text-2xl font-black text-white tabular-nums tracking-tight">{enrollments.length}</span>
                      <span className="text-[11px] text-slate-300">Cursos Matriculados</span>
                    </div>
                  </div>
                </div>

                {/* Candidacy Status Alert (Interview or Approved) */}
                {applications.some(app => (app.status || '').toLowerCase().includes('entrevista') || (app.status || '').toLowerCase().includes('aprovad')) && (
                  <div className="flex flex-col gap-2.5 select-none">
                    {applications
                      .filter(app => (app.status || '').toLowerCase().includes('entrevista') || (app.status || '').toLowerCase().includes('aprovad'))
                      .map((app) => {
                        const isApproved = (app.status || '').toLowerCase().includes('aprovad');
                        return (
                          <div
                            key={app.id}
                            onClick={() => handleScreenNavigation('applications')}
                            className="p-4 sm:p-5 rounded-2xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 cursor-pointer transition-all hover:shadow-md flex items-start gap-4 shadow-xs"
                          >
                            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                              <CheckCircle className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                                {isApproved ? '🎉 Candidatura Aprovada!' : '🔔 Chamada para Entrevista de Emprego!'}
                              </span>
                              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                                {isApproved
                                  ? `A empresa ${app.company} aprovou você para a vaga "${app.jobTitle}".`
                                  : `A empresa ${app.company} selecionou você para entrevista na vaga "${app.jobTitle}".`}
                              </p>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                {isApproved
                                  ? 'Aguarde as orientações da equipe de RH para envio de documentos.'
                                  : 'Fique atento ao WhatsApp e telefone informados. A equipe de recrutamento entrará em contato.'}
                              </p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-2" />
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* 4 Quick Action Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
                  <div
                    onClick={() => handleScreenNavigation('jobs')}
                    className="cursor-pointer bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-cyan-400/50 dark:hover:border-cyan-500/50 transition-all flex flex-col justify-between gap-4 group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-800/40">
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50 px-2 py-0.5 rounded-lg border border-cyan-100 dark:border-cyan-900/50">
                        120+ Vagas
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                        Vagas de Emprego
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Oportunidades CLT, estágio e aprendiz nas empresas de Araucária.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span>Acessar Vagas</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  <div
                    onClick={() => handleScreenNavigation('courses')}
                    className="cursor-pointer bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-emerald-400/50 dark:hover:border-emerald-500/50 transition-all flex flex-col justify-between gap-4 group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/40">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                        Certificado Grátis
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        Cursos Gratuitos
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Qualificação profissional prática com certificado emitido em PDF.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span>Explorar Cursos</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  <div
                    onClick={() => handleScreenNavigation('applications')}
                    className="cursor-pointer bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-indigo-400/50 dark:hover:border-indigo-500/50 transition-all flex flex-col justify-between gap-4 group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/40">
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                        {applications.length} Enviadas
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        Minhas Candidaturas
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Acompanhe o andamento dos processos seletivos e retorno do RH.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span>Acompanhar Status</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  <div
                    onClick={() => handleScreenNavigation('mentor')}
                    className="cursor-pointer bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-amber-400/50 dark:hover:border-amber-500/50 transition-all flex flex-col justify-between gap-4 group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-lg border border-amber-100 dark:border-amber-900/50">
                        Treino de RH
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        Simulador de Entrevista
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Pratique respostas com perguntas reais de recrutadores locais.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span>Iniciar Simulado</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>

                {/* Main 2-Column Responsive Split */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* Left Column (2 Cols wide on Desktop: Jobs & Courses) */}
                  <div className="lg:col-span-2 flex flex-col gap-6">

                    {/* Vagas Recentes em Araucária */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col gap-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                            Vagas Recentes em Araucária
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Oportunidades abertas nas indústrias e comércios locais
                          </p>
                        </div>
                        <button
                          onClick={() => handleScreenNavigation('jobs')}
                          className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Ver todas as 120+</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-col gap-3">
                        {mockJobs.slice(0, 3).map((job) => (
                          <div
                            key={job.id}
                            onClick={() => {
                              setDetailJob(job);
                              setDetailCourse(null);
                              handleScreenNavigation('details');
                            }}
                            className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/80 hover:border-cyan-400 dark:hover:border-cyan-600 transition-all cursor-pointer bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                          >
                            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                              <div className="w-11 h-11 rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 shrink-0 shadow-2xs">
                                {job.logo ? (
                                  <img src={job.logo} alt={job.company} className="w-full h-full object-cover" />
                                ) : (
                                  <Briefcase className="w-5 h-5 text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors truncate">
                                  {job.title}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">{job.company}</span>
                                  <span>·</span>
                                  <span>{job.location || 'Araucária'}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-700/60 shrink-0">
                              <div className="text-left sm:text-right">
                                <span className="block text-xs font-bold text-slate-900 dark:text-white">
                                  {job.salary || 'A combinar'}
                                </span>
                                <span className="text-[11px] text-slate-400">{job.type || 'CLT'}</span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetailJob(job);
                                  setDetailCourse(null);
                                  handleScreenNavigation('details');
                                }}
                                className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors shrink-0 cursor-pointer"
                              >
                                Ver Detalhes
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cursos Gratuitos em Destaque */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col gap-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                            Qualificação Gratuita em Araucária
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Cursos práticos com certificado em PDF para valorizar seu currículo
                          </p>
                        </div>
                        <button
                          onClick={() => handleScreenNavigation('courses')}
                          className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Ver todos os cursos</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {courses.filter((c: any) => c.active !== false).slice(0, 2).map((course) => (
                          <div
                            key={course.id}
                            onClick={() => {
                              setDetailCourse(course);
                              setDetailJob(null);
                              handleScreenNavigation('details');
                            }}
                            className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/80 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between gap-3 group"
                          >
                            <div className="flex items-start gap-3.5">
                              {course.coverImage ? (
                                <img
                                  src={course.coverImage}
                                  alt={course.title}
                                  className="w-20 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs"
                                />
                              ) : (
                                <div className="w-20 h-14 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0 text-emerald-600">
                                  <GraduationCap className="w-6 h-6" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                                  {course.category || 'Capacitação'}
                                </span>
                                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1 mt-0.5">
                                  {course.title}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                  {course.desc || 'Curso prático com certificado'}
                                </p>
                              </div>
                            </div>

                            <div className="pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                              <span className="text-slate-500 dark:text-slate-400">{course.duration || 'Gratuito'}</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <span>Acessar Curso</span>
                                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Right Column (1 Col wide on Desktop: Profile, CIEE & Support) */}
                  <div className="lg:col-span-1 flex flex-col gap-6">

                    {/* Dedicated Meu Perfil Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col gap-4">
                      <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt={user.name}
                                className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-2xs"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-2xl bg-cyan-700 text-white font-black text-base flex items-center justify-center shadow-2xs">
                                {user.name.substring(0, 1).toUpperCase()}
                              </div>
                            )}
                            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" title="Perfil ativo" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {user.name}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {user.email}
                            </p>
                            <span className="inline-block mt-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/50 dark:border-emerald-800/40">
                              Candidato Ativo em Araucária
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar & Strength */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            Força do Currículo
                          </span>
                          <span className="font-mono font-black text-cyan-600 dark:text-cyan-400">
                            {calculateCompletionPercent()}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-cyan-600 h-full transition-all duration-500 rounded-full"
                            style={{ width: `${calculateCompletionPercent()}%` }}
                          />
                        </div>
                      </div>

                      {/* Status checklist */}
                      <div className="flex flex-col gap-2 text-xs text-slate-600 dark:text-slate-400 pt-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className={`w-3.5 h-3.5 ${user.phone ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`} />
                          <span className={user.phone ? 'text-slate-700 dark:text-slate-200 font-medium' : ''}>
                            {user.phone ? `WhatsApp: ${user.phone}` : 'Adicionar WhatsApp para contato'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className={`w-3.5 h-3.5 ${user.education ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`} />
                          <span className={user.education ? 'text-slate-700 dark:text-slate-200 font-medium' : ''}>
                            {user.education ? user.education : 'Informar escolaridade'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className={`w-3.5 h-3.5 ${user.skills && user.skills.length > 0 ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`} />
                          <span className={user.skills && user.skills.length > 0 ? 'text-slate-700 dark:text-slate-200 font-medium' : ''}>
                            {user.skills && user.skills.length > 0 ? `${user.skills.length} habilidades informadas` : 'Cadastrar habilidades profissionais'}
                          </span>
                        </div>
                      </div>

                      {/* 3 Clear Action Buttons */}
                      <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => {
                            setSettingsTabType('profile');
                            handleScreenNavigation('profile');
                          }}
                          className="w-full py-2.5 px-3 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition-colors cursor-pointer text-center shadow-xs flex items-center justify-center gap-2"
                        >
                          <UserIcon className="w-3.5 h-3.5" />
                          <span>Editar Dados do Perfil</span>
                        </button>
                        <button
                          onClick={() => {
                            setSettingsTabType('cv');
                            handleScreenNavigation('profile');
                          }}
                          className="w-full py-2.5 px-3 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer text-center flex items-center justify-center gap-2 shadow-xs"
                        >
                          <FileText className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Visualizar / Baixar Currículo (PDF)</span>
                        </button>
                        <button
                          onClick={() => {
                            setSettingsTabType('settings');
                            handleScreenNavigation('settings');
                          }}
                          className="w-full py-2 px-3 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>Configurar Alertas de Vagas</span>
                        </button>
                      </div>
                    </div>

                    {/* CIEE Parceria / Estágio & Jovem Aprendiz */}
                    <div 
                      onClick={() => handleScreenNavigation('courses')}
                      className="bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/50 p-5 rounded-2xl flex flex-col gap-3 shadow-xs hover:border-indigo-400 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                          <Award className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-100/60 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">
                          Parceria Oficial
                        </span>
                      </div>
                      <div>
                        <strong className="text-sm font-bold text-slate-900 dark:text-white block group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          Novidades de Estágio no CIEE
                        </strong>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          Vagas de jovem menor aprendiz e estágios para estudantes de Araucária. Inscreva-se!
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 pt-1">
                        <span>Acessar Oportunidades</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    {/* Central de Ajuda & Atendimento */}
                    <div 
                      onClick={() => handleScreenNavigation('messages')}
                      className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl flex flex-col gap-2.5 shadow-xs cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                        <Headphones className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        <span>Central de Atendimento ao Trabalhador</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Dúvidas sobre envio de currículos, processos seletivos ou cursos? Fale com a equipe do Oportuniza.
                      </p>
                      <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline pt-1 inline-flex items-center gap-1">
                        <span>Enviar Mensagem</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>

                  </div>

                </div>

              </div>
            </div>
          )}

          {/* Jobs & Candidaturas Tracker Router screen */}
          {currentScreen === 'jobs' && (
            <JobsSection
              applications={applications}
              onApply={handleApply}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              onBack={() => handleGoBack('home')}
              onNavigateToDetailsJob={(job) => {
                setDetailJob(job);
                setDetailCourse(null);
                handleScreenNavigation('details');
              }}
              initialSearchQuery={jobSearchFilter}
            />
          )}

          {/* Courses Router screen */}
          {currentScreen === 'courses' && (
            <CoursesSection
              user={user}
              onUpdateProgress={(courseId, progress) => {
                // Option to dynamically alert or update
              }}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              onBack={() => handleGoBack('home')}
              onNavigateToDetailsCourse={(course) => {
                setDetailCourse(course);
                setDetailJob(null);
                handleScreenNavigation('details');
              }}
              courses={courses.filter((c: any) => c.active !== false)}
              enrollments={enrollments}
            />
          )}

          {/* Profile edit forms screen */}
          {currentScreen === 'profile' && (
            <ProfileAndSettings
              user={user}
              onSetUser={setUser}
              onNavigate={handleScreenNavigation}
              tabType={settingsTabType === 'cv' ? 'cv' : 'profile'}
              setTabType={setSettingsTabType}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              applications={applications}
              onDeleteAllData={handleDeleteAllData}
              enrollments={enrollments}
              onContinueCourse={handleContinueCourse}
              onUnsubscribeCourse={handleUnsubscribeCourse}
              onNavigateToJob={() => handleScreenNavigation('jobs')}
              onNavigateToCourse={() => handleScreenNavigation('courses')}
              onNavigateToJobs={() => handleScreenNavigation('jobs')}
              onNavigateToCourses={() => handleScreenNavigation('courses')}
              onCancelApplication={handleCancelApplication}
              completedCourses={completedCourses}
            />
          )}

          {/* Settings options screen */}
          {currentScreen === 'settings' && (
            <SettingsScreen
              user={user}
              onSetUser={setUser}
              onNavigate={handleScreenNavigation}
              favorites={favorites}
              applications={applications}
              enrollments={enrollments}
              completedCourses={completedCourses}
              onDeleteAllData={handleDeleteAllData}
              onSignOut={handleSignOut}
            />
          )}

          {/* Central de Atendimento Oportuniza (🎧 Nível 2) */}
          {currentScreen === 'atendimento' && (
            <AtendimentoPanelScreen
              user={user || { name: 'Atendimento Oportuniza', email: 'suporte@oportuniza.araucaria.br', role: 'Atendimento Oportuniza' }}
              onLogout={handleSignOut}
              onNavigateHome={() => handleScreenNavigation('home')}
            />
          )}

          {/* Messages / List */}
          {currentScreen === 'messages' && (
            <MessagesListScreen
              onBack={() => handleGoBack('home')}
              onNavigate={handleScreenNavigation}
            />
          )}

          {/* AI Mentor screen */}
          {currentScreen === 'mentor' && (
            <CareerMapAndMessages
              user={user}
              tabType="mentor"
              onBack={() => handleGoBack('messages')}
            />
          )}
          
          {/* Support screen */}
          {currentScreen === 'support' && (
            <CareerMapAndMessages
              user={user}
              tabType="support"
              onBack={() => handleGoBack('messages')}
            />
          )}

          {/* Help Map coordinates pin screen selector */}
          {currentScreen === 'map' && (
            <CareerMapAndMessages
              user={user}
              tabType="map"
              focusedJob={focusedJob || undefined}
              onViewJob={(job) => {
                setDetailJob(job);
                setDetailCourse(null);
                handleScreenNavigation('details');
              }}
              onBack={() => {
                setFocusedJob(null);
                handleGoBack('home');
              }}
            />
          )}

          {/* Favorites unified screen */}
          {currentScreen === 'favorites' && (
            <FavoritesSection
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              onNavigateToJob={() => {
                handleScreenNavigation('jobs');
              }}
              onNavigateToCourse={() => {
                handleScreenNavigation('courses');
              }}
              onBack={() => handleGoBack('home')}
              applications={applications}
            />
          )}

          {/* Standalone Candidaturas/Applications tracker screen */}
          {currentScreen === 'applications' && (
            <ApplicationsSection
              applications={applications}
              onNavigateToJobs={() => {
                handleScreenNavigation('jobs');
              }}
              onBack={() => handleGoBack('home')}
              onCancelApplication={handleCancelApplication}
            />
          )}

          {/* Cursos Concluídos */}
          {currentScreen === 'completed' && (
            <CompletedCoursesSection
              completedCourses={completedCourses}
              onBack={() => handleGoBack('settings')}
            />
          )}

          {/* Inscrições / Enrollments unified screen */}
          {currentScreen === 'enrollments' && (
            <EnrollmentsSection
              enrollments={enrollments}
              onNavigateToCourses={() => {
                handleScreenNavigation('courses');
              }}
              onBack={() => handleGoBack('home')}
              onContinueCourse={handleContinueCourse}
              onUnsubscribe={handleUnsubscribeCourse}
            />
          )}

          {/* Details Screen */}
          {currentScreen === 'details' && (
            <DetailsScreen
              job={detailJob || undefined}
              course={detailCourse || undefined}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              onNavigateToApply={() => handleScreenNavigation('apply')}
              onViewOnMap={(job) => {
                setFocusedJob(job);
                handleScreenNavigation('map');
              }}
              onBack={() => handleGoBack(detailJob ? 'jobs' : 'courses')}
              onNavigateToCoursePlayer={(course) => {
                setDetailCourse(course);
                handleScreenNavigation('course-player');
              }}
              onEnrollInCourse={handleEnrollInCourse}
              enrollments={enrollments}
            />
          )}

          {/* YouTube Video Player screen */}
          {currentScreen === 'course-player' && detailCourse && (
            <CoursePlayerScreen
              course={detailCourse}
              userName={user?.name || 'Aluno(a) de Honra'}
              userId={user?.id}
              onCompleteCourse={handleCompleteCourse}
              onBack={() => handleGoBack('courses')}
              onToggleLessonCompletion={handleToggleLessonCompletion}
              lessonProgress={(() => {
                const currentFullCourse = courses.find(c => c.id === detailCourse.id);
                const progressObj: Record<string, boolean> = {};
                if (currentFullCourse) {
                  currentFullCourse.lessons.forEach(l => {
                    progressObj[l.title] = l.done || false;
                  });
                }
                return progressObj;
              })()}
            />
          )}

          {/* Apply Screen */}
          {currentScreen === 'apply' && detailJob && (
            <ApplyScreen
              job={detailJob}
              onApplyJob={handleApply}
              onBack={() => handleGoBack('details')}
              navigate={handleScreenNavigation}
            />
          )}

          {currentScreen === 'change-password' && (
            <ChangePasswordScreen
              onBack={() => handleGoBack('settings')}
            />
          )}
        </>
      )}

      {/* BLOCKED ACCOUNT NOTICE MODAL */}
      {blockedNotice && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-[0_25px_60px_rgba(225,29,72,0.3)] relative text-center space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto shadow-inner">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="inline-block px-3 py-1 bg-rose-500/20 text-rose-400 text-[10px] font-black tracking-widest uppercase rounded-full border border-rose-500/30">
                Acesso Bloqueado
              </span>
              <h3 className="text-xl font-black text-white">Conta Suspensa / Bloqueada</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                A conta vinculada ao e-mail <strong className="text-rose-300 font-mono">{blockedNotice.email}</strong> foi bloqueada pelo administrador da plataforma.
              </p>
            </div>

            {/* MOTIVO DO BLOQUEIO DESTACADO */}
            <div className="p-4 bg-rose-950/40 border border-rose-500/30 rounded-2xl text-left space-y-1.5 shadow-sm">
              <div className="flex items-center gap-1.5 text-rose-400 font-bold text-[10px] uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Motivo Informado Pela Administração:</span>
              </div>
              <p className="text-xs font-semibold text-rose-100 bg-rose-500/15 p-2.5 rounded-xl border border-rose-500/20 leading-relaxed break-words">
                "{blockedNotice.reason || 'Violação das diretrizes da comunidade ou termos de uso'}"
              </p>
            </div>

            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-left space-y-2 text-[11px] text-slate-300">
              <p className="flex items-start gap-2 text-slate-300 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 mt-1.5" />
                <span>O login com Google, e-mail/senha e criação de novas contas com este endereço estão suspensos.</span>
              </p>
              <p className="text-slate-400 text-[10px]">
                Caso acredite que se trate de um engano, entre em contato com a administração da Oportuniza para solicitar a reativação.
              </p>
            </div>

            <button
              onClick={() => {
                setBlockedNotice(null);
                setCurrentScreen('landing');
              }}
              className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-black rounded-xl text-xs transition-all cursor-pointer shadow-lg shadow-rose-900/40 active:scale-95 flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Entendido / Voltar ao Início</span>
            </button>
          </div>
        </div>
      )}

      </div>
    </div>
  </div>
);
}

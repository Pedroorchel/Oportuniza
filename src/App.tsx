import { useState, useEffect, useCallback } from 'react';
import { Menu, User as UserIcon, Briefcase, GraduationCap, ChevronRight, Award, LogOut, CheckCircle, Lock, ShieldAlert, Sparkles, Bell } from 'lucide-react';
import { ScreenId, User, Job, Application, Course, Enrollment, UserCourseProgress } from './types';
import { mockJobs, mockCourses, loadJobsFromSupabase, loadCoursesFromSupabase } from './data';
import { supabase } from './lib/supabaseClient';
import { isAccountBlocked, isUserRecordBlocked, fetchAccountBlockReason, extractBlockReasonFromRecord } from './lib/blockedAccounts';
import { toast } from './lib/toast';
import ToastContainer from './components/ToastContainer';

// Import our modular subcomponents
import SidebarComponent from './components/Sidebar';
import DetailsScreen from './components/DetailsScreen';
import LandingScreen from './components/LandingScreen';
import BioScreen from './components/BioScreen';
import UserAuthScreens from './components/UserAuthScreens';
import AuthScreen from './components/AuthScreen';
import AdminPanelScreen from './components/AdminPanelScreen';
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
  const [activePerk, setActivePerk] = useState<string | null>(null);
  const [jobsVersion, setJobsVersion] = useState(0);
  const [blockedNotice, setBlockedNotice] = useState<{ email: string; name?: string; reason?: string } | null>(null);

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
            user.email?.toLowerCase() === 'pedroorchel12@gmail.com' ||
            user.email?.toLowerCase() === 'orchel@gmail.com'
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
  const [settingsTabType, setSettingsTabType] = useState<'profile' | 'settings' | 'favorites' | 'applications' | 'enrollments' | 'completed'>('settings');
  const [focusedJob, setFocusedJob] = useState<Job | null>(null);
  
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
                cleanEmail === 'pedroorchel12@gmail.com'
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
      <div className="device-notch"></div>
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
        />

        {/* Main Core Router */}
        <div className="w-full h-full relative">
          
          {/* Global Notification Toast */}
          <ToastContainer />

          {/* Landing Screen */}
          {currentScreen === 'landing' && (
            <LandingScreen onNavigate={handleScreenNavigation} />
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

          {/* Admin Panel (Complete Workspace) */}
          {user && (user.isAdmin || currentScreen === 'admin') && (
            <ErrorBoundary fallbackTitle="Erro ao carregar o Painel Administrativo">
              <AdminPanelScreen 
                user={user}
                onLogout={handleSignOut}
              />
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
            <div className="w-full h-full overflow-y-auto custom-scroll px-5 py-6 bg-gradient-to-b from-blue-50/70 to-white pb-6 flex flex-col gap-5 animate-fadeIn">
              
              {/* Nav Header */}
              <header className="flex justify-between items-center shrink-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2.5 rounded-full bg-white hover:bg-gray-100 transition-colors shadow-sm text-gray-700 cursor-pointer"
                  aria-label="Abrir menu"
                >
                  <Menu className="w-5 h-5" />
                </button>

                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt="Sua foto de perfil"
                    className={`w-8 h-8 rounded-full object-cover border shadow-sm ${
                      activePerk === 'gold_border_avatar'
                        ? 'border-yellow-400 ring-2 ring-yellow-400'
                        : 'border-[#6C63FF]/20'
                    }`}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    activePerk === 'gold_border_avatar'
                      ? 'bg-yellow-400/20 text-yellow-600 border border-yellow-400 ring-2 ring-yellow-400'
                      : 'bg-[#6C63FF]/10 text-[#6C63FF] border border-[#6C63FF]/20'
                  }`}>
                    {user.name.substring(0, 1).toUpperCase()}
                  </div>
                )}
              </header>

              {/* Welcome banner user info */}
              <div className="flex items-center gap-3">
                {/* Profile icon simulation (No broken images!) */}
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt="Sua foto"
                    className={`w-12 h-12 rounded-2xl object-cover shrink-0 shadow-sm ${
                      activePerk === 'gold_border_avatar'
                        ? 'border-yellow-400 ring-2 ring-yellow-400'
                        : 'border-primary/20'
                    }`}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold font-sans text-2xl shrink-0 ${
                    activePerk === 'gold_border_avatar'
                      ? 'bg-yellow-400/15 text-yellow-600 border border-yellow-400 ring-2 ring-yellow-400'
                      : 'bg-primary/10 text-primary border border-primary/20'
                  }`}>
                    {user.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <span className="text-xs uppercase font-bold tracking-wider text-gray-400 block leading-none">Bem-vindo(a),</span>
                  <h2 className="text-lg font-bold text-gray-900 mt-1 tracking-tight truncate leading-tight">
                    {user.name}
                  </h2>
                </div>
              </div>

              {/* Status Alert Banner for Candidates when Company changes status to Entrevista or Aprovado */}
              {applications.some(app => (app.status || '').toLowerCase().includes('entrevista') || (app.status || '').toLowerCase().includes('aprovad')) && (
                <div className="flex flex-col gap-2.5 mt-1 select-none animate-fadeIn">
                  {applications
                    .filter(app => (app.status || '').toLowerCase().includes('entrevista') || (app.status || '').toLowerCase().includes('aprovad'))
                    .map((app) => {
                      const isApproved = (app.status || '').toLowerCase().includes('aprovad');
                      return (
                        <div
                          key={app.id}
                          onClick={() => handleScreenNavigation('applications')}
                          className={`p-4 rounded-2xl border shadow-sm cursor-pointer transition-all hover:scale-[1.01] flex items-start gap-3.5 relative overflow-hidden ${
                            isApproved
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-400/40 shadow-emerald-500/10'
                              : 'bg-gradient-to-r from-blue-600 to-[#52A8C7] text-white border-blue-400/40 shadow-blue-500/10'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                            <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-white/25 px-2.5 py-0.5 rounded-full">
                                {isApproved ? '🎉 Você foi Aprovado(a)!' : '🎉 Convite para Entrevista!'}
                              </span>
                              <span className="text-[10px] text-white/80 font-mono">Processo Ativo</span>
                            </div>
                            <p className="text-xs font-bold mt-1.5 text-white leading-snug">
                              {isApproved
                                ? `Parabéns! A empresa ${app.company} aprovou sua candidatura para a vaga "${app.jobTitle}"!`
                                : `Parabéns! A empresa ${app.company} selecionou seu currículo para entrevista na vaga "${app.jobTitle}"!`}
                            </p>
                            <p className="text-[11px] text-white/85 mt-1 leading-tight">
                              {isApproved
                                ? 'Aguarde as orientações da empresa para envio de documentos e início.'
                                : 'Fique atento ao WhatsApp e telefone informados. A empresa entrará em contato para agendar o horário.'}
                            </p>
                            <div className="flex items-center gap-1 mt-2.5 text-[11px] font-extrabold text-white underline decoration-white/50 hover:decoration-white">
                              <span>Acompanhar candidatura</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
              
              {/* Quick access Stat Cards Grid (Vagas / Cursos) */}
              <div className="grid grid-cols-2 gap-3 mt-1 select-none">
                <div
                  onClick={() => handleScreenNavigation('jobs')}
                  className="cursor-pointer bg-white rounded-[20px] p-6 flex items-center gap-4 border border-gray-100 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 min-h-[92px]"
                >
                  <div className="p-3 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <span className="text-lg font-bold text-gray-800 block">Vagas</span>
                  </div>
                </div>

                <div
                  onClick={() => handleScreenNavigation('courses')}
                  className="cursor-pointer bg-white rounded-[20px] p-6 flex items-center gap-4 border border-gray-100 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 min-h-[92px]"
                >
                  <div className="p-3 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
                    <GraduationCap className="w-6 h-6 text-teal-600" />
                  </div>
                  <div>
                    <span className="text-lg font-bold text-gray-800 block">Cursos</span>
                  </div>
                </div>
              </div>

              {/* Profile completion percentage card summary or CIEE promotion if 100% */}
              {calculateCompletionPercent() < 100 ? (
                <>
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3 font-sans">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold text-gray-500">Progresso do Perfil</span>
                      <strong className="text-primary font-bold font-mono text-sm">{calculateCompletionPercent()}%</strong>
                    </div>
                    
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full transition-all duration-300" style={{ width: `${calculateCompletionPercent()}%` }} />
                    </div>

                    <p className="text-xs text-gray-500 leading-normal">
                      Complete seu perfil para receber melhores recomendações de vagas e capacitações de TI.
                    </p>

                    <div className="flex gap-2.5 mt-1 border-t border-gray-50 pt-3">
                      <button
                        onClick={() => handleScreenNavigation('settings')}
                        className="flex-1 btn-secondary text-sm py-2 rounded-xl font-bold cursor-pointer"
                      >
                        Ajustar Alertas
                      </button>
                      <button
                        onClick={() => handleScreenNavigation('profile')}
                        className="flex-1 btn-primary text-sm py-2 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        Editar Perfil
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mt-4">
                    <span className="text-[11px] font-bold text-gray-400 font-mono tracking-wider px-1 uppercase">Capacitação em Destaque</span>
                    <div 
                      onClick={() => handleScreenNavigation('courses')}
                      className="bg-indigo-50/30 border border-indigo-100/50 p-4 rounded-2xl flex items-center gap-3 hover:bg-indigo-50/60 transition-colors cursor-pointer group"
                    >
                      <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
                        <Award className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <strong className="text-sm font-bold text-gray-800 block truncate">Novidades de Estágio no CIEE</strong>
                        <p className="text-[11px] text-gray-500 leading-tight mt-0.5">Vagas de jovem menor aprendiz abertas essa semana. Inscreva-se!</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold text-gray-400 font-mono tracking-wider px-1 uppercase">Oportunidades em Destaque</span>
                    <div 
                      onClick={() => handleScreenNavigation('jobs')}
                      className="bg-[#f0f4ff]/50 border border-indigo-100/40 p-4 rounded-2xl flex items-center gap-3 shadow-inner hover:bg-indigo-50/50 transition-colors cursor-pointer"
                    >
                      <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <strong className="text-base font-bold text-gray-800 block truncate">Novas Vagas de TI</strong>
                        <p className="text-xs text-gray-500 leading-tight mt-0.5">Confira as vagas mais recentes adicionadas à plataforma.</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              )}
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
              tabType="profile"
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

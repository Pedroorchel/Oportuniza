import { ScreenId } from '../types';

const SCREEN_TO_PATH: Record<ScreenId, string> = {
  landing: '/',
  bio: '/bio',
  login: '/login',
  register: '/cadastro',
  recover: '/recuperar-senha',
  home: '/inicio',
  jobs: '/vagas',
  courses: '/cursos',
  profile: '/perfil',
  favorites: '/favoritos',
  applications: '/candidaturas',
  enrollments: '/inscricoes',
  completed: '/concluidos',
  messages: '/mensagens',
  mentor: '/mentor',
  support: '/suporte',
  map: '/mapa',
  settings: '/configuracoes',
  details: '/detalhes',
  'course-player': '/aula',
  apply: '/candidatar',
  'change-password': '/alterar-senha',
  privacy: '/privacidade',
  terms: '/termos',
  admin: '/admin',
  atendimento: '/atendimento',
};

const PATH_TO_SCREEN: Record<string, ScreenId> = {
  '/': 'landing',
  '/index.html': 'landing',
  '/bio': 'bio',
  '/sobre': 'bio',
  '/login': 'login',
  '/loginm': 'login',
  '/entrar': 'login',
  '/auth': 'login',
  '/cadastro': 'register',
  '/register': 'register',
  '/criar-conta': 'register',
  '/recuperar-senha': 'recover',
  '/recover': 'recover',
  '/esqueci-senha': 'recover',
  '/inicio': 'home',
  '/home': 'home',
  '/painel': 'home',
  '/empresa': 'home',
  '/vagas': 'jobs',
  '/jobs': 'jobs',
  '/cursos': 'courses',
  '/courses': 'courses',
  '/perfil': 'profile',
  '/profile': 'profile',
  '/curriculo': 'profile',
  '/favoritos': 'favorites',
  '/favorites': 'favorites',
  '/candidaturas': 'applications',
  '/applications': 'applications',
  '/inscricoes': 'enrollments',
  '/enrollments': 'enrollments',
  '/concluidos': 'completed',
  '/completed': 'completed',
  '/mensagens': 'messages',
  '/messages': 'messages',
  '/mentor': 'mentor',
  '/suporte': 'support',
  '/support': 'support',
  '/ajuda': 'support',
  '/mapa': 'map',
  '/map': 'map',
  '/configuracoes': 'settings',
  '/settings': 'settings',
  '/conta': 'settings',
  '/detalhes': 'details',
  '/details': 'details',
  '/aula': 'course-player',
  '/course-player': 'course-player',
  '/candidatar': 'apply',
  '/apply': 'apply',
  '/alterar-senha': 'change-password',
  '/change-password': 'change-password',
  '/privacidade': 'privacy',
  '/privacy': 'privacy',
  '/termos': 'terms',
  '/terms': 'terms',
  '/admin': 'admin',
  '/atendimento': 'atendimento',
};

const LANDING_ANCHOR_HASHES = new Set([
  '#como-funciona',
  '#pilares-secao',
  '#comparativo-secao',
  '#depoimentos-secao',
  '#faq-secao',
]);

export function getRouterBasePrefix(): string {
  const envBase = (import.meta.env?.BASE_URL || '/').trim();
  if (envBase.startsWith('/') && envBase !== '/') {
    return envBase.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname || '/';
    if (window.location.hostname.endsWith('github.io')) {
      const segments = pathname.split('/').filter(Boolean);
      if (segments.length > 0 && segments[0].toLowerCase() === 'oportuniza') {
        return `/${segments[0]}`;
      }
    }
  }

  return '';
}

export function getPathForScreen(screen: ScreenId): string {
  const slug = SCREEN_TO_PATH[screen] || '/';
  const base = getRouterBasePrefix();
  if (!base) return slug;
  return slug === '/' ? `${base}/` : `${base}${slug}`;
}

export function isOAuthCallbackUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  return (
    hash.includes('access_token=') ||
    hash.includes('refresh_token=') ||
    hash.includes('error_description=') ||
    hash.includes('type=recovery') ||
    search.includes('code=') ||
    search.includes('error_description=')
  );
}

function normalizeRouteSegment(rawPath: string): string {
  const base = getRouterBasePrefix();
  let stripped = rawPath || '/';
  if (base && stripped.toLowerCase().startsWith(base.toLowerCase())) {
    stripped = stripped.slice(base.length) || '/';
  }
  const clean = stripped.replace(/\/+$/, '').toLowerCase();
  return clean === '' ? '/' : clean;
}

export function resolveScreenFromLocation(): ScreenId {
  if (typeof window === 'undefined') return 'landing';

  const normalizedPath = normalizeRouteSegment(window.location.pathname);
  if (normalizedPath !== '/' && PATH_TO_SCREEN[normalizedPath]) {
    return PATH_TO_SCREEN[normalizedPath];
  }

  const hash = window.location.hash || '';
  if (hash.startsWith('#/') && !isOAuthCallbackUrl()) {
    const hashRoute = normalizeRouteSegment(hash.slice(1).split('?')[0]);
    if (PATH_TO_SCREEN[hashRoute]) {
      return PATH_TO_SCREEN[hashRoute];
    }
  }

  return PATH_TO_SCREEN[normalizedPath] || 'landing';
}

export function syncUrlForScreen(
  screen: ScreenId,
  options: { replace?: boolean } = {}
): void {
  if (typeof window === 'undefined') return;
  if (isOAuthCallbackUrl()) return;

  const targetPath = getPathForScreen(screen);
  const currentPath = window.location.pathname || '/';
  const currentSearch = window.location.search || '';
  const currentHash = window.location.hash || '';
  const hasTrailingBareHash = window.location.href.endsWith('#') || currentHash === '#';

  const preservedHash =
    screen === 'landing' && LANDING_ANCHOR_HASHES.has(currentHash) ? currentHash : '';
  const nextUrl = `${targetPath}${currentSearch}${preservedHash}`;
  const currentUrl = `${currentPath}${currentSearch}${hasTrailingBareHash ? '#' : currentHash}`;

  if (currentUrl === nextUrl && !hasTrailingBareHash) {
    return;
  }

  try {
    if (options.replace) {
      window.history.replaceState({ screen }, '', nextUrl);
    } else {
      window.history.pushState({ screen }, '', nextUrl);
    }
  } catch (err) {
    console.warn('Could not sync URL path:', err);
  }
}

export function getPublicScreens(): ScreenId[] {
  return ['landing', 'bio', 'privacy', 'terms', 'login', 'register', 'recover'];
}

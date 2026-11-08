// Utility for managing light/dark theme preference across the application
import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'oportuniza_theme';

export function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch (e) {
    console.error('Error reading theme from localStorage:', e);
  }
  // Default is light mode
  return 'light';
}

export function applyTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (e) {
    console.error('Error saving theme to localStorage:', e);
  }

  const root = document.documentElement;
  const body = document.body;

  if (theme === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
    if (body) {
      body.classList.add('dark');
      body.setAttribute('data-theme', 'dark');
      body.style.colorScheme = 'dark';
    }
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
    if (body) {
      body.classList.remove('dark');
      body.setAttribute('data-theme', 'light');
      body.style.colorScheme = 'light';
    }
  }

  // Dispatch custom event so any listener updates state in real-time
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme } }));
}

export function toggleTheme(): Theme {
  const current = getInitialTheme();
  const next: Theme = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

export function useTheme(): [Theme, () => Theme] {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const onThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: Theme }>;
      if (customEvent.detail?.theme) {
        setTheme(customEvent.detail.theme);
      } else {
        setTheme(getInitialTheme());
      }
    };

    window.addEventListener('theme-changed', onThemeChange);
    return () => window.removeEventListener('theme-changed', onThemeChange);
  }, []);

  const handleToggle = () => {
    const nextTheme = toggleTheme();
    setTheme(nextTheme);
    return nextTheme;
  };

  return [theme, handleToggle];
}

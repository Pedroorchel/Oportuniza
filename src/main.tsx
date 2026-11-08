import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { getInitialTheme, applyTheme } from './lib/theme';
import { ErrorBoundary } from './components/ErrorBoundary';

// Initialize theme (defaults to light mode unless explicitly selected)
try {
  applyTheme(getInitialTheme());
} catch (err) {
  console.warn('Theme initialization warning:', err);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="Erro ao iniciar o Oportuniza">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);



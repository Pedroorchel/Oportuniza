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

// Surface unexpected boot errors instead of silent blank screens
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const root = document.getElementById('root');
    if (root && root.childElementCount === 0 && event.error) {
      root.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,system-ui,sans-serif;background:#0b1120;color:#f8fafc;text-align:center;"><div style="max-width:440px;background:#131e32;border:1px solid #1e293b;border-radius:20px;padding:28px;"><h2 style="margin:0 0 8px;font-size:18px;">Erro ao carregar o Oportuniza</h2><p style="margin:0 0 16px;font-size:13px;color:#94a3b8;">Recarregue a página para tentar novamente.</p><button onclick="window.location.reload()" style="background:#4fa2c0;color:#fff;border:none;border-radius:12px;padding:10px 18px;font-weight:700;cursor:pointer;">Recarregar Página</button></div></div>`;
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="Erro ao iniciar o Oportuniza">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);



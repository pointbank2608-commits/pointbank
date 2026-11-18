import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './tailwind.css';
import './i18n';
import App from './App';
import InstallBanner from './components/InstallBanner';
import WebAppIdentity from './components/WebAppIdentity';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import AppErrorBoundary from './components/AppErrorBoundary';
import { installErrorReporter } from './lib/errorReporter';
import { applyFontScale, getFontScale } from './lib/fontScale';

installErrorReporter();
applyFontScale(getFontScale());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <WebAppIdentity />
      <ToastProvider>
        <AuthProvider>
          <InstallBanner />
          <AppErrorBoundary>
            <App />
          </AppErrorBoundary>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);

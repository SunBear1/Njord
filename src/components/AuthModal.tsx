import { useState } from 'react';
import { X, Mail, Lock, User } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, name?: string) => Promise<void>;
  error: string | null;
  onClearError: () => void;
}

type Tab = 'login' | 'register';

export function AuthModal({ isOpen, onClose, onLogin, onRegister, error, onClearError }: AuthModalProps) {
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  function switchTab(t: Tab) {
    setTab(t);
    setEmail('');
    setPassword('');
    setName('');
    onClearError();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (tab === 'login') {
        await onLogin(email, password);
      } else {
        await onRegister(email, password, name || undefined);
      }
      onClose();
    } catch {
      // Error is handled via the error prop
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        role="button"
        tabIndex={-1}
        aria-label="Zamknij"
      />

      {/* Modal */}
      <div className="relative bg-bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <h2 className="text-xl font-bold text-text-primary">
            {tab === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-border hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="Zamknij"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex mx-6 mt-2 mb-4 p-1 bg-bg-hover rounded-lg">
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === 'login'
                ? 'bg-bg-card text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
            onClick={() => switchTab('login')}
          >
            Logowanie
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === 'register'
                ? 'bg-bg-card text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
            onClick={() => switchTab('register')}
          >
            Rejestracja
          </button>
        </div>

        {/* OAuth buttons */}
        <div className="px-6 space-y-2">
          <a
            href="/api/auth/github"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-bg-card text-white rounded-lg hover:bg-bg-card transition-colors font-medium text-sm"
          >
            <GitHubIcon />
            Kontynuuj przez GitHub
          </a>
          <a
            href="/api/auth/google"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-bg-card text-text-secondary rounded-lg border border-border hover:bg-bg-card transition-colors font-medium text-sm"
          >
            <GoogleIcon />
            Kontynuuj przez Google
          </a>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 px-6 my-4">
          <div className="flex-1 h-px bg-bg-hover" />
          <span className="text-xs text-border uppercase tracking-wider">lub</span>
          <div className="flex-1 h-px bg-bg-hover" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-3">
          {tab === 'register' && (
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-border" aria-hidden="true" />
              <input
                type="text"
                placeholder="Imię (opcjonalnie)…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-bg-card text-text-primary text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-transparent"
              />
            </div>
          )}

          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-border" aria-hidden="true" />
            <input
              type="email"
              placeholder="Email…"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              spellCheck={false}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-bg-card text-text-primary text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-transparent"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-border" aria-hidden="true" />
            <input
              type="password"
              placeholder="Hasło…"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-bg-card text-text-primary text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-bg-hover dark:bg-red-900/30 border border-danger/30 text-danger text-danger text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-accent-primary text-white rounded-lg font-medium text-sm hover:bg-accent-primary-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2"
          >
            {isSubmitting
              ? (tab === 'login' ? 'Logowanie…' : 'Tworzenie konta…')
              : (tab === 'login' ? 'Zaloguj się' : 'Utwórz konto')
            }
          </button>
        </form>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}

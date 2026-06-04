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
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
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

        {/* OAuth providers (GitHub/Google) are deferred to Epic 99. */}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-3">
          {tab === 'register' && (
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
              <input
                type="text"
                placeholder="Imię (opcjonalnie)…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-bg-card text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-transparent"
              />
            </div>
          )}

          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              type="email"
              placeholder="Email…"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              spellCheck={false}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-bg-card text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-transparent"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              type="password"
              placeholder="Hasło…"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-bg-card text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-danger/5 border border-danger/30 text-danger text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-accent-interactive text-text-on-accent rounded-lg font-medium text-sm hover:bg-accent-interactive/80 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2"
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

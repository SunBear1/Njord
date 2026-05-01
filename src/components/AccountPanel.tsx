import { useState } from 'react';
import { X, Lock, Trash2, AlertTriangle, Check, KeyRound, Link2, Unlink } from 'lucide-react';
import type { User } from '../types/auth';
import { getInitials } from '../utils/userDisplayHelpers';

interface AccountPanelProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onChangePassword: (currentPassword: string | null, newPassword: string) => Promise<void>;
  onDeleteAccount: (password: string | null) => Promise<void>;
  hasPassword: boolean;
  error: string | null;
  onClearError: () => void;
}

export function AccountPanel({
  user,
  isOpen,
  onClose,
  onChangePassword,
  onDeleteAccount,
  hasPassword,
  error,
  onClearError,
}: AccountPanelProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  function resetPasswordForm() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordSuccess(false);
    onClearError();
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    onClearError();
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      return;
    }

    setIsChangingPassword(true);
    try {
      await onChangePassword(hasPassword ? currentPassword : null, newPassword);
      setPasswordSuccess(true);
      resetPasswordForm();
      setPasswordSuccess(true);
    } catch {
      // Error handled via error prop
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    setIsDeleting(true);
    try {
      await onDeleteAccount(hasPassword ? deletePassword : null);
      onClose();
    } catch {
      // Error handled via error prop
    } finally {
      setIsDeleting(false);
    }
  }

  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const isGithubLinked = user.linkedProviders.includes('github');
  const isGoogleLinked = user.linkedProviders.includes('google');

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

      {/* Panel */}
      <div className="relative bg-bg-card rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-border max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-xl font-bold text-text-primary">Ustawienia konta</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-border hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="Zamknij"
          >
            <X size={20} />
          </button>
        </div>

        {/* User info */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-accent-primary flex items-center justify-center text-lg font-bold text-white shrink-0">
              {getInitials(user.name, user.email)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary break-words">
                {user.name ?? 'Użytkownik'}
              </p>
              <p className="text-sm text-text-muted break-all">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error ? (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-bg-hover dark:bg-red-900/30 border border-danger/30 text-danger text-danger text-sm">
            {error}
          </div>
        ) : null}

        {/* Success */}
        {passwordSuccess ? (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-bg-hover bg-success/10 border border-success/30 border-success/30 text-success text-sm flex items-center gap-2">
            <Check size={16} aria-hidden="true" />
            Hasło zostało zmienione.
          </div>
        ) : null}

        {/* Linked accounts */}
        <div className="px-6 py-5 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
            <Link2 size={16} aria-hidden="true" />
            Połączone konta
          </h3>
          <div className="space-y-2">
            <LinkedAccountRow
              provider="github"
              label="GitHub"
              isLinked={isGithubLinked}
              icon={<GitHubIcon />}
            />
            <LinkedAccountRow
              provider="google"
              label="Google"
              isLinked={isGoogleLinked}
              icon={<GoogleIcon />}
            />
          </div>
        </div>

        {/* Change password */}
        <form onSubmit={handleChangePassword} className="px-6 py-5 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
            <KeyRound size={16} aria-hidden="true" />
            {hasPassword ? 'Zmień hasło' : 'Ustaw hasło'}
          </h3>

          {hasPassword ? (
            <div className="relative mb-3">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-border" aria-hidden="true" />
              <input
                type="password"
                placeholder="Aktualne hasło…"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-bg-card text-text-primary text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-transparent"
              />
            </div>
          ) : null}

          <div className="relative mb-3">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-border" aria-hidden="true" />
            <input
              type="password"
              placeholder="Nowe hasło…"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-bg-card text-text-primary text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-transparent"
            />
          </div>

          <div className="relative mb-3">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-border" aria-hidden="true" />
            <input
              type="password"
              placeholder="Powtórz nowe hasło…"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border bg-bg-card text-text-primary text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent ${
                passwordMismatch
                  ? 'border-red-400 focus:ring-danger/50'
                  : 'border-border focus:ring-accent-primary'
              }`}
            />
          </div>

          {passwordMismatch ? (
            <p className="text-xs text-danger mb-3">Hasła nie są identyczne.</p>
          ) : null}

          <button
            type="submit"
            disabled={isChangingPassword || passwordMismatch || !newPassword}
            className="w-full py-2.5 px-4 bg-accent-primary text-white rounded-lg font-medium text-sm hover:bg-accent-primary-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2"
          >
            {isChangingPassword ? 'Zapisywanie…' : (hasPassword ? 'Zmień hasło' : 'Ustaw hasło')}
          </button>
        </form>

        {/* Delete account */}
        <div className="px-6 py-5">
          <h3 className="text-sm font-semibold text-danger flex items-center gap-2 mb-2">
            <Trash2 size={16} aria-hidden="true" />
            Usuń konto
          </h3>
          <p className="text-xs text-text-muted mb-3">
            Ta operacja jest nieodwracalna. Wszystkie Twoje dane zostaną trwale usunięte.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => { setShowDeleteConfirm(true); onClearError(); }}
              className="w-full py-2.5 px-4 bg-bg-hover bg-danger/5 text-danger rounded-lg font-medium text-sm border border-danger/30 hover:bg-danger/10 dark:hover:bg-red-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
            >
              Usuń konto
            </button>
          ) : (
            <div className="p-4 rounded-lg bg-bg-hover bg-danger/5 border border-danger/30 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="text-danger mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-sm text-danger text-danger">
                  Czy na pewno chcesz usunąć konto? Tej operacji nie można cofnąć.
                </p>
              </div>

              {hasPassword ? (
                <input
                  type="password"
                  placeholder="Potwierdź hasłem…"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full px-3 py-2 rounded-lg border border-danger/30 border-danger/30 bg-bg-card text-text-primary text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-danger/50 focus:border-transparent"
                />
              ) : null}

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); onClearError(); }}
                  className="flex-1 py-2 px-3 text-sm font-medium text-text-secondary bg-bg-card rounded-lg border border-border hover:bg-bg-card transition-colors"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || (hasPassword && !deletePassword)}
                  className="flex-1 py-2 px-3 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isDeleting ? 'Usuwanie…' : 'Usuń na stałe'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LinkedAccountRow({ provider, label, isLinked, icon }: {
  provider: string;
  label: string;
  isLinked: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-bg-card/50">
      <div className="flex items-center gap-2.5">
        <span className="shrink-0">{icon}</span>
        <span className="text-sm font-medium text-text-primary">{label}</span>
      </div>
      {isLinked ? (
        <span className="flex items-center gap-1 text-xs font-medium text-success text-success">
          <Check size={14} aria-hidden="true" />
          Połączono
        </span>
      ) : (
        <a
          href={`/api/auth/${provider}?action=link`}
          className="flex items-center gap-1 text-xs font-medium text-accent-primary hover:text-accent-primary-hover transition-colors"
        >
          <Unlink size={14} aria-hidden="true" />
          Połącz
        </a>
      )}
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

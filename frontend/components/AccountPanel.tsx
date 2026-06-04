import { useState } from 'react';
import { X, Lock, Trash2, AlertTriangle, Check, KeyRound } from 'lucide-react';
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
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="Zamknij"
          >
            <X size={20} />
          </button>
        </div>

        {/* User info */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-accent-interactive flex items-center justify-center text-lg font-bold text-text-on-accent shrink-0">
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
          <div className="mx-6 mt-4 p-3 rounded-lg bg-danger/5 border border-danger/30 text-danger text-sm">
            {error}
          </div>
        ) : null}

        {/* Success */}
        {passwordSuccess ? (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-success/10 border border-success/30 text-success text-sm flex items-center gap-2">
            <Check size={16} aria-hidden="true" />
            Hasło zostało zmienione.
          </div>
        ) : null}

        {/* Linked accounts (OAuth) — deferred to Epic 99 */}

        {/* Change password */}
        <form onSubmit={handleChangePassword} className="px-6 py-5 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
            <KeyRound size={16} aria-hidden="true" />
            {hasPassword ? 'Zmień hasło' : 'Ustaw hasło'}
          </h3>

          {hasPassword ? (
            <div className="relative mb-3">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
              <input
                type="password"
                placeholder="Aktualne hasło…"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-bg-card text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-transparent"
              />
            </div>
          ) : null}

          <div className="relative mb-3">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              type="password"
              placeholder="Nowe hasło…"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-bg-card text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-transparent"
            />
          </div>

          <div className="relative mb-3">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              type="password"
              placeholder="Powtórz nowe hasło…"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border bg-bg-card text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:border-transparent ${
                passwordMismatch
                  ? 'border-danger focus:ring-danger/50'
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
            className="w-full py-2.5 px-4 bg-accent-interactive text-text-on-accent rounded-lg font-medium text-sm hover:bg-accent-interactive/80 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2"
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
              className="w-full py-2.5 px-4 bg-danger/5 text-danger rounded-lg font-medium text-sm border border-danger/30 hover:bg-danger/10 hover:bg-danger/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2"
            >
              Usuń konto
            </button>
          ) : (
            <div className="p-4 rounded-lg bg-danger/5 border border-danger/30 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="text-danger mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-sm text-danger">
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
                  className="w-full px-3 py-2 rounded-lg border border-danger/30 bg-bg-card text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-danger/50 focus:border-transparent"
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
                  className="flex-1 py-2 px-3 text-sm font-medium text-white dark:text-bg-primary bg-danger rounded-lg hover:bg-danger/80 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
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

import { useState } from 'react';
import { X, Lock, Trash2, AlertTriangle, Check, KeyRound } from 'lucide-react';
import type { User } from '../types/auth';

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
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Ustawienia konta</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Zamknij"
          >
            <X size={20} />
          </button>
        </div>

        {/* User info */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" width={48} height={48} className="rounded-full" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-lg font-bold text-white">
                {getInitials(user.name, user.email)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {user.name ?? 'Użytkownik'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Success */}
        {passwordSuccess && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm flex items-center gap-2">
            <Check size={16} aria-hidden="true" />
            Hasło zostało zmienione.
          </div>
        )}

        {/* Change password */}
        <form onSubmit={handleChangePassword} className="px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <KeyRound size={16} aria-hidden="true" />
            {hasPassword ? 'Zmień hasło' : 'Ustaw hasło'}
          </h3>

          {hasPassword && (
            <div className="relative mb-3">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                type="password"
                placeholder="Aktualne hasło…"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          <div className="relative mb-3">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="password"
              placeholder="Nowe hasło…"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="relative mb-3">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="password"
              placeholder="Powtórz nowe hasło…"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent ${
                passwordMismatch
                  ? 'border-red-400 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
              }`}
            />
          </div>

          {passwordMismatch && (
            <p className="text-xs text-red-500 mb-3">Hasła nie są identyczne.</p>
          )}

          <button
            type="submit"
            disabled={isChangingPassword || passwordMismatch || !newPassword}
            className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          >
            {isChangingPassword ? 'Zapisywanie…' : (hasPassword ? 'Zmień hasło' : 'Ustaw hasło')}
          </button>
        </form>

        {/* Delete account */}
        <div className="px-6 py-5">
          <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2 mb-2">
            <Trash2 size={16} aria-hidden="true" />
            Usuń konto
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Ta operacja jest nieodwracalna. Wszystkie Twoje dane zostaną trwale usunięte.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => { setShowDeleteConfirm(true); onClearError(); }}
              className="w-full py-2.5 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg font-medium text-sm border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
            >
              Usuń konto
            </button>
          ) : (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-sm text-red-700 dark:text-red-300">
                  Czy na pewno chcesz usunąć konto? Tej operacji nie można cofnąć.
                </p>
              </div>

              {hasPassword && (
                <input
                  type="password"
                  placeholder="Potwierdź hasłem…"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full px-3 py-2 rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); onClearError(); }}
                  className="flex-1 py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
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

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name[0].toUpperCase();
  }
  return email[0].toUpperCase();
}

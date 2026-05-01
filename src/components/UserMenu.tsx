import { useState, useRef, useEffect } from 'react';
import { User as UserIcon, LogOut, ChevronDown, Settings } from 'lucide-react';
import type { User } from '../types/auth';
import { getInitials } from '../utils/userDisplayHelpers';

interface UserMenuProps {
  user: User | null;
  isLoading: boolean;
  onLoginClick: () => void;
  onLogout: () => void;
  onAccountSettings: () => void;
}

export function UserMenu({ user, isLoading, onLoginClick, onLogout, onAccountSettings }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-bg-hover animate-pulse" />
    );
  }

  if (!user) {
    return (
      <button
        onClick={onLoginClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        <UserIcon size={16} aria-hidden="true" />
        Zaloguj się
      </button>
    );
  }

  const displayName = user.name ?? user.email.split('@')[0];
  const initials = getInitials(user.name, user.email);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="w-7 h-7 rounded-full bg-accent-interactive flex items-center justify-center text-xs font-bold text-text-on-accent shrink-0">
          {initials}
        </div>
        <span className="hidden sm:inline max-w-[200px] truncate">
          {displayName}
        </span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="absolute right-0 mt-2 w-72 bg-bg-card rounded-xl shadow-lg border border-border py-2 z-50">
          {/* User info */}
          <div className="px-4 py-2 border-b border-border">
            <p className="text-sm font-medium text-text-primary break-words">
              {user.name ?? 'Użytkownik'}
            </p>
            <p className="text-xs text-text-muted break-all">{user.email}</p>
          </div>

          {/* Actions */}
          <button
            onClick={() => {
              setIsOpen(false);
              onAccountSettings();
            }}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-card transition-colors"
          >
            <Settings size={16} aria-hidden="true" />
            Ustawienia konta
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-card transition-colors"
          >
            <LogOut size={16} aria-hidden="true" />
            Wyloguj się
          </button>
        </div>
      ) : null}
    </div>
  );
}

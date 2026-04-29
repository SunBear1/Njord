import { useState, Suspense, lazy, useEffect } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { Moon, Sun, BarChart3, Receipt, Sprout, TrendingUp } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import { useAuth } from '../hooks/useAuth';
import { UserMenu } from '../components/UserMenu';
import { PrivacyPolicy } from '../components/PrivacyPolicy';
import { saveLastRoute } from '../utils/routePersistence';

const AuthModalLazy = lazy(() => import('../components/AuthModal').then(m => ({ default: m.AuthModal })));
const AccountPanelLazy = lazy(() => import('../components/AccountPanel').then(m => ({ default: m.AccountPanel })));

const NAV_ITEMS = [
  { to: '/comparison', icon: BarChart3, label: 'Porównanie inwestycji' },
  { to: '/forecast', icon: TrendingUp, label: 'Prognoza cenowa' },
  { to: '/tax', icon: Receipt, label: 'Podatek Belki' },
  { to: '/portfolio', icon: Sprout, label: 'Kreator portfela' },
] as const;

const ROOT_STYLE = { backgroundColor: 'var(--color-bg-primary)' } as const;
const FOOTER_STYLE = { borderTop: '1px solid var(--color-border)', color: 'var(--color-text-faint)' } as const;

export function Layout() {
  const [isDark, toggleDarkMode] = useDarkMode();
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAccountPanel, setShowAccountPanel] = useState(false);

  const { user, isLoading: authLoading, login, register, logout, changePassword, deleteAccount, error: authError, clearError: clearAuthError } = useAuth();

  const location = useLocation();

  // Persist current route on navigation
  useEffect(() => {
    saveLastRoute(location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen" style={ROOT_STYLE}>
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3 min-w-0 flex-1" aria-label="Strona główna">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="36" height="36" className="shrink-0" aria-hidden="true">
              <rect x="30.5" y="10" width="2.5" height="22" rx="1" fill="#e2e8f0"/>
              <path d="M33 11 L46 20 L33 30 Z" fill="#3b82f6"/>
              <path d="M33 11 L39.5 15.5 L39.5 25.5 L33 30 Z" fill="#60a5fa"/>
              <path d="M10 34 Q18 30 33 30 Q48 30 52 34 Q48 43 33 45 Q18 43 10 34 Z" fill="#1d4ed8"/>
              <path d="M10 34 Q18 32 33 32 Q48 32 52 34" fill="none" stroke="#60a5fa" strokeWidth="1.2"/>
              <path d="M52 34 L60 28 L58 33 L62 31 L58 37 L54 38 Z" fill="#3b82f6"/>
              <circle cx="60" cy="28" r="1.2" fill="#fbbf24"/>
              <path d="M10 34 C8 32 6 34 8 37 C9 39 11 38 10 36" fill="#3b82f6"/>
              <line x1="18" y1="39" x2="16" y2="48" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="26" y1="41" x2="24" y2="50" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="38" y1="41" x2="40" y2="50" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="46" y1="39" x2="48" y2="48" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M8 52 Q18 49 28 52 Q38 55 48 52 Q54 50 58 52" stroke="#60a5fa" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7"/>
            </svg>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">Njord</h1>
              <p className="text-sm text-slate-400 truncate">Akcje · Obligacje · Konto oszczędnościowe · Podatek Belki</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={isDark ? 'Włącz tryb jasny' : 'Włącz tryb ciemny'}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <UserMenu
            user={user}
            isLoading={authLoading}
            onLoginClick={() => setShowAuthModal(true)}
            onLogout={logout}
            onAccountSettings={() => setShowAccountPanel(true)}
          />
        </div>
      </header>

      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 py-1.5 overflow-x-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200 dark:border-blue-800'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`
              }
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-4">
        <Outlet />
      </main>

      <footer className="mt-10 py-5 text-center text-xs" style={FOOTER_STYLE}>
        <p>Dane informacyjne — nie stanowią doradztwa inwestycyjnego ani podatkowego.</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <button
            onClick={() => setShowPrivacy(true)}
            className="underline hover:no-underline focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
          >
            Polityka prywatności
          </button>
          {!showClearConfirm ? (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="underline hover:no-underline focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
            >
              Wyczyść wszystkie dane
            </button>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span>Na pewno? Wszystkie dane zostaną usunięte.</span>
              <button
                onClick={() => {
                  try { localStorage.clear(); } catch { /* ignore */ }
                  window.location.reload();
                }}
                className="font-semibold text-red-600 dark:text-red-400 underline"
              >
                Tak, usuń
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="underline"
              >
                Anuluj
              </button>
            </span>
          )}
        </div>
      </footer>

      {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)} />}
      {showAuthModal && (
        <Suspense fallback={null}>
          <AuthModalLazy
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onLogin={login}
            onRegister={register}
            error={authError}
            onClearError={clearAuthError}
          />
        </Suspense>
      )}
      {showAccountPanel && user && (
        <Suspense fallback={null}>
          <AccountPanelLazy
            user={user}
            isOpen={showAccountPanel}
            onClose={() => { setShowAccountPanel(false); clearAuthError(); }}
            onChangePassword={changePassword}
            onDeleteAccount={deleteAccount}
            hasPassword={user.hasPassword}
            error={authError}
            onClearError={clearAuthError}
          />
        </Suspense>
      )}
    </div>
  );
}

export default Layout;

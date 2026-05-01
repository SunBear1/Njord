import { useState, Suspense, lazy, useEffect } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { Moon, Sun, BarChart3, Receipt, Sprout, TrendingUp, ArrowDownUp, Menu, X, Anchor } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import { useAuth } from '../hooks/useAuth';
import { UserMenu } from '../components/UserMenu';
import { saveLastRoute } from '../utils/routePersistence';

const AuthModalLazy = lazy(() => import('../components/AuthModal').then(m => ({ default: m.AuthModal })));
const AccountPanelLazy = lazy(() => import('../components/AccountPanel').then(m => ({ default: m.AccountPanel })));
const PrivacyPolicyLazy = lazy(() => import('../components/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));

const NAV_ITEMS = [
  { to: '/forecast', icon: TrendingUp, label: 'Prognoza' },
  { to: '/comparison', icon: BarChart3, label: 'Porównanie' },
  { to: '/tax', icon: Receipt, label: 'Podatek' },
  { to: '/portfolio', icon: Sprout, label: 'Portfel' },
  { to: '/rates', icon: ArrowDownUp, label: 'Kursy' },
] as const;

export function Layout() {
  const [isDark, toggleDarkMode] = useDarkMode();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAccountPanel, setShowAccountPanel] = useState(false);

  const { user, isLoading: authLoading, login, register, logout, changePassword, deleteAccount, error: authError, clearError: clearAuthError } = useAuth();

  const location = useLocation();

  useEffect(() => {
    saveLastRoute(location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Aurora Header */}
      <header className="aurora-header text-white shadow-lg">
        <div className="aurora-beams" aria-hidden="true">
          <div className="aurora-beam" />
          <div className="aurora-beam" />
          <div className="aurora-beam" />
          <div className="aurora-beam" />
          <div className="aurora-beam" />
        </div>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/forecast" className="flex items-center gap-2" aria-label="Njord — Strona główna">
            <Anchor size={24} className="text-white/90" aria-hidden="true" />
            <span className="text-2xl font-bold tracking-tight">Njord</span>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Nawigacja główna">
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label={isDark ? 'Włącz tryb jasny' : 'Włącz tryb ciemny'}
              className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
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
            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Zamknij menu' : 'Otwórz menu'}
              className="md:hidden p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile navigation drawer */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-white/20 px-4 py-3" aria-label="Nawigacja mobilna">
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>

      <footer className="mt-10 py-6 text-center text-sm border-t border-border text-text-muted">
        <p>Dane informacyjne — nie stanowią doradztwa inwestycyjnego ani podatkowego.</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <button
            onClick={() => setShowPrivacy(true)}
            className="underline hover:no-underline focus-visible:ring-2 focus-visible:ring-accent-primary rounded"
          >
            Polityka prywatności
          </button>
          {!showClearConfirm ? (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="underline hover:no-underline focus-visible:ring-2 focus-visible:ring-accent-primary rounded"
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
                className="font-semibold text-danger underline"
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

      {showPrivacy && (
        <Suspense fallback={null}>
          <PrivacyPolicyLazy onClose={() => setShowPrivacy(false)} />
        </Suspense>
      )}
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

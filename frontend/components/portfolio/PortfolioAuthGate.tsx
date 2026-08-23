import { Suspense, lazy, useState, type ReactNode } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Skeleton } from '../Skeleton';

const AuthModalLazy = lazy(() => import('../AuthModal').then((m) => ({ default: m.AuthModal })));

interface PortfolioAuthGateProps {
  children: ReactNode;
}

export function PortfolioAuthGate({ children }: PortfolioAuthGateProps) {
  const { isAuthenticated, isLoading, login, register, error, clearError } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center gap-4 bg-bg-card rounded-xl border border-bg-muted p-10 text-center">
        <LogIn size={32} className="text-neutral" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-bold text-text-primary">Zaloguj się, aby zobaczyć swój portfel</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Twoje pozycje, obligacje i konta oszczędnościowe są przypisane do konta.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAuthModal(true)}
          className="px-4 py-2 text-sm font-medium bg-neutral text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          Zaloguj się
        </button>
        {showAuthModal && (
          <Suspense fallback={null}>
            <AuthModalLazy
              isOpen={showAuthModal}
              onClose={() => setShowAuthModal(false)}
              onLogin={login}
              onRegister={register}
              error={error}
              onClearError={clearError}
            />
          </Suspense>
        )}
      </div>
    );
  }

  return children;
}

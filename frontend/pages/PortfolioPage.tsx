import { Suspense, lazy } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton } from '../components/Skeleton';
import { useBondPresets } from '../hooks/useBondPresets';
import { useDarkMode } from '../hooks/useDarkMode';

const PortfolioWizardLazy = lazy(() =>
  import('../components/portfolio/PortfolioWizard').then(m => ({ default: m.PortfolioWizard })),
);

export function PortfolioPage() {
  const { presets: bondPresets } = useBondPresets();
  const [isDark] = useDarkMode();

  return (
    <ErrorBoundary>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <PortfolioWizardLazy bondPresets={bondPresets} isDark={isDark} />
      </Suspense>
    </ErrorBoundary>
  );
}

export default PortfolioPage;

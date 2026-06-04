import { Suspense, lazy, useState } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton } from '../components/Skeleton';
import { useBondPresets } from '../hooks/useBondPresets';
import { useDarkMode } from '../hooks/useDarkMode';
import { usePositions } from '../hooks/usePositions';
import { PositionList } from '../components/portfolio/PositionList';
import { PositionForm } from '../components/portfolio/PositionForm';
import { MergePrompt } from '../components/portfolio/MergePrompt';

const PortfolioWizardLazy = lazy(() =>
  import('../components/portfolio/PortfolioWizard').then(m => ({ default: m.PortfolioWizard })),
);

export function PortfolioPage() {
  const { presets: bondPresets } = useBondPresets();
  const [isDark] = useDarkMode();
  const { positions, addPosition, confirmMerge, removePosition, pendingMerge, cancelMerge } = usePositions();
  const [showForm, setShowForm] = useState(false);

  return (
    <ErrorBoundary>
      <div className="space-y-8">
        {/* ── Positions section ── */}
        <section aria-labelledby="positions-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="positions-heading" className="text-xl font-bold text-text-primary">
              Mój portfel
            </h2>
            {!showForm && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="px-3 py-1.5 text-sm font-medium bg-neutral text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                + Dodaj pozycję
              </button>
            )}
          </div>

          {showForm && (
            <div className="bg-bg-card rounded-xl p-4 mb-4 border border-bg-muted">
              <h3 className="text-sm font-semibold text-text-secondary mb-3">Nowa pozycja</h3>
              <PositionForm
                onSubmit={(draft) => {
                  const result = addPosition(draft);
                  if (result === 'added') setShowForm(false);
                }}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}

          <PositionList positions={positions} onRemove={removePosition} />
        </section>

        {/* ── Investment planning wizard ── */}
        <Suspense fallback={<Skeleton className="h-96" />}>
          <PortfolioWizardLazy bondPresets={bondPresets} isDark={isDark} />
        </Suspense>
      </div>

      {pendingMerge && (
        <MergePrompt
          draft={pendingMerge}
          onConfirm={(draft) => {
            confirmMerge(draft);
            setShowForm(false);
          }}
          onCancel={cancelMerge}
        />
      )}
    </ErrorBoundary>
  );
}

export default PortfolioPage;

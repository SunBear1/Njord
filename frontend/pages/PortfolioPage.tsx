import { Suspense, lazy, useState, useMemo } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton } from '../components/Skeleton';
import { useBondPresets } from '../hooks/useBondPresets';
import { useDarkMode } from '../hooks/useDarkMode';
import { usePositions } from '../hooks/usePositions';
import { PositionList } from '../components/portfolio/PositionList';
import { PositionForm } from '../components/portfolio/PositionForm';
import { MergePrompt } from '../components/portfolio/MergePrompt';
import { DeleteConfirmDialog } from '../components/portfolio/DeleteConfirmDialog';
import { PortfolioReadinessPanel } from '../components/portfolio/PortfolioReadinessPanel';
import { calcPortfolioQuality } from '../utils/portfolioQuality';
import { calcConsolidatedPositions } from '../utils/portfolioConsolidation';
import { ConsolidatedPositionView } from '../components/portfolio/ConsolidatedPositionView';
import type { PositionDraft } from '../types/position';

const PortfolioWizardLazy = lazy(() =>
  import('../components/portfolio/PortfolioWizard').then(m => ({ default: m.PortfolioWizard })),
);

export function PortfolioPage() {
  const { presets: bondPresets } = useBondPresets();
  const [isDark] = useDarkMode();
  const { positions, addPosition, confirmMerge, updatePosition, removePosition, pendingMerge, cancelMerge } = usePositions();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const quality = useMemo(() => calcPortfolioQuality(positions), [positions]);
  const consolidated = useMemo(() => calcConsolidatedPositions(positions), [positions]);

  const editingPosition = editingId ? positions.find((p) => p.id === editingId) ?? null : null;
  const editDraft: PositionDraft | undefined = editingPosition
    ? {
        ticker: editingPosition.ticker,
        quantity: String(editingPosition.quantity),
        avgPrice: String(editingPosition.avgPrice),
        currency: editingPosition.currency,
        source: editingPosition.source,
      }
    : undefined;

  const pendingDeletePosition = pendingDeleteId
    ? positions.find((p) => p.id === pendingDeleteId) ?? null
    : null;

  function handleEdit(id: string) {
    setShowAddForm(false);
    setEditingId(id);
  }

  function handleCancelEdit() {
    setEditingId(null);
  }

  return (
    <ErrorBoundary>
      <div className="space-y-8">
        {/* ── Positions section ── */}
        <section aria-labelledby="positions-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="positions-heading" className="text-xl font-bold text-text-primary">
              Mój portfel
            </h2>
            {!showAddForm && !editingId && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="px-3 py-1.5 text-sm font-medium bg-neutral text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                + Dodaj pozycję
              </button>
            )}
          </div>

          {showAddForm && (
            <div className="bg-bg-card rounded-xl p-4 mb-4 border border-bg-muted">
              <h3 className="text-sm font-semibold text-text-secondary mb-3">Nowa pozycja</h3>
              <PositionForm
                onSubmit={(draft) => {
                  const result = addPosition(draft);
                  if (result === 'added') setShowAddForm(false);
                }}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          )}

          {editingId && editDraft && (
            <div className="bg-bg-card rounded-xl p-4 mb-4 border border-neutral/30">
              <h3 className="text-sm font-semibold text-text-secondary mb-3">
                Edytuj pozycję {editingPosition?.ticker}
              </h3>
              <PositionForm
                initialDraft={editDraft}
                submitLabel="Zapisz zmiany"
                onSubmit={(draft) => {
                  updatePosition(editingId, draft);
                  setEditingId(null);
                }}
                onCancel={handleCancelEdit}
              />
            </div>
          )}

          <PositionList
            positions={positions}
            quality={quality}
            editingId={editingId}
            onEdit={handleEdit}
            onDeleteRequest={(id) => setPendingDeleteId(id)}
          />

          <ConsolidatedPositionView
            consolidated={consolidated}
            onResolve={(ticker) => {
              // Scroll to / highlight the conflicting positions
              const first = positions.find((p) => p.ticker === ticker);
              if (first) handleEdit(first.id);
            }}
          />

          <PortfolioReadinessPanel quality={quality} />
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
            setShowAddForm(false);
          }}
          onCancel={cancelMerge}
        />
      )}

      {pendingDeletePosition && (
        <DeleteConfirmDialog
          position={pendingDeletePosition}
          onConfirm={() => {
            removePosition(pendingDeletePosition.id);
            setPendingDeleteId(null);
          }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </ErrorBoundary>
  );
}

export default PortfolioPage;

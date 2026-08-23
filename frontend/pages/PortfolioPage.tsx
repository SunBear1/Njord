import { useMemo, useState } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useBondPresets } from '../hooks/useBondPresets';
import { useHoldings } from '../hooks/useHoldings';
import { useStockPositions } from '../hooks/useStockPositions';
import { useLegacyPositions } from '../hooks/useLegacyPositions';
import { usePortfolioValuation } from '../hooks/usePortfolioValuation';
import { PortfolioAuthGate } from '../components/portfolio/PortfolioAuthGate';
import { PortfolioSection } from '../components/portfolio/PortfolioSection';
import { PortfolioSummary } from '../components/portfolio/PortfolioSummary';
import PortfolioAllocationChart from '../components/portfolio/PortfolioAllocationChart';
import { PositionsImportPrompt } from '../components/portfolio/PositionsImportPrompt';
import { PositionList } from '../components/portfolio/PositionList';
import { PositionForm } from '../components/portfolio/PositionForm';
import { MergePrompt } from '../components/portfolio/MergePrompt';
import { DeleteConfirmDialog } from '../components/portfolio/DeleteConfirmDialog';
import { PortfolioReadinessPanel } from '../components/portfolio/PortfolioReadinessPanel';
import { HoldingForm } from '../components/portfolio/HoldingForm';
import { HoldingList } from '../components/portfolio/HoldingList';
import { calcPortfolioQuality } from '../utils/portfolioQuality';
import { calcConsolidatedPositions } from '../utils/portfolioConsolidation';
import { ConsolidatedPositionView } from '../components/portfolio/ConsolidatedPositionView';
import type { BondHolding, SavingsHolding } from '../types/holding';
import type { PositionDraft } from '../types/position';

export function PortfolioPage() {
  const { presets: bondPresets } = useBondPresets();
  const { holdings, addHolding, updateHolding, removeHolding, error: holdingsError } = useHoldings();
  const stockApi = useMemo(() => ({ addHolding, updateHolding, removeHolding }), [addHolding, updateHolding, removeHolding]);
  const { positions, addPosition, confirmMerge, updatePosition, removePosition, pendingMerge, cancelMerge } = useStockPositions(holdings, stockApi);
  const { legacyPositions, clearLegacyPositions } = useLegacyPositions();
  const valuation = usePortfolioValuation(holdings, bondPresets);

  const [showAddHoldingForm, setShowAddHoldingForm] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const quality = useMemo(() => calcPortfolioQuality(positions), [positions]);
  const consolidated = useMemo(() => calcConsolidatedPositions(positions), [positions]);
  const bondSavingsHoldings = useMemo(
    () => holdings.filter((h): h is BondHolding | SavingsHolding => h.assetClass !== 'stock'),
    [holdings],
  );

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
      <PortfolioAuthGate>
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PortfolioSummary
              stockValuePLN={valuation.stockValuePLN}
              bondValuePLN={valuation.bondValuePLN}
              savingsValuePLN={valuation.savingsValuePLN}
              totalPLN={valuation.totalPLN}
              isConverting={valuation.isConverting}
              conversionError={valuation.conversionError}
            />
            <PortfolioAllocationChart
              stockValuePLN={valuation.stockValuePLN}
              bondValuePLN={valuation.bondValuePLN}
              savingsValuePLN={valuation.savingsValuePLN}
            />
          </div>

          <PortfolioSection
            title="Mój portfel"
            headingId="positions-heading"
            addLabel="+ Dodaj pozycję"
            showAddButton={!showAddForm && !editingId}
            onAddClick={() => setShowAddForm(true)}
          >
            <PositionsImportPrompt
              legacyPositions={positions.length === 0 ? legacyPositions : []}
              onImport={addHolding}
              onClearLegacy={clearLegacyPositions}
            />

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
                const first = positions.find((p) => p.ticker === ticker);
                if (first) handleEdit(first.id);
              }}
            />

            <PortfolioReadinessPanel quality={quality} />
          </PortfolioSection>

          <PortfolioSection
            title="Obligacje i konta oszczędnościowe"
            headingId="holdings-heading"
            addLabel="+ Dodaj pozycję"
            showAddButton={!showAddHoldingForm}
            onAddClick={() => setShowAddHoldingForm(true)}
          >
            {holdingsError && <p className="text-sm text-loss mb-3">{holdingsError}</p>}

            {showAddHoldingForm && (
              <div className="bg-bg-card rounded-xl p-4 mb-4 border border-bg-muted">
                <h3 className="text-sm font-semibold text-text-secondary mb-3">Nowa pozycja</h3>
                <HoldingForm
                  bondPresets={bondPresets}
                  onSubmit={(draft) => {
                    addHolding(draft)
                      .then(() => setShowAddHoldingForm(false))
                      .catch(() => { /* error already surfaced via holdingsError */ });
                  }}
                  onCancel={() => setShowAddHoldingForm(false)}
                />
              </div>
            )}

            <HoldingList holdings={bondSavingsHoldings} bondPresets={bondPresets} onDelete={removeHolding} />
          </PortfolioSection>
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
      </PortfolioAuthGate>
    </ErrorBoundary>
  );
}

export default PortfolioPage;

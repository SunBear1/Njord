import { Shield, PiggyBank, Landmark, Info, AlertTriangle } from 'lucide-react';
import { BROKERS } from '../../types/portfolio';
import type { Broker } from '../../types/portfolio';

interface Step2Props {
  ikeBrokerId: string | null;
  ikzeBrokerId: string | null;
  ikeEnabled: boolean;
  ikzeEnabled: boolean;
  setIkeBroker: (id: string | null) => void;
  setIkzeBroker: (id: string | null) => void;
  setIkeEnabled: (enabled: boolean) => void;
  setIkzeEnabled: (enabled: boolean) => void;
}

const INSTRUMENT_LABELS: Record<string, { label: string; color: string }> = {
  etf: { label: 'ETF', color: 'blue' },
  stocks_pl: { label: 'Akcje PL', color: 'green' },
  stocks_foreign: { label: 'Akcje zagr.', color: 'purple' },
  bonds: { label: 'Obligacje', color: 'violet' },
};

const TAG_CLASSES: Record<string, string> = {
  blue: 'bg-bg-hover text-accent-primary',
  green: 'bg-success/10 text-success',
  purple: 'bg-accent-primary/10 text-accent-primary',
  violet: 'bg-accent-primary/10 text-accent-primary',
};

function InstrumentTags({ instruments }: { instruments: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {instruments.map((inst) => {
        const meta = INSTRUMENT_LABELS[inst];
        if (!meta) return null;
        return (
          <span
            key={inst}
            className={`text-xs px-2 py-0.5 rounded-full ${TAG_CLASSES[meta.color]}`}
          >
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}

interface BrokerCardProps {
  broker: Broker;
  selected: boolean;
  disabled: boolean;
  disabledReason?: string;
  sectionDisabled: boolean;
  onSelect: (id: string) => void;
}

function BrokerCard({
  broker,
  selected,
  disabled,
  disabledReason,
  sectionDisabled,
  onSelect,
}: BrokerCardProps) {
  const isInteractive = !disabled && !sectionDisabled;

  const borderClasses = selected && !sectionDisabled
    ? 'border-accent-primary/40 bg-bg-hover/30 ring-2 ring-accent-primary'
    : 'border-border hover:border-border ';

  return (
    <button
      type="button"
      onClick={() => { if (isInteractive) onSelect(broker.id); }}
      disabled={!isInteractive}
      aria-pressed={selected}
      className={`
        relative p-4 rounded-lg border text-left transition-colors w-full
        ${borderClasses}
        ${sectionDisabled ? 'opacity-40 cursor-not-allowed' : ''}
        ${disabled && !sectionDisabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${isInteractive ? 'cursor-pointer' : ''}
      `}
    >
      {/* Disabled overlay */}
      {disabled && !sectionDisabled && disabledReason ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-bg-card/40">
          <span className="text-xs font-medium text-danger bg-bg-card/90 px-3 py-1 rounded-full">
            {disabledReason}
          </span>
        </div>
      ) : null}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-border shrink-0" />
          <span className="font-medium text-sm text-text-primary">
            {broker.name}
          </span>
        </div>
        {selected && !sectionDisabled ? (
          <span className="w-5 h-5 rounded-full bg-accent-interactive flex items-center justify-center shrink-0">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        ) : (
          <span className="w-5 h-5 rounded-full border-2 border-border shrink-0" />
        )}
      </div>

      {/* Instruments */}
      <div className="mb-3">
        <InstrumentTags instruments={broker.instruments} />
      </div>

      {/* Commission & spread */}
      <div className="space-y-1 text-xs text-text-secondary mb-2">
        <p>
          <span className="font-medium text-text-secondary">Prowizja:</span>{' '}
          {broker.commissionEtf}
        </p>
        <p>
          <span className="font-medium text-text-secondary">Spread:</span>{' '}
          {broker.fxSpread}
        </p>
      </div>

      {/* Notes */}
      {broker.notes ? (
        <div className="flex items-start gap-1.5 text-xs text-text-muted">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{broker.notes}</span>
        </div>
      ) : null}
    </button>
  );
}

function PkoBpWarning() {
  return (
    <div className="flex items-start gap-2 bg-danger/5 text-danger text-xs p-2 rounded-lg mt-3">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>Na koncie w PKO BP dostępne są wyłącznie obligacje detaliczne skarbowe.</span>
    </div>
  );
}

export default function Step2BrokerSelection({
  ikeBrokerId,
  ikzeBrokerId,
  ikeEnabled,
  ikzeEnabled,
  setIkeBroker,
  setIkzeBroker,
  setIkeEnabled,
  setIkzeEnabled,
}: Step2Props) {
  const handleIkeBrokerSelect = (id: string) => {
    setIkeBroker(ikeBrokerId === id ? null : id);
  };

  const handleIkzeBrokerSelect = (id: string) => {
    setIkzeBroker(ikzeBrokerId === id ? null : id);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── IKE Section ── */}
      <section className="bg-bg-card rounded-xl border border-border shadow-sm p-5">
        <div className="flex items-center gap-2 text-base font-semibold text-text-primary mb-4">
          <Shield className="w-5 h-5 text-accent-primary" />
          <span>Broker IKE</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-normal">
            0% podatku po 60. r.ż.
          </span>
        </div>

        <label className="flex items-center gap-2 text-sm text-text-secondary mb-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!ikeEnabled}
            onChange={(e) => setIkeEnabled(!e.target.checked)}
            className="rounded border-border text-accent-primary focus:ring-accent-primary"
          />
          Nie chcę korzystać z IKE
        </label>

        <div className="grid grid-cols-1 gap-3">
          {BROKERS.map((broker) => (
            <BrokerCard
              key={broker.id}
              broker={broker}
              selected={ikeBrokerId === broker.id}
              disabled={false}
              sectionDisabled={!ikeEnabled}
              onSelect={handleIkeBrokerSelect}
            />
          ))}
        </div>

        {ikeBrokerId === 'pkobp' && ikeEnabled ? <PkoBpWarning /> : null}
      </section>

      {/* ── IKZE Section ── */}
      <section className="bg-bg-card rounded-xl border border-border shadow-sm p-5">
        <div className="flex items-center gap-2 text-base font-semibold text-text-primary mb-4">
          <PiggyBank className="w-5 h-5 text-accent-primary" />
          <span>Broker IKZE</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-normal">
            Odliczenie od PIT · 10% ryczałt
          </span>
        </div>

        <label className="flex items-center gap-2 text-sm text-text-secondary mb-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!ikzeEnabled}
            onChange={(e) => setIkzeEnabled(!e.target.checked)}
            className="rounded border-border text-accent-primary focus:ring-accent-primary"
          />
          Nie chcę korzystać z IKZE
        </label>

        <div className="grid grid-cols-1 gap-3">
          {BROKERS.map((broker) => (
            <BrokerCard
              key={broker.id}
              broker={broker}
              selected={ikzeBrokerId === broker.id}
              disabled={!broker.ikze}
              disabledReason={!broker.ikze ? `${broker.name} nie oferuje IKZE` : undefined}
              sectionDisabled={!ikzeEnabled}
              onSelect={handleIkzeBrokerSelect}
            />
          ))}
        </div>

        {ikzeBrokerId === 'pkobp' && ikzeEnabled ? <PkoBpWarning /> : null}
      </section>
    </div>
  );
}

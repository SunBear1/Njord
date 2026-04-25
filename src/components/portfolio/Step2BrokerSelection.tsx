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
  bonds: { label: 'Obligacje', color: 'amber' },
};

const TAG_CLASSES: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
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
    ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30 ring-2 ring-blue-200'
    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600';

  return (
    <button
      type="button"
      onClick={() => { if (isInteractive) onSelect(broker.id); }}
      disabled={!isInteractive}
      aria-pressed={selected}
      className={`
        relative p-4 rounded-lg border text-left transition-all w-full
        ${borderClasses}
        ${sectionDisabled ? 'opacity-40 cursor-not-allowed' : ''}
        ${disabled && !sectionDisabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${isInteractive ? 'cursor-pointer' : ''}
      `}
    >
      {/* Disabled overlay */}
      {disabled && !sectionDisabled && disabledReason ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-900/5 dark:bg-gray-900/40">
          <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-white/90 dark:bg-gray-800/90 px-3 py-1 rounded-full">
            {disabledReason}
          </span>
        </div>
      ) : null}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
          <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
            {broker.name}
          </span>
        </div>
        {selected && !sectionDisabled ? (
          <span className="w-5 h-5 rounded-full bg-blue-500 dark:bg-blue-400 flex items-center justify-center shrink-0">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        ) : (
          <span className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 shrink-0" />
        )}
      </div>

      {/* Instruments */}
      <div className="mb-3">
        <InstrumentTags instruments={broker.instruments} />
      </div>

      {/* Commission & spread */}
      <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400 mb-2">
        <p>
          <span className="font-medium text-gray-700 dark:text-gray-300">Prowizja:</span>{' '}
          {broker.commissionEtf}
        </p>
        <p>
          <span className="font-medium text-gray-700 dark:text-gray-300">Spread:</span>{' '}
          {broker.fxSpread}
        </p>
      </div>

      {/* Notes */}
      {broker.notes ? (
        <div className="flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{broker.notes}</span>
        </div>
      ) : null}
    </button>
  );
}

function PkoBpWarning() {
  return (
    <div className="flex items-start gap-2 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200 text-xs p-2 rounded-lg mt-3">
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
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <div className="flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          <Shield className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          <span>Broker IKE</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-normal">
            0% podatku po 60. r.ż.
          </span>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!ikeEnabled}
            onChange={(e) => setIkeEnabled(!e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500"
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
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <div className="flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          <PiggyBank className="w-5 h-5 text-purple-500 dark:text-purple-400" />
          <span>Broker IKZE</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-normal">
            Odliczenie od PIT · 10% ryczałt
          </span>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!ikzeEnabled}
            onChange={(e) => setIkzeEnabled(!e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500"
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

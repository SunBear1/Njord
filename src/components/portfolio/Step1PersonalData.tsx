import { User, Calendar, Percent } from 'lucide-react';
import type { PersonalData, PitBracket } from '../../types/portfolio';
import { fmtPLN } from '../../utils/formatting';

interface Step1Props {
  personalData: PersonalData;
  updatePersonalData: (updates: Partial<PersonalData>) => void;
  annualBudget: number;
  ikeAnnualLimit: number;
  ikzeAnnualLimit: number;
}

const PIT_OPTIONS: { value: PitBracket; label: string }[] = [
  { value: 12, label: '12% (I próg)' },
  { value: 19, label: '19% (liniowy)' },
  { value: 32, label: '32% (II próg)' },
];

function Toggle({
  value,
  onChange,
  id,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted dark:text-faint">{value ? '' : 'NIE'}</span>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? 'bg-accent' : 'bg-surface-muted dark:bg-surface-dark-alt'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-surface transition-transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span className="text-xs text-muted dark:text-faint">{value ? 'TAK' : ''}</span>
    </div>
  );
}

export default function Step1PersonalData({
  personalData,
  updatePersonalData,
  annualBudget,
  ikeAnnualLimit,
  ikzeAnnualLimit,
}: Step1Props) {
  return (
    <div className="bg-surface dark:bg-surface-dark rounded-xl border border-edge dark:border-edge-strong shadow-sm p-5 space-y-5">
      {/* Row 1: Monthly amount + Horizon */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Monthly amount */}
        <div>
          <label
            htmlFor="monthlyAmount"
            className="block text-sm font-medium text-body dark:text-on-dark-muted mb-1"
          >
            <User className="inline h-4 w-4 mr-1 -mt-0.5" aria-hidden="true" />
            Miesięczna kwota do inwestowania (PLN)
          </label>
          <input
            id="monthlyAmount"
            type="number"
            min={100}
            max={50000}
            step={100}
            value={personalData.totalMonthlyPLN}
            onChange={(e) => updatePersonalData({ totalMonthlyPLN: Number(e.target.value) })}
            className="w-full rounded-lg border border-edge-strong dark:border-edge-strong bg-surface dark:bg-surface-dark-alt px-3 py-2 text-sm text-heading dark:text-on-dark font-mono focus:outline-none focus:ring-2 focus:ring-surface-dark/30"
          />
          <p className="text-xs text-faint dark:text-muted mt-1">
            Roczny budżet: {fmtPLN(annualBudget)}
          </p>
        </div>

        {/* Horizon slider */}
        <div>
          <label
            htmlFor="horizon"
            className="block text-sm font-medium text-body dark:text-on-dark-muted mb-1"
          >
            <Calendar className="inline h-4 w-4 mr-1 -mt-0.5" aria-hidden="true" />
            Horyzont inwestycyjny: {personalData.horizonYears} lat
          </label>
          <input
            id="horizon"
            type="range"
            min={1}
            max={50}
            step={1}
            value={personalData.horizonYears}
            onChange={(e) => updatePersonalData({ horizonYears: Number(e.target.value) })}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-faint dark:text-muted mt-1">
            <span>1 rok</span>
            <span>25 lat</span>
            <span>50 lat</span>
          </div>
        </div>
      </div>

      {/* Row 2: PIT bracket + Self-employed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PIT bracket */}
        <fieldset>
          <legend className="block text-sm font-medium text-body dark:text-on-dark-muted mb-1">
            <Percent className="inline h-4 w-4 mr-1 -mt-0.5" aria-hidden="true" />
            Stawka PIT
          </legend>
          <div className="flex gap-4">
            {PIT_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5 text-sm text-body dark:text-on-dark-muted cursor-pointer">
                <input
                  type="radio"
                  name="pitBracket"
                  value={opt.value}
                  checked={personalData.pitBracket === opt.value}
                  onChange={() => updatePersonalData({ pitBracket: opt.value })}
                  className="accent-blue-600"
                />
                {opt.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-faint dark:text-muted mt-1">
            Wpływa na wartość odliczenia IKZE od podatku
          </p>
        </fieldset>

        {/* Self-employed toggle */}
        <div>
          <label
            htmlFor="selfEmployed"
            className="block text-sm font-medium text-body dark:text-on-dark-muted mb-1"
          >
            Działalność gospodarcza
          </label>
          <Toggle
            id="selfEmployed"
            value={personalData.isSelfEmployed}
            onChange={(v) => updatePersonalData({ isSelfEmployed: v })}
          />
          <p className="text-xs text-faint dark:text-muted mt-1">
            Wyższy limit IKZE dla osób prowadzących DG
          </p>
        </div>
      </div>

      {/* Row 3: Inflation + 800+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Inflation */}
        <div>
          <label
            htmlFor="inflationRate"
            className="block text-sm font-medium text-body dark:text-on-dark-muted mb-1"
          >
            <Percent className="inline h-4 w-4 mr-1 -mt-0.5" aria-hidden="true" />
            Zakładana inflacja roczna (%)
          </label>
          <input
            id="inflationRate"
            type="number"
            min={0}
            max={20}
            step={0.1}
            value={personalData.inflationRate}
            onChange={(e) => updatePersonalData({ inflationRate: Number(e.target.value) })}
            className="w-full rounded-lg border border-edge-strong dark:border-edge-strong bg-surface dark:bg-surface-dark-alt px-3 py-2 text-sm text-heading dark:text-on-dark font-mono focus:outline-none focus:ring-2 focus:ring-surface-dark/30"
          />
          <p className="text-xs text-faint dark:text-muted mt-1">
            Używana do dyskontowania wartości realnej portfela
          </p>
        </div>

        {/* 800+ toggle */}
        <div>
          <label
            htmlFor="beneficiary800"
            className="block text-sm font-medium text-body dark:text-on-dark-muted mb-1"
          >
            Beneficjent programu 800+
          </label>
          <Toggle
            id="beneficiary800"
            value={personalData.isBeneficiary800Plus}
            onChange={(v) => updatePersonalData({ isBeneficiary800Plus: v })}
          />
          <p className="text-xs text-faint dark:text-muted mt-1">
            Odblokuje obligacje rodzinne ROS i ROD
          </p>
        </div>
      </div>

      {/* Summary bar */}
      <div className="rounded-lg border bg-accent-light dark:bg-surface-dark/30 border-accent dark:border-accent px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-accent-hover dark:text-on-dark-muted">
        <span>
          Twój roczny budżet: <strong>{fmtPLN(annualBudget)}</strong>
        </span>
        <span className="text-accent dark:text-accent-hover hidden md:inline" aria-hidden="true">|</span>
        <span>
          Limit IKE: <strong>{fmtPLN(ikeAnnualLimit)}</strong>
        </span>
        <span className="text-accent dark:text-accent-hover hidden md:inline" aria-hidden="true">|</span>
        <span>
          Limit IKZE: <strong>{fmtPLN(ikzeAnnualLimit)}</strong>
        </span>
      </div>
    </div>
  );
}

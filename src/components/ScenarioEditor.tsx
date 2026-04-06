import { Wand2 } from 'lucide-react';
import type { Scenarios, ScenarioKey } from '../types/scenario';

interface ScenarioEditorProps {
  scenarios: Scenarios;
  onChange: (key: ScenarioKey, field: 'deltaStock' | 'deltaFx', value: number) => void;
  suggestedScenarios: Scenarios | null;
  onApplySuggested: () => void;
}

const SCENARIO_CONFIG: { key: ScenarioKey; label: string; emoji: string; bg: string; border: string; text: string }[] = [
  { key: 'bear', label: 'Bear', emoji: '🐻', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  { key: 'base', label: 'Base', emoji: '⚖️', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  { key: 'bull', label: 'Bull', emoji: '🐂', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
];

function NumInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-500">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          step={0.1}
          value={parseFloat(value.toFixed(2))}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-500">%</span>
      </div>
    </div>
  );
}

export function ScenarioEditor({ scenarios, onChange, suggestedScenarios, onApplySuggested }: ScenarioEditorProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">🎯 Scenariusze</h2>
        {suggestedScenarios && (
          <button
            onClick={onApplySuggested}
            className="flex items-center gap-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <Wand2 size={13} />
            Zastosuj z historii
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Wpisz prognozowaną zmianę ceny akcji i kursu USD/PLN dla każdego scenariusza.
        {suggestedScenarios && ' Kliknij „Zastosuj z historii" aby użyć wartości obliczonych z historycznej zmienności.'}
      </p>

      <div className="grid grid-cols-3 gap-3">
        {SCENARIO_CONFIG.map(({ key, label, emoji, bg, border, text }) => (
          <div key={key} className={`${bg} ${border} border rounded-lg p-3 space-y-3`}>
            <div className={`text-sm font-semibold ${text}`}>
              {emoji} {label}
            </div>
            <NumInput
              label="Zmiana akcji"
              value={scenarios[key].deltaStock}
              onChange={(v) => onChange(key, 'deltaStock', v)}
            />
            <NumInput
              label="Zmiana USD/PLN"
              value={scenarios[key].deltaFx}
              onChange={(v) => onChange(key, 'deltaFx', v)}
            />
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
        <strong>Bear:</strong> pesymistyczny (akcje i kurs walutowy spadają) ·{' '}
        <strong>Base:</strong> neutralny (brak zmian) ·{' '}
        <strong>Bull:</strong> optymistyczny (akcje i kurs walutowy rosną)
      </div>
    </div>
  );
}

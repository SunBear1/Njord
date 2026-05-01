import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { parsePLDate, isoToPLDate } from './taxHelpers';

/**
 * Text input that accepts dates in Polish DD/MM/RRRR format.
 * Auto-inserts slashes. Validates on complete entry.
 * Calls onChange(isoDate) when valid, onChange('') when cleared/invalid.
 */
export function PolishDateInput({
  id,
  value,
  onChange,
  maxDate,
  maxDateMessage,
  className = '',
}: {
  id?: string;
  value: string;
  onChange: (isoDate: string) => void;
  maxDate?: string;
  maxDateMessage?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(() => isoToPLDate(value));
  const [error, setError] = useState<string | undefined>();

  // Sync display when the ISO value changes externally (e.g. transaction cleared).
  useEffect(() => {
    const currentISO = parsePLDate(display) ?? '';
    if (currentISO !== value) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing display to external value change
      setDisplay(isoToPLDate(value));
      setError(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, '');

    let formatted: string;
    if (digits.length <= 2) formatted = digits;
    else if (digits.length <= 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    else formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;

    setDisplay(formatted);

    if (!formatted) { setError(undefined); onChange(''); return; }
    if (formatted.length < 10) { setError(undefined); onChange(''); return; }

    const parsed = parsePLDate(formatted);
    if (!parsed) { setError('Nieprawidłowa data — oczekiwany format DD/MM/RRRR'); onChange(''); return; }
    if (maxDate && parsed > maxDate) {
      setError(maxDateMessage ?? `Data nie może być późniejsza niż ${isoToPLDate(maxDate)}`);
      onChange('');
      return;
    }
    setError(undefined);
    onChange(parsed);
  }, [onChange, maxDate, maxDateMessage]);

  const hasError = !!error;
  return (
    <div className="space-y-0.5">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder="DD/MM/RRRR"
        maxLength={10}
        autoComplete="off"
        spellCheck={false}
        className={`${className} ${hasError ? '!border-danger focus:!ring-danger' : ''}`}
      />
      {hasError && (
        <p className="text-[11px] text-danger flex items-center gap-1">
          <AlertTriangle size={10} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

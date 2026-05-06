import type { ReactNode } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

interface ComparisonInputDropdownProps {
  title: string;
  summary: string;
  detail: string;
  isOpen: boolean;
  hasSavedInput: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function ComparisonInputDropdown({
  title,
  summary,
  detail,
  isOpen,
  hasSavedInput,
  onToggle,
  children,
}: ComparisonInputDropdownProps) {
  return (
    <section className="rounded-2xl border border-border bg-bg-card shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={isOpen}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-text-primary">{title}</h2>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              hasSavedInput
                ? 'bg-success/10 text-success'
                : 'bg-bg-muted text-text-muted'
            }`}>
              {hasSavedInput && <CheckCircle2 size={12} aria-hidden="true" />}
              {hasSavedInput ? 'Zapisane dane' : 'Do uzupełnienia'}
            </span>
          </div>
          <p className="text-sm font-medium text-text-primary">{summary}</p>
          <p className="text-xs text-text-secondary">{detail}</p>
        </div>

        <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-text-secondary shrink-0">
          {isOpen ? 'Zwiń' : 'Rozwiń'}
          {isOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-border px-5 py-5">
          {children}
        </div>
      )}
    </section>
  );
}

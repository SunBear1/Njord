import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

interface ComparisonInputDropdownProps {
  title: string;
  summary: string;
  detail: string;
  isOpen: boolean;
  isComplete: boolean;
  onToggle: () => void;
  onDone?: () => void;
  children: ReactNode;
  wrapped?: boolean;
}

export function ComparisonInputDropdown({
  title,
  summary,
  detail,
  isOpen,
  isComplete,
  onToggle,
  onDone,
  children,
  wrapped,
}: ComparisonInputDropdownProps) {
  return (
    <section className="rounded-2xl border border-border bg-bg-card shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full gap-3 px-5 py-4 text-left ${wrapped ? 'flex-col' : 'flex-col md:flex-row'} md:items-start md:justify-between`}
        aria-expanded={isOpen}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-text-primary">{title}</h2>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              isComplete
                ? 'bg-success/10 text-success'
                : 'bg-warning/10 text-warning'
            }`}>
              {isComplete ? <CheckCircle2 size={12} aria-hidden="true" /> : <AlertTriangle size={12} aria-hidden="true" />}
              {isComplete ? 'Zapisane dane' : 'Do uzupełnienia'}
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
          {onDone && (
            <div className="mt-5 flex justify-end border-t border-border pt-4">
              <button
                type="button"
                onClick={onDone}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-muted transition-colors"
              >
                Gotowe
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

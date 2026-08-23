import type { ReactNode } from 'react';

interface PortfolioSectionProps {
  title: string;
  headingId: string;
  addLabel: string;
  showAddButton: boolean;
  onAddClick: () => void;
  children: ReactNode;
}

export function PortfolioSection({ title, headingId, addLabel, showAddButton, onAddClick, children }: PortfolioSectionProps) {
  return (
    <section aria-labelledby={headingId}>
      <div className="flex items-center justify-between mb-4">
        <h2 id={headingId} className="text-xl font-bold text-text-primary">
          {title}
        </h2>
        {showAddButton && (
          <button
            type="button"
            onClick={onAddClick}
            className="px-3 py-1.5 text-sm font-medium bg-neutral text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            {addLabel}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

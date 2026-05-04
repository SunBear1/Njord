import { useEffect } from 'react';
import { X } from 'lucide-react';
import { InputPanel } from './InputPanel';
import type { InputPanelProps } from './InputPanel';

interface InputModalProps extends Omit<InputPanelProps, 'collapsed' | 'onToggleCollapse'> {
  isOpen: boolean;
  onClose: () => void;
}

export function InputModal({ isOpen, onClose, ...inputPanelProps }: InputModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className="relative bg-bg-primary w-full max-w-xl h-full overflow-y-auto shadow-2xl border-l border-border flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Dane wejściowe"
      >
        {/* Close button */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0 border-b border-border bg-bg-primary sticky top-0 z-10">
          <span className="text-base font-semibold text-text-primary">Dane wejściowe</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="Zamknij"
          >
            <X size={20} />
          </button>
        </div>

        {/* InputPanel without collapse controls */}
        <div className="flex-1">
          <InputPanel {...inputPanelProps} />
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { InputPanel } from './InputPanel';
import type { InputPanelProps } from './InputPanel';

interface InputModalProps extends Omit<InputPanelProps, 'collapsed' | 'onToggleCollapse' | 'header'> {
  isOpen: boolean;
  onClose: () => void;
  savedAt: number;
}

export function InputModal({ isOpen, onClose, savedAt, ...inputPanelProps }: InputModalProps) {
  const [showSavedNotice, setShowSavedNotice] = useState(false);
  const seenSavedAtRef = useRef(savedAt);
  const handleClose = useCallback(() => {
    seenSavedAtRef.current = savedAt;
    setShowSavedNotice(false);
    onClose();
  }, [onClose, savedAt]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      seenSavedAtRef.current = savedAt;
      return;
    }

    if (savedAt === 0 || savedAt === seenSavedAtRef.current) {
      return;
    }

    seenSavedAtRef.current = savedAt;
    setShowSavedNotice(true);

    const timer = window.setTimeout(() => {
      setShowSavedNotice(false);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [isOpen, savedAt]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={handleClose}
    >
      <div
        className="bg-bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Dane wejściowe"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          data-input-modal-header="true"
          className="sticky top-0 z-20 bg-bg-card border-b border-border shadow-sm"
        >
          <div className="flex items-center justify-between px-6 py-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-text-primary">Dane wejściowe</h2>
              <p
                aria-live="polite"
                className={`flex items-center gap-1.5 text-xs text-success transition-opacity duration-200 ${showSavedNotice ? 'visible opacity-100' : 'invisible opacity-0'}`}
              >
                <CheckCircle2 size={12} aria-hidden="true" />
                Dane wejściowe zostały zapisane
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="text-2xl leading-none text-text-muted hover:text-text-primary"
              aria-label="Zamknij"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          <InputPanel
            {...inputPanelProps}
            header={null}
          />
        </div>
      </div>
    </div>
  );
}

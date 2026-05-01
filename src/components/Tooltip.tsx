import { type ReactNode, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

interface TooltipProps {
  /** Tooltip text or JSX rendered on hover */
  content: ReactNode;
  /** Trigger element — defaults to an Info icon */
  children?: ReactNode;
  /** Where the tooltip appears relative to the trigger */
  side?: 'top' | 'bottom';
  /** Width class for the tooltip bubble (default: w-60) */
  width?: string;
}

/**
 * Portal-based tooltip that escapes overflow-hidden containers.
 * Positions itself relative to the trigger using getBoundingClientRect.
 */
export function Tooltip({ content, children, side = 'top', width = 'w-60' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const top = side === 'top' ? rect.top - 8 : rect.bottom + 8;
    setPos({ top, left: centerX });
  }, [side]);

  useEffect(() => {
    if (!visible) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, { capture: true, passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [visible, updatePosition]);

  return (
    <span
      ref={triggerRef}
      className="inline-flex items-center align-middle"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children ?? (
        <Info
          size={12}
          className="text-border cursor-help hover:text-text-primary transition-colors"
          aria-hidden="true"
        />
      )}
      {visible && createPortal(
        <span
          role="tooltip"
          className={[
            'fixed z-[9999] pointer-events-none',
            width,
            'rounded-lg bg-bg-card text-white text-xs px-2.5 py-2',
            'shadow-xl leading-relaxed whitespace-normal',
            '-translate-x-1/2',
            side === 'top' ? '-translate-y-full' : '',
          ].join(' ')}
          style={{ top: pos.top, left: pos.left }}
        >
          {content}
          <span
            className={[
              'absolute left-1/2 -translate-x-1/2 border-4 border-transparent',
              side === 'top' ? 'top-full border-t-bg-hover' : 'bottom-full border-b-bg-hover',
            ].join(' ')}
          />
        </span>,
        document.body,
      )}
    </span>
  );
}

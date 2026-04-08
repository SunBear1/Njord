import type { ReactNode } from 'react';
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
 * Lightweight CSS-only tooltip using Tailwind group/hover.
 * No JS, no library dependency. Accessible via title fallback.
 */
export function Tooltip({ content, children, side = 'top', width = 'w-60' }: TooltipProps) {
  return (
    <span className="group relative inline-flex items-center align-middle">
      {children ?? (
        <Info
          size={13}
          className="text-gray-400 cursor-help hover:text-gray-600 transition-colors"
          aria-hidden="true"
        />
      )}
      <span
        role="tooltip"
        className={[
          'pointer-events-none absolute z-50 hidden group-hover:block',
          width,
          'rounded-lg bg-gray-800 text-white text-xs px-2.5 py-2',
          'shadow-xl leading-relaxed whitespace-normal',
          'left-1/2 -translate-x-1/2',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
        ].join(' ')}
      >
        {content}
        {/* Arrow */}
        <span
          className={[
            'absolute left-1/2 -translate-x-1/2 border-4 border-transparent',
            side === 'top' ? 'top-full border-t-gray-800' : 'bottom-full border-b-gray-800',
          ].join(' ')}
        />
      </span>
    </span>
  );
}

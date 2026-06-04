import { memo } from 'react';
import type React from 'react';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

// eslint-disable-next-line react-refresh/only-export-components
function SkeletonBlock({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-bg-hover rounded ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// eslint-disable-next-line react-refresh/only-export-components
function VerdictSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-busy="true" aria-label="Ładowanie wyników…">
      {[0, 1, 2].map((i) => (
        <div key={i} className="border-2 border-border rounded-xl p-5 space-y-3">
          <SkeletonBlock className="h-6 w-20 rounded-full" />
          <div className="grid grid-cols-2 gap-2">
            {[0, 1].map((j) => (
              <div key={j} className="rounded-xl p-3 space-y-2">
                <SkeletonBlock className="h-3 w-12 mx-auto" />
                <SkeletonBlock className="h-5 w-20 mx-auto" />
                <SkeletonBlock className="h-3 w-10 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div
      className="rounded-xl border border-border p-4 space-y-2"
      style={{ height }}
      aria-busy="true"
      aria-label="Ładowanie wykresu…"
    >
      <SkeletonBlock className="h-4 w-32" />
      <div className="flex items-end gap-1 h-full pb-4">
        {Array.from({ length: 8 }, (_, i) => (
          <SkeletonBlock
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${30 + Math.sin(i) * 25 + 40}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
function TextSkeleton({ width = 'w-24', inline = false }: { width?: string; inline?: boolean }) {
  return (
    <SkeletonBlock className={`h-4 ${width} ${inline ? 'inline-block align-middle' : ''}`} />
  );
}

export const Skeleton = Object.assign(memo(SkeletonBlock), {
  Verdict: memo(VerdictSkeleton),
  Chart: memo(ChartSkeleton),
  Text: memo(TextSkeleton),
});

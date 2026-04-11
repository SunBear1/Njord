import { useState, useEffect, useRef } from 'react';
import type { BondPreset } from '../types/scenario';

interface UseBondPresetsReturn {
  presets: BondPreset[];
  isLoading: boolean;
  error: string | null;
}

export function useBondPresets(): UseBondPresetsReturn {
  const [presets, setPresets] = useState<BondPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/bonds', { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as BondPreset[];
        if (cancelled) return;
        setPresets(data);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Nieznany błąd');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return { presets, isLoading, error };
}

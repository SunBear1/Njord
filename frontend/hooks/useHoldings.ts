import { useState, useEffect, useCallback } from 'react';
import type { Holding, HoldingDraft } from '../types/holding';

interface UseHoldingsReturn {
  holdings: Holding[];
  isLoading: boolean;
  error: string | null;
  addHolding: (draft: HoldingDraft) => Promise<void>;
  updateHolding: (id: string, draft: Partial<HoldingDraft>) => Promise<void>;
  removeHolding: (id: string) => Promise<void>;
  clearError: () => void;
}

const HOLDINGS_BASE = '/api/v1/portfolio/holdings';

async function holdingsFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${HOLDINGS_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const contentType = res.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('Serwer zwrócił nieoczekiwaną odpowiedź. Spróbuj ponownie później.');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || 'Wystąpił nieznany błąd.');
  }
  return data as T;
}

export function useHoldings(): UseHoldingsReturn {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { holdings: fetched } = await holdingsFetch<{ holdings: Holding[] }>('');
        if (!cancelled) setHoldings(fetched);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Nie udało się wczytać pozycji.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const addHolding = useCallback(async (draft: HoldingDraft) => {
    setError(null);
    try {
      const created = await holdingsFetch<Holding>('', { method: 'POST', body: JSON.stringify(draft) });
      setHoldings((prev) => [created, ...prev]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nie udało się dodać pozycji.';
      setError(message);
      throw err;
    }
  }, []);

  const updateHolding = useCallback(async (id: string, draft: Partial<HoldingDraft>) => {
    setError(null);
    try {
      const updated = await holdingsFetch<Holding>(`/${id}`, { method: 'PATCH', body: JSON.stringify(draft) });
      setHoldings((prev) => prev.map((h) => (h.id === id ? updated : h)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nie udało się zapisać zmian.';
      setError(message);
      throw err;
    }
  }, []);

  const removeHolding = useCallback(async (id: string) => {
    setError(null);
    try {
      await holdingsFetch<{ ok: boolean }>(`/${id}`, { method: 'DELETE' });
      setHoldings((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nie udało się usunąć pozycji.';
      setError(message);
      throw err;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { holdings, isLoading, error, addHolding, updateHolding, removeHolding, clearError };
}

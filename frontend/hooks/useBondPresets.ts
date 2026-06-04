import { useState, useEffect, useRef } from 'react';
import type { Bond, ApiResponse } from '../types/financeApi';
import type { BondPreset, BondRateType } from '../types/scenario';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { toErrorMessage } from '../utils/formatting';
import { generateDescription } from '../utils/parseBondPresets';

interface UseBondPresetsReturn {
  presets: BondPreset[];
  isLoading: boolean;
  error: string | null;
}

function bondToBondPreset(bond: Bond): BondPreset {
  const rateType = bond.rate_type as BondRateType;
  const margin = bond.margin_pct ?? 0;
  const preset: BondPreset = {
    id: bond.id,
    name: bond.name_pl,
    maturityMonths: bond.maturity_months,
    rateType,
    firstYearRate: bond.first_year_rate_pct ?? 0,
    margin,
    couponFrequency: bond.coupon_frequency,
    earlyRedemptionAllowed: bond.early_redemption_allowed,
    earlyRedemptionPenalty: bond.early_redemption_penalty_pct ?? 0,
    description: generateDescription(rateType, margin, bond.maturity_months, bond.is_family),
  };

  if (bond.is_family) preset.isFamily = true;

  return preset;
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
        const res = await fetchWithTimeout('/api/v1/finance/bonds', controller.signal);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as ApiResponse<Bond[]>;
        if (cancelled) return;
        setPresets(json.data.map(bondToBondPreset));
      } catch (err) {
        if (cancelled) return;
        setError(toErrorMessage(err));
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

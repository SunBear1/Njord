import type { BondPreset, BondRateType } from '../types/scenario';

function generateDescription(
  rateType: BondRateType,
  margin: number,
  maturityMonths: number,
  isFamily: boolean,
): string {
  const marginStr = margin.toFixed(2).replace('.', ',');
  if (isFamily) return `Rodzinne, inflacja + ${marginStr}% marży`;
  switch (rateType) {
    case 'fixed': {
      if (maturityMonths < 12) return `Stałoprocentowe, ${maturityMonths} mies.`;
      const years = maturityMonths / 12;
      const yearsLabel = years === 1 ? 'rok' : years <= 4 ? 'lata' : 'lat';
      return `Stałoprocentowe, ${years} ${yearsLabel}`;
    }
    case 'reference':
      return margin > 0
        ? `Zmiennoprocentowe, stopa ref. NBP + ${marginStr}%`
        : 'Zmiennoprocentowe, stopa ref. NBP';
    case 'inflation':
      return `Inflacja + ${marginStr}% marży`;
  }
}

export function parseBondPresetsFromCsv(raw: string): BondPreset[] {
  const lines = raw.replace(/\r/g, '').trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];

  return lines.slice(1).map((line) => {
    const [
      id,
      name_pl,
      maturity_months,
      rate_type,
      first_year_rate_pct,
      margin_pct,
      coupon_frequency,
      early_redemption_allowed,
      early_redemption_penalty_pct,
      is_family,
    ] = line.split(',');

    const maturityMonths = parseInt(maturity_months, 10);
    const firstYearRate = parseFloat(first_year_rate_pct);
    const margin = parseFloat(margin_pct);
    const couponFrequency = parseInt(coupon_frequency, 10);
    const earlyRedemptionAllowed = early_redemption_allowed.trim() === 'true';
    const earlyRedemptionPenalty = parseFloat(early_redemption_penalty_pct);
    const isFamily = is_family.trim() === 'true';
    const rateType = rate_type.trim() as BondRateType;

    const preset: BondPreset = {
      id: id.trim(),
      name: name_pl.trim(),
      maturityMonths,
      rateType,
      firstYearRate,
      margin,
      couponFrequency,
      earlyRedemptionAllowed,
      earlyRedemptionPenalty,
      description: generateDescription(rateType, margin, maturityMonths, isFamily),
    };

    if (isFamily) preset.isFamily = true;

    return preset;
  });
}

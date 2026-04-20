const PLN = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 });
const PLN_GROSZE = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const NUM = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export const fmtPLN = (v: number) => PLN.format(v);
/** Format PLN with grosze precision (2 decimal places) — for tax calculator. */
export const fmtPLNGrosze = (v: number) => PLN_GROSZE.format(v);
export const fmtUSD = (v: number) => USD.format(v);
export const fmtNum = (v: number) => NUM.format(v);

export const fmtDiff = (v: number): string => {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${fmtPLN(v)}`;
};

export const fmtDiffPct = (v: number): string => {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
};

/** Recharts tooltip formatter — formats value as PLN currency. */
export const fmtTooltipPLN = (value: unknown) => fmtPLN(Number(value ?? 0));

const PLN = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 });
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const PCT = new Intl.NumberFormat('pl-PL', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NUM = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export const fmtPLN = (v: number) => PLN.format(v);
export const fmtUSD = (v: number) => USD.format(v);
export const fmtPct = (v: number) => PCT.format(v / 100);
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

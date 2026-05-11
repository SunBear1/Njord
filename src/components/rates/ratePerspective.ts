export interface BankPerspectiveRate {
  buy: number;
  sell: number;
}

export interface UserPerspectiveRate {
  buyingRate: number;
  sellingRate: number;
}

export function toUserPerspectiveRate(rate: BankPerspectiveRate): UserPerspectiveRate {
  return {
    buyingRate: rate.sell,
    sellingRate: rate.buy,
  };
}

export function formatSpreadPct(firstRate: number, secondRate: number): string {
  const avg = (firstRate + secondRate) / 2;
  if (!avg || !isFinite(avg)) return '—';
  return (Math.abs(firstRate - secondRate) / avg * 100).toFixed(2);
}

import type { CSSProperties } from 'react';

export interface BankPerspectiveRate {
  buy: number;
  sell: number;
}

export interface UserPerspectiveRate {
  buyingRate: number;
  sellingRate: number;
}

export type RateDirection = 'up' | 'down' | null;

export const RATE_CHANGE_ANIMATION = '2s ease-out forwards';

type RateAnimationStyle = CSSProperties & {
  '--rate-flash-color': string;
};

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

export function getRateAnimationStyle(
  dir: RateDirection,
  animationName: 'flash-fade' | 'value-pop',
): RateAnimationStyle | undefined {
  if (dir === null) return undefined;

  return {
    animation: `${animationName} ${RATE_CHANGE_ANIMATION}`,
    '--rate-flash-color': dir === 'up' ? 'var(--color-success)' : 'var(--color-danger)',
  };
}

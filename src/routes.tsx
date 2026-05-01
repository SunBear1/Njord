import { lazy } from 'react';
import { Navigate } from 'react-router-dom';

// Each lazy route adds a 16ms async gap via Promise.all to keep Suspense
// interruptible. Without this, prefetched modules resolve synchronously and
// React commits in one frame — blocking startTransition during rapid tab
// switching. 16ms = one frame; imperceptible but gives React a yield point.
const YIELD = () => new Promise<void>((r) => setTimeout(r, 16));

export const ComparisonPage = lazy(() => Promise.all([import('./pages/ComparisonPage'), YIELD()]).then(([m]) => m));
export const ForecastPage = lazy(() => Promise.all([import('./pages/ForecastPage'), YIELD()]).then(([m]) => m));
export const TaxPage = lazy(() => Promise.all([import('./pages/TaxPage'), YIELD()]).then(([m]) => m));
export const PortfolioPage = lazy(() => Promise.all([import('./pages/PortfolioPage'), YIELD()]).then(([m]) => m));
export const RatesPage = lazy(() => Promise.all([import('./pages/RatesPage'), YIELD()]).then(([m]) => m));

export function HomeRedirect() {
  return <Navigate to="/forecast" replace />;
}

export function CatchAllRedirect() {
  return <Navigate to="/forecast" replace />;
}

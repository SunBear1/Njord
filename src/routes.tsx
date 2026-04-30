import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { loadLastRoute } from './utils/routePersistence';

// HomePage loaded eagerly — it's the landing page, must be instant
export { HomePage } from './pages/HomePage';

export const ComparisonPage = lazy(() => import('./pages/ComparisonPage'));
export const ForecastPage = lazy(() => import('./pages/ForecastPage'));
export const TaxPage = lazy(() => import('./pages/TaxPage'));
export const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
export const RatesPage = lazy(() => import('./pages/RatesPage'));

export function CatchAllRedirect() {
  const lastRoute = loadLastRoute();
  return <Navigate to={lastRoute ?? '/'} replace />;
}

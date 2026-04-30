import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { Layout } from './components/Layout'
import { PageLoader } from './components/PageLoader'
import {
  HomePage,
  ComparisonPage,
  ForecastPage,
  TaxPage,
  PortfolioPage,
  RatesPage,
  CatchAllRedirect,
} from './routes'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="comparison" element={<Suspense fallback={<PageLoader />}><ComparisonPage /></Suspense>} />
          <Route path="forecast" element={<Suspense fallback={<PageLoader />}><ForecastPage /></Suspense>} />
          <Route path="tax" element={<Suspense fallback={<PageLoader />}><TaxPage /></Suspense>} />
          <Route path="portfolio" element={<Suspense fallback={<PageLoader />}><PortfolioPage /></Suspense>} />
          <Route path="rates" element={<Suspense fallback={<PageLoader />}><RatesPage /></Suspense>} />
          <Route path="*" element={<CatchAllRedirect />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)

// Inject Google Fonts asynchronously — keeps it off the critical render path.
// (Doing this in JS rather than via <link onload> in index.html avoids needing
// 'unsafe-inline' in the CSP script-src.)
// Trimmed to weights 400..700 (the only weights used) and roman axis only
// (italic is decorative; browser-synthesized slant is acceptable).
function loadFonts() {
  if (typeof document === 'undefined') return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400..700&display=swap';
  document.head.appendChild(link);
}
loadFonts();

// Prefetch lazy route chunks during idle time. Because routes use lazyWithYield
// (adds a 16ms async gap), even prefetched modules still go through Suspense on
// each navigation — making rapid tab switches interruptible by startTransition.
function prefetchRoutes() {
  const routes = [
    () => import('./pages/ComparisonPage'),
    () => import('./pages/ForecastPage'),
    () => import('./pages/TaxPage'),
    () => import('./pages/PortfolioPage'),
    () => import('./pages/RatesPage'),
  ];
  routes.forEach((load) => { void load(); });
}

if (typeof window !== 'undefined') {
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) {
    idle(prefetchRoutes, { timeout: 4000 });
  } else {
    setTimeout(prefetchRoutes, 2000);
  }
}

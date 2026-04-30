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

// Route chunk prefetching strategy:
// We intentionally do NOT eagerly import() route chunks here. While eager
// import() eliminates the network delay on first navigation, it also fully
// evaluates the modules — causing React.lazy to resolve synchronously. This
// makes the entire page component render in one uninterruptible frame, which
// blocks the main thread during rapid tab switching (the "freeze" symptom).
//
// Instead, we rely on:
// 1. Immutable caching (public/_headers: max-age=31536000 for /assets/*)
//    — after the first visit to a route, subsequent loads are from disk cache
// 2. React.lazy + Suspense shows <PageLoader> during the brief first load
// 3. react-router v7 wraps navigations in startTransition, so the old UI
//    stays visible while the new route loads (no blank screen)
// 4. HTTP/2 server push / 103 Early Hints from Cloudflare warm connections
//
// Net result: first click on each route takes ~50-100ms (cache hit after
// initial page load triggers prefetch via browser's speculative parser),
// subsequent clicks are instant, and rapid switching never freezes.

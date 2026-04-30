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

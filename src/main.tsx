import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { Layout } from './components/Layout'
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
      <Suspense fallback={null}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="comparison" element={<ComparisonPage />} />
            <Route path="forecast" element={<ForecastPage />} />
            <Route path="tax" element={<TaxPage />} />
            <Route path="portfolio" element={<PortfolioPage />} />
            <Route path="rates" element={<RatesPage />} />
            <Route path="*" element={<CatchAllRedirect />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)

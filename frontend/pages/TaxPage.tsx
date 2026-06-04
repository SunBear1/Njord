import { ErrorBoundary } from '../components/ErrorBoundary';
import { TaxCalculatorPanel } from '../components/TaxCalculatorPanel';
import { useCurrencyRates } from '../hooks/useCurrencyRates';

export function TaxPage() {
  const currencyRates = useCurrencyRates();

  return (
    <ErrorBoundary>
      <TaxCalculatorPanel currencyRates={currencyRates} />
    </ErrorBoundary>
  );
}

export default TaxPage;

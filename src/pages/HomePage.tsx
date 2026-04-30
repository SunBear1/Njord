import { Link } from 'react-router-dom';
import { BarChart3, Receipt, Sprout, TrendingUp, ArrowDownUp, ChevronRight } from 'lucide-react';

const FEATURES = [
  {
    to: '/comparison',
    icon: BarChart3,
    title: 'Porównanie inwestycji',
    description: 'Porównaj opłacalność akcji i ETF z kontem oszczędnościowym, obligacjami skarbowymi lub innym ETF.',
    accent: '#c9553d',
  },
  {
    to: '/forecast',
    icon: TrendingUp,
    title: 'Prognoza cenowa',
    description: 'Sprawdź rozkład prawdopodobnych cen akcji lub ETF w wybranym horyzoncie na podstawie danych historycznych.',
    accent: '#5c6daa',
  },
  {
    to: '/tax',
    icon: Receipt,
    title: 'Podatek Belki',
    description: 'Oblicz podatek od zysków kapitałowych (19%) dla wielu transakcji z automatycznym pobieraniem kursów NBP i grupowaniem PIT-38.',
    accent: '#7a5195',
  },
  {
    to: '/portfolio',
    icon: Sprout,
    title: 'Kreator portfela',
    description: 'Zaplanuj portfel pasywny na IKE, IKZE i rachunek maklerski z uwzględnieniem limitów rocznych.',
    accent: '#3d7a6a',
  },
  {
    to: '/rates',
    icon: ArrowDownUp,
    title: 'Kursy walut',
    description: 'Aktualne kursy kupna i sprzedaży USD, EUR i GBP z Alior Kantor i NBP.',
    accent: '#b87d2e',
  },
] as const;

export function HomePage() {
  return (
    <div className="max-w-4xl mx-auto pt-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {FEATURES.map(({ to, icon: Icon, title, description, accent }) => (
          <Link
            key={to}
            to={to}
            className="group relative block rounded-xl bg-white dark:bg-surface-alt border border-edge dark:border-edge overflow-hidden shadow-sm hover:shadow-lg transition-[color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div className="absolute inset-y-0 left-0 w-1.5 rounded-l-xl" style={{ backgroundColor: accent }} />

            <div className="flex items-start gap-4 p-6 pl-7">
              <div
                className="shrink-0 w-11 h-11 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: accent, color: '#ffffff' }}
              >
                <Icon size={22} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <h3 className="font-semibold text-heading dark:text-on-dark text-base group-hover:text-accent transition-colors">
                  {title}
                </h3>
                <p className="text-sm text-body dark:text-on-dark-muted leading-relaxed">
                  {description}
                </p>
              </div>
              <ChevronRight size={18} className="shrink-0 mt-1 text-faint group-hover:text-accent transition-colors" aria-hidden="true" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default HomePage;

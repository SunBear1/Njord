import { Link } from 'react-router-dom';
import { BarChart3, Receipt, Sprout, TrendingUp } from 'lucide-react';

const FEATURES = [
  {
    to: '/comparison',
    icon: BarChart3,
    title: 'Porównanie inwestycji',
    description: 'Porównaj opłacalność akcji i ETF z kontem oszczędnościowym, obligacjami skarbowymi lub innym ETF.',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
  },
  {
    to: '/forecast',
    icon: TrendingUp,
    title: 'Prognoza cenowa',
    description: 'Sprawdź rozkład prawdopodobnych cen akcji lub ETF w wybranym horyzoncie na podstawie danych historycznych.',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  {
    to: '/tax',
    icon: Receipt,
    title: 'Podatek Belki',
    description: 'Oblicz podatek od zysków kapitałowych (19%) dla wielu transakcji z automatycznym pobieraniem kursów NBP i grupowaniem PIT-38.',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
  },
  {
    to: '/portfolio',
    icon: Sprout,
    title: 'Kreator portfela',
    description: 'Zaplanuj portfel pasywny na IKE, IKZE i rachunek maklerski z uwzględnieniem limitów rocznych.',
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    border: 'border-violet-200 dark:border-violet-800',
  },
] as const;

export function HomePage() {
  return (
    <div className="max-w-4xl mx-auto pt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FEATURES.map(({ to, icon: Icon, title, description, color, bg, border }) => (
          <Link
            key={to}
            to={to}
            className={`group block rounded-xl border ${border} ${bg} p-6 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400`}
          >
            <div className="flex items-start gap-4">
              <div className={`shrink-0 p-2.5 rounded-lg ${color} bg-white/60 dark:bg-white/10`}>
                <Icon size={24} aria-hidden="true" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <h3 className="font-semibold text-text-primary group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                  {title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default HomePage;

import { memo, useMemo } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { fmtTooltipPLN } from '../../utils/formatting';

interface PortfolioAllocationChartProps {
  stockValuePLN: number;
  bondValuePLN: number;
  savingsValuePLN: number;
}

const chartColors = {
  stocks: 'var(--color-chart-stocks)',
  bonds: 'var(--color-chart-bonds)',
  savings: 'var(--color-chart-savings)',
  tooltipBackground: 'var(--color-bg-card)',
  tooltipBorder: 'var(--color-border)',
  tooltipText: 'var(--color-text-primary)',
} as const;

function PortfolioAllocationChart({ stockValuePLN, bondValuePLN, savingsValuePLN }: PortfolioAllocationChartProps) {
  const data = useMemo(
    () => [
      { name: 'Akcje i ETF', value: stockValuePLN, color: chartColors.stocks },
      { name: 'Obligacje', value: bondValuePLN, color: chartColors.bonds },
      { name: 'Oszczędności', value: savingsValuePLN, color: chartColors.savings },
    ].filter((slice) => slice.value > 0),
    [stockValuePLN, bondValuePLN, savingsValuePLN],
  );

  if (data.length === 0) {
    return (
      <div className="bg-bg-card rounded-xl border border-border shadow-sm p-5 flex items-center justify-center text-sm text-text-muted h-full">
        Brak danych do wyświetlenia alokacji.
      </div>
    );
  }

  return (
    <div className="bg-bg-card rounded-xl border border-border shadow-sm p-5">
      <h3 className="text-base font-semibold text-text-primary mb-2">Alokacja portfela</h3>
      <ResponsiveContainer width="100%" height={220} debounce={32}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
            {data.map((slice) => (
              <Cell key={slice.name} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={fmtTooltipPLN}
            contentStyle={{
              backgroundColor: chartColors.tooltipBackground,
              borderColor: chartColors.tooltipBorder,
              borderRadius: '8px',
              color: chartColors.tooltipText,
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(PortfolioAllocationChart);

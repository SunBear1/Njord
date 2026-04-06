import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { ValueType } from 'recharts/types/component/DefaultTooltipContent';
import type { TimelinePoint } from '../utils/calculations';
import { fmtPLN } from '../utils/formatting';

interface TimelineChartProps {
  data: TimelinePoint[];
  currentValuePLN: number;
  benchmarkLabel: string;
}

const fmtTooltip = (value: ValueType | undefined) => fmtPLN(Number(value ?? 0));

export function TimelineChart({ data, currentValuePLN, benchmarkLabel }: TimelineChartProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
      <h3 className="text-base font-semibold text-gray-800">Wartość w czasie</h3>
      <p className="text-xs text-gray-500">Prognozowana wartość portfela przez cały horyzont (netto po Belce)</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="month"
            tickFormatter={(v) => `${v}m`}
            tick={{ fontSize: 12 }}
            label={{ value: 'Miesiące', position: 'insideBottom', offset: -5, fontSize: 12, fill: '#6b7280' }}
          />
          <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={fmtTooltip}
            labelFormatter={(v) => `Miesiąc ${v}`}
          />
          <Legend />
          <ReferenceLine y={currentValuePLN} stroke="#94a3b8" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="benchmark" name={benchmarkLabel} stroke="#8b5cf6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="bear" name="Bear" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 3" />
          <Line type="monotone" dataKey="base" name="Base" stroke="#f59e0b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="bull" name="Bull" stroke="#22c55e" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

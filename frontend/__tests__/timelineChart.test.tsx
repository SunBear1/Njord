import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import TimelineChart from '../components/TimelineChart';

type MockProps = Record<string, unknown> & { children?: ReactNode };

const renderedLines: Array<Record<string, unknown>> = [];
const renderedReferenceLines: Array<Record<string, unknown>> = [];

function createWrapper(tagName: string) {
  return function Wrapper({ children, ...props }: MockProps) {
    return <div data-tag={tagName} data-props={JSON.stringify(props)}>{children}</div>;
  };
}

vi.mock('recharts', () => ({
  LineChart: createWrapper('line-chart'),
  XAxis: createWrapper('x-axis'),
  YAxis: createWrapper('y-axis'),
  CartesianGrid: createWrapper('cartesian-grid'),
  Tooltip: createWrapper('tooltip'),
  Legend: createWrapper('legend'),
  ResponsiveContainer: createWrapper('responsive-container'),
  Line: (props: Record<string, unknown>) => {
    renderedLines.push(props);
    return <div data-tag="line" data-props={JSON.stringify(props)} />;
  },
  ReferenceLine: (props: Record<string, unknown>) => {
    renderedReferenceLines.push(props);
    return <div data-tag="reference-line" data-props={JSON.stringify(props)} />;
  },
}));

function renderChart(inflationRate: number) {
  renderedLines.length = 0;
  renderedReferenceLines.length = 0;

  renderToStaticMarkup(
    <TimelineChart
      data={[
        { month: 0, benchmark: 10_000, bear: 9_200, base: 10_000, bull: 10_800 },
        { month: 12, benchmark: 10_600, bear: 8_900, base: 10_700, bull: 12_300 },
      ]}
      currentValuePLN={10_000}
      benchmarkLabel="ETF"
      inflationRate={inflationRate}
    />,
  );

  return {
    lines: [...renderedLines],
    referenceLines: [...renderedReferenceLines],
  };
}

function findLine(lines: Array<Record<string, unknown>>, dataKey: string) {
  return lines.find((line) => line.dataKey === dataKey);
}

describe('TimelineChart', () => {
  it('TestTimelineChart_WhenInflationPositive_ExpectsFiveVisibleSeriesAndNoReferenceLine', () => {
    const { lines, referenceLines } = renderChart(4.5);

    expect(referenceLines).toHaveLength(0);
    expect(lines).toHaveLength(5);
    expect(findLine(lines, 'benchmark')).toMatchObject({
      name: 'ETF',
      stroke: 'var(--color-chart-comparison-benchmark)',
    });
    expect(findLine(lines, 'bear')).toMatchObject({
      name: 'Bear',
      stroke: 'var(--color-chart-comparison-bear)',
    });
    expect(findLine(lines, 'base')).toMatchObject({
      name: 'Base',
      stroke: 'var(--color-chart-comparison-base)',
    });
    expect(findLine(lines, 'bull')).toMatchObject({
      name: 'Bull',
      stroke: 'var(--color-chart-comparison-bull)',
    });
    expect(findLine(lines, 'purchasingPower')).toMatchObject({
      name: 'Siła nabywcza',
      stroke: 'var(--color-chart-comparison-purchasing-power)',
      strokeDasharray: '6 3',
    });
  });

  it('TestTimelineChart_WhenInflationZero_ExpectsOnlyScenarioAndBenchmarkLines', () => {
    const { lines, referenceLines } = renderChart(0);

    expect(referenceLines).toHaveLength(0);
    expect(lines).toHaveLength(4);
    expect(findLine(lines, 'purchasingPower')).toBeUndefined();
  });
});

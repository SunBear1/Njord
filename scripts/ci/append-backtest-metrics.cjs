'use strict';
const fs = require('fs');

const metrics = JSON.parse(fs.readFileSync('backtest-metrics.json', 'utf8'));
const csvFile = 'backtest-history.csv';
const header = 'date,coverage_pct,above_bull_pct,below_bear_pct,bias_ratio,base_mae_pp,stocks,overall,regime,worst_sector,worst_sector_coverage_pct';
const row = [
  metrics.date,
  metrics.coverage_pct,
  metrics.above_bull_pct,
  metrics.below_bear_pct,
  metrics.bias_ratio,
  metrics.base_mae_pp,
  metrics.stocks,
  metrics.overall,
  metrics.regime ?? '',
  metrics.worst_sector ?? '',
  metrics.worst_sector_coverage_pct ?? 0,
].join(',');

if (!fs.existsSync(csvFile)) {
  fs.writeFileSync(csvFile, header + '\n');
}
fs.appendFileSync(csvFile, row + '\n');
process.stdout.write('Appended: ' + row + '\n');

-- NBP Inflation Forecast — most recent projection from "Raport o inflacji"
-- Published 3x/year: March, July, November
-- Last updated: 2025-11 (November 2025 report)
-- Source: https://nbp.pl/polityka-pieniezna/dokumenty-rpp/raporty-o-inflacji/

INSERT OR REPLACE INTO inflation_forecasts (report_date, forecast_year, forecast_quarter, central_path_pct, lower_50_pct, upper_50_pct, lower_90_pct, upper_90_pct)
VALUES
  ('2025-11', 2025, 4, 4.6, 4.2, 5.0, 3.8, 5.4),
  ('2025-11', 2026, 1, 4.2, 3.6, 4.8, 3.0, 5.4),
  ('2025-11', 2026, 2, 3.5, 2.8, 4.2, 2.1, 4.9),
  ('2025-11', 2026, 3, 3.0, 2.2, 3.8, 1.4, 4.6),
  ('2025-11', 2026, 4, 2.8, 1.9, 3.7, 1.0, 4.6),
  ('2025-11', 2027, 1, 2.7, 1.7, 3.7, 0.7, 4.7),
  ('2025-11', 2027, 2, 2.6, 1.5, 3.7, 0.4, 4.8),
  ('2025-11', 2027, 3, 2.5, 1.3, 3.7, 0.1, 4.9);

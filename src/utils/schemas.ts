/**
 * Zod schemas for validating external API responses.
 *
 * Used as lightweight runtime guards in hooks and Pages Functions to detect
 * upstream API contract changes early. All schemas are permissive (passthrough)
 * on extra fields — only the fields we actually use are validated.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Yahoo Finance — /v8/finance/chart/:ticker
// ---------------------------------------------------------------------------

const YahooMetaSchema = z.object({
  symbol: z.string(),
  regularMarketPrice: z.number().finite().positive(),
  currency: z.string().min(3).max(4),
  shortName: z.string().optional(),
  longName: z.string().optional(),
  quoteType: z.string().optional(),
});

const YahooResultSchema = z.object({
  meta: YahooMetaSchema,
  timestamp: z.array(z.number()).optional(),
  indicators: z
    .object({
      adjclose: z.array(
        z.object({
          adjclose: z.array(z.number().nullable()),
        }),
      ),
    })
    .optional(),
});

export const YahooChartResponseSchema = z.object({
  chart: z.object({
    result: z.array(YahooResultSchema).nullable().optional(),
    error: z
      .object({ code: z.string(), description: z.string() })
      .nullable()
      .optional(),
  }),
});

export type YahooChartResponse = z.infer<typeof YahooChartResponseSchema>;

// ---------------------------------------------------------------------------
// NBP Table A — /api/exchangerates/rates/a/:currency/:from/:to/
// ---------------------------------------------------------------------------

const NbpRateEntrySchema = z.object({
  no: z.string(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mid: z.number().finite().positive(),
});

const NbpTableAEntrySchema = z.object({
  table: z.string(),
  currency: z.string(),
  code: z.string(),
  rates: z.array(NbpRateEntrySchema).min(1),
});

export const NbpTableAResponseSchema = z.array(NbpTableAEntrySchema).min(1);
export type NbpTableAResponse = z.infer<typeof NbpTableAResponseSchema>;

// ---------------------------------------------------------------------------
// NBP Table C — /api/exchangerates/rates/c/:currency/
// ---------------------------------------------------------------------------

const NbpRateEntryCSchema = z.object({
  no: z.string(),
  effectiveDate: z.string(),
  bid: z.number().finite().positive(),
  ask: z.number().finite().positive(),
});

const NbpTableCEntrySchema = z.object({
  table: z.string(),
  currency: z.string(),
  code: z.string(),
  rates: z.array(NbpRateEntryCSchema).min(1),
});

export const NbpTableCResponseSchema = z.array(NbpTableCEntrySchema).min(1);
export type NbpTableCResponse = z.infer<typeof NbpTableCResponseSchema>;

// ---------------------------------------------------------------------------
// Alior Kantor — /api/public/marketBrief/:pair
// ---------------------------------------------------------------------------

export const AliorKantorResponseSchema = z.object({
  forexNow: z.number().finite().positive().optional(),
  sellNow: z.number().finite().positive().optional(),
  buyNow: z.number().finite().positive().optional(),
});
export type AliorKantorResponse = z.infer<typeof AliorKantorResponseSchema>;

// ---------------------------------------------------------------------------
// ECB HICP CPI — data-api.ecb.europa.eu
// ---------------------------------------------------------------------------

export const EcbCpiResponseSchema = z.object({
  dataSets: z.array(
    z.object({
      series: z.record(
        z.string(),
        z.object({
          observations: z.record(z.string(), z.array(z.number().nullable())),
        }),
      ),
    }),
  ).min(1),
  structure: z
    .object({
      dimensions: z
        .object({
          observation: z.array(z.object({ values: z.array(z.object({ id: z.string() })) })),
        })
        .optional(),
    })
    .optional(),
});
export type EcbCpiResponse = z.infer<typeof EcbCpiResponseSchema>;

// ---------------------------------------------------------------------------
// Persisted state schemas (IMP-014)
// ---------------------------------------------------------------------------

/** Subset of TaxTransaction fields that are persisted to localStorage.
 * Omits transient loading/error state that should not be stored. */
const TaxTransactionSchema = z.object({
  id: z.string(),
  tradeType: z.literal('sale'),
  acquisitionMode: z.enum(['purchase', 'grant', 'other_zero_cost']),
  zeroCostFlag: z.boolean(),
  saleDate: z.string(),
  acquisitionDate: z.string().optional(),
  currency: z.string().min(2).max(4),
  saleGrossAmount: z.number().finite().nonnegative(),
  acquisitionCostAmount: z.number().finite().nonnegative().optional(),
  saleBrokerFee: z.number().finite().nonnegative().optional(),
  acquisitionBrokerFee: z.number().finite().nonnegative().optional(),
  exchangeRateSaleToPLN: z.number().finite().positive().nullable(),
  exchangeRateAcquisitionToPLN: z.number().finite().positive().nullable().optional(),
  rateSaleEffectiveDate: z.string().optional(),
  rateAcquisitionEffectiveDate: z.string().optional(),
  ticker: z.string().optional(),
  tickerName: z.string().optional(),
  showCommissions: z.boolean().optional(),
  importSource: z.string().optional(),
});

export const TaxTransactionsSchema = z.array(TaxTransactionSchema);
export type PersistedTaxTransaction = z.infer<typeof TaxTransactionSchema>;

/** Validate a parsed object with a Zod schema. Returns data on success, null on failure. */
export function safeParse<T>(schema: z.ZodType<T>, data: unknown): T | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}

/** Returns a human-readable error string from a ZodError, truncated. */
export function zodErrorSummary(schema: z.ZodType<unknown>, data: unknown): string {
  const result = schema.safeParse(data);
  if (result.success) return '';
  const issues = result.error.issues.slice(0, 3);
  return issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

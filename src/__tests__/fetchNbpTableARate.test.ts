import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchNbpTableARate } from '../utils/fetchNbpTableARate';

// Mock fetchWithTimeout so tests never hit the real NBP API.
vi.mock('../utils/fetchWithTimeout', () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchWithTimeout } from '../utils/fetchWithTimeout';

const mockedFetch = vi.mocked(fetchWithTimeout);

/** Helper: build a mock Response with JSON body. */
function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function errorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: 'mocked' }),
  } as unknown as Response;
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ─── PLN passthrough ──────────────────────────────────────────────────────────

describe('PLN passthrough', () => {
  it('returns rate=1 without API call for PLN currency', async () => {
    const result = await fetchNbpTableARate('2025-04-10', 'PLN');
    expect(result).toEqual({ rate: 1, effectiveDate: '2025-04-10' });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('handles lowercase pln', async () => {
    const result = await fetchNbpTableARate('2025-04-10', 'pln');
    expect(result).toEqual({ rate: 1, effectiveDate: '2025-04-10' });
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});

// ─── URL construction (date window) ──────────────────────────────────────────

describe('date window in request URL', () => {
  it('queries day before transaction date as endDate (weekday)', async () => {
    // 2025-04-10 is Thursday → endDate should be 2025-04-09 (Wednesday)
    mockedFetch.mockResolvedValueOnce(
      okResponse({ rates: [{ mid: 4.0215, effectiveDate: '2025-04-09' }] }),
    );

    await fetchNbpTableARate('2025-04-10', 'USD');

    const url = mockedFetch.mock.calls[0][0];
    expect(url).toContain('/usd/');
    expect(url).toContain('/2025-04-09/'); // endDate = day before tx
    expect(url).toContain('format=json');
  });

  it('queries 14-day lookback window for Monday transaction', async () => {
    // 2025-04-14 is Monday → endDate 2025-04-13 (Sunday), startDate 2025-03-31
    // NBP API returns only business days, so last entry will be Friday 2025-04-11
    mockedFetch.mockResolvedValueOnce(
      okResponse({
        rates: [
          { mid: 4.0100, effectiveDate: '2025-04-07' },
          { mid: 4.0150, effectiveDate: '2025-04-08' },
          { mid: 4.0200, effectiveDate: '2025-04-09' },
          { mid: 4.0250, effectiveDate: '2025-04-10' },
          { mid: 4.0300, effectiveDate: '2025-04-11' },
        ],
      }),
    );

    const result = await fetchNbpTableARate('2025-04-14', 'USD');

    // Should pick the last entry (Friday's rate) as the most recent business day
    expect(result.rate).toBe(4.03);
    expect(result.effectiveDate).toBe('2025-04-11');
  });

  it('uses lowercase currency code in URL', async () => {
    mockedFetch.mockResolvedValueOnce(
      okResponse({ rates: [{ mid: 4.50, effectiveDate: '2025-04-09' }] }),
    );

    await fetchNbpTableARate('2025-04-10', 'EUR');

    const url = mockedFetch.mock.calls[0][0];
    expect(url).toContain('/eur/');
  });
});

// ─── Successful rate extraction ──────────────────────────────────────────────

describe('successful rate extraction', () => {
  it('returns last rate entry from NBP response', async () => {
    mockedFetch.mockResolvedValueOnce(
      okResponse({
        rates: [
          { mid: 4.0100, effectiveDate: '2025-04-07' },
          { mid: 4.0215, effectiveDate: '2025-04-09' },
        ],
      }),
    );

    const result = await fetchNbpTableARate('2025-04-10', 'USD');

    expect(result.rate).toBe(4.0215);
    expect(result.effectiveDate).toBe('2025-04-09');
  });

  it('returns single-entry rate', async () => {
    mockedFetch.mockResolvedValueOnce(
      okResponse({ rates: [{ mid: 3.9785, effectiveDate: '2025-04-09' }] }),
    );

    const result = await fetchNbpTableARate('2025-04-10', 'CHF');
    expect(result.rate).toBe(3.9785);
  });

  it('defaults currency to USD when omitted', async () => {
    mockedFetch.mockResolvedValueOnce(
      okResponse({ rates: [{ mid: 4.05, effectiveDate: '2025-04-09' }] }),
    );

    await fetchNbpTableARate('2025-04-10');

    const url = mockedFetch.mock.calls[0][0];
    expect(url).toContain('/usd/');
  });
});

// ─── Input validation ─────────────────────────────────────────────────────────

describe('input validation', () => {
  it('throws on empty date', async () => {
    await expect(fetchNbpTableARate('', 'USD')).rejects.toThrow('Brak daty transakcji.');
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('throws on invalid date format', async () => {
    await expect(fetchNbpTableARate('not-a-date', 'USD')).rejects.toThrow(
      'Nieprawidłowy format daty.',
    );
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('error handling', () => {
  it('throws Polish error on 404 (currency not found)', async () => {
    mockedFetch.mockResolvedValueOnce(errorResponse(404));

    await expect(fetchNbpTableARate('2025-04-10', 'XYZ')).rejects.toThrow(
      'Brak kursu NBP dla waluty XYZ',
    );
  });

  it('throws HTTP error for non-404 failures', async () => {
    mockedFetch.mockResolvedValueOnce(errorResponse(500));

    await expect(fetchNbpTableARate('2025-04-10', 'USD')).rejects.toThrow(
      'Błąd NBP (HTTP 500)',
    );
  });

  it('throws network error on fetch failure', async () => {
    mockedFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(fetchNbpTableARate('2025-04-10', 'USD')).rejects.toThrow(
      'Błąd sieci',
    );
  });

  it('re-throws AbortError without wrapping', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    mockedFetch.mockRejectedValueOnce(abortError);

    await expect(fetchNbpTableARate('2025-04-10', 'USD')).rejects.toThrow(abortError);
  });

  it('throws on empty rates array', async () => {
    mockedFetch.mockResolvedValueOnce(okResponse({ rates: [] }));

    await expect(fetchNbpTableARate('2025-04-10', 'USD')).rejects.toThrow(
      'NBP nie zwróciło kursów',
    );
  });

  it('throws on missing rates field', async () => {
    mockedFetch.mockResolvedValueOnce(okResponse({}));

    await expect(fetchNbpTableARate('2025-04-10', 'USD')).rejects.toThrow(
      'NBP nie zwróciło kursów',
    );
  });

  it('throws on NaN mid rate', async () => {
    mockedFetch.mockResolvedValueOnce(
      okResponse({ rates: [{ mid: NaN, effectiveDate: '2025-04-09' }] }),
    );

    await expect(fetchNbpTableARate('2025-04-10', 'USD')).rejects.toThrow(
      'NBP zwróciło nieprawidłowy kurs',
    );
  });

  it('throws on zero mid rate', async () => {
    mockedFetch.mockResolvedValueOnce(
      okResponse({ rates: [{ mid: 0, effectiveDate: '2025-04-09' }] }),
    );

    await expect(fetchNbpTableARate('2025-04-10', 'USD')).rejects.toThrow(
      'NBP zwróciło nieprawidłowy kurs',
    );
  });

  it('throws on negative mid rate', async () => {
    mockedFetch.mockResolvedValueOnce(
      okResponse({ rates: [{ mid: -3.5, effectiveDate: '2025-04-09' }] }),
    );

    await expect(fetchNbpTableARate('2025-04-10', 'USD')).rejects.toThrow(
      'NBP zwróciło nieprawidłowy kurs',
    );
  });

  it('throws on Infinity mid rate', async () => {
    mockedFetch.mockResolvedValueOnce(
      okResponse({ rates: [{ mid: Infinity, effectiveDate: '2025-04-09' }] }),
    );

    await expect(fetchNbpTableARate('2025-04-10', 'USD')).rejects.toThrow(
      'NBP zwróciło nieprawidłowy kurs',
    );
  });
});

// ─── AbortSignal propagation ──────────────────────────────────────────────────

describe('AbortSignal propagation', () => {
  it('passes signal to fetchWithTimeout', async () => {
    const controller = new AbortController();
    mockedFetch.mockResolvedValueOnce(
      okResponse({ rates: [{ mid: 4.0, effectiveDate: '2025-04-09' }] }),
    );

    await fetchNbpTableARate('2025-04-10', 'USD', controller.signal);

    expect(mockedFetch.mock.calls[0][1]).toBe(controller.signal);
  });

  it('uses 8-second timeout', async () => {
    mockedFetch.mockResolvedValueOnce(
      okResponse({ rates: [{ mid: 4.0, effectiveDate: '2025-04-09' }] }),
    );

    await fetchNbpTableARate('2025-04-10', 'USD');

    expect(mockedFetch.mock.calls[0][2]).toBe(8_000);
  });
});

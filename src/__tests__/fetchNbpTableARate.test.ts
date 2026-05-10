import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchNbpTableARate } from '../utils/fetchNbpTableARate';

const mockedFetch = vi.fn<typeof fetch>();

afterEach(() => {
  vi.unstubAllGlobals();
});

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
  mockedFetch.mockReset();
  vi.stubGlobal('fetch', mockedFetch);
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

// ─── Proxy request URL ────────────────────────────────────────────────────────

describe('proxy request URL', () => {
  it('calls backend rate endpoint with date and currency params', async () => {
    mockedFetch.mockResolvedValueOnce(
      okResponse({ ok: true, data: { rate: 4.0215, effectiveDate: '2025-04-09' } }),
    );

    await fetchNbpTableARate('2025-04-10', 'USD');

    expect(mockedFetch).toHaveBeenCalledWith(
      '/api/v1/finance/currency/rate?date=2025-04-10&currency=USD',
      { signal: undefined },
    );
  });

  it('uses uppercase currency code in URL', async () => {
    mockedFetch.mockResolvedValueOnce(
      okResponse({ ok: true, data: { rate: 4.5, effectiveDate: '2025-04-09' } }),
    );

    await fetchNbpTableARate('2025-04-10', 'eur');

    expect(mockedFetch.mock.calls[0][0]).toBe(
      '/api/v1/finance/currency/rate?date=2025-04-10&currency=EUR',
    );
  });
});

// ─── Successful rate extraction ──────────────────────────────────────────────

describe('successful rate extraction', () => {
  it('returns rate and effectiveDate from backend response', async () => {
    mockedFetch.mockResolvedValueOnce(
      okResponse({ ok: true, data: { rate: 4.0215, effectiveDate: '2025-04-09' } }),
    );

    const result = await fetchNbpTableARate('2025-04-10', 'USD');

    expect(result.rate).toBe(4.0215);
    expect(result.effectiveDate).toBe('2025-04-09');
  });

  it('returns single rate entry', async () => {
    mockedFetch.mockResolvedValueOnce(
      okResponse({ ok: true, data: { rate: 3.9785, effectiveDate: '2025-04-09' } }),
    );

    const result = await fetchNbpTableARate('2025-04-10', 'CHF');
    expect(result.rate).toBe(3.9785);
  });

  it('defaults currency to USD when omitted', async () => {
    mockedFetch.mockResolvedValueOnce(
      okResponse({ ok: true, data: { rate: 4.05, effectiveDate: '2025-04-09' } }),
    );

    await fetchNbpTableARate('2025-04-10');

    expect(mockedFetch.mock.calls[0][0]).toBe(
      '/api/v1/finance/currency/rate?date=2025-04-10&currency=USD',
    );
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
  it('throws backend error on non-2xx response', async () => {
    mockedFetch.mockResolvedValueOnce(
      errorResponse(404),
    );

    await expect(fetchNbpTableARate('2025-04-10', 'XYZ')).rejects.toThrow('mocked');
  });

  it('throws HTTP fallback error for non-2xx failures without backend message', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    } as Response);

    await expect(fetchNbpTableARate('2025-04-10', 'USD')).rejects.toThrow(
      'Błąd pobierania kursu waluty (HTTP 500).',
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

  it('throws on backend response with ok=false', async () => {
    mockedFetch.mockResolvedValueOnce(okResponse({ ok: false, error: 'Brak kursu dla tej daty.' }));

    await expect(fetchNbpTableARate('2025-04-10', 'USD')).rejects.toThrow(
      'Brak kursu dla tej daty.',
    );
  });

  it('throws fallback error on missing data payload', async () => {
    mockedFetch.mockResolvedValueOnce(okResponse({ ok: true }));

    await expect(fetchNbpTableARate('2025-04-10', 'USD')).rejects.toThrow(
      'Nie udało się pobrać kursu USD dla daty 2025-04-10.',
    );
  });

  it('throws on NaN rate', async () => {
    mockedFetch.mockResolvedValueOnce(
      okResponse({ ok: true, data: { rate: NaN, effectiveDate: '2025-04-09' } }),
    );

    await expect(fetchNbpTableARate('2025-04-10', 'USD')).rejects.toThrow(
      'Serwer zwrócił nieprawidłowy kurs waluty.',
    );
  });

  it('throws on zero rate', async () => {
    mockedFetch.mockResolvedValueOnce(
      okResponse({ ok: true, data: { rate: 0, effectiveDate: '2025-04-09' } }),
    );

    await expect(fetchNbpTableARate('2025-04-10', 'USD')).rejects.toThrow(
      'Serwer zwrócił nieprawidłowy kurs waluty.',
    );
  });

  it('throws on negative rate', async () => {
    mockedFetch.mockResolvedValueOnce(
      okResponse({ ok: true, data: { rate: -3.5, effectiveDate: '2025-04-09' } }),
    );

    await expect(fetchNbpTableARate('2025-04-10', 'USD')).rejects.toThrow(
      'Serwer zwrócił nieprawidłowy kurs waluty.',
    );
  });

  it('throws on Infinity rate', async () => {
    mockedFetch.mockResolvedValueOnce(
      okResponse({ ok: true, data: { rate: Infinity, effectiveDate: '2025-04-09' } }),
    );

    await expect(fetchNbpTableARate('2025-04-10', 'USD')).rejects.toThrow(
      'Serwer zwrócił nieprawidłowy kurs waluty.',
    );
  });

  it('throws on invalid JSON body', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('invalid json')),
    } as Response);

    await expect(fetchNbpTableARate('2025-04-10', 'USD')).rejects.toThrow(
      'Błąd odpowiedzi serwera kursów walut. Spróbuj ponownie.',
    );
  });
});

// ─── AbortSignal propagation ──────────────────────────────────────────────────

describe('AbortSignal propagation', () => {
  it('passes signal to fetch', async () => {
    const controller = new AbortController();
    mockedFetch.mockResolvedValueOnce(
      okResponse({ ok: true, data: { rate: 4.0, effectiveDate: '2025-04-09' } }),
    );

    await fetchNbpTableARate('2025-04-10', 'USD', controller.signal);

    expect(mockedFetch.mock.calls[0][1]).toEqual({ signal: controller.signal });
  });
});

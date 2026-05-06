import { describe, expect, it } from 'vitest';

import { shouldServeSpaShell } from '../../functions/[[path]]';

function createRequest(
  pathname: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
  },
): Request {
  return new Request(`https://example.com${pathname}`, {
    method: options?.method ?? 'GET',
    headers: options?.headers,
  });
}

describe('shouldServeSpaShell', () => {
  it('TestShouldServeSpaShell_WhenNavigationRequest_ExpectsTrue', () => {
    const request = createRequest('/comparison', {
      headers: {
        'Sec-Fetch-Mode': 'navigate',
      },
    });

    expect(shouldServeSpaShell(request)).toBe(true);
  });

  it('TestShouldServeSpaShell_WhenHtmlAcceptHeaderWithoutExtension_ExpectsTrue', () => {
    const request = createRequest('/forecast', {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    expect(shouldServeSpaShell(request)).toBe(true);
  });

  it('TestShouldServeSpaShell_WhenApiRequest_ExpectsFalse', () => {
    const request = createRequest('/api/v1/healthz', {
      headers: {
        'Sec-Fetch-Mode': 'navigate',
      },
    });

    expect(shouldServeSpaShell(request)).toBe(false);
  });

  it('TestShouldServeSpaShell_WhenStaticAssetRequest_ExpectsFalse', () => {
    const request = createRequest('/assets/index-B1j2k3.js', {
      headers: {
        'Sec-Fetch-Mode': 'navigate',
      },
    });

    expect(shouldServeSpaShell(request)).toBe(false);
  });

  it('TestShouldServeSpaShell_WhenNonGetRequest_ExpectsFalse', () => {
    const request = createRequest('/comparison', {
      method: 'POST',
      headers: {
        'Sec-Fetch-Mode': 'navigate',
      },
    });

    expect(shouldServeSpaShell(request)).toBe(false);
  });
});

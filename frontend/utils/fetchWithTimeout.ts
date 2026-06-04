/**
 * fetch() wrapper with a timeout. Aborts if the request takes longer
 * than `timeoutMs`. Also forwards an external AbortSignal (e.g. from
 * component unmount) so the request can be cancelled from outside.
 */
export function fetchWithTimeout(
  url: string,
  signal?: AbortSignal,
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

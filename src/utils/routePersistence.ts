const LAST_ROUTE_KEY = 'njord_last_route';
const VALID_ROUTES = ['/', '/comparison', '/forecast', '/tax', '/portfolio'];

export function saveLastRoute(path: string): void {
  try {
    if (VALID_ROUTES.includes(path)) {
      localStorage.setItem(LAST_ROUTE_KEY, path);
    }
  } catch { /* ignore */ }
}

export function loadLastRoute(): string | null {
  try {
    const route = localStorage.getItem(LAST_ROUTE_KEY);
    if (route && VALID_ROUTES.includes(route)) return route;
  } catch { /* ignore */ }
  return null;
}

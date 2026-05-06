const PUBLIC_FILE_PATTERN = /\/[^/?]+\.[^/]+$/;

export function shouldServeSpaShell(request: Request): boolean {
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return false;
  }

  if (url.pathname.startsWith('/api/')) {
    return false;
  }

  if (PUBLIC_FILE_PATTERN.test(url.pathname)) {
    return false;
  }

  if (request.headers.get('Sec-Fetch-Mode') === 'navigate') {
    return true;
  }

  return request.headers.get('Accept')?.includes('text/html') ?? false;
}

export const onRequest: PagesFunction = (context) => {
  if (!shouldServeSpaShell(context.request)) {
    return context.next();
  }

  return context.next('/');
};

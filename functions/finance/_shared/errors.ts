export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly upstream?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorResponse(error: ApiError): Response {
  return new Response(
    JSON.stringify({
      error: error.message,
      code: error.code,
      ...(error.upstream && { upstream: error.upstream }),
    }),
    {
      status: error.statusCode,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

export const BAD_REQUEST = (message: string) =>
  new ApiError(message, 400, 'BAD_REQUEST');

export const NOT_FOUND = (message: string) =>
  new ApiError(message, 404, 'NOT_FOUND');

export const UPSTREAM_ERROR = (message: string, upstream?: string) =>
  new ApiError(message, 502, 'UPSTREAM_ERROR', upstream);

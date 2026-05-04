/**
 * Shared types for auth Pages Functions.
 */

export interface AuthEnv {
  AUTH_DB: D1Database;
  JWT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  TWELVE_DATA_API_KEY?: string;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  name: string | null;
  avatar_url: string | null;
  email_verified: number;
  created_at: string;
  updated_at: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string | null;
  iat: number;
  exp: number;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  hasPassword: boolean;
  linkedProviders: string[];
}

export function errorResponse(code: string, message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonResponse(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

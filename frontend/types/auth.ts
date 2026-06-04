/** Public user info returned by auth endpoints. */
export interface User {
  id: string;
  email: string;
  name: string | null;
  hasPassword: boolean;
  linkedProviders: string[];
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthError {
  error: string;
  code: string;
}

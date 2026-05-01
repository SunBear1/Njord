import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-bg-hover dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">
          Wystąpił błąd podczas renderowania tego komponentu.
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="ml-2 underline hover:text-red-900 dark:hover:text-red-200"
          >
            Spróbuj ponownie
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

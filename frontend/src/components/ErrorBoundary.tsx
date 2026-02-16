import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#0d0e14]">
          <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-gray-400 text-sm mb-4 max-w-md text-center">
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

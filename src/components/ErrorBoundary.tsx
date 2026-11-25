import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Une erreur inattendue est survenue.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendlyMessage = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string; operationType?: string };
        if (parsed.error) {
          friendlyMessage = `Opération ${parsed.operationType ?? 'Firestore'} interrompue : ${parsed.error}`;
        }
      } catch {
        // Keep raw message if not JSON
      }

      return (
        <div className="min-h-screen bg-[#0B0A0D] text-[#F5F2F4] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#151318] border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-2xl font-editorial font-semibold text-white">
              Oups, quelque chose s’est bloqué
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed break-words">{friendlyMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition-colors"
            >
              Recharger l’application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

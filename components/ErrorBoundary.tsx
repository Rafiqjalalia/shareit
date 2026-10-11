'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isChunkError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      /Loading chunk .* failed/i.test(error?.message || '') ||
      /Loading CSS chunk .* failed/i.test(error?.message || '');

    return { hasError: true, error, isChunkError };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in ShaeIt:', error, errorInfo);

    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      /Loading chunk .* failed/i.test(error?.message || '') ||
      /Loading CSS chunk .* failed/i.test(error?.message || '');

    if (isChunkError && typeof window !== 'undefined') {
      const reloadKey = 'shaeit_chunk_reload_ts';
      const lastReload = sessionStorage.getItem(reloadKey);
      const now = Date.now();

      // If we haven't auto-reloaded in the last 15 seconds, auto reload to fetch new deployment
      if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
        sessionStorage.setItem(reloadKey, now.toString());
        window.location.reload();
      }
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, isChunkError: false });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      const isChunk = this.state.isChunkError;

      return (
        <div className="glass-panel p-8 rounded-2xl border border-rose-500/30 text-center space-y-4 my-6">
          {isChunk ? (
            <WifiOff className="w-12 h-12 text-amber-400 mx-auto animate-bounce" />
          ) : (
            <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto animate-bounce" />
          )}

          <h3 className="text-lg font-bold text-white">
            {isChunk ? 'New Update Available or Connection Interrupted' : this.props.fallbackTitle || 'Component Error Encountered'}
          </h3>

          <p className="text-xs text-slate-400 max-w-md mx-auto font-mono bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-rose-300">
            {isChunk
              ? 'A newer version was deployed or network connection dropped temporarily. Please refresh to load the latest application files.'
              : this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>

          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            {isChunk ? 'Refresh App Now' : 'Reload Component'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}
export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };
  public static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error('Uncaught error:', error, errorInfo); }
  private handleReset = () => { this.setState({ hasError: false, error: null }); window.location.reload(); };
  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-900 p-4 relative overflow-hidden">
           <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-orange-200 blur-[100px] opacity-60"></div>
           <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-200 blur-[100px] opacity-60"></div>
          <div className="bg-white/60 backdrop-blur-3xl border border-white/60 rounded-3xl p-10 max-w-lg w-full shadow-2xl text-center relative z-10 ring-1 ring-white/40">
            <div className="w-20 h-20 bg-red-100/80 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-200 shadow-sm"><AlertTriangle className="w-10 h-10 text-red-600" /></div>
            <h1 className="text-2xl font-bold mb-2 text-slate-900">Something went wrong</h1>
            <p className="text-slate-700 mb-6 text-sm leading-relaxed font-medium">The application encountered an unexpected state. <br/><span className="font-mono text-xs text-red-700 bg-red-100/50 px-2 py-1 rounded mt-2 inline-block border border-red-200">{this.state.error?.message || 'Unknown Error'}</span></p>
            <button onClick={this.handleReset} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 mx-auto"><RefreshCw className="w-4 h-4" /> Reload Application</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
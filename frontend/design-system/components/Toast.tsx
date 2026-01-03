import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { cn } from '../utils';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: Toast = {
      id,
      duration: 5000,
      ...toast,
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration
    if (newToast.duration) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 z-[100] flex flex-col gap-3 md:gap-4 md:max-w-sm md:w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
  const getTypeStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'border-emerald-500/30 bg-emerald-50/90 dark:bg-emerald-900/40';
      case 'error':
        return 'border-red-500/30 bg-red-50/90 dark:bg-red-900/40';
      case 'warning':
        return 'border-amber-500/30 bg-amber-50/90 dark:bg-amber-900/40';
      case 'info':
        return 'border-blue-500/30 bg-blue-50/90 dark:bg-blue-900/40';
      default:
        return 'border-slate-500/30 bg-white/90 dark:bg-slate-800/90';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />;
      default:
        return <Info className="h-5 w-5 text-slate-600 dark:text-slate-400 mt-0.5" />;
    }
  };

  const getAccentColor = () => {
    switch (toast.type) {
      case 'success': return 'bg-emerald-500';
      case 'error': return 'bg-red-500';
      case 'warning': return 'bg-amber-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div
      className={cn(
        'group pointer-events-auto flex items-start gap-4 p-4 rounded-xl border shadow-lg transition-all duration-300 animate-slide-in-right relative overflow-hidden backdrop-blur-md',
        getTypeStyles()
      )}
      role="alert"
    >
      {/* Side Accent Line */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", getAccentColor())}></div>

      <div className="flex-shrink-0 animate-pulse-slow relative z-10">
        {getIcon()}
      </div>

      <div className="flex-1 min-w-0 pt-0.5 relative z-10">
        <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight mb-1">
          {toast.title}
        </h4>
        {toast.description && (
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
            {toast.description}
          </p>
        )}
      </div>

      <button
        onClick={onClose}
        className="relative z-10 flex-shrink-0 -mr-1 -mt-1 p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-black/5 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Subtle Glow Effect */}
      <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none", getAccentColor())}></div>
    </div>
  );
};

export default ToastProvider;

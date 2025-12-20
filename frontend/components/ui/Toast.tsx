
import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  title: string;
  message?: string;
  type: ToastType;
  duration?: number;
  onDismiss: (id: string) => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const icons = {
  success: <CheckCircle className="w-5 h-5 text-green-500" />,
  error: <XCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />
};

const styles = {
  success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
};

const progressColors = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500'
};

export const Toast: React.FC<ToastProps> = ({ id, title, message, type, duration = 5000, onDismiss, action }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (duration === 0) return;

    const interval = 10;
    const steps = duration / interval;
    const decay = 100 / steps;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          handleDismiss();
          return 0;
        }
        return prev - decay;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(id), 300); // Wait for exit animation
  };

  return (
    <div
      role="alert"
      className={`
        relative overflow-hidden w-full max-w-sm rounded-lg border shadow-lg transition-all duration-300 transform
        ${styles[type]}
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
    >
      <div className="p-4 flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {icons[type]}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          {message && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {message}
            </p>
          )}
          
          {action && (
            <button
              onClick={action.onClick}
              className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100 underline hover:text-slate-700 dark:hover:text-slate-300"
            >
              {action.label}
            </button>
          )}
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-slate-400 hover:text-slate-500 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {duration > 0 && (
        <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-200 dark:bg-slate-700 opacity-50">
          <div 
            className={`h-full transition-all duration-75 ease-linear ${progressColors[type]}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};


import React, { createContext, useCallback, useState, ReactNode } from 'react';
import { ToastProps, ToastType } from '../components/ui/Toast';
import { ToastContainer } from '../components/ui/ToastContainer';

interface ToastOptions {
    message?: string;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface ToastContextType {
    toasts: ToastProps[];
    success: (title: string, options?: ToastOptions) => void;
    error: (title: string, options?: ToastOptions) => void;
    warning: (title: string, options?: ToastOptions) => void;
    info: (title: string, options?: ToastOptions) => void;
    dismiss: (id: string) => void;
    dismissAll: () => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastProps[]>([]);

    const addToast = useCallback((type: ToastType, title: string, options?: ToastOptions) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newToast: ToastProps = {
            id,
            title,
            message: options?.message,
            type,
            duration: options?.duration ?? 5000,
            onDismiss: dismiss,
            action: options?.action
        };

        setToasts((prev) => {
            // Limit to 5 toasts, remove oldest if needed
            const current = prev.length >= 5 ? prev.slice(1) : prev;
            return [...current, newToast];
        });
    }, []);

    const dismiss = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const dismissAll = useCallback(() => {
        setToasts([]);
    }, []);

    const success = useCallback((title: string, options?: ToastOptions) => addToast('success', title, options), [addToast]);
    const error = useCallback((title: string, options?: ToastOptions) => addToast('error', title, options), [addToast]);
    const warning = useCallback((title: string, options?: ToastOptions) => addToast('warning', title, options), [addToast]);
    const info = useCallback((title: string, options?: ToastOptions) => addToast('info', title, options), [addToast]);

    return (
        <ToastContext.Provider value={{ toasts, success, error, warning, info, dismiss, dismissAll }}>
            {children}
            <ToastContainer toasts={toasts} dismiss={dismiss} />
        </ToastContext.Provider>
    );
};

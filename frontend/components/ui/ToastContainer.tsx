
import React from 'react';
import { Toast, ToastProps } from './Toast';

interface ToastContainerProps {
    toasts: ToastProps[];
    dismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, dismiss }) => {
    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
            {toasts.map((toast) => (
                <div key={toast.id} className="pointer-events-auto">
                    <Toast {...toast} onDismiss={dismiss} />
                </div>
            ))}
        </div>
    );
};

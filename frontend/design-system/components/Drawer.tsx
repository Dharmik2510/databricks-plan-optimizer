import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    side?: 'left' | 'right';
    className?: string;
    overlayClassName?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
    isOpen,
    onClose,
    children,
    side = 'left',
    className = '',
    overlayClassName = '',
}) => {
    const drawerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Close on Escape key
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex" style={{ justifyContent: side === 'right' ? 'flex-end' : 'flex-start' }}>
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity ${overlayClassName}`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Drawer Content */}
            <div
                ref={drawerRef}
                className={`
          relative w-[80%] max-w-[300px] h-full bg-white dark:bg-slate-900 shadow-xl transform transition-transform duration-300 ease-in-out
          ${side === 'left' ? 'animate-slide-in-left' : 'animate-slide-in-right'}
          ${className}
        `}
                role="dialog"
                aria-modal="true"
            >
                {/* Close Button - Optional integration within children usually better, but good to have fallback/helper if needed. 
              For sidebar we generally don't need a close button if tapping outside works, but let's keep it flexible.
          */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 z-50 lg:hidden"
                    aria-label="Close menu"
                >
                    <X className="w-5 h-5" />
                </button>

                {children}
            </div>
        </div>,
        document.body
    );
};

import React, { HTMLAttributes } from 'react';
import { cn } from '../utils';
import { severityClasses, statusClasses, type SeverityLevel, type StatusType } from '../theme';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  severity?: SeverityLevel;
  status?: StatusType;
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  removable?: boolean;
  onRemove?: () => void;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant = 'default',
      severity,
      status,
      size = 'md',
      dot = false,
      removable = false,
      onRemove,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center font-medium rounded-full border transition-colors duration-200';

    // Severity takes precedence over variant
    const getSeverityClass = () => {
      if (severity) return severityClasses[severity];
      if (status) return statusClasses[status];
      return '';
    };

    const variants = {
      default: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600',
      success: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700',
      warning: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
      error: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
      info: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs gap-1',
      md: 'px-2.5 py-1 text-sm gap-1.5',
      lg: 'px-3 py-1.5 text-base gap-2',
    };

    const severityClass = getSeverityClass();
    const variantClass = severity || status ? '' : variants[variant];

    return (
      <span
        ref={ref}
        className={cn(
          baseStyles,
          severityClass || variantClass,
          sizes[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span className={cn(
            'rounded-full',
            size === 'sm' ? 'h-1.5 w-1.5' : size === 'md' ? 'h-2 w-2' : 'h-2.5 w-2.5',
            severity === 'LOW' && 'bg-green-500',
            severity === 'MEDIUM' && 'bg-amber-500',
            severity === 'HIGH' && 'bg-red-500',
            severity === 'CRITICAL' && 'bg-red-700',
            status === 'PROCESSING' && 'bg-blue-500 animate-pulse',
            status === 'COMPLETED' && 'bg-green-500',
            status === 'FAILED' && 'bg-red-500',
            status === 'PENDING' && 'bg-gray-500',
            !severity && !status && variant === 'success' && 'bg-green-500',
            !severity && !status && variant === 'warning' && 'bg-amber-500',
            !severity && !status && variant === 'error' && 'bg-red-500',
            !severity && !status && variant === 'info' && 'bg-blue-500',
            !severity && !status && variant === 'default' && 'bg-gray-500'
          )} />
        )}

        {children}

        {removable && onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="ml-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5 transition-colors"
            aria-label="Remove"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={cn(
                size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-3.5 w-3.5' : 'h-4 w-4'
              )}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;


import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string | number;
    height?: string | number;
    lines?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    variant = 'text',
    width,
    height,
    lines = 1,
}) => {
    const baseClasses = 'animate-pulse bg-slate-200 dark:bg-slate-700';

    const variantClasses = {
        text: 'rounded',
        circular: 'rounded-full',
        rectangular: 'rounded-lg',
    };

    const style = {
        width: width,
        height: height,
    };

    if (variant === 'text' && lines > 1) {
        return (
            <div className={`space-y-2 ${className}`}>
                {Array.from({ length: lines }).map((_, i) => (
                    <div
                        key={i}
                        className={`${baseClasses} ${variantClasses.text}`}
                        style={{
                            width: width || (i === lines - 1 && lines > 1 ? '70%' : '100%'),
                            height: height || '1em',
                        }}
                    />
                ))}
            </div>
        );
    }

    return (
        <div
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
            style={style}
        />
    );
};

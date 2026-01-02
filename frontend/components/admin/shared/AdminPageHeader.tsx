import React from 'react';
import { cn } from '../../../design-system/utils';

interface AdminPageHeaderProps {
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
    className?: string;
}

export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
    title,
    subtitle,
    children,
    className
}) => {
    return (
        <div className={cn("flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8", className)}>
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {title}
                </h1>
                {subtitle && (
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">
                        {subtitle}
                    </p>
                )}
            </div>
            {children && (
                <div className="flex items-center gap-3">
                    {children}
                </div>
            )}
        </div>
    );
};

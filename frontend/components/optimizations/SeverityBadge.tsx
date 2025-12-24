
import React from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Severity } from '../../../shared/types';

interface SeverityBadgeProps {
    severity: Severity;
    showLabel?: boolean;
    size?: 'sm' | 'md';
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({
    severity,
    showLabel = true,
    size = 'md'
}) => {
    const styles = {
        [Severity.HIGH]: {
            bg: 'bg-red-100 dark:bg-red-900/30',
            text: 'text-red-700 dark:text-red-400',
            icon: AlertCircle,
            label: 'Critical'
        },
        [Severity.MEDIUM]: {
            bg: 'bg-yellow-100 dark:bg-yellow-900/30',
            text: 'text-yellow-700 dark:text-yellow-400',
            icon: AlertTriangle,
            label: 'Warning'
        },
        [Severity.LOW]: {
            bg: 'bg-blue-100 dark:bg-blue-900/30',
            text: 'text-blue-700 dark:text-blue-400',
            icon: Info,
            label: 'Info'
        }
    };

    const config = styles[severity] || styles[Severity.LOW];
    const Icon = config.icon;
    const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

    return (
        <span data-tour="severity-badge" className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wide ${config.bg} ${config.text} ${sizeClasses}`}>
            <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            {showLabel && config.label}
        </span>
    );
};

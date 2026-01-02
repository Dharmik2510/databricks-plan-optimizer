import React from 'react';
import { Badge } from '../../../design-system/components';
import { cn } from '../../../design-system/utils';

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'pending';

interface StatusBadgeProps {
    status: string;
    variant?: 'solid' | 'outline' | 'subtle';
    className?: string;
    dot?: boolean;
}

const getStatusConfig = (status: string): { variant: 'success' | 'warning' | 'error' | 'info' | 'neutral', label: string } => {
    const normalized = status.toLowerCase();

    if (['active', 'completed', 'success', 'resolved', 'healthy', 'operational'].includes(normalized)) {
        return { variant: 'success', label: status };
    }
    if (['pending', 'processing', 'running', 'in_progress'].includes(normalized)) {
        return { variant: 'info', label: status };
    }
    if (['warning', 'degraded', 'slow'].includes(normalized)) {
        return { variant: 'warning', label: status };
    }
    if (['error', 'failed', 'inactive', 'banned', 'suspended', 'down'].includes(normalized)) {
        return { variant: 'error', label: status };
    }

    return { variant: 'neutral', label: status };
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    variant = 'subtle',
    className,
    dot = false
}) => {
    const config = getStatusConfig(status);

    return (
        <Badge
            variant={config.variant}
            className={cn(
                "capitalize font-medium transition-all duration-300",
                dot && "pl-2",
                className
            )}
        >
            {dot && (
                <span className={cn(
                    "mr-1.5 h-1.5 w-1.5 rounded-full inline-block",
                    config.variant === 'success' && "bg-current",
                    config.variant === 'warning' && "bg-current",
                    config.variant === 'error' && "bg-current",
                    config.variant === 'info' && "bg-current",
                    config.variant === 'neutral' && "bg-current",
                )} />
            )}
            {config.label.replace(/_/g, ' ')}
        </Badge>
    );
};

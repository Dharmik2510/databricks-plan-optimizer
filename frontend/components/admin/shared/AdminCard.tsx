import React from 'react';
import { Card, CardProps } from '../../../design-system/components';
import { cn } from '../../../design-system/utils';

interface AdminCardProps extends CardProps {
    interactive?: boolean;
}

export const AdminCard: React.FC<AdminCardProps> = ({
    children,
    className,
    interactive = false,
    variant = 'default',
    ...props
}) => {
    return (
        <Card
            variant={variant}
            className={cn(
                "bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm",
                "border-slate-200/60 dark:border-slate-800/60",
                "shadow-sm hover:shadow-md transition-all duration-300",
                interactive && "cursor-pointer hover:scale-[1.01] hover:border-indigo-300/50 dark:hover:border-indigo-700/50",
                className
            )}
            {...props}
        >
            {children}
        </Card>
    );
};

// Re-export subcomponents for convenience
export const AdminCardHeader = (Card as any).Header;
export const AdminCardTitle = (Card as any).Title;
export const AdminCardDescription = (Card as any).Description;
export const AdminCardContent = (Card as any).Content;
export const AdminCardFooter = (Card as any).Footer;

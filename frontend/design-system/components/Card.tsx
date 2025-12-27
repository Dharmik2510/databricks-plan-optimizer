import React, { HTMLAttributes } from 'react';
import { cn } from '../utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant = 'default',
      padding = 'md',
      hoverable = false,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'rounded-lg transition-all duration-200';

    const variants = {
      default: 'bg-white border border-gray-200 shadow-md dark:bg-gray-800 dark:border-gray-700',
      outlined: 'bg-transparent border-2 border-gray-300 dark:border-gray-600',
      elevated: 'bg-white shadow-xl dark:bg-gray-800',
    };

    const paddings = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    };

    const hoverStyles = hoverable
      ? 'hover:shadow-lg hover:scale-[1.02] cursor-pointer'
      : '';

    return (
      <div
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          paddings[padding],
          hoverStyles,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Card sub-components
export const CardHeader = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn('mb-4 flex items-center justify-between', className)}
      {...props}
    >
      {children}
    </div>
  );
};

CardHeader.displayName = 'CardHeader';

export const CardTitle = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) => {
  return (
    <h3
      className={cn('text-xl font-semibold text-gray-900 dark:text-gray-100', className)}
      {...props}
    >
      {children}
    </h3>
  );
};

CardTitle.displayName = 'CardTitle';

export const CardDescription = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) => {
  return (
    <p
      className={cn('text-sm text-gray-600 dark:text-gray-400', className)}
      {...props}
    >
      {children}
    </p>
  );
};

CardDescription.displayName = 'CardDescription';

export const CardContent = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  );
};

CardContent.displayName = 'CardContent';

export const CardFooter = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn('mt-6 flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700', className)}
      {...props}
    >
      {children}
    </div>
  );
};

CardFooter.displayName = 'CardFooter';

// Attach sub-components to the Card component
(Card as any).Header = CardHeader;
(Card as any).Title = CardTitle;
(Card as any).Description = CardDescription;
(Card as any).Content = CardContent;
(Card as any).Footer = CardFooter;

export default Card;

import React, { HTMLAttributes } from 'react';
import { cn } from '../utils';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  animation = 'pulse',
  className,
  style,
  ...props
}) => {
  const baseStyles = 'bg-gray-200 dark:bg-gray-700';

  const animations = {
    pulse: 'animate-pulse',
    wave: 'animate-pulse-slow',
    none: '',
  };

  const variants = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };

  const defaultHeight = variant === 'text' ? '1rem' : height;

  return (
    <div
      className={cn(
        baseStyles,
        variants[variant],
        animations[animation],
        className
      )}
      style={{
        width: width || '100%',
        height: defaultHeight,
        ...style,
      }}
      {...props}
    />
  );
};

export default Skeleton;

// Skeleton presets for common UI patterns
export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4', className)}>
      <Skeleton variant="text" width="60%" height="1.5rem" />
      <Skeleton variant="text" width="100%" height="1rem" />
      <Skeleton variant="text" width="100%" height="1rem" />
      <Skeleton variant="text" width="80%" height="1rem" />
      <div className="flex gap-2 mt-4">
        <Skeleton variant="rectangular" width="100px" height="2.5rem" />
        <Skeleton variant="rectangular" width="100px" height="2.5rem" />
      </div>
    </div>
  );
};

export const SkeletonTable: React.FC<{ rows?: number; columns?: number; className?: string }> = ({
  rows = 5,
  columns = 4,
  className,
}) => {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} variant="text" height="1.25rem" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} variant="text" height="1rem" />
          ))}
        </div>
      ))}
    </div>
  );
};

export const SkeletonList: React.FC<{ items?: number; className?: string }> = ({
  items = 5,
  className,
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <Skeleton variant="circular" width="3rem" height="3rem" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width="40%" height="1rem" />
            <Skeleton variant="text" width="80%" height="0.875rem" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const SkeletonDAG: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('bg-gray-50 dark:bg-gray-900 rounded-lg p-6 space-y-6', className)}>
      {/* Title */}
      <Skeleton variant="text" width="30%" height="1.5rem" />

      {/* DAG nodes */}
      <div className="flex justify-between items-center">
        <Skeleton variant="circular" width="80px" height="80px" />
        <Skeleton variant="rectangular" width="60px" height="4px" />
        <Skeleton variant="circular" width="80px" height="80px" />
        <Skeleton variant="rectangular" width="60px" height="4px" />
        <Skeleton variant="circular" width="80px" height="80px" />
      </div>

      <div className="flex justify-center items-center gap-8">
        <Skeleton variant="circular" width="80px" height="80px" />
        <Skeleton variant="rectangular" width="60px" height="4px" />
        <Skeleton variant="circular" width="80px" height="80px" />
      </div>

      {/* Legend */}
      <div className="flex gap-4 pt-4">
        <Skeleton variant="rectangular" width="80px" height="1.5rem" />
        <Skeleton variant="rectangular" width="80px" height="1.5rem" />
        <Skeleton variant="rectangular" width="80px" height="1.5rem" />
      </div>
    </div>
  );
};

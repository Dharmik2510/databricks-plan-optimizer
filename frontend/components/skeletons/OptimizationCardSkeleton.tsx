
import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export const OptimizationCardSkeleton: React.FC = () => {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-start gap-4">
                <Skeleton variant="circular" width={20} height={20} className="flex-shrink-0 mt-1" />
                <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-center">
                        <Skeleton variant="text" width="60%" height="1.25rem" />
                        <Skeleton variant="rectangular" width={80} height={24} className="rounded-full" />
                    </div>

                    <Skeleton variant="text" lines={2} className="w-full" />

                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex gap-4">
                        <Skeleton variant="rectangular" width={90} height={32} />
                        <Skeleton variant="rectangular" width={90} height={32} />
                    </div>
                </div>
            </div>
        </div>
    );
};

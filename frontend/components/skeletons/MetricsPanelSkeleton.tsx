
import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export const MetricsPanelSkeleton: React.FC = () => {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                    <Skeleton variant="circular" width={48} height={48} />
                    <div className="flex-1">
                        <Skeleton variant="text" width="40%" height="0.875rem" className="mb-2" />
                        <Skeleton variant="text" width="70%" height="1.5rem" />
                    </div>
                </div>
            ))}
        </div>
    );
};

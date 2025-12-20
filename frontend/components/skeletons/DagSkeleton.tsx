
import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export const DagSkeleton: React.FC = () => {
    return (
        <div className="relative w-full h-[600px] bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 overflow-hidden">
            {/* Mock DAG Flow */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl flex justify-between items-center gap-8">

                {/* Level 1 - Source */}
                <div className="flex flex-col gap-12">
                    <Skeleton variant="rectangular" width={140} height={60} />
                    <Skeleton variant="rectangular" width={140} height={60} />
                </div>

                {/* Level 2 - Transform */}
                <div className="flex flex-col gap-4 items-center">
                    <Skeleton variant="rectangular" width={140} height={60} />
                    <div className="h-12 w-2 bg-slate-200 dark:bg-slate-700 opacity-50 absolute -z-10" />
                </div>

                {/* Level 3 - Join */}
                <div className="flex flex-col gap-24">
                    <Skeleton variant="rectangular" width={140} height={60} className="border-2 border-slate-300 dark:border-slate-600" />
                </div>

                {/* Level 4 - Output */}
                <div className="flex flex-col gap-8">
                    <Skeleton variant="rectangular" width={140} height={60} />
                </div>
            </div>

            {/* Connection Lines Placeholder (Simple SVG mimicking paths) */}
            <svg className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-10 stroke-slate-500" width="100%" height="100%">
                <path d="M100,200 C200,200 200,300 300,300" fill="none" strokeWidth="2" />
                <path d="M100,400 C200,400 200,300 300,300" fill="none" strokeWidth="2" />
                <path d="M300,300 C400,300 400,300 500,300" fill="none" strokeWidth="2" />
            </svg>

            {/* Minimap Placeholder */}
            <div className="absolute bottom-4 right-4">
                <Skeleton variant="rectangular" width={160} height={100} className="border border-slate-300 dark:border-slate-700" />
            </div>

            {/* Legend Placeholder */}
            <div className="absolute bottom-4 left-4 flex gap-2">
                <Skeleton variant="circular" width={20} height={20} />
                <Skeleton variant="circular" width={20} height={20} />
                <Skeleton variant="circular" width={20} height={20} />
            </div>
        </div>
    );
};

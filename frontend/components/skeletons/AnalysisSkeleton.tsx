
import React, { useState, useEffect } from 'react';
import { MetricsPanelSkeleton } from './MetricsPanelSkeleton';
import { DagSkeleton } from './DagSkeleton';
import { OptimizationCardSkeleton } from './OptimizationCardSkeleton';

interface AnalysisSkeletonProps {
    progress?: number;
}

export const AnalysisSkeleton: React.FC<AnalysisSkeletonProps> = ({ progress = 0 }) => {
    const [stageIndex, setStageIndex] = useState(0);
    const stages = [
        "Parsing execution plan...",
        "Analyzing DAG structure...",
        "Identifying bottlenecks...",
        "Mapping to source code...",
        "Generating recommendations..."
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setStageIndex((prev) => (prev + 1) % stages.length);
        }, 2500);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-500">

            {/* Loading Header */}
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="relative w-full max-w-md h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className="absolute top-0 left-0 h-full bg-orange-500 transition-all duration-300 ease-out"
                        style={{ width: `${Math.max(5, progress)}%` }}
                    />
                </div>
                <p className="text-lg font-medium text-slate-700 dark:text-slate-300 min-w-[280px]">
                    {stages[stageIndex]}
                </p>
            </div>

            {/* Metrics Grid Skeleton */}
            <MetricsPanelSkeleton />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main DAG Skeleton */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    <DagSkeleton />
                </div>

                {/* Optimizations Skeleton */}
                <div className="space-y-4">
                    <div className="h-8 w-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    <div className="space-y-4">
                        <OptimizationCardSkeleton />
                        <OptimizationCardSkeleton />
                        <OptimizationCardSkeleton />
                    </div>
                </div>
            </div>
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import {
    Check,
    X,
    AlertTriangle,
    TrendingUp,
    Clock,
    Zap,
    Database,
    Server,
    Sparkles,
    BarChart3,
    UploadCloud
} from 'lucide-react';
import { AnalysisResult } from '../../shared/types';
import { EventLogUploadModal } from './upload/EventLogUploadModal';
import { BaselineCard } from './analysis/BaselineCard';

interface AnalysisShowcaseProps {
    result: AnalysisResult | null;
    darkMode?: boolean;
}

export const AnalysisShowcase: React.FC<AnalysisShowcaseProps> = ({ result, darkMode = true }) => {
    const [isOptimized, setIsOptimized] = useState(false);
    const [isUploadOpen, setIsUploadOpen] = useState(false);

    // Tier 1 Detection
    const isTier1 = result?.tierMode === 'TIER1' && result?.baseline?.confidence === 'measured';
    // Fallback to legacy prediction if needed, but prefer Tier 1 fields
    const baselineTime = result?.baseline?.totalRuntimeSeconds || result?.performancePrediction?.baselineExecutionTime || 0;

    // Calculate predicted time by subtracting savings
    const totalSavings = result?.optimizations.reduce((acc, opt) => acc + (opt.timeSavings?.estimatedSecondsSaved || 0), 0) || 0;
    const predictedTime = Math.max(0, baselineTime - totalSavings);

    // Calculate Score (Simple heuristic or from result)
    const baseScore = result?.query_complexity_score ? 100 - result.query_complexity_score : 60;
    const improvedScore = Math.min(98, baseScore + (result?.optimization_impact_score || 30));

    const [displayScore, setDisplayScore] = useState(baseScore);

    useEffect(() => {
        const target = isOptimized ? improvedScore : baseScore;
        setDisplayScore(target);
    }, [isOptimized, baseScore, improvedScore]);

    // Format Duration
    const formatDuration = (seconds: number) => {
        if (!seconds) return 'N/A';
        const m = Math.floor(seconds / 60);
        const s = Math.round(seconds % 60);
        return `${m}m ${s}s`;
    };

    const formatSavings = (seconds: number | null) => {
        if (!seconds) return null;
        if (seconds < 60) return `${Math.round(seconds)}s`;
        const m = Math.floor(seconds / 60);
        return `${m}m saved`;
    };

    const currentDuration = isOptimized ? formatDuration(predictedTime) : formatDuration(baselineTime);

    // Optimizations List
    const issues = result?.optimizations.slice(0, 4).map(opt => ({
        title: opt.title,
        severity: opt.severity.toLowerCase(),
        fix: 'Optimization Identified',
        impact: opt.impactLevel || 'Medium',
        savings: opt.timeSavings?.estimatedSecondsSaved,
        confidence: opt.timeSavings?.confidence
    })) || [];

    // Risks / Metrics
    const risk = result?.risk_assessment;
    const metricValues = [
        { label: 'Compute Efficiency', icon: Server, value: isOptimized ? 90 : (100 - (result?.query_complexity_score || 50)), color: 'blue' },
        { label: 'Data Skew Risk', icon: Database, value: isOptimized ? 10 : (risk?.data_skew_risk === 'High' ? 90 : risk?.data_skew_risk === 'Medium' ? 50 : 20), color: 'purple', inverse: true },
        { label: 'Shuffle Overhead', icon: TrendingUp, value: isOptimized ? 20 : (risk?.shuffle_overhead_risk === 'High' ? 85 : risk?.shuffle_overhead_risk === 'Medium' ? 50 : 25), color: 'pink', inverse: true },
        { label: 'Memory Pressure', icon: Zap, value: isOptimized ? 30 : (risk?.oom_risk === 'High' ? 80 : risk?.oom_risk === 'Medium' ? 50 : 25), color: 'orange', inverse: true },
    ];

    if (!result) return null;

    return (
        <div className={`w-full max-w-5xl mx-auto rounded-3xl overflow-hidden border transition-all duration-500 shadow-2xl ${darkMode
            ? 'bg-slate-900/80 border-slate-700 shadow-orange-500/10'
            : 'bg-white border-slate-200 shadow-xl'
            }`}>

            <EventLogUploadModal
                analysisId={result.id || ''}
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                onUploadSuccess={() => window.location.reload()}
            />

            {/* Header / Toggle */}
            <div className={`p-6 border-b flex flex-col sm:flex-row justify-between items-center gap-4 ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-slate-50'
                }`}>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                        <Sparkles className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                        <h3 className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            Plan Analysis Report
                        </h3>
                        <div className="flex items-center gap-2">
                            <p className={`text-xs font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                {result.summary.substring(0, 60)}...
                            </p>
                            {isTier1 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    TIER 1 DETECTED
                                </span>
                            )}
                        </div>
                        <p className={`text-xs mt-1 max-w-xl ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            This qualitative analysis evaluates your query plan's structure for efficiency and logic risks. It provides a baseline score and optimization recommendations independent of runtime data.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Button Removed: Redundant */}

                    <div className={`flex p-1 rounded-xl border ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <button
                            onClick={() => setIsOptimized(false)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!isOptimized
                                ? 'bg-slate-800 text-white shadow-lg'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                        >
                            Baseline
                        </button>
                        <button
                            onClick={() => setIsOptimized(true)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${isOptimized
                                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                        >
                            Optimized
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                {/* LEFT: Score & High Level */}
                <div className={`lg:col-span-5 p-8 border-b lg:border-b-0 lg:border-r flex flex-col items-center justify-center relative overflow-hidden ${darkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'
                    }`}>
                    <div className={`w-48 h-48 rounded-full flex items-center justify-center border-8 relative mb-8 transition-all duration-700 ${isOptimized
                        ? 'border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.2)]'
                        : 'border-orange-500/20 shadow-[0_0_50px_rgba(249,115,22,0.1)]'
                        }`}>
                        {/* Circular Progress SVG - Simplified implementation */}
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                            <circle
                                cx="50%"
                                cy="50%"
                                r="44%"
                                fill="none"
                                stroke={isOptimized ? '#10b981' : '#f97316'}
                                strokeWidth="8"
                                strokeDasharray="270"
                                strokeDashoffset={270 - (270 * displayScore) / 100}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-out"
                            />
                        </svg>

                        <div className="text-center relative z-10">
                            <div className={`text-6xl font-black tracking-tighter transition-colors duration-500 ${isOptimized ? 'text-emerald-500' : 'text-orange-500'
                                }`}>
                                {displayScore}
                            </div>
                            <div className={`text-sm font-bold uppercase tracking-wider mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'
                                }`}>
                                Efficiency
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 w-full">
                        {isTier1 && result.baseline ? (
                            <BaselineCard baseline={result.baseline} darkMode={darkMode} />
                        ) : (
                            <div className={`p-4 rounded-2xl border text-center transition-all duration-500 ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
                                }`}>
                                <div className="flex items-center justify-center gap-2 mb-1 text-slate-500 text-xs font-bold uppercase">
                                    <Clock className="w-3 h-3" /> Execution Time
                                </div>
                                <div className={`text-3xl font-bold ${isOptimized
                                    ? 'text-emerald-500'
                                    : 'text-slate-900 dark:text-white'
                                    }`}>
                                    {/* Upload Link Removed */}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Detailed Breakdown */}
                <div className="lg:col-span-7 p-8">
                    <h4 className={`text-sm font-bold uppercase tracking-wider mb-6 ${darkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                        Resource Metrics
                    </h4>

                    <div className="space-y-6 mb-8">
                        {metricValues.map((item, idx) => (
                            <div key={idx}>
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        <item.icon className={`w-4 h-4 text-${item.color}-500`} />
                                        <span className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                            {item.label}
                                        </span>
                                    </div>
                                    <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                        {item.inverse ? (item.value > 50 ? 'High Risk' : 'Low Risk') : (item.value > 80 ? 'Good' : 'Needs Work')}
                                    </span>
                                </div>
                                <div className={`h-2 w-full rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'
                                    }`}>
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ease-out bg-${item.color}-500`}
                                        style={{ width: `${item.value}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}>
                        <h4 className={`text-xs font-bold uppercase tracking-wider mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'
                            }`}>
                            Identified Improvements
                        </h4>
                        <div className="space-y-3">
                            {issues.length > 0 ? issues.map((issue, idx) => (
                                <div key={idx} className="flex items-start gap-3 group">
                                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${isOptimized
                                        ? 'bg-emerald-500/20 text-emerald-500'
                                        : issue.severity === 'critical' || issue.severity === 'high'
                                            ? 'bg-red-500/20 text-red-500'
                                            : 'bg-amber-500/20 text-amber-500'
                                        }`}>
                                        {isOptimized ? <Check className="w-3 h-3" /> : (issue.severity === 'critical' || issue.severity === 'high' ? <X className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <div className={`text-sm font-medium transition-colors ${isOptimized ? 'text-emerald-500 decoration-emerald-500/30' : (darkMode ? 'text-white' : 'text-slate-900')
                                                }`}>
                                                {issue.title}
                                            </div>
                                            {isTier1 && issue.savings && isOptimized && (
                                                <div className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                                                    -{formatSavings(issue.savings)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                            {isOptimized ? 'Optimized' : `Impact: ${issue.impact}`}
                                            {isTier1 && issue.confidence && !isOptimized && (
                                                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 rounded">
                                                    {issue.confidence}% confidence
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-sm text-slate-500 italic">No major issues detected.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import {
    Check,
    X,
    AlertTriangle,
    TrendingUp,
    Clock,
    DollarSign,
    Zap,
    Database,
    Server,
    ArrowRight,
    Sparkles
} from 'lucide-react';

interface AnalysisShowcaseProps {
    darkMode?: boolean;
}

export const AnalysisShowcase: React.FC<AnalysisShowcaseProps> = ({ darkMode = true }) => {
    const [isOptimized, setIsOptimized] = useState(false);
    const [score, setScore] = useState(62);

    // Animate score changes
    useEffect(() => {
        const targetScore = isOptimized ? 94 : 62;
        const duration = 1000;
        const startTime = Date.now();
        const startScore = score;

        const animate = () => {
            const now = Date.now();
            const progress = Math.min((now - startTime) / duration, 1);
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);

            const currentScore = Math.floor(startScore + (targetScore - startScore) * easeOutQuart);
            setScore(currentScore);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, [isOptimized]);

    const metrics = {
        before: {
            compute: 45,
            memory: 60,
            shuffle: 30,
            skew: 40,
            duration: '45m 12s',
            cost: '$12.50'
        },
        after: {
            compute: 95,
            memory: 88,
            shuffle: 92,
            skew: 95,
            duration: '08m 45s',
            cost: '$4.20'
        }
    };

    const currentMetrics = isOptimized ? metrics.after : metrics.before;

    const issues = [
        {
            title: "Cartesian Product Detected",
            severity: "critical",
            fix: "Converted to BroadcastNestedLoopJoin",
            impact: "High Cost"
        },
        {
            title: "Data Skew in 'transactions'",
            severity: "warning",
            fix: "Applied Salting Strategy (Factor 8)",
            impact: "Slow/Stuck Tasks"
        },
        {
            title: "Excessive Shuffle Spillage",
            severity: "warning",
            fix: "Optimized Partition Count",
            impact: "Disk I/O Bottleneck"
        }
    ];

    return (
        <div className={`w-full max-w-5xl mx-auto rounded-3xl overflow-hidden border transition-all duration-500 shadow-2xl ${darkMode
                ? 'bg-slate-900/80 border-slate-700 shadow-orange-500/10'
                : 'bg-white border-slate-200 shadow-xl'
            }`}>
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
                        <p className={`text-xs font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            Job ID: #job-8921-analytics-daily
                        </p>
                    </div>
                </div>

                <div className={`flex p-1 rounded-xl border ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <button
                        onClick={() => setIsOptimized(false)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!isOptimized
                                ? 'bg-slate-800 text-white shadow-lg'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        Original Plan
                    </button>
                    <button
                        onClick={() => setIsOptimized(true)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${isOptimized
                                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        With BrickOptima
                    </button>
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
                                strokeDashoffset={270 - (270 * score) / 100}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-out"
                            />
                        </svg>

                        <div className="text-center relative z-10">
                            <div className={`text-6xl font-black tracking-tighter transition-colors duration-500 ${isOptimized ? 'text-emerald-500' : 'text-orange-500'
                                }`}>
                                {score}
                            </div>
                            <div className={`text-sm font-bold uppercase tracking-wider mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'
                                }`}>
                                / 100
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full">
                        <div className={`p-4 rounded-2xl border text-center transition-all duration-500 ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
                            }`}>
                            <div className="flex items-center justify-center gap-2 mb-1 text-slate-500 text-xs font-bold uppercase">
                                <Clock className="w-3 h-3" /> Duration
                            </div>
                            <div className={`text-xl font-bold ${isOptimized
                                    ? 'text-emerald-500'
                                    : 'text-slate-900 dark:text-white'
                                }`}>
                                {currentMetrics.duration}
                            </div>
                        </div>
                        <div className={`p-4 rounded-2xl border text-center transition-all duration-500 ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
                            }`}>
                            <div className="flex items-center justify-center gap-2 mb-1 text-slate-500 text-xs font-bold uppercase">
                                <DollarSign className="w-3 h-3" /> Cost/Run
                            </div>
                            <div className={`text-xl font-bold ${isOptimized
                                    ? 'text-emerald-500'
                                    : 'text-slate-900 dark:text-white'
                                }`}>
                                {currentMetrics.cost}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Detailed Breakdown */}
                <div className="lg:col-span-7 p-8">
                    <h4 className={`text-sm font-bold uppercase tracking-wider mb-6 ${darkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                        Category Breakdown
                    </h4>

                    <div className="space-y-6 mb-8">
                        {[
                            { label: 'Compute Efficiency', icon: Server, value: currentMetrics.compute, color: 'blue' },
                            { label: 'Data Skew & Spill', icon: Database, value: currentMetrics.skew, color: 'purple' },
                            { label: 'Shuffle Optimization', icon: TrendingUp, value: currentMetrics.shuffle, color: 'pink' },
                            { label: 'Memory Usage', icon: Zap, value: currentMetrics.memory, color: 'orange' },
                        ].map((item, idx) => (
                            <div key={idx}>
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        <item.icon className={`w-4 h-4 text-${item.color}-500`} />
                                        <span className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                            {item.label}
                                        </span>
                                    </div>
                                    <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                        {item.value}/100
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
                            {issues.map((issue, idx) => (
                                <div key={idx} className="flex items-start gap-3 group">
                                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${isOptimized
                                            ? 'bg-emerald-500/20 text-emerald-500'
                                            : issue.severity === 'critical'
                                                ? 'bg-red-500/20 text-red-500'
                                                : 'bg-amber-500/20 text-amber-500'
                                        }`}>
                                        {isOptimized ? <Check className="w-3 h-3" /> : (issue.severity === 'critical' ? <X className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />)}
                                    </div>
                                    <div className="flex-1">
                                        <div className={`text-sm font-medium transition-colors ${isOptimized ? 'text-emerald-500 decoration-emerald-500/30' : (darkMode ? 'text-white' : 'text-slate-900')
                                            }`}>
                                            {isOptimized ? issue.fix : issue.title}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">
                                            {isOptimized ? 'Resolved' : `Impact: ${issue.impact}`}
                                        </div>
                                    </div>
                                    {isOptimized && (
                                        <div className="text-emerald-500 text-xs font-bold flex items-center gap-1 opacity-0 animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
                                            Fixed <Check className="w-3 h-3" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

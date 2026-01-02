import React, { useState, useMemo } from 'react';
import {
    ArrowLeft,
    RefreshCw,
    Filter,
    Search,
    CheckCircle2,
    AlertCircle,
    HelpCircle,
    XCircle,
    FileCode2,
    Target,
    ChevronRight,
    Copy,
    Check,
    GitBranch,
    Zap,
    AlertTriangle,
    Info,
} from 'lucide-react';
import { AgentJob } from '../../../shared/agent-types';

interface MappingResultsViewProps {
    job: AgentJob;
    onBack: () => void;
    onRefresh: () => void;
    selectedStageId: string | null;
    onStageSelect: (stageId: string | null) => void;
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
    'confirmed': { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/20', label: 'Confirmed' },
    'probable': { icon: AlertCircle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/20', label: 'Probable' },
    'uncertain': { icon: HelpCircle, color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-500/20', label: 'Uncertain' },
    'unmapped': { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-500/20', label: 'Unmapped' },
    'manual': { icon: Target, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/20', label: 'Manual' },
};

// Spark-generated stage information with educational descriptions
const SPARK_STAGE_INFO: Record<string, { description: string; why: string; icon: React.ElementType; color: string; bgColor: string }> = {
    'Exchange': {
        description: 'Data Shuffle Operation',
        why: 'Spark inserts Exchange stages to redistribute data across partitions when operations like join, groupBy, or sort need data from specific keys to be on the same executor. This ensures correctness but can be expensive due to network I/O.',
        icon: Zap,
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-500/10'
    },
    'BroadcastExchange': {
        description: 'Broadcast Join Optimization',
        why: 'When one table is small enough (< spark.sql.autoBroadcastJoinThreshold, default 10MB), Spark broadcasts it to all executors instead of shuffling. This avoids expensive shuffle operations and speeds up joins significantly.',
        icon: Zap,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-500/10'
    },
    'BroadcastHashJoin': {
        description: 'Broadcast Hash Join Strategy',
        why: 'The most efficient join strategy. Spark broadcasts the smaller table to all executors and performs a hash join in memory. Chosen automatically when one side is small or when you use broadcast() hint explicitly.',
        icon: Zap,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-500/10'
    },
    'ShuffleExchange': {
        description: 'Shuffle Exchange (Hash/Range Partitioning)',
        why: 'Required for wide transformations like groupBy and joins. Spark shuffles data so records with the same key end up on the same partition. Hash partitioning is used for aggregations; range partitioning for sorted operations.',
        icon: Zap,
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-500/10'
    },
    'AdaptiveSparkPlan': {
        description: 'Adaptive Query Execution (AQE)',
        why: 'AQE optimizes the query plan at runtime using actual data statistics. It can coalesce partitions, optimize join strategies, and handle skewed joins dynamically. Enable with spark.sql.adaptive.enabled=true.',
        icon: AlertTriangle,
        color: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-50 dark:bg-amber-500/10'
    },
    'BroadcastNestedLoopJoin': {
        description: 'Cartesian Product / Cross Join',
        why: 'WARNING: This is a fallback join when no join condition exists or other strategies fail. It produces a Cartesian product (M × N rows) which can be extremely expensive. Usually indicates a missing ON clause in your join or non-equi join conditions.',
        icon: AlertTriangle,
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-50 dark:bg-orange-500/10'
    },
    'SortMergeJoin': {
        description: 'Sort-Merge Join Strategy',
        why: 'Used for large-to-large table joins when broadcast isn\'t applicable. Both sides are sorted by join key, then merged. More expensive than broadcast but handles larger datasets.',
        icon: Zap,
        color: 'text-indigo-600 dark:text-indigo-400',
        bgColor: 'bg-indigo-50 dark:bg-indigo-500/10'
    },
};

// Helper to identify Spark-generated stages
const isSparkGeneratedStage = (stageName: string, stageType: string): boolean => {
    const sparkKeywords = ['Exchange', 'Shuffle', 'Broadcast', 'Adaptive', 'NestedLoop'];
    return sparkKeywords.some(keyword => stageName.includes(keyword) || stageType.includes(keyword));
};

// Helper to get stage info
const getStageInfo = (stageType: string): { description: string; icon: React.ElementType; color: string } | null => {
    for (const [key, info] of Object.entries(SPARK_STAGE_INFO)) {
        if (stageType.includes(key)) {
            return info;
        }
    }
    return null;
};

export const MappingResultsView: React.FC<MappingResultsViewProps> = ({
    job,
    onBack,
    onRefresh,
    selectedStageId,
    onStageSelect,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const result = job.result;
    const mappings = result?.mappings || [];
    const stats = result?.statistics;
    const repoAnalysis = result?.repositoryAnalysis;

    // Filter mappings
    const filteredMappings = useMemo(() => {
        return mappings.filter(m => {
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                if (!m.stageName.toLowerCase().includes(term) &&
                    !m.mappings.some(cm => cm.filePath.toLowerCase().includes(term))) {
                    return false;
                }
            }
            if (statusFilter && m.status !== statusFilter) {
                return false;
            }
            return true;
        });
    }, [mappings, searchTerm, statusFilter]);

    // Get selected mapping
    const selectedMapping = selectedStageId
        ? mappings.find(m => m.stageId === selectedStageId)
        : null;

    // Copy code snippet
    const handleCopy = async (code: string, id: string) => {
        await navigator.clipboard.writeText(code);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="flex h-full bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-white overflow-hidden">
            {/* Left sidebar - Stage list */}
            <div className="w-96 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-r border-slate-200/50 dark:border-slate-700/50 flex flex-col shadow-xl">
                {/* Header */}
                <div className="p-5 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-b from-white/50 to-transparent dark:from-slate-800/30 dark:to-transparent">
                    <div className="flex items-center gap-3 mb-5">
                        <button
                            onClick={onBack}
                            className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all duration-200 hover:scale-105"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        </button>
                        <h2 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
                            Mapping Results
                        </h2>
                        <button
                            onClick={onRefresh}
                            className="ml-auto p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all duration-200 hover:rotate-180"
                        >
                            <RefreshCw className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search stages or files..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all duration-200"
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex gap-2 mt-4 flex-wrap">
                        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                            <button
                                key={key}
                                onClick={() => setStatusFilter(statusFilter === key ? null : key)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 ${statusFilter === key
                                    ? `${config.bg} ${config.color} shadow-sm`
                                    : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'
                                    }`}
                            >
                                {config.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats summary */}
                {stats && (
                    <div className="p-5 border-b border-slate-200/50 dark:border-slate-700/50 grid grid-cols-2 gap-3">
                        <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-500/10 dark:to-purple-500/10 rounded-xl p-4 border border-violet-200/50 dark:border-violet-500/20 shadow-sm">
                            <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
                                {Math.round(stats.coveragePercentage)}%
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">Coverage</div>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 rounded-xl p-4 border border-emerald-200/50 dark:border-emerald-500/20 shadow-sm">
                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.confirmedMappings}</div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">Confirmed</div>
                        </div>
                    </div>
                )}

                {/* Stage list */}
                <div className="flex-1 overflow-y-auto">
                    {filteredMappings.map((mapping) => {
                        const config = STATUS_CONFIG[mapping.status as string] || STATUS_CONFIG['uncertain'];
                        const Icon = config.icon;
                        const isSelected = selectedStageId === mapping.stageId;
                        const isSparkGenerated = isSparkGeneratedStage(mapping.stageName, mapping.stageType);
                        const stageInfo = getStageInfo(mapping.stageType);

                        return (
                            <button
                                key={mapping.stageId}
                                onClick={() => onStageSelect(mapping.stageId)}
                                className={`w-full p-4 text-left border-b border-slate-100/50 dark:border-slate-800/50 transition-all duration-200 ${isSelected
                                    ? 'bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-500/10 dark:to-purple-500/10 border-l-4 border-l-violet-500 shadow-sm'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-4 border-l-transparent'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-xl ${config.bg} mt-0.5 shadow-sm`}>
                                        <Icon className={`w-4 h-4 ${config.color}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="font-semibold text-slate-900 dark:text-white truncate">{mapping.stageName}</div>
                                            {isSparkGenerated && stageInfo && (
                                                <div className="p-1 bg-purple-100 dark:bg-purple-500/20 rounded-md" title={stageInfo.description}>
                                                    <Zap className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{mapping.stageType}</div>
                                        <div className="flex items-center gap-2 mt-2.5">
                                            <div className={`text-xs font-semibold ${config.color}`}>{Math.round(mapping.confidence)}% match</div>
                                            <span className="text-slate-300 dark:text-slate-700">•</span>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">{mapping.mappings.length} location(s)</div>
                                        </div>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 text-slate-400 dark:text-slate-600 transition-transform duration-200 ${isSelected ? 'rotate-90' : ''}`} />
                                </div>
                            </button>
                        );
                    })}

                    {filteredMappings.length === 0 && (
                        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                            <Filter className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <div className="font-medium">No mappings match your filters</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main content area */}
            <div className="flex-1 flex flex-col bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    {selectedMapping ? (
                        <div className="max-w-5xl mx-auto">
                            {/* Stage header */}
                            <div className="mb-8 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800/50 dark:to-slate-900/50 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
                                <div className="flex items-start gap-4">
                                    <div>
                                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{selectedMapping.stageName}</h3>
                                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{selectedMapping.reasoning}</p>
                                    </div>
                                </div>

                                {/* Spark-generated stage info */}
                                {(() => {
                                    const stageInfo = getStageInfo(selectedMapping.stageType);
                                    if (stageInfo) {
                                        const InfoIcon = stageInfo.icon;
                                        return (
                                            <div className={`mt-4 ${stageInfo.bgColor} border ${stageInfo.color.replace('text-', 'border-')}/30 dark:${stageInfo.color.replace('text-', 'border-')}/20 rounded-xl p-5 shadow-sm`}>
                                                <div className="flex items-start gap-4">
                                                    <div className={`p-2.5 rounded-xl ${stageInfo.color.replace('text-', 'bg-')}/20 flex-shrink-0`}>
                                                        <InfoIcon className={`w-6 h-6 ${stageInfo.color}`} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-base mb-2 flex items-center gap-2">
                                                            <span className={stageInfo.color}>{stageInfo.description}</span>
                                                            <span className="text-xs px-2 py-0.5 bg-white/50 dark:bg-black/20 rounded-full font-normal text-slate-600 dark:text-slate-400">Spark-Generated</span>
                                                        </div>
                                                        <div className="text-sm leading-relaxed" style={{ color: 'inherit', opacity: 0.9 }}>
                                                            <strong>Why this stage exists:</strong> {stageInfo.why}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>

                            {/* Code mappings */}
                            <div className="space-y-5">
                                {selectedMapping.mappings.map((cm) => (
                                    <div
                                        key={cm.id}
                                        className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300"
                                    >
                                        {/* File header */}
                                        <div className="p-5 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-700/20 dark:to-transparent flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-violet-100 dark:bg-violet-500/20 rounded-xl">
                                                    <FileCode2 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-slate-900 dark:text-white">{cm.filePath}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                        Lines {cm.startLine}-{cm.endLine}
                                                        {cm.functionContext && ` • ${cm.functionContext}`}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`text-sm font-bold px-3 py-1.5 rounded-lg ${cm.confidence >= 80 ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' :
                                                    cm.confidence >= 50 ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' :
                                                        'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400'
                                                    }`}>
                                                    {Math.round(cm.confidence)}% match
                                                </span>
                                                <button
                                                    onClick={() => handleCopy(cm.codeSnippet, cm.id)}
                                                    className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-xl transition-all duration-200 hover:scale-110"
                                                >
                                                    {copiedId === cm.id ? (
                                                        <Check className="w-4 h-4 text-emerald-500" />
                                                    ) : (
                                                        <Copy className="w-4 h-4 text-slate-400" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Code snippet */}
                                        <div className="p-5 bg-slate-950 dark:bg-black/50">
                                            <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed">
                                                {cm.codeSnippet}
                                            </pre>
                                        </div>

                                        {/* Evidence */}
                                        <div className="p-5 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">
                                            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                                                <Info className="w-3.5 h-3.5" />
                                                Evidence
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {cm.evidenceFactors.map((ef, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-3 py-1.5 bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-slate-700 dark:text-slate-300 font-medium shadow-sm"
                                                    >
                                                        {ef.description}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-600">
                            <FileCode2 className="w-16 h-16 mb-4 opacity-30" />
                            <div className="text-lg font-medium">Select a stage to view code mappings</div>
                            <div className="text-sm mt-1">Choose from the list on the left</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right sidebar - Repository stats */}
            {repoAnalysis && (
                <div className="w-80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-l border-slate-200/50 dark:border-slate-700/50 p-6 shadow-xl">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2 text-lg">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl">
                            <GitBranch className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        Repository Analysis
                    </h3>
                    <div className="space-y-4">
                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200/50 dark:border-slate-700/50 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
                            <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                                {repoAnalysis.totalFiles > 0 ? repoAnalysis.totalFiles : '—'}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">Files Analyzed</div>
                            {repoAnalysis.totalFiles === 0 && (
                                <div className="text-xs text-slate-500 dark:text-slate-500 mt-2 italic">Stats unavailable from cache</div>
                            )}
                        </div>
                        <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-500/10 dark:to-purple-500/10 border border-violet-200/50 dark:border-violet-500/20 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
                            <div className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent mb-1">
                                {repoAnalysis.totalFunctions > 0 ? repoAnalysis.totalFunctions : '—'}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">Functions Found</div>
                            {repoAnalysis.totalFunctions === 0 && (
                                <div className="text-xs text-slate-500 dark:text-slate-500 mt-2 italic">Stats unavailable from cache</div>
                            )}
                        </div>
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-200/50 dark:border-amber-500/20 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
                            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mb-1">
                                {repoAnalysis.totalDataOperations > 0 ? repoAnalysis.totalDataOperations : '—'}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">Data Operations</div>
                            {repoAnalysis.totalDataOperations === 0 && (
                                <div className="text-xs text-slate-500 dark:text-slate-500 mt-2 italic">Stats unavailable from cache</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

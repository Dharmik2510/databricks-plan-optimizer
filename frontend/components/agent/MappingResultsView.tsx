// ... imports same
import React, { useState, useMemo } from 'react';
import {
    ArrowLeft,
    RefreshCw,
    Download,
    Filter,
    Search,
    CheckCircle2,
    AlertCircle,
    HelpCircle,
    XCircle,
    FileCode2,
    Target,
    ChevronRight,
    ExternalLink,
    Copy,
    Check,
    GitBranch,
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
        <div className="flex h-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white overflow-hidden">
            {/* Left sidebar - Stage list */}
            <div className="w-96 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-700/50 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700/50">
                    <div className="flex items-center gap-3 mb-4">
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                        </button>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mapping Results</h2>
                        <button
                            onClick={onRefresh}
                            className="ml-auto p-2 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                        >
                            <RefreshCw className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search stages or files..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                            <button
                                key={key}
                                onClick={() => setStatusFilter(statusFilter === key ? null : key)}
                                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${statusFilter === key
                                    ? `${config.bg} ${config.color}`
                                    : 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'
                                    }`}
                            >
                                {config.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats summary */}
                {stats && (
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 grid grid-cols-2 gap-2">
                        <div className="text-center">
                            <div className="text-xl font-bold text-slate-900 dark:text-white">{stats.coveragePercentage}%</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Coverage</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.confirmedMappings}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Confirmed</div>
                        </div>
                    </div>
                )}

                {/* Stage list */}
                <div className="flex-1 overflow-y-auto">
                    {filteredMappings.map((mapping) => {
                        const config = STATUS_CONFIG[mapping.status as string] || STATUS_CONFIG['uncertain'];
                        const Icon = config.icon;
                        const isSelected = selectedStageId === mapping.stageId;

                        return (
                            <button
                                key={mapping.stageId}
                                onClick={() => onStageSelect(mapping.stageId)}
                                className={`w-full p-4 text-left border-b border-slate-100 dark:border-slate-700/30 transition-colors ${isSelected
                                    ? 'bg-violet-50 dark:bg-violet-500/10 border-l-4 border-l-violet-500'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 border-l-4 border-l-transparent'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`p-1.5 rounded-lg ${config.bg} mt-0.5`}>
                                        <Icon className={`w-4 h-4 ${config.color}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-slate-900 dark:text-white truncate">{mapping.stageName}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{mapping.stageType}</div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <div className={`text-xs ${config.color}`}>{mapping.confidence}% confidence</div>
                                            <span className="text-slate-400 dark:text-slate-600">•</span>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">{mapping.mappings.length} location(s)</div>
                                        </div>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                                </div>
                            </button>
                        );
                    })}

                    {filteredMappings.length === 0 && (
                        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                            No mappings match your filters
                        </div>
                    )}
                </div>
            </div>

            {/* Main content area */}
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {selectedMapping ? (
                        <div className="max-w-4xl">
                            {/* Stage header */}
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{selectedMapping.stageName}</h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm">{selectedMapping.reasoning}</p>
                            </div>

                            {/* Code mappings */}
                            <div className="space-y-4">
                                {selectedMapping.mappings.map((cm) => (
                                    <div
                                        key={cm.id}
                                        className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden"
                                    >
                                        {/* File header */}
                                        <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <FileCode2 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                                                <div>
                                                    <div className="font-medium text-slate-900 dark:text-white">{cm.filePath}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                        Lines {cm.startLine}-{cm.endLine}
                                                        {cm.functionContext && ` • ${cm.functionContext}`}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`text-sm font-medium ${cm.confidence >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                                                    cm.confidence >= 50 ? 'text-amber-600 dark:text-amber-400' :
                                                        'text-slate-500 dark:text-slate-400'
                                                    }`}>
                                                    {cm.confidence}% match
                                                </span>
                                                <button
                                                    onClick={() => handleCopy(cm.codeSnippet, cm.id)}
                                                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                                                >
                                                    {copiedId === cm.id ? (
                                                        <Check className="w-4 h-4 text-emerald-500" />
                                                    ) : (
                                                        <Copy className="w-4 h-4 text-slate-400" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Code snippet - keeping it dark for contrast */}
                                        <div className="p-4 bg-slate-900 dark:bg-slate-950">
                                            <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap overflow-x-auto">
                                                {cm.codeSnippet}
                                            </pre>
                                        </div>

                                        {/* Evidence */}
                                        <div className="p-4 border-t border-slate-200 dark:border-slate-700/50">
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">Evidence:</div>
                                            <div className="flex flex-wrap gap-2">
                                                {cm.evidenceFactors.map((ef, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-2 py-1 bg-slate-200 dark:bg-slate-700/50 rounded-md text-xs text-slate-700 dark:text-slate-300"
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
                        <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
                            Select a stage from the left panel to view its code mappings
                        </div>
                    )}
                </div>
            </div>

            {/* Right sidebar - Repository stats */}
            {repoAnalysis && (
                <div className="w-72 bg-slate-50 dark:bg-slate-900/50 border-l border-slate-200 dark:border-slate-700/50 p-4">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-emerald-500" />
                        Repository Analysis
                    </h3>
                    <div className="space-y-4">
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg p-3">
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">{repoAnalysis.totalFiles}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Files Analyzed</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg p-3">
                            <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">{repoAnalysis.totalFunctions}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Functions Found</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg p-3">
                            <div className="text-2xl font-bold text-amber-500 dark:text-amber-400">{repoAnalysis.totalDataOperations}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Data Operations</div>
                        </div>
                    </div>

                    {/* Export button */}
                    <button className="w-full mt-6 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 rounded-lg text-sm text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-2">
                        <Download className="w-4 h-4" />
                        Export Report
                    </button>
                </div>
            )}
        </div>
    );
};

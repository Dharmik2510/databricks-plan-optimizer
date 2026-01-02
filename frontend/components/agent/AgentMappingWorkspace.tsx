/**
 * Agent Mapping Workspace Component
 * 
 * Main 3-column layout workspace for the agent mapping feature.
 * 
 * LEFT: DAG Nodes List
 * CENTER: Selected Node Details with Tabs
 * RIGHT: Agent Timeline
 * 
 * @see design_summary.md Section 5: Clean Layout Proposal
 */

import React from 'react';
import { useAgentMappingStore } from '../../store/useAgentMappingStore';
import { DAGNodesList } from './DAGNodesList';
import { AgentTimeline } from './AgentTimeline';
import { MappingReasoningPanel } from './MappingReasoningPanel';
import { AgentControls } from './AgentControls';
import { ArrowLeft, Activity } from 'lucide-react';

interface AgentMappingWorkspaceProps {
    onBack: () => void;
}

export const AgentMappingWorkspace: React.FC<AgentMappingWorkspaceProps> = ({ onBack }) => {
    // Use individual selectors to prevent infinite render loop
    const jobId = useAgentMappingStore(state => state.jobId);
    const repoConfig = useAgentMappingStore(state => state.repoConfig);
    const status = useAgentMappingStore(state => state.status);
    const selectedNodeId = useAgentMappingStore(state => state.selectedNodeId);
    const dagNodes = useAgentMappingStore(state => state.dagNodes);

    const selectedNode = dagNodes.find(n => n.id === selectedNodeId);

    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white shadow-md dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <button
                            onClick={onBack}
                            className="flex-shrink-0 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Back to input"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        </button>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <Activity className="w-4 h-4 text-indigo-500" />
                                <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                                    Agent Mapping
                                </h1>
                                <StatusBadge status={status} />
                            </div>
                            {repoConfig && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                    {repoConfig.url}
                                    {repoConfig.commitHash && (
                                        <span className="ml-2 font-mono">
                                            (commit: {repoConfig.commitHash.substring(0, 7)})
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Agent Controls Bar */}
                <AgentControls />
            </header>

            {/* 3-Column Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT:  DAG Nodes List (320px) */}
                <div className="w-80 flex-shrink-0">
                    <DAGNodesList />
                </div>

                {/* CENTER: Node Details (flex-1) */}
                <div className="flex-1 min-w-0 bg-white dark:bg-slate-900">
                    <MappingReasoningPanel node={selectedNode} />
                </div>

                {/* RIGHT: Timeline (400px) */}
                <div className="w-96 flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
                    <AgentTimeline />
                </div>
            </div>
        </div>
    );
};

/**
 * Status Badge
 */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const colors = {
        idle: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
        initializing: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
        running: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400',
        paused: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
        completed: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
        failed: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
    };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${colors[status as keyof typeof colors] || colors.idle}`}>
            {status}
        </span>
    );
};

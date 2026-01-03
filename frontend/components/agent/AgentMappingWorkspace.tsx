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

type Tab = 'nodes' | 'details' | 'timeline';

export const AgentMappingWorkspace: React.FC<AgentMappingWorkspaceProps> = ({ onBack }) => {
    // Mobile Tab State
    const [activeTab, setActiveTab] = React.useState<Tab>('nodes');




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

            {/* 3-Column Layout (Desktop) / Tabbed (Mobile) */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* LEFT:  DAG Nodes List (320px on Desktop, Full on Mobile if active) */}
                <div className={`
                    w-full lg:w-80 flex-shrink-0 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800
                    ${activeTab === 'nodes' ? 'block' : 'hidden lg:block'}
                `}>
                    <DAGNodesList />
                </div>

                {/* CENTER: Node Details (flex-1 on Desktop, Full on Mobile if active) */}
                <div className={`
                    flex-1 min-w-0 bg-white dark:bg-slate-900
                    ${activeTab === 'details' ? 'block' : 'hidden lg:block'}
                `}>
                    <MappingReasoningPanel node={selectedNode} />
                </div>

                {/* RIGHT: Timeline (400px on Desktop, Full on Mobile if active) */}
                <div className={`
                    w-full lg:w-96 flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800
                    ${activeTab === 'timeline' ? 'block' : 'hidden lg:block'}
                `}>
                    <AgentTimeline />
                </div>
            </div>

            {/* Mobile Bottom Navigation */}
            <div className="lg:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 safe-area-bottom">
                <div className="flex justify-around items-center h-16">
                    <button
                        onClick={() => setActiveTab('nodes')}
                        className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeTab === 'nodes' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        <Activity className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">Nodes</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeTab === 'details' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        <Activity className="w-5 h-5" />
                        {/* Note: In a real app I'd use a different icon like FileText, but keeping imports minimal for now unless I add more */}
                        <span className="text-[10px] font-bold uppercase tracking-wide">Details</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('timeline')}
                        className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeTab === 'timeline' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        <Activity className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">Timeline</span>
                    </button>
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

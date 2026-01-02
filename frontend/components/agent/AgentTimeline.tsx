/**
 * Agent Timeline Component
 * 
 * Displays the live pipeline stages with auto-scroll to active stage.
 * Matching wireframe design with centered connecting lines.
 */

import React, { useEffect, useRef } from 'react';
import { TimelineStageCard } from './TimelineStageCard';
import { useAgentMappingStore } from '../../store/useAgentMappingStore';
import { Activity } from 'lucide-react';

export const AgentTimeline: React.FC = () => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const stages = useAgentMappingStore(state => state.stages);
    const currentStageId = useAgentMappingStore(state => state.currentStageId);

    // Auto-scroll to active stage
    useEffect(() => {
        if (currentStageId && scrollRef.current) {
            const element = document.getElementById(`stage-${currentStageId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [currentStageId]);

    if (stages.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-slate-400 dark:text-slate-600">
                <Activity className="w-12 h-12 mb-3 opacity-30" />
                <div className="text-sm font-medium">Waiting for agent to start...</div>
            </div>
        );
    }

    return (
        <div
            ref={scrollRef}
            className="h-full overflow-y-auto p-4 scroll-smooth"
        >
            <div className="flex items-center gap-2 mb-4 sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm py-2 z-10">
                <Activity className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Agent Progress
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                    ({stages.filter(s => s.status === 'completed').length}/{stages.length} completed)
                </span>
            </div>

            {/* Timeline with centered connecting lines */}
            <div className="flex flex-col items-center">
                {stages.map((stage, index) => (
                    <div key={stage.id} className="w-full flex flex-col items-center">
                        {/* Stage card */}
                        <div className="w-full">
                            <TimelineStageCard stage={stage} isLast={index === stages.length - 1} />
                        </div>

                        {/* Connecting line between cards (not after last) */}
                        {index < stages.length - 1 && (
                            <div className="flex flex-col items-center py-1">
                                <div
                                    className={`w-0.5 h-4 ${stage.status === 'completed'
                                            ? 'bg-emerald-500'
                                            : 'bg-slate-300 dark:bg-slate-600'
                                        }`}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

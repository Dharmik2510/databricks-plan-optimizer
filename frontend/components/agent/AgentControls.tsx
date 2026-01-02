/**
 * Agent Controls Component
 * 
 * Sticky control bar with Pause/Resume, Retry, and Settings buttons.
 * 
 * @see design_summary.md Section 4: Interactive Controls
 */

import React, { useState } from 'react';
import {
    Pause,
    Play,
    RotateCcw,
    Settings,
    ChevronDown,
    Check,
    X,
} from 'lucide-react';
import { useAgentMappingStore } from '../../store/useAgentMappingStore';
import { cn } from '../../lib/utils';

interface AgentControlsProps {
    className?: string;
}

export const AgentControls: React.FC<AgentControlsProps> = ({ className }) => {
    const [showRetryOptions, setShowRetryOptions] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Store state
    const status = useAgentMappingStore(state => state.status);
    const isPaused = useAgentMappingStore(state => state.isPaused);
    const settings = useAgentMappingStore(state => state.settings);
    const pauseAgent = useAgentMappingStore(state => state.actions.pauseAgent);
    const resumeAgent = useAgentMappingStore(state => state.actions.resumeAgent);
    const updateSettings = useAgentMappingStore(state => state.actions.updateSettings);

    const isRunning = status === 'running' || status === 'initializing';
    const canPause = isRunning && !isPaused;
    const canResume = isPaused;

    return (
        <div className={cn(
            'flex items-center gap-3 px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700',
            className
        )}>
            {/* Pause/Resume Button */}
            <button
                onClick={() => isPaused ? resumeAgent() : pauseAgent()}
                disabled={!isRunning}
                className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all',
                    canPause && 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
                    canResume && 'bg-indigo-600 text-white hover:bg-indigo-700',
                    !isRunning && 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400'
                )}
            >
                {isPaused ? (
                    <>
                        <Play className="w-4 h-4" />
                        Resume
                    </>
                ) : (
                    <>
                        <Pause className="w-4 h-4" />
                        Pause
                    </>
                )}
            </button>

            {/* Retry Node Dropdown */}
            <div className="relative">
                <button
                    onClick={() => setShowRetryOptions(!showRetryOptions)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-500/30 transition-all"
                >
                    <RotateCcw className="w-4 h-4" />
                    Retry Node
                    <ChevronDown className={cn(
                        'w-4 h-4 transition-transform',
                        showRetryOptions && 'rotate-180'
                    )} />
                </button>

                {showRetryOptions && (
                    <RetryOptionsPanel onClose={() => setShowRetryOptions(false)} />
                )}
            </div>

            {/* Settings Button */}
            <div className="relative">
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all',
                        showSettings
                            ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    )}
                >
                    <Settings className="w-4 h-4" />
                    Settings
                </button>

                {showSettings && (
                    <SettingsPanel
                        settings={settings}
                        onUpdate={updateSettings}
                        onClose={() => setShowSettings(false)}
                    />
                )}
            </div>

            {/* Status Indicator */}
            <div className="ml-auto flex items-center gap-2 text-sm">
                {status === 'running' && !isPaused && (
                    <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Processing...
                    </span>
                )}
                {isPaused && (
                    <span className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Paused
                    </span>
                )}
                {status === 'completed' && (
                    <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <Check className="w-4 h-4" />
                        Completed
                    </span>
                )}
                {status === 'failed' && (
                    <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        <X className="w-4 h-4" />
                        Failed
                    </span>
                )}
            </div>
        </div>
    );
};

/**
 * Retry Options Panel
 */
const RetryOptionsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [options, setOptions] = useState({
        increaseTopK: true,
        disableSparkOpsFilter: false,
        lowerConfidenceThreshold: false,
    });

    return (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 z-50 animate-in fade-in slide-in-from-top-2">
            <div className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                Retry with Options
            </div>

            <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={options.increaseTopK}
                        onChange={(e) => setOptions(prev => ({ ...prev, increaseTopK: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                        Increase topK from 5 → 10
                    </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={options.disableSparkOpsFilter}
                        onChange={(e) => setOptions(prev => ({ ...prev, disableSparkOpsFilter: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                        Disable spark_ops filter in AST node
                    </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={options.lowerConfidenceThreshold}
                        onChange={(e) => setOptions(prev => ({ ...prev, lowerConfidenceThreshold: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                        Lower confidence threshold to 30%
                    </span>
                </label>
            </div>

            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => {
                        // TODO: Call retry API with options
                        onClose();
                    }}
                    className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
                >
                    Apply & Retry
                </button>
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

/**
 * Settings Panel
 */
interface SettingsPanelProps {
    settings: any;
    onUpdate: (settings: any) => void;
    onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onUpdate, onClose }) => {
    const [localSettings, setLocalSettings] = useState(settings || {
        llmModel: 'gpt-4o',
        embeddingModel: 'text-embedding-3-small',
        maxFiles: 50,
        minConfidence: 40,
    });

    return (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 z-50 animate-in fade-in slide-in-from-top-2">
            <div className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                Agent Settings
            </div>

            <div className="space-y-4">
                {/* LLM Model */}
                <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                        LLM Model
                    </label>
                    <select
                        value={localSettings.llmModel}
                        onChange={(e) => setLocalSettings(prev => ({ ...prev, llmModel: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                        <option value="gpt-4o">gpt-4o</option>
                        <option value="gpt-4-turbo">gpt-4-turbo</option>
                        <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                    </select>
                </div>

                {/* Embedding Model */}
                <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                        Embedding Model
                    </label>
                    <select
                        value={localSettings.embeddingModel}
                        onChange={(e) => setLocalSettings(prev => ({ ...prev, embeddingModel: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                        <option value="text-embedding-3-small">text-embedding-3-small</option>
                        <option value="text-embedding-3-large">text-embedding-3-large</option>
                        <option value="text-embedding-ada-002">text-embedding-ada-002</option>
                    </select>
                </div>

                {/* Max Files */}
                <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                        Max Files: [{localSettings.maxFiles}]
                    </label>
                    <input
                        type="range"
                        min="10"
                        max="200"
                        value={localSettings.maxFiles}
                        onChange={(e) => setLocalSettings(prev => ({ ...prev, maxFiles: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* Min Confidence */}
                <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                        Min Confidence %: [{localSettings.minConfidence}]
                    </label>
                    <input
                        type="range"
                        min="10"
                        max="90"
                        value={localSettings.minConfidence}
                        onChange={(e) => setLocalSettings(prev => ({ ...prev, minConfidence: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
            </div>

            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => {
                        onUpdate(localSettings);
                        onClose();
                    }}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                    Save
                </button>
                <button
                    onClick={() => {
                        setLocalSettings({
                            llmModel: 'gpt-4o',
                            embeddingModel: 'text-embedding-3-small',
                            maxFiles: 50,
                            minConfidence: 40,
                        });
                    }}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                    Reset
                </button>
            </div>
        </div>
    );
};

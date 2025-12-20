
import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

interface CodeDiffProps {
    originalCode?: string;
    suggestedCode: string;
    language?: string;
}

export const CodeDiff: React.FC<CodeDiffProps> = ({ originalCode, suggestedCode, language = 'python' }) => {
    const { info } = useToast();
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(suggestedCode);
        setCopied(true);
        info("Code copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 font-mono text-sm bg-slate-50 dark:bg-slate-900">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                <div className="flex items-center gap-4">
                    <span className="text-xs font-bold uppercase text-slate-500">Suggested Fix</span>
                </div>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>

            <div className="grid grid-cols-1 overflow-auto max-h-[300px]">
                {/* Original Code (if present) - showing simpler stacked view for now */}
                {originalCode && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/10 border-b border-slate-200 dark:border-slate-700 relative group">
                        <div className="absolute top-2 right-2 text-[10px] font-bold text-red-500 uppercase opacity-50">Original</div>
                        <pre className="text-red-800 dark:text-red-300 whitespace-pre-wrap">{originalCode}</pre>
                    </div>
                )}

                {/* Suggested Code */}
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 relative">
                    <div className="absolute top-2 right-2 text-[10px] font-bold text-emerald-500 uppercase opacity-50">Optimized</div>
                    <pre className="text-emerald-800 dark:text-emerald-300 whitespace-pre-wrap">{suggestedCode}</pre>
                </div>
            </div>
        </div>
    );
};

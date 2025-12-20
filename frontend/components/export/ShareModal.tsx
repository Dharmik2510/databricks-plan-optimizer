
import React, { useState, useEffect } from 'react';
import { Copy, Check, X, Share2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    link: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, link }) => {
    const { success } = useToast();
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen) setCopied(false);
    }, [isOpen]);

    const handleCopy = () => {
        navigator.clipboard.writeText(link);
        setCopied(true);
        success("Link copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 transform transition-all animate-in fade-in zoom-in-95 duration-200">

                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                            <Share2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Share Analysis</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <p className="text-slate-600 dark:text-slate-400 mb-6 font-medium">
                    Copy this link to share the current optimization results with your team.
                    <br />
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-normal mt-1 block">
                        Note: This link encodes the data directly. It might be long!
                    </span>
                </p>

                <div className="relative mb-6">
                    <input
                        type="text"
                        readOnly
                        value={link}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-3 pl-4 pr-24 text-sm text-slate-600 dark:text-slate-400 font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none truncate"
                    />
                    <button
                        onClick={handleCopy}
                        className="absolute right-1 top-1 bottom-1 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors flex items-center gap-2 shadow-sm"
                    >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleCopy}
                        className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm"
                    >
                        Copy Link
                    </button>
                </div>

            </div>
        </div>
    );
};

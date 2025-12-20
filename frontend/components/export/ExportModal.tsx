
import React from 'react';
import { X, FileJson, FileText, CheckCircle, Download } from 'lucide-react';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (format: 'pdf' | 'json') => void;
    isExporting: boolean;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onConfirm, isExporting }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
                onClick={!isExporting ? onClose : undefined}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 transform transition-all animate-in fade-in zoom-in-95 duration-200">

                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Export Report</h3>
                    {!isExporting && (
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">

                    {/* PDF Option */}
                    <button
                        disabled={isExporting}
                        onClick={() => onConfirm('pdf')}
                        className="group relative p-6 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-orange-500 dark:hover:border-orange-500 hover:shadow-md transition-all text-left bg-slate-50 dark:bg-slate-950 hover:bg-white dark:hover:bg-slate-900"
                    >
                        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 w-fit rounded-xl group-hover:scale-110 transition-transform">
                            <FileText className="w-6 h-6" />
                        </div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-1">PDF Document</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Standard A4 report with executive summary and charts.</p>
                    </button>

                    {/* JSON Option */}
                    <button
                        disabled={isExporting}
                        onClick={() => onConfirm('json')}
                        className="group relative p-6 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-orange-500 dark:hover:border-orange-500 hover:shadow-md transition-all text-left bg-slate-50 dark:bg-slate-950 hover:bg-white dark:hover:bg-slate-900"
                    >
                        <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 w-fit rounded-xl group-hover:scale-110 transition-transform">
                            <FileJson className="w-6 h-6" />
                        </div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-1">JSON Data</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Raw analysis data for programmatic use or re-import.</p>
                    </button>
                </div>

                {isExporting && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center pointer-events-none z-10">
                        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="font-bold text-slate-900 dark:text-white animate-pulse">Generating Report...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

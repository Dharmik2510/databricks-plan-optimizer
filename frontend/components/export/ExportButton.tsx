
import React, { useState } from 'react';
import { Download, Share2, ChevronDown } from 'lucide-react';
import { exportService } from '../../services/exportService';
import { AnalysisResult } from '../../../shared/types';
import { ExportModal } from './ExportModal';
import { ShareModal } from './ShareModal';
import { useToast } from '../../hooks/useToast';

interface ExportButtonProps {
    result: AnalysisResult;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ result }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareLink, setShareLink] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const { success, error } = useToast();

    const handleShare = () => {
        try {
            const link = exportService.generateShareLink(result);
            setShareLink(link);
            setShowShareModal(true);
            setIsOpen(false);
        } catch (e) {
            error("Failed to generate share link");
        }
    };

    const handleExportConfirm = async (format: 'pdf' | 'json') => {
        setIsExporting(true);
        try {
            if (format === 'json') {
                exportService.exportToJSON(result);
                success("JSON exported successfully");
            } else {
                // We assume the ID of the dashboard container is 'dashboard-container'
                await exportService.exportToPDF('dashboard-container');
                success("PDF Report generated successfully");
            }
        } catch (e: any) {
            console.error(e);
            error(`Export failed: ${e.message}`);
        } finally {
            setIsExporting(false);
            setShowExportModal(false);
            setIsOpen(false);
        }
    };

    return (
        <>
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg transition-all shadow-sm border border-slate-200 dark:border-slate-700"
                >
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-40 animate-in fade-in slide-in-from-top-2 duration-200">

                            <button
                                onClick={() => setShowExportModal(true)}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                            >
                                <Download className="w-4 h-4 text-slate-500" />
                                <div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Download Report</div>
                                    <div className="text-xs text-slate-500">PDF or JSON format</div>
                                </div>
                            </button>

                            <div className="h-px bg-slate-100 dark:bg-slate-700 my-0"></div>

                            <button
                                onClick={handleShare}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                            >
                                <Share2 className="w-4 h-4 text-orange-500" />
                                <div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Share Results</div>
                                    <div className="text-xs text-slate-500">Create shareable link</div>
                                </div>
                            </button>
                        </div>
                    </>
                )}
            </div>

            <ExportModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                onConfirm={handleExportConfirm}
                isExporting={isExporting}
            />

            <ShareModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                link={shareLink}
            />
        </>
    );
};

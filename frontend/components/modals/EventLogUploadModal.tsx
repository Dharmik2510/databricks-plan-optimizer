import React, { useState, useRef } from 'react';
import { X, Upload, FileJson, AlertCircle, CheckCircle2, HelpCircle, ChevronRight, Info, Sparkles } from 'lucide-react';
import { analysisApi } from '../../api/analysis';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    analysisId: string;
    onSuccess: () => void;
}

export const EventLogUploadModal: React.FC<Props> = ({ isOpen, onClose, analysisId, onSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showInstructions, setShowInstructions] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (!selectedFile.name.endsWith('.json') && !selectedFile.name.endsWith('.json.gz') && !selectedFile.name.endsWith('.log')) {
                setError('Please select a valid Spark event log (.json, .json.gz, .log)');
                return;
            }
            // Check size (100MB max)
            if (selectedFile.size > 100 * 1024 * 1024) {
                setError('File is too large (max 100MB)');
                return;
            }
            setFile(selectedFile);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        setError(null);

        try {
            await analysisApi.uploadEventLog(analysisId, file);
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Upload className="w-5 h-5 text-indigo-500" /> Upload Event Log
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Unlock Tier 1 accuracy with measured runtime metrics
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">

                    {/* Instructions Toggle */}
                    <button
                        onClick={() => setShowInstructions(!showInstructions)}
                        className="w-full flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-700 dark:text-indigo-300 text-sm font-medium transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <HelpCircle className="w-4 h-4" />
                            Where do I find this?
                        </div>
                        <ChevronRight className={`w-4 h-4 transition-transform ${showInstructions ? 'rotate-90' : ''}`} />
                    </button>

                    {showInstructions && (
                        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2 pl-2 border-l-2 border-indigo-200 dark:border-indigo-800/50 ml-2 animate-fade-in-down">
                            <p>1. <strong>Spark UI</strong>: Go to "Executors" or main page &rarr; Download Event Log.</p>
                            <p>2. <strong>Spark History Server</strong>: Click "Download" on the application page.</p>
                            <p>3. <strong>Cloud Storage</strong>: Look in your event log directory (S3/DBFS/GCS).</p>
                            <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/10 p-2 rounded-lg mt-2">
                                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                                This log contains ONLY metadata (timings, stage IDs). No source data is read.
                            </div>
                        </div>
                    )}

                    {/* Dropzone */}
                    <div
                        className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${file ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10' : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileSelect}
                            accept=".json,.json.gz,.log"
                        />

                        {file ? (
                            <div className="space-y-2">
                                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400">
                                    <FileJson className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white truncate max-w-[200px] mx-auto">{file.name}</p>
                                    <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                    className="text-xs text-red-500 hover:underline"
                                >
                                    Remove
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                                    <Upload className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-900 dark:text-white">Click to upload event log</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Supports .json, .json.gz (Max 100MB)</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-center">
                        <button
                            onClick={async () => {
                                setIsUploading(true);
                                setError(null);
                                try {
                                    await analysisApi.useDemoEventLog(analysisId);
                                    onSuccess();
                                    onClose();
                                } catch (err: any) {
                                    setError(err.message || 'Demo log failed.');
                                } finally {
                                    setIsUploading(false);
                                }
                            }}
                            className="text-indigo-600 dark:text-indigo-400 text-sm font-medium hover:underline flex items-center gap-1"
                            disabled={isUploading}
                        >
                            <Sparkles className="w-4 h-4" /> Try with Demo Log
                        </button>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={!file || isUploading}
                        className={`px-4 py-2 rounded-xl text-white font-bold text-sm shadow-lg flex items-center gap-2 transition-all ${!file || isUploading
                            ? 'bg-slate-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-indigo-500/25'
                            }`}
                    >
                        {isUploading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Parsing...
                            </>
                        ) : (
                            'Upload & Measure'
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
};

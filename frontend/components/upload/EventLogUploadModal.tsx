
import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileJson, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { apiClient } from '../../api/client';

interface EventLogUploadModalProps {
    analysisId: string;
    isOpen: boolean;
    onClose: () => void;
    onUploadSuccess: () => void;
}

export const EventLogUploadModal: React.FC<EventLogUploadModalProps> = ({
    analysisId,
    isOpen,
    onClose,
    onUploadSuccess
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            // Basic validation
            if (!selectedFile.name.endsWith('.json') && !selectedFile.name.endsWith('.json.gz')) {
                setError('Invalid file type. Please upload .json or .json.gz');
                return;
            }
            setFile(selectedFile);
            setError(null);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const selectedFile = e.dataTransfer.files[0];
            if (!selectedFile.name.endsWith('.json') && !selectedFile.name.endsWith('.json.gz')) {
                setError('Invalid file type. Please upload .json or .json.gz');
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
            const res = await apiClient.uploadEventLog(analysisId, file);
            if (res.success) {
                setSuccess(true);
                setTimeout(() => {
                    onUploadSuccess();
                    onClose();
                }, 1500);
            } else {
                setError(res.message || 'Upload failed');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to upload event log');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-slate-900 dark:text-white">Upload Spark Event Log</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {!success ? (
                        <>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                Upload your <code>eventlog.json</code> to get measured runtime baselines and accurate time savings estimates.
                            </p>

                            <div
                                onDrop={handleDrop}
                                onDragOver={(e) => e.preventDefault()}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${file
                                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10'
                                    : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                                    }`}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                    accept=".json,.gz"
                                />
                                {file ? (
                                    <div className="text-center">
                                        <FileJson className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                                        <p className="font-medium text-slate-900 dark:text-white truncate max-w-[200px]">{file.name}</p>
                                        <p className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                                        <p className="font-medium text-slate-900 dark:text-white">Click to browse or drag file</p>
                                        <p className="text-xs text-slate-500 mt-1">Supports .json and .json.gz</p>
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleUpload}
                                disabled={!file || isUploading}
                                className="w-full mt-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    'Start Tier 1 Analysis'
                                )}
                            </button>
                        </>
                    ) : (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in">
                                <CheckCircle className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Upload Successful!</h4>
                            <p className="text-slate-500">Reprocessing analysis with runtime metrics...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

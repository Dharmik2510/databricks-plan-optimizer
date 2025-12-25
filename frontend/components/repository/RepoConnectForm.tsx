import React, { useState, useEffect } from 'react';
import { Github, FolderUp, Link, AlertCircle } from 'lucide-react';

interface Props {
    url: string;
    onUrlChange: (url: string) => void;
    onScan: () => void;
    isLoading?: boolean;
}

export const RepoConnectForm: React.FC<Props> = ({ url, onUrlChange, onScan, isLoading }) => {
    const [urlError, setUrlError] = useState<string>('');

    const isValidGitHubUrl = (url: string): boolean => {
        if (!url) return true; // Empty is valid (no error shown)
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            return hostname === 'github.com' || hostname.endsWith('.github.com');
        } catch {
            return false;
        }
    };

    useEffect(() => {
        if (url && !isValidGitHubUrl(url)) {
            setUrlError('Please enter a valid GitHub repository URL');
        } else {
            setUrlError('');
        }
    }, [url]);

    const handleScan = () => {
        if (!url) {
            setUrlError('Repository URL is required');
            return;
        }
        if (!isValidGitHubUrl(url)) {
            setUrlError('Please enter a valid GitHub repository URL (e.g., https://github.com/username/repo)');
            return;
        }
        setUrlError('');
        onScan();
    };

    return (
        <div className="max-w-md mx-auto p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg mt-10">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Connect Repository</h2>

            <div className="space-y-4">
                <button className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50 dark:bg-slate-800 transition-all group">
                    <Github className="w-6 h-6 text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                    <div className="text-left">
                        <div className="font-semibold text-slate-900 dark:text-white">Connect with GitHub</div>
                        <div className="text-xs text-slate-500">Import repositories directly</div>
                    </div>
                </button>

                <button className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50 dark:bg-slate-800 transition-all group">
                    <FolderUp className="w-6 h-6 text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                    <div className="text-left">
                        <div className="font-semibold text-slate-900 dark:text-white">Upload Files</div>
                        <div className="text-xs text-slate-500">Drag & drop source code archives</div>
                    </div>
                </button>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white dark:bg-slate-900 px-2 text-slate-500">Or enter URL</span>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="https://github.com/username/repo"
                                className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                                    urlError
                                        ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
                                        : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
                                } bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 outline-none`}
                                value={url}
                                onChange={(e) => onUrlChange(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={handleScan}
                            disabled={isLoading || !!urlError}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Scanning...' : 'Scan'}
                        </button>
                    </div>
                    {urlError && (
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs">
                            <AlertCircle className="w-3 h-3" />
                            <span>{urlError}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

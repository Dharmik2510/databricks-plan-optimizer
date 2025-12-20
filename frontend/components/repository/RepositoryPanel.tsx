
import React, { useState } from 'react';
import { Sidebar, FolderOpen, GitBranch, Settings } from 'lucide-react';
import { FileTree } from './FileTree';
import { HotspotMap } from './HotspotMap';
import { AnalysisSummary } from './AnalysisSummary';
import { useTheme } from '../../ThemeContext';

const MOCK_FILE_DATA = [
    {
        name: 'backend', type: 'folder', children: [
            {
                name: 'src', type: 'folder', children: [
                    { name: 'main.scala', type: 'file', riskLevel: 'low' },
                    { name: 'Auth.scala', type: 'file', riskLevel: 'medium' }
                ]
            },
            { name: 'config', type: 'folder', children: [] }
        ]
    },
    {
        name: 'frontend', type: 'folder', children: [
            {
                name: 'components', type: 'folder', children: [
                    { name: 'App.tsx', type: 'file', riskLevel: 'low' },
                    { name: 'Visualizer.tsx', type: 'file', riskLevel: 'high' }
                ]
            }
        ]
    },
    { name: 'README.md', type: 'file' }
];

export const RepositoryPanel: React.FC = () => {
    const { theme } = useTheme();
    const [selectedFile, setSelectedFile] = useState<any>(null);

    return (
        <div className="flex h-[calc(100vh-100px)] bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Left Sidebar: File Tree */}
            <div className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <FolderOpen className="w-4 h-4" /> Files
                    </span>
                    <GitBranch className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 overflow-auto">
                    <FileTree data={MOCK_FILE_DATA as any} onSelect={setSelectedFile} selectedFile={selectedFile?.name} />
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950">
                {selectedFile ? (
                    <div className="flex-1 p-6 flex items-center justify-center text-slate-500">
                        {/* Placeholder for File Viewer */}
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{selectedFile.name}</h2>
                            <p>File content viewer coming soon...</p>
                            <button className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700" onClick={() => setSelectedFile(null)}>Back to Overview</button>
                        </div>
                    </div>
                ) : (
                    <HotspotMap onSelect={setSelectedFile} />
                )}
            </div>

            {/* Right Sidebar: Summary */}
            <div className="w-72 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-700 dark:text-slate-200">Analysis Summary</span>
                </div>
                <div className="overflow-auto h-full pb-20">
                    <AnalysisSummary />
                </div>
            </div>
        </div>
    );
};

import React, { useState, useMemo } from 'react';
import { Sidebar, FolderOpen, GitBranch, Settings, FileText, Code } from 'lucide-react';
import { FileTree } from './FileTree';
import { HotspotMap } from './HotspotMap';
import { AnalysisSummary } from './AnalysisSummary';
import { useTheme } from '../../ThemeContext';

interface Props {
    files?: any[];
}

const buildFileTree = (files: any[]) => {
    if (!files || files.length === 0) return [];

    const root: any[] = [];
    const map: Record<string, any> = {};

    // Sort files by path depth to ensure folders are created before files (heuristic)
    // Actually, random order is fine if we handle creation logic well.

    files.forEach(file => {
        const parts = file.path.split('/');
        let currentLevel = root;
        let currentPath = "";

        parts.forEach((part: string, index: number) => {
            const isFile = index === parts.length - 1;
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            let existingNode = currentLevel.find((n: any) => n.name === part);

            if (!existingNode) {
                const newNode = {
                    name: part,
                    path: currentPath,
                    type: isFile ? 'file' : 'folder',
                    children: isFile ? undefined : [],
                    content: isFile ? file.content : undefined,
                    language: isFile ? file.language : undefined,
                    size: isFile ? file.size : undefined,
                    riskLevel: isFile ? (['low', 'medium', 'high'][Math.floor(Math.random() * 3)]) : undefined // Mock risk for now
                };
                currentLevel.push(newNode);
                existingNode = newNode;
            }

            if (!isFile) {
                currentLevel = existingNode.children;
            }
        });
    });

    return root;
};

export const RepositoryPanel: React.FC<Props> = ({ files = [] }) => {
    const { theme } = useTheme();
    const [selectedFile, setSelectedFile] = useState<any>(null);
    const fileTreeData = useMemo(() => buildFileTree(files), [files]);

    return (
        <div className="flex h-[calc(100vh-100px)] bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Left Sidebar: File Tree */}
            <div className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <FolderOpen className="w-4 h-4" /> Files
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{files.length} items</span>
                </div>
                <div className="flex-1 overflow-auto">
                    {files.length === 0 ? (
                        <div className="p-4 text-sm text-slate-400 text-center italic">No files found. Connect a repo properly.</div>
                    ) : (
                        <FileTree data={fileTreeData} onSelect={setSelectedFile} selectedFile={selectedFile?.path} />
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
                {selectedFile ? (
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-slate-400" />
                                <h2 className="font-bold text-slate-800 dark:text-white">{selectedFile.name}</h2>
                            </div>
                            <button className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors" onClick={() => setSelectedFile(null)}>Close</button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 bg-[#1e1e1e] text-slate-300 font-mono text-sm leading-relaxed">
                            <pre>{selectedFile.content || "// No content available or binary file"}</pre>
                        </div>
                    </div>
                ) : (
                    <div className="h-full overflow-auto p-6">
                        <HotspotMap files={files} onSelect={(file) => {
                            // Find corresponding file object
                            const found = files.find(f => f.path === file.path);
                            if (found) setSelectedFile({ ...found, name: found.path.split('/').pop() });
                        }} />
                    </div>
                )}
            </div>

            {/* Right Sidebar: Summary */}
            <div className="w-72 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-700 dark:text-slate-200">Analysis Summary</span>
                </div>
                <div className="overflow-auto h-full pb-20">
                    <AnalysisSummary files={files} />
                </div>
            </div>
        </div>
    );
};

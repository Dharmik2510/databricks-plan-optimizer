
import React, { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, AlertCircle } from 'lucide-react';
import { useTheme } from '../../ThemeContext';

interface FileNode {
    name: string;
    type: 'file' | 'folder';
    children?: FileNode[];
    riskLevel?: 'critical' | 'high' | 'medium' | 'low';
}

interface FileTreeProps {
    data: FileNode[];
    onSelect: (file: FileNode) => void;
    selectedFile?: string;
}

const TreeNode: React.FC<{ node: FileNode; depth: number; onSelect: (f: FileNode) => void; selected: boolean }> = ({ node, depth, onSelect, selected }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { theme } = useTheme();

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (node.type === 'folder') {
            setIsOpen(!isOpen);
        } else {
            onSelect(node);
        }
    };

    const getRiskColor = (level?: string) => {
        if (level === 'critical') return 'text-red-500';
        if (level === 'high') return 'text-orange-500';
        return '';
    };

    return (
        <div className="select-none">
            <div
                className={`
          flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors
          ${selected ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}
        `}
                style={{ paddingLeft: `${depth * 16 + 12}px` }}
                onClick={handleToggle}
            >
                <span className="opacity-70">
                    {node.type === 'folder' ? (
                        isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                    ) : <div className="w-4" />}
                </span>

                {node.type === 'folder' ? (
                    <Folder className={`w-4 h-4 ${isOpen ? 'text-indigo-500' : 'text-slate-400'}`} />
                ) : (
                    <File className="w-4 h-4 text-slate-400" />
                )}

                <span className="truncate flex-1 text-sm">{node.name}</span>

                {node.riskLevel && (node.riskLevel === 'critical' || node.riskLevel === 'high') && (
                    <AlertCircle className={`w-3.5 h-3.5 ${getRiskColor(node.riskLevel)}`} />
                )}
            </div>

            {isOpen && node.children && (
                <div>
                    {node.children.map((child, i) => (
                        <TreeNode key={i} node={child} depth={depth + 1} onSelect={onSelect} selected={selected} /> // Todo: fix selection logic
                    ))}
                </div>
            )}
        </div>
    );
};

export const FileTree: React.FC<FileTreeProps> = ({ data, onSelect, selectedFile }) => {
    return (
        <div className="w-full h-full overflow-y-auto py-2">
            {data.map((node, i) => (
                <TreeNode key={i} node={node} depth={0} onSelect={onSelect} selected={node.name === selectedFile} />
            ))}
        </div>
    );
};

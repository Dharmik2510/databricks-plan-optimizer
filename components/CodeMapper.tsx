
import React from 'react';
import { CodeSnippet } from '../types';
import { FileCode, GitBranch, Link } from 'lucide-react';

interface Props {
  mappings?: CodeSnippet[];
}

export const CodeMapper: React.FC<Props> = ({ mappings }) => {
  if (!mappings || mappings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] bg-white/70 backdrop-blur-2xl rounded-2xl border border-slate-200/60 text-slate-400">
        <GitBranch className="w-12 h-12 mb-4 opacity-50" />
        <p>No code mappings found.</p>
        <p className="text-xs mt-2 opacity-70">Connect a repository to trace DAG nodes to source code.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-100 rounded-lg border border-blue-200">
           <FileCode className="w-6 h-6 text-blue-600" />
        </div>
        Code Traceability
      </h3>

      <div className="grid gap-6">
        {mappings.map((map, idx) => (
          <div key={idx} className="bg-white/70 backdrop-blur-2xl rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden group hover:border-blue-300 transition-all relative">
            
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2 text-sm font-mono text-blue-600">
                <GitBranch className="w-4 h-4" />
                {map.filePath}:{map.lineNumber}
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <Link className="w-3 h-3" /> Linked by AI
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-slate-700 leading-relaxed tracking-wide">{map.relevanceExplanation}</p>
              </div>
              
              <div className="relative group/code">
                 {/* Use standard dark theme for code blocks even in light UI */}
                 <pre className="relative text-sm font-mono text-blue-100 bg-[#1e293b] p-4 rounded-xl border border-slate-700 overflow-x-auto shadow-inner">
                   <code>{map.code}</code>
                 </pre>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

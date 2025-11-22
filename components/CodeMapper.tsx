import React from 'react';
import { CodeSnippet } from '../types';
import { FileCode, GitBranch, Link } from 'lucide-react';

interface Props {
  mappings?: CodeSnippet[];
}

export const CodeMapper: React.FC<Props> = ({ mappings }) => {
  if (!mappings || mappings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] bg-white/50 backdrop-blur-3xl rounded-3xl border border-white/60 text-slate-500 shadow-lg ring-1 ring-white/40">
        <GitBranch className="w-12 h-12 mb-4 opacity-50" />
        <p className="font-medium">No code mappings found.</p>
        <p className="text-xs mt-2 opacity-80 font-medium">Connect a repository to trace DAG nodes to source code.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3 mb-4 drop-shadow-sm">
        <div className="p-2 bg-blue-100/80 backdrop-blur rounded-xl border border-blue-200 shadow-sm">
           <FileCode className="w-6 h-6 text-blue-600" />
        </div>
        Code Traceability
      </h3>

      <div className="grid gap-6">
        {mappings.map((map, idx) => (
          <div key={idx} className="bg-white/50 backdrop-blur-3xl rounded-3xl shadow-lg border border-white/60 overflow-hidden group hover:border-blue-300 transition-all relative ring-1 ring-white/40">
            
            <div className="flex items-center justify-between px-6 py-4 bg-white/40 border-b border-white/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm font-mono font-bold text-blue-700">
                <GitBranch className="w-4 h-4" />
                {map.filePath}:{map.lineNumber}
              </div>
              <div className="text-xs text-slate-600 font-bold flex items-center gap-1">
                <Link className="w-3 h-3" /> Linked by AI
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-slate-800 leading-relaxed tracking-wide font-medium">{map.relevanceExplanation}</p>
              </div>
              
              <div className="relative group/code">
                 {/* IDE style - Dark for contrast */}
                 <pre className="relative text-sm font-mono text-blue-100 bg-[#0f172a]/90 backdrop-blur-md p-4 rounded-2xl border border-slate-700 overflow-x-auto shadow-inner">
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
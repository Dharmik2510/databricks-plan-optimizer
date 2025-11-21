import React from 'react';
import { CodeSnippet } from '../types';
import { FileCode, GitBranch, Link } from 'lucide-react';

interface Props {
  mappings?: CodeSnippet[];
}

export const CodeMapper: React.FC<Props> = ({ mappings }) => {
  if (!mappings || mappings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] bg-slate-900/40 backdrop-blur-2xl rounded-3xl border border-white/10 text-slate-400">
        <GitBranch className="w-12 h-12 mb-4 opacity-50" />
        <p>No code mappings found.</p>
        <p className="text-xs mt-2">Connect a repository to trace DAG nodes to source code.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h3 className="text-2xl font-bold text-white flex items-center gap-3 mb-4 drop-shadow-md">
        <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
           <FileCode className="w-6 h-6 text-blue-400" />
        </div>
        Code Traceability
      </h3>

      <div className="grid gap-6">
        {mappings.map((map, idx) => (
          <div key={idx} className="bg-slate-900/40 backdrop-blur-2xl rounded-3xl shadow-lg border border-white/10 overflow-hidden group hover:border-blue-500/30 transition-all relative">
            {/* Gloss Shine */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

            <div className="flex items-center justify-between px-6 py-4 bg-black/20 border-b border-white/5">
              <div className="flex items-center gap-2 text-sm font-mono text-blue-300">
                <GitBranch className="w-4 h-4" />
                {map.filePath}:{map.lineNumber}
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <Link className="w-3 h-3" /> Linked by AI
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-slate-200 leading-relaxed">{map.relevanceExplanation}</p>
              </div>
              
              <div className="relative group/code">
                 <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-xl blur opacity-20"></div>
                 <pre className="relative text-sm font-mono text-blue-100 bg-black/60 p-4 rounded-xl border border-white/10 overflow-x-auto">
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
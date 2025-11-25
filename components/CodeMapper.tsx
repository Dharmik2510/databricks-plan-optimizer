
import React from 'react';
import { EnhancedCodeSnippet } from '../types';
import { FileCode, GitBranch, Link, AlertCircle, CheckCircle, Layers } from 'lucide-react';

interface Props {
  mappings?: EnhancedCodeSnippet[];
}

export const CodeMapper: React.FC<Props> = ({ mappings }) => {
  if (!mappings || mappings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] bg-white/30 backdrop-blur-3xl rounded-3xl border border-white/40 text-slate-500 shadow-lg ring-1 ring-white/30">
        <GitBranch className="w-12 h-12 mb-4 opacity-50" />
        <p className="font-medium">No code mappings found.</p>
        <p className="text-xs mt-2 opacity-80 font-medium">Connect a repository to trace DAG nodes to source code.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3 mb-4 drop-shadow-sm">
        <div className="p-2 bg-blue-100/60 backdrop-blur rounded-xl border border-blue-200/50 shadow-sm">
           <FileCode className="w-6 h-6 text-blue-600" />
        </div>
        Code Traceability
        <span className="text-sm font-normal text-slate-500">({mappings.length} mappings found)</span>
      </h3>

      <div className="grid gap-6">
        {mappings.map((map, idx) => (
          <div key={idx} className="bg-white/30 backdrop-blur-3xl rounded-3xl shadow-lg border border-white/40 overflow-hidden group hover:border-blue-300/50 transition-all relative ring-1 ring-white/30">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white/30 border-b border-white/40 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm font-mono font-bold text-blue-700">
                  <GitBranch className="w-4 h-4" />
                  {map.filePath}:{map.lineNumber}
                </div>
                
                {/* Match Type Badge */}
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase backdrop-blur-sm ${
                  map.matchType === 'exact' ? 'bg-green-100/70 text-green-700 border border-green-200/50' :
                  map.matchType === 'partial' ? 'bg-amber-100/70 text-amber-700 border border-amber-200/50' :
                  'bg-slate-100/70 text-slate-700 border border-slate-200/50'
                }`}>
                  {map.matchType}
                </span>
              </div>

              {/* Confidence Score */}
              <div className="flex items-center gap-2">
                <div className="text-xs text-slate-600 font-bold flex items-center gap-1">
                  {map.confidence >= 80 ? (
                    <CheckCircle className="w-3 h-3 text-green-600" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                  )}
                  Confidence: 
                  <span className={`${
                    map.confidence >= 80 ? 'text-green-700' :
                    map.confidence >= 60 ? 'text-amber-700' : 'text-slate-700'
                  }`}>
                    {map.confidence}%
                  </span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-slate-800 leading-relaxed tracking-wide font-medium">
                  {map.relevanceExplanation}
                </p>
              </div>

              {/* Call Stack */}
              {map.callStack && map.callStack.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50/30 rounded-lg border border-blue-200/30 backdrop-blur-sm">
                  <div className="text-xs font-bold text-blue-700 uppercase mb-2 flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Call Stack
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-blue-800">
                    {map.callStack.map((func, i) => (
                      <React.Fragment key={i}>
                        <span className="bg-white/50 px-2 py-1 rounded border border-blue-200/50">{func}</span>
                        {i < map.callStack!.length - 1 && <span>→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* Dependencies */}
              {map.dependencies && map.dependencies.length > 0 && (
                <div className="mb-4 p-3 bg-purple-50/30 rounded-lg border border-purple-200/30 backdrop-blur-sm">
                  <div className="text-xs font-bold text-purple-700 uppercase mb-2">Dependencies</div>
                  <div className="flex flex-wrap gap-2">
                    {map.dependencies.map((dep, i) => (
                      <span key={i} className={`text-xs px-2 py-1 rounded border font-mono backdrop-blur-sm ${
                        dep.type === 'external' 
                          ? 'bg-purple-100/60 text-purple-800 border-purple-200/50'
                          : 'bg-slate-100/60 text-slate-800 border-slate-200/50'
                      }`}>
                        {dep.source}
                        {dep.importedAs && ` as ${dep.importedAs}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Code Block */}
              <div className="relative group/code">
                <pre className="relative text-sm font-mono text-blue-100 bg-[#0f172a]/80 backdrop-blur-md p-4 rounded-2xl border border-slate-700/50 overflow-x-auto shadow-inner">
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

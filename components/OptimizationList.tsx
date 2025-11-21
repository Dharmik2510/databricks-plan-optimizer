import React, { useState } from 'react';
import { OptimizationTip, Severity } from '../types';
import { AlertTriangle, CheckCircle, Zap, Copy, Code, ArrowRight } from 'lucide-react';

interface Props {
  optimizations: OptimizationTip[];
}

export const OptimizationList: React.FC<Props> = ({ optimizations }) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h3 className="text-2xl font-bold text-white flex items-center gap-3 mb-8 drop-shadow-md">
        <div className="p-2 bg-amber-500/20 rounded-lg border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
           <Zap className="w-6 h-6 text-amber-400" />
        </div>
        Performance Recommendations
      </h3>
      
      {optimizations.map((opt, idx) => (
        <div key={idx} className="bg-slate-900/40 backdrop-blur-2xl rounded-3xl shadow-lg border border-white/10 overflow-hidden group transition-all hover:bg-slate-900/60 hover:border-white/20 hover:shadow-[0_10px_40px_rgba(0,0,0,0.4)] hover:translate-y-[-2px] relative">
          {/* Gloss Top Border */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>

          {/* Header */}
          <div className={`p-6 flex flex-col md:flex-row gap-5 justify-between items-start border-l-4 ${
            opt.severity === Severity.HIGH ? 'border-red-500 bg-red-500/5' : 
            opt.severity === Severity.MEDIUM ? 'border-amber-500 bg-amber-500/5' : 'border-emerald-500 bg-emerald-500/5'
          }`}>
            <div className="flex gap-5">
              <div className="mt-1 flex-shrink-0">
                {opt.severity === Severity.HIGH && <div className="p-3 bg-red-500/20 text-red-400 rounded-xl border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]"><AlertTriangle className="w-6 h-6" /></div>}
                {opt.severity === Severity.MEDIUM && <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]"><AlertTriangle className="w-6 h-6" /></div>}
                {opt.severity === Severity.LOW && <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]"><CheckCircle className="w-6 h-6" /></div>}
              </div>
              <div>
                <h4 className="text-xl font-bold text-white tracking-wide drop-shadow-sm">{opt.title}</h4>
                <p className="text-slate-200 mt-2 leading-relaxed text-base font-light">{opt.description}</p>
              </div>
            </div>
            <span className={`text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider flex-shrink-0 backdrop-blur-md border shadow-sm ${
               opt.severity === Severity.HIGH ? 'bg-red-500/10 text-red-300 border-red-500/20' : 
               opt.severity === Severity.MEDIUM ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
            }`}>
              {opt.severity} Priority
            </span>
          </div>

          {/* Code Diff Section - Deep Glass */}
          {opt.codeSuggestion && (
            <div className="border-t border-white/5 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
              {/* Original (Optional) */}
              {opt.originalPattern && (
                <div className="p-6 bg-black/20 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-400 uppercase mb-4 tracking-wider">
                    <AlertTriangle className="w-3 h-3" /> Current Pattern
                  </div>
                  <div className="font-mono text-sm text-slate-300 bg-black/50 p-4 rounded-xl border border-white/5 shadow-inner">
                    <pre className="whitespace-pre-wrap break-words">{opt.originalPattern}</pre>
                  </div>
                </div>
              )}

              {/* Optimized */}
              <div className={`p-6 bg-black/30 backdrop-blur-sm relative ${!opt.originalPattern ? 'col-span-2' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                     <Code className="w-3 h-3" /> Optimized Code
                   </div>
                   <button 
                    onClick={() => copyToClipboard(opt.codeSuggestion!, idx)}
                    className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all backdrop-blur-md"
                  >
                    {copiedIdx === idx ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedIdx === idx ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-xl blur opacity-20"></div>
                  <pre className="relative text-sm font-mono text-emerald-200 overflow-x-auto p-4 bg-black/60 rounded-xl border border-white/5 shadow-inner">
                    <code>{opt.codeSuggestion}</code>
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
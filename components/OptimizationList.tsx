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
      <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3 mb-8 drop-shadow-sm">
        <div className="p-2 bg-orange-100/80 backdrop-blur rounded-xl border border-orange-200 shadow-sm">
           <Zap className="w-6 h-6 text-orange-600" />
        </div>
        Performance Recommendations
      </h3>
      
      {optimizations.map((opt, idx) => (
        <div key={idx} className={`bg-white/50 backdrop-blur-3xl rounded-3xl shadow-lg border overflow-hidden group transition-all hover:shadow-xl hover:translate-y-[-2px] ring-1 ring-white/40 ${
          opt.severity === Severity.HIGH ? 'border-red-500' : 'border-white/60 hover:border-orange-200 hover:bg-white/60'
        }`}>
          
          <div className={`p-6 flex flex-col md:flex-row gap-5 justify-between items-start border-l-4 ${
            opt.severity === Severity.HIGH ? 'border-red-500 bg-red-50/30' : 
            opt.severity === Severity.MEDIUM ? 'border-amber-500 bg-amber-50/30' : 'border-emerald-500 bg-emerald-50/30'
          }`}>
            <div className="flex gap-5">
              <div className="mt-1 flex-shrink-0">
                {opt.severity === Severity.HIGH && <div className="p-2 bg-white/80 text-red-600 rounded-xl border border-red-200 shadow-sm"><AlertTriangle className="w-6 h-6" /></div>}
                {opt.severity === Severity.MEDIUM && <div className="p-2 bg-white/80 text-amber-600 rounded-xl border border-amber-200 shadow-sm"><AlertTriangle className="w-6 h-6" /></div>}
                {opt.severity === Severity.LOW && <div className="p-2 bg-white/80 text-emerald-600 rounded-xl border border-emerald-200 shadow-sm"><CheckCircle className="w-6 h-6" /></div>}
              </div>
              <div>
                <h4 className="text-xl font-bold text-slate-900 tracking-tight">{opt.title}</h4>
                <p className="text-slate-800 mt-2 leading-relaxed text-base font-medium">{opt.description}</p>
              </div>
            </div>
            <span className={`text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider flex-shrink-0 border shadow-sm backdrop-blur-md ${
               opt.severity === Severity.HIGH ? 'bg-white/80 border-red-200 text-red-700' : 
               opt.severity === Severity.MEDIUM ? 'bg-white/80 border-amber-200 text-amber-700' : 'bg-white/80 border-emerald-200 text-emerald-700'
            }`}>
              {opt.severity} Priority
            </span>
          </div>

          {opt.codeSuggestion && (
            <div className="border-t border-slate-200/50 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/50">
              {opt.originalPattern && (
                <div className="p-6 bg-slate-50/30 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-700 uppercase mb-4 tracking-wider">
                    <AlertTriangle className="w-3 h-3" /> Current Pattern
                  </div>
                  <div className="font-mono text-sm text-slate-800 bg-white/70 p-4 rounded-xl border border-white/60 shadow-inner font-medium">
                    <pre className="whitespace-pre-wrap break-words">{opt.originalPattern}</pre>
                  </div>
                </div>
              )}

              <div className={`p-6 bg-white/40 backdrop-blur-sm relative ${!opt.originalPattern ? 'col-span-2' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                     <Code className="w-3 h-3" /> Optimized Code
                   </div>
                   <button 
                    onClick={() => copyToClipboard(opt.codeSuggestion!, idx)}
                    className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-white/60 border border-white/60 text-slate-700 hover:text-slate-900 hover:bg-white/80 transition-all font-bold shadow-sm"
                  >
                    {copiedIdx === idx ? <CheckCircle className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedIdx === idx ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="relative">
                  <pre className="relative text-sm font-mono text-emerald-800 overflow-x-auto p-4 bg-emerald-50/40 rounded-xl border border-emerald-100/60 shadow-inner font-medium">
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
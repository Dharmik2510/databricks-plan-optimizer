
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
      <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3 mb-8">
        <div className="p-2 bg-orange-100 rounded-lg border border-orange-200">
           <Zap className="w-6 h-6 text-orange-500" />
        </div>
        Performance Recommendations
      </h3>
      
      {optimizations.map((opt, idx) => (
        <div key={idx} className="bg-white/70 backdrop-blur-2xl rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden group transition-all hover:shadow-md hover:border-orange-200 hover:translate-y-[-1px]">
          
          <div className={`p-6 flex flex-col md:flex-row gap-5 justify-between items-start border-l-4 ${
            opt.severity === Severity.HIGH ? 'border-red-500 bg-red-50/50' : 
            opt.severity === Severity.MEDIUM ? 'border-amber-500 bg-amber-50/50' : 'border-emerald-500 bg-emerald-50/50'
          }`}>
            <div className="flex gap-5">
              <div className="mt-1 flex-shrink-0">
                {opt.severity === Severity.HIGH && <div className="p-2 bg-white text-red-500 rounded-lg border border-red-200 shadow-sm"><AlertTriangle className="w-6 h-6" /></div>}
                {opt.severity === Severity.MEDIUM && <div className="p-2 bg-white text-amber-500 rounded-lg border border-amber-200 shadow-sm"><AlertTriangle className="w-6 h-6" /></div>}
                {opt.severity === Severity.LOW && <div className="p-2 bg-white text-emerald-500 rounded-lg border border-emerald-200 shadow-sm"><CheckCircle className="w-6 h-6" /></div>}
              </div>
              <div>
                <h4 className="text-xl font-bold text-slate-900 tracking-tight">{opt.title}</h4>
                <p className="text-slate-600 mt-2 leading-relaxed text-base">{opt.description}</p>
              </div>
            </div>
            <span className={`text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider flex-shrink-0 border shadow-sm ${
               opt.severity === Severity.HIGH ? 'bg-white border-red-200 text-red-600' : 
               opt.severity === Severity.MEDIUM ? 'bg-white border-amber-200 text-amber-600' : 'bg-white border-emerald-200 text-emerald-600'
            }`}>
              {opt.severity} Priority
            </span>
          </div>

          {opt.codeSuggestion && (
            <div className="border-t border-slate-200 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              {opt.originalPattern && (
                <div className="p-6 bg-slate-50/50">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-600 uppercase mb-4 tracking-wider">
                    <AlertTriangle className="w-3 h-3" /> Current Pattern
                  </div>
                  <div className="font-mono text-sm text-slate-600 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                    <pre className="whitespace-pre-wrap break-words">{opt.originalPattern}</pre>
                  </div>
                </div>
              )}

              <div className={`p-6 bg-white relative ${!opt.originalPattern ? 'col-span-2' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-wider">
                     <Code className="w-3 h-3" /> Optimized Code
                   </div>
                   <button 
                    onClick={() => copyToClipboard(opt.codeSuggestion!, idx)}
                    className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
                  >
                    {copiedIdx === idx ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    {copiedIdx === idx ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="relative">
                  <pre className="relative text-sm font-mono text-emerald-700 overflow-x-auto p-4 bg-emerald-50/50 rounded-lg border border-emerald-100/50">
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

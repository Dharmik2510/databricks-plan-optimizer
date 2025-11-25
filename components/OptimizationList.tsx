
import React, { useState } from 'react';
import { OptimizationTip, Severity } from '../types';
import { AlertTriangle, CheckCircle, Zap, Copy, Code } from 'lucide-react';

interface Props {
  optimizations: OptimizationTip[];
}

export const OptimizationList: React.FC<Props> = ({ optimizations }) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  
  const totalTimeSaved = optimizations.reduce((sum, opt) => 
    sum + (opt.estimated_time_saved_seconds || 0), 0);
  const totalCostSaved = optimizations.reduce((sum, opt) => 
    sum + (opt.estimated_cost_saved_usd || 0), 0);
  const avgConfidence = optimizations.reduce((sum, opt) => 
    sum + (opt.confidence_score || 0), 0) / optimizations.length;

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3 mb-8">
        <div className="p-2 bg-orange-100 rounded-xl border border-orange-200 shadow-sm">
           <Zap className="w-6 h-6 text-orange-600" />
        </div>
        Performance Recommendations
      </h3>

      {/* Total Optimization Potential Summary Card */}
      {(totalTimeSaved > 0 || totalCostSaved > 0) && (
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-3xl shadow-sm border border-orange-200 p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <Zap className="w-5 h-5 text-orange-600" />
            </div>
            <h4 className="font-bold text-slate-900 text-lg">Total Optimization Potential</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Time Reduction Card */}
            <div className="bg-white p-4 rounded-2xl border border-orange-100 shadow-sm">
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Time Reduction</div>
              <div className="text-2xl font-bold text-blue-700">
                {totalTimeSaved < 60 
                  ? `${totalTimeSaved.toFixed(0)}s`
                  : totalTimeSaved < 3600
                  ? `${(totalTimeSaved / 60).toFixed(1)}m`
                  : `${(totalTimeSaved / 3600).toFixed(1)}h`}
              </div>
              <div className="text-xs text-slate-600 mt-1">per execution</div>
            </div>
            
            {/* Cost Savings Card */}
            <div className="bg-white p-4 rounded-2xl border border-orange-100 shadow-sm">
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Cost Savings</div>
              <div className="text-2xl font-bold text-emerald-700">${totalCostSaved.toFixed(2)}</div>
              <div className="text-xs text-slate-600 mt-1">per run · ${(totalCostSaved * 365).toFixed(0)}/year if daily</div>
            </div>
            
            {/* Average Confidence Card */}
            <div className="bg-white p-4 rounded-2xl border border-orange-100 shadow-sm">
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Avg Confidence</div>
              <div className="flex items-baseline gap-2">
                <div className={`text-2xl font-bold ${avgConfidence >= 80 ? 'text-emerald-700' : avgConfidence >= 60 ? 'text-amber-700' : 'text-slate-700'}`}>
                  {avgConfidence.toFixed(0)}%
                </div>
                <div className="text-xs text-slate-600">across {optimizations.length} issues</div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Individual Optimization Cards */}
      {optimizations.map((opt, idx) => (
        <div key={idx} className={`bg-white rounded-3xl shadow-sm border overflow-hidden group transition-all hover:shadow-md ${
          opt.severity === Severity.HIGH ? 'border-red-200' : 'border-slate-200 hover:border-orange-200'
        }`}>
          
          <div className={`p-6 flex flex-col md:flex-row gap-5 justify-between items-start border-l-4 ${
            opt.severity === Severity.HIGH ? 'border-red-500 bg-red-50' : 
            opt.severity === Severity.MEDIUM ? 'border-amber-500 bg-amber-50' : 'border-emerald-500 bg-emerald-50'
          }`}>
            <div className="flex gap-5 flex-1">
              {/* Severity Icon */}
              <div className="mt-1 flex-shrink-0">
                {opt.severity === Severity.HIGH && <div className="p-2 bg-white text-red-600 rounded-xl border border-red-200 shadow-sm"><AlertTriangle className="w-6 h-6" /></div>}
                {opt.severity === Severity.MEDIUM && <div className="p-2 bg-white text-amber-600 rounded-xl border border-amber-200 shadow-sm"><AlertTriangle className="w-6 h-6" /></div>}
                {opt.severity === Severity.LOW && <div className="p-2 bg-white text-emerald-600 rounded-xl border border-emerald-200 shadow-sm"><CheckCircle className="w-6 h-6" /></div>}
              </div>
              
              {/* Content Section */}
              <div className="flex-1">
                {/* Title with Confidence Score */}
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h4 className="text-xl font-bold text-slate-900 tracking-tight">{opt.title}</h4>
                  
                  {/* Confidence Score Badge */}
                  {opt.confidence_score && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-white rounded-lg border border-slate-200 text-xs">
                      <span className="text-slate-500 font-semibold">Confidence:</span>
                      <span className={`font-bold ${
                        opt.confidence_score >= 80 ? 'text-emerald-600' : 
                        opt.confidence_score >= 60 ? 'text-amber-600' : 'text-slate-600'
                      }`}>
                        {opt.confidence_score}%
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Description */}
                <p className="text-slate-800 mt-2 leading-relaxed text-base font-medium">{opt.description}</p>
                
                {/* Impact Metrics Badges */}
                {(opt.estimated_time_saved_seconds || opt.estimated_cost_saved_usd || opt.implementation_complexity) && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {/* Time Saved Badge */}
                    {opt.estimated_time_saved_seconds && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                        <span className="text-xs text-blue-600 font-bold">⏱️ Time Saved:</span>
                        <span className="text-sm font-bold text-blue-800">
                          {opt.estimated_time_saved_seconds < 60 
                            ? `${opt.estimated_time_saved_seconds.toFixed(0)}s`
                            : `${(opt.estimated_time_saved_seconds / 60).toFixed(1)}m`}
                        </span>
                      </div>
                    )}
                    
                    {/* Cost Saved Badge */}
                    {opt.estimated_cost_saved_usd && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <span className="text-xs text-emerald-600 font-bold">💰 Cost Saved:</span>
                        <span className="text-sm font-bold text-emerald-800">${opt.estimated_cost_saved_usd.toFixed(2)}/run</span>
                      </div>
                    )}
                    
                    {/* Implementation Complexity Badge */}
                    {opt.implementation_complexity && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg">
                        <span className="text-xs text-purple-600 font-bold">🔧 Complexity:</span>
                        <span className={`text-sm font-bold ${
                          opt.implementation_complexity === 'Low' ? 'text-emerald-700' :
                          opt.implementation_complexity === 'Medium' ? 'text-amber-700' : 'text-red-700'
                        }`}>{opt.implementation_complexity}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Affected Stages */}
                {opt.affected_stages && opt.affected_stages.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                    <span className="font-semibold">Affects Stages:</span>
                    <div className="flex gap-1 flex-wrap">
                      {opt.affected_stages.map((stage, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono font-bold text-slate-700">
                          {stage}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Severity Badge */}
            <span className={`text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider flex-shrink-0 border shadow-sm ${
               opt.severity === Severity.HIGH ? 'bg-white border-red-200 text-red-700' : 
               opt.severity === Severity.MEDIUM ? 'bg-white border-amber-200 text-amber-700' : 'bg-white border-emerald-200 text-emerald-700'
            }`}>
              {opt.severity} Priority
            </span>
          </div>

          {/* Code Suggestions Section */}
          {opt.codeSuggestion && (
            <div className="border-t border-slate-200 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              {/* Current Pattern (if exists) */}
              {opt.originalPattern && (
                <div className="p-6 bg-slate-50">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-700 uppercase mb-4 tracking-wider">
                    <AlertTriangle className="w-3 h-3" /> Current Pattern
                  </div>
                  <div className="font-mono text-sm text-slate-800 bg-white p-4 rounded-xl border border-slate-200 shadow-inner font-medium">
                    <pre className="whitespace-pre-wrap break-words">{opt.originalPattern}</pre>
                  </div>
                </div>
              )}

              {/* Optimized Code */}
              <div className={`p-6 bg-white relative ${!opt.originalPattern ? 'col-span-2' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                     <Code className="w-3 h-3" /> Optimized Code
                   </div>
                   <button 
                    onClick={() => copyToClipboard(opt.codeSuggestion!, idx)}
                    className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all font-bold shadow-sm"
                  >
                    {copiedIdx === idx ? <CheckCircle className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedIdx === idx ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="relative">
                  <pre className="relative text-sm font-mono text-emerald-800 overflow-x-auto p-4 bg-emerald-50 rounded-xl border border-emerald-100 shadow-inner font-medium">
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


import React from 'react';
import { ClusterRecommendation, SparkConfigRecommendation, QueryRewrite } from '../../shared/types';
import { Server, Settings, Code, ArrowRight, Copy, Check, Info } from 'lucide-react';

interface Props {
  clusterRec?: ClusterRecommendation;
  configRec?: SparkConfigRecommendation;
  rewrites?: QueryRewrite[];
}

export const AdvancedInsights: React.FC<Props> = ({ clusterRec, configRec, rewrites }) => {
  const [copied, setCopied] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Cluster Right-Sizing Advisor */}
      {clusterRec && (
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg">
              <Server className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Cluster Right-Sizing Advisor
            </h3>
          </div>

          <div className="flex flex-col md:flex-row gap-8 items-center">
            {/* Current Config */}
            <div className="flex-1 w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                Current Config
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {clusterRec.current.nodes}x {clusterRec.current.type}
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
                Rate: ${clusterRec.current.costPerHour.toFixed(2)}/hr
              </div>
            </div>

            <ArrowRight className="w-8 h-8 text-slate-300 dark:text-slate-600 hidden md:block" />

            {/* Optimized Config */}
            <div className="flex-1 w-full bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-6 border border-emerald-100 dark:border-emerald-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                Recommended
              </div>
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-2">
                Optimized Config
              </div>
              <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-300">
                {clusterRec.recommended.nodes}x {clusterRec.recommended.type}
              </div>
              <div className="text-emerald-700 dark:text-emerald-400 text-sm mt-1 font-bold">
                Rate: ${clusterRec.recommended.costPerHour.toFixed(2)}/hr
              </div>
            </div>
          </div>

          {/* Explanation if rates are same */}
          {clusterRec.current.costPerHour === clusterRec.recommended.costPerHour && (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-4 py-2 rounded-lg">
              <Info className="w-4 h-4" />
              <span>
                <strong>Note:</strong> Cluster hardware is already optimal. Savings will come from reducing
                <strong> execution time</strong> (see Performance Prediction).
              </span>
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 text-sm text-blue-900 dark:text-blue-300">
            <strong>Reasoning:</strong> {clusterRec.reasoning} <br />
            <span className="text-blue-700 dark:text-blue-400 mt-1 block font-bold">
              Expected Impact: {clusterRec.expectedImprovement}
            </span>
          </div>
        </section>
      )}

      {/* Auto-Generated Spark Configs */}
      {configRec && (
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-lg">
              <Settings className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Auto-Generated Spark Configs
            </h3>
          </div>
          <div className="bg-slate-900 dark:bg-black rounded-2xl p-6 relative overflow-hidden group border border-slate-800">
            <div className="absolute top-4 right-4">
              <button
                onClick={() =>
                  copyToClipboard(
                    Object.entries(configRec.configs)
                      .map(([k, v]) => `${k} = ${v}`)
                      .join('\n'),
                    'config'
                  )
                }
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                title="Copy to clipboard"
              >
                {copied === 'config' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <pre className="font-mono text-sm text-blue-300 overflow-x-auto">
              {Object.entries(configRec.configs).map(([key, value]) => (
                <div key={key} className="mb-1">
                  <span className="text-purple-400">spark.conf.set</span>(
                  <span className="text-emerald-300">"{key}"</span>,{' '}
                  <span className="text-orange-300">"{value}"</span>)
                </div>
              ))}
            </pre>
          </div>
          <div className="mt-4 text-sm text-slate-600 dark:text-slate-400 font-medium italic">
            Impact: {configRec.estimatedImpact}
          </div>
        </section>
      )}

      {/* Smart Query Rewrites */}
      {rewrites && rewrites.length > 0 && (
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-400 rounded-lg">
              <Code className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Smart Query Rewrites
            </h3>
          </div>
          <div className="space-y-6">
            {rewrites.map((rw, i) => (
              <div
                key={i}
                className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden"
              >
                <div className="bg-slate-50 dark:bg-slate-800 px-6 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Strategy: {rw.strategy}
                  </div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded border border-emerald-100 dark:border-emerald-800">
                    Speedup: {rw.expectedSpeedup}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-700">
                  <div className="p-4 bg-red-50/30 dark:bg-red-900/10">
                    <div className="text-xs font-bold text-red-700 dark:text-red-400 mb-2">
                      ORIGINAL
                    </div>
                    <pre className="text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                      {rw.original}
                    </pre>
                  </div>
                  <div className="p-4 bg-emerald-50/30 dark:bg-emerald-900/10">
                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2">
                      REWRITTEN
                    </div>
                    <pre className="text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                      {rw.rewritten}
                    </pre>
                  </div>
                </div>
                <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
                  <strong>Tradeoffs:</strong> {rw.tradeoffs}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};


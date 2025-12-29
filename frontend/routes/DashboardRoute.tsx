// frontend/routes/DashboardRoute.tsx
// Dashboard route component - Analysis workflow

import React from 'react';
import {
  Upload,
  FileText,
  Server,
  Cpu,
  Activity,
  Globe,
  GitBranch,
  Check,
  PlayCircle,
  Sparkles,
} from 'lucide-react';
import { EnhancedDagVisualizer } from '../components/EnhancedDagVisualizer';
import { OptimizationPanel } from '../components/optimizations/OptimizationPanel';
import { PredictivePanel } from '../components/PredictivePanel';
import { OptimizationPlayground } from '../components/OptimizationPlayground';
import AnalysisLoadingState from '../components/AnalysisLoadingState';
import { client } from '../api';
import { AppState, ActiveTab } from '../../shared/types';
import { useToast } from '../design-system/components';
import { useAnalysisStore } from '../store/useAnalysisStore';
import { usePredictionStore } from '../store/usePredictionStore';
import { useRepositoryStore } from '../store/useRepositoryStore';
import { useClusterStore } from '../store/useClusterStore';
import { useUIStore } from '../store/useUIStore';


export const DashboardRoute: React.FC = () => {
  const { addToast } = useToast();

  // Analysis Store
  const {
    result,
    appState,
    error,
    analysisTitle,
    textContent,
    inputMode,
    setResult,
    setAppState,
    setError,
    setAnalysisTitle,
    setTextContent,
    setInputMode,
  } = useAnalysisStore();

  // Prediction Store
  const { prediction, setPrediction } = usePredictionStore();

  // Repository Store
  const {
    repoConfig,
    repoFiles,
    isFetchingRepo,
    setRepoConfig,
    setRepoFiles,
    setIsFetchingRepo,
  } = useRepositoryStore();

  // Cluster Store
  const {
    clusterContext,
    availableInstances,
    cloudProvider,
    setClusterContext,
    setCloudProvider,
  } = useClusterStore();

  // UI Store
  const { dagExpanded, selectedNodeId, setDagExpanded, setSelectedNodeId, setActiveTab } =
    useUIStore();



  const isValidGitHubUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      return hostname === 'github.com' || hostname.endsWith('.github.com');
    } catch {
      return false;
    }
  };

  const handleAnalyze = async () => {
    if (!textContent.trim()) {
      addToast({
        type: 'error',
        title: 'Plan Required',
        description: 'Please paste or upload a Spark execution plan first',
      });
      return;
    }
    setAppState(AppState.ANALYZING);
    setError(null);
    setPrediction(null);
    addToast({ type: 'info', title: 'Analysis Started', description: 'Starting analysis...' });
    try {
      // Auto-fetch repo if URL provided but files not loaded
      let currentRepoFiles = repoFiles;
      if (repoConfig.url && repoFiles.length === 0) {
        if (!isValidGitHubUrl(repoConfig.url)) {
          addToast({
            type: 'error',
            title: 'Invalid Repository URL',
            description: 'Please enter a valid GitHub repository URL',
          });
          setAppState(AppState.ERROR);
          setError(
            'Invalid URL. Please enter a valid GitHub repository URL (e.g., https://github.com/username/repo)'
          );
          return;
        }

        try {
          const config = { ...repoConfig, branch: repoConfig.branch || 'main' };
          currentRepoFiles = await client.fetchRepo(config, {
            maxFiles: 50,
            includeTests: false,
            fileExtensions: ['.py', '.scala', '.sql', '.ipynb'],
          });
          setRepoFiles(currentRepoFiles);
          addToast({
            type: 'success',
            title: 'Repo Connected',
            description: `Connected to repository: ${repoConfig.url}`,
          });
        } catch (repoErr: any) {
          console.warn('Repo fetch failed, proceeding without mapping', repoErr);
          setError(`Repo Connect Warning: ${repoErr.message}`);
          addToast({
            type: 'warning',
            title: 'Repo Connection Failed',
            description: 'Repository connection failed, continuing without code mapping',
          });
        }
      }

      const data = await client.analyzeDag(
        textContent,
        currentRepoFiles,
        {
          enableCodeMapping: true,
          enableDependencyAnalysis: true,
          confidenceThreshold: 50,
          maxMappingsPerNode: 3,
          deepAnalysis: true,
          title: analysisTitle,
        },
        clusterContext
      );
      setResult(data);
      try {
        const pred = client.predictAtScale(data, 100);
        setPrediction(pred);
      } catch (predError) {
        console.warn('Predictive analysis failed:', predError);
      }
      setAppState(AppState.SUCCESS);
      setActiveTab(ActiveTab.DASHBOARD);
      addToast({
        type: 'success',
        title: 'Analysis Complete',
        description: `Found ${data.optimizations.length} optimization${data.optimizations.length !== 1 ? 's' : ''
          }`,
      });
    } catch (e: any) {
      setError(`Analysis Failed: ${e.message}`);
      setAppState(AppState.ERROR);
      addToast({ type: 'error', title: 'Analysis Failed', description: e.message });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setTextContent(event.target?.result as string);
        setInputMode('text');
        addToast({
          type: 'success',
          title: 'File Loaded',
          description: `File "${file.name}" loaded successfully`,
        });
      };
      reader.onerror = () => {
        addToast({ type: 'error', title: 'Upload Failed', description: 'Failed to read file' });
      };
      reader.readAsText(file);
    }
  };

  const insertDemoData = () => {
    const demo = `== Physical Plan ==\n  AdaptiveSparkPlan isFinalPlan=true\n  +- == Final Plan ==\n    ResultQueryStage 1 (est. rows: 2.5M, size: 180MB)\n    +- Project [user_id#12, sum(amount)#45 AS total_spend#99]\n        +- SortAggregate(key=[user_id#12], functions=[sum(amount#45)], output=[user_id#12, total_spend#99])\n          +- Sort [user_id#12 ASC NULLS FIRST], true, 0\n              +- Exchange hashpartitioning(user_id#12, 200), ENSURE_REQUIREMENTS, [id=#105]\n                +- SortAggregate(key=[user_id#12], functions=[partial_sum(amount#45)], output=[user_id#12, sum#108])\n                    +- Sort [user_id#12 ASC NULLS FIRST], false, 0\n                      +- Project [user_id#12, amount#45]\n                          +- BroadcastNestedLoopJoin BuildRight, Inner (WARNING: Missing Join Condition - Cartesian Product)\n                            :- Filter (isnotnull(transaction_date#40) AND (transaction_date#40 >= 2023-01-01))\n                            :  +- FileScan parquet db.transactions[user_id#12, transaction_date#40, amount#45] \n                            :     Batched: true, \n                            :     DataFilters: [isnotnull(transaction_date#40)], \n                            :     Format: Parquet, \n                            :     Location: InMemoryFileIndex(1 paths)[s3://bucket/data/transactions], \n                            :     PartitionFilters: [], \n                            :     PushedFilters: [IsNotNull(transaction_date)], \n                            :     ReadSchema: struct<user_id:string,transaction_date:date,amount:double>\n                            :     Statistics: rows=15000000, size=1.2GB\n                            +- BroadcastExchange IdentityBroadcastMode, [id=#98] (size: 45MB)\n                                +- Filter ((status#20 = 'active') AND isnotnull(user_id#10))\n                                  +- FileScan csv db.users[user_id#10, status#20] \n                                      Batched: false,\n                                      Format: CSV, \n                                      Location: InMemoryFileIndex(1 paths)[s3://bucket/data/users], \n                                      PartitionFilters: [], \n                                      PushedFilters: [EqualTo(status,active), IsNotNull(user_id)], \n                                      ReadSchema: struct<user_id:string,status:string>\n                                      Statistics: rows=500000, size=25MB`;
    setTextContent(demo);
    addToast({
      type: 'info',
      title: 'Demo Loaded',
      description: 'Demo execution plan loaded successfully',
    });
  };

  const enrichOptimizations = (optimizations: any[]) => {
    const currentInstance = availableInstances.find((i) => i.id === clusterContext.clusterType);
    const pricePerHour = currentInstance?.pricePerHour || 0.5;

    return optimizations.map((opt) => {
      let relatedCodeSnippets = opt.relatedCodeSnippets || [];

      if (opt.affected_stages && opt.affected_stages.length > 0 && result?.dagNodes) {
        const relevantNodes = result.dagNodes.filter((node) =>
          opt.affected_stages!.some((stageId: string) => node.id.includes(stageId))
        );

        const newSnippets = relevantNodes.filter((node) => node.mappedCode).map((node) => node.mappedCode!);

        const existingKeys = new Set(relatedCodeSnippets.map((s: any) => `${s.filePath}:${s.lineNumber}`));
        newSnippets.forEach((s) => {
          const key = `${s.filePath}:${s.lineNumber}`;
          if (!existingKeys.has(key)) {
            relatedCodeSnippets.push(s);
            existingKeys.add(key);
          }
        });
      }

      if (opt.estimated_time_saved_seconds) {
        const costSaved = (opt.estimated_time_saved_seconds / 3600) * pricePerHour;
        return { ...opt, estimated_cost_saved_usd: costSaved, relatedCodeSnippets };
      }
      return { ...opt, relatedCodeSnippets };
    });
  };

  return (
    <>
      {appState === AppState.ANALYZING && <AnalysisLoadingState currentStep={2} estimatedTime={10000} />}

      {(appState === AppState.IDLE || appState === AppState.ERROR) && (
        <div className="flex flex-col min-h-[75vh] animate-fade-in gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
            {/* LEFT: Input Area */}
            <div className="lg:col-span-2 w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative z-10 flex flex-col transition-colors">
              <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                {['text', 'file'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setInputMode(mode as any)}
                    className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${inputMode === mode
                        ? 'text-orange-700 dark:text-orange-400 bg-white dark:bg-slate-900 border-b-2 border-orange-500 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                  >
                    {mode === 'text' ? <FileText className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                    {mode === 'text' ? 'Paste Plan / Logs' : 'Upload File'}
                  </button>
                ))}
              </div>
              <div className="p-8 relative flex-1 flex flex-col">
                {inputMode === 'text' ? (
                  <div className="relative group flex-1">
                    <textarea
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      className="w-full h-full min-h-[400px] p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-sm rounded-2xl border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none resize-none shadow-inner leading-relaxed transition-all placeholder-slate-400 dark:placeholder-slate-600"
                      placeholder="Paste your 'EXPLAIN EXTENDED' output here..."
                    ></textarea>
                    <div className="absolute top-4 right-4">
                      <button
                        onClick={insertDemoData}
                        className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 hover:border-orange-200 dark:hover:border-orange-800 transition-all cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-orange-500 group-hover:rotate-12 transition-transform" />
                        <span className="text-xs font-semibold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent group-hover:from-orange-500 group-hover:to-red-500">
                          Load Demo Plan
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="h-full min-h-[400px] border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all relative group cursor-pointer">
                    <div className="p-5 bg-white dark:bg-slate-800 rounded-full shadow-md mb-4 group-hover:scale-110 transition-transform text-orange-600 dark:text-orange-400 border border-slate-200 dark:border-slate-700">
                      <Upload className="w-8 h-8" />
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 font-bold text-lg">Click to Upload</p>
                    <input
                      type="file"
                      accept=".json,.txt,.log"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Configuration Panel */}
            <AnalysisConfigPanel
              analysisTitle={analysisTitle}
              setAnalysisTitle={setAnalysisTitle}
              clusterContext={clusterContext}
              setClusterContext={setClusterContext}
              repoConfig={repoConfig}
              setRepoConfig={setRepoConfig}
              repoFiles={repoFiles}
              handleAnalyze={handleAnalyze}
              textContent={textContent}
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-2xl border border-red-200 dark:border-red-800 text-sm flex items-center gap-3 animate-fade-in font-medium shadow-sm">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              {error}
            </div>
          )}
        </div>
      )}

      {result && appState === AppState.SUCCESS && (
        <div className="space-y-8 animate-fade-in pb-20" id="dashboard-container">
          <ExecutiveSummary summary={result.summary} />
          <div id="dag-visualizer-section">
            <EnhancedDagVisualizer
              nodes={result.dagNodes}
              links={result.dagLinks}
              optimizations={enrichOptimizations(result.optimizations)}
              isExpanded={dagExpanded}
              onToggleExpand={setDagExpanded}
              highlightedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onMapToCode={() => setActiveTab(ActiveTab.CODE_MAP)}
            />
          </div>
          <OptimizationPanel
            optimizations={enrichOptimizations(result.optimizations)}
            onViewInDag={(opt) => {
              setDagExpanded(true);
              if (opt.affected_stages && opt.affected_stages.length > 0) {
                const targetStage = opt.affected_stages[0];
                const matchingNode = result.dagNodes.find((n) => n.id.includes(targetStage));
                if (matchingNode) {
                  setSelectedNodeId(matchingNode.id);
                }
              }
              setTimeout(() => {
                const element = document.getElementById('dag-visualizer-section');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }, 100);
            }}
          />
          {prediction && (
            <>
              <PredictivePanel prediction={prediction} />
              <OptimizationPlayground
                optimizations={result.optimizations}
                baselineDuration={result.estimatedDurationMin || 15}
              />
            </>
          )}
        </div>
      )}
    </>
  );
};

const AnalysisConfigPanel: React.FC<any> = ({
  analysisTitle,
  setAnalysisTitle,
  clusterContext,
  setClusterContext,
  repoConfig,
  setRepoConfig,
  repoFiles,
  handleAnalyze,
  textContent,
}) => {
  const { availableInstances, loadingInstances, availableRegions, loadingRegions } = useClusterStore();

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative z-10 flex flex-col h-full transition-colors">
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800">
          <Server className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Analysis Settings</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Configure runtime and metadata.
          </p>
        </div>
      </div>
      <div className="p-6 space-y-6 flex-1 bg-white dark:bg-slate-900">
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
            Analysis Title
          </label>
          <input
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            placeholder="e.g. Q4 Revenue Query Optimization"
            value={analysisTitle}
            onChange={(e) => setAnalysisTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
            Cloud Region
          </label>
          <div className="relative">
            <select
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 appearance-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:opacity-50"
              value={clusterContext.region}
              onChange={(e) => setClusterContext({ ...clusterContext, region: e.target.value })}
              disabled={loadingRegions}
            >
              {loadingRegions ? (
                <option>Loading regions...</option>
              ) : (
                availableRegions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))
              )}
            </select>
            <div className="absolute right-4 top-3.5 pointer-events-none text-slate-400">
              <Globe className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
            Cluster Type
          </label>
          <div className="relative">
            <select
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 appearance-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:opacity-50"
              value={clusterContext.clusterType}
              onChange={(e) => setClusterContext({ ...clusterContext, clusterType: e.target.value })}
              disabled={loadingInstances}
            >
              {loadingInstances ? (
                <option>Loading instance types...</option>
              ) : (
                availableInstances.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.displayName}
                  </option>
                ))
              )}
            </select>
            <div className="absolute right-4 top-3.5 pointer-events-none text-slate-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
            Databricks Runtime (DBR)
          </label>
          <div className="relative">
            <select
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 appearance-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              value={clusterContext.dbrVersion}
              onChange={(e) => setClusterContext({ ...clusterContext, dbrVersion: e.target.value })}
            >
              <option>15.2 (Latest)</option>
              <option>14.3 LTS</option>
              <option>13.3 LTS</option>
              <option>12.2 LTS</option>
              <option>11.3 LTS</option>
            </select>
            <div className="absolute right-4 top-3.5 pointer-events-none text-slate-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
            Extra Spark Properties
          </label>
          <textarea
            className="w-full flex-1 min-h-[150px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none placeholder-slate-400 dark:placeholder-slate-600"
            placeholder="spark.sql.shuffle.partitions=200&#10;spark.executor.memory=8g..."
            value={clusterContext.sparkConf}
            onChange={(e) => setClusterContext({ ...clusterContext, sparkConf: e.target.value })}
          ></textarea>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
            Repository Context{' '}
            <span className="text-xs font-normal text-slate-400 lowercase">(optional)</span>
          </label>
          <div className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <input
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                placeholder="https://github.com/org/repo"
                value={repoConfig.url}
                onChange={(e) => setRepoConfig({ ...repoConfig, url: e.target.value })}
              />
              <div className="absolute right-4 top-3.5 pointer-events-none text-slate-400">
                <GitBranch className="w-4 h-4" />
              </div>
            </div>
          </div>
          {repoConfig.url && (
            <input
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none mb-2"
              placeholder="Personal Access Token (for private repos)"
              type="password"
              value={repoConfig.token}
              onChange={(e) => setRepoConfig({ ...repoConfig, token: e.target.value })}
            />
          )}
          {repoFiles.length > 0 && (
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <Check className="w-3 h-3" /> {repoFiles.length} files linked
            </div>
          )}
        </div>
      </div>
      <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
        <button
          data-tour="new-analysis"
          onClick={handleAnalyze}
          disabled={!textContent.trim()}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg shadow-orange-500/20 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          <PlayCircle className="w-6 h-6" /> Analyze Plan
        </button>
      </div>
    </div>
  );
};

const ExecutiveSummary: React.FC<{ summary: string }> = ({ summary }) => (
  <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 relative overflow-hidden transition-colors">
    <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500"></div>
    <div className="flex items-start gap-6 relative z-10">
      <div className="p-4 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-2xl border border-orange-100 dark:border-orange-800 hidden sm:block shadow-sm">
        <Activity className="w-8 h-8" />
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-4">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Executive Summary
            </h3>
          </div>
          <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-orange-700 dark:text-orange-400 text-xs font-bold uppercase rounded-full tracking-wide shadow-sm">
            AI Generated
          </span>
        </div>
        <p className="text-slate-800 dark:text-slate-300 leading-relaxed text-lg font-medium">{summary}</p>
      </div>
    </div>
  </section>
);

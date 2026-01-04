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
  ChevronDown,
} from 'lucide-react';
import { ClusterFinder } from '../components/inputs/ClusterFinder';
import { EnhancedDagVisualizer } from '../components/EnhancedDagVisualizer';
import { OptimizationPanel } from '../components/optimizations/OptimizationPanel';
// TIER 0: PredictivePanel removed - relies on fabricated predictions
import AnalysisLoadingState from '../components/AnalysisLoadingState';
import { PlanValidationFlow } from '../components/validation';
import { client } from '../api';
import { AppState, ActiveTab } from '../../shared/types';
import { useToast } from '../design-system/components';
import { useAnalysisStore } from '../store/useAnalysisStore';
import { usePredictionStore } from '../store/usePredictionStore';
import { useRepositoryStore } from '../store/useRepositoryStore';
import { useClusterStore } from '../store/useClusterStore';
import { useUIStore } from '../store/useUIStore';
import { useValidationStore } from '../store/useValidationStore';


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

  // TIER 0: Prediction store removed - no fabricated predictions
  // const { prediction, setPrediction } = usePredictionStore();

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

  // Validation Store
  const { stage: validationStage, result: validationResult, reset: resetValidation } =
    useValidationStore();

  // Track if plan has been validated
  const isPlanValidated = validationStage === 'success' && validationResult?.is_valid;



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
    if (!analysisTitle.trim()) {
      addToast({
        type: 'error',
        title: 'Title Required',
        description: 'Please provide a name for this analysis',
      });
      return;
    }
    setAppState(AppState.ANALYZING);
    setError(null);
    // TIER 0: setPrediction removed - no fabricated predictions
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
      // TIER 0: Removed prediction calculation - no fabricated time/cost estimates
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

  // TIER 0: Simplified enrichOptimizations - no cost estimation from fabricated time savings
  const enrichOptimizations = (optimizations: any[]) => {
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

      // TIER 0: Do not calculate cost from time - return as-is
      return { ...opt, relatedCodeSnippets };
    });
  };

  return (
    <>
      {appState === AppState.ANALYZING && <AnalysisLoadingState currentStep={2} estimatedTime={10000} />}

      {(appState === AppState.IDLE || appState === AppState.ERROR) && (
        <div className="flex flex-col min-h-[75vh] animate-fade-in gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
            {/* LEFT: Validation Flow */}
            <div className="lg:col-span-2">
              <PlanValidationFlow
                textContent={textContent}
                setTextContent={setTextContent}
                inputMode={inputMode}
                setInputMode={setInputMode}
                onValidationComplete={() => {
                  // Plan is validated, user can now proceed to analysis config
                }}
                onInsertDemo={insertDemoData}
                onFileUpload={handleFileUpload}
              />
            </div>

            {/* RIGHT: Configuration Panel - Show when plan is validated */}
            {isPlanValidated && (
              <AnalysisConfigPanel
                analysisTitle={analysisTitle}
                setAnalysisTitle={setAnalysisTitle}
                clusterContext={clusterContext}
                setClusterContext={setClusterContext}
                handleAnalyze={handleAnalyze}
                textContent={textContent}
              />
            )}

            {/* RIGHT: Placeholder when not validated */}
            {!isPlanValidated && (
              <div className="w-full bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative z-10 flex flex-col items-center justify-center p-8 transition-colors min-h-[400px]">
                <div className="text-center space-y-4">
                  <div className="inline-flex p-4 bg-slate-200 dark:bg-slate-700 rounded-2xl">
                    <Server className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400 mb-2">
                      Analysis Settings
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-500 max-w-[200px]">
                      Validate your physical plan first to configure analysis settings
                    </p>
                  </div>
                </div>
              </div>
            )}
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
          {/* TIER 0: PredictivePanel and OptimizationPlayground removed - rely on fabricated predictions */}
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
  handleAnalyze,
  textContent,
}) => {
  const {
    availableInstances,
    loadingInstances,
    availableRegions,
    loadingRegions,
    cloudProvider,
    setCloudProvider
  } = useClusterStore();

  const [isFinderOpen, setIsFinderOpen] = React.useState(false);

  // Find current instance object for display
  const currentInstance = availableInstances.find(i => i.id === clusterContext.clusterType);

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative z-10 flex flex-col h-full transition-colors">
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-3">
        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <Server className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Analysis Settings</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Configure runtime and metadata.
          </p>
        </div>
      </div>
      <div className="p-6 space-y-6 flex-1 bg-white dark:bg-slate-900 overflow-y-auto">
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
            Analysis Title <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            placeholder="e.g. Q4 Revenue Query Optimization"
            value={analysisTitle}
            onChange={(e) => setAnalysisTitle(e.target.value)}
          />
        </div>

        {/* Cloud Provider Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
            Cloud Provider
          </label>
          <div className="grid grid-cols-3 gap-2">
            {['aws', 'azure', 'gcp'].map((provider) => (
              <button
                key={provider}
                disabled={provider !== 'aws'}
                title={provider !== 'aws' ? 'Coming Soon' : undefined}
                onClick={() => setCloudProvider(provider as any)}
                className={`py-2 px-3 rounded-lg border text-sm font-bold transition-all ${cloudProvider === provider
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md transform scale-105'
                  : provider !== 'aws'
                    ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-70'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-emerald-300 dark:hover:border-emerald-700'
                  }`}
              >
                {{ aws: 'AWS', azure: 'Azure', gcp: 'GCP' }[provider]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
            Cloud Region
          </label>
          <div className="relative">
            <select
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 appearance-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none disabled:opacity-50"
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

          <button
            onClick={() => setIsFinderOpen(true)}
            disabled={loadingInstances}
            className="w-full text-left px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold flex items-center justify-between hover:border-emerald-500 transition-colors group min-w-0"
          >
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              {loadingInstances ? (
                <span className="text-slate-500 text-sm">Loading instances...</span>
              ) : (
                <>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 truncate">
                    {currentInstance?.name || clusterContext.clusterType || 'Select Instance'}
                  </span>
                  {currentInstance && (
                    <span className="text-xs text-slate-500 font-normal whitespace-nowrap hidden sm:inline-block">
                      ({currentInstance.vCPUs}v / {currentInstance.memoryGB}GiB)
                    </span>
                  )}
                </>
              )}
            </div>
            <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 flex-shrink-0" />
          </button>

          <ClusterFinder
            isOpen={isFinderOpen}
            onClose={() => setIsFinderOpen(false)}
            onSelect={(inst) => setClusterContext({ ...clusterContext, clusterType: inst.id })}
            instances={availableInstances}
            loading={loadingInstances}
            currentInstance={currentInstance}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
            Databricks Runtime (DBR)
          </label>
          <div className="relative">
            <select
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 appearance-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
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
            className="w-full flex-1 min-h-[150px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none placeholder-slate-400 dark:placeholder-slate-600"
            placeholder="spark.sql.shuffle.partitions=200&#10;spark.executor.memory=8g..."
            value={clusterContext.sparkConf}
            onChange={(e) => setClusterContext({ ...clusterContext, sparkConf: e.target.value })}
          ></textarea>
        </div>


      </div>
      <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
        <button
          data-tour="new-analysis"
          onClick={handleAnalyze}
          disabled={!textContent.trim() || !analysisTitle.trim()}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg shadow-orange-500/20 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          <PlayCircle className="w-6 h-6" /> Analyze Plan
        </button>
      </div>
    </div>
  );
};

const ExecutiveSummary: React.FC<{ summary: string }> = ({ summary }) => (
  <section className="bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 md:p-8 relative overflow-hidden transition-colors">
    <div className="absolute top-0 left-0 w-1 md:w-1.5 h-full bg-orange-500"></div>
    <div className="flex items-start gap-3 md:gap-6 relative z-10">
      <div className="p-3 md:p-4 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-xl md:rounded-2xl border border-orange-100 dark:border-orange-800 hidden sm:block shadow-sm">
        <Activity className="w-6 h-6 md:w-8 md:h-8" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2 md:mb-3">
          <h3 className="text-lg md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Executive Summary
          </h3>
          <span className="self-start px-2 md:px-3 py-0.5 md:py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-orange-700 dark:text-orange-400 text-[10px] md:text-xs font-bold uppercase rounded-full tracking-wide shadow-sm">
            AI Generated
          </span>
        </div>
        <p className="text-slate-800 dark:text-slate-300 leading-relaxed text-sm md:text-lg font-medium">{summary}</p>
      </div>
    </div>
  </section>
);

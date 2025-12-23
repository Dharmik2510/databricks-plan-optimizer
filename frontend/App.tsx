
import React, { useState, useEffect } from 'react';
import { Upload, Activity, Layers, BookOpen, PlayCircle, MessageSquare, LayoutDashboard, DollarSign, LogOut, FileText, GitBranch, Radio, Sparkles, BrainCircuit, Plus, FileClock, ChevronRight, Home, Search, Server, Cpu, Settings, Moon, Sun, Monitor, Globe, Check, FileCode2 } from 'lucide-react';
import { PlanCodeMapper } from './components/agent/PlanCodeMapper';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EnhancedDagVisualizer } from './components/EnhancedDagVisualizer';
import { ResourceChart } from './components/ResourceChart';
import { OptimizationPanel } from './components/optimizations/OptimizationPanel';
import { ChatInterface } from './components/ChatInterface';
import { CostEstimator } from './components/CostEstimator';
import { CodeMapper } from './components/CodeMapper';
import { LiveMonitor } from './components/LiveMonitor';
import { PredictivePanel } from './components/PredictivePanel';

import { OptimizationPlayground } from './components/OptimizationPlayground';
import { AdvancedInsights } from './components/AdvancedInsights';
import { LoadingScreen } from './components/LoadingScreen';
import { UserGuideModal } from './components/guide/UserGuideModal';
import { ComingSoonModal } from './components/common/ComingSoonModal';

import { RepositoryPanel } from './components/repository/RepositoryPanel';
import { RepoConnectForm } from './components/repository/RepoConnectForm';
import { client } from './api';
import { AnalysisResult, AppState, ActiveTab, RepoConfig, RepoFile, PerformancePrediction, ClusterContext, CloudInstance } from '../shared/types';
import { ThemeProvider, useTheme } from './ThemeContext';
import { useAuth } from './store/AuthContext';
import { AuthPage } from './components/auth/AuthPage';
import { UserMenu } from './components/auth/UserMenu';
import { RecentAnalyses } from './components/RecentAnalyses';
import { HistoryPage } from './components/HistoryPage';

const DEMO_REPO_FILES: RepoFile[] = [
  {
    path: "src/jobs/revenue_analysis.py",
    content: `from pyspark.sql import SparkSession\nfrom pyspark.sql.functions import col, sum\n\ndef run_job():\n    spark = SparkSession.builder.appName("RevenueAnalytics").getOrCreate()\n    # 1. READ TRANSACTIONS\n    txns_df = spark.read.parquet("s3://bucket/data/transactions")\n    # Filter for 2023 onwards\n    recent_txns = txns_df.filter(col("transaction_date") >= "2023-01-01")\n    # 2. READ USERS\n    users_df = spark.read.format("csv").option("header", "true").load("s3://bucket/data/users")\n    active_users = users_df.filter(col("status") == "active")\n    # 3. THE JOIN (The Problem Area)\n    # BroadcastNestedLoopJoin BuildRight, Inner\n    raw_joined = recent_txns.join(active_users)\n    # 4. AGGREGATION\n    report = raw_joined.groupBy("user_id").agg(sum("amount").alias("total_spend")).orderBy("user_id")\n    report.explain(True)\n    report.collect()\n\nif __name__ == "__main__":\n    run_job()`
  }
];

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  const [inputMode, setInputMode] = useState<'file' | 'text'>('text');
  const [textContent, setTextContent] = useState('');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.HOME);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [prediction, setPrediction] = useState<PerformancePrediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisTitle, setAnalysisTitle] = useState('');

  const [repoConfig, setRepoConfig] = useState<RepoConfig>({ url: '', branch: 'main', token: '' });
  const [repoFiles, setRepoFiles] = useState<RepoFile[]>([]);
  const [isFetchingRepo, setIsFetchingRepo] = useState(false);

  // Cluster Context State
  const [clusterContext, setClusterContext] = useState<ClusterContext>({
    clusterType: 'm5.xlarge',
    dbrVersion: '13.3 LTS',
    sparkConf: '',
    region: 'us-east-1'
  });

  const [availableInstances, setAvailableInstances] = useState<CloudInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [cloudProvider, setCloudProvider] = useState<'aws' | 'azure' | 'gcp'>('aws');
  const [availableRegions, setAvailableRegions] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingRegions, setLoadingRegions] = useState(false);

  // Modal State
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [comingSoonFeature, setComingSoonFeature] = useState('');

  // DAG Visualization State
  const [dagExpanded, setDagExpanded] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Fetch regions when cloud provider changes
  useEffect(() => {
    const loadRegions = async () => {
      setLoadingRegions(true);
      try {
        const response = await client.get(`/pricing/regions?cloud=${cloudProvider}`) as any;
        setAvailableRegions(response.regions || []);
        // Set first region as default if current region is not in the list
        if (response.regions && response.regions.length > 0) {
          const regionIds = response.regions.map((r: any) => r.id);
          if (!regionIds.includes(clusterContext.region)) {
            setClusterContext(prev => ({ ...prev, region: response.regions[0].id }));
          }
        }
      } catch (e) {
        console.error("Failed to load regions", e);
        // Fallback to default regions
        setAvailableRegions([
          { id: 'us-east-1', name: 'US East (N. Virginia)' },
          { id: 'us-west-2', name: 'US West (Oregon)' },
        ]);
      } finally {
        setLoadingRegions(false);
      }
    };
    loadRegions();
  }, [cloudProvider]);

  // Fetch instances when region or cloud provider changes
  useEffect(() => {
    const loadInstances = async () => {
      setLoadingInstances(true);
      try {
        const instances = await client.getCloudInstances(clusterContext.region || 'us-east-1', cloudProvider);
        setAvailableInstances(instances);
        // Default to first if current selection is invalid
        if (!instances.some(i => i.id === clusterContext.clusterType)) {
          setClusterContext(prev => ({ ...prev, clusterType: instances[0]?.id || '' }));
        }
      } catch (e) {
        console.error("Failed to load instances", e);
      } finally {
        setLoadingInstances(false);
      }
    };
    loadInstances();
  }, [clusterContext.region, cloudProvider]);

  const handleFetchRepo = async () => {
    if (!repoConfig.url) return;
    setIsFetchingRepo(true);
    setError(null);
    try {
      const files = await client.fetchRepo(repoConfig, { maxFiles: 50, includeTests: false, fileExtensions: ['.py', '.scala', '.sql', '.ipynb'] });
      setRepoFiles(files);
    } catch (e: any) {
      setError(`Repo Error: ${e.message}`);
    } finally { setIsFetchingRepo(false); }
  };

  const loadDemoRepo = () => { setRepoFiles(DEMO_REPO_FILES); setRepoConfig({ ...repoConfig, url: 'DEMO_MODE_ACTIVE' }); };

  const handleAnalyze = async () => {
    if (!textContent.trim()) return;
    setAppState(AppState.ANALYZING);
    setError(null);
    setPrediction(null);
    try {
      // Auto-fetch repo if URL provided but files not loaded
      let currentRepoFiles = repoFiles;
      if (repoConfig.url && repoFiles.length === 0) {
        try {
          // Default to main if not specified
          const config = { ...repoConfig, branch: repoConfig.branch || 'main' };
          currentRepoFiles = await client.fetchRepo(config, { maxFiles: 50, includeTests: false, fileExtensions: ['.py', '.scala', '.sql', '.ipynb'] });
          setRepoFiles(currentRepoFiles);
        } catch (repoErr: any) {
          console.warn("Repo fetch failed, proceeding without mapping", repoErr);
          setError(`Repo Connect Warning: ${repoErr.message}`);
          // We continue analysis even if repo fails, just without mapping
        }
      }

      const data = await client.analyzeDag(
        textContent,
        currentRepoFiles,
        { enableCodeMapping: true, enableDependencyAnalysis: true, confidenceThreshold: 50, maxMappingsPerNode: 3, deepAnalysis: true, title: analysisTitle },
        clusterContext
      );
      setResult(data);
      try {
        const pred = client.predictAtScale(data, 100);
        setPrediction(pred);
      } catch (predError) { console.warn("Predictive analysis failed:", predError); }
      setAppState(AppState.SUCCESS);
      setActiveTab(ActiveTab.DASHBOARD);
    } catch (e: any) {
      setError(`Analysis Failed: ${e.message}`);
      setAppState(AppState.ERROR);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => { setTextContent(event.target?.result as string); setInputMode('text'); };
      reader.readAsText(file);
    }
  };

  const insertDemoData = () => {
    const demo = `== Physical Plan ==\n  AdaptiveSparkPlan isFinalPlan=true\n  +- == Final Plan ==\n    ResultQueryStage 1 (est. rows: 2.5M, size: 180MB)\n    +- Project [user_id#12, sum(amount)#45 AS total_spend#99]\n        +- SortAggregate(key=[user_id#12], functions=[sum(amount#45)], output=[user_id#12, total_spend#99])\n          +- Sort [user_id#12 ASC NULLS FIRST], true, 0\n              +- Exchange hashpartitioning(user_id#12, 200), ENSURE_REQUIREMENTS, [id=#105]\n                +- SortAggregate(key=[user_id#12], functions=[partial_sum(amount#45)], output=[user_id#12, sum#108])\n                    +- Sort [user_id#12 ASC NULLS FIRST], false, 0\n                      +- Project [user_id#12, amount#45]\n                          +- BroadcastNestedLoopJoin BuildRight, Inner (WARNING: Missing Join Condition - Cartesian Product)\n                            :- Filter (isnotnull(transaction_date#40) AND (transaction_date#40 >= 2023-01-01))\n                            :  +- FileScan parquet db.transactions[user_id#12, transaction_date#40, amount#45] \n                            :     Batched: true, \n                            :     DataFilters: [isnotnull(transaction_date#40)], \n                            :     Format: Parquet, \n                            :     Location: InMemoryFileIndex(1 paths)[s3://bucket/data/transactions], \n                            :     PartitionFilters: [], \n                            :     PushedFilters: [IsNotNull(transaction_date)], \n                            :     ReadSchema: struct<user_id:string,transaction_date:date,amount:double>\n                            :     Statistics: rows=15000000, size=1.2GB\n                            +- BroadcastExchange IdentityBroadcastMode, [id=#98] (size: 45MB)\n                                +- Filter ((status#20 = 'active') AND isnotnull(user_id#10))\n                                  +- FileScan csv db.users[user_id#10, status#20] \n                                      Batched: false, 
                                      Format: CSV, \n                                      Location: InMemoryFileIndex(1 paths)[s3://bucket/data/users], \n                                      PartitionFilters: [], \n                                      PushedFilters: [EqualTo(status,active), IsNotNull(user_id)], \n                                      ReadSchema: struct<user_id:string,status:string>\n                                      Statistics: rows=500000, size=25MB`;
    setTextContent(demo);
  };
  const resetApp = () => { setResult(null); setPrediction(null); setAppState(AppState.IDLE); setTextContent(''); setActiveTab(ActiveTab.HOME); setRepoFiles([]); setRepoConfig({ url: '', branch: 'main', token: '' }); };
  const goToNewAnalysis = () => { setAppState(AppState.IDLE); setActiveTab(ActiveTab.DASHBOARD); };

  const handleComputeClick = () => {
    setComingSoonFeature('Live Compute Monitor');
    setShowComingSoon(true);
  };

  // Auth Checks after all hooks
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <AuthPage />;

  return (
    <div className="min-h-screen font-sans flex flex-col overflow-hidden text-slate-900 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 selection:bg-orange-500/30 transition-colors duration-300">
      <Header onLogoClick={() => setActiveTab(ActiveTab.HOME)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          appState={appState}
          resetApp={resetApp}
          goToNewAnalysis={goToNewAnalysis}
          onGuideClick={() => setShowUserGuide(true)}
          onComputeClick={handleComputeClick}
        />
        <main className="flex-1 overflow-auto h-[calc(100vh-64px)] relative scroll-smooth bg-slate-50 dark:bg-slate-950">
          <div className="max-w-[1600px] mx-auto p-8 h-full">
            {prediction?.aiAgentStatus && activeTab !== ActiveTab.HOME && (
              <div className="mb-6 bg-indigo-900 text-white rounded-xl p-4 flex items-center justify-between shadow-lg ring-1 ring-indigo-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-700 rounded-lg animate-pulse"><BrainCircuit className="w-5 h-5" /></div>
                  <div><div className="text-xs font-bold text-indigo-300 uppercase tracking-wider">AI Optimization Agent Active</div><div className="text-sm font-medium">Prevented {prediction.aiAgentStatus.prevented_issues.length} critical issues • {prediction.aiAgentStatus.mode} mode</div></div>
                </div>
                <div className="text-right"><div className="text-2xl font-bold">${prediction.aiAgentStatus.total_savings_session.toFixed(2)}</div><div className="text-xs text-indigo-300">Session Savings</div></div>
              </div>
            )}
            {activeTab === ActiveTab.HOME && (
              <div className="space-y-12 animate-fade-in">
                <div><h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Get started</h1><p className="text-slate-600 dark:text-slate-400 font-medium">Welcome to BrickOptima. What would you like to do today?</p></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <GetStartedCard icon={Plus} title="Import and transform data" desc="Upload local files or paste execution plans for immediate analysis." actionText="Create analysis" onClick={goToNewAnalysis} color="blue" />
                  <GetStartedCard icon={FileText} title="Repository Trace" desc="Connect your GitHub repository to map execution plans to source code." actionText="Connect repo" onClick={() => setActiveTab(ActiveTab.CODE_MAP)} color="orange" />
                  <GetStartedCard icon={Radio} title="Live Monitor" desc="Connect to a live Databricks cluster to visualize real-time telemetry." actionText="Connect cluster" onClick={handleComputeClick} color="emerald" />
                  <GetStartedCard icon={Sparkles} title="Advanced Insights" desc="Explore cluster right-sizing, config generation, and query rewrites." actionText="Explore insights" onClick={() => setActiveTab(ActiveTab.INSIGHTS)} color="purple" />
                </div>
                <div className="space-y-4">
                  <div className="space-y-4">
                    <RecentAnalyses
                      onViewAll={() => setActiveTab(ActiveTab.HISTORY)}
                      onSelectAnalysis={(id) => {
                        // Fetch and set result, then go to dashboard
                        // For now, simpler to just go to history or we need a helper to load analysis
                        // Let's reuse the load logic from HistoryPage or similar
                        setActiveTab(ActiveTab.HISTORY);
                        // Ideally we open it directly, but we need to fetch it first.
                        // Let's switching to History tab is fine for "View All" or clicking items.
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === ActiveTab.DASHBOARD && (
              <>
                {appState === AppState.ANALYZING && <LoadingScreen />}

                {(appState === AppState.IDLE || appState === AppState.ERROR) && (
                  <div className="flex flex-col min-h-[75vh] animate-fade-in gap-6">

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">

                      <div className="lg:col-span-2 w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative z-10 flex flex-col transition-colors">
                        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                          {['text', 'file'].map(mode => (
                            <button key={mode} onClick={() => setInputMode(mode as any)} className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${inputMode === mode ? 'text-orange-700 dark:text-orange-400 bg-white dark:bg-slate-900 border-b-2 border-orange-500 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'}`}>{mode === 'text' ? <FileText className="w-4 h-4" /> : <Upload className="w-4 h-4" />}{mode === 'text' ? 'Paste Plan / Logs' : 'Upload File'}</button>
                          ))}
                        </div>
                        <div className="p-8 relative flex-1 flex flex-col">
                          {inputMode === 'text' ? (
                            <div className="relative group flex-1">
                              <textarea value={textContent} onChange={(e) => setTextContent(e.target.value)} className="w-full h-full min-h-[400px] p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-sm rounded-2xl border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none resize-none shadow-inner leading-relaxed transition-all placeholder-slate-400 dark:placeholder-slate-600" placeholder="Paste your 'EXPLAIN EXTENDED' output here..."></textarea>
                              <button onClick={insertDemoData} className="absolute top-4 right-4 text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-orange-700 dark:hover:text-orange-400 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm font-bold">Load Demo Plan</button>
                            </div>
                          ) : (
                            <div className="h-full min-h-[400px] border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all relative group cursor-pointer"><div className="p-5 bg-white dark:bg-slate-800 rounded-full shadow-md mb-4 group-hover:scale-110 transition-transform text-orange-600 dark:text-orange-400 border border-slate-200 dark:border-slate-700"><Upload className="w-8 h-8" /></div><p className="text-slate-800 dark:text-slate-200 font-bold text-lg">Click to Upload</p><input type="file" accept=".json,.txt,.log" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" /></div>
                          )}
                        </div>
                      </div>

                      {/* RIGHT: Runtime Environment Context */}
                      <div className="w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative z-10 flex flex-col h-full transition-colors">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-3">
                          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800">
                            <Server className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Analysis Settings</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Configure runtime and metadata.</p>
                          </div>
                        </div>
                        <div className="p-6 space-y-6 flex-1 bg-white dark:bg-slate-900">

                          <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Analysis Title</label>
                            <input
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                              placeholder="e.g. Q4 Revenue Query Optimization"
                              value={analysisTitle}
                              onChange={e => setAnalysisTitle(e.target.value)}
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Cloud Region</label>
                            <div className="relative">
                              <select
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 appearance-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:opacity-50"
                                value={clusterContext.region}
                                onChange={e => setClusterContext({ ...clusterContext, region: e.target.value })}
                                disabled={loadingRegions}
                              >
                                {loadingRegions ? (
                                  <option>Loading regions...</option>
                                ) : (
                                  availableRegions.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                  ))
                                )}
                              </select>
                              <div className="absolute right-4 top-3.5 pointer-events-none text-slate-400">
                                <Globe className="w-4 h-4" />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Cluster Type</label>
                            <div className="relative">
                              <select
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 appearance-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:opacity-50"
                                value={clusterContext.clusterType}
                                onChange={e => setClusterContext({ ...clusterContext, clusterType: e.target.value })}
                                disabled={loadingInstances}
                              >
                                {loadingInstances ? (
                                  <option>Loading instance types...</option>
                                ) : (
                                  availableInstances.map(inst => (
                                    <option key={inst.id} value={inst.id}>{inst.displayName}</option>
                                  ))
                                )}
                              </select>
                              <div className="absolute right-4 top-3.5 pointer-events-none text-slate-400">
                                <Cpu className="w-4 h-4" />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Databricks Runtime (DBR)</label>
                            <div className="relative">
                              <select
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 appearance-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                value={clusterContext.dbrVersion}
                                onChange={e => setClusterContext({ ...clusterContext, dbrVersion: e.target.value })}
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
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Extra Spark Properties</label>
                            <textarea
                              className="w-full flex-1 min-h-[150px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none placeholder-slate-400 dark:placeholder-slate-600"
                              placeholder="spark.sql.shuffle.partitions=200&#10;spark.executor.memory=8g..."
                              value={clusterContext.sparkConf}
                              onChange={e => setClusterContext({ ...clusterContext, sparkConf: e.target.value })}
                            ></textarea>
                          </div>

                          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Repository Context <span className="text-xs font-normal text-slate-400 lowercase">(optional)</span></label>
                            <div className="flex gap-2 mb-2">
                              <div className="relative flex-1">
                                <input
                                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                  placeholder="https://github.com/org/repo"
                                  value={repoConfig.url}
                                  onChange={e => setRepoConfig({ ...repoConfig, url: e.target.value })}
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
                                onChange={e => setRepoConfig({ ...repoConfig, token: e.target.value })}
                              />
                            )}
                            {repoFiles.length > 0 && <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1"><Check className="w-3 h-3" /> {repoFiles.length} files linked</div>}
                          </div>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
                          <button onClick={handleAnalyze} disabled={!textContent.trim()} className="w-full bg-orange-600 hover:bg-orange-700 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg shadow-orange-500/20 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3">
                            <PlayCircle className="w-6 h-6" /> Analyze Plan
                          </button>
                        </div>
                      </div>
                    </div>

                    {error && <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-2xl border border-red-200 dark:border-red-800 text-sm flex items-center gap-3 animate-fade-in font-medium shadow-sm"><div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>{error}</div>}
                  </div>
                )}

                {result && appState === AppState.SUCCESS && (
                  <div className="space-y-8 animate-fade-in pb-20" id="dashboard-container">
                    <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 relative overflow-hidden transition-colors">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500"></div>
                      <div className="flex items-start gap-6 relative z-10">
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-2xl border border-orange-100 dark:border-orange-800 hidden sm:block shadow-sm">
                          <Activity className="w-8 h-8" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-4">
                              <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Executive Summary</h3>
                              <div className="hidden md:block">

                              </div>
                            </div>
                            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-orange-700 dark:text-orange-400 text-xs font-bold uppercase rounded-full tracking-wide shadow-sm">AI Generated</span>
                          </div>
                          <p className="text-slate-800 dark:text-slate-300 leading-relaxed text-lg font-medium">{result.summary}</p>
                          <div className="md:hidden mt-4">

                          </div>
                        </div>
                      </div>
                    </section>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8" id="dag-visualizer-section">
                      {(() => {
                        // Calculate dynamic cost savings
                        const currentInstance = availableInstances.find(i => i.id === clusterContext.clusterType);
                        // Default to $0.5/hr if not found (fallback)
                        const pricePerHour = currentInstance?.pricePerHour || 0.5;

                        const enrichedOptimizations = result.optimizations.map(opt => {
                          let relatedCodeSnippets = opt.relatedCodeSnippets || [];

                          // If we have affected stages, try to find code mappings from DAG nodes
                          if (opt.affected_stages && opt.affected_stages.length > 0 && result.dagNodes) {
                            const relevantNodes = result.dagNodes.filter(node =>
                              opt.affected_stages!.some(stageId => node.id.includes(stageId))
                            );

                            const newSnippets = relevantNodes
                              .filter(node => node.mappedCode)
                              .map(node => node.mappedCode!);

                            // Deduplicate by path+line
                            const existingKeys = new Set(relatedCodeSnippets.map(s => `${s.filePath}:${s.lineNumber}`));
                            newSnippets.forEach(s => {
                              const key = `${s.filePath}:${s.lineNumber}`;
                              if (!existingKeys.has(key)) {
                                relatedCodeSnippets.push(s);
                                existingKeys.add(key);
                              }
                            });
                          }

                          if (opt.estimated_time_saved_seconds) {
                            // Calculate cost savings: (seconds / 3600) * price/hr
                            const costSaved = (opt.estimated_time_saved_seconds / 3600) * pricePerHour;
                            return { ...opt, estimated_cost_saved_usd: costSaved, relatedCodeSnippets };
                          }
                          return { ...opt, relatedCodeSnippets };
                        });

                        return (
                          <EnhancedDagVisualizer
                            nodes={result.dagNodes}
                            links={result.dagLinks}
                            optimizations={enrichedOptimizations}
                            isExpanded={dagExpanded}
                            onToggleExpand={setDagExpanded}
                            highlightedNodeId={selectedNodeId}
                            onSelectNode={setSelectedNodeId}
                            onMapToCode={() => setActiveTab(ActiveTab.CODE_MAP)}
                          />
                        );
                      })()}
                      <ResourceChart data={result.resourceMetrics} />
                    </div>
                    {(() => {
                      // We also need to pass enriched optimizations to OptimizationPanel
                      const currentInstance = availableInstances.find(i => i.id === clusterContext.clusterType);
                      const pricePerHour = currentInstance?.pricePerHour || 0.5;
                      const enrichedOptimizations = result.optimizations.map(opt => {
                        let relatedCodeSnippets = opt.relatedCodeSnippets || [];

                        // If we have affected stages, try to find code mappings from DAG nodes
                        if (opt.affected_stages && opt.affected_stages.length > 0 && result.dagNodes) {
                          const relevantNodes = result.dagNodes.filter(node =>
                            opt.affected_stages!.some(stageId => node.id.includes(stageId))
                          );

                          const newSnippets = relevantNodes
                            .filter(node => node.mappedCode)
                            .map(node => node.mappedCode!);

                          // Deduplicate by path+line
                          const existingKeys = new Set(relatedCodeSnippets.map(s => `${s.filePath}:${s.lineNumber}`));
                          newSnippets.forEach(s => {
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
                      return <OptimizationPanel
                        optimizations={enrichedOptimizations}
                        onViewInDag={(opt) => {
                          // Expand DAG
                          setDagExpanded(true);

                          // Find relevant node
                          if (opt.affected_stages && opt.affected_stages.length > 0) {
                            // Simple matching logic - usually first affected stage is the primary target
                            // The stage names in optimizations might be just numbers or names, 
                            // we try to find a node that contains this ID.
                            const targetStage = opt.affected_stages[0];
                            const matchingNode = result.dagNodes.find(n => n.id.includes(targetStage));
                            if (matchingNode) {
                              setSelectedNodeId(matchingNode.id);
                            }
                          }

                          // Scroll to view
                          // We use a slight timeout to allow the portal to open if needed
                          setTimeout(() => {
                            const element = document.getElementById('dag-visualizer-section');
                            if (element) {
                              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }, 100);
                        }}
                      />;
                    })()}
                    {prediction && <><PredictivePanel prediction={prediction} /><OptimizationPlayground optimizations={result.optimizations} baselineDuration={result.estimatedDurationMin || 15} /></>}
                  </div>
                )}
              </>
            )}

            {activeTab === ActiveTab.INSIGHTS && (
              <div className="max-w-5xl mx-auto pb-20">{result ? <AdvancedInsights clusterRec={result.clusterRecommendation} configRec={result.sparkConfigRecommendation} rewrites={result.queryRewrites} /> : <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800"><Sparkles className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" /><h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Insights Available</h3><p className="text-slate-600 dark:text-slate-400">Run an analysis first to generate advanced insights.</p><button onClick={goToNewAnalysis} className="mt-6 px-6 py-2 bg-orange-600 text-white rounded-lg font-bold">Go to Analyzer</button></div>}</div>
            )}
            {activeTab === ActiveTab.LIVE && <div className="h-full w-full"><LiveMonitor /></div>}
            {activeTab === ActiveTab.COST && <div className="max-w-4xl mx-auto"><CostEstimator estimatedDurationMin={result?.estimatedDurationMin} instances={availableInstances} region={clusterContext.region} availableRegions={availableRegions} cloudProvider={cloudProvider} onCloudProviderChange={setCloudProvider} onRegionChange={(r) => setClusterContext(prev => ({ ...prev, region: r }))} /></div>}
            {activeTab === ActiveTab.HISTORY && (
              <HistoryPage
                onNewAnalysis={goToNewAnalysis}
                onSelectAnalysis={(id, data) => {
                  setResult(data);
                  setAppState(AppState.SUCCESS);
                  setActiveTab(ActiveTab.DASHBOARD);
                }}
              />
            )}
            {activeTab === ActiveTab.CHAT && <div className="max-w-4xl mx-auto h-full"><ChatInterface analysisResult={result} /></div>}
            {activeTab === ActiveTab.CODE_MAP && <PlanCodeMapper onBack={() => setActiveTab(ActiveTab.HOME)} initialPlanContent={textContent} initialRepoConfig={repoConfig} initialDagStages={result?.dagNodes} />}
            {activeTab === ActiveTab.REPO && (
              <div className="h-full">
                {repoFiles.length === 0 ? (
                  <RepoConnectForm
                    url={repoConfig.url}
                    onUrlChange={(url) => setRepoConfig({ ...repoConfig, url })}
                    onScan={handleFetchRepo}
                    isLoading={isFetchingRepo}
                  />
                ) : (
                  <RepositoryPanel files={repoFiles} />
                )}
              </div>
            )}
          </div>
        </main>
        <UserGuideModal isOpen={showUserGuide} onClose={() => setShowUserGuide(false)} />
        <ComingSoonModal isOpen={showComingSoon} onClose={() => setShowComingSoon(false)} featureName={comingSoonFeature} />
      </div>
    </div>
  );
}

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  </ErrorBoundary>
);

const Header = ({ onLogoClick }: { onLogoClick: () => void }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between px-6 shadow-xl z-30 flex-shrink-0 relative">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-orange-500 via-purple-500 to-blue-500 shadow-[0_0_10px_rgba(249,115,22,0.5)] animate-gradient-x bg-[length:200%_auto]"></div>
      <div className="flex items-center gap-8 relative z-10">
        <button onClick={onLogoClick} className="font-bold text-lg flex items-center gap-3 text-white group cursor-pointer select-none bg-transparent border-none outline-none">
          <div className="relative">
            <div className="absolute inset-0 bg-orange-500 blur-lg opacity-0 group-hover:opacity-30 transition-opacity duration-500"></div>
            <span className="relative bg-gradient-to-br from-orange-500 to-red-600 p-2 rounded-xl shadow-lg flex items-center justify-center transform group-hover:scale-105 transition-transform duration-300 border border-white/10">
              <Activity className="w-5 h-5 text-white" />
            </span>
          </div>
          <div className="flex flex-col">
            <span className="tracking-tight text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">BrickOptima</span>
          </div>
        </button>
      </div>
      <div className="flex items-center gap-5 relative z-10">


        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg shadow-sm backdrop-blur-sm">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-bold text-indigo-300">AI Engine Ready</span>
        </div>

        <div className="h-8 w-px bg-slate-800 mx-2"></div>
        <UserMenu />
      </div>
    </header>
  );
};

const Sidebar = ({ activeTab, setActiveTab, appState, resetApp, goToNewAnalysis, onGuideClick, onComputeClick }: any) => (
  <aside className="w-[240px] bg-slate-900 flex flex-col border-r border-slate-800 z-20">
    <div className="p-4">
      <button onClick={goToNewAnalysis} className="w-full bg-white text-slate-900 font-bold py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors shadow-sm mb-6"><Plus className="w-5 h-5" /> New</button>
      <div className="space-y-1">
        <SidebarItem icon={Home} label="Home" active={activeTab === ActiveTab.HOME} onClick={() => setActiveTab(ActiveTab.HOME)} />
        <SidebarItem icon={FileClock} label="History" active={activeTab === ActiveTab.HISTORY} onClick={() => setActiveTab(ActiveTab.HISTORY)} />
        <div className="h-px bg-slate-800 my-2 mx-3"></div>
        <SidebarItem icon={LayoutDashboard} label="Plan Analyzer" active={activeTab === ActiveTab.DASHBOARD} onClick={() => setActiveTab(ActiveTab.DASHBOARD)} />
        <SidebarItem icon={FileCode2} label="Code Mapper" active={activeTab === ActiveTab.CODE_MAP} onClick={() => setActiveTab(ActiveTab.CODE_MAP)} />
        <SidebarItem icon={Sparkles} label="Advanced Insights" active={activeTab === ActiveTab.INSIGHTS} onClick={() => setActiveTab(ActiveTab.INSIGHTS)} />
        <SidebarItem icon={Radio} label="Compute" active={activeTab === ActiveTab.LIVE} onClick={onComputeClick} />
        <SidebarItem icon={DollarSign} label="Cost Management" active={activeTab === ActiveTab.COST} onClick={() => setActiveTab(ActiveTab.COST)} />
        <SidebarItem icon={MessageSquare} label="AI Consultant" active={activeTab === ActiveTab.CHAT} onClick={() => setActiveTab(ActiveTab.CHAT)} />
      </div>
    </div>
    <div className="mt-auto p-4 border-t border-slate-800">
      {appState === AppState.SUCCESS && <button onClick={resetApp} className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors"><LogOut className="w-4 h-4" /> Reset Context</button>}
      <button onClick={onGuideClick} className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors"><BookOpen className="w-4 h-4" /> User Guide</button>
      <div className="flex items-center gap-3 px-3 py-2 text-slate-500 text-xs mt-2 font-mono"><Activity className="w-3 h-3" /> v{__APP_VERSION__}</div>
    </div>
  </aside>
);

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (<button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${active ? 'bg-slate-800 text-white relative' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>{active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>}<Icon className={`w-4 h-4 ${active ? 'text-orange-400' : ''}`} />{label}</button>);
const GetStartedCard = ({ icon: Icon, title, desc, actionText, onClick, color }: any) => { const colorMap: any = { blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800', orange: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800', emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800', purple: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800' }; const theme = colorMap[color] || colorMap.blue; return (<div onClick={onClick} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col"><div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${theme} border shadow-sm`}><Icon className="w-6 h-6" /></div><h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2 tracking-tight">{title}</h3><p className="text-sm text-slate-600 dark:text-slate-400 mb-6 flex-1 leading-relaxed font-medium">{desc}</p><div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1 group-hover:gap-2 transition-all">{actionText} <ChevronRight className="w-3 h-3 text-orange-600 dark:text-orange-400" /></div></div>); };
const RecentRow = ({ name, type, date, status }: any) => (<tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer group"><td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300 group-hover:text-orange-700 dark:group-hover:text-orange-400 flex items-center gap-2 transition-colors"><FileClock className="w-4 h-4 text-slate-400" />{name}</td><td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium">{type}</td><td className="px-6 py-4 text-slate-500 dark:text-slate-500 font-medium">{date}</td><td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${status === 'Critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : status === 'Optimized' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : status === 'Completed' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400'}`}>{status}</span></td></tr>);

export default App;

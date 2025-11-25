

import React, { useState } from 'react';
import { Upload, Activity, Layers, X, BookOpen, PlayCircle, MessageSquare, LayoutDashboard, DollarSign, LogOut, FileText, GitBranch, Github, Link as LinkIcon, Code2, Radio, AlertTriangle, Zap, Search, Bell, HelpCircle, Menu, Settings, User, Home, Plus, FileClock, ChevronRight, Sparkles, BrainCircuit } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EnhancedDagVisualizer } from './components/EnhancedDagVisualizer';
import { ResourceChart } from './components/ResourceChart';
import { OptimizationList } from './components/OptimizationList';
import { ChatInterface } from './components/ChatInterface';
import { CostEstimator } from './components/CostEstimator';
import { CodeMapper } from './components/CodeMapper';
import { LiveMonitor } from './components/LiveMonitor';
import { PredictivePanel } from './components/PredictivePanel';
import { TrendAnalysis } from './components/TrendAnalysis';
import { OptimizationPlayground } from './components/OptimizationPlayground';
import { AdvancedInsights } from './components/AdvancedInsights';
import { analyzeDagContent } from './services/geminiService';
import { predictiveEngine } from './services/predictiveAnalytics';
import { fetchRepoContentsEnhanced } from './services/githubService';
import { AnalysisResult, AppState, ActiveTab, RepoConfig, RepoFile, PerformancePrediction } from './types';

const DEMO_REPO_FILES: RepoFile[] = [
  {
    path: "src/jobs/revenue_analysis.py",
    content: `from pyspark.sql import SparkSession
from pyspark.sql.functions import col, sum

def run_job():
    spark = SparkSession.builder.appName("RevenueAnalytics").getOrCreate()

    # 1. READ TRANSACTIONS
    txns_df = spark.read.parquet("s3://bucket/data/transactions")
    
    # Filter for 2023 onwards
    recent_txns = txns_df.filter(col("transaction_date") >= "2023-01-01")

    # 2. READ USERS
    users_df = spark.read.format("csv") \\
        .option("header", "true") \\
        .load("s3://bucket/data/users")

    active_users = users_df.filter(col("status") == "active")

    # 3. THE JOIN (The Problem Area)
    # BroadcastNestedLoopJoin BuildRight, Inner
    raw_joined = recent_txns.join(active_users)

    # 4. AGGREGATION
    report = raw_joined.groupBy("user_id") \\
        .agg(sum("amount").alias("total_spend")) \\
        .orderBy("user_id")

    report.explain(True)
    report.collect()

if __name__ == "__main__":
    run_job()`
  }
];

function App() {
  const [inputMode, setInputMode] = useState<'file' | 'text'>('text');
  const [textContent, setTextContent] = useState('');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.HOME);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [prediction, setPrediction] = useState<PerformancePrediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Repo State
  const [repoConfig, setRepoConfig] = useState<RepoConfig>({ url: '', branch: 'main', token: '' });
  const [repoFiles, setRepoFiles] = useState<RepoFile[]>([]);
  const [isFetchingRepo, setIsFetchingRepo] = useState(false);
  
  // Modals
  const [showProdGuide, setShowProdGuide] = useState(false);
  const [showImplGuide, setShowImplGuide] = useState(false);

  const handleFetchRepo = async () => {
    if (!repoConfig.url) return;
    setIsFetchingRepo(true);
    setError(null);
    try {
      const files = await fetchRepoContentsEnhanced(repoConfig, {
        maxFiles: 50,
        includeTests: false,
        fileExtensions: ['.py', '.scala', '.sql', '.ipynb']
      });
      setRepoFiles(files);
    } catch (e: any) {
      console.error(e);
      setError(`Repo Error: ${e.message}`);
    } finally {
      setIsFetchingRepo(false);
    }
  };

  const loadDemoRepo = () => {
    setRepoFiles(DEMO_REPO_FILES);
    setRepoConfig({ ...repoConfig, url: 'DEMO_MODE_ACTIVE' });
  };

  const handleAnalyze = async () => {
    if (!textContent.trim()) return;
    
    setAppState(AppState.ANALYZING);
    setError(null);
    setPrediction(null);

    try {
      const data = await analyzeDagContent(textContent, repoFiles, {
        enableCodeMapping: true,
        enableDependencyAnalysis: true,
        confidenceThreshold: 50, 
        maxMappingsPerNode: 3, 
        deepAnalysis: true
      });
      setResult(data);
      
      // Run Predictive Analysis
      try {
        const pred = predictiveEngine.predictAtScale(data, 100); 
        setPrediction(pred);
      } catch (predError) {
        console.warn("Predictive analysis failed:", predError);
      }

      setAppState(AppState.SUCCESS);
      setActiveTab(ActiveTab.DASHBOARD);
    } catch (e: any) {
      console.error(e);
      setError(`Analysis Failed: ${e.message}`);
      setAppState(AppState.ERROR);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setTextContent(event.target?.result as string);
        setInputMode('text');
      };
      reader.readAsText(file);
    }
  };

  const insertDemoData = () => {
    const demo = `== Physical Plan ==
  AdaptiveSparkPlan isFinalPlan=true
  +- == Final Plan ==
    ResultQueryStage 1 (est. rows: 2.5M, size: 180MB)
    +- Project [user_id#12, sum(amount)#45 AS total_spend#99]
        +- SortAggregate(key=[user_id#12], functions=[sum(amount#45)], output=[user_id#12, total_spend#99])
          +- Sort [user_id#12 ASC NULLS FIRST], true, 0
              +- Exchange hashpartitioning(user_id#12, 200), ENSURE_REQUIREMENTS, [id=#105]
                +- SortAggregate(key=[user_id#12], functions=[partial_sum(amount#45)], output=[user_id#12, sum#108])
                    +- Sort [user_id#12 ASC NULLS FIRST], false, 0
                      +- Project [user_id#12, amount#45]
                          +- BroadcastNestedLoopJoin BuildRight, Inner (WARNING: Missing Join Condition - Cartesian Product)
                            :- Filter (isnotnull(transaction_date#40) AND (transaction_date#40 >= 2023-01-01))
                            :  +- FileScan parquet db.transactions[user_id#12, transaction_date#40, amount#45] 
                            :     Batched: true, 
                            :     DataFilters: [isnotnull(transaction_date#40)], 
                            :     Format: Parquet, 
                            :     Location: InMemoryFileIndex(1 paths)[s3://bucket/data/transactions], 
                            :     PartitionFilters: [], 
                            :     PushedFilters: [IsNotNull(transaction_date)], 
                            :     ReadSchema: struct<user_id:string,transaction_date:date,amount:double>
                            :     Statistics: rows=15000000, size=1.2GB
                            +- BroadcastExchange IdentityBroadcastMode, [id=#98] (size: 45MB)
                                +- Filter ((status#20 = 'active') AND isnotnull(user_id#10))
                                  +- FileScan csv db.users[user_id#10, status#20] 
                                      Batched: false, 
                                      Format: CSV, 
                                      Location: InMemoryFileIndex(1 paths)[s3://bucket/data/users], 
                                      PartitionFilters: [], 
                                      PushedFilters: [EqualTo(status,active), IsNotNull(user_id)], 
                                      ReadSchema: struct<user_id:string,status:string>
                                      Statistics: rows=500000, size=25MB`;
    setTextContent(demo);
};
  const resetApp = () => {
    setResult(null);
    setPrediction(null);
    setAppState(AppState.IDLE);
    setTextContent('');
    setActiveTab(ActiveTab.HOME);
    setRepoFiles([]);
    setRepoConfig({ url: '', branch: 'main', token: '' });
  };

  const goToNewAnalysis = () => {
      setAppState(AppState.IDLE);
      setActiveTab(ActiveTab.DASHBOARD);
  };

  return (
    <ErrorBoundary>
    <div className="min-h-screen font-sans flex flex-col overflow-hidden text-slate-900 bg-slate-50 selection:bg-orange-500/30">
      
      {/* Top Navigation */}
      <Header />

      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} appState={appState} resetApp={resetApp} goToNewAnalysis={goToNewAnalysis} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto h-[calc(100vh-64px)] relative scroll-smooth bg-slate-50">
          <div className="max-w-[1600px] mx-auto p-8 h-full">
            
            {/* AI Agent Status Bar (If active) */}
            {prediction?.aiAgentStatus && activeTab !== ActiveTab.HOME && (
                <div className="mb-6 bg-indigo-900 text-white rounded-xl p-4 flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-700 rounded-lg animate-pulse">
                            <BrainCircuit className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider">AI Optimization Agent Active</div>
                            <div className="text-sm font-medium">Prevented {prediction.aiAgentStatus.prevented_issues.length} critical issues • {prediction.aiAgentStatus.mode} mode</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold">${prediction.aiAgentStatus.total_savings_session.toFixed(2)}</div>
                        <div className="text-xs text-indigo-300">Session Savings</div>
                    </div>
                </div>
            )}

            {/* HOME TAB */}
            {activeTab === ActiveTab.HOME && (
              <div className="space-y-12 animate-fade-in">
                 <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Get started</h1>
                    <p className="text-slate-600 font-medium">Welcome to BrickOptima. What would you like to do today?</p>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <GetStartedCard 
                       icon={Plus} 
                       title="Import and transform data" 
                       desc="Upload local files or paste execution plans for immediate analysis." 
                       actionText="Create analysis"
                       onClick={goToNewAnalysis}
                       color="blue"
                    />
                     <GetStartedCard 
                       icon={FileText} 
                       title="Repository Trace" 
                       desc="Connect your GitHub repository to map execution plans to source code." 
                       actionText="Connect repo"
                       onClick={() => setActiveTab(ActiveTab.REPO)}
                       color="orange"
                    />
                    <GetStartedCard 
                       icon={Radio} 
                       title="Live Monitor" 
                       desc="Connect to a live Databricks cluster to visualize real-time telemetry." 
                       actionText="Connect cluster"
                       onClick={() => setActiveTab(ActiveTab.LIVE)}
                       color="emerald"
                    />
                    <GetStartedCard 
                       icon={Sparkles} 
                       title="Advanced Insights" 
                       desc="Explore cluster right-sizing, config generation, and query rewrites." 
                       actionText="Explore insights"
                       onClick={() => setActiveTab(ActiveTab.INSIGHTS)}
                       color="purple"
                    />
                 </div>

                 {/* Recents Section */}
                 <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                          <FileClock className="w-5 h-5 text-slate-500" /> Recents
                       </h2>
                       <button className="text-sm text-blue-600 font-bold hover:underline">View all</button>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                       <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-xs font-bold">
                             <tr>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Last Modified</th>
                                <th className="px-6 py-4">Status</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                             <RecentRow name="Revenue_Join_Optimization" type="Analysis" date="2 hours ago" status="Completed" />
                             <RecentRow name="Nightly_ETL_Pipeline" type="Repository" date="Yesterday" status="Connected" />
                             <RecentRow name="Customer360_View" type="Monitor" date="2 days ago" status="Critical" />
                             <RecentRow name="Log_Ingestion_Stream" type="Analysis" date="3 days ago" status="Optimized" />
                          </tbody>
                       </table>
                    </div>
                 </div>
              </div>
            )}

            {/* DASHBOARD INPUT STATE */}
            {activeTab === ActiveTab.DASHBOARD && appState !== AppState.SUCCESS && (
              <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in">
                  <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden relative z-10">
                    <div className="flex border-b border-slate-200 bg-slate-50">
                      {['text', 'file'].map(mode => (
                        <button 
                          key={mode}
                          onClick={() => setInputMode(mode as any)}
                          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                            inputMode === mode 
                            ? 'text-orange-700 bg-white border-b-2 border-orange-500 shadow-sm' 
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                          }`}
                        >
                          {mode === 'text' ? <FileText className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                          {mode === 'text' ? 'Paste Plan / Logs' : 'Upload File'}
                        </button>
                      ))}
                    </div>

                    <div className="p-8 relative">
                      {inputMode === 'text' ? (
                        <div className="relative group">
                          <textarea 
                            value={textContent}
                            onChange={(e) => setTextContent(e.target.value)}
                            className="w-full h-72 p-6 bg-slate-50 text-slate-900 font-mono text-sm rounded-2xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:bg-white focus:outline-none resize-none shadow-inner leading-relaxed transition-all placeholder-slate-400"
                            placeholder="Paste your 'EXPLAIN EXTENDED' output here..."
                          ></textarea>
                          <button onClick={insertDemoData} className="absolute top-4 right-4 text-xs bg-white text-slate-700 hover:text-orange-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all shadow-sm font-bold">
                            Load Demo Plan
                          </button>
                        </div>
                      ) : (
                        <div className="h-72 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-all relative group cursor-pointer">
                          <div className="p-5 bg-white rounded-full shadow-md mb-4 group-hover:scale-110 transition-transform text-orange-600 border border-slate-200">
                              <Upload className="w-8 h-8" />
                          </div>
                          <p className="text-slate-800 font-bold text-lg">Click to Upload</p>
                          <input 
                            type="file" 
                            accept=".json,.txt,.log"
                            onChange={handleFileUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </div>
                      )}

                      <div className="mt-8 flex justify-center">
                        <button 
                          onClick={handleAnalyze}
                          disabled={!textContent.trim() || appState === AppState.ANALYZING}
                          className="bg-orange-600 hover:bg-orange-700 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-lg shadow-orange-500/20 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                        >
                          {appState === AppState.ANALYZING ? (
                            <>
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              Processing...
                            </>
                          ) : (
                            <>
                              <PlayCircle className="w-6 h-6" /> Start Optimization
                            </>
                          )}
                        </button>
                      </div>

                      {error && (
                        <div className="mt-6 p-4 bg-red-50 text-red-800 rounded-2xl border border-red-200 text-sm flex items-center gap-3 animate-fade-in font-medium shadow-sm">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          {error}
                        </div>
                      )}
                    </div>
                  </div>
              </div>
            )}

            {/* ANALYSIS RESULTS DASHBOARD */}
            {activeTab === ActiveTab.DASHBOARD && result && appState === AppState.SUCCESS && (
               <div className="space-y-8 animate-fade-in pb-20">
                  <section className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500"></div>
                    <div className="flex items-start gap-6 relative z-10">
                      <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl border border-orange-100 hidden sm:block shadow-sm">
                        <Activity className="w-8 h-8" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-3">
                           <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Summary</h3>
                           <span className="px-3 py-1 bg-slate-100 border border-slate-200 text-orange-700 text-xs font-bold uppercase rounded-full tracking-wide shadow-sm">AI Generated</span>
                        </div>
                        <p className="text-slate-800 leading-relaxed text-lg font-medium">{result.summary}</p>
                      </div>
                    </div>
                  </section>
                  
                  {/* ... [Complexity Score & Metrics Cards] ... */}
                  {(result.query_complexity_score !== undefined || result.optimization_impact_score !== undefined) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold text-slate-900 text-sm">Query Complexity</h4>
                            <div className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                              (result.query_complexity_score || 0) <= 30 ? 'bg-emerald-100 text-emerald-800' :
                              (result.query_complexity_score || 0) <= 60 ? 'bg-amber-100 text-amber-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {(result.query_complexity_score || 0) <= 30 ? 'Simple' : 
                              (result.query_complexity_score || 0) <= 60 ? 'Moderate' : 'Complex'}
                            </div>
                          </div>
                          <div className="relative pt-2">
                            <div className="flex items-center justify-center">
                              <div className="text-5xl font-bold text-slate-900">{result.query_complexity_score || 50}</div>
                              <div className="text-2xl text-slate-500 ml-1">/100</div>
                            </div>
                            <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full transition-all bg-slate-900`} style={{ width: `${result.query_complexity_score || 50}%` }}></div>
                            </div>
                          </div>
                      </div>

                      <div className="bg-emerald-50 rounded-3xl shadow-sm border border-emerald-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold text-slate-900 text-sm">Improvement Potential</h4>
                            <Zap className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="relative pt-2">
                            <div className="flex items-center justify-center">
                            <div className="text-5xl font-bold text-emerald-700">{result.optimization_impact_score || 0}</div>
                            <div className="text-2xl text-emerald-500 ml-1">%</div>
                            </div>
                            <div className="mt-4 text-center text-xs text-slate-600 font-semibold">
                            Potential speedup if all fixes applied
                            </div>
                        </div>
                      </div>

                       {result.risk_assessment && (
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
                          <h4 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            Risk Assessment
                          </h4>
                          <div className="space-y-3">
                            {Object.entries(result.risk_assessment).map(([key, value]) => (
                              <div key={key} className="flex justify-between items-center">
                                <span className="text-xs text-slate-600 font-medium capitalize">
                                  {key.replace(/_/g, ' ')}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  value === 'Low' ? 'bg-emerald-100 text-emerald-800' :
                                  value === 'Medium' ? 'bg-amber-100 text-amber-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <EnhancedDagVisualizer nodes={result.dagNodes} links={result.dagLinks} optimizations={result.optimizations} />
                    <ResourceChart data={result.resourceMetrics} />
                  </div>

                  <OptimizationList optimizations={result.optimizations} />

                  {prediction && (
                      <>
                        <PredictivePanel prediction={prediction} />
                        <TrendAnalysis trend={prediction.historicalTrend} regression={prediction.regressionAlert} />
                        <OptimizationPlayground 
                            optimizations={result.optimizations} 
                            baselineDuration={result.estimatedDurationMin || 15} 
                        />
                      </>
                  )}
               </div>
            )}

            {/* INSIGHTS TAB (NEW) */}
            {activeTab === ActiveTab.INSIGHTS && (
                <div className="max-w-5xl mx-auto pb-20">
                     {result ? (
                         <AdvancedInsights 
                            clusterRec={result.clusterRecommendation}
                            configRec={result.sparkConfigRecommendation}
                            rewrites={result.queryRewrites}
                         />
                     ) : (
                         <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
                             <Sparkles className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                             <h3 className="text-xl font-bold text-slate-900 mb-2">No Insights Available</h3>
                             <p className="text-slate-600">Run an analysis first to generate advanced insights.</p>
                             <button onClick={goToNewAnalysis} className="mt-6 px-6 py-2 bg-orange-600 text-white rounded-lg font-bold">Go to Analyzer</button>
                         </div>
                     )}
                </div>
            )}

            {/* OTHER TABS */}
            {activeTab === ActiveTab.LIVE && <div className="h-full w-full"><LiveMonitor /></div>}
            {activeTab === ActiveTab.COST && <div className="max-w-4xl mx-auto"><CostEstimator estimatedDurationMin={result?.estimatedDurationMin} /></div>}
            {activeTab === ActiveTab.CHAT && <div className="max-w-4xl mx-auto h-full"><ChatInterface analysisResult={result} /></div>}
            {activeTab === ActiveTab.REPO && (
              <div className="space-y-6 max-w-5xl mx-auto">
                 {repoFiles.length === 0 && (
                    <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm text-center">
                       <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-200">
                          <GitBranch className="w-8 h-8 text-slate-400"/>
                       </div>
                       <h3 className="text-xl font-bold text-slate-900 mb-2">Connect a Repository</h3>
                       <p className="text-slate-600 mb-6">Link your GitHub repository to enable deep code traceability.</p>
                       <div className="max-w-md mx-auto space-y-4">
                           <input 
                              placeholder="https://github.com/..." 
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm focus:border-orange-500 outline-none"
                              value={repoConfig.url}
                              onChange={e => setRepoConfig({...repoConfig, url: e.target.value})}
                           />
                           <button onClick={handleFetchRepo} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg transition-colors shadow-sm">Link Repository</button>
                           <button onClick={loadDemoRepo} className="w-full bg-orange-50 text-orange-700 font-bold py-3 rounded-lg hover:bg-orange-100 transition-colors border border-orange-200">Load Demo Repo</button>
                       </div>
                    </div>
                 )}
                 <CodeMapper mappings={result?.codeMappings} />
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Info Modals */}
      {showProdGuide && (
        <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4">
          {/* ... */}
        </div>
      )}
      
      {showImplGuide && (
         <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4">
           {/* ... */}
          </div>
      )}
    </div>
    </ErrorBoundary>
  );
}

// --- SUB-COMPONENTS ---

const Header = () => (
  <header className="h-16 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between px-4 shadow-sm z-30 flex-shrink-0">
    <div className="flex items-center gap-4">
       <div className="font-bold text-lg flex items-center gap-2 text-white">
         <span className="bg-orange-600 p-1.5 rounded-lg shadow-sm">
            <Activity className="w-5 h-5 text-white" />
         </span>
         <span className="tracking-tight">BrickOptima</span>
       </div>
       <div className="h-6 w-px bg-slate-700 mx-2"></div>
       <div className="text-sm font-medium text-slate-400">Staging Workspace</div>
    </div>
    
    <div className="flex items-center gap-4 text-slate-400">
       <HelpCircle className="w-5 h-5 hover:text-white cursor-pointer transition-colors" />
       <Settings className="w-5 h-5 hover:text-white cursor-pointer transition-colors" />
       <Bell className="w-5 h-5 hover:text-white cursor-pointer transition-colors" />
       <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-xs border border-white/20 shadow-sm">
          JS
       </div>
    </div>
  </header>
);

const Sidebar = ({ activeTab, setActiveTab, appState, resetApp, goToNewAnalysis }: any) => (
  <aside className="w-[240px] bg-slate-900 flex flex-col border-r border-slate-800 z-20">
     <div className="p-4">
        <button 
           onClick={goToNewAnalysis}
           className="w-full bg-white text-slate-900 font-bold py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors shadow-sm mb-6"
        >
           <Plus className="w-5 h-5" /> New
        </button>

        <div className="space-y-1">
           <SidebarItem icon={Home} label="Home" active={activeTab === ActiveTab.HOME} onClick={() => setActiveTab(ActiveTab.HOME)} />
           <div className="h-px bg-slate-800 my-2 mx-3"></div>
           <SidebarItem icon={LayoutDashboard} label="Plan Analyzer" active={activeTab === ActiveTab.DASHBOARD} onClick={() => setActiveTab(ActiveTab.DASHBOARD)} />
           <SidebarItem icon={Sparkles} label="Advanced Insights" active={activeTab === ActiveTab.INSIGHTS} onClick={() => setActiveTab(ActiveTab.INSIGHTS)} />
           <SidebarItem icon={Radio} label="Compute" active={activeTab === ActiveTab.LIVE} onClick={() => setActiveTab(ActiveTab.LIVE)} />
           <SidebarItem icon={Code2} label="Repo Mapping" active={activeTab === ActiveTab.REPO} onClick={() => setActiveTab(ActiveTab.REPO)} />
           <SidebarItem icon={DollarSign} label="Cost Management" active={activeTab === ActiveTab.COST} onClick={() => setActiveTab(ActiveTab.COST)} />
           <SidebarItem icon={MessageSquare} label="Genie" active={activeTab === ActiveTab.CHAT} onClick={() => setActiveTab(ActiveTab.CHAT)} />
        </div>
     </div>

     <div className="mt-auto p-4 border-t border-slate-800">
         {appState === AppState.SUCCESS && (
            <button onClick={resetApp} className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors">
               <LogOut className="w-4 h-4" /> Reset Context
            </button>
         )}
         <div className="flex items-center gap-3 px-3 py-2 text-slate-500 text-xs mt-2 font-mono">
            <BookOpen className="w-3 h-3" /> v2.5.0-beta
         </div>
     </div>
  </aside>
);

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
      active 
      ? 'bg-slate-800 text-white relative' 
      : 'text-slate-400 hover:text-white hover:bg-slate-800'
    }`}
  >
    {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>}
    <Icon className={`w-4 h-4 ${active ? 'text-orange-400' : ''}`} />
    {label}
  </button>
);

const GetStartedCard = ({ icon: Icon, title, desc, actionText, onClick, color }: any) => {
   const colorMap: any = {
       blue: 'text-blue-600 bg-blue-50 border-blue-100',
       orange: 'text-orange-600 bg-orange-50 border-orange-100',
       emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
       purple: 'text-purple-600 bg-purple-50 border-purple-100'
   };
   const theme = colorMap[color] || colorMap.blue;

   return (
     <div 
       onClick={onClick}
       className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col"
     >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${theme} border shadow-sm`}>
           <Icon className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-slate-900 mb-2 tracking-tight">{title}</h3>
        <p className="text-sm text-slate-600 mb-6 flex-1 leading-relaxed font-medium">{desc}</p>
        <div className="text-xs font-bold text-slate-900 flex items-center gap-1 group-hover:gap-2 transition-all">
           {actionText} <ChevronRight className="w-3 h-3 text-orange-600" />
        </div>
     </div>
   );
};

const RecentRow = ({ name, type, date, status }: any) => (
   <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer group">
      <td className="px-6 py-4 font-bold text-slate-700 group-hover:text-orange-700 flex items-center gap-2 transition-colors">
         <FileClock className="w-4 h-4 text-slate-400 group-hover:text-orange-500" />
         {name}
      </td>
      <td className="px-6 py-4 text-slate-600 font-medium">{type}</td>
      <td className="px-6 py-4 text-slate-500 font-medium">{date}</td>
      <td className="px-6 py-4">
         <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
            status === 'Critical' ? 'bg-red-100 text-red-700' :
            status === 'Optimized' ? 'bg-emerald-100 text-emerald-700' :
            status === 'Completed' ? 'bg-blue-100 text-blue-700' :
            'bg-slate-100 text-slate-700'
         }`}>
            {status}
         </span>
      </td>
   </tr>
);

export default App;
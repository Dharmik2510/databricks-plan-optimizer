import React, { useState } from 'react';
import { Upload, Activity, Layers, X, BookOpen, PlayCircle, MessageSquare, LayoutDashboard, DollarSign, LogOut, FileText, GitBranch, Github, Link as LinkIcon, Code2, Radio } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DagVisualizer } from './components/DagVisualizer';
import { ResourceChart } from './components/ResourceChart';
import { OptimizationList } from './components/OptimizationList';
import { ChatInterface } from './components/ChatInterface';
import { CostEstimator } from './components/CostEstimator';
import { CodeMapper } from './components/CodeMapper';
import { LiveMonitor } from './components/LiveMonitor';
import { analyzeDagContent } from './services/geminiService';
import { fetchRepoContents } from './services/githubService';
import { AnalysisResult, AppState, ActiveTab, RepoConfig, RepoFile } from './types';

const DEMO_REPO_FILES: RepoFile[] = [
  {
    path: "src/jobs/revenue_analysis.py",
    content: `from pyspark.sql import SparkSession
from pyspark.sql.functions import col, sum

def run_job():
    spark = SparkSession.builder.appName("RevenueAnalytics").getOrCreate()

    # 1. READ TRANSACTIONS
    # Reading historic parquet data
    # Plan shows: FileScan parquet db.transactions
    txns_df = spark.read.parquet("s3://bucket/data/transactions")
    
    # Filter for 2023 onwards
    # Optimization Tip: This filter happens after scanning too much metadata if not partitioned
    recent_txns = txns_df.filter(col("transaction_date") >= "2023-01-01")

    # 2. READ USERS
    # Reading CSV (slow format)
    # Plan shows: FileScan csv db.users
    users_df = spark.read.format("csv") \\
        .option("header", "true") \\
        .load("s3://bucket/data/users")

    active_users = users_df.filter(col("status") == "active")

    # 3. THE JOIN (The Problem Area)
    # ERROR: This join is missing the 'on' condition, resulting in a Cartesian Product (Cross Join)
    # This forces Spark to use BroadcastNestedLoopJoin if one side is small enough to broadcast.
    # Plan shows: BroadcastNestedLoopJoin BuildRight, Inner
    raw_joined = recent_txns.join(active_users)

    # 4. AGGREGATION
    # Plan shows: SortAggregate(key=[user_id#12], functions=[sum(amount#45)]
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
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.DASHBOARD);
  const [result, setResult] = useState<AnalysisResult | null>(null);
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
      const files = await fetchRepoContents(repoConfig);
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

    try {
      const data = await analyzeDagContent(textContent, repoFiles);
      setResult(data);
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
                                      Statistics: rows=500000, size=25MB

  == Additional Context ==
  - Table 'transactions' is partitioned by year/month but PartitionFilters is empty
  - Broadcast size (45MB) exceeds recommended threshold of 10MB
  - CSV format used for 'users' table instead of Parquet
  - Query execution time: 847 seconds
  - Estimated cost: $12.40 per run on m5.2xlarge cluster (8 DBUs)`;
    setTextContent(demo);
};
  const resetApp = () => {
    setResult(null);
    setAppState(AppState.IDLE);
    setTextContent('');
    setActiveTab(ActiveTab.DASHBOARD);
    setRepoFiles([]);
    setRepoConfig({ url: '', branch: 'main', token: '' });
  };

  return (
    <ErrorBoundary>
    <div className="min-h-screen font-sans flex overflow-hidden text-slate-900">
      
      {/* Sidebar - Glassy Dark Databricks Style */}
      <aside className="w-64 flex-shrink-0 hidden md:flex flex-col h-screen bg-[#1B2631]/85 backdrop-blur-2xl shadow-2xl relative z-20 text-slate-300 border-r border-white/10">
        <div className="h-16 flex items-center px-6 border-b border-white/10">
          <div className="flex items-center gap-3 font-bold text-xl tracking-tight text-white">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg shadow-orange-500/20 flex items-center justify-center border border-orange-400/50">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="drop-shadow-sm">BrickOptima</span>
          </div>
        </div>

        <div className="py-6 flex-1 space-y-1">
          {appState === AppState.SUCCESS ? (
            <>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-6 mb-3">Workspace</div>
              {[
                { id: ActiveTab.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
                { id: ActiveTab.LIVE, label: 'Live Monitor', icon: Radio, pulse: true },
                { id: ActiveTab.COST, label: 'Cost Estimator', icon: DollarSign },
                { id: ActiveTab.CHAT, label: 'AI Consultant', icon: MessageSquare },
                { id: ActiveTab.REPO, label: 'Repo Trace', icon: GitBranch }
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all relative group ${
                    activeTab === tab.id 
                    ? 'text-white bg-white/10 shadow-inner' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {/* RED BORDER INDICATOR - MATCHING DATABRICKS STYLE */}
                  {activeTab === tab.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.6)]"></div>}
                  
                  <tab.icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                    tab.pulse && activeTab === tab.id 
                      ? 'animate-pulse text-red-400' 
                      : activeTab === tab.id ? 'text-red-400' : ''
                  }`} /> 
                  {tab.label}
                </button>
              ))}
              
              <div className="my-6 border-t border-white/10 mx-6"></div>
              
              <button 
                onClick={resetApp}
                className="w-full flex items-center gap-3 px-6 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors group"
              >
                <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> New Analysis
              </button>
            </>
          ) : (
            <div className="px-6 space-y-6">
              <div className="px-4 py-5 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 text-sm text-slate-300 leading-relaxed shadow-lg">
                <p className="font-bold text-white mb-2">Optimization Workspace</p>
                Upload a Spark Plan or Paste Logs to begin analysis.
              </div>

              {/* Repo Connection Panel */}
              <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-4 shadow-lg">
                 <h4 className="text-[10px] font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Github className="w-3 h-3" /> Connect Repo
                 </h4>
                 {repoFiles.length > 0 ? (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-emerald-300 bg-emerald-500/20 px-3 py-2 rounded-lg border border-emerald-500/30">
                          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                          {repoFiles.length} files indexed
                        </div>
                        {repoConfig.url === 'DEMO_MODE_ACTIVE' && (
                           <div className="text-[10px] text-slate-400 px-1">Using Demo Repository</div>
                        )}
                    </div>
                 ) : (
                   <div className="space-y-3">
                      <input 
                        placeholder="https://github.com/..." 
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50 placeholder-slate-500 transition-colors"
                        value={repoConfig.url}
                        onChange={e => setRepoConfig({...repoConfig, url: e.target.value})}
                      />
                       <input 
                        placeholder="Token (Optional)" 
                        type="password"
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50 placeholder-slate-500 transition-colors"
                        value={repoConfig.token}
                        onChange={e => setRepoConfig({...repoConfig, token: e.target.value})}
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={handleFetchRepo}
                          disabled={isFetchingRepo || !repoConfig.url}
                          className="flex-1 bg-white/10 hover:bg-white/20 text-xs font-bold py-2 rounded-lg text-white transition-colors disabled:opacity-50 border border-white/5"
                        >
                          {isFetchingRepo ? 'Fetching...' : 'Link'}
                        </button>
                      </div>
                      <button 
                        onClick={loadDemoRepo}
                        className="w-full bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-xs font-bold py-2 rounded-lg text-orange-300 transition-colors flex items-center justify-center gap-2 mt-2"
                      >
                        <Code2 className="w-3 h-3" /> Load Demo Repo
                      </button>
                   </div>
                 )}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/10 bg-black/10 backdrop-blur-sm">
          <button onClick={() => setShowProdGuide(true)} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors mb-3">
            <BookOpen className="w-3 h-3" /> Production Guide
          </button>
          <button onClick={() => setShowImplGuide(true)} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
            <Layers className="w-3 h-3" /> Architecture
          </button>
        </div>
      </aside>

      {/* Main Content - Transparent Glass */}
      <main className="flex-1 overflow-auto h-screen relative scroll-smooth bg-transparent">
        
        {/* Mobile Header */}
        <header className="md:hidden h-16 bg-white/60 backdrop-blur-xl border-b border-white/20 flex items-center px-4 justify-between sticky top-0 z-50">
           <div className="font-bold text-slate-900 flex items-center gap-2">
             <Activity className="w-5 h-5 text-orange-600" /> BrickOptima
           </div>
           {appState === AppState.SUCCESS && (
             <button onClick={resetApp} className="text-sm text-slate-500">New</button>
           )}
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 h-full">
          
          {/* Idle / Input State */}
          {appState !== AppState.SUCCESS && (
            <div className="animate-fade-in flex flex-col items-center justify-center min-h-[70vh]">
              <div className="mb-12 text-center max-w-3xl mx-auto relative z-10">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/40 border border-white/60 text-orange-700 text-xs font-bold mb-6 shadow-lg backdrop-blur-md">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                  </span>
                  Next-Gen Spark Optimization
                </div>
                <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 tracking-tight leading-tight drop-shadow-sm">
                  Optimize your <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-orange-500 filter drop-shadow-sm">Databricks Workflows</span>
                </h1>
                <p className="text-xl text-slate-700 font-medium leading-relaxed max-w-2xl mx-auto drop-shadow-sm">
                  Visualize execution plans, pinpoint bottlenecks, and get AI-powered code fixes in seconds.
                </p>
              </div>

              {/* Hyper-Glass Input Card */}
              <div className="w-full max-w-4xl bg-white/40 backdrop-blur-3xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden relative z-10 ring-1 ring-white/60">
                
                <div className="flex border-b border-white/30 bg-white/20">
                  {['text', 'file'].map(mode => (
                    <button 
                      key={mode}
                      onClick={() => setInputMode(mode as any)}
                      className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                        inputMode === mode 
                        ? 'text-orange-700 bg-white/40 border-b-2 border-orange-500 shadow-sm' 
                        : 'text-slate-600 hover:bg-white/30 hover:text-slate-800'
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
                        className="w-full h-72 p-6 bg-white/40 backdrop-blur-md text-slate-900 font-mono text-sm rounded-2xl border border-white/50 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 focus:bg-white/60 focus:outline-none resize-none shadow-inner leading-relaxed transition-all placeholder-slate-500"
                        placeholder="Paste your 'EXPLAIN EXTENDED' output here..."
                      ></textarea>
                      <button onClick={insertDemoData} className="absolute top-4 right-4 text-xs bg-white/60 backdrop-blur text-slate-700 hover:text-orange-700 px-3 py-1.5 rounded-lg border border-white/50 hover:bg-white/80 transition-all shadow-sm font-bold">
                        Load Demo Plan
                      </button>
                    </div>
                  ) : (
                    <div className="h-72 border-2 border-dashed border-slate-400/50 rounded-2xl flex flex-col items-center justify-center bg-white/20 hover:bg-white/30 transition-all relative group cursor-pointer backdrop-blur-sm">
                      <div className="p-5 bg-white/60 rounded-full shadow-lg mb-4 group-hover:scale-110 transition-transform text-orange-600 border border-white/50">
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
                      className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-orange-500/30 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 border border-orange-400/50 backdrop-blur-sm"
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
                    <div className="mt-6 p-4 bg-red-50/80 backdrop-blur-md text-red-800 rounded-2xl border border-red-200/50 text-sm flex items-center gap-3 animate-fade-in font-medium shadow-sm">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      {error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Results State */}
          {result && appState === AppState.SUCCESS && (
            <div className="space-y-8 animate-fade-in pb-20 h-full flex flex-col">
              
              {/* Mobile Tab Nav */}
              <div className="md:hidden flex gap-2 overflow-x-auto pb-2 no-scrollbar flex-shrink-0">
                 {[
                    { id: ActiveTab.DASHBOARD, label: 'Dashboard' },
                    { id: ActiveTab.LIVE, label: 'Live' },
                    { id: ActiveTab.COST, label: 'Cost' },
                    { id: ActiveTab.CHAT, label: 'Consultant' }
                 ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold border shadow-sm backdrop-blur-md ${activeTab === tab.id ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white/60 border-white/40 text-slate-700'}`}>{tab.label}</button>
                 ))}
              </div>

              {/* Views */}
              {activeTab === ActiveTab.DASHBOARD && (
                <div className="space-y-8">
                  <section className="bg-white/50 backdrop-blur-3xl rounded-3xl shadow-lg border border-white/60 p-8 relative overflow-hidden ring-1 ring-white/40">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500"></div>
                    <div className="flex items-start gap-6 relative z-10">
                      <div className="p-4 bg-orange-50/80 backdrop-blur-md text-orange-600 rounded-2xl border border-orange-100 hidden sm:block shadow-sm">
                        <Activity className="w-8 h-8" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-3">
                           <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Summary</h3>
                           <span className="px-3 py-1 bg-white/60 border border-white/60 text-orange-700 text-xs font-bold uppercase rounded-full tracking-wide shadow-sm backdrop-blur-md">AI Generated</span>
                        </div>
                        <p className="text-slate-800 leading-relaxed text-lg font-medium">{result.summary}</p>
                      </div>
                    </div>
                  </section>
                  {(result.query_complexity_score !== undefined || 
                    result.optimization_impact_score !== undefined || 
                    result.risk_assessment) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Complexity Score */}
                      {result.query_complexity_score !== undefined && (
                        <div className="bg-white/50 backdrop-blur-3xl rounded-3xl shadow-lg border border-white/60 p-6 ring-1 ring-white/40">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold text-slate-900 text-sm">Query Complexity</h4>
                            <div className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                              result.query_complexity_score <= 30 ? 'bg-emerald-100 text-emerald-700' :
                              result.query_complexity_score <= 60 ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {result.query_complexity_score <= 30 ? 'Simple' : 
                              result.query_complexity_score <= 60 ? 'Moderate' : 'Complex'}
                            </div>
                          </div>
                          <div className="relative pt-2">
                            <div className="flex items-center justify-center">
                              <div className="text-5xl font-bold text-slate-900">{result.query_complexity_score}</div>
                              <div className="text-2xl text-slate-500 ml-1">/100</div>
                            </div>
                            <div className="mt-4 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all ${
                                  result.query_complexity_score <= 30 ? 'bg-emerald-500' :
                                  result.query_complexity_score <= 60 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${result.query_complexity_score}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      )}

                  {/* Improvement Potential */}
                  {result.optimization_impact_score !== undefined && (
                    <div className="bg-gradient-to-br from-emerald-50 to-green-50 backdrop-blur-3xl rounded-3xl shadow-lg border border-emerald-200/50 p-6 ring-1 ring-emerald-100/40">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold text-slate-900 text-sm">Improvement Potential</h4>
                        <Zap className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="relative pt-2">
                        <div className="flex items-center justify-center">
                          <div className="text-5xl font-bold text-emerald-700">{result.optimization_impact_score}</div>
                          <div className="text-2xl text-emerald-500 ml-1">%</div>
                        </div>
                        <div className="mt-4 text-center text-xs text-slate-600 font-semibold">
                          Potential speedup if all fixes applied
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Risk Assessment */}
                  {result.risk_assessment && (
                    <div className="bg-white/50 backdrop-blur-3xl rounded-3xl shadow-lg border border-white/60 p-6 ring-1 ring-white/40">
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
                              value === 'Low' ? 'bg-emerald-100 text-emerald-700' :
                              value === 'Medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
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
                    <DagVisualizer nodes={result.dagNodes} links={result.dagLinks} />
                    <ResourceChart data={result.resourceMetrics} />
                  </div>

                  <OptimizationList optimizations={result.optimizations} />
                </div>
              )}

              {activeTab === ActiveTab.LIVE && <div className="h-full max-w-[1600px] mx-auto w-full"><LiveMonitor /></div>}
              {activeTab === ActiveTab.COST && <div className="max-w-4xl mx-auto"><CostEstimator estimatedDurationMin={result.estimatedDurationMin} /></div>}
              {activeTab === ActiveTab.CHAT && <div className="max-w-4xl mx-auto h-full"><ChatInterface /></div>}
              {activeTab === ActiveTab.REPO && <div className="max-w-4xl mx-auto h-full"><CodeMapper mappings={result.codeMappings} /></div>}

            </div>
          )}
        </div>
      </main>

      {/* Info Modals - Glass Style */}
      {showProdGuide && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white/80 backdrop-blur-2xl rounded-3xl max-w-2xl w-full shadow-2xl animate-fade-in overflow-hidden relative border border-white/50">
             <div className="p-6 border-b border-slate-200/50 flex justify-between items-center bg-white/40">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><BookOpen className="w-5 h-5 text-orange-600" /> Production Guide</h3>
              <button onClick={() => setShowProdGuide(false)} className="p-2 hover:bg-white/50 rounded-full text-slate-500 hover:text-slate-700 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh] text-slate-800 font-medium">
               <p>Use these methods to extract execution plans from restricted production environments:</p>
               <div className="space-y-4">
                  <div className="bg-white/60 p-5 rounded-2xl border border-white/60 shadow-sm"><h4 className="font-bold text-slate-900 text-sm mb-2">PySpark Notebook</h4><pre className="text-sm font-mono text-slate-700 bg-white/50 p-3 rounded-xl border border-white/60">df.explain(True)</pre></div>
                  <div className="bg-white/60 p-5 rounded-2xl border border-white/60 shadow-sm"><h4 className="font-bold text-slate-900 text-sm mb-2">Spark UI</h4><p className="text-sm text-slate-700">SQL Tab &gt; Query Description &gt; "Physical Plan"</p></div>
               </div>
            </div>
          </div>
        </div>
      )}
      
      {showImplGuide && (
         <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[60] flex items-center justify-center p-4">
           <div className="bg-white/80 backdrop-blur-2xl rounded-3xl max-w-2xl w-full shadow-2xl animate-fade-in overflow-hidden relative border border-white/50">
             <div className="p-6 border-b border-slate-200/50 flex justify-between items-center bg-white/40">
               <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Layers className="w-5 h-5 text-orange-600" /> Architecture</h3>
               <button onClick={() => setShowImplGuide(false)} className="p-2 hover:bg-white/50 rounded-full text-slate-500 hover:text-slate-700 transition-colors"><X className="w-5 h-5" /></button>
             </div>
             <div className="p-8 text-sm text-slate-800 font-medium leading-relaxed">
                <p>BrickOptima uses a client-side React architecture powered by Google Gemini.</p>
                <ul className="list-disc ml-5 mt-4 space-y-2">
                   <li><strong>Analysis Engine:</strong> Gemini 2.0 Flash processes raw text plans into JSON structures.</li>
                   <li><strong>Visualization:</strong> D3.js renders force-directed DAGs with topological sorting.</li>
                   <li><strong>Live Monitor:</strong> Simulates WebSocket telemetry for real-time metric demonstration.</li>
                </ul>
             </div>
           </div>
         </div>
      )}
    </div>
    </ErrorBoundary>
  );
}

export default App;
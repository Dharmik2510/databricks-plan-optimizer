
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
   ResultQueryStage
   +- Project [user_id#12, sum(amount)#45 AS total_spend#99]
      +- SortAggregate(key=[user_id#12], functions=[sum(amount#45)], output=[user_id#12, total_spend#99])
         +- Sort [user_id#12 ASC NULLS FIRST], true, 0
            +- Exchange hashpartitioning(user_id#12, 200), ENSURE_REQUIREMENTS, [id=#105]
               +- SortAggregate(key=[user_id#12], functions=[partial_sum(amount#45)], output=[user_id#12, sum#108])
                  +- Sort [user_id#12 ASC NULLS FIRST], false, 0
                     +- Project [user_id#12, amount#45]
                        +- BroadcastNestedLoopJoin BuildRight, Inner
                           :- Filter (isnotnull(transaction_date#40) AND (transaction_date#40 >= 2023-01-01))
                           :  +- FileScan parquet db.transactions[user_id#12, transaction_date#40, amount#45] Batched: true, DataFilters: [isnotnull(transaction_date#40)], Format: Parquet, Location: InMemoryFileIndex(1 paths)[s3://bucket/data/transactions], PartitionFilters: [], PushedFilters: [IsNotNull(transaction_date)], ReadSchema: struct<user_id:string,transaction_date:date,amount:double>
                           +- BroadcastExchange IdentityBroadcastMode, [id=#98]
                              +- Filter ((status#20 = 'active') AND isnotnull(user_id#10))
                                 +- FileScan csv db.users[user_id#10, status#20] Batched: false, Format: CSV, Location: InMemoryFileIndex(1 paths)[s3://bucket/data/users], PartitionFilters: [], PushedFilters: [EqualTo(status,active), IsNotNull(user_id)], ReadSchema: struct<user_id:string,status:string>`;
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
    <div className="min-h-screen font-sans flex overflow-hidden text-slate-100">
      
      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 hidden md:flex flex-col h-screen border-r border-white/5 bg-slate-950/70 backdrop-blur-xl shadow-2xl relative z-20">
        <div className="h-24 flex items-center px-6 border-b border-white/5">
          <div className="flex items-center gap-3 text-white font-bold text-2xl tracking-tight">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center border border-white/20 backdrop-blur-md">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">BrickOptima</span>
          </div>
        </div>

        <div className="p-4 space-y-2 flex-1">
          {appState === AppState.SUCCESS ? (
            <>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest px-3 mb-3 mt-4">Analysis Tools</div>
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
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-300 backdrop-blur-sm ${
                    activeTab === tab.id 
                    ? 'bg-white/10 border border-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
                    : 'hover:bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <tab.icon className={`w-4 h-4 ${tab.pulse && activeTab === tab.id ? 'animate-pulse text-rose-400' : ''}`} /> {tab.label}
                </button>
              ))}
              
              <div className="my-6 border-t border-white/5 mx-2"></div>
              
              <button 
                onClick={resetApp}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors backdrop-blur-sm"
              >
                <LogOut className="w-4 h-4" /> New Analysis
              </button>
            </>
          ) : (
            <div className="space-y-6">
              <div className="px-5 py-6 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 text-sm text-slate-300 leading-relaxed shadow-inner">
                <p className="font-medium text-white mb-2">Welcome Back</p>
                Upload a Spark Plan or Paste Logs to unlock the optimization suite.
              </div>

              {/* Repo Connection Panel */}
              <div className="bg-slate-900/60 rounded-2xl border border-white/10 p-5 overflow-hidden relative backdrop-blur-md">
                 <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                 <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Github className="w-3 h-3" /> Connect Repo
                 </h4>
                 {repoFiles.length > 0 ? (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-emerald-300 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20 backdrop-blur-md">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                          {repoFiles.length} files indexed
                        </div>
                        {repoConfig.url === 'DEMO_MODE_ACTIVE' && (
                           <div className="text-[10px] text-slate-400 px-1">Using Demo Repository</div>
                        )}
                    </div>
                 ) : (
                   <div className="space-y-3">
                      <input 
                        placeholder="https://github.com/user/repo" 
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 placeholder-slate-500"
                        value={repoConfig.url}
                        onChange={e => setRepoConfig({...repoConfig, url: e.target.value})}
                      />
                       <input 
                        placeholder="Token (Optional)" 
                        type="password"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 placeholder-slate-500"
                        value={repoConfig.token}
                        onChange={e => setRepoConfig({...repoConfig, token: e.target.value})}
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={handleFetchRepo}
                          disabled={isFetchingRepo || !repoConfig.url}
                          className="flex-1 bg-white/10 hover:bg-white/20 text-xs font-bold py-2.5 rounded-lg text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
                        >
                          {isFetchingRepo ? 'Fetching...' : 'Link Codebase'}
                        </button>
                      </div>
                      <button 
                        onClick={loadDemoRepo}
                        className="w-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-xs font-bold py-2.5 rounded-lg text-cyan-200 transition-colors flex items-center justify-center gap-2 shadow-sm mt-2"
                      >
                        <Code2 className="w-3 h-3" /> Load Demo Repo
                      </button>
                   </div>
                 )}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/5 bg-black/20 backdrop-blur-md">
          <button onClick={() => setShowProdGuide(true)} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors mb-4">
            <BookOpen className="w-3 h-3" /> Production Guide
          </button>
          <button onClick={() => setShowImplGuide(true)} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
            <Layers className="w-3 h-3" /> Architecture
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto h-screen relative scroll-smooth">
        
        {/* Mobile Header */}
        <header className="md:hidden h-16 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 flex items-center px-4 justify-between sticky top-0 z-50">
           <div className="font-bold text-white flex items-center gap-2">
             <Activity className="w-5 h-5 text-cyan-400" /> BrickOptima
           </div>
           {appState === AppState.SUCCESS && (
             <button onClick={resetApp} className="text-sm text-slate-300">New</button>
           )}
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 h-full">
          
          {/* Idle / Input State */}
          {appState !== AppState.SUCCESS && (
            <div className="animate-fade-in flex flex-col items-center justify-center min-h-[70vh]">
              <div className="mb-12 text-center max-w-3xl mx-auto relative z-10">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-cyan-200 text-xs font-semibold mb-6 backdrop-blur-md shadow-lg">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                  </span>
                  Next-Gen Spark Optimization
                </div>
                <h1 className="text-6xl font-bold text-white mb-6 tracking-tight drop-shadow-xl leading-tight">
                  Optimize your <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500">Databricks Workflows</span>
                </h1>
                <p className="text-xl text-slate-300 font-light leading-relaxed drop-shadow-md max-w-2xl mx-auto">
                  Visualize execution plans, pinpoint bottlenecks, and get AI-powered code fixes in seconds.
                </p>
              </div>

              {/* Glass Input Card */}
              <div className="w-full max-w-4xl bg-slate-900/60 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-white/10 overflow-hidden transition-all hover:shadow-[0_30px_80px_rgba(6,182,212,0.15)] relative z-10">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
                
                <div className="flex border-b border-white/10 bg-black/20">
                  {['text', 'file'].map(mode => (
                    <button 
                      key={mode}
                      onClick={() => setInputMode(mode as any)}
                      className={`flex-1 py-5 text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                        inputMode === mode 
                        ? 'text-white bg-white/5 border-b-2 border-cyan-400' 
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
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
                        className="w-full h-72 p-6 bg-black/40 text-slate-100 font-mono text-sm rounded-2xl border border-white/10 focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 focus:outline-none resize-none shadow-inner leading-relaxed backdrop-blur-sm transition-all placeholder-slate-500"
                        placeholder="Paste your 'EXPLAIN EXTENDED' output here..."
                      ></textarea>
                      <button onClick={insertDemoData} className="absolute top-4 right-4 text-xs bg-white/10 text-cyan-200 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/20 transition-all backdrop-blur-md shadow-lg font-medium">
                        Load Demo Plan
                      </button>
                    </div>
                  ) : (
                    <div className="h-72 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 transition-all relative group cursor-pointer backdrop-blur-sm">
                      <div className="p-5 bg-cyan-500/20 rounded-full shadow-[0_0_30px_rgba(6,182,212,0.3)] mb-4 group-hover:scale-110 transition-transform text-cyan-300 border border-cyan-500/30">
                          <Upload className="w-8 h-8" />
                      </div>
                      <p className="text-white font-bold text-lg drop-shadow-md">Click to Upload</p>
                      <input 
                        type="file" 
                        accept=".json,.txt,.log"
                        onChange={handleFileUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  )}

                  <div className="mt-10 flex justify-center">
                    <button 
                      onClick={handleAnalyze}
                      disabled={!textContent.trim() || appState === AppState.ANALYZING}
                      className="bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-[0_10px_30px_rgba(6,182,212,0.4)] transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 border border-white/20 backdrop-blur-sm hover:shadow-[0_15px_40px_rgba(6,182,212,0.5)]"
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
                    <div className="mt-8 p-4 bg-red-500/20 text-red-200 rounded-xl border border-red-500/30 text-sm flex items-center gap-3 animate-fade-in backdrop-blur-md shadow-lg">
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
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold backdrop-blur-md border ${activeTab === tab.id ? 'bg-cyan-600/80 border-cyan-400 text-white' : 'bg-white/10 border-white/10 text-slate-300'}`}>{tab.label}</button>
                 ))}
              </div>

              {/* Views */}
              {activeTab === ActiveTab.DASHBOARD && (
                <div className="space-y-8">
                  <section className="bg-slate-900/60 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/10 p-8 relative overflow-hidden group">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-cyan-400 to-blue-600"></div>
                    <div className="flex items-start gap-6 relative z-10">
                      <div className="p-4 bg-cyan-500/10 text-cyan-200 rounded-2xl border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.2)] hidden sm:block backdrop-blur-md">
                        <Activity className="w-8 h-8" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-4">
                           <h3 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">Executive Summary</h3>
                           <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-400/20 text-cyan-200 text-xs font-bold uppercase rounded-full tracking-wide backdrop-blur-md shadow-lg">AI Generated</span>
                        </div>
                        <p className="text-slate-100 leading-relaxed text-lg font-light tracking-wide">{result.summary}</p>
                      </div>
                    </div>
                  </section>

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

      {/* Info Modals */}
      {showProdGuide && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-lg z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/20 rounded-3xl max-w-2xl w-full shadow-[0_0_60px_rgba(0,0,0,0.8)] animate-fade-in overflow-hidden relative">
             <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><BookOpen className="w-5 h-5 text-cyan-400" /> Production Guide</h3>
              <button onClick={() => setShowProdGuide(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh] text-slate-200">
               <p>Use these methods to extract execution plans from restricted production environments:</p>
               <div className="space-y-4">
                  <div className="bg-black/40 p-5 rounded-xl border border-white/10"><h4 className="font-bold text-cyan-300 text-sm mb-2">PySpark Notebook</h4><pre className="text-sm font-mono text-emerald-300 bg-black/50 p-3 rounded-lg border border-white/5">df.explain(True)</pre></div>
                  <div className="bg-black/40 p-5 rounded-xl border border-white/10"><h4 className="font-bold text-cyan-300 text-sm mb-2">Spark UI</h4><p className="text-sm text-slate-300">SQL Tab &gt; Query Description &gt; "Physical Plan"</p></div>
               </div>
            </div>
          </div>
        </div>
      )}
      
      {showImplGuide && (
         <div className="fixed inset-0 bg-black/80 backdrop-blur-lg z-[60] flex items-center justify-center p-4">
           <div className="bg-slate-900 border border-white/20 rounded-3xl max-w-2xl w-full shadow-[0_0_60px_rgba(0,0,0,0.8)] animate-fade-in overflow-hidden relative">
             <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
               <h3 className="text-xl font-bold text-white flex items-center gap-2"><Layers className="w-5 h-5 text-cyan-400" /> Architecture</h3>
               <button onClick={() => setShowImplGuide(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
             </div>
             <div className="p-8 text-sm text-slate-300 leading-relaxed">
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

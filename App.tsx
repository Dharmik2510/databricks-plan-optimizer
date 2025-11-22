
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
    <div className="min-h-screen font-sans flex overflow-hidden text-slate-900">
      
      {/* Sidebar - Databricks Dark Style */}
      <aside className="w-64 flex-shrink-0 hidden md:flex flex-col h-screen bg-[#1e293b] shadow-xl relative z-20 text-slate-300">
        <div className="h-16 flex items-center px-6 border-b border-slate-700">
          <div className="flex items-center gap-3 font-bold text-xl tracking-tight text-white">
            <div className="w-8 h-8 bg-orange-600 rounded shadow-md flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span>BrickOptima</span>
          </div>
        </div>

        <div className="py-6 flex-1 space-y-1">
          {appState === AppState.SUCCESS ? (
            <>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest px-6 mb-2">Workspace</div>
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
                  className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all relative ${
                    activeTab === tab.id 
                    ? 'text-white bg-slate-800' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  {activeTab === tab.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>}
                  <tab.icon className={`w-4 h-4 ${tab.pulse && activeTab === tab.id ? 'animate-pulse text-orange-400' : ''}`} /> {tab.label}
                </button>
              ))}
              
              <div className="my-6 border-t border-slate-700 mx-6"></div>
              
              <button 
                onClick={resetApp}
                className="w-full flex items-center gap-3 px-6 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
              >
                <LogOut className="w-4 h-4" /> New Analysis
              </button>
            </>
          ) : (
            <div className="px-6 space-y-6">
              <div className="px-4 py-5 bg-slate-800/50 rounded-lg border border-slate-700 text-sm text-slate-300 leading-relaxed">
                <p className="font-bold text-white mb-1">Optimization Workspace</p>
                Upload a Spark Plan or Paste Logs to begin analysis.
              </div>

              {/* Repo Connection Panel */}
              <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
                 <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Github className="w-3 h-3" /> Connect Repo
                 </h4>
                 {repoFiles.length > 0 ? (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded border border-emerald-500/20">
                          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                          {repoFiles.length} files indexed
                        </div>
                        {repoConfig.url === 'DEMO_MODE_ACTIVE' && (
                           <div className="text-[10px] text-slate-500 px-1">Using Demo Repository</div>
                        )}
                    </div>
                 ) : (
                   <div className="space-y-3">
                      <input 
                        placeholder="https://github.com/..." 
                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 placeholder-slate-500"
                        value={repoConfig.url}
                        onChange={e => setRepoConfig({...repoConfig, url: e.target.value})}
                      />
                       <input 
                        placeholder="Token (Optional)" 
                        type="password"
                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 placeholder-slate-500"
                        value={repoConfig.token}
                        onChange={e => setRepoConfig({...repoConfig, token: e.target.value})}
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={handleFetchRepo}
                          disabled={isFetchingRepo || !repoConfig.url}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 text-xs font-bold py-2 rounded text-white transition-colors disabled:opacity-50"
                        >
                          {isFetchingRepo ? 'Fetching...' : 'Link'}
                        </button>
                      </div>
                      <button 
                        onClick={loadDemoRepo}
                        className="w-full bg-orange-600/10 hover:bg-orange-600/20 border border-orange-600/20 text-xs font-bold py-2 rounded text-orange-300 transition-colors flex items-center justify-center gap-2 mt-2"
                      >
                        <Code2 className="w-3 h-3" /> Load Demo Repo
                      </button>
                   </div>
                 )}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-700 bg-slate-900">
          <button onClick={() => setShowProdGuide(true)} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors mb-3">
            <BookOpen className="w-3 h-3" /> Production Guide
          </button>
          <button onClick={() => setShowImplGuide(true)} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
            <Layers className="w-3 h-3" /> Architecture
          </button>
        </div>
      </aside>

      {/* Main Content - Light Theme */}
      <main className="flex-1 overflow-auto h-screen relative scroll-smooth bg-transparent">
        
        {/* Mobile Header */}
        <header className="md:hidden h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200 flex items-center px-4 justify-between sticky top-0 z-50">
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
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold mb-6 shadow-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                  </span>
                  Next-Gen Spark Optimization
                </div>
                <h1 className="text-5xl font-bold text-slate-900 mb-6 tracking-tight leading-tight">
                  Optimize your <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">Databricks Workflows</span>
                </h1>
                <p className="text-xl text-slate-600 font-light leading-relaxed max-w-2xl mx-auto">
                  Visualize execution plans, pinpoint bottlenecks, and get AI-powered code fixes in seconds.
                </p>
              </div>

              {/* Glass Input Card */}
              <div className="w-full max-w-4xl bg-white/70 backdrop-blur-2xl rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden relative z-10">
                
                <div className="flex border-b border-slate-200 bg-slate-50/50">
                  {['text', 'file'].map(mode => (
                    <button 
                      key={mode}
                      onClick={() => setInputMode(mode as any)}
                      className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                        inputMode === mode 
                        ? 'text-orange-600 bg-white border-b-2 border-orange-500 shadow-sm' 
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
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
                        className="w-full h-72 p-6 bg-white text-slate-800 font-mono text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none resize-none shadow-inner leading-relaxed transition-all placeholder-slate-400"
                        placeholder="Paste your 'EXPLAIN EXTENDED' output here..."
                      ></textarea>
                      <button onClick={insertDemoData} className="absolute top-4 right-4 text-xs bg-slate-100 text-slate-600 hover:text-orange-600 px-3 py-1.5 rounded border border-slate-200 hover:bg-white transition-all shadow-sm font-medium">
                        Load Demo Plan
                      </button>
                    </div>
                  ) : (
                    <div className="h-72 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-all relative group cursor-pointer">
                      <div className="p-5 bg-white rounded-full shadow-md mb-4 group-hover:scale-110 transition-transform text-orange-500 border border-slate-100">
                          <Upload className="w-8 h-8" />
                      </div>
                      <p className="text-slate-700 font-bold text-lg">Click to Upload</p>
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
                      className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white px-10 py-4 rounded-xl font-bold text-lg shadow-lg shadow-orange-500/20 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
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
                    <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm flex items-center gap-3 animate-fade-in">
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
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold border ${activeTab === tab.id ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>{tab.label}</button>
                 ))}
              </div>

              {/* Views */}
              {activeTab === ActiveTab.DASHBOARD && (
                <div className="space-y-8">
                  <section className="bg-white/70 backdrop-blur-2xl rounded-2xl shadow-sm border border-slate-200/60 p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500"></div>
                    <div className="flex items-start gap-6 relative z-10">
                      <div className="p-4 bg-orange-50 text-orange-600 rounded-xl border border-orange-100 hidden sm:block">
                        <Activity className="w-8 h-8" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-3">
                           <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Summary</h3>
                           <span className="px-3 py-1 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold uppercase rounded-full tracking-wide">AI Generated</span>
                        </div>
                        <p className="text-slate-700 leading-relaxed text-lg font-light">{result.summary}</p>
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

      {/* Info Modals - Dark for contrast */}
      {showProdGuide && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl animate-fade-in overflow-hidden relative">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><BookOpen className="w-5 h-5 text-orange-600" /> Production Guide</h3>
              <button onClick={() => setShowProdGuide(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh] text-slate-700">
               <p>Use these methods to extract execution plans from restricted production environments:</p>
               <div className="space-y-4">
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200"><h4 className="font-bold text-slate-900 text-sm mb-2">PySpark Notebook</h4><pre className="text-sm font-mono text-slate-600 bg-white p-3 rounded border border-slate-200">df.explain(True)</pre></div>
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200"><h4 className="font-bold text-slate-900 text-sm mb-2">Spark UI</h4><p className="text-sm text-slate-600">SQL Tab &gt; Query Description &gt; "Physical Plan"</p></div>
               </div>
            </div>
          </div>
        </div>
      )}
      
      {showImplGuide && (
         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl animate-fade-in overflow-hidden relative">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Layers className="w-5 h-5 text-orange-600" /> Architecture</h3>
               <button onClick={() => setShowImplGuide(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
             </div>
             <div className="p-8 text-sm text-slate-600 leading-relaxed">
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

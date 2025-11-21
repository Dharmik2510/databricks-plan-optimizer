import React, { useState } from 'react';
import { Upload, Activity, Layers, X, BookOpen, PlayCircle, MessageSquare, LayoutDashboard, DollarSign, LogOut, ChevronRight, FileText } from 'lucide-react';
import { DagVisualizer } from './components/DagVisualizer';
import { ResourceChart } from './components/ResourceChart';
import { OptimizationList } from './components/OptimizationList';
import { ChatInterface } from './components/ChatInterface';
import { CostEstimator } from './components/CostEstimator';
import { analyzeDagContent } from './services/geminiService';
import { AnalysisResult, AppState, ActiveTab } from './types';

function App() {
  const [inputMode, setInputMode] = useState<'file' | 'text'>('text');
  const [textContent, setTextContent] = useState('');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.DASHBOARD);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Modals
  const [showProdGuide, setShowProdGuide] = useState(false);
  const [showImplGuide, setShowImplGuide] = useState(false);

  const handleAnalyze = async () => {
    if (!textContent.trim()) return;
    
    setAppState(AppState.ANALYZING);
    setError(null);

    try {
      const data = await analyzeDagContent(textContent);
      setResult(data);
      setAppState(AppState.SUCCESS);
      setActiveTab(ActiveTab.DASHBOARD);
    } catch (e) {
      console.error(e);
      setError("Failed to analyze. Please ensure the content is a valid Spark/Databricks plan.");
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
  };

  return (
    <div className="min-h-screen font-sans flex overflow-hidden text-slate-100">
      
      {/* Glass Sidebar - HIGH TRANSPARENCY */}
      <aside className="w-72 flex-shrink-0 hidden md:flex flex-col h-screen border-r border-white/10 bg-slate-950/40 backdrop-blur-xl shadow-2xl relative z-20">
        <div className="h-20 flex items-center px-6 border-b border-white/5 bg-gradient-to-r from-white/5 to-transparent">
          <div className="flex items-center gap-3 text-white font-bold text-xl tracking-tight">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.5)] flex items-center justify-center border border-white/20 backdrop-blur-md">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="tracking-wide drop-shadow-md">BrickOptima</span>
          </div>
        </div>

        <div className="p-4 space-y-2 flex-1">
          {appState === AppState.SUCCESS ? (
            <>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 mb-2 mt-4">Analysis Tools</div>
              <button 
                onClick={() => setActiveTab(ActiveTab.DASHBOARD)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 backdrop-blur-sm ${
                  activeTab === ActiveTab.DASHBOARD 
                  ? 'bg-indigo-500/30 border border-indigo-500/30 text-white shadow-[0_0_20px_rgba(99,102,241,0.2)]' 
                  : 'hover:bg-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </button>
              <button 
                onClick={() => setActiveTab(ActiveTab.COST)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 backdrop-blur-sm ${
                  activeTab === ActiveTab.COST 
                  ? 'bg-emerald-500/30 border border-emerald-500/30 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
                  : 'hover:bg-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <DollarSign className="w-4 h-4" /> Cost Estimator
              </button>
              <button 
                onClick={() => setActiveTab(ActiveTab.CHAT)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 backdrop-blur-sm ${
                  activeTab === ActiveTab.CHAT 
                  ? 'bg-purple-500/30 border border-purple-500/30 text-white shadow-[0_0_20px_rgba(168,85,247,0.2)]' 
                  : 'hover:bg-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-4 h-4" /> AI Consultant
              </button>
              
              <div className="my-6 border-t border-white/5 mx-2"></div>
              
              <button 
                onClick={resetApp}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors backdrop-blur-sm"
              >
                <LogOut className="w-4 h-4" /> New Analysis
              </button>
            </>
          ) : (
            <div className="px-4 py-6 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 text-sm text-slate-300 leading-relaxed shadow-lg">
              Upload a Spark Plan or Paste Logs to unlock the optimization suite.
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
        
        {/* Mobile Header - Glass */}
        <header className="md:hidden h-16 bg-slate-900/60 backdrop-blur-xl border-b border-white/10 flex items-center px-4 justify-between sticky top-0 z-50">
           <div className="font-bold text-white flex items-center gap-2">
             <Activity className="w-5 h-5 text-indigo-400" /> BrickOptima
           </div>
           {appState === AppState.SUCCESS && (
             <button onClick={resetApp} className="text-sm text-slate-300">New</button>
           )}
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          
          {/* Input State */}
          {appState !== AppState.SUCCESS && (
            <div className="animate-fade-in flex flex-col items-center justify-center min-h-[80vh]">
              <div className="mb-10 text-center max-w-3xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-indigo-200 text-xs font-medium mb-6 backdrop-blur-xl shadow-lg">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  AI-Powered Spark Optimization
                </div>
                <h1 className="text-5xl font-extrabold text-white mb-6 tracking-tight drop-shadow-2xl">
                  Optimize your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300">Databricks Workflows</span>
                </h1>
                <p className="text-xl text-slate-300 font-light leading-relaxed drop-shadow-md">
                  Visualize execution plans, pinpoint bottlenecks, and generate optimized code instantly.
                </p>
              </div>

              {/* Glass Card Input Area - LIGHTER OPACITY FOR GLASS FEEL */}
              <div className="w-full max-w-4xl bg-slate-900/40 backdrop-blur-2xl rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden transition-all hover:shadow-[0_0_60px_rgba(79,70,229,0.2)] group">
                {/* Glossy Top Highlight */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                
                <div className="flex border-b border-white/10 bg-black/20">
                  <button 
                    onClick={() => setInputMode('text')}
                    className={`flex-1 py-5 text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                      inputMode === 'text' 
                      ? 'text-white bg-white/5 border-b-2 border-indigo-400 shadow-[inset_0_-10px_20px_rgba(0,0,0,0.2)]' 
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    <FileText className="w-4 h-4" /> Paste Plan / Logs
                  </button>
                  <button 
                    onClick={() => setInputMode('file')}
                    className={`flex-1 py-5 text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                      inputMode === 'file' 
                      ? 'text-white bg-white/5 border-b-2 border-indigo-400 shadow-[inset_0_-10px_20px_rgba(0,0,0,0.2)]' 
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    <Upload className="w-4 h-4" /> Upload File
                  </button>
                </div>

                <div className="p-8 relative">
                  {inputMode === 'text' ? (
                    <div className="relative group">
                      <textarea 
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                        className="w-full h-72 p-6 bg-black/30 text-slate-100 font-mono text-sm rounded-2xl border border-white/10 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 focus:outline-none resize-none shadow-inner leading-relaxed backdrop-blur-sm transition-all placeholder-slate-500 focus:bg-black/40"
                        placeholder="Paste your 'EXPLAIN EXTENDED' output here..."
                      ></textarea>
                      <button onClick={insertDemoData} className="absolute top-4 right-4 text-xs bg-white/10 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/20 transition-all backdrop-blur-md shadow-lg">
                        Load Demo Plan
                      </button>
                    </div>
                  ) : (
                    <div className="h-72 border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 transition-all relative group cursor-pointer backdrop-blur-sm">
                      <div className="p-5 bg-indigo-500/20 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.3)] mb-4 group-hover:scale-110 transition-transform text-indigo-300 border border-indigo-500/30">
                          <Upload className="w-8 h-8" />
                      </div>
                      <p className="text-white font-bold text-lg drop-shadow-md">Click to Upload</p>
                      <p className="text-slate-400 text-sm mt-1">.txt, .json, .log</p>
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
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-12 py-4 rounded-2xl font-bold text-lg shadow-[0_10px_25px_rgba(79,70,229,0.4)] transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 border border-white/20 backdrop-blur-sm hover:shadow-[0_15px_35px_rgba(79,70,229,0.5)]"
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

          {/* Results Dashboard */}
          {result && appState === AppState.SUCCESS && (
            <div className="space-y-8 animate-fade-in pb-20">
              
              {/* Tab Navigation (Mobile Only) */}
              <div className="md:hidden flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                 <button onClick={() => setActiveTab(ActiveTab.DASHBOARD)} className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold backdrop-blur-md border ${activeTab === ActiveTab.DASHBOARD ? 'bg-indigo-500/80 border-indigo-400 text-white' : 'bg-white/10 border-white/10 text-slate-300'}`}>Dashboard</button>
                 <button onClick={() => setActiveTab(ActiveTab.COST)} className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold backdrop-blur-md border ${activeTab === ActiveTab.COST ? 'bg-emerald-500/80 border-emerald-400 text-white' : 'bg-white/10 border-white/10 text-slate-300'}`}>Cost</button>
                 <button onClick={() => setActiveTab(ActiveTab.CHAT)} className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold backdrop-blur-md border ${activeTab === ActiveTab.CHAT ? 'bg-purple-500/80 border-purple-400 text-white' : 'bg-white/10 border-white/10 text-slate-300'}`}>Consultant</button>
              </div>

              {/* Content Switch */}
              {activeTab === ActiveTab.DASHBOARD && (
                <div className="space-y-8">
                  {/* Executive Summary - Transparent Glass */}
                  <section className="bg-slate-900/40 backdrop-blur-2xl rounded-3xl shadow-xl border border-white/10 p-8 relative overflow-hidden group">
                    {/* Gloss Shine */}
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-purple-600"></div>
                    
                    <div className="flex items-start gap-6 relative z-10">
                      <div className="p-4 bg-indigo-500/20 text-indigo-200 rounded-2xl border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.3)] hidden sm:block backdrop-blur-md">
                        <Activity className="w-8 h-8" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-4">
                           <h3 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">Executive Summary</h3>
                           <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-bold uppercase rounded-full tracking-wide backdrop-blur-md shadow-lg">AI Generated</span>
                        </div>
                        <p className="text-slate-100 leading-relaxed text-lg font-light">{result.summary}</p>
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

              {activeTab === ActiveTab.COST && (
                <div className="max-w-4xl mx-auto">
                   <CostEstimator estimatedDurationMin={result.estimatedDurationMin} />
                </div>
              )}

              {activeTab === ActiveTab.CHAT && (
                <div className="max-w-4xl mx-auto h-full">
                  <ChatInterface />
                </div>
              )}

            </div>
          )}
        </div>
      </main>

      {/* Guide Modals - Glassy Overlay */}
      {showProdGuide && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-lg z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900/70 border border-white/20 rounded-3xl max-w-2xl w-full shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-fade-in overflow-hidden backdrop-blur-2xl relative">
             <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
             <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" /> Production Guide
              </h3>
              <button onClick={() => setShowProdGuide(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh]">
               <p className="text-slate-200">Extracting execution plans from restricted environments:</p>
               <div className="space-y-4">
                  <div className="bg-black/40 p-5 rounded-xl border border-white/10 hover:bg-black/50 transition-colors backdrop-blur-sm">
                    <h4 className="font-bold text-indigo-300 text-sm mb-2">From Notebook (PySpark)</h4>
                    <pre className="text-sm font-mono text-emerald-300 bg-black/50 p-3 rounded-lg border border-white/5">df.explain(True)</pre>
                  </div>
                  <div className="bg-black/40 p-5 rounded-xl border border-white/10 hover:bg-black/50 transition-colors backdrop-blur-sm">
                     <h4 className="font-bold text-indigo-300 text-sm mb-2">From Spark UI</h4>
                     <p className="text-sm text-slate-300">SQL Tab &gt; Click Query Description &gt; Scroll to "Physical Plan"</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {showImplGuide && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-lg z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900/70 border border-white/20 rounded-3xl max-w-2xl w-full shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-fade-in overflow-hidden backdrop-blur-2xl relative">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" /> Technical Architecture
              </h3>
              <button onClick={() => setShowImplGuide(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 grid grid-cols-1 gap-6 text-sm text-slate-300">
               <div className="flex gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
                  <span className="font-bold text-indigo-400 text-lg">01</span>
                  <p><strong>Parsing:</strong> Input text is sent to Google Gemini 2.0 with a strict system prompt to identify Spark operators (Scan, Join, Shuffle).</p>
               </div>
               <div className="flex gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
                  <span className="font-bold text-indigo-400 text-lg">02</span>
                  <p><strong>Graphing:</strong> D3.js creates a force-directed graph from the parsed Nodes and Edges.</p>
               </div>
               <div className="flex gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
                  <span className="font-bold text-indigo-400 text-lg">03</span>
                  <p><strong>Context Retention:</strong> The analysis JSON is fed back into a Gemini Chat Session to enable the "Consultant" feature.</p>
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
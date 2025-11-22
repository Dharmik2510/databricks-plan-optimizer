
import React, { useState, useEffect, useRef } from 'react';
import { StreamMetric, StreamLog, StreamStatus, DatabricksConfig } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ComposedChart, Bar } from 'recharts';
import { Activity, WifiOff, Database, Terminal, Square, Settings, Cpu, Network, Lock, X, Layers, ArrowLeftRight, AlertOctagon, Trash2, AlertTriangle, CheckCircle, Loader2, HardDrive } from 'lucide-react';

export const LiveMonitor: React.FC = () => {
  const [status, setStatus] = useState<StreamStatus>(StreamStatus.DISCONNECTED);
  const [metrics, setMetrics] = useState<StreamMetric[]>([]);
  const [logs, setLogs] = useState<StreamLog[]>([]);
  const [simulationInterval, setSimulationInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<DatabricksConfig>({ host: '', clusterId: '', token: '' });
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeView, setActiveView] = useState<'metrics' | 'dag'>('metrics');
  const [batchProgress, setBatchProgress] = useState(0);

  const logEndRef = useRef<HTMLDivElement>(null);
  const forceFailureRef = useRef(false); // Ref to trigger failure inside interval
  const MAX_DATA_POINTS = 30;

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Batch Progress Simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (status !== StreamStatus.DISCONNECTED && status !== StreamStatus.CONNECTING) {
        interval = setInterval(() => {
            setBatchProgress(prev => {
                if (prev >= 100) return 0; // Reset for next batch
                
                // Speed based on cluster health
                let speed = 1.5;
                if (status === StreamStatus.DEGRADING) speed = 0.5;
                if (status === StreamStatus.CRITICAL) speed = 0.1; // Almost stuck
                
                return Math.min(prev + speed, 100);
            });
        }, 50);
    } else {
        setBatchProgress(0);
    }

    return () => clearInterval(interval);
  }, [status]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnecting(false);
      setShowConfig(false);
      startSimulation(); 
    }, 1500);
  };

  const handleInjectFailure = () => {
    forceFailureRef.current = true;
  };

  const startSimulation = () => {
    setStatus(StreamStatus.CONNECTING);
    setTimeout(() => {
      setStatus(StreamStatus.HEALTHY);
      const interval = setInterval(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });

        setMetrics(prev => {
          const lastMetric = prev[prev.length - 1] || { 
            inputRate: 1000, 
            processRate: 1200, 
            driverMemory: 20, 
            executorMemory: 30,
            batchDuration: 2000,
            swapUsed: 0,
            cpuLoad: 15,
            shuffleReadBytes: 50 * 1024 * 1024, // 50 MB
            shuffleWriteBytes: 40 * 1024 * 1024,
            gcTimeMs: 50,
            activeTasks: 12,
            taskFailures: 0
          };

          let newInputRate = lastMetric.inputRate + (Math.random() * 200 - 50);
          let newProcessRate = lastMetric.processRate;
          let newDriverMem = lastMetric.driverMemory;
          let newSwap = lastMetric.swapUsed || 0;
          let newCpu = lastMetric.cpuLoad || 15;
          
          // Simulation Drift
          if (prev.length > 15) {
             newProcessRate = lastMetric.processRate - (Math.random() * 80); 
             newDriverMem = lastMetric.driverMemory + 1.5; 
             newInputRate += 100; 
             newSwap += 0.5; 
             newCpu += 2;
          }

          // Extended Metrics Simulation
          let newShuffleRead = lastMetric.shuffleReadBytes + (Math.random() * 10 * 1024 * 1024 - 5 * 1024 * 1024);
          if (newShuffleRead < 1024 * 1024) newShuffleRead = 1024 * 1024; // Min 1MB
          let newShuffleWrite = newShuffleRead * (0.7 + Math.random() * 0.2); // Write is usually correlated with read

          let newActiveTasks = Math.floor(newInputRate / 200) + Math.floor(Math.random() * 5);
          let newTaskFailures = 0;
          let newGcTime = 40 + (Math.random() * 30); // Base GC

          // Bounds
          if (newDriverMem > 95) newDriverMem = 95;
          if (newInputRate < 500) newInputRate = 500;
          if (newSwap > 100) newSwap = 100;
          if (newCpu > 100) newCpu = 100;

          // Health Logic
          let currentHealth = StreamStatus.HEALTHY;
          
          if (newDriverMem > 70 || newInputRate > newProcessRate || newSwap > 20) {
             currentHealth = StreamStatus.DEGRADING;
             newGcTime += 150 + Math.random() * 100; // Elevated GC
          }
          
          if (newDriverMem > 90 || newSwap > 50) {
             currentHealth = StreamStatus.CRITICAL;
             newGcTime += 800 + Math.random() * 500; // Severe GC Spike
             // Random chance of task failure in critical state
             if (Math.random() > 0.7) newTaskFailures = Math.floor(Math.random() * 4) + 1;
          }

          // Manual Failure Injection
          if (forceFailureRef.current) {
              currentHealth = StreamStatus.CRITICAL;
              newTaskFailures = Math.floor(Math.random() * 8) + 4; // Spike failures
              newActiveTasks = Math.max(0, newActiveTasks - newTaskFailures);
              forceFailureRef.current = false; // Reset
          }
          
          setStatus(currentHealth);

          // Log Generation
          if (Math.random() > 0.7 || newTaskFailures > 0) {
             let logMsg = `Batch 49${prev.length} completed in ${(Math.random() * 2 + 1).toFixed(2)}s`;
             let logLevel: 'INFO' | 'WARN' | 'ERROR' = 'INFO';

             if (newTaskFailures > 0) {
               logMsg = `TaskSetManager: Lost task ${Math.floor(Math.random()*100)}.0 in stage ${Math.floor(Math.random()*10)} (TID ${Math.floor(Math.random()*1000)}, executor ${Math.floor(Math.random()*5)}): ExecutorLostFailure`;
               logLevel = 'ERROR';
             } else if (currentHealth === StreamStatus.CRITICAL) {
               logMsg = `Executor 4 Lost: OutOfMemoryError. Swap at ${newSwap.toFixed(1)}%`;
               logLevel = 'ERROR';
             } else if (currentHealth === StreamStatus.DEGRADING) {
               logMsg = `Micro-batch delayed. Process Rate fell to ${newProcessRate.toFixed(0)}/sec. GC Time: ${newGcTime.toFixed(0)}ms`;
               logLevel = 'WARN';
             }

             const newLog: StreamLog = {
               id: Math.random().toString(),
               timestamp: timeStr,
               level: logLevel,
               message: logMsg
             };
             setLogs(l => [...l.slice(-20), newLog]);
          }

          const newMetric: StreamMetric = {
            timestamp: timeStr,
            inputRate: newInputRate,
            processRate: newProcessRate,
            batchDuration: Math.random() * 1000 + 2000,
            driverMemory: newDriverMem,
            executorMemory: lastMetric.executorMemory + (Math.random() * 2 - 0.5),
            swapUsed: newSwap,
            cpuLoad: newCpu,
            shuffleReadBytes: newShuffleRead,
            shuffleWriteBytes: newShuffleWrite,
            gcTimeMs: newGcTime,
            activeTasks: newActiveTasks,
            taskFailures: newTaskFailures
          };

          const newData = [...prev, newMetric];
          if (newData.length > MAX_DATA_POINTS) newData.shift();
          return newData;
        });

      }, 1000);
      setSimulationInterval(interval);
    }, 1500);
  };

  const stopSimulation = () => {
    if (simulationInterval) clearInterval(simulationInterval);
    setSimulationInterval(null);
    setStatus(StreamStatus.DISCONNECTED);
    setMetrics([]);
    setLogs([]);
    setBatchProgress(0);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // --- DAG RENDER LOGIC ---
  const getStageStatus = (start: number, end: number) => {
      if (batchProgress < start) return 'PENDING';
      if (batchProgress >= start && batchProgress < end) {
          if (status === StreamStatus.CRITICAL) return 'ERROR';
          return 'RUNNING';
      }
      return 'COMPLETED';
  };

  const DAG_STAGES = [
      { id: 1, name: 'Kafka Source', sub: 'Read Stream', start: 0, end: 35, icon: Database },
      { id: 2, name: 'MapGroups', sub: 'Stateful Agg', start: 35, end: 70, icon: Layers },
      { id: 3, name: 'Delta Sink', sub: 'Append Write', start: 70, end: 100, icon: HardDrive }
  ];

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col relative">
      
      {/* Connection Config Modal */}
      {showConfig && (
        <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 rounded-3xl">
          <div className="bg-white/90 backdrop-blur-2xl rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden border border-white/50">
             <button onClick={() => setShowConfig(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"><X className="w-5 h-5"/></button>
             
             <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
               <Settings className="w-5 h-5 text-orange-600" /> Connect Cluster
             </h3>
             
             <div className="space-y-4">
               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Databricks Host URL</label>
                 <input 
                    type="text" 
                    placeholder="https://adb-xxxx.azuredatabricks.net" 
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-900 focus:border-orange-500 outline-none font-medium"
                    value={config.host}
                    onChange={e => setConfig({...config, host: e.target.value})}
                 />
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Cluster ID</label>
                 <input 
                    type="text" 
                    placeholder="0923-123456-abcde" 
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-900 focus:border-orange-500 outline-none font-medium"
                    value={config.clusterId}
                    onChange={e => setConfig({...config, clusterId: e.target.value})}
                 />
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Access Token (PAT)</label>
                 <div className="relative">
                   <input 
                      type="password" 
                      placeholder="dapi..." 
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-900 focus:border-orange-500 outline-none pl-10 font-medium"
                      value={config.token}
                      onChange={e => setConfig({...config, token: e.target.value})}
                   />
                   <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                 </div>
               </div>
               
               <button 
                  onClick={handleConnect}
                  disabled={isConnecting || !config.host}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-lg mt-4 transition-all shadow-md flex justify-center items-center gap-2"
               >
                 {isConnecting ? 'Connecting...' : 'Establish Connection'}
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Header Controls */}
      <div className="bg-white/50 backdrop-blur-3xl rounded-3xl border border-white/60 p-6 flex justify-between items-center shadow-lg ring-1 ring-white/40">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl border shadow-sm backdrop-blur-md transition-colors ${
            status === StreamStatus.DISCONNECTED ? 'bg-slate-100/50 border-slate-200 text-slate-400' :
            status === StreamStatus.CRITICAL ? 'bg-red-50/50 border-red-500 text-red-600' :
            status === StreamStatus.DEGRADING ? 'bg-amber-50/50 border-amber-200 text-amber-600' :
            'bg-emerald-50/50 border-emerald-200 text-emerald-600'
          }`}>
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3 drop-shadow-sm">
              Live Monitor
              {status !== StreamStatus.DISCONNECTED && (
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    status === StreamStatus.CRITICAL ? 'bg-red-500' : status === StreamStatus.DEGRADING ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${
                    status === StreamStatus.CRITICAL ? 'bg-red-500' : status === StreamStatus.DEGRADING ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}></span>
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2 text-xs mt-1">
              <span className="text-slate-700 font-semibold">Status:</span>
              <span className={`font-bold uppercase tracking-wider ${
                 status === StreamStatus.CRITICAL ? 'text-red-700' :
                 status === StreamStatus.DEGRADING ? 'text-amber-700' :
                 status === StreamStatus.HEALTHY ? 'text-emerald-700' : 'text-slate-500'
              }`}>{status}</span>
              {status !== StreamStatus.DISCONNECTED && <span className="text-slate-500">| {config.clusterId || 'Simulated Cluster'}</span>}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
           {status !== StreamStatus.DISCONNECTED && (
            <>
             <button 
                onClick={handleInjectFailure}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-600 rounded-xl text-xs font-bold transition-all backdrop-blur-md shadow-sm"
             >
                <AlertTriangle className="w-3 h-3" /> Inject Failure
             </button>
             <div className="flex bg-white/40 rounded-xl p-1 border border-white/50 mr-2 backdrop-blur-md">
                <button 
                  onClick={() => setActiveView('metrics')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeView === 'metrics' ? 'bg-white/80 text-orange-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Metrics
                </button>
                <button 
                  onClick={() => setActiveView('dag')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeView === 'dag' ? 'bg-white/80 text-orange-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Live DAG
                </button>
             </div>
            </>
           )}

          {status === StreamStatus.DISCONNECTED ? (
            <button onClick={() => setShowConfig(true)} className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-500/20 backdrop-blur-md">
              <Network className="w-4 h-4" /> Connect
            </button>
          ) : (
             <button onClick={stopSimulation} className="flex items-center gap-2 px-6 py-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl font-bold transition-all shadow-sm backdrop-blur-md">
              <Square className="w-4 h-4 fill-current" /> Stop
            </button>
          )}
        </div>
      </div>

      {status === StreamStatus.DISCONNECTED ? (
        <div className="flex-1 flex items-center justify-center bg-white/30 backdrop-blur-xl rounded-3xl border border-white/50 border-dashed ring-1 ring-white/20">
          <div className="text-center text-slate-500">
            <WifiOff className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-bold text-slate-700">No Active Stream</p>
            <p className="text-sm opacity-80 font-medium">Connect to a cluster to visualize real-time telemetry.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          
          {activeView === 'metrics' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              
              {/* LEFT COL: Charts */}
              <div className="lg:col-span-2 space-y-6 flex flex-col h-full overflow-y-auto pr-2 custom-scrollbar">
                
                {/* Throughput */}
                <div className="flex-shrink-0 h-60 bg-white/50 backdrop-blur-3xl rounded-3xl border border-white/60 p-6 relative overflow-hidden shadow-lg ring-1 ring-white/40">
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="text-slate-900 font-bold flex items-center gap-2 drop-shadow-sm"><Database className="w-4 h-4 text-orange-600"/> Throughput</h3>
                  </div>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={metrics}>
                        <defs>
                          <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ea580c" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorProcess" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(226, 232, 240, 0.5)" vertical={false} />
                        <XAxis dataKey="timestamp" tick={{fontSize: 10, fill: '#334155', fontWeight: 600}} tickLine={false} axisLine={false} />
                        <YAxis tick={{fontSize: 10, fill: '#334155', fontWeight: 600}} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{backgroundColor: 'rgba(255,255,255,0.9)', borderColor: '#fff', color: '#1e293b', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}} />
                        <Area type="monotone" dataKey="inputRate" name="Input Rows/s" stroke="#ea580c" strokeWidth={3} fill="url(#colorInput)" />
                        <Area type="monotone" dataKey="processRate" name="Process Rows/s" stroke="#10b981" strokeWidth={3} fill="url(#colorProcess)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="flex gap-6">
                    {/* Shuffle I/O */}
                    <div className="flex-1 h-60 bg-white/50 backdrop-blur-3xl rounded-3xl border border-white/60 p-6 relative overflow-hidden shadow-lg ring-1 ring-white/40">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-slate-900 font-bold flex items-center gap-2 drop-shadow-sm"><ArrowLeftRight className="w-4 h-4 text-blue-600"/> Shuffle I/O</h3>
                        </div>
                        <div className="h-40 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(226, 232, 240, 0.5)" vertical={false} />
                                <XAxis dataKey="timestamp" hide />
                                <YAxis tickFormatter={formatBytes} tick={{fontSize: 10, fill: '#334155', fontWeight: 600}} tickLine={false} axisLine={false} />
                                <Tooltip formatter={(val: number) => formatBytes(val)} contentStyle={{backgroundColor: 'rgba(255,255,255,0.9)', borderColor: '#fff', color: '#1e293b', borderRadius: '12px'}} />
                                <Area type="monotone" dataKey="shuffleReadBytes" name="Read" stroke="#3b82f6" fill="#93c5fd" fillOpacity={0.3} strokeWidth={2} />
                                <Area type="monotone" dataKey="shuffleWriteBytes" name="Write" stroke="#8b5cf6" fill="#c4b5fd" fillOpacity={0.3} strokeWidth={2} />
                            </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Task Health */}
                    <div className="flex-1 h-60 bg-white/50 backdrop-blur-3xl rounded-3xl border border-white/60 p-6 relative overflow-hidden shadow-lg ring-1 ring-white/40">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-slate-900 font-bold flex items-center gap-2 drop-shadow-sm"><AlertOctagon className="w-4 h-4 text-purple-600"/> Task Health</h3>
                        </div>
                        <div className="h-40 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={metrics}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(226, 232, 240, 0.5)" vertical={false} />
                                <XAxis dataKey="timestamp" hide />
                                <YAxis tick={{fontSize: 10, fill: '#334155', fontWeight: 600}} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{backgroundColor: 'rgba(255,255,255,0.9)', borderColor: '#fff', color: '#1e293b', borderRadius: '12px'}} />
                                <Line type="monotone" dataKey="activeTasks" name="Active" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                <Bar dataKey="taskFailures" name="Failures" fill="#ef4444" barSize={20} />
                            </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* System Resources + GC */}
                <div className="flex-shrink-0 h-60 bg-white/50 backdrop-blur-3xl rounded-3xl border border-white/60 p-6 relative overflow-hidden shadow-lg ring-1 ring-white/40">
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="text-slate-900 font-bold flex items-center gap-2 drop-shadow-sm"><Cpu className="w-4 h-4 text-amber-500"/> Resources & GC</h3>
                     <div className="flex gap-3 text-[10px] font-bold">
                        <span className="text-amber-600">● Heap</span>
                        <span className="text-red-600">● Swap</span>
                        <span className="text-slate-400">▮ GC Time</span>
                     </div>
                  </div>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={metrics}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(226, 232, 240, 0.5)" vertical={false} />
                        <XAxis dataKey="timestamp" tick={{fontSize: 10, fill: '#334155', fontWeight: 600}} tickLine={false} axisLine={false} />
                        
                        {/* Left Axis: Percentage */}
                        <YAxis yAxisId="left" domain={[0, 100]} tick={{fontSize: 10, fill: '#334155', fontWeight: 600}} tickLine={false} axisLine={false} label={{ value: '% Used', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} />
                        
                        {/* Right Axis: GC Time ms */}
                        <YAxis yAxisId="right" orientation="right" tick={{fontSize: 10, fill: '#64748b', fontWeight: 600}} tickLine={false} axisLine={false} label={{ value: 'GC (ms)', angle: 90, position: 'insideRight', fill: '#64748b', fontSize: 10 }} />

                        <Tooltip contentStyle={{backgroundColor: 'rgba(255,255,255,0.9)', borderColor: '#fff', color: '#1e293b', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}} />
                        
                        <Bar yAxisId="right" dataKey="gcTimeMs" name="GC Time" fill="#cbd5e1" barSize={10} radius={[4, 4, 0, 0]} opacity={0.7} />
                        <Line yAxisId="left" type="monotone" dataKey="driverMemory" name="Driver Heap" stroke="#f59e0b" strokeWidth={3} dot={false} />
                        <Line yAxisId="left" type="monotone" dataKey="swapUsed" name="Swap Used" stroke="#ef4444" strokeWidth={3} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* RIGHT COL: Logs - Keep Dark for Terminal Feel */}
              <div className="bg-[#0f172a] rounded-3xl border border-slate-800 overflow-hidden flex flex-col relative shadow-2xl h-full">
                <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between flex-shrink-0">
                   <h3 className="font-bold text-slate-200 flex items-center gap-2 text-sm"><Terminal className="w-4 h-4 text-slate-500"/> Driver Logs</h3>
                   <div className="flex items-center gap-2">
                       <span onClick={() => setLogs([])} className="cursor-pointer text-slate-500 hover:text-slate-300"><Trash2 className="w-3 h-3" /></span>
                       <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs custom-scrollbar bg-[#0f172a]">
                   {logs.map((log) => (
                     <div key={log.id} className="flex gap-2 animate-fade-in">
                        <span className="text-slate-500 flex-shrink-0">[{log.timestamp}]</span>
                        <span className={`font-bold flex-shrink-0 ${
                          log.level === 'ERROR' ? 'text-red-400' : log.level === 'WARN' ? 'text-amber-400' : 'text-emerald-400'
                        }`}>{log.level}</span>
                        <span className="text-slate-300 break-all">{log.message}</span>
                     </div>
                   ))}
                   <div ref={logEndRef} />
                </div>
              </div>

            </div>
          ) : (
            // LIVE DAG VIEW
            <div className="h-full bg-white/50 backdrop-blur-3xl rounded-3xl border border-white/60 p-8 relative overflow-hidden flex flex-col items-center shadow-lg ring-1 ring-white/40">
                
                {/* Header Section */}
                <div className="text-center space-y-4 mb-12">
                    <div className="inline-block p-4 rounded-full bg-white/60 border border-white/50 shadow-md relative">
                        <Layers className="w-10 h-10 text-orange-600" />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                            <Activity className="w-3 h-3 text-white animate-pulse" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-slate-900 drop-shadow-sm">Micro-Batch Execution</h3>
                        <p className="text-slate-600 font-medium">
                            Batch ID: <span className="font-mono text-orange-600">#49{metrics.length}</span> 
                            <span className="mx-2">•</span> 
                            Progress: {Math.round(batchProgress)}%
                        </p>
                    </div>
                </div>

                {/* Dynamic DAG */}
                <div className="w-full max-w-5xl flex items-center justify-between relative px-10">
                    
                    {/* Progress Bar Background */}
                    <div className="absolute top-1/2 left-10 right-10 h-1 bg-slate-300/50 -translate-y-1/2 -z-10 rounded-full"></div>
                    <div className="absolute top-1/2 left-10 right-10 h-1 bg-orange-500 -translate-y-1/2 -z-10 rounded-full transition-all duration-100 ease-linear" style={{ width: `${Math.max(0, batchProgress)}%` }}></div>

                    {/* Stages */}
                    {DAG_STAGES.map((stage, idx) => {
                        const statusStr = getStageStatus(stage.start, stage.end);
                        const isRunning = statusStr === 'RUNNING';
                        const isCompleted = statusStr === 'COMPLETED';
                        const isError = statusStr === 'ERROR';
                        
                        return (
                            <div key={stage.id} className="flex flex-col items-center gap-4 relative group">
                                
                                {/* Node */}
                                <div className={`w-40 h-24 rounded-2xl border-2 flex flex-col items-center justify-center relative transition-all duration-300 shadow-sm ${
                                    isError ? 'bg-red-50 border-red-500 text-red-800 shadow-red-200' :
                                    isCompleted ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-emerald-200' :
                                    isRunning ? 'bg-orange-50 border-orange-500 text-orange-800 shadow-orange-200 scale-105' :
                                    'bg-white/60 border-slate-300 text-slate-500'
                                }`}>
                                    {isCompleted && <div className="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full p-1 shadow-md"><CheckCircle className="w-4 h-4" /></div>}
                                    {isRunning && <div className="absolute -top-2 -right-2 bg-orange-500 text-white rounded-full p-1 shadow-md animate-spin"><Loader2 className="w-4 h-4" /></div>}
                                    
                                    <stage.icon className={`w-6 h-6 mb-2 ${isError ? 'text-red-600' : isCompleted ? 'text-emerald-600' : isRunning ? 'text-orange-600' : 'text-slate-400'}`} />
                                    <div className="text-sm font-bold">{stage.name}</div>
                                    <div className="text-[10px] opacity-80 font-semibold uppercase tracking-wider">{stage.sub}</div>
                                </div>

                                {/* Metric Card Below */}
                                <div className={`mt-2 text-center transition-all duration-500 ${isRunning || isCompleted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                        {idx === 0 ? 'Records Read' : idx === 1 ? 'Shuffle Bytes' : 'Write Speed'}
                                    </div>
                                    <div className="text-sm font-bold text-slate-800 font-mono">
                                        {idx === 0 ? `${(metrics[metrics.length-1]?.inputRate || 0).toFixed(0)} rows` : 
                                         idx === 1 ? formatBytes(metrics[metrics.length-1]?.shuffleReadBytes || 0) : 
                                         `${(metrics[metrics.length-1]?.processRate || 0).toFixed(0)} rows/s`}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

            </div>
          )}

        </div>
      )}
    </div>
  );
};

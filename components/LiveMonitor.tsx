import React, { useState, useEffect, useRef } from 'react';
import { StreamMetric, StreamLog, StreamStatus, DatabricksConfig } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Activity, WifiOff, Server, Database, Terminal, Play, Square, Settings, Cpu, Network, Lock, X, Layers } from 'lucide-react';
import { validateConnection } from '../services/databricksService';

export const LiveMonitor: React.FC = () => {
  const [status, setStatus] = useState<StreamStatus>(StreamStatus.DISCONNECTED);
  const [metrics, setMetrics] = useState<StreamMetric[]>([]);
  const [logs, setLogs] = useState<StreamLog[]>([]);
  const [simulationInterval, setSimulationInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<DatabricksConfig>({ host: '', clusterId: '', token: '' });
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeView, setActiveView] = useState<'metrics' | 'dag'>('metrics');

  const logEndRef = useRef<HTMLDivElement>(null);
  const MAX_DATA_POINTS = 30;

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnecting(false);
      setShowConfig(false);
      startSimulation(); 
    }, 1500);
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
            cpuLoad: 15
          };

          let newInputRate = lastMetric.inputRate + (Math.random() * 200 - 50);
          let newProcessRate = lastMetric.processRate;
          let newDriverMem = lastMetric.driverMemory;
          let newSwap = lastMetric.swapUsed || 0;
          let newCpu = lastMetric.cpuLoad || 15;
          
          if (prev.length > 15) {
             newProcessRate = lastMetric.processRate - (Math.random() * 80); 
             newDriverMem = lastMetric.driverMemory + 1.5; 
             newInputRate += 100; 
             newSwap += 0.5; 
             newCpu += 2;
          }

          if (newDriverMem > 95) newDriverMem = 95;
          if (newInputRate < 500) newInputRate = 500;
          if (newSwap > 100) newSwap = 100;
          if (newCpu > 100) newCpu = 100;

          let currentHealth = StreamStatus.HEALTHY;
          if (newDriverMem > 70 || newInputRate > newProcessRate || newSwap > 20) currentHealth = StreamStatus.DEGRADING;
          if (newDriverMem > 90 || newSwap > 50) currentHealth = StreamStatus.CRITICAL;
          
          setStatus(currentHealth);

          if (Math.random() > 0.7) {
             const newLog: StreamLog = {
               id: Math.random().toString(),
               timestamp: timeStr,
               level: currentHealth === StreamStatus.CRITICAL ? 'ERROR' : currentHealth === StreamStatus.DEGRADING ? 'WARN' : 'INFO',
               message: currentHealth === StreamStatus.CRITICAL 
                 ? `Executor 4 Lost: OutOfMemoryError. Swap at ${newSwap.toFixed(1)}%`
                 : currentHealth === StreamStatus.DEGRADING
                 ? `Micro-batch delayed. Process Rate fell to ${newProcessRate.toFixed(0)}/sec`
                 : `Batch 49${prev.length} completed in ${(Math.random() * 2 + 1).toFixed(2)}s`
             };
             setLogs(l => [...l.slice(-20), newLog]);
          }

          const newMetric = {
            timestamp: timeStr,
            inputRate: newInputRate,
            processRate: newProcessRate,
            batchDuration: Math.random() * 1000 + 2000,
            driverMemory: newDriverMem,
            executorMemory: lastMetric.executorMemory + (Math.random() * 2 - 0.5),
            swapUsed: newSwap,
            cpuLoad: newCpu
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
  };

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col relative">
      
      {/* Connection Config Modal */}
      {showConfig && (
        <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 rounded-3xl">
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
             <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
             <button onClick={() => setShowConfig(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
             
             <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
               <Settings className="w-5 h-5 text-cyan-400" /> Connect Cluster
             </h3>
             
             <div className="space-y-4">
               <div>
                 <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Databricks Host URL</label>
                 <input 
                    type="text" 
                    placeholder="https://adb-xxxx.azuredatabricks.net" 
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500/50 outline-none"
                    value={config.host}
                    onChange={e => setConfig({...config, host: e.target.value})}
                 />
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Cluster ID</label>
                 <input 
                    type="text" 
                    placeholder="0923-123456-abcde" 
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500/50 outline-none"
                    value={config.clusterId}
                    onChange={e => setConfig({...config, clusterId: e.target.value})}
                 />
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Access Token (PAT)</label>
                 <div className="relative">
                   <input 
                      type="password" 
                      placeholder="dapi..." 
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500/50 outline-none pl-10"
                      value={config.token}
                      onChange={e => setConfig({...config, token: e.target.value})}
                   />
                   <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                 </div>
               </div>
               
               <button 
                  onClick={handleConnect}
                  disabled={isConnecting || !config.host}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl mt-4 transition-all shadow-lg shadow-cyan-900/20 flex justify-center items-center gap-2"
               >
                 {isConnecting ? 'Connecting...' : 'Establish Connection'}
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Header Controls */}
      <div className="bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-white/10 p-6 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl border shadow-[0_0_15px_rgba(0,0,0,0.3)] backdrop-blur-md transition-colors ${
            status === StreamStatus.DISCONNECTED ? 'bg-slate-800/50 border-slate-700 text-slate-400' :
            status === StreamStatus.CRITICAL ? 'bg-red-500/20 border-red-500/50 text-red-500 shadow-red-500/20' :
            status === StreamStatus.DEGRADING ? 'bg-amber-500/20 border-amber-500/50 text-amber-500 shadow-amber-500/20' :
            'bg-emerald-500/20 border-emerald-500/50 text-emerald-500 shadow-emerald-500/20'
          }`}>
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
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
              <span className="text-slate-400">Status:</span>
              <span className={`font-bold uppercase tracking-wider ${
                 status === StreamStatus.CRITICAL ? 'text-red-400' :
                 status === StreamStatus.DEGRADING ? 'text-amber-400' :
                 status === StreamStatus.HEALTHY ? 'text-emerald-400' : 'text-slate-500'
              }`}>{status}</span>
              {status !== StreamStatus.DISCONNECTED && <span className="text-slate-500">| {config.clusterId || 'Simulated Cluster'}</span>}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
           {status !== StreamStatus.DISCONNECTED && (
             <div className="flex bg-black/30 rounded-xl p-1 border border-white/10 mr-2">
                <button 
                  onClick={() => setActiveView('metrics')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeView === 'metrics' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  Metrics
                </button>
                <button 
                  onClick={() => setActiveView('dag')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeView === 'dag' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  Live DAG
                </button>
             </div>
           )}

          {status === StreamStatus.DISCONNECTED ? (
            <button onClick={() => setShowConfig(true)} className="flex items-center gap-2 px-6 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(6,182,212,0.1)] backdrop-blur-md">
              <Network className="w-4 h-4" /> Connect
            </button>
          ) : (
             <button onClick={stopSimulation} className="flex items-center gap-2 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(239,68,68,0.1)] backdrop-blur-md">
              <Square className="w-4 h-4 fill-current" /> Stop
            </button>
          )}
        </div>
      </div>

      {status === StreamStatus.DISCONNECTED ? (
        <div className="flex-1 flex items-center justify-center bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-white/10 border-dashed">
          <div className="text-center text-slate-400">
            <WifiOff className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No Active Stream</p>
            <p className="text-sm opacity-70">Connect to a cluster to visualize real-time telemetry.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          
          {activeView === 'metrics' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              
              {/* LEFT COL: Charts */}
              <div className="lg:col-span-2 space-y-6 flex flex-col">
                
                {/* Throughput */}
                <div className="flex-1 bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-white/10 p-6 relative overflow-hidden group">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="text-white font-bold flex items-center gap-2"><Database className="w-4 h-4 text-cyan-400"/> Throughput</h3>
                  </div>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={metrics}>
                        <defs>
                          <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorProcess" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="timestamp" tick={{fontSize: 10, fill: '#94a3b8'}} tickLine={false} axisLine={false} />
                        <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9'}} />
                        <Area type="monotone" dataKey="inputRate" stroke="#06b6d4" strokeWidth={2} fill="url(#colorInput)" />
                        <Area type="monotone" dataKey="processRate" stroke="#34d399" strokeWidth={2} fill="url(#colorProcess)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* System Resources */}
                <div className="flex-1 bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-white/10 p-6 relative overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="text-white font-bold flex items-center gap-2"><Cpu className="w-4 h-4 text-amber-400"/> System Load</h3>
                     <div className="flex gap-3 text-[10px]">
                        <span className="text-amber-400">● Driver Heap</span>
                        <span className="text-slate-400">● Executor</span>
                        <span className="text-red-400">● Swap</span>
                     </div>
                  </div>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metrics}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="timestamp" tick={{fontSize: 10, fill: '#94a3b8'}} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} tick={{fontSize: 10, fill: '#94a3b8'}} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9'}} />
                        <Line type="monotone" dataKey="driverMemory" stroke="#fbbf24" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="executorMemory" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        <Line type="monotone" dataKey="swapUsed" stroke="#f87171" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* RIGHT COL: Logs */}
              <div className="bg-black/20 backdrop-blur-2xl rounded-3xl border border-white/10 overflow-hidden flex flex-col relative">
                <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                   <h3 className="font-bold text-white flex items-center gap-2 text-sm"><Terminal className="w-4 h-4 text-slate-400"/> Driver Logs</h3>
                   <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs custom-scrollbar">
                   {logs.map((log) => (
                     <div key={log.id} className="flex gap-2 animate-fade-in">
                        <span className="text-slate-500 flex-shrink-0">[{log.timestamp}]</span>
                        <span className={`font-bold flex-shrink-0 ${
                          log.level === 'ERROR' ? 'text-red-500' : log.level === 'WARN' ? 'text-amber-500' : 'text-emerald-500'
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
            <div className="h-full bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-white/10 p-6 relative overflow-hidden flex flex-col items-center justify-center">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                
                <div className="text-center space-y-4">
                    <div className="inline-block p-4 rounded-full bg-cyan-500/20 border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                        <Layers className="w-10 h-10 text-cyan-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Micro-Batch Execution Plan</h3>
                    <p className="text-slate-300 max-w-md font-light">
                        Visualizing the physical plan for the currently processing micro-batch (id=49{metrics.length}).
                    </p>
                </div>

                <div className="mt-10 w-full max-w-3xl h-64 border border-white/10 rounded-2xl bg-black/20 relative flex items-center justify-around backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-32 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xs font-bold text-emerald-300">Kafka Source</div>
                        <div className="text-[10px] text-slate-500">Read (10k rows)</div>
                    </div>
                    <div className="h-px w-16 bg-slate-600"></div>
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-32 h-10 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-xs font-bold text-blue-300">MapGroups</div>
                        <div className="text-[10px] text-slate-500">Stateful Op</div>
                    </div>
                    <div className="h-px w-16 bg-slate-600"></div>
                    <div className="flex flex-col items-center gap-2">
                         <div className={`w-32 h-10 rounded-lg border flex items-center justify-center text-xs font-bold transition-all duration-500 ${status === StreamStatus.CRITICAL ? 'bg-red-500/20 border-red-500/50 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-amber-500/20 border-amber-500/40 text-amber-300'}`}>
                            Delta Sink
                         </div>
                         <div className="text-[10px] text-slate-500">Write (Append)</div>
                    </div>
                </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
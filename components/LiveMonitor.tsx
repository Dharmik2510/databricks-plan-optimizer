
import React, { useState, useEffect, useRef } from 'react';
import { StreamMetric, StreamLog, StreamStatus, DatabricksConfig } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Activity, WifiOff, Database, Terminal, Square, Settings, Cpu, Network, Lock, X, Layers } from 'lucide-react';

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
        <div className="absolute inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 rounded-2xl">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden border border-slate-200">
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
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-900 focus:border-orange-500 outline-none"
                    value={config.host}
                    onChange={e => setConfig({...config, host: e.target.value})}
                 />
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Cluster ID</label>
                 <input 
                    type="text" 
                    placeholder="0923-123456-abcde" 
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-900 focus:border-orange-500 outline-none"
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
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-900 focus:border-orange-500 outline-none pl-10"
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
      <div className="bg-white/70 backdrop-blur-2xl rounded-2xl border border-slate-200/60 p-6 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl border shadow-sm backdrop-blur-md transition-colors ${
            status === StreamStatus.DISCONNECTED ? 'bg-slate-100 border-slate-200 text-slate-400' :
            status === StreamStatus.CRITICAL ? 'bg-red-50 border-red-200 text-red-600' :
            status === StreamStatus.DEGRADING ? 'bg-amber-50 border-amber-200 text-amber-600' :
            'bg-emerald-50 border-emerald-200 text-emerald-600'
          }`}>
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
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
              <span className="text-slate-500">Status:</span>
              <span className={`font-bold uppercase tracking-wider ${
                 status === StreamStatus.CRITICAL ? 'text-red-600' :
                 status === StreamStatus.DEGRADING ? 'text-amber-600' :
                 status === StreamStatus.HEALTHY ? 'text-emerald-600' : 'text-slate-500'
              }`}>{status}</span>
              {status !== StreamStatus.DISCONNECTED && <span className="text-slate-400">| {config.clusterId || 'Simulated Cluster'}</span>}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
           {status !== StreamStatus.DISCONNECTED && (
             <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200 mr-2">
                <button 
                  onClick={() => setActiveView('metrics')}
                  className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeView === 'metrics' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Metrics
                </button>
                <button 
                  onClick={() => setActiveView('dag')}
                  className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeView === 'dag' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Live DAG
                </button>
             </div>
           )}

          {status === StreamStatus.DISCONNECTED ? (
            <button onClick={() => setShowConfig(true)} className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold transition-all shadow-sm backdrop-blur-md">
              <Network className="w-4 h-4" /> Connect
            </button>
          ) : (
             <button onClick={stopSimulation} className="flex items-center gap-2 px-6 py-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg font-bold transition-all shadow-sm backdrop-blur-md">
              <Square className="w-4 h-4 fill-current" /> Stop
            </button>
          )}
        </div>
      </div>

      {status === StreamStatus.DISCONNECTED ? (
        <div className="flex-1 flex items-center justify-center bg-white/50 backdrop-blur-xl rounded-2xl border border-slate-200 border-dashed">
          <div className="text-center text-slate-400">
            <WifiOff className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium text-slate-600">No Active Stream</p>
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
                <div className="flex-1 bg-white/70 backdrop-blur-2xl rounded-2xl border border-slate-200/60 p-6 relative overflow-hidden">
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="text-slate-900 font-bold flex items-center gap-2"><Database className="w-4 h-4 text-orange-500"/> Throughput</h3>
                  </div>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={metrics}>
                        <defs>
                          <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ea580c" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorProcess" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="timestamp" tick={{fontSize: 10, fill: '#64748b'}} tickLine={false} axisLine={false} />
                        <YAxis tick={{fontSize: 10, fill: '#64748b'}} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{backgroundColor: '#fff', borderColor: '#cbd5e1', color: '#1e293b'}} />
                        <Area type="monotone" dataKey="inputRate" stroke="#ea580c" strokeWidth={2} fill="url(#colorInput)" />
                        <Area type="monotone" dataKey="processRate" stroke="#10b981" strokeWidth={2} fill="url(#colorProcess)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* System Resources */}
                <div className="flex-1 bg-white/70 backdrop-blur-2xl rounded-2xl border border-slate-200/60 p-6 relative overflow-hidden">
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="text-slate-900 font-bold flex items-center gap-2"><Cpu className="w-4 h-4 text-amber-500"/> System Load</h3>
                     <div className="flex gap-3 text-[10px]">
                        <span className="text-amber-500">● Driver Heap</span>
                        <span className="text-slate-400">● Executor</span>
                        <span className="text-red-500">● Swap</span>
                     </div>
                  </div>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metrics}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="timestamp" tick={{fontSize: 10, fill: '#64748b'}} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} tick={{fontSize: 10, fill: '#64748b'}} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{backgroundColor: '#fff', borderColor: '#cbd5e1', color: '#1e293b'}} />
                        <Line type="monotone" dataKey="driverMemory" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="executorMemory" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        <Line type="monotone" dataKey="swapUsed" stroke="#ef4444" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* RIGHT COL: Logs - Keep Dark for Terminal Feel */}
              <div className="bg-[#0f172a] rounded-2xl border border-slate-800 overflow-hidden flex flex-col relative shadow-inner">
                <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                   <h3 className="font-bold text-slate-200 flex items-center gap-2 text-sm"><Terminal className="w-4 h-4 text-slate-500"/> Driver Logs</h3>
                   <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
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
            <div className="h-full bg-white/70 backdrop-blur-2xl rounded-2xl border border-slate-200/60 p-6 relative overflow-hidden flex flex-col items-center justify-center">
                
                <div className="text-center space-y-4">
                    <div className="inline-block p-4 rounded-full bg-orange-50 border border-orange-100 shadow-sm">
                        <Layers className="w-10 h-10 text-orange-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Micro-Batch Execution Plan</h3>
                    <p className="text-slate-500 max-w-md font-light">
                        Visualizing the physical plan for the currently processing micro-batch (id=49{metrics.length}).
                    </p>
                </div>

                <div className="mt-10 w-full max-w-3xl h-64 border border-slate-200 rounded-2xl bg-slate-50/50 relative flex items-center justify-around backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-32 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xs font-bold text-emerald-700">Kafka Source</div>
                        <div className="text-[10px] text-slate-500">Read (10k rows)</div>
                    </div>
                    <div className="h-px w-16 bg-slate-300"></div>
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-32 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-xs font-bold text-blue-700">MapGroups</div>
                        <div className="text-[10px] text-slate-500">Stateful Op</div>
                    </div>
                    <div className="h-px w-16 bg-slate-300"></div>
                    <div className="flex flex-col items-center gap-2">
                         <div className={`w-32 h-10 rounded-lg border flex items-center justify-center text-xs font-bold transition-all duration-500 ${status === StreamStatus.CRITICAL ? 'bg-red-50 border-red-200 text-red-700 shadow-md' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
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

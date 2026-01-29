import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  Clipboard,
  Clock3,
  Loader2,
  Search,
  Sparkles,
  Split,
  Tag,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowRight,
  History,
  TrendingUp,
  X,
  Zap,
  BarChart3
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { historicalApi, HistoricalAnalysisResult, HistoricalRunItem } from '../../api/historical';
import { Button, Card } from '../../design-system/components';
import { motion, AnimatePresence } from 'framer-motion';

// --- Constants & Helpers ---

const PROGRESS_STEPS = [
  'Resolving app…',
  'Fetching stages…',
  'Computing diffs…',
  'Writing findings…',
];

const formatBytes = (bytes: number) => {
  if (!bytes && bytes !== 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[idx]}`;
};

const formatDuration = (ms?: number | null) => {
  if (!ms && ms !== 0) return '—';
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  const remSecs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${remMins}m`;
  if (mins > 0) return `${mins}m ${remSecs}s`;
  return `${remSecs}s`;
};

const formatDelta = (value: number) => {
  if (!Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
};

const formatCount = (value?: number | null) => {
  if (value === 0) return '0';
  if (!value && value !== 0) return '—';
  return String(value);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

// --- Components ---

const InfoModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-orange-500" />
              How it works
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Search className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">1. Choose a Run</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  Enter a Spark App ID or search by name. We fetch the event logs from your history server or object storage.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">2. AI Analysis</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  Our advanced heuristics engine scans for skew, spill, and failed tasks. The AI then synthesizes these findings into a narrative report.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Split className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">3. Compare (Optional)</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  Select two runs to see a side-by-side comparison. Perfect for verifying optimizations or debugging regressions.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 flex justify-end">
          <Button onClick={onClose}>Got it</Button>
        </div>
      </div>
    </div>
  );
};

const HistoricalPage: React.FC = () => {
  const [mode, setMode] = useState<'analyze' | 'compare'>('analyze');
  const [isRunning, setIsRunning] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HistoricalAnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoricalAnalysisResult[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  // Input states
  const [analyzeInput, setAnalyzeInput] = useState({ appId: '', appName: '', startTime: '', endTime: '', question: '' });
  const [compareInput, setCompareInput] = useState({ appName: '', startTime: '', endTime: '', appIdA: '', appIdB: '', question: '' });

  const [runs, setRuns] = useState<HistoricalRunItem[]>([]);
  const [compareRuns, setCompareRuns] = useState<HistoricalRunItem[]>([]);
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);

  // Derived analysis data
  const summary = result?.evidence_json?.summary;
  const heuristics = result?.evidence_json?.heuristics;
  const application = result?.evidence_json?.application;
  const appA = result?.evidence_json?.appA;
  const appB = result?.evidence_json?.appB;
  const compareHeuristicsA = appA?.heuristics;
  const compareHeuristicsB = appB?.heuristics;
  const compareMetrics = result?.evidence_json?.comparison;

  // --- Effects ---

  // Progress simulator
  useEffect(() => {
    if (!isRunning) {
      setProgressIndex(0);
      return;
    }
    let index = 0;
    const interval = setInterval(() => {
      index = Math.min(PROGRESS_STEPS.length - 1, index + 1);
      setProgressIndex(index);
    }, 1400);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Load history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await historicalApi.history({ search: historySearch || undefined });
        setHistory(data || []);
      } catch {
        setHistory([]);
      }
    };
    loadHistory();
  }, [historySearch]);

  // Fetch runs for Analyze
  useEffect(() => {
    const fetchRuns = async () => {
      if (!analyzeInput.appName || !analyzeInput.startTime || !analyzeInput.endTime) {
        setRuns([]);
        return;
      }
      try {
        const data = await historicalApi.runs({ appName: analyzeInput.appName, start: analyzeInput.startTime, end: analyzeInput.endTime });
        setRuns(data || []);
      } catch { setRuns([]); }
    };
    fetchRuns();
  }, [analyzeInput.appName, analyzeInput.startTime, analyzeInput.endTime]);

  // Fetch runs for Compare
  useEffect(() => {
    const fetchRuns = async () => {
      if (!compareInput.appName || !compareInput.startTime || !compareInput.endTime) {
        setCompareRuns([]);
        return;
      }
      try {
        const data = await historicalApi.runs({ appName: compareInput.appName, start: compareInput.startTime, end: compareInput.endTime });
        setCompareRuns(data || []);
      } catch { setCompareRuns([]); }
    };
    fetchRuns();
  }, [compareInput.appName, compareInput.startTime, compareInput.endTime]);

  useEffect(() => {
    if (selectedCompareIds.length === 2) {
      setCompareInput((prev) => ({ ...prev, appIdA: selectedCompareIds[0], appIdB: selectedCompareIds[1] }));
    }
  }, [selectedCompareIds]);

  // --- Handlers ---

  const handleAnalyze = async () => {
    setError(null);
    setIsRunning(true);
    setResult(null);
    try {
      const data = await historicalApi.analyze({
        appId: analyzeInput.appId || undefined,
        appName: analyzeInput.appName || undefined,
        startTime: analyzeInput.startTime || undefined,
        endTime: analyzeInput.endTime || undefined,
        question: analyzeInput.question || undefined,
      });
      setResult(data);
      setHistory((prev) => [data, ...prev.filter((item) => item.id !== data.id)]);
    } catch (err: any) {
      setError(err?.message || 'Analysis failed');
    } finally {
      setIsRunning(false);
      setProgressIndex(PROGRESS_STEPS.length - 1);
    }
  };

  const handleCompare = async () => {
    setError(null);
    setIsRunning(true);
    setResult(null);
    try {
      const data = await historicalApi.compare({
        appIdA: compareInput.appIdA,
        appIdB: compareInput.appIdB,
        question: compareInput.question || undefined,
      });
      setResult(data);
      setHistory((prev) => [data, ...prev.filter((item) => item.id !== data.id)]);
    } catch (err: any) {
      setError(err?.message || 'Comparison failed');
    } finally {
      setIsRunning(false);
      setProgressIndex(PROGRESS_STEPS.length - 1);
    }
  };

  const copyReport = async () => {
    if (!result) return;
    const title = result.app_name ? `# ${result.app_name}` : '# Historical Job Analysis';
    const body = result.narrative_md || 'No narrative available.';
    await navigator.clipboard.writeText(`${title}\n\n${body}`);
  };

  const saveAnalysis = async () => {
    if (!result) return;
    const title = window.prompt('Name this analysis', result.title || result.app_name || 'Historical Analysis');
    if (!title) return;
    try {
      const updated = await historicalApi.update(result.id, { title });
      setResult(updated);
      setHistory((prev) => [updated, ...prev.filter((item) => item.id !== updated.id)]);
    } catch { /* ignore */ }
  };

  const openFromHistory = async (id: string) => {
    try {
      const data = await historicalApi.get(id);
      setResult(data);
    } catch { /* ignore */ }
  };

  const progressSteps = useMemo(() => {
    return PROGRESS_STEPS.map((step, index) => ({
      label: step,
      status: index < progressIndex ? 'done' : index === progressIndex ? 'active' : 'pending',
    }));
  }, [progressIndex]);

  // --- Render Helpers ---

  const MetricCard = ({ label, value, subtext, trend }: { label: string; value: React.ReactNode; subtext?: string; trend?: 'up' | 'down' | 'neutral' }) => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 group-hover:text-orange-500 transition-colors">{label}</div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white truncate">{value}</div>
      {subtext && <div className="text-sm text-slate-500 dark:text-slate-500 mt-1 truncate">{subtext}</div>}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-6 py-10 md:px-10 font-sans selection:bg-orange-500/30">
      <InfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} />

      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-full"></div>
              <div className="relative w-14 h-14 bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 transform rotate-3">
                <History className="w-7 h-7 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Historical Analysis
              </h1>
              <p className="text-base text-slate-600 dark:text-slate-400 mt-1 font-medium">
                Optimize past Spark runs with AI-driven insights.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowInfo(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Info className="w-4 h-4" /> How it works
            </button>
            <div className="bg-white dark:bg-slate-900 p-1.5 rounded-full border border-slate-200 dark:border-slate-800 flex shadow-sm">
              <button
                onClick={() => setMode('analyze')}
                className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${mode === 'analyze'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-md transform scale-105'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                Analyze
              </button>
              <button
                onClick={() => setMode('compare')}
                className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${mode === 'compare'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-md transform scale-105'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                Compare
              </button>
            </div>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/30 p-4 flex items-center gap-3 text-red-700 dark:text-red-400"
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </motion.div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Main Input Panel */}
          <div className="space-y-6">
            <Card className="p-8 border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <Search className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {mode === 'analyze' ? 'Analyze a Run' : 'Compare Two Runs'}
                </h2>
              </div>

              {mode === 'analyze' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">Spark App ID</label>
                    <input
                      value={analyzeInput.appId}
                      onChange={(e) => setAnalyzeInput((prev) => ({ ...prev, appId: e.target.value }))}
                      placeholder="app-20230101000000-0000"
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-5 py-4 text-slate-900 dark:text-white placeholder-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all outline-none font-mono text-sm"
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase tracking-wider">
                      <span className="bg-white dark:bg-[#0f172a] px-3 text-slate-400">Or search history</span>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      value={analyzeInput.appName}
                      onChange={(e) => setAnalyzeInput((prev) => ({ ...prev, appName: e.target.value }))}
                      placeholder="Application Name"
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white focus:border-orange-500 outline-none"
                    />
                    <div className="flex gap-2">
                      <input
                        type="datetime-local"
                        value={analyzeInput.startTime}
                        onChange={(e) => setAnalyzeInput((prev) => ({ ...prev, startTime: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-3 text-sm font-medium text-slate-900 dark:text-white focus:border-orange-500 outline-none"
                      />
                    </div>
                  </div>

                  {runs.length > 0 && (
                    <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 space-y-1 custom-scrollbar">
                      {runs.map((run) => (
                        <button
                          key={run.appId}
                          onClick={() => setAnalyzeInput((prev) => ({ ...prev, appId: run.appId }))}
                          className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all group"
                        >
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{run.appName}</div>
                            <div className="text-xs font-mono text-slate-500">{run.appId}</div>
                          </div>
                          <div className="text-xs font-medium bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-md">
                            {formatDuration(run.durationMs)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="pt-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1 mb-2 block">Specific Question (Optional)</label>
                    <textarea
                      value={analyzeInput.question}
                      onChange={(e) => setAnalyzeInput((prev) => ({ ...prev, question: e.target.value }))}
                      placeholder="e.g., Why was stage 3 so slow compared to last week?"
                      className="w-full h-24 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-5 py-4 text-slate-900 dark:text-white placeholder-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all outline-none resize-none text-sm"
                    />
                  </div>

                  <Button
                    onClick={handleAnalyze}
                    disabled={isRunning}
                    className="w-full py-4 text-lg font-bold shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 rounded-2xl"
                  >
                    {isRunning ? (
                      <span className="flex items-center gap-2"><Loader2 className="animate-spin" /> Analyzing...</span>
                    ) : (
                      <span className="flex items-center gap-2"><Sparkles className="w-5 h-5 fill-current" /> Analyze Run</span>
                    )}
                  </Button>
                </div>
              )}

              {mode === 'compare' && (
                <div className="space-y-6">
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-2xl flex gap-3">
                    <Info className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-orange-800 dark:text-orange-200">
                      Comparison highlights configuration drift and performance regressions between two specific runs.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Run A (Baseline)</label>
                      <input
                        value={compareInput.appIdA}
                        onChange={(e) => setCompareInput((prev) => ({ ...prev, appIdA: e.target.value }))}
                        placeholder="app-id-1"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm font-mono focus:border-orange-500 outline-none dark:text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Run B (Candidate)</label>
                      <input
                        value={compareInput.appIdB}
                        onChange={(e) => setCompareInput((prev) => ({ ...prev, appIdB: e.target.value }))}
                        placeholder="app-id-2"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm font-mono focus:border-orange-500 outline-none dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <span className="absolute left-1/2 -top-3 -translate-x-1/2 bg-white dark:bg-[#0f172a] px-2 text-xs text-slate-400">Or find from history</span>
                    <div className="border-t border-slate-200 dark:border-slate-800"></div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={compareInput.appName}
                      onChange={(e) => setCompareInput((prev) => ({ ...prev, appName: e.target.value }))}
                      placeholder="Filter by App Name"
                      className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm dark:text-white outline-none"
                    />
                  </div>

                  {compareRuns.length > 0 && (
                    <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 space-y-1 custom-scrollbar">
                      {compareRuns.map((run) => {
                        const selected = selectedCompareIds.includes(run.appId);
                        return (
                          <button
                            key={run.appId}
                            onClick={() => {
                              setSelectedCompareIds((prev) => {
                                if (prev.includes(run.appId)) return prev.filter((id) => id !== run.appId);
                                if (prev.length === 2) return [prev[1], run.appId];
                                return [...prev, run.appId];
                              });
                            }}
                            className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all group ${selected ? 'bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-500' : 'hover:bg-white dark:hover:bg-slate-800'
                              }`}
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 dark:text-white truncate">{run.appName}</div>
                              <div className="text-xs font-mono text-slate-500 truncate">{run.appId}</div>
                            </div>
                            {selected && <CheckCircle2 className="w-5 h-5 text-orange-500 flex-shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <Button
                    onClick={handleCompare}
                    disabled={isRunning || !compareInput.appIdA || !compareInput.appIdB}
                    className="w-full py-4 text-lg font-bold rounded-2xl"
                  >
                    {isRunning ? <Loader2 className="animate-spin" /> : 'Compare Runs'}
                  </Button>
                </div>
              )}
            </Card>

            {/* History Section - Redesigned */}
            <div className="pt-4">
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock3 className="w-5 h-5 text-slate-400" /> Recent Analyses
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search history..."
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full py-1.5 pl-9 pr-4 text-sm focus:border-orange-500 outline-none w-48 transition-all focus:w-64 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => openFromHistory(item.id)}
                    className="group flex flex-col items-start bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl hover:border-orange-500/50 hover:shadow-lg transition-all text-left"
                  >
                    <div className="flex w-full items-start justify-between mb-2">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${item.mode === 'compare' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                        {item.mode}
                      </span>
                      <span className="text-xs text-slate-400">{new Date(item.created_at || '').toLocaleDateString()}</span>
                    </div>
                    <h4 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-2 mb-1 group-hover:text-orange-500 transition-colors">
                      {item.title || item.app_name || 'Untitled Analysis'}
                    </h4>
                    <p className="text-xs font-mono text-slate-400 truncate w-full">
                      {item.app_id_a}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results / Progress Panel */}
          <div className="space-y-6">
            {result && result.status === 'complete' ? (
              <div className="space-y-6 animate-fade-in-up">

                {/* Narrative Card */}
                <Card className="p-0 overflow-hidden border-0 shadow-xl dark:shadow-none bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-900/50">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">
                        <Sparkles className="w-4 h-4" /> AI Insights
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={copyReport} leftIcon={<Clipboard className="w-4 h-4" />}>Copy</Button>
                        <Button size="sm" variant="ghost" onClick={saveAnalysis} leftIcon={<Tag className="w-4 h-4" />}>Save</Button>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 prose prose-slate dark:prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.narrative_md || ''}</ReactMarkdown>
                  </div>
                </Card>

                {/* Metrics Grid */}
                {result.mode === 'single' && summary && (
                  <div className="grid grid-cols-2 gap-4">
                    <MetricCard label="Duration" value={formatDuration(summary.durationMs)} subtext="Total Wall Time" />
                    <MetricCard label="Shuffle" value={formatBytes(summary.shuffleReadBytes)} subtext="Read Bytes" />
                    <MetricCard label="Spill" value={formatBytes(summary.spillBytes)} subtext="Memory + Disk" />
                    <MetricCard label="Tasks" value={formatCount(summary.executorCount)} subtext="Executors Used" />
                  </div>
                )}

                {/* Comparison Grid */}
                {result.mode === 'compare' && compareMetrics && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                        <div className="text-xs uppercase text-slate-500 mb-1">Baseline (A)</div>
                        <div className="font-bold text-slate-900 dark:text-white truncate">{compareMetrics.appA?.name}</div>
                        <div className="text-sm font-mono text-slate-600 dark:text-slate-400 mt-2">{formatDuration(compareMetrics.appA?.summary?.durationMs)}</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                        <div className="text-xs uppercase text-slate-500 mb-1">Candidate (B)</div>
                        <div className="font-bold text-slate-900 dark:text-white truncate">{compareMetrics.appB?.name}</div>
                        <div className="text-sm font-mono text-slate-600 dark:text-slate-400 mt-2">{formatDuration(compareMetrics.appB?.summary?.durationMs)}</div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400">Metric</th>
                            <th className="px-4 py-3 text-right font-semibold text-slate-500 dark:text-slate-400">Delta</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {Object.entries(compareMetrics.deltas || {}).map(([key, value]) => (
                            <tr key={key}>
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-300 capitalize">{key.replace(/([A-Z])/g, ' $1')}</td>
                              <td className={`px-4 py-3 text-right font-bold font-mono ${(value as number) > 0 ? 'text-red-500' : 'text-emerald-500'
                                }`}>
                                {formatDelta(value as number)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Bottlenecks / Heuristics */}
                {heuristics && (
                  <div className="space-y-3">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wide">
                      <AlertTriangle className="w-4 h-4 text-amber-500" /> Detected Anomalies
                    </h3>
                    <div className="grid gap-3">
                      {(heuristics.topSlowStages || []).slice(0, 3).map((stage: any) => (
                        <div key={stage.stageId} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
                          <div className="text-sm text-amber-900 dark:text-amber-100 font-medium">Stage {stage.stageId} (Slow)</div>
                          <div className="text-xs font-mono text-amber-700 dark:text-amber-300">{formatDuration(stage.durationMs)}</div>
                        </div>
                      ))}
                      {(heuristics.skewSuspicions || []).length > 0 && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-sm text-red-800 dark:text-red-200">
                          ⚠️ {heuristics.skewSuspicions.length} data skew incidents detected
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Card className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 text-center border-dashed border-2 border-slate-200 dark:border-slate-800 bg-transparent shadow-none">
                {isRunning ? (
                  <div className="max-w-xs w-full space-y-8">
                    <div className="relative w-24 h-24 mx-auto">
                      <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-800 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-orange-500 animate-pulse" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Analyzing Workload...</h3>
                      <div className="space-y-3">
                        {progressSteps.map((step) => (
                          <div key={step.label} className="flex items-center gap-3 text-sm">
                            <div className={`w-2.5 h-2.5 rounded-full ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-950 transition-all ${step.status === 'done' ? 'bg-emerald-500 ring-emerald-100 dark:ring-emerald-900' :
                                step.status === 'active' ? 'bg-orange-500 ring-orange-100 dark:ring-orange-900 animate-pulse' :
                                  'bg-slate-200 dark:bg-slate-800 ring-transparent'
                              }`} />
                            <span className={`transition-colors ${step.status === 'active' ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400'
                              }`}>
                              {step.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 max-w-sm">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
                      <BarChart3 className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Ready to Analyze</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                      Select a run from the list or search for a specific application ID to begin the AI-powered diagnosis.
                    </p>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoricalPage;

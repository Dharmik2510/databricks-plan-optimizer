import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Clipboard, Clock3, Loader2, Search, Sparkles, Split, Tag, CheckCircle2, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { historicalApi, HistoricalAnalysisResult, HistoricalRunItem } from '../../api/historical';
import { Button, Card } from '../../design-system/components';

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

const HistoricalPage: React.FC = () => {
  const [mode, setMode] = useState<'analyze' | 'compare'>('analyze');
  const [isRunning, setIsRunning] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HistoricalAnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoricalAnalysisResult[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyMode, setHistoryMode] = useState<'all' | 'single' | 'compare'>('all');

  const [analyzeInput, setAnalyzeInput] = useState({
    appId: '',
    appName: '',
    startTime: '',
    endTime: '',
    question: '',
  });

  const [compareInput, setCompareInput] = useState({
    appName: '',
    startTime: '',
    endTime: '',
    appIdA: '',
    appIdB: '',
    question: '',
  });

  const [runs, setRuns] = useState<HistoricalRunItem[]>([]);
  const [compareRuns, setCompareRuns] = useState<HistoricalRunItem[]>([]);
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);

  const summary = result?.evidence_json?.summary;
  const heuristics = result?.evidence_json?.heuristics;
  const application = result?.evidence_json?.application;
  const appA = result?.evidence_json?.appA;
  const appB = result?.evidence_json?.appB;
  const compareHeuristicsA = appA?.heuristics;
  const compareHeuristicsB = appB?.heuristics;

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

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await historicalApi.history({
          search: historySearch || undefined,
          mode: historyMode === 'all' ? undefined : historyMode,
        });
        setHistory(data || []);
      } catch {
        setHistory([]);
      }
    };

    loadHistory();
  }, [historySearch, historyMode]);

  useEffect(() => {
    const fetchRuns = async () => {
      if (!analyzeInput.appName || !analyzeInput.startTime || !analyzeInput.endTime) {
        setRuns([]);
        return;
      }
      try {
        const data = await historicalApi.runs({
          appName: analyzeInput.appName,
          start: analyzeInput.startTime,
          end: analyzeInput.endTime,
        });
        setRuns(data || []);
      } catch {
        setRuns([]);
      }
    };

    fetchRuns();
  }, [analyzeInput.appName, analyzeInput.startTime, analyzeInput.endTime]);

  useEffect(() => {
    const fetchRuns = async () => {
      if (!compareInput.appName || !compareInput.startTime || !compareInput.endTime) {
        setCompareRuns([]);
        return;
      }
      try {
        const data = await historicalApi.runs({
          appName: compareInput.appName,
          start: compareInput.startTime,
          end: compareInput.endTime,
        });
        setCompareRuns(data || []);
      } catch {
        setCompareRuns([]);
      }
    };

    fetchRuns();
  }, [compareInput.appName, compareInput.startTime, compareInput.endTime]);

  useEffect(() => {
    if (selectedCompareIds.length === 2) {
      setCompareInput((prev) => ({
        ...prev,
        appIdA: selectedCompareIds[0],
        appIdB: selectedCompareIds[1],
      }));
    }
  }, [selectedCompareIds]);

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
    } catch {
      // ignore
    }
  };

  const openFromHistory = async (id: string) => {
    try {
      const data = await historicalApi.get(id);
      setResult(data);
    } catch {
      // ignore
    }
  };

  const compareMetrics = result?.evidence_json?.comparison;

  const progressSteps = useMemo(() => {
    return PROGRESS_STEPS.map((step, index) => ({
      label: step,
      status: index < progressIndex ? 'done' : index === progressIndex ? 'active' : 'pending',
    }));
  }, [progressIndex]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-6 py-10 md:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 text-slate-900 dark:text-white">
            <div className="rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-3 shadow-lg shadow-orange-500/20">
              <Clock3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Historical Job Analysis</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">Analyze single Spark batch runs or compare exactly two runs with evidence-backed insights.</p>
            </div>
          </div>
          <div className="flex w-full max-w-md items-center gap-2 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <button
              onClick={() => setMode('analyze')}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-all ${mode === 'analyze' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'}`}
            >
              Analyze run
            </button>
            <button
              onClick={() => setMode('compare')}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-all ${mode === 'compare' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'}`}
            >
              Compare runs
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20">
            {error}
          </div>
        )}

        {mode === 'analyze' && (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="p-6 space-y-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Search className="h-4 w-4" /> Choose a run
              </div>
              <div className="grid gap-4">
                <label className="text-xs font-semibold uppercase text-slate-500">Spark appId</label>
                <input
                  value={analyzeInput.appId}
                  onChange={(e) => setAnalyzeInput((prev) => ({ ...prev, appId: e.target.value }))}
                  placeholder="spark-xxxxxxxx"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div className="border-t border-dashed border-slate-200 pt-4">
                <div className="mb-4 text-xs font-semibold uppercase text-slate-500">Search by app name + date range</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={analyzeInput.appName}
                    onChange={(e) => setAnalyzeInput((prev) => ({ ...prev, appName: e.target.value }))}
                    placeholder="App name"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="datetime-local"
                      value={analyzeInput.startTime}
                      onChange={(e) => setAnalyzeInput((prev) => ({ ...prev, startTime: e.target.value }))}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                    />
                    <input
                      type="datetime-local"
                      value={analyzeInput.endTime}
                      onChange={(e) => setAnalyzeInput((prev) => ({ ...prev, endTime: e.target.value }))}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                    />
                  </div>
                </div>
                {runs.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-xs font-semibold uppercase text-slate-500">Runs</div>
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50">
                      {runs.map((run) => (
                        <button
                          key={run.appId}
                          onClick={() => setAnalyzeInput((prev) => ({ ...prev, appId: run.appId }))}
                          className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-white"
                        >
                          <div>
                            <div className="font-semibold text-slate-900">{run.appName}</div>
                            <div className="text-xs text-slate-500">{run.appId}</div>
                          </div>
                          <div className="text-xs text-slate-500">{formatDuration(run.durationMs)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">Optional question</label>
                <textarea
                  value={analyzeInput.question}
                  onChange={(e) => setAnalyzeInput((prev) => ({ ...prev, question: e.target.value }))}
                  placeholder="Ask about bottlenecks, regressions, or tuning ideas…"
                  className="mt-2 h-24 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                />
              </div>
              <Button
                onClick={handleAnalyze}
                disabled={isRunning}
                leftIcon={isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                className="w-full"
              >
                Analyze
              </Button>
            </Card>
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Split className="h-4 w-4" /> Progress
              </div>
              <div className="space-y-3">
                {progressSteps.map((step) => (
                  <div key={step.label} className="flex items-center gap-3 text-sm">
                    <div className={`h-2 w-2 rounded-full ${step.status === 'done' ? 'bg-emerald-500' : step.status === 'active' ? 'bg-orange-500 animate-pulse' : 'bg-slate-300'}`} />
                    <span className={step.status === 'pending' ? 'text-slate-400' : 'text-slate-700'}>{step.label}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 text-xs text-slate-500">
                Historical analysis is available for completed batch jobs only.
              </div>
            </Card>
          </div>
        )}

        {mode === 'compare' && (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="p-6 space-y-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Search className="h-4 w-4" /> Select two runs
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={compareInput.appName}
                  onChange={(e) => setCompareInput((prev) => ({ ...prev, appName: e.target.value }))}
                  placeholder="App name"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    type="datetime-local"
                    value={compareInput.startTime}
                    onChange={(e) => setCompareInput((prev) => ({ ...prev, startTime: e.target.value }))}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                  />
                  <input
                    type="datetime-local"
                    value={compareInput.endTime}
                    onChange={(e) => setCompareInput((prev) => ({ ...prev, endTime: e.target.value }))}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>
              </div>
              {compareRuns.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase text-slate-500">Pick two runs</div>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50">
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
                          className={`flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left text-sm ${selected ? 'bg-white' : 'hover:bg-white'}`}
                        >
                          <div>
                            <div className="font-semibold text-slate-900">{run.appName}</div>
                            <div className="text-xs text-slate-500">{run.appId}</div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            {selected && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                            {formatDuration(run.durationMs)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="border-t border-dashed border-slate-200 pt-4">
                <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Or enter appIds directly</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={compareInput.appIdA}
                    onChange={(e) => setCompareInput((prev) => ({ ...prev, appIdA: e.target.value }))}
                    placeholder="Run A appId"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                  />
                  <input
                    value={compareInput.appIdB}
                    onChange={(e) => setCompareInput((prev) => ({ ...prev, appIdB: e.target.value }))}
                    placeholder="Run B appId"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">Optional question</label>
                <textarea
                  value={compareInput.question}
                  onChange={(e) => setCompareInput((prev) => ({ ...prev, question: e.target.value }))}
                  placeholder="Ask about regressions or configuration drift…"
                  className="mt-2 h-24 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                />
              </div>
              <Button
                onClick={handleCompare}
                disabled={isRunning || !compareInput.appIdA || !compareInput.appIdB}
                leftIcon={isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Split className="h-4 w-4" />}
                className="w-full"
              >
                Compare
              </Button>
            </Card>
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Split className="h-4 w-4" /> Progress
              </div>
              <div className="space-y-3">
                {progressSteps.map((step) => (
                  <div key={step.label} className="flex items-center gap-3 text-sm">
                    <div className={`h-2 w-2 rounded-full ${step.status === 'done' ? 'bg-emerald-500' : step.status === 'active' ? 'bg-orange-500 animate-pulse' : 'bg-slate-300'}`} />
                    <span className={step.status === 'pending' ? 'text-slate-400' : 'text-slate-700'}>{step.label}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 text-xs text-slate-500">
                Comparing exactly two completed batch runs.
              </div>
            </Card>
          </div>
        )}

        {result && result.status === 'complete' && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{result.app_name || 'Historical Report'}</h2>
                  <p className="text-sm text-slate-500">AppId(s): {result.app_id_a} {result.app_id_b ? `• ${result.app_id_b}` : ''}</p>
                  {result.mode === 'single' && (
                    <div className="mt-2 text-xs text-slate-500">
                      Time range: {formatDateTime(application?.startTime)} — {formatDateTime(application?.endTime)} • Duration: {formatDuration(summary?.durationMs)}
                    </div>
                  )}
                  {result.mode === 'compare' && (
                    <div className="mt-2 space-y-1 text-xs text-slate-500">
                      <div>Run A: {formatDateTime(appA?.startTime)} — {formatDateTime(appA?.endTime)} • {formatDuration(appA?.summary?.durationMs)}</div>
                      <div>Run B: {formatDateTime(appB?.startTime)} — {formatDateTime(appB?.endTime)} • {formatDuration(appB?.summary?.durationMs)}</div>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={saveAnalysis} leftIcon={<Tag className="h-4 w-4" />}>Save analysis</Button>
                  <Button variant="outline" onClick={copyReport} leftIcon={<Clipboard className="h-4 w-4" />}>Copy report</Button>
                  <Button variant="outline" onClick={() => history[0] && openFromHistory(history[0].id)} leftIcon={<ChevronDown className="h-4 w-4" />}>Open saved</Button>
                </div>
              </div>
            </Card>

            {result.mode === 'single' && summary && (
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="p-4">
                  <div className="text-xs uppercase text-slate-500">Duration</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{formatDuration(summary.durationMs)}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs uppercase text-slate-500">Shuffle Read / Write</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{formatBytes(summary.shuffleReadBytes)} / {formatBytes(summary.shuffleWriteBytes)}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs uppercase text-slate-500">Spill + GC</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{formatBytes(summary.spillBytes)} • {formatDuration(summary.gcTimeMs)}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs uppercase text-slate-500">Executors</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{formatCount(summary.executorCount)} total • {formatCount(summary.activeExecutors)} active</div>
                </Card>
              </div>
            )}

            {result.mode === 'compare' && compareMetrics && (
              <Card className="p-6">
                <h3 className="text-lg font-bold text-slate-900">Comparison</h3>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase text-slate-500">Run A</div>
                    <div className="text-sm font-semibold text-slate-900">{compareMetrics.appA?.name}</div>
                    <div className="mt-2 text-sm text-slate-600">Duration: {formatDuration(compareMetrics.appA?.summary?.durationMs)}</div>
                    <div className="text-sm text-slate-600">Shuffle: {formatBytes(compareMetrics.appA?.summary?.shuffleReadBytes)} / {formatBytes(compareMetrics.appA?.summary?.shuffleWriteBytes)}</div>
                    <div className="text-sm text-slate-600">Executors: {formatCount(compareMetrics.appA?.summary?.executorCount)} total • {formatCount(compareMetrics.appA?.summary?.activeExecutors)} active</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase text-slate-500">Run B</div>
                    <div className="text-sm font-semibold text-slate-900">{compareMetrics.appB?.name}</div>
                    <div className="mt-2 text-sm text-slate-600">Duration: {formatDuration(compareMetrics.appB?.summary?.durationMs)}</div>
                    <div className="text-sm text-slate-600">Shuffle: {formatBytes(compareMetrics.appB?.summary?.shuffleReadBytes)} / {formatBytes(compareMetrics.appB?.summary?.shuffleWriteBytes)}</div>
                    <div className="text-sm text-slate-600">Executors: {formatCount(compareMetrics.appB?.summary?.executorCount)} total • {formatCount(compareMetrics.appB?.summary?.activeExecutors)} active</div>
                  </div>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 text-slate-500">
                      <tr>
                        <th className="px-4 py-2 text-left">Metric</th>
                        <th className="px-4 py-2 text-left">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(compareMetrics.deltas || {}).map(([key, value]) => (
                        <tr key={key} className="border-t border-slate-100">
                          <td className="px-4 py-2 capitalize text-slate-700">{key.replace(/([A-Z])/g, ' $1')}</td>
                          <td className={`px-4 py-2 font-semibold ${value > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatDelta(value as number)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {heuristics && result.mode === 'single' && (
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="p-4">
                  <div className="text-xs uppercase text-slate-500">Top slow stages</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    {(heuristics.topSlowStages || []).map((stage: any) => (
                      <div key={stage.stageId} className="flex items-center justify-between">
                        <span>Stage {stage.stageId}</span>
                        <span className="font-semibold">{formatDuration(stage.durationMs)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs uppercase text-slate-500">Shuffle heavy</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    {(heuristics.shuffleHeavyStages || []).map((stage: any) => (
                      <div key={stage.stageId} className="flex items-center justify-between">
                        <span>Stage {stage.stageId}</span>
                        <span className="font-semibold">{formatBytes(stage.shuffleReadBytes + stage.shuffleWriteBytes)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs uppercase text-slate-500">Spill + GC</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    {(heuristics.spillAnomalies || []).map((stage: any) => (
                      <div key={stage.stageId} className="flex items-center justify-between">
                        <span>Stage {stage.stageId}</span>
                        <span className="font-semibold">{formatBytes(stage.memorySpilledBytes + stage.diskSpilledBytes)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {result.mode === 'compare' && (compareHeuristicsA || compareHeuristicsB) && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-4">
                  <div className="text-xs uppercase text-slate-500">Run A bottlenecks</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    {(compareHeuristicsA?.topSlowStages || []).map((stage: any) => (
                      <div key={stage.stageId} className="flex items-center justify-between">
                        <span>Stage {stage.stageId}</span>
                        <span className="font-semibold">{formatDuration(stage.durationMs)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    Failed tasks: {compareHeuristicsA?.failedTasks?.failedTasks ?? '—'} • Skew suspicions: {(compareHeuristicsA?.skewSuspicions || []).length}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs uppercase text-slate-500">Run B bottlenecks</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    {(compareHeuristicsB?.topSlowStages || []).map((stage: any) => (
                      <div key={stage.stageId} className="flex items-center justify-between">
                        <span>Stage {stage.stageId}</span>
                        <span className="font-semibold">{formatDuration(stage.durationMs)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    Failed tasks: {compareHeuristicsB?.failedTasks?.failedTasks ?? '—'} • Skew suspicions: {(compareHeuristicsB?.skewSuspicions || []).length}
                  </div>
                </Card>
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <Card className="p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Sparkles className="h-4 w-4" /> Agent Findings
                </div>
                <div className="prose prose-slate mt-4 max-w-none text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.narrative_md || ''}</ReactMarkdown>
                </div>
              </Card>
              {result.mode === 'single' && (
                <Card className="p-6">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <AlertTriangle className="h-4 w-4" /> Bottlenecks
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <div>Failed tasks: {heuristics?.failedTasks?.failedTasks ?? '—'}</div>
                    <div>Failed stages: {heuristics?.failedTasks?.failedStages ?? '—'}</div>
                    <div>Skew suspicions: {(heuristics?.skewSuspicions || []).length}</div>
                  </div>
                </Card>
              )}
            </div>

            <Card className="p-6">
              <details className="group">
                <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-slate-700">
                  Evidence (JSON)
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
                  {JSON.stringify(result.evidence_json, null, 2)}
                </pre>
              </details>
            </Card>
          </div>
        )}

        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">History</h3>
              <p className="text-xs text-slate-500">Your saved historical analyses</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={historyMode}
                onChange={(e) => setHistoryMode(e.target.value as 'all' | 'single' | 'compare')}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600"
              >
                <option value="all">All</option>
                <option value="single">Analyze</option>
                <option value="compare">Compare</option>
              </select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search by appId, appName…"
                  className="rounded-full border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm font-medium text-slate-700"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => openFromHistory(item.id)}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-orange-300"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">{item.title || item.app_name || 'Historical analysis'}</div>
                  <span className="text-xs uppercase text-slate-400">{item.mode}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{item.app_id_a}{item.app_id_b ? ` • ${item.app_id_b}` : ''}</div>
                <div className="mt-2 text-xs text-slate-400">{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</div>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default HistoricalPage;

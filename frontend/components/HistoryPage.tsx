import React, { useEffect, useState, useCallback } from 'react';
import { List } from 'react-window';
import { Search, Calendar, Trash2, ChevronLeft, ChevronRight, Activity, Edit2 } from 'lucide-react';
import { client } from '../api';

const HistoryRow = ({ index, style, history, editingId, editTitle, setEditTitle, handleSaveRename, setEditingId, handleView, handleDelete, handleStartRename }: any) => {
    const item = history[index];
    if (!item) return null;

    return (
        <div
            style={style}
            className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center"
        >
            <div className="px-8 py-5 w-[40%]">
                {editingId === item.id ? (
                    <div className="flex items-center gap-2">
                        <input
                            autoFocus
                            className="bg-white dark:bg-slate-900 border border-blue-500 rounded px-2 py-1 text-sm w-full outline-none"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <button onClick={(e) => { e.stopPropagation(); handleSaveRename(); }} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Save</button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">Cancel</button>
                    </div>
                ) : (
                    <div className="cursor-pointer" onClick={() => handleView(item.id)}>
                        <div className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {item.title || 'Untitled Analysis'}
                        </div>
                    </div>
                )}
            </div>
            <div className="px-6 py-5 w-[12%]">
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700">
                    {item.inputType === 'SPARK_PLAN' ? 'Plan' : 'Paste'}
                </span>
            </div>
            <div className="px-6 py-5 w-[15%] text-sm font-medium text-slate-600 dark:text-slate-400">
                {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            <div className="px-6 py-5 w-[10%] font-mono text-sm text-slate-500">
                {item.processingMs ? `${item.processingMs}ms` : '-'}
            </div>
            <div className="px-6 py-5 w-[10%]">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${item.severity === 'CRITICAL' ? 'bg-red-100 text-red-700 dark:bg-red-900/30' :
                    item.severity === 'HIGH' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30' :
                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30'
                    }`}>
                    {item.severity || 'None'}
                </span>
            </div>
            <div className="px-8 py-5 w-[13%]">
                <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); handleStartRename(item); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all" title="Rename">
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all" title="Delete">
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleView(item.id); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all" title="View Details">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

interface HistoryPageProps {
    onSelectAnalysis: (id: string, result: any) => void;
    onNewAnalysis: () => void;
}

const HistoryPage: React.FC<HistoryPageProps> = ({ onSelectAnalysis, onNewAnalysis }) => {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Filters
    const [statusFilter, setStatusFilter] = useState('');
    const [severityFilter, setSeverityFilter] = useState('');
    const [dateFilter, setDateFilter] = useState<{ start: string; end: string } | null>(null);

    // Rename State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');

    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            const response = await client.getAnalysisHistory({
                page,
                limit: 10,
                search: debouncedSearch,
                status: statusFilter || undefined,
                severity: severityFilter || undefined,
                startDate: dateFilter?.start,
                endDate: dateFilter?.end
            });
            setHistory(response.data);
            setTotal(response.pagination.total);
        } catch (error: any) {
            console.error("Failed to fetch history", error);
            setErrorMessage(error.message || "Failed to load history");
        } finally {
            setLoading(false);
        }
    }, [page, debouncedSearch, statusFilter, severityFilter, dateFilter]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const handleStartRename = (item: any) => {
        setEditingId(item.id);
        setEditTitle(item.title);
    };

    const handleSaveRename = async () => {
        if (!editingId || !editTitle.trim()) return;
        try {
            await client.updateAnalysis(editingId, { title: editTitle });
            setHistory(prev => prev.map(item => item.id === editingId ? { ...item, title: editTitle } : item));
            setEditingId(null);
        } catch (e) {
            console.error("Failed to rename", e);
            alert("Failed to rename analysis");
        }
    };

    const handleView = async (id: string) => {
        try {
            const fullAnalysis = await client.get(`/analyses/${id}`);
            if (fullAnalysis && fullAnalysis.result) {
                onSelectAnalysis(id, fullAnalysis.result);
            } else {
                console.error("Analysis result is empty");
            }
        } catch (e) {
            console.error("Failed to load analysis details", e);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this analysis?")) return;
        try {
            await client.delete(`/analyses/${id}`);
            fetchHistory(); // Refresh
        } catch (e) {
            console.error("Failed to delete", e);
        }
    };

    const totalPages = Math.ceil(total / 10);

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-6 md:p-12 animate-fade-in">
            <div className="max-w-7xl mx-auto w-full space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 font-sans">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Analysis History</h1>
                        <p className="text-slate-600 dark:text-slate-400 mt-1 font-medium">View, filter, and manage your past DAG analyses</p>
                    </div>
                    <button
                        onClick={onNewAnalysis}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2"
                    >
                        <Activity className="w-5 h-5" /> New Analysis
                    </button>
                </div>

                {/* Filters Bar */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-4">

                    {/* Search */}
                    <div className="flex-1 min-w-[250px] relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search analyses..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium"
                        />
                    </div>

                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden md:block"></div>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-none outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/20 appearance-none"
                    >
                        <option value="">All Status</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="FAILED">Failed</option>
                        <option value="PROCESSING">Processing</option>
                    </select>

                    {/* Severity Filter */}
                    <select
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value)}
                        className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-none outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/20 appearance-none"
                    >
                        <option value="">All Severities</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                    </select>

                    {/* Date Range Filter */}
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl p-2 border border-transparent focus-within:border-blue-500/30 transition-all">
                        <div className="flex items-center gap-2 px-2 text-slate-500">
                            <Calendar className="w-4 h-4" />
                        </div>
                        <input
                            type="date"
                            className="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-0 p-1 w-28"
                            value={dateFilter?.start || ''}
                            onChange={(e) => setDateFilter(prev => ({ start: e.target.value, end: prev?.end || '' }))}
                            placeholder="Start"
                        />
                        <span className="text-slate-300 ml-1">-</span>
                        <input
                            type="date"
                            className="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-0 p-1 w-28"
                            value={dateFilter?.end || ''}
                            onChange={(e) => setDateFilter(prev => ({ start: prev?.start || '', end: e.target.value }))}
                            placeholder="End"
                        />
                        {(dateFilter?.start || dateFilter?.end) && (
                            <button
                                onClick={() => setDateFilter(null)}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400"
                            >
                                <span className="sr-only">Clear</span>
                                <Trash2 className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                </div>

                {/* Content */}
                {errorMessage && (
                    <div className="p-4 bg-red-100 text-red-800 rounded-xl">{errorMessage}</div>
                )}

                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col min-h-[500px]">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center text-slate-500">Loading history...</div>
                    ) : history.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-20">
                            <Activity className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" />
                            <p className="text-lg font-bold">No analyses found</p>
                            <p className="text-sm">Try adjusting your filters or create a new analysis.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col flex-1">
                            {/* Table Header */}
                            <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                <div className="flex text-xs uppercase font-bold text-slate-500 dark:text-slate-400">
                                    <div className="px-8 py-5 w-[40%]">Analysis Name</div>
                                    <div className="px-6 py-5 w-[12%]">Source</div>
                                    <div className="px-6 py-5 w-[15%]">Date</div>
                                    <div className="px-6 py-5 w-[10%]">Duration</div>
                                    <div className="px-6 py-5 w-[10%]">Severity</div>
                                    <div className="px-8 py-5 w-[13%] text-right">Actions</div>
                                </div>
                            </div>

                            {/* Virtualized List - Refactored for v2 API */}
                            <List
                                height={500}
                                rowCount={history.length}
                                rowHeight={80}
                                width="100%"
                                className="divide-y divide-slate-100 dark:divide-slate-800"
                                rowComponent={HistoryRow}
                                rowProps={{
                                    history,
                                    editingId,
                                    editTitle,
                                    setEditTitle,
                                    handleSaveRename,
                                    setEditingId,
                                    handleView,
                                    handleDelete,
                                    handleStartRename
                                }}
                            />
                        </div>
                    )}

                    {/* Pagination */}
                    <div className="border-t border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">
                            Page {page} of {totalPages || 1}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HistoryPage;

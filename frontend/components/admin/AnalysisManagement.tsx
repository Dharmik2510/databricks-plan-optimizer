import React, { useState, useEffect } from 'react';
import { Card, Badge, Button } from '../../design-system/components';
import * as adminAPI from '../../api/admin';
import { Activity, AlertTriangle, CheckCircle, Clock, RefreshCw, Search, FileText, User } from 'lucide-react';

interface Analysis {
  id: string;
  title: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
  processingMs?: number;
  errorMessage?: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

const AnalysisManagement: React.FC = () => {
  const [recentAnalyses, setRecentAnalyses] = useState<Analysis[]>([]);
  const [failedAnalyses, setFailedAnalyses] = useState<Analysis[]>([]);
  const [activeTab, setActiveTab] = useState<'recent' | 'failed'>('recent');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalyses();
  }, []);

  const loadAnalyses = async () => {
    try {
      setLoading(true);
      const [recent, failed] = await Promise.all([
        adminAPI.getRecentAnalyses(50),
        adminAPI.getFailedAnalyses(50),
      ]);
      setRecentAnalyses(recent as any[]);
      setFailedAnalyses(failed as any[]);
    } catch (error) {
      console.error('Failed to load analyses:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      COMPLETED: 'success',
      FAILED: 'error',
      PROCESSING: 'warning',
      PENDING: 'info',
    };
    return variants[status as keyof typeof variants] || 'default';
  };

  const renderAnalysisTable = (analyses: Analysis[], showError: boolean = false) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Title
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              User
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Status
            </th>
            {!showError && (
              <>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Processing Time
                </th>
              </>
            )}
            {showError && (
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Error Message
              </th>
            )}
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <tr>
              <td colSpan={showError ? 5 : 6} className="px-6 py-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              </td>
            </tr>
          ) : analyses.length === 0 ? (
            <tr>
              <td colSpan={showError ? 5 : 6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                No analyses found
              </td>
            </tr>
          ) : (
            analyses.map((analysis) => (
              <tr key={analysis.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white max-w-xs truncate flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    {analysis.title || 'Untitled Analysis'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono pl-6">
                    {analysis.id.slice(0, 8)}...
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {analysis.user.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 pl-5.5">{analysis.user.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant={getStatusBadge(analysis.status) as any}>
                    {analysis.status}
                  </Badge>
                </td>
                {!showError && (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {analysis.severity ? (
                        <Badge variant={
                          analysis.severity === 'CRITICAL' ? 'error' :
                            analysis.severity === 'HIGH' ? 'warning' :
                              analysis.severity === 'MEDIUM' ? 'info' : 'default'
                        }>
                          {analysis.severity}
                        </Badge>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white">
                      {analysis.processingMs
                        ? <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-slate-400" /> {(analysis.processingMs / 1000).toFixed(2)}s</span>
                        : '—'}
                    </td>
                  </>
                )}
                {showError && (
                  <td className="px-6 py-4">
                    <div className="text-sm text-red-600 dark:text-red-400 max-w-md truncate bg-red-50 dark:bg-red-900/10 px-2 py-1 rounded">
                      {analysis.errorMessage || 'Unknown error'}
                    </div>
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                  {new Date(analysis.createdAt).toLocaleString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Analysis Management</h1>
          <p className="text-slate-600 dark:text-slate-400">Monitor platform analyses, track performance, and troubleshoot issues</p>
        </div>
        <Button variant="outline" onClick={loadAnalyses} leftIcon={<RefreshCw className="w-4 h-4" />}>
          Refresh Data
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100 dark:bg-emerald-900/20 rounded-full -mr-10 -mt-10 blur-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Recent Analyses</p>
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{recentAnalyses.length}</h3>
              <div className="mt-4 flex items-center text-sm gap-2">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle className="w-4 h-4" />
                  {recentAnalyses.filter((a) => a.status === 'COMPLETED').length} completed
                </span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="text-slate-500 dark:text-slate-400">Last 50 records</span>
              </div>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
              <Activity className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 dark:bg-red-900/20 rounded-full -mr-10 -mt-10 blur-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Failed Analyses</p>
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{failedAnalyses.length}</h3>
              <div className="mt-4 flex items-center text-sm gap-2">
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  Requires attention
                </span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="text-slate-500 dark:text-slate-400">All failed records</span>
              </div>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-800 px-6 pt-2">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('recent')}
              className={`pb-4 pt-4 text-sm font-semibold relative transition-colors ${activeTab === 'recent'
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
            >
              Recent Analyses
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs transition-colors ${activeTab === 'recent'
                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                {recentAnalyses.length}
              </span>
              {activeTab === 'recent' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('failed')}
              className={`pb-4 pt-4 text-sm font-semibold relative transition-colors ${activeTab === 'failed'
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
            >
              Failed Analyses
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs transition-colors ${activeTab === 'failed'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                {failedAnalyses.length}
              </span>
              {activeTab === 'failed' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
              )}
            </button>
          </div>
        </div>

        <div className="p-0">
          {activeTab === 'recent' && renderAnalysisTable(recentAnalyses, false)}
          {activeTab === 'failed' && renderAnalysisTable(failedAnalyses, true)}
        </div>
      </div>
    </div>
  );
};

export default AnalysisManagement;

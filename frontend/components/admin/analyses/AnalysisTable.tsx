import React from 'react';
import { FileText, User, Clock } from 'lucide-react';
import { Badge } from '../../../design-system/components';
import { StatusBadge } from '../shared/StatusBadge';

export interface Analysis {
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

interface AnalysisTableProps {
    analyses: Analysis[];
    showError?: boolean;
    loading: boolean;
}

export const AnalysisTable: React.FC<AnalysisTableProps> = ({ analyses, showError = false, loading }) => {
    return (
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
                                    <StatusBadge status={analysis.status} />
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
};

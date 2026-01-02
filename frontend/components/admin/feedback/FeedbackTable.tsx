import React from 'react';
import { MessageSquare, AlertCircle, CheckCircle, Clock, Link as LinkIcon } from 'lucide-react';
import { Badge, Button } from '../../../design-system/components';
import { StatusBadge } from '../shared/StatusBadge';
import { FeedbackTicket } from '../../../api/feedback';

interface FeedbackTableProps {
    tickets: FeedbackTicket[];
    loading: boolean;
    onViewTicket: (ticket: FeedbackTicket) => void;
    onUpdateStatus: (ticketId: string, status: string) => void;
}

export const FeedbackTable: React.FC<FeedbackTableProps> = ({
    tickets,
    loading,
    onViewTicket,
    onUpdateStatus
}) => {
    const getSeverityBadgeVariant = (severity: string): 'error' | 'warning' | 'info' | 'default' => {
        switch (severity.toLowerCase()) {
            case 'critical': return 'error';
            case 'high': return 'warning';
            case 'medium': return 'info';
            case 'low': return 'default';
            default: return 'default';
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ticket</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Severity</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Feature</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                                </td>
                            </tr>
                        ) : tickets.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                    No feedback tickets found
                                </td>
                            </tr>
                        ) : (
                            tickets.map((ticket) => (
                                <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
                                                <MessageSquare className="w-4 h-4 text-slate-500" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">{ticket.title}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">#{ticket.ticketId}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Badge variant="default" className="capitalize">
                                            {ticket.category}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <StatusBadge status={ticket.status} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Badge variant={getSeverityBadgeVariant(ticket.severity)} className="capitalize">
                                            {ticket.severity}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400 font-medium">
                                        {ticket.feature || 'Global'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                        {new Date(ticket.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => onViewTicket(ticket)}
                                                rightIcon={<LinkIcon className="w-3 h-3" />}
                                            >
                                                Details
                                            </Button>
                                            {ticket.status !== 'resolved' && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                                    onClick={() => onUpdateStatus(ticket.id, 'resolved')}
                                                    title="Mark as Resolved"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

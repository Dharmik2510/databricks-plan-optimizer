// frontend/components/feedback/MyTicketsPage.tsx
// User's ticket list page with filtering and premium design

import React, { useState, useEffect } from 'react';
import {
    Ticket,
    Search,
    Filter,
    Clock,
    CheckCircle2,
    AlertCircle,
    Loader2,
    ChevronRight,
    RefreshCw,
    MessageSquare,
    Paperclip,
    Bug,
    Lightbulb,
    HelpCircle,
    MoreHorizontal,
    Trash2,
} from 'lucide-react';
import { feedbackApi, FeedbackTicket, FeedbackListResponse } from '../../api/feedback';
import { useFeedbackStore } from '../../store/useFeedbackStore';

interface Props {
    onSelectTicket: (ticketId: string) => void;
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    new: { icon: <Clock className="w-4 h-4" />, color: 'text-blue-500 bg-blue-500/10', label: 'New' },
    in_progress: { icon: <Loader2 className="w-4 h-4" />, color: 'text-yellow-500 bg-yellow-500/10', label: 'In Progress' },
    waiting_for_user: { icon: <AlertCircle className="w-4 h-4" />, color: 'text-orange-500 bg-orange-500/10', label: 'Awaiting Response' },
    resolved: { icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-green-500 bg-green-500/10', label: 'Resolved' },
    closed: { icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-slate-500 bg-slate-500/10', label: 'Closed' },
};

const categoryIcons: Record<string, React.ReactNode> = {
    bug: <Bug className="w-4 h-4" />,
    feature: <Lightbulb className="w-4 h-4" />,
    question: <HelpCircle className="w-4 h-4" />,
    other: <MoreHorizontal className="w-4 h-4" />,
};

const severityColors: Record<string, string> = {
    low: 'text-blue-500',
    medium: 'text-yellow-500',
    high: 'text-orange-500',
    critical: 'text-red-500',
};

export const MyTicketsPage: React.FC<Props> = ({ onSelectTicket }) => {
    const [response, setResponse] = useState<FeedbackListResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [page, setPage] = useState(1);
    const openModal = useFeedbackStore((state) => state.openModal);

    const fetchTickets = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await feedbackApi.getMyTickets({
                status: statusFilter || undefined,
                page,
                limit: 10,
            });
            setResponse(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load tickets');
        } finally {
            setIsLoading(false);
        }
    };

    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDeleteTicket = async (e: React.MouseEvent, ticketId: string) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
            return;
        }

        setDeletingId(ticketId);
        try {
            await feedbackApi.deleteFeedback(ticketId);
            // Remove locally or refresh
            if (response) {
                setResponse({
                    ...response,
                    tickets: response.tickets.filter(t => t.ticketId !== ticketId)
                });
            }
        } catch (err) {
            console.error('Failed to delete ticket:', err);
            alert('Failed to delete ticket. Please try again.');
        } finally {
            setDeletingId(null);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, [statusFilter, page]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            if (diffHours === 0) {
                const diffMins = Math.floor(diffMs / (1000 * 60));
                return `${diffMins}m ago`;
            }
            return `${diffHours}h ago`;
        }
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="h-full overflow-auto">
            <div className="max-w-4xl mx-auto py-8 px-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-orange-500 to-purple-600 rounded-xl">
                                <Ticket className="w-6 h-6 text-white" />
                            </div>
                            My Tickets
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                            Track and manage your feedback submissions
                        </p>
                    </div>
                    <button
                        onClick={() => openModal()}
                        className="relative group overflow-hidden rounded-xl p-[1px] focus:outline-none focus:ring-2 focus:ring-orange-500/40 shadow-lg shadow-orange-500/20"
                    >
                        <span className="absolute inset-0 bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 opacity-100 dark:opacity-80 dark:group-hover:opacity-100 transition-opacity duration-300"></span>
                        <span className="relative flex items-center justify-center gap-2 w-full bg-transparent dark:bg-slate-900 dark:group-hover:bg-slate-800/50 px-4 py-2.5 rounded-[11px] transition-colors duration-300">
                            <MessageSquare className="w-4 h-4 text-white dark:text-orange-400 transition-colors duration-300" />
                            <span className="text-sm font-bold text-white dark:bg-gradient-to-r dark:from-white dark:to-slate-200 dark:bg-clip-text dark:text-transparent">
                                New Ticket
                            </span>
                        </span>
                    </button>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setPage(1);
                            }}
                            className="flex-1 bg-transparent text-slate-900 dark:text-white text-sm focus:outline-none"
                        >
                            <option value="">All Statuses</option>
                            <option value="new">New</option>
                            <option value="in_progress">In Progress</option>
                            <option value="waiting_for_user">Awaiting Response</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>
                    <button
                        onClick={fetchTickets}
                        className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 text-slate-600 dark:text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Loading State */}
                {isLoading && !response && (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                            <AlertCircle className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                            Failed to load tickets
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-4">{error}</p>
                        <button
                            onClick={fetchTickets}
                            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Empty State */}
                {response && response.tickets.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <Ticket className="w-10 h-10 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                            No tickets yet
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
                            Have feedback or need help? Submit a ticket and we'll get back to you.
                        </p>
                        <button
                            onClick={() => openModal()}
                            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-purple-600 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-purple-700 transition-all"
                        >
                            Submit Your First Ticket
                        </button>
                    </div>
                )}

                {/* Ticket List */}
                {response && response.tickets.length > 0 && (
                    <div className="space-y-3">
                        {response.tickets.map((ticket) => (
                            <button
                                key={ticket.id}
                                onClick={() => onSelectTicket(ticket.ticketId)}
                                className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/5 transition-all text-left group"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-mono text-slate-400">
                                                #{ticket.ticketId.slice(0, 8)}
                                            </span>
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusConfig[ticket.status]?.color || statusConfig.new.color}`}>
                                                {statusConfig[ticket.status]?.icon || statusConfig.new.icon}
                                                {statusConfig[ticket.status]?.label || ticket.status}
                                            </span>
                                        </div>
                                        <h3 className="font-semibold text-slate-900 dark:text-white truncate mb-1">
                                            {ticket.title}
                                        </h3>
                                        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                                            <span className="flex items-center gap-1">
                                                {categoryIcons[ticket.category] || categoryIcons.other}
                                                <span className="capitalize">{ticket.category}</span>
                                            </span>
                                            <span className={`capitalize ${severityColors[ticket.severity] || 'text-slate-500'}`}>
                                                {ticket.severity}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5" />
                                                {formatDate(ticket.createdAt)}
                                            </span>
                                            {ticket._count && (
                                                <>
                                                    <span className="flex items-center gap-1">
                                                        <MessageSquare className="w-3.5 h-3.5" />
                                                        {ticket._count.events}
                                                    </span>
                                                    {ticket._count.attachments > 0 && (
                                                        <span className="flex items-center gap-1">
                                                            <Paperclip className="w-3.5 h-3.5" />
                                                            {ticket._count.attachments}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => handleDeleteTicket(e, ticket.ticketId)}
                                            disabled={deletingId === ticket.ticketId}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Delete Ticket"
                                        >
                                            {deletingId === ticket.ticketId ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-5 h-5" />
                                            )}
                                        </button>
                                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-orange-500 transition-colors flex-shrink-0" />
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {response && response.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                            Page {page} of {response.pagination.totalPages}
                        </span>
                        <button
                            onClick={() => setPage((p) => Math.min(response.pagination.totalPages, p + 1))}
                            disabled={page === response.pagination.totalPages}
                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

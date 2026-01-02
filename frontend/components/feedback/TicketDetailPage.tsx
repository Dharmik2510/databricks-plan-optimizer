// frontend/components/feedback/TicketDetailPage.tsx
// Ticket detail view with conversation timeline and reply form

import React, { useState, useEffect, useRef } from 'react';
import {
    ArrowLeft,
    Clock,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Send,
    Paperclip,
    User,
    Shield,
    Bug,
    Lightbulb,
    HelpCircle,
    MoreHorizontal,
    ExternalLink,
    Image as ImageIcon,
} from 'lucide-react';
import { feedbackApi, FeedbackDetail, FeedbackEvent } from '../../api/feedback';

interface Props {
    ticketId: string;
    onBack: () => void;
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string; bgColor: string }> = {
    new: { icon: <Clock className="w-3 h-3" />, color: 'text-blue-400', label: 'New', bgColor: 'bg-blue-500/10 border-blue-500/20' },
    in_progress: { icon: <Loader2 className="w-3 h-3" />, color: 'text-yellow-400', label: 'In Progress', bgColor: 'bg-yellow-500/10 border-yellow-500/20' },
    waiting_for_user: { icon: <AlertCircle className="w-3 h-3" />, color: 'text-orange-400', label: 'Awaiting Response', bgColor: 'bg-orange-500/10 border-orange-500/20' },
    resolved: { icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-green-400', label: 'Resolved', bgColor: 'bg-green-500/10 border-green-500/20' },
    closed: { icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-slate-400', label: 'Closed', bgColor: 'bg-slate-500/10 border-slate-500/20' },
};

const categoryIcons: Record<string, React.ReactNode> = {
    bug: <Bug className="w-5 h-5" />,
    feature: <Lightbulb className="w-5 h-5" />,
    question: <HelpCircle className="w-5 h-5" />,
    other: <MoreHorizontal className="w-5 h-5" />,
};

const severityColors: Record<string, { text: string; bg: string }> = {
    low: { text: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    medium: { text: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
    high: { text: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
    critical: { text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
};

export const TicketDetailPage: React.FC<Props> = ({ ticketId, onBack }) => {
    const [ticket, setTicket] = useState<FeedbackDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchTicket = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await feedbackApi.getTicketDetail(ticketId);
            setTicket(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load ticket');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTicket();
    }, [ticketId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [ticket?.events.length]);

    const handleSubmitReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyContent.trim() || isSubmitting) return;

        setIsSubmitting(true);
        setSubmitError(null);

        try {
            const newEvent = await feedbackApi.addReply(ticketId, replyContent.trim());
            setTicket((prev) =>
                prev ? { ...prev, events: [...prev.events, newEvent] } : prev
            );
            setReplyContent('');
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Failed to send reply');
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString([], {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const getEventMessage = (event: FeedbackEvent, ticket: FeedbackDetail): string => {
        switch (event.eventType) {
            case 'created': return 'Ticket created';
            case 'status_changed': return `Status changed to ${(event as any).metadata?.newStatus || 'unknown'}`;
            case 'assigned': return `Assigned to ${(event as any).metadata?.assigneeName || 'support team'}`;
            default: return event.content || `Action: ${event.eventType}`;
        }
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-950">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
        );
    }

    if (error || !ticket) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-950">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Failed to load ticket</h3>
                <p className="text-slate-400 mb-6">{error}</p>
                <div className="flex gap-3">
                    <button onClick={onBack} className="px-5 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors font-medium">Go Back</button>
                    <button onClick={fetchTicket} className="px-5 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors font-medium">Try Again</button>
                </div>
            </div>
        );
    }

    const status = statusConfig[ticket.status] || statusConfig.new;
    const severityStyle = severityColors[ticket.severity] || severityColors.medium;

    return (
        <div className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 relative font-sans transition-colors duration-300">
            {/* Ambient Background Effects */}
            <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-white to-transparent dark:from-slate-900 dark:to-transparent pointer-events-none" />
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex-shrink-0 px-8 py-6 z-10 relative">
                <div className="max-w-5xl mx-auto">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors mb-6 group w-fit"
                    >
                        <div className="p-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 group-hover:border-orange-500/50 transition-colors">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                        </div>
                        <span className="text-xs font-bold tracking-widest uppercase">Back to tickets</span>
                    </button>

                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm text-orange-500 dark:text-orange-400">
                                    {categoryIcons[ticket.category] || categoryIcons.other}
                                </div>
                                <span className="text-sm font-mono text-slate-500 tracking-wider">#{ticket.ticketId.slice(0, 8)}</span>
                                <div className="h-1 w-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
                                <span className="text-sm text-slate-500 font-medium">
                                    {formatDate(ticket.createdAt)}
                                </span>
                            </div>

                            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-4 leading-tight tracking-tight">
                                {ticket.title}
                            </h1>

                            <div className="flex items-center gap-3 flex-wrap">
                                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${status.bgColor} ${status.color}`}>
                                    {status.icon}
                                    {status.label}
                                </span>
                                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${severityStyle.bg} ${severityStyle.text}`}>
                                    {ticket.severity} Priority
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto z-10 custom-scrollbar">
                <div className="max-w-5xl mx-auto py-2 px-8 pb-32">
                    {/* Main Grid: Description + Attachments */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                        {/* Description */}
                        <div className="lg:col-span-2">
                            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 md:p-8 shadow-sm h-full">
                                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                                    Details
                                </h3>
                                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed text-base md:text-lg">
                                    {ticket.description}
                                </p>
                            </div>
                        </div>

                        {/* Attachments */}
                        <div className="lg:col-span-1">
                            {ticket.attachments.length > 0 ? (
                                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 shadow-sm h-full">
                                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Paperclip className="w-4 h-4" />
                                        Attachments ({ticket.attachments.length})
                                    </h3>
                                    <div className="space-y-3">
                                        {ticket.attachments.map((attachment) => (
                                            <a
                                                key={attachment.id}
                                                href={attachment.viewUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-orange-500/40 hover:shadow-lg transition-all group relative overflow-hidden"
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg group-hover:bg-slate-100 dark:group-hover:bg-slate-800 transition-colors relative z-10 text-slate-400 group-hover:text-orange-500 dark:group-hover:text-orange-400">
                                                    {attachment.isScreenshot ? <ImageIcon className="w-5 h-5" /> : <Paperclip className="w-5 h-5" />}
                                                </div>
                                                <div className="flex-1 min-w-0 relative z-10">
                                                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                                        {attachment.fileName}
                                                    </div>
                                                    <div className="text-xs text-slate-500 font-medium">
                                                        {(attachment.fileSize / 1024).toFixed(1)} KB
                                                    </div>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-50/40 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 h-full flex flex-col items-center justify-center text-center">
                                    <div className="w-12 h-12 bg-white dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-3">
                                        <Paperclip className="w-5 h-5 text-slate-400 dark:text-slate-600" />
                                    </div>
                                    <p className="text-sm text-slate-500 font-medium">No attachments</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Timeline Activity */}
                    <div className="relative max-w-4xl">
                        <div className="absolute left-6 top-8 bottom-8 w-[2px] bg-gradient-to-b from-slate-200 dark:from-slate-800 via-slate-200 dark:via-slate-800 to-transparent" />

                        <div className="space-y-10">
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 pl-2 mb-6">
                                    <Clock className="w-4 h-4" />
                                    Timeline
                                </h3>
                            </div>

                            {ticket.events.map((event, index) => {
                                const isAdmin = event.author?.role === 'ADMIN' || event.author?.role === 'SUPER_ADMIN';
                                const isReply = event.eventType === 'user_reply' || event.eventType === 'admin_reply';

                                return (
                                    <div key={event.id} className="relative pl-16 group">
                                        {/* Connector Dot */}
                                        <div className={`absolute left-[19px] top-6 w-3 h-3 rounded-full border-2 border-slate-50 dark:border-slate-950 z-10 shadow-[0_0_10px_rgba(0,0,0,0.1)] dark:shadow-[0_0_10px_rgba(0,0,0,0.5)] ${isAdmin ? 'bg-purple-500' : 'bg-slate-400 dark:bg-slate-600'
                                            }`} />

                                        {/* Avatar */}
                                        <div className={`absolute left-0 top-1 w-12 h-12 rounded-2xl flex items-center justify-center border-4 border-slate-50 dark:border-slate-950 shadow-xl z-20 ${isAdmin
                                                ? 'bg-gradient-to-br from-purple-600 to-indigo-600'
                                                : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800'
                                            }`}>
                                            {isAdmin ? <Shield className="w-5 h-5 text-white" /> : <User className="w-5 h-5 text-slate-500 dark:text-white" />}
                                        </div>

                                        <div className={`space-y-2 ${isReply ? 'bg-white dark:bg-slate-900 p-5 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-800 shadow-sm relative' : 'py-2'}`}>
                                            {isReply && (
                                                <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 to-transparent dark:from-white/5 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
                                            )}

                                            <div className="flex items-center gap-3 relative z-10">
                                                <span className={`font-bold text-sm ${isAdmin ? 'text-purple-600 dark:text-purple-400' : 'text-slate-900 dark:text-white'}`}>
                                                    {event.author?.name || 'System'}
                                                </span>
                                                {isAdmin && (
                                                    <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold uppercase rounded border border-purple-200 dark:border-purple-500/20">
                                                        Support
                                                    </span>
                                                )}
                                                <span className="text-xs text-slate-500 font-medium">
                                                    {formatDateTime(event.createdAt)}
                                                </span>
                                            </div>

                                            {isReply ? (
                                                <div className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap relative z-10">
                                                    {event.content}
                                                </div>
                                            ) : (
                                                <div className="text-slate-500 dark:text-slate-400 text-sm italic flex items-center gap-2">
                                                    {getEventMessage(event, ticket)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Reply Input */}
            {ticket.status !== 'closed' && (
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-50 from-60% via-slate-50/90 to-transparent dark:from-slate-950 dark:via-slate-950/90 dark:to-transparent z-40">
                    <div className="max-w-5xl mx-auto">
                        {submitError && (
                            <div className="mb-3 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 dark:text-red-400 text-sm w-fit flex items-center gap-2">
                                <AlertCircle className="w-3 h-3" />
                                {submitError}
                            </div>
                        )}
                        <form onSubmit={handleSubmitReply} className="relative group">
                            {/* Glow Effect */}
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 via-purple-600 to-blue-600 rounded-2xl opacity-20 group-focus-within:opacity-50 transition duration-500 blur-sm"></div>

                            <div className="relative flex items-end gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl">
                                <textarea
                                    value={replyContent}
                                    onChange={(e) => setReplyContent(e.target.value)}
                                    placeholder="Type your reply here..."
                                    rows={1}
                                    className="flex-1 px-4 py-3 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none resize-none font-medium text-base custom-scrollbar max-h-32 min-h-[52px]"
                                    style={{ height: '52px' }}
                                />
                                <button
                                    type="submit"
                                    disabled={!replyContent.trim() || isSubmitting}
                                    className="h-[52px] px-6 rounded-xl bg-gradient-to-r from-orange-500 to-purple-600 text-white font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0 shadow-lg shadow-orange-500/20"
                                >
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                    <span className="hidden sm:inline">Send</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../../../design-system/components';
import { FeedbackDetail, FeedbackEvent, FeedbackAttachment } from '../../../api/feedback';
import * as adminAPI from '../../../api/admin';
import {
  User,
  Calendar,
  Tag,
  AlertCircle,
  Send,
  Paperclip,
  Download,
  Image as ImageIcon,
  FileText,
  X,
  Loader2,
  CheckCircle,
  Clock,
  Shield
} from 'lucide-react';
import { cn } from '../../../design-system/utils';

interface TicketDetailModalProps {
  ticketId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: () => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticketId,
  open,
  onOpenChange,
  onStatusChange
}) => {
  const [ticket, setTicket] = useState<FeedbackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && ticketId) {
      loadTicketDetail();
    }
  }, [open, ticketId]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.events]);

  const loadTicketDetail = async () => {
    try {
      setLoading(true);
      const data = await adminAPI.getFeedbackDetail(ticketId);
      setTicket(data as FeedbackDetail);
    } catch (error) {
      console.error('Failed to load ticket:', error);
      // Use mock data for development when API is not ready
      setTicket(getMockTicketDetail(ticketId));
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !ticket) return;

    try {
      setSendingReply(true);
      const newEvent = await adminAPI.addFeedbackReply(ticket.id, replyText, false);
      setTicket({
        ...ticket,
        events: [...ticket.events, newEvent as FeedbackEvent]
      });
      setReplyText('');
    } catch (error) {
      console.error('Failed to send reply:', error);
      // Mock adding reply for development when API is not ready
      const mockEvent: FeedbackEvent = {
        id: `evt-${Date.now()}`,
        eventType: 'REPLY',
        content: replyText,
        createdAt: new Date().toISOString(),
        isInternal: false,
        author: {
          id: 'admin-1',
          name: 'Support Team',
          role: 'admin',
          avatar: undefined
        }
      };
      setTicket({
        ...ticket,
        events: [...ticket.events, mockEvent]
      });
      setReplyText('');
    } finally {
      setSendingReply(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket) return;

    try {
      setUpdatingStatus(true);
      await adminAPI.updateFeedbackStatus(ticket.id, newStatus);
      setTicket({ ...ticket, status: newStatus });
      onStatusChange?.();
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200';
      case 'in_progress':
        return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200';
      case 'resolved':
        return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200';
      case 'closed':
        return 'text-slate-600 bg-slate-50 dark:bg-slate-900/20 border-slate-200';
      default:
        return 'text-slate-600 bg-slate-50 dark:bg-slate-900/20 border-slate-200';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200';
      case 'low':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200';
      default:
        return 'text-slate-600 bg-slate-50 dark:bg-slate-900/20 border-slate-200';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderAttachment = (attachment: FeedbackAttachment) => {
    const isImage = attachment.fileType.startsWith('image/');

    return (
      <div
        key={attachment.id}
        className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
          {isImage ? (
            <ImageIcon className="w-4 h-4 text-blue-600" />
          ) : (
            <FileText className="w-4 h-4 text-slate-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
            {attachment.fileName}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {(attachment.fileSize / 1024).toFixed(1)} KB • {formatDate(attachment.uploadedAt)}
          </p>
        </div>
        <a
          href={attachment.viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <Download className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </a>
      </div>
    );
  };

  const renderEvent = (event: FeedbackEvent, index: number) => {
    const isSystem = event.eventType !== 'REPLY' && event.eventType !== 'CREATED';
    const isAdmin = event.author?.role === 'admin' || event.author?.role === 'super_admin';

    if (isSystem) {
      return (
        <div key={event.id} className="flex items-center gap-2 py-2 px-4 my-2">
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="w-3 h-3" />
            <span>{event.content || `Status changed`}</span>
            <span>•</span>
            <span>{formatDate(event.createdAt)}</span>
          </div>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>
      );
    }

    const isUserMessage = !isAdmin;

    return (
      <div
        key={event.id}
        className={cn(
          'flex gap-3 mb-4',
          isUserMessage ? 'flex-row' : 'flex-row-reverse'
        )}
      >
        <div className="flex-shrink-0">
          {event.author?.avatar ? (
            <img
              src={event.author.avatar}
              alt={event.author.name}
              className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800"
            />
          ) : (
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold',
                isAdmin
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              )}
            >
              {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
          )}
        </div>

        <div className={cn('flex-1 max-w-[80%]', isUserMessage ? 'items-start' : 'items-end')}>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {event.author?.name || 'Unknown'}
            </span>
            {isAdmin && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                Admin
              </span>
            )}
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {formatDate(event.createdAt)}
            </span>
          </div>

          <div
            className={cn(
              'rounded-2xl px-4 py-3 shadow-sm',
              isUserMessage
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-none'
                : 'bg-blue-600 text-white rounded-tr-none'
            )}
          >
            <p className="text-sm whitespace-pre-wrap break-words">{event.content}</p>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Modal open={open} onOpenChange={onOpenChange} title="Loading...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Modal>
    );
  }

  if (!ticket) {
    return (
      <Modal open={open} onOpenChange={onOpenChange} title="Error">
        <div className="text-center py-12">
          <p className="text-slate-600 dark:text-slate-400">Failed to load ticket details.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Ticket #${ticket.ticketId}`}
      className="max-w-4xl max-h-[90vh] overflow-hidden"
    >
      <div className="flex flex-col h-[80vh]">
        {/* Ticket Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
            {ticket.title}
          </h2>

          <div className="flex flex-wrap gap-2 mb-4">
            <span
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-full border',
                getStatusColor(ticket.status)
              )}
            >
              {ticket.status}
            </span>
            <span
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-full border',
                getSeverityColor(ticket.severity)
              )}
            >
              {ticket.severity}
            </span>
            <span className="px-3 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700">
              {ticket.category}
            </span>
            {ticket.feature && (
              <span className="px-3 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700">
                <Tag className="w-3 h-3 inline mr-1" />
                {ticket.feature}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <User className="w-4 h-4" />
              <span>
                {ticket.user.name} ({ticket.user.email})
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(ticket.createdAt)}</span>
            </div>
          </div>

          {/* Status Actions */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => handleStatusChange('in_progress')}
              disabled={updatingStatus || ticket.status === 'in_progress'}
              className="px-3 py-1.5 text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Mark In Progress
            </button>
            <button
              onClick={() => handleStatusChange('resolved')}
              disabled={updatingStatus || ticket.status === 'resolved'}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle className="w-3 h-3 inline mr-1" />
              Mark Resolved
            </button>
          </div>
        </div>

        {/* Initial Description */}
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
            Description
          </h3>
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
            {ticket.description}
          </p>
          {ticket.pageUrl && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Page: <a href={ticket.pageUrl} target="_blank" rel="noopener noreferrer" className="underline">{ticket.pageUrl}</a>
            </p>
          )}
        </div>

        {/* Attachments */}
        {ticket.attachments && ticket.attachments.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
              Attachments ({ticket.attachments.length})
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {ticket.attachments.map(renderAttachment)}
            </div>
          </div>
        )}

        {/* Conversation Thread */}
        <div className="flex-1 overflow-y-auto mb-4 px-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
            Conversation
          </h3>
          <div className="space-y-2">
            {ticket.events && ticket.events.length > 0 ? (
              <>
                {ticket.events.map((event, index) => renderEvent(event, index))}
                <div ref={conversationEndRef} />
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                No conversation yet. Be the first to reply!
              </p>
            )}
          </div>
        </div>

        {/* Reply Box */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
          <div className="flex gap-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSendReply();
                }
              }}
              placeholder="Type your response... (Cmd/Ctrl + Enter to send)"
              className="flex-1 px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
              rows={3}
            />
            <button
              onClick={handleSendReply}
              disabled={!replyText.trim() || sendingReply}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed h-fit"
            >
              {sendingReply ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Press Cmd/Ctrl + Enter to send
          </p>
        </div>
      </div>
    </Modal>
  );
};

// Mock data generator for development
function getMockTicketDetail(ticketId: string): FeedbackDetail {
  return {
    id: '1',
    ticketId: ticketId,
    title: 'Dashboard loading slow on large datasets',
    description: 'When I try to load the dashboard with a dataset containing more than 10,000 rows, it takes over 30 seconds to render. This makes the application almost unusable for large-scale analysis.\n\nSteps to reproduce:\n1. Upload a CSV with 10,000+ rows\n2. Navigate to the dashboard\n3. Wait for the charts to load\n\nExpected: Charts should load within 3-5 seconds\nActual: Takes 30+ seconds',
    status: 'open',
    severity: 'high',
    category: 'bug',
    feature: 'Dashboard',
    pageUrl: 'https://app.example.com/dashboard',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
    user: {
      id: 'user-1',
      name: 'John Doe',
      email: 'john.doe@example.com',
      avatar: undefined
    },
    attachments: [
      {
        id: 'att-1',
        fileName: 'screenshot-dashboard-slow.png',
        fileType: 'image/png',
        fileSize: 245678,
        isScreenshot: true,
        viewUrl: '/api/attachments/att-1',
        uploadedAt: new Date(Date.now() - 86400000 * 2).toISOString()
      },
      {
        id: 'att-2',
        fileName: 'performance-profile.json',
        fileType: 'application/json',
        fileSize: 12345,
        isScreenshot: false,
        viewUrl: '/api/attachments/att-2',
        uploadedAt: new Date(Date.now() - 86400000 * 2).toISOString()
      }
    ],
    events: [
      {
        id: 'evt-1',
        eventType: 'CREATED',
        content: 'Ticket created',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        isInternal: false,
        author: {
          id: 'user-1',
          name: 'John Doe',
          role: 'user'
        }
      },
      {
        id: 'evt-2',
        eventType: 'REPLY',
        content: 'I noticed this issue is particularly bad when using the bar chart visualization. The area chart seems to perform better.',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        isInternal: false,
        author: {
          id: 'user-1',
          name: 'John Doe',
          role: 'user'
        }
      },
      {
        id: 'evt-3',
        eventType: 'STATUS_CHANGE',
        content: 'Status changed from pending to open',
        createdAt: new Date(Date.now() - 43200000).toISOString(),
        isInternal: false,
        author: null
      },
      {
        id: 'evt-4',
        eventType: 'REPLY',
        content: 'Thank you for reporting this issue. We are investigating the performance bottleneck in the dashboard rendering. Our team will provide an update within 24 hours.',
        createdAt: new Date(Date.now() - 21600000).toISOString(),
        isInternal: false,
        author: {
          id: 'admin-1',
          name: 'Support Team',
          role: 'admin'
        }
      }
    ]
  };
}

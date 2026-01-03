import React, { useState, useEffect } from 'react';
import { AdminPageHeader } from '../shared/AdminPageHeader';
import { FeedbackTable } from './FeedbackTable';
import { TicketDetailModal } from './TicketDetailModal';
import * as adminAPI from '../../../api/admin';
import { FeedbackTicket } from '../../../api/feedback';
import { Button } from '../../../design-system/components';
import { RefreshCw, LayoutDashboard, CheckCircle, AlertTriangle, MessageSquare } from 'lucide-react';
import { cn } from '../../../design-system/utils';

const FeedbackManagement: React.FC = () => {
    const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, open: 0, resolved: 0, critical: 0 });
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            // Try to fetch real data from API
            const [feedbackResponse, statsResponse] = await Promise.allSettled([
                adminAPI.getAllFeedback({ limit: 50 }),
                adminAPI.getFeedbackStats()
            ]);

            // Handle feedback tickets
            if (feedbackResponse.status === 'fulfilled' && feedbackResponse.value) {
                const response = feedbackResponse.value as any;
                if (response && response.tickets) {
                    setTickets(response.tickets);
                } else if (Array.isArray(response)) {
                    // Handle if API returns array directly
                    setTickets(response);
                } else {
                    // Fallback to mock data
                    setTickets(getMockTickets());
                }
            } else {
                console.warn('Failed to load feedback from API, using mock data:', feedbackResponse.status === 'rejected' ? feedbackResponse.reason : 'No data');
                setTickets(getMockTickets());
            }

            // Handle stats
            if (statsResponse.status === 'fulfilled' && statsResponse.value) {
                const statsData = statsResponse.value as any;
                setStats({
                    total: statsData.total || 0,
                    open: statsData.open || 0,
                    resolved: statsData.resolved || 0,
                    critical: statsData.critical || 0
                });
            } else {
                // Calculate stats from tickets
                const currentTickets = feedbackResponse.status === 'fulfilled' && feedbackResponse.value ?
                    (feedbackResponse.value as any).tickets || [] : getMockTickets();
                setStats({
                    total: currentTickets.length,
                    open: currentTickets.filter((t: any) => t.status === 'open').length,
                    resolved: currentTickets.filter((t: any) => t.status === 'resolved').length,
                    critical: currentTickets.filter((t: any) => t.severity === 'critical').length
                });
            }
        } catch (error) {
            console.error('Failed to load feedback:', error);
            // Fallback to mock data
            setTickets(getMockTickets());
            setStats({ total: 3, open: 1, resolved: 1, critical: 1 });
        } finally {
            setLoading(false);
        }
    };

    const getMockTickets = (): FeedbackTicket[] => [
        {
            id: '1',
            ticketId: 'T-101',
            title: 'Dashboard loading slow',
            category: 'bug',
            status: 'open',
            severity: 'high',
            feature: 'Dashboard',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: '2',
            ticketId: 'T-102',
            title: 'Feature request: Export to PDF',
            category: 'feature',
            status: 'pending',
            severity: 'medium',
            feature: 'Analyses',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: '3',
            ticketId: 'T-103',
            title: 'Login issue on Safari',
            category: 'bug',
            status: 'resolved',
            severity: 'critical',
            feature: 'Auth',
            createdAt: new Date(Date.now() - 172800000).toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: '4',
            ticketId: 'T-104',
            title: 'Add dark mode to settings page',
            category: 'feature',
            status: 'in_progress',
            severity: 'low',
            feature: 'UI/UX',
            createdAt: new Date(Date.now() - 259200000).toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: '5',
            ticketId: 'T-105',
            title: 'API timeout on large dataset uploads',
            category: 'bug',
            status: 'open',
            severity: 'critical',
            feature: 'API',
            createdAt: new Date(Date.now() - 345600000).toISOString(),
            updatedAt: new Date().toISOString()
        }
    ];

    const handleUpdateStatus = async (ticketId: string, status: string) => {
        try {
            await adminAPI.updateFeedbackStatus(ticketId, status);
            loadData();
        } catch (error) {
            console.error('Failed to update status:', error);
        }
    };

    return (
        <div className="space-y-8">
            <AdminPageHeader
                title="User Feedback"
                subtitle="Review and manage user feedback, reports, and feature requests"
            >
                <Button variant="outline" onClick={loadData} leftIcon={<RefreshCw className="w-4 h-4" />}>
                    Refresh
                </Button>
            </AdminPageHeader>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Tickets" value={stats.total} icon={LayoutDashboard} color="indigo" />
                <StatCard label="Open Issues" value={stats.open} icon={LayoutDashboard} color="amber" />
                <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle} color="emerald" />
                <StatCard label="Critical" value={stats.critical} icon={LayoutDashboard} color="red" />
            </div>

            <FeedbackTable
                tickets={tickets}
                loading={loading}
                onViewTicket={(ticket) => {
                    setSelectedTicketId(ticket.id);
                    setShowDetailModal(true);
                }}
                onUpdateStatus={handleUpdateStatus}
            />

            {/* Ticket Detail Modal */}
            {showDetailModal && selectedTicketId && (
                <TicketDetailModal
                    ticketId={selectedTicketId}
                    open={showDetailModal}
                    onOpenChange={setShowDetailModal}
                    onStatusChange={loadData}
                />
            )}
        </div>
    );
};

const StatCard = ({ label, value, icon: Icon, color }: any) => {
    const colorClasses = {
        indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20',
        amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
        emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
        red: 'text-red-600 bg-red-50 dark:bg-red-900/20',
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className={cn("p-3 rounded-lg", colorClasses[color as keyof typeof colorClasses])}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            </div>
        </div>
    );
};

export default FeedbackManagement;

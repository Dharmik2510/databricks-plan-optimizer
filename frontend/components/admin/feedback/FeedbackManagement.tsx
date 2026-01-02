import React, { useState, useEffect } from 'react';
import { AdminPageHeader } from '../shared/AdminPageHeader';
import { FeedbackTable } from './FeedbackTable';
import * as adminAPI from '../../../api/admin';
import { FeedbackTicket } from '../../../api/feedback';
import { Button, Modal } from '../../../design-system/components';
import { RefreshCw, LayoutDashboard, CheckCircle } from 'lucide-react';
import { cn } from '../../../design-system/utils';

const FeedbackManagement: React.FC = () => {
    const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, open: 0, resolved: 0, critical: 0 });
    const [selectedTicket, setSelectedTicket] = useState<FeedbackTicket | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            // In a real app, we would fetch specialized admin feedback data
            const response = await adminAPI.getAllFeedback({ limit: 50 }) as any;
            if (response && response.tickets) {
                setTickets(response.tickets);
                // Calculate simple stats from the fetched batch or fetch separate stats
                const total = response.pagination.total || response.tickets.length;
                const open = response.tickets.filter((t: any) => t.status === 'open').length;
                const resolved = response.tickets.filter((t: any) => t.status === 'resolved').length;
                const critical = response.tickets.filter((t: any) => t.severity === 'critical').length;
                setStats({ total, open, resolved, critical });
            }
        } catch (error) {
            console.error('Failed to load feedback:', error);
            // Mock data for fallback dev experience if API not ready
            const mockTickets: FeedbackTicket[] = [
                { id: '1', ticketId: 'T-101', title: 'Dashboard loading slow', category: 'bug', status: 'open', severity: 'high', feature: 'Dashboard', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                { id: '2', ticketId: 'T-102', title: 'Feature request: Export to PDF', category: 'feature', status: 'pending', severity: 'medium', feature: 'Analyses', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString() },
                { id: '3', ticketId: 'T-103', title: 'Login issue on Safari', category: 'bug', status: 'resolved', severity: 'critical', feature: 'Auth', createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date().toISOString() },
            ];
            setTickets(mockTickets);
            setStats({ total: 3, open: 1, resolved: 1, critical: 1 });
        } finally {
            setLoading(false);
        }
    };

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
                    setSelectedTicket(ticket);
                    setShowDetailModal(true);
                }}
                onUpdateStatus={handleUpdateStatus}
            />

            {/* Simple Detail Modal */}
            {showDetailModal && selectedTicket && (
                <Modal
                    open={showDetailModal}
                    onOpenChange={setShowDetailModal}
                    title={`Ticket #${selectedTicket.ticketId}`}
                >
                    <div className="space-y-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">{selectedTicket.title}</h3>
                            <div className="flex gap-2 mb-4">
                                <span className="px-2 py-1 bg-white dark:bg-slate-700 rounded text-xs font-mono border border-slate-200 dark:border-slate-600">
                                    {selectedTicket.category}
                                </span>
                                <span className="px-2 py-1 bg-white dark:bg-slate-700 rounded text-xs font-mono border border-slate-200 dark:border-slate-600">
                                    {selectedTicket.severity}
                                </span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 text-sm">
                                Full ticket functionality including thread view and attachments will be available in the next update.
                            </p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setShowDetailModal(false)}>Close</Button>
                            <Button onClick={() => window.open(`/tickets/${selectedTicket.ticketId}`, '_blank')}>Open Ticket Page</Button>
                        </div>
                    </div>
                </Modal>
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

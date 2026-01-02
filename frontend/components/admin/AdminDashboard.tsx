import React, { useState, useEffect } from 'react';
import { Users, FileText, CheckCircle2, Activity, MessageSquare, GitBranch, Clock, AlertTriangle } from 'lucide-react';
import * as adminAPI from '../../api/admin';
import { StatCard } from './dashboard/StatCard';
import { ActionCard } from './dashboard/ActionCard';
import { FeatureStat } from './dashboard/FeatureStat';
import { SystemHealthWidget } from './dashboard/SystemHealthWidget';
import { UserGrowthChart, PlatformUsageChart, InputDistributionChart } from './dashboard/UsageCharts';
import { AdminPageHeader } from './shared/AdminPageHeader';

interface AdminDashboardProps {
  onNavigateToUsers: () => void;
  onNavigateToAnalyses: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateToUsers, onNavigateToAnalyses }) => {
  const [overview, setOverview] = useState<any>(null);
  const [userGrowth, setUserGrowth] = useState<any[]>([]);
  const [usageStats, setUsageStats] = useState<any[]>([]);
  const [popularFeatures, setPopularFeatures] = useState<any>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState(30);

  useEffect(() => {
    loadDashboardData();
  }, [selectedDays]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [overviewData, growthData, statsData, featuresData, healthData] = await Promise.all([
        adminAPI.getAnalyticsOverview(),
        adminAPI.getUserGrowth(selectedDays),
        adminAPI.getUsageStats(selectedDays),
        adminAPI.getPopularFeatures(),
        adminAPI.getSystemHealth(),
      ]);

      setOverview(overviewData);
      setUserGrowth(growthData as any[]);
      setUsageStats(statsData as any[]);
      setPopularFeatures(featuresData);
      setSystemHealth(healthData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 font-medium animate-pulse">Loading dashboard telemetry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <AdminPageHeader
        title="System Overview"
        subtitle="Real-time platform metrics and performance indicators"
      >
        <div className="flex gap-3 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => setSelectedDays(days)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${selectedDays === days
                ? 'bg-slate-900 text-white shadow-md dark:bg-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
            >
              Last {days} Days
            </button>
          ))}
        </div>
      </AdminPageHeader>

      {/* System Health Alert (if critical) */}
      {systemHealth && systemHealth.status === 'degraded' && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-6 flex items-start gap-4 shadow-sm animate-fade-in">
          <div className="p-3 bg-orange-100 dark:bg-orange-900/40 rounded-xl text-orange-600 dark:text-orange-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-orange-900 dark:text-orange-200 mb-1">System Performance Degraded</h3>
            <p className="text-orange-800 dark:text-orange-300 leading-relaxed">
              We've detected {systemHealth.errors.recentFailures} failed analyses in the last hour. This may indicate an issue with the Spark planner service.
            </p>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={overview?.users.total || 0}
          subtitle={`${overview?.users.newThisMonth || 0} joined this month`}
          icon={Users}
          trend={overview?.users.newThisMonth > 0 ? 'up' : 'neutral'}
          color="blue"
        />
        <StatCard
          title="Total Analyses"
          value={overview?.analyses.total || 0}
          subtitle={`${overview?.analyses.thisMonth || 0} processed this month`}
          icon={FileText}
          trend={overview?.analyses.thisMonth > 0 ? 'up' : 'neutral'}
          color="green"
        />
        <StatCard
          title="Success Rate"
          value={`${overview?.analyses.successRate || 0}%`}
          subtitle={`${overview?.analyses.completed || 0} completed successfully`}
          icon={CheckCircle2}
          trend={Number(overview?.analyses.successRate) > 90 ? 'up' : 'down'}
          color="indigo"
        />
        <StatCard
          title="Active Engagement"
          value={overview?.engagement.avgAnalysesPerUser || 0}
          subtitle="Avg analyses per user"
          icon={Activity}
          trend="neutral"
          color="orange"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <UserGrowthChart data={userGrowth} />
        <PlatformUsageChart data={usageStats} />
        <InputDistributionChart data={popularFeatures} />
        <SystemHealthWidget systemHealth={systemHealth} />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ActionCard
          title="Manage Users"
          description="View, edit, and manage user accounts and permissions"
          icon={Users}
          color="blue"
          onClick={onNavigateToUsers}
        />
        <ActionCard
          title="View Analyses"
          description="Monitor recent analyses logs and investigate failures"
          icon={FileText}
          color="indigo"
          onClick={onNavigateToAnalyses}
        />
      </div>

      {/* Feature Usage Stats */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-8">Feature Engagement</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureStat
            icon={MessageSquare}
            label="AI Conversations"
            value={(popularFeatures?.chat.withAnalysis || 0) + (popularFeatures?.chat.standalone || 0)}
            detail={`${popularFeatures?.chat.withAnalysis || 0} contextual`}
            color="violet"
          />
          <FeatureStat
            icon={GitBranch}
            label="Repo Integrations"
            value={popularFeatures?.repository.linkedAnalyses || 0}
            detail="Linked repositories"
            color="pink"
          />
          <FeatureStat
            icon={Clock}
            label="Active Sessions"
            value={overview?.users.active || 0}
            detail="Currently online"
            color="cyan"
          />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;


import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { Card, Badge } from '../../design-system/components';
import * as adminAPI from '../../api/admin';
import { Activity, Users, FileText, CheckCircle2, TrendingUp, AlertTriangle, Clock, GitBranch, MessageSquare } from 'lucide-react';

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

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-full scroll-smooth">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">System Overview</h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg">Real-time platform metrics and performance indicators</p>
        </div>
        <div className="flex gap-3 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => setSelectedDays(days)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${selectedDays === days
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
            >
              Last {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* System Health Alert */}
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
        {/* User Growth Chart */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">User Growth</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">New user signups over time</p>
            </div>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={userGrowth}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.5} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#fff',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="newUsers"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorUsers)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Usage Statistics Chart */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Platform Usage</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Analyses vs Chat Sessions</p>
            </div>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600 dark:text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usageStats} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.5} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#fff',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="analyses" fill="#10b981" name="Analyses" radius={[4, 4, 4, 4]} barSize={20} />
                <Bar dataKey="chatSessions" fill="#8b5cf6" name="Chat" radius={[4, 4, 4, 4]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Popular Features */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Input Distribution</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">What users are analyzing</p>
            </div>
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
              <PieChart className="w-5 h-5" />
            </div>
          </div>
          <div className="h-[300px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={popularFeatures?.inputTypes || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="count"
                  stroke="none"
                >
                  {(popularFeatures?.inputTypes || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">System Health</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Live service status</p>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${systemHealth?.status === 'healthy' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Global Status</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {systemHealth?.status === 'healthy' ? 'Operational' : 'Degraded'}
                  </p>
                </div>
              </div>
              <Badge variant={systemHealth?.status === 'healthy' ? 'success' : 'warning'} size="lg" className="px-4 py-1">
                {systemHealth?.status?.toUpperCase()}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <HealthMetric
                label="Queue Depth"
                value={(systemHealth?.queue.pending || 0) + (systemHealth?.queue.processing || 0)}
                subValue={`${systemHealth?.queue.pending} pending`}
                color="blue"
              />
              <HealthMetric
                label="Error Rate (1h)"
                value={systemHealth?.errors.recentFailures || 0}
                subValue="Last 60 mins"
                color="red"
              />
            </div>

            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
              <div className="flex justify-between items-end mb-2">
                <span className="text-emerald-800 dark:text-emerald-300 font-medium">Avg Processing Time</span>
                <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {((systemHealth?.performance.avgProcessingMs || 0) / 1000).toFixed(2)}s
                </span>
              </div>
              <div className="w-full bg-emerald-200 dark:bg-emerald-900/30 rounded-full h-1.5">
                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>
          </div>
        </div>
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

// Sub-components for cleaner code
const StatCard = ({ title, value, subtitle, icon: Icon, trend, color }: any) => {
  const colorMap: any = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/20 hover:shadow-2xl transition-all duration-300 group">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${colorMap[color]} group-hover:scale-110 transition-transform`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${trend === 'up' ? 'bg-emerald-100 text-emerald-700' : trend === 'down' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{value}</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{subtitle}</p>
      </div>
    </div>
  );
};

const HealthMetric = ({ label, value, subValue, color }: any) => (
  <div className={`p-4 rounded-2xl border ${color === 'blue' ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30' : 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30'}`}>
    <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${color === 'blue' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>{label}</p>
    <p className={`text-2xl font-bold ${color === 'blue' ? 'text-blue-900 dark:text-blue-100' : 'text-red-900 dark:text-red-100'}`}>{value}</p>
    <p className={`text-xs mt-1 ${color === 'blue' ? 'text-blue-700/60 dark:text-blue-300/60' : 'text-red-700/60 dark:text-red-300/60'}`}>{subValue}</p>
  </div>
);

const ActionCard = ({ title, description, icon: Icon, color, onClick }: any) => {
  const bgColors: any = {
    blue: 'hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:border-blue-200 dark:hover:border-blue-800',
    indigo: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/10 hover:border-indigo-200 dark:hover:border-indigo-800',
  };
  const iconColors: any = {
    blue: 'text-blue-600 dark:text-blue-400',
    indigo: 'text-indigo-600 dark:text-indigo-400',
  };

  return (
    <button onClick={onClick} className={`bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm text-left transition-all duration-300 group ${bgColors[color]}`}>
      <div className="flex items-center gap-4">
        <div className={`p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl group-hover:scale-110 transition-transform ${iconColors[color]}`}>
          <Icon className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{title}</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{description}</p>
        </div>
      </div>
    </button>
  );
}

const FeatureStat = ({ icon: Icon, label, value, detail, color }: any) => {
  const colors: any = {
    violet: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/20',
    pink: 'text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-900/20',
    cyan: 'text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-900/20',
  };

  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{detail}</p>
      </div>
    </div>
  );
}

export default AdminDashboard;

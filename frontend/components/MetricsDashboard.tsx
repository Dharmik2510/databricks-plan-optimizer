import React, { useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Card, { CardHeader, CardTitle, CardContent } from '../design-system/components/Card';
import Badge from '../design-system/components/Badge';
import { TrendingUp, TrendingDown, DollarSign, Clock, Zap, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatDuration, formatNumber } from '../design-system/utils';

export interface MetricsData {
  totalAnalyses: number;
  totalSavings: number;
  avgConfidence: number;
  optimizationsApplied: number;
  performanceTrends: Array<{
    date: string;
    runtime: number;
    optimizedRuntime: number;
    cost: number;
  }>;
  topOptimizations: Array<{
    name: string;
    savings: number;
    frequency: number;
    avgImprovement: number;
  }>;
}

interface MetricsDashboardProps {
  data: MetricsData;
  timeRange?: '7d' | '30d' | '90d';
}

const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ data, timeRange = '30d' }) => {
  const totalSavingsPercentage = useMemo(() => {
    if (!data.performanceTrends.length) return 0;

    const latest = data.performanceTrends[data.performanceTrends.length - 1];
    const earliest = data.performanceTrends[0];

    if (earliest.runtime === 0) return 0;
    return ((earliest.runtime - latest.optimizedRuntime) / earliest.runtime) * 100;
  }, [data.performanceTrends]);

  const avgSavingsPerMonth = useMemo(() => {
    if (!data.performanceTrends.length) return 0;
    const totalCost = data.performanceTrends.reduce((sum, item) => sum + item.cost, 0);
    return totalCost / data.performanceTrends.length;
  }, [data.performanceTrends]);

  const StatCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    value: string;
    change?: string;
    trend?: 'up' | 'down' | 'neutral';
    color: string;
  }> = ({ icon, title, value, change, trend, color }) => {
    return (
      <Card hoverable>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {title}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {value}
              </p>
              {change && (
                <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${
                  trend === 'up' ? 'text-green-600 dark:text-green-400' :
                  trend === 'down' ? 'text-red-600 dark:text-red-400' :
                  'text-gray-600 dark:text-gray-400'
                }`}>
                  {trend === 'up' && <TrendingUp className="h-4 w-4" />}
                  {trend === 'down' && <TrendingDown className="h-4 w-4" />}
                  <span>{change}</span>
                </div>
              )}
            </div>
            <div className={`p-3 rounded-lg ${color}`}>
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Performance Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track your query optimization progress and savings over time
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<Zap className="h-6 w-6 text-primary-600 dark:text-primary-400" />}
          title="Total Analyses"
          value={formatNumber(data.totalAnalyses)}
          change={`${timeRange} period`}
          color="bg-primary-100 dark:bg-primary-900/30"
        />

        <StatCard
          icon={<DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />}
          title="Total Savings"
          value={formatCurrency(data.totalSavings)}
          change={`${totalSavingsPercentage.toFixed(1)}% reduction`}
          trend="up"
          color="bg-green-100 dark:bg-green-900/30"
        />

        <StatCard
          icon={<Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />}
          title="Avg Performance Gain"
          value={`${totalSavingsPercentage.toFixed(0)}%`}
          change="faster queries"
          trend="up"
          color="bg-amber-100 dark:bg-amber-900/30"
        />

        <StatCard
          icon={<CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
          title="Optimizations Applied"
          value={formatNumber(data.optimizationsApplied)}
          change={`${data.avgConfidence.toFixed(0)}% avg confidence`}
          trend="neutral"
          color="bg-blue-100 dark:bg-blue-900/30"
        />
      </div>

      {/* Performance Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Trends (Last {timeRange})</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.performanceTrends}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="date"
                className="text-gray-600 dark:text-gray-400"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                className="text-gray-600 dark:text-gray-400"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => formatDuration(value)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#374151', fontWeight: 600 }}
                formatter={(value: any) => formatDuration(value)}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="runtime"
                stroke="#EF4444"
                strokeWidth={2}
                name="Original Runtime"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="optimizedRuntime"
                stroke="#10B981"
                strokeWidth={2}
                name="Optimized Runtime"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Optimization Opportunities */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Top Optimization Opportunities</CardTitle>
            <Badge variant="info" size="sm">
              By Potential Savings
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.topOptimizations.map((opt, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-bold">
                    #{index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {opt.name}
                    </h4>
                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                      <span>Found {opt.frequency}x</span>
                      <span>•</span>
                      <span>{opt.avgImprovement.toFixed(0)}% avg improvement</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(opt.savings)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    potential savings/month
                  </div>
                </div>
              </div>
            ))}
          </div>

          {data.topOptimizations.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Zap className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No optimizations data available yet</p>
              <p className="text-sm mt-1">Run more analyses to see optimization opportunities</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost Savings Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Savings Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.performanceTrends}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="date"
                className="text-gray-600 dark:text-gray-400"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                className="text-gray-600 dark:text-gray-400"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                formatter={(value: any) => formatCurrency(value)}
              />
              <Legend />
              <Bar dataKey="cost" fill="#10B981" name="Cost Savings" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default MetricsDashboard;

// Mock data generator for testing
export const generateMockMetricsData = (): MetricsData => {
  const dates = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return date.toISOString().split('T')[0];
  });

  return {
    totalAnalyses: 157,
    totalSavings: 24560,
    avgConfidence: 87,
    optimizationsApplied: 43,
    performanceTrends: dates.map(date => ({
      date,
      runtime: 900000 + Math.random() * 300000,
      optimizedRuntime: 300000 + Math.random() * 100000,
      cost: 50 + Math.random() * 200,
    })),
    topOptimizations: [
      { name: 'Enable broadcast joins', savings: 240, frequency: 12, avgImprovement: 67 },
      { name: 'Partition pruning', savings: 180, frequency: 8, avgImprovement: 45 },
      { name: 'Z-order clustering', savings: 150, frequency: 5, avgImprovement: 52 },
      { name: 'Predicate pushdown', savings: 120, frequency: 15, avgImprovement: 35 },
      { name: 'Cache intermediate results', savings: 90, frequency: 6, avgImprovement: 28 },
    ],
  };
};

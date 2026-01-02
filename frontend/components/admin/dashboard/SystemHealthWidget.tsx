import React from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { Badge } from '../../../design-system/components';

interface HealthMetricProps {
    label: string;
    value: number;
    subValue: string;
    color: 'blue' | 'red';
}

const HealthMetric = ({ label, value, subValue, color }: HealthMetricProps) => (
    <div className={`p-4 rounded-2xl border ${color === 'blue' ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30' : 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30'}`}>
        <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${color === 'blue' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>{label}</p>
        <p className={`text-2xl font-bold ${color === 'blue' ? 'text-blue-900 dark:text-blue-100' : 'text-red-900 dark:text-red-100'}`}>{value}</p>
        <p className={`text-xs mt-1 ${color === 'blue' ? 'text-blue-700/60 dark:text-blue-300/60' : 'text-red-700/60 dark:text-red-300/60'}`}>{subValue}</p>
    </div>
);

interface SystemHealthWidgetProps {
    systemHealth: any;
}

export const SystemHealthWidget: React.FC<SystemHealthWidgetProps> = ({ systemHealth }) => {
    return (
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

            {systemHealth && systemHealth.status === 'degraded' && (
                <div className="mt-6 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-6 flex items-start gap-4 shadow-sm animate-fade-in">
                    <div className="p-3 bg-orange-100 dark:bg-orange-900/40 rounded-xl text-orange-600 dark:text-orange-400">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-orange-900 dark:text-orange-200 mb-1">System Performance Degraded</h3>
                        <p className="text-orange-800 dark:text-orange-300 leading-relaxed text-sm">
                            We've detected {systemHealth.errors.recentFailures} failed analyses in the last hour. This may indicate an issue with the Spark planner service.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

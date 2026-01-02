import React from 'react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, Activity, PieChart as PieChartIcon } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const UserGrowthChart = ({ data }: { data: any[] }) => (
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
                <AreaChart data={data}>
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
);

export const PlatformUsageChart = ({ data }: { data: any[] }) => (
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
                <BarChart data={data} barGap={8}>
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
);

export const InputDistributionChart = ({ data }: { data: any }) => (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
        <div className="flex items-center justify-between mb-8">
            <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Input Distribution</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">What users are analyzing</p>
            </div>
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                <PieChartIcon className="w-5 h-5" />
            </div>
        </div>
        <div className="h-[300px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data?.inputTypes || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="count"
                        stroke="none"
                    >
                        {(data?.inputTypes || []).map((entry: any, index: number) => (
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
);

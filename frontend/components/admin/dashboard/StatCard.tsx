import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle: string;
    icon: LucideIcon;
    trend?: 'up' | 'down' | 'neutral';
    color: 'blue' | 'green' | 'indigo' | 'orange';
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon: Icon, trend, color }) => {
    const colorMap = {
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
                    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${trend === 'up' ? 'bg-emerald-100 text-emerald-700' :
                            trend === 'down' ? 'bg-red-100 text-red-700' :
                                'bg-slate-100 text-slate-600'
                        }`}>
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

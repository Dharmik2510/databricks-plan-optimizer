import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { ResourceMetric } from '../../shared/types';

interface ResourceChartProps {
  data: ResourceMetric[];
}

export const ResourceChart: React.FC<ResourceChartProps> = ({ data }) => {
  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 h-[600px] flex flex-col relative overflow-hidden transition-colors">
      <h3 className="font-bold text-slate-900 dark:text-white mb-6 text-lg">Resource Consumption</h3>
      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(100, 116, 139, 0.2)" />
            <XAxis dataKey="stageId" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" orientation="left" stroke="#475569" tick={{ fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} label={{ value: 'CPU Load (%)', angle: -90, position: 'insideLeft', fill: '#64748b', fontWeight: 600 }} />
            <YAxis yAxisId="right" orientation="right" stroke="#db2777" tick={{ fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} label={{ value: 'Memory (MB)', angle: 90, position: 'insideRight', fill: '#64748b', fontWeight: 600 }} />
            <Tooltip 
                cursor={{ fill: 'rgba(0,0,0,0.05)' }} 
                contentStyle={{ 
                    backgroundColor: 'var(--tw-bg-opacity, 1) #ffffff', 
                    borderColor: '#e2e8f0', 
                    borderRadius: '12px', 
                    color: '#0f172a', 
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
                    fontWeight: 500 
                }} 
                itemStyle={{ color: '#0f172a' }} 
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
            <Bar yAxisId="left" dataKey="cpuPercentage" name="CPU Load" fill="#6366f1" radius={[6, 6, 0, 0]}>{data.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.cpuPercentage > 80 ? '#ef4444' : '#6366f1'} />))}</Bar>
            <Bar yAxisId="right" dataKey="memoryMb" name="Memory Usage" fill="#ec4899" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
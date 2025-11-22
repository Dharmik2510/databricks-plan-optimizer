
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { ResourceMetric } from '../types';

interface ResourceChartProps {
  data: ResourceMetric[];
}

export const ResourceChart: React.FC<ResourceChartProps> = ({ data }) => {
  return (
    <div className="w-full bg-white/70 backdrop-blur-2xl rounded-2xl shadow-sm border border-slate-200/60 p-6 h-[600px] flex flex-col relative overflow-hidden">
      <h3 className="font-bold text-slate-900 mb-6 text-lg">Resource Consumption</h3>
      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="stageId" 
              tick={{ fontSize: 12, fill: '#475569' }} 
              tickLine={false} 
              axisLine={false}
            />
            <YAxis 
              yAxisId="left" 
              orientation="left" 
              stroke="#64748b" 
              tick={{ fill: '#475569' }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'CPU Load (%)', angle: -90, position: 'insideLeft', fill: '#64748b' }} 
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              stroke="#f472b6" 
              tick={{ fill: '#475569' }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'Memory (MB)', angle: 90, position: 'insideRight', fill: '#64748b' }} 
            />
            <Tooltip 
              cursor={{ fill: 'rgba(0,0,0,0.05)' }}
              contentStyle={{ 
                backgroundColor: '#ffffff', 
                borderColor: '#e2e8f0',
                borderRadius: '8px',
                color: '#1e293b',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              itemStyle={{ color: '#1e293b' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Bar yAxisId="left" dataKey="cpuPercentage" name="CPU Load" fill="#6366f1" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.cpuPercentage > 80 ? '#ef4444' : '#6366f1'} />
              ))}
            </Bar>
            <Bar yAxisId="right" dataKey="memoryMb" name="Memory Usage" fill="#f472b6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

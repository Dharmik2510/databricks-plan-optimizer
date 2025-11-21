import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { ResourceMetric } from '../types';

interface ResourceChartProps {
  data: ResourceMetric[];
}

export const ResourceChart: React.FC<ResourceChartProps> = ({ data }) => {
  return (
    <div className="w-full bg-slate-900/40 backdrop-blur-2xl rounded-3xl shadow-xl border border-white/10 p-6 h-[600px] flex flex-col relative overflow-hidden group hover:shadow-[0_0_40px_rgba(0,0,0,0.3)] transition-all">
      {/* Gloss Shine */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

      <h3 className="font-bold text-white mb-6 drop-shadow-sm">Resource Consumption by Stage</h3>
      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey="stageId" 
              tick={{ fontSize: 12, fill: '#e2e8f0' }} 
              tickLine={false} 
              axisLine={false}
            />
            <YAxis 
              yAxisId="left" 
              orientation="left" 
              stroke="#cbd5e1" 
              tick={{ fill: '#cbd5e1' }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'CPU Load (%)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} 
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              stroke="#f97316" 
              tick={{ fill: '#cbd5e1' }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'Memory (MB)', angle: 90, position: 'insideRight', fill: '#94a3b8' }} 
            />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              contentStyle={{ 
                backgroundColor: 'rgba(15, 23, 42, 0.8)', 
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '12px',
                color: '#f1f5f9',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
              }}
              itemStyle={{ color: '#e2e8f0' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Bar yAxisId="left" dataKey="cpuPercentage" name="CPU Load" fill="#6366f1" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.cpuPercentage > 80 ? '#ef4444' : '#6366f1'} />
              ))}
            </Bar>
            <Bar yAxisId="right" dataKey="memoryMb" name="Memory Usage" fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
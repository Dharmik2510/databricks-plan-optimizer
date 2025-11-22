import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { ResourceMetric } from '../types';

interface ResourceChartProps {
  data: ResourceMetric[];
}

export const ResourceChart: React.FC<ResourceChartProps> = ({ data }) => {
  return (
    <div className="w-full bg-white/50 backdrop-blur-3xl rounded-3xl shadow-lg border border-white/60 p-6 h-[600px] flex flex-col relative overflow-hidden ring-1 ring-white/40">
      <h3 className="font-bold text-slate-900 mb-6 text-lg drop-shadow-sm">Resource Consumption</h3>
      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(100, 116, 139, 0.2)" />
            <XAxis 
              dataKey="stageId" 
              tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} 
              tickLine={false} 
              axisLine={false}
            />
            <YAxis 
              yAxisId="left" 
              orientation="left" 
              stroke="#475569" 
              tick={{ fill: '#334155', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'CPU Load (%)', angle: -90, position: 'insideLeft', fill: '#475569', fontWeight: 600 }} 
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              stroke="#db2777" 
              tick={{ fill: '#334155', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'Memory (MB)', angle: 90, position: 'insideRight', fill: '#475569', fontWeight: 600 }} 
            />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.3)' }}
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                backdropFilter: 'blur(10px)',
                borderColor: '#fff',
                borderRadius: '12px',
                color: '#0f172a',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                fontWeight: 500
              }}
              itemStyle={{ color: '#0f172a' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
            <Bar yAxisId="left" dataKey="cpuPercentage" name="CPU Load" fill="#6366f1" radius={[6, 6, 0, 0]}>
              {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.cpuPercentage > 80 ? '#ef4444' : '#6366f1'} />
              ))}
            </Bar>
            <Bar yAxisId="right" dataKey="memoryMb" name="Memory Usage" fill="#ec4899" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
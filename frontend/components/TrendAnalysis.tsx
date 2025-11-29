
import React from 'react';
import { HistoricalTrend, RegressionAlert } from '../../shared/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingDown, AlertOctagon, History } from 'lucide-react';

interface Props {
  trend: HistoricalTrend;
  regression?: RegressionAlert;
}

export const TrendAnalysis: React.FC<Props> = ({ trend, regression }) => {
  const chartData = trend.dates.map((date, i) => ({
    date, time: trend.executionTimes[i], cost: trend.costs[i],
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4 mb-4"><div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200 shadow-sm"><History className="w-6 h-6" /></div><div><h3 className="text-2xl font-bold text-slate-900 drop-shadow-sm">Historical Trends</h3><p className="text-slate-600 font-medium">Track performance evolution and detect regressions.</p></div></div>
      {regression && (<div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4 shadow-sm animate-pulse"><div className="p-2 bg-white text-red-600 rounded-full border border-red-100 shadow-sm"><AlertOctagon className="w-6 h-6" /></div><div className="flex-1"><h4 className="text-lg font-bold text-red-900 mb-1">Performance Regression Detected</h4><p className="text-red-700 text-sm mb-3">Execution time increased by <span className="font-bold">{regression.regressionPercent.toFixed(1)}%</span> compared to previous run.</p><div className="bg-white/50 rounded-lg p-3 text-sm text-red-800 border border-red-100"><strong>Suspected Cause:</strong> {regression.suspectedCause}</div>{regression.autoFix && (<div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-white text-red-700 text-xs font-bold rounded-lg border border-red-200 shadow-sm cursor-pointer hover:bg-red-50">🤖 Auto-Fix: {regression.autoFix}</div>)}</div></div>)}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm"><div className="flex justify-between items-center mb-6"><h4 className="font-bold text-slate-900 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-orange-600" /> Execution Time (min)</h4><div className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">Last 10 Runs</div></div><div className="h-60 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="colorTime" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/><stop offset="95%" stopColor="#f97316" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} /><XAxis dataKey="date" tick={{fontSize: 10, fill: '#64748b', fontWeight: 600}} axisLine={false} tickLine={false} /><YAxis tickFormatter={(val) => `${(val/60).toFixed(0)}m`} tick={{fontSize: 10, fill: '#64748b', fontWeight: 600}} axisLine={false} tickLine={false} /><Tooltip formatter={(val: number) => [`${(val/60).toFixed(1)} min`, 'Duration']} contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}} /><Area type="monotone" dataKey="time" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorTime)" /></AreaChart></ResponsiveContainer></div></div>
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm"><div className="flex justify-between items-center mb-6"><h4 className="font-bold text-slate-900 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-emerald-600" /> Cost per Run ($)</h4><div className={`text-xs font-bold px-2 py-1 rounded ${trend.roi > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>ROI: {trend.roi}%</div></div><div className="h-60 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} /><XAxis dataKey="date" tick={{fontSize: 10, fill: '#64748b', fontWeight: 600}} axisLine={false} tickLine={false} /><YAxis tickFormatter={(val) => `$${val.toFixed(0)}`} tick={{fontSize: 10, fill: '#64748b', fontWeight: 600}} axisLine={false} tickLine={false} /><Tooltip formatter={(val: number) => [`$${val.toFixed(2)}`, 'Cost']} contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}} /><Line type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981'}} /></LineChart></ResponsiveContainer></div></div>
      </div>
    </div>
  );
};

// frontend/routes/HomeRoute.tsx
// Home page route component

import React from 'react';
import { Plus, FileText, Radio, Sparkles, FileClock, ChevronRight } from 'lucide-react';
import { RecentAnalyses } from '../components/RecentAnalyses';
import { ActiveTab } from '../../shared/types';
import { useUIStore } from '../store/useUIStore';

export const HomeRoute: React.FC = () => {
  const setActiveTab = useUIStore((state) => state.setActiveTab);

  const goToNewAnalysis = () => {
    setActiveTab(ActiveTab.DASHBOARD);
  };

  const handleComputeClick = () => {
    useUIStore.getState().setShowComingSoon(true, 'Live Compute Monitor');
  };

  return (
    <div className="space-y-12 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Get started</h1>
        <p className="text-slate-600 dark:text-slate-400 font-medium">
          Welcome to BrickOptima. What would you like to do today?
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GetStartedCard
          icon={Plus}
          title="Import and transform data"
          desc="Upload local files or paste execution plans for immediate analysis."
          actionText="Create analysis"
          onClick={goToNewAnalysis}
          color="blue"
        />
        <GetStartedCard
          icon={FileText}
          title="Repository Trace"
          desc="Connect your GitHub repository to map execution plans to source code."
          actionText="Connect repo"
          onClick={() => setActiveTab(ActiveTab.CODE_MAP)}
          color="orange"
        />
        <GetStartedCard
          icon={Radio}
          title="Live Monitor"
          desc="Connect to a live Databricks cluster to visualize real-time telemetry."
          actionText="Connect cluster"
          onClick={handleComputeClick}
          color="emerald"
        />
        <GetStartedCard
          icon={Sparkles}
          title="Advanced Insights"
          desc="Explore cluster right-sizing, config generation, and query rewrites."
          actionText="Explore insights"
          onClick={() => setActiveTab(ActiveTab.INSIGHTS)}
          color="purple"
        />
      </div>
      <div className="space-y-4">
        <RecentAnalyses
          onViewAll={() => setActiveTab(ActiveTab.HISTORY)}
          onSelectAnalysis={(id) => {
            setActiveTab(ActiveTab.HISTORY);
          }}
        />
      </div>
    </div>
  );
};

const GetStartedCard = ({
  icon: Icon,
  title,
  desc,
  actionText,
  onClick,
  color,
}: any) => {
  const colorMap: any = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800',
    orange:
      'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800',
    emerald:
      'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800',
    purple:
      'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800',
  };
  const theme = colorMap[color] || colorMap.blue;
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col"
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${theme} border shadow-sm`}
      >
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2 tracking-tight">
        {title}
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 flex-1 leading-relaxed font-medium">
        {desc}
      </p>
      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1 group-hover:gap-2 transition-all">
        {actionText} <ChevronRight className="w-3 h-3 text-orange-600 dark:text-orange-400" />
      </div>
    </div>
  );
};

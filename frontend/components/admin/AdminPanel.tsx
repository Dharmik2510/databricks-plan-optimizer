import React, { useState } from 'react';
import AdminDashboard from './AdminDashboard';
import UserManagement from './UserManagement';
import AnalysisManagement from './AnalysisManagement';
import { Shield, Users, BarChart3, Lock } from 'lucide-react';

type AdminView = 'dashboard' | 'users' | 'analyses';

const AdminPanel: React.FC = () => {
  const [activeView, setActiveView] = useState<AdminView>('dashboard');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'analyses', label: 'Analysis Logs', icon: Shield },
  ];

  return (
    <div className="flex h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <div className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-sm relative z-10">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white ring-1 ring-white/20">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Admin Portal</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">System Online</p>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Main Menu</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id as AdminView)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all duration-300 group relative overflow-hidden ${isActive
                    ? 'bg-slate-900 text-white shadow-lg'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-100 dark:opacity-90"></div>
                )}
                <Icon className={`w-5 h-5 relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className={`font-semibold relative z-10 ${isActive ? 'text-white' : ''}`}>{item.label}</span>
                {isActive && (
                  <div className="absolute right-4 w-2 h-2 rounded-full bg-white animate-pulse"></div>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="px-5 py-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-100 dark:border-amber-800/50 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Shield className="w-16 h-16 text-amber-600" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-1">
                <Shield className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Super Admin</span>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-500 leading-relaxed font-medium">
                You have full access to all system resources and user controls.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
        <div className="absolute inset-0 bg-grid-slate-200/50 dark:bg-grid-slate-800/20 bg-[bottom_1px_center] [mask-image:linear-gradient(to_bottom,transparent,black)] pointer-events-none"></div>
        <div className="relative h-full flex flex-col">
          {activeView === 'dashboard' && (
            <AdminDashboard
              onNavigateToUsers={() => setActiveView('users')}
              onNavigateToAnalyses={() => setActiveView('analyses')}
            />
          )}
          {activeView === 'users' && <UserManagement />}
          {activeView === 'analyses' && <AnalysisManagement />}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;

import React from 'react';
import { Shield, Users, BarChart3, Lock, Activity, Settings, HelpCircle, FileText } from 'lucide-react';
import { cn } from '../../../design-system/utils';

interface AdminSidebarProps {
    activeView: string;
    onNavigate: (view: string) => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeView, onNavigate }) => {
    const navItems = [
        { id: 'dashboard', label: 'Overview', icon: BarChart3 },
        { id: 'users', label: 'User Management', icon: Users },
        { id: 'analyses', label: 'Analyses & Jobs', icon: FileText },
        { id: 'health', label: 'System Health', icon: Activity },
        { id: 'feedback', label: 'Feedback', icon: HelpCircle },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    return (
        <div className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-sm relative z-20 h-full">
            {/* Brand Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/50">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20 text-white ring-1 ring-white/20">
                        <Shield className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Admin Portal</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">System Online</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-4 mt-2">Main Menu</div>
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 group relative overflow-hidden",
                                isActive
                                    ? "bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900"
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
                            )}
                        >
                            {isActive && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-white/10 dark:via-black/5 dark:to-black/10 pointer-events-none" />
                            )}
                            <Icon className={cn(
                                "w-5 h-5 transition-transform duration-200",
                                isActive ? "scale-100" : "group-hover:scale-110 opacity-70 group-hover:opacity-100"
                            )} />
                            <span className={cn(
                                "font-semibold text-sm relative z-10",
                                isActive ? "text-current" : ""
                            )}>
                                {item.label}
                            </span>
                            {isActive && (
                                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-current animate-pulse opacity-50"></div>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* User / Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl relative overflow-hidden shadow-sm group cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-xs ring-2 ring-white dark:ring-slate-900">
                            SA
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">Super Admin</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">admin@databricks.com</p>
                        </div>
                        <Lock className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                    </div>
                </div>
            </div>
        </div>
    );
};

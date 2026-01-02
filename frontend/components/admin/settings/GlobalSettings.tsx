import React from 'react';
import { AdminPageHeader } from '../shared/AdminPageHeader';
import { Settings } from 'lucide-react';

const GlobalSettings: React.FC = () => {
    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Global Settings"
                subtitle="Configure platform-wide settings and preferences"
            />

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-sm">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Settings className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Settings Module Coming Soon</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    This module will allow configuration of global system parameters, feature flags, and administrative preferences.
                </p>
            </div>
        </div>
    );
};

export default GlobalSettings;

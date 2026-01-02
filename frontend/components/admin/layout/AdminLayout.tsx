import React from 'react';
import { AdminSidebar } from './AdminSidebar';

interface AdminLayoutProps {
    children: React.ReactNode;
    activeView: string;
    onNavigate: (view: string) => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, activeView, onNavigate }) => {
    return (
        <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans selection:bg-indigo-500/30">
            <AdminSidebar activeView={activeView} onNavigate={onNavigate} />

            <main className="flex-1 h-full overflow-hidden relative flex flex-col">
                {/* Background Grids/Effects */}
                <div className="absolute inset-0 bg-grid-slate-200/40 dark:bg-grid-slate-800/20 bg-[bottom_1px_center] [mask-image:linear-gradient(to_bottom,transparent,black)] pointer-events-none z-0"></div>

                {/* Content Area */}
                <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth p-8">
                    <div className="max-w-7xl mx-auto h-full flex flex-col">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};

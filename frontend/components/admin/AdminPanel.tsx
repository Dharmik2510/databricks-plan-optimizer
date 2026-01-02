import React, { useState } from 'react';
import { AdminLayout } from './layout/AdminLayout';
import AdminDashboard from './AdminDashboard';
import UserManagement from './users/UserManagement';
import AnalysisManagement from './analyses/AnalysisManagement';
import FeedbackManagement from './feedback/FeedbackManagement';
import SystemHealth from './health/SystemHealth';
import GlobalSettings from './settings/GlobalSettings';

type AdminView = 'dashboard' | 'users' | 'analyses' | 'health' | 'feedback' | 'settings';

const AdminPanel: React.FC = () => {
  const [activeView, setActiveView] = useState<AdminView>('dashboard');

  const handleNavigate = (view: string) => {
    setActiveView(view as AdminView);
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <AdminDashboard
            onNavigateToUsers={() => setActiveView('users')}
            onNavigateToAnalyses={() => setActiveView('analyses')}
          />
        );
      case 'users':
        return <UserManagement />;
      case 'analyses':
        return <AnalysisManagement />;
      case 'health':
        return (
          <div className="flex items-center justify-center h-full text-slate-500">
            System Health View (Coming Soon)
          </div>
        );
      case 'feedback':
        return (
          <div className="flex items-center justify-center h-full text-slate-500">
            Feedback & Reports View (Coming Soon)
          </div>
        );
      case 'settings':
        return (
          <div className="flex items-center justify-center h-full text-slate-500">
            Admin Settings (Coming Soon)
          </div>
        );
      default:
        return <AdminDashboard onNavigateToUsers={() => setActiveView('users')} onNavigateToAnalyses={() => setActiveView('analyses')} />;
    }
  };

  return (
    <AdminLayout activeView={activeView} onNavigate={handleNavigate}>
      {renderContent()}
    </AdminLayout>
  );
};

export default AdminPanel;


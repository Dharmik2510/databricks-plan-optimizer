// src/components/auth/ProtectedRoute.tsx
// Route wrapper that requires authentication

import React from 'react';
import { useAuth } from '../../store/AuthContext';
import { AuthPage } from './AuthPage';
import { Activity, Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isInitialized, isLoading } = useAuth();

  // Show loading screen while checking auth
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50">
        {/* Animated background orbs */}
        <div className="fixed inset-0 -z-10">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-orange-200/40 to-orange-300/20 blur-3xl animate-pulse" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-blue-200/30 to-indigo-300/20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="flex flex-col items-center gap-6 animate-fade-in">
          {/* Logo with pulse animation */}
          <div className="relative">
            <div className="absolute inset-0 bg-orange-500/20 rounded-2xl blur-xl animate-pulse" />
            <div className="relative w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-500/30">
              <Activity className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Loading text */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-900 mb-2">BrickOptima</h2>
            <div className="flex items-center gap-2 text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Loading your workspace...</span>
            </div>
          </div>

          {/* Loading bar */}
          <div className="w-48 h-1 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full animate-loading-bar" />
          </div>
        </div>

        <style>{`
          @keyframes loading-bar {
            0% { width: 0%; transform: translateX(0); }
            50% { width: 70%; transform: translateX(0); }
            100% { width: 100%; transform: translateX(0); }
          }
          
          @keyframes fade-in {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
          
          .animate-loading-bar {
            animation: loading-bar 2s ease-in-out infinite;
          }
          
          .animate-fade-in {
            animation: fade-in 0.5s ease-out;
          }
        `}</style>
      </div>
    );
  }

  // Show auth page if not authenticated
  if (!isAuthenticated) {
    return <AuthPage />;
  }

  // Render protected content
  return <>{children}</>;
};

export default ProtectedRoute;

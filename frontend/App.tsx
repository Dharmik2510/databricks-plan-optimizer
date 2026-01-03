// frontend/App.tsx
// Main application component - Refactored with Zustand and React Query

import React, { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  Activity,
  LayoutDashboard,
  DollarSign,
  LogOut,
  BookOpen,
  MessageSquare,
  Plus,
  FileClock,
  Home,
  FileCode2,
  Shield,
  Radio,
  Sparkles,
  BrainCircuit,
  Moon,
  Sun,
  Ticket,
} from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider, useTheme } from './ThemeContext';
import { useAuth } from './store/AuthContext';
import { UserMenu } from './components/auth/UserMenu';
import { ToastProvider, Button } from './design-system/components';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import { LoadingScreen } from './components/LoadingScreen';
import { ActiveTab, AppState, PerformancePrediction } from '../shared/types';

// Lazy-loaded components for code splitting
const AdminPanel = lazy(() => import('./components/admin/AdminPanel'));
const ChatInterface = lazy(() => import('./components/ChatInterface').then(m => ({ default: m.ChatInterface })));
const CostEstimator = lazy(() => import('./components/CostEstimator').then(m => ({ default: m.CostEstimator })));
const LiveMonitor = lazy(() => import('./components/LiveMonitor').then(m => ({ default: m.LiveMonitor })));
const PlanCodeMapper = lazy(() => import('./components/agent/PlanCodeMapper').then(m => ({ default: m.PlanCodeMapper })));
const AdvancedInsights = lazy(() => import('./components/AdvancedInsights').then(m => ({ default: m.AdvancedInsights })));
const HistoryPage = lazy(() => import('./components/HistoryPage'));
const UserGuideModal = lazy(() => import('./components/guide/UserGuideModal').then(m => ({ default: m.UserGuideModal })));
const ComingSoonModal = lazy(() => import('./components/common/ComingSoonModal').then(m => ({ default: m.ComingSoonModal })));
const AuthPage = lazy(() => import('./components/auth/AuthPage').then(m => ({ default: m.AuthPage })));
const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));
const Onboarding = lazy(() => import('./components/Onboarding'));
const CommandPalette = lazy(() => import('./components/CommandPalette'));
const KeyboardShortcutsModal = lazy(() => import('./components/KeyboardShortcutsModal'));
const MyTicketsPage = lazy(() => import('./components/feedback/MyTicketsPage').then(m => ({ default: m.MyTicketsPage })));
const TicketDetailPage = lazy(() => import('./components/feedback/TicketDetailPage').then(m => ({ default: m.TicketDetailPage })));

// Feedback components (not lazy since they're always mounted)
import { FeedbackButton } from './components/feedback/FeedbackButton';
import { FeedbackModal } from './components/feedback/FeedbackModal';
import { useFeedbackStore } from './store/useFeedbackStore';

// Routes
import { HomeRoute } from './routes/HomeRoute';
import { DashboardRoute } from './routes/DashboardRoute';

// Stores
import { useAnalysisStore } from './store/useAnalysisStore';
import { usePredictionStore } from './store/usePredictionStore';
import { useRepositoryStore } from './store/useRepositoryStore';
import { useClusterStore } from './store/useClusterStore';
import { useUIStore } from './store/useUIStore';
import { useValidationStore } from './store/useValidationStore';

// React Query
import { queryClient } from './lib/queryClient';
import { useCloudInstances, useCloudRegions } from './hooks/useCloudQueries';

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // UI Store
  const {
    activeTab,
    showUserGuide,
    showComingSoon,
    comingSoonFeature,
    showCommandPalette,
    showShortcutsHelp,
    showAuth,
    setActiveTab,
    setShowUserGuide,
    setShowComingSoon,
    setShowCommandPalette,
    setShowShortcutsHelp,
    setShowAuth,
    closeAllModals,
  } = useUIStore();

  // Analysis Store
  const { result, appState, setAppState, reset: resetAnalysis, textContent } = useAnalysisStore();

  // Repository Store
  const { repoConfig, reset: resetRepository } = useRepositoryStore();

  // Prediction Store
  const { prediction } = usePredictionStore();

  // Cluster Store
  const { clusterContext, availableInstances, availableRegions, cloudProvider, setCloudProvider } =
    useClusterStore();

  // Fetch cloud data globally
  useCloudRegions(cloudProvider);
  useCloudInstances(clusterContext.region, cloudProvider);

  const resetApp = () => {
    resetAnalysis();
    resetRepository();
    useUIStore.getState().setActiveTab(ActiveTab.HOME);
  };

  const goToNewAnalysis = () => {
    setAppState(AppState.IDLE);
    setActiveTab(ActiveTab.DASHBOARD);
    useValidationStore.getState().reset();
  };

  const handleComputeClick = () => {
    setShowComingSoon(true, 'Live Compute Monitor');
  };

  const handleAnalyzeExample = (plan: string) => {
    useAnalysisStore.getState().setTextContent(plan);
    setAppState(AppState.IDLE);
    setActiveTab(ActiveTab.DASHBOARD);
  };

  // Keyboard Shortcuts
  const shortcuts = [
    {
      key: 'k',
      ctrlKey: true,
      description: 'Open command palette',
      action: () => setShowCommandPalette(true),
      category: 'Navigation',
    },
    {
      key: '?',
      shiftKey: true,
      description: 'Show keyboard shortcuts',
      action: () => setShowShortcutsHelp(true),
      category: 'Help',
    },
    {
      key: 'n',
      ctrlKey: true,
      description: 'New analysis',
      action: goToNewAnalysis,
      category: 'Actions',
    },
    {
      key: 'Escape',
      description: 'Close modals',
      action: closeAllModals,
      category: 'Navigation',
    },
  ];

  // Command Palette Commands
  const commands = [
    {
      id: 'new-analysis',
      label: 'New Analysis',
      description: 'Create a new query analysis',
      icon: <Plus className="h-4 w-4" />,
      action: goToNewAnalysis,
      category: 'Actions',
      keywords: ['create', 'add', 'new'],
    },
    {
      id: 'home',
      label: 'Go to Home',
      description: 'Navigate to home page',
      icon: <Home className="h-4 w-4" />,
      action: () => setActiveTab(ActiveTab.HOME),
      category: 'Navigation',
    },
    {
      id: 'history',
      label: 'View History',
      description: 'See your analysis history',
      icon: <FileClock className="h-4 w-4" />,
      action: () => setActiveTab(ActiveTab.HISTORY),
      category: 'Navigation',
    },
    {
      id: 'chat',
      label: 'AI Consultant',
      description: 'Ask AI about your query',
      icon: <MessageSquare className="h-4 w-4" />,
      action: () => setActiveTab(ActiveTab.CHAT),
      category: 'Chat',
    },
    {
      id: 'reset',
      label: 'Reset Context',
      description: 'Clear current analysis',
      icon: <LogOut className="h-4 w-4" />,
      action: resetApp,
      category: 'Actions',
    },
  ];

  useKeyboardShortcuts({ shortcuts, enabled: isAuthenticated });

  // Auth checks
  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated && !showAuth) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <LandingPage
          onLoginClick={() => setShowAuth(true)}
          onGetStartedClick={() => setShowAuth(true)}
        />
      </Suspense>
    );
  }

  if (!isAuthenticated && showAuth) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <AuthPage onBack={() => setShowAuth(false)} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen font-sans flex flex-col overflow-hidden text-slate-900 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 selection:bg-orange-500/30 transition-colors duration-300">
      <Header onLogoClick={() => setActiveTab(ActiveTab.HOME)} prediction={prediction} />
      <div className="flex flex-1 overflow-hidden">
        {activeTab !== ActiveTab.ADMIN && (
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            appState={appState}
            resetApp={resetApp}
            goToNewAnalysis={goToNewAnalysis}
            onGuideClick={() => setShowUserGuide(true)}
            onComputeClick={handleComputeClick}
            user={user}
          />
        )}
        <main className="flex-1 overflow-auto h-[calc(100vh-64px)] relative scroll-smooth bg-slate-50 dark:bg-slate-950">
          <div className="max-w-[1600px] mx-auto p-8 h-full">
            <Suspense fallback={<LoadingScreen />}>
              {activeTab === ActiveTab.HOME && <HomeRoute />}
              {activeTab === ActiveTab.DASHBOARD && <DashboardRoute />}
              {activeTab === ActiveTab.INSIGHTS && (
                <div className="max-w-5xl mx-auto pb-20">
                  {result ? (
                    <AdvancedInsights
                      clusterRec={result.clusterRecommendation}
                      configRec={result.sparkConfigRecommendation}
                      rewrites={result.queryRewrites}
                    />
                  ) : (
                    <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                      <Sparkles className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                        No Insights Available
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400">
                        Run an analysis first to generate advanced insights.
                      </p>
                      <button
                        onClick={goToNewAnalysis}
                        className="mt-6 px-6 py-2 bg-orange-600 text-white rounded-lg font-bold"
                      >
                        Go to Analyzer
                      </button>
                    </div>
                  )}
                </div>
              )}
              {activeTab === ActiveTab.LIVE && (
                <div className="h-full w-full">
                  <LiveMonitor />
                </div>
              )}
              {activeTab === ActiveTab.COST && (
                <div className="max-w-4xl mx-auto">
                  <CostEstimator
                    estimatedDurationMin={result?.estimatedDurationMin}
                    instances={availableInstances}
                    region={clusterContext.region}
                    availableRegions={availableRegions}
                    cloudProvider={cloudProvider}
                    onCloudProviderChange={setCloudProvider}
                    analysisResult={result}
                    onRegionChange={(r) =>
                      useClusterStore.getState().setClusterContext({ ...clusterContext, region: r })
                    }
                  />
                </div>
              )}
              {activeTab === ActiveTab.HISTORY && (
                <HistoryPage
                  onNewAnalysis={goToNewAnalysis}
                  onSelectAnalysis={(_id, data) => {
                    useAnalysisStore.getState().setResult(data);
                    setAppState(AppState.SUCCESS);
                    setActiveTab(ActiveTab.DASHBOARD);
                  }}
                />
              )}
              {activeTab === ActiveTab.CHAT && (
                <div className="max-w-4xl mx-auto h-full">
                  <ChatInterface analysisResult={result} />
                </div>
              )}
              {activeTab === ActiveTab.CODE_MAP && (
                <PlanCodeMapper
                  onBack={() => setActiveTab(ActiveTab.HOME)}
                  initialPlanContent={textContent}
                  initialRepoConfig={repoConfig}
                  initialDagStages={result?.dagNodes}
                />
              )}
              {activeTab === ActiveTab.ADMIN && <AdminPanel />}
              {activeTab === ActiveTab.MY_TICKETS && (
                <MyTicketsPage
                  onSelectTicket={(ticketId) => {
                    useFeedbackStore.getState().setSelectedTicketId(ticketId);
                    setActiveTab(ActiveTab.TICKET_DETAIL);
                  }}
                />
              )}
              {activeTab === ActiveTab.TICKET_DETAIL && useFeedbackStore.getState().selectedTicketId && (
                <TicketDetailPage
                  ticketId={useFeedbackStore.getState().selectedTicketId!}
                  onBack={() => setActiveTab(ActiveTab.MY_TICKETS)}
                />
              )}
            </Suspense>
          </div>
        </main>
        <Suspense fallback={null}>
          <UserGuideModal isOpen={showUserGuide} onClose={() => setShowUserGuide(false)} />
          <ComingSoonModal
            isOpen={showComingSoon}
            onClose={() => setShowComingSoon(false)}
            featureName={comingSoonFeature}
          />

          <Onboarding
            onAnalyzeExample={handleAnalyzeExample}
            onComplete={() => console.log('Onboarding completed')}
          />
          <CommandPalette
            open={showCommandPalette}
            onOpenChange={setShowCommandPalette}
            commands={commands}
          />
          <KeyboardShortcutsModal
            open={showShortcutsHelp}
            onOpenChange={setShowShortcutsHelp}
            shortcuts={shortcuts}
          />
        </Suspense>
        {/* Feedback Floating Button & Modal */}
        <FeedbackButton />
        <FeedbackModal />
      </div>
    </div>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

const Header = ({
  onLogoClick,
  prediction,
}: {
  onLogoClick: () => void;
  prediction: PerformancePrediction | null;
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between px-6 shadow-xl z-30 flex-shrink-0 relative">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-orange-500 via-purple-500 to-blue-500 shadow-[0_0_10px_rgba(249,115,22,0.5)] animate-gradient-x bg-[length:200%_auto]"></div>
      <div className="flex items-center gap-8 relative z-10">
        <button
          onClick={onLogoClick}
          className="font-bold text-lg flex items-center gap-3 text-white group cursor-pointer select-none bg-transparent border-none outline-none"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-orange-500 blur-lg opacity-0 group-hover:opacity-30 transition-opacity duration-500"></div>
            <span className="relative bg-gradient-to-br from-orange-500 to-red-600 p-2 rounded-xl shadow-lg flex items-center justify-center transform group-hover:scale-105 transition-transform duration-300 border border-white/10">
              <Activity className="w-5 h-5 text-white" />
            </span>
          </div>
          <div className="flex flex-col">
            <span className="tracking-tight text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
              BrickOptima
            </span>
          </div>
        </button>
      </div>
      <div className="flex items-center gap-5 relative z-10">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg shadow-sm backdrop-blur-sm">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-bold text-indigo-300">AI Engine Ready</span>
        </div>

        {prediction?.aiAgentStatus && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-md border border-indigo-400/30 animate-fade-in group hover:shadow-lg transition-all cursor-default">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-white animate-pulse" />
              <div className="flex flex-col leading-none">
                <span className="text-[10px] uppercase font-bold text-indigo-200 tracking-wider">
                  Agent Active
                </span>
                <span className="text-xs font-bold text-white">
                  ${prediction.aiAgentStatus.total_savings_session.toFixed(2)} Saved
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="h-8 w-px bg-slate-800 mx-2"></div>
        <UserMenu />
      </div>
    </header>
  );
};

const Sidebar = ({
  activeTab,
  setActiveTab,
  appState,
  resetApp,
  goToNewAnalysis,
  onGuideClick,
  onComputeClick,
  user,
}: any) => {
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  React.useEffect(() => {
    if (isAdmin && activeTab !== ActiveTab.ADMIN) {
      setActiveTab(ActiveTab.ADMIN);
    }
  }, [isAdmin, setActiveTab, activeTab]);

  return (
    <aside className="w-[240px] bg-slate-900 flex flex-col border-r border-slate-800 z-20">
      <div className="p-4">
        {!isAdmin && (
          <button
            onClick={goToNewAnalysis}
            className="w-full mb-6 relative group overflow-hidden rounded-xl p-[1px] focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 opacity-80 group-hover:opacity-100 transition-opacity duration-300"></span>
            <span className="relative flex items-center justify-center gap-2 w-full bg-slate-900 group-hover:bg-slate-800/50 text-white px-4 py-3 rounded-[11px] font-bold text-sm transition-colors duration-300">
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              <span className="bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
                New Analysis
              </span>
            </span>
          </button>
        )}

        <div className="space-y-1">
          {!isAdmin && (
            <>
              <SidebarItem
                icon={Home}
                label="Home"
                active={activeTab === ActiveTab.HOME}
                onClick={() => setActiveTab(ActiveTab.HOME)}
              />
              <SidebarItem
                icon={FileClock}
                label="History"
                active={activeTab === ActiveTab.HISTORY}
                onClick={() => setActiveTab(ActiveTab.HISTORY)}
              />
              <div className="h-px bg-slate-800 my-2 mx-3"></div>
              <SidebarItem
                icon={LayoutDashboard}
                label="Plan Analyzer"
                active={activeTab === ActiveTab.DASHBOARD}
                onClick={() => setActiveTab(ActiveTab.DASHBOARD)}
              />
              <SidebarItem
                data-tour="repo-tab"
                icon={FileCode2}
                label="Code Mapper"
                active={activeTab === ActiveTab.CODE_MAP}
                onClick={() => setActiveTab(ActiveTab.CODE_MAP)}
              />
              <SidebarItem
                icon={Sparkles}
                label="Advanced Insights"
                active={activeTab === ActiveTab.INSIGHTS}
                onClick={() => setActiveTab(ActiveTab.INSIGHTS)}
              />
              <SidebarItem
                icon={Radio}
                label="Compute"
                active={activeTab === ActiveTab.LIVE}
                onClick={onComputeClick}
              />
              <SidebarItem
                icon={DollarSign}
                label="Cost Management"
                active={activeTab === ActiveTab.COST}
                onClick={() => setActiveTab(ActiveTab.COST)}
              />
              <SidebarItem
                data-tour="chat-tab"
                icon={MessageSquare}
                label="AI Consultant"
                active={activeTab === ActiveTab.CHAT}
                onClick={() => setActiveTab(ActiveTab.CHAT)}
              />
              <div className="h-px bg-slate-800 my-2 mx-3"></div>
              <SidebarItem
                icon={Ticket}
                label="My Tickets"
                active={activeTab === ActiveTab.MY_TICKETS || activeTab === ActiveTab.TICKET_DETAIL}
                onClick={() => setActiveTab(ActiveTab.MY_TICKETS)}
              />
            </>
          )}

          {isAdmin && (
            <SidebarItem
              icon={Shield}
              label="Admin Panel"
              active={activeTab === ActiveTab.ADMIN}
              onClick={() => setActiveTab(ActiveTab.ADMIN)}
            />
          )}
        </div>
      </div>
      <div className="mt-auto p-4 border-t border-slate-800 space-y-2">
        {!isAdmin && appState === AppState.SUCCESS && (
          <Button
            onClick={resetApp}
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            leftIcon={<LogOut className="w-4 h-4" />}
          >
            Reset Context
          </Button>
        )}
        {!isAdmin && (
          <Button
            onClick={onGuideClick}
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            leftIcon={<BookOpen className="w-4 h-4" />}
          >
            User Guide
          </Button>
        )}
        <div className="flex items-center gap-3 px-3 py-2 text-slate-500 text-xs mt-2 font-mono">
          <Activity className="w-3 h-3" /> v{__APP_VERSION__}
        </div>
      </div>
    </aside>
  );
};

const SidebarItem = ({ icon: Icon, label, active, onClick, 'data-tour': dataTour }: any) => (
  <button
    data-tour={dataTour}
    onClick={onClick}
    className="w-full relative group p-[1px] rounded-lg overflow-hidden transition-all duration-300 mb-1 focus:outline-none"
  >
    <span
      className={`absolute inset-0 bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
    ></span>
    <span
      className={`relative flex items-center gap-3 px-3 py-2 rounded-[7px] w-full transition-colors duration-300 ${active ? 'bg-slate-800' : 'bg-slate-900 group-hover:bg-slate-900/90'
        }`}
    >
      <Icon
        className={`w-4 h-4 transition-colors duration-300 ${active ? 'text-orange-400' : 'text-slate-400 group-hover:text-white'
          }`}
      />
      <span
        className={`text-sm font-medium transition-colors duration-300 ${active ? 'text-white' : 'text-slate-400 group-hover:text-white'
          }`}
      >
        {label}
      </span>
    </span>
  </button>
);

export default App;

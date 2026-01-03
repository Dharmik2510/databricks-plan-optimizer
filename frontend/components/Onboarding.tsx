import React, { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import Modal from '../design-system/components/Modal';
import Button from '../design-system/components/Button';
import OnboardingTooltip from './OnboardingTooltip';

import { Sparkles, FileText, GitBranch, Zap } from 'lucide-react';

const ONBOARDING_KEY = 'brickoptima_onboarding_completed';
const SAMPLE_SPARK_PLAN = `== Physical Plan ==
AdaptiveSparkPlan isFinalPlan=false
+- Project [customer_id#1, customer_name#2, total_spend#3]
   +- SortMergeJoin [customer_id#1], [customer_id#10], Inner
      :- Sort [customer_id#1 ASC NULLS FIRST], false, 0
      :  +- Exchange hashpartitioning(customer_id#1, 200), ENSURE_REQUIREMENTS, [plan_id=1]
      :     +- FileScan parquet [customer_id#1,customer_name#2]
      :        Batched: true, DataFilters: [], Format: Parquet,
      :        Location: s3://my-bucket/customers/,
      :        PartitionFilters: [],
      :        PushedFilters: [],
      :        ReadSchema: struct<customer_id:bigint,customer_name:string>
      +- Sort [customer_id#10 ASC NULLS FIRST], false, 0
         +- Exchange hashpartitioning(customer_id#10, 200), ENSURE_REQUIREMENTS, [plan_id=2]
            +- HashAggregate(keys=[customer_id#10], functions=[sum(amount#11)])
               +- Exchange hashpartitioning(customer_id#10, 200), ENSURE_REQUIREMENTS, [plan_id=3]
                  +- HashAggregate(keys=[customer_id#10], functions=[partial_sum(amount#11)])
                     +- FileScan parquet [customer_id#10,amount#11]
                        Batched: true, DataFilters: [], Format: Parquet,
                        Location: s3://my-bucket/transactions/,
                        PartitionFilters: [],
                        PushedFilters: [],
                        ReadSchema: struct<customer_id:bigint,amount:double>`;

interface OnboardingProps {
  onComplete?: () => void;
  onAnalyzeExample?: (plan: string) => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onAnalyzeExample }) => {
  const [showWelcome, setShowWelcome] = useState(false);
  const [runTour, setRunTour] = useState(false);
  const [tourStarted, setTourStarted] = useState(false);

  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_KEY);
    if (!hasCompletedOnboarding) {
      // Small delay to ensure the app is fully rendered
      setTimeout(() => setShowWelcome(true), 500);
    }
  }, []);

  const handleWelcomeClose = (skipTour: boolean = false) => {
    setShowWelcome(false);
    if (!skipTour) {
      // Load example data first, then start tour (same as "Try Example")
      if (onAnalyzeExample) {
        onAnalyzeExample(SAMPLE_SPARK_PLAN);
      }
      // Start tour after example is loaded
      setTimeout(() => {
        setRunTour(true);
        setTourStarted(true);
      }, 1000);
    } else {
      completeOnboarding();
    }
  };

  const handleTryExample = () => {
    setShowWelcome(false);
    if (onAnalyzeExample) {
      onAnalyzeExample(SAMPLE_SPARK_PLAN);
    }
    // Start tour after example is loaded
    setTimeout(() => {
      setRunTour(true);
      setTourStarted(true);
    }, 1000);
  };

  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    if (onComplete) {
      onComplete();
    }
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRunTour(false);
      completeOnboarding();
    }
  };

  const tourSteps: Step[] = [
    {
      target: 'body',
      content: 'Welcome to BrickOptima! We\'ve loaded a sample Spark execution plan for you. Click "Analyze Plan" below to see the magic happen!',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="new-analysis"]',
      content: 'Click this button to analyze your Spark execution plan. The AI will detect performance bottlenecks and suggest optimizations.',
      disableBeacon: true,
      spotlightClicks: true,
    },
    {
      target: '[data-tour="chat-tab"]',
      content: 'Use the AI Consultant to ask questions about your query performance and get personalized optimization advice.',
    },
    {
      target: '[data-tour="repo-tab"]',
      content: 'Connect your GitHub repository to map performance issues directly to specific lines in your codebase.',
    },
  ];

  return (
    <>
      {/* Welcome Modal */}
      <Modal
        open={showWelcome}
        onOpenChange={(open) => !open && handleWelcomeClose(true)}
        title=""
        size="lg"
        showCloseButton={false}
        padding={false}
        className="!bg-transparent !border-none !shadow-none !p-0 overflow-visible bg-none"
      >
        <div className="relative rounded-3xl overflow-hidden p-[1px]">
          {/* Glowing Gradient Border Container */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-pink-500 to-indigo-600 animate-gradient-x"></div>

          {/* Glass Content Container - Mobile Optimized */}
          <div className="relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-[23px] p-4 sm:p-8 max-h-[85vh] overflow-y-auto">

            {/* Header Section */}
            <div className="text-center mb-6 sm:mb-10 relative z-10">
              <div className="inline-block p-2 sm:p-3 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-orange-800/10 mb-4 sm:mb-6 shadow-inner border border-orange-200 dark:border-orange-800/30">
                <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold mb-3 sm:mb-4 text-slate-900 dark:text-white tracking-tight">
                Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-indigo-600">BrickOptima</span>
              </h2>
              <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg max-w-lg mx-auto leading-relaxed font-medium">
                Optimize your Databricks queries with AI-powered insights. Let's get you started with a quick tour.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 gap-3 sm:gap-5 mb-6 sm:mb-10 relative z-10">
              {[
                { icon: Sparkles, color: 'text-orange-500', bg: 'bg-orange-500/10', title: 'AI-Powered Analysis', desc: 'Get instant optimization recommendations' },
                { icon: FileText, color: 'text-green-500', bg: 'bg-green-500/10', title: 'DAG Visualization', desc: 'Interactive query execution graphs' },
                { icon: GitBranch, color: 'text-purple-500', bg: 'bg-purple-500/10', title: 'Code Mapping', desc: 'Link optimizations to source code' },
                { icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10', title: 'Cost & Performance', desc: 'Estimate savings and improvements' },
              ].map((item, i) => (
                <div key={i} className="group p-3 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-300">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className={`p-2 sm:p-3 rounded-xl ${item.bg} ${item.color}`}>
                      <item.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-base">
                        {item.title}
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-3 pt-2 relative z-10">
              <button
                onClick={handleTryExample}
                className="group relative w-full px-4 py-3 sm:py-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-base sm:text-lg font-bold shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-pink-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <span className="relative z-10 flex items-center gap-2 text-white dark:text-slate-900 group-hover:text-white transition-colors duration-300">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" /> Try Example Analysis
                </span>
              </button>

              <button
                onClick={() => handleWelcomeClose(false)}
                className="w-full px-4 py-3 sm:py-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                Start Tour
              </button>

              <button
                onClick={() => handleWelcomeClose(true)}
                className="w-full px-4 py-2 sm:py-3 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium transition-colors text-sm"
              >
                Skip
              </button>
            </div>

            {/* Decorative Blur */}
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-orange-500/10 dark:bg-orange-500/20 rounded-full blur-3xl pointer-events-none"></div>

          </div>
        </div>
      </Modal>

      {/* Joyride Tour */}
      {tourStarted && (
        <Joyride
          steps={tourSteps}
          run={runTour}
          continuous
          showProgress
          showSkipButton
          disableScrolling={false}
          spotlightPadding={0}
          callback={handleJoyrideCallback}
          tooltipComponent={OnboardingTooltip}
          floaterProps={{
            hideArrow: true,
            styles: {
              floater: {
                filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.2))",
              }
            }
          }}
          styles={{
            options: {
              zIndex: 10000,
              overlayColor: 'rgba(0, 0, 0, 0.65)',
            },
            spotlight: {
              borderRadius: 16,
            }
          }}
        />
      )}
    </>
  );
};

export default Onboarding;

// Helper to reset onboarding (useful for testing)
export const resetOnboarding = () => {
  localStorage.removeItem(ONBOARDING_KEY);
};

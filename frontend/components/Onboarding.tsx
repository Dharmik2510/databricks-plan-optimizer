import React, { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import Modal from '../design-system/components/Modal';
import Button from '../design-system/components/Button';

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
        showCloseButton={false} // We typically handle this manually for custom headers or keep it false for this welcome screen style
      >
        <div className="relative">
          {/* Decorative background elements */}
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header Section */}
          <div className="text-center mb-8 relative z-10">
            <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent dark:from-primary-400 dark:to-purple-400">
              Welcome to BrickOptima! 🎉
            </h2>
            <p className="text-gray-600 dark:text-gray-300 text-lg max-w-lg mx-auto leading-relaxed">
              Optimize your Databricks queries with AI-powered insights. Let's get you started with a quick tour.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 relative z-10">
            <div className="group p-4 rounded-xl border border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 hover:shadow-lg hover:shadow-primary-500/10 hover:border-primary-500/30 transition-all duration-300 cursor-default">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/20 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  <Sparkles className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    AI-Powered Analysis
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    Get instant optimization recommendations from advanced AI models
                  </p>
                </div>
              </div>
            </div>

            <div className="group p-4 rounded-xl border border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 hover:shadow-lg hover:shadow-green-500/10 hover:border-green-500/30 transition-all duration-300 cursor-default">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                    DAG Visualization
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    Interactive query execution graphs with performance metrics
                  </p>
                </div>
              </div>
            </div>

            <div className="group p-4 rounded-xl border border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 hover:shadow-lg hover:shadow-purple-500/10 hover:border-purple-500/30 transition-all duration-300 cursor-default">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  <GitBranch className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    Code Mapping
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    Connect GitHub repos to map optimizations to your codebase
                  </p>
                </div>
              </div>
            </div>

            <div className="group p-4 rounded-xl border border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 hover:shadow-lg hover:shadow-amber-500/10 hover:border-amber-500/30 transition-all duration-300 cursor-default">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  <Zap className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    Cost & Performance
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    Estimate savings and performance improvements for each optimization
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2 relative z-10">
            <Button
              className="flex-1 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white border-0 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-all duration-300"
              size="lg"
              onClick={handleTryExample}
              leftIcon={<Sparkles className="h-5 w-5" />}
            >
              Try Example Analysis
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="flex-1 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              onClick={() => handleWelcomeClose(false)}
            >
              Start Tour
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={() => handleWelcomeClose(true)}
            >
              Skip
            </Button>
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
          styles={{
            options: {
              primaryColor: '#2196F3',
              zIndex: 10000,
            },
            tooltip: {
              borderRadius: 8,
              fontSize: 14,
            },
            buttonNext: {
              backgroundColor: '#2196F3',
              borderRadius: 6,
              padding: '8px 16px',
            },
            buttonBack: {
              color: '#6B7280',
              marginRight: 8,
            },
          }}
          locale={{
            back: 'Back',
            close: 'Close',
            last: 'Finish',
            next: 'Next',
            skip: 'Skip Tour',
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

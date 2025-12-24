import React from 'react';
import Modal, { ModalFooter } from '../design-system/components/Modal';
import Button from '../design-system/components/Button';
import Card, { CardContent } from '../design-system/components/Card';
import Badge from '../design-system/components/Badge';
import { TrendingUp, TrendingDown, Clock, DollarSign, Info, ArrowRight } from 'lucide-react';
import { formatCurrency, formatDuration } from '../design-system/utils';

export interface OptimizationDetails {
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impact: {
    runtime?: {
      before: number;
      after: number;
      improvement: number;
    };
    cost?: {
      before: number;
      after: number;
      savings: number;
    };
    dataVolume?: {
      before: number;
      after: number;
      reduction: number;
    };
  };
  explanation: {
    problem: string;
    solution: string;
    howItWorks: string;
  };
  implementation: {
    difficulty: 'Easy' | 'Medium' | 'Hard';
    steps: string[];
    codeExample?: string;
  };
  tradeoffs?: string[];
}

interface OptimizationExplanationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  optimization: OptimizationDetails | null;
}

const OptimizationExplanationModal: React.FC<OptimizationExplanationModalProps> = ({
  open,
  onOpenChange,
  optimization,
}) => {
  if (!optimization) return null;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return 'success';
      case 'Medium':
        return 'warning';
      case 'Hard':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={optimization.title}
      description="Detailed explanation and implementation guide"
      size="xl"
    >
      <div className="space-y-6">
        {/* Severity and Difficulty */}
        <div className="flex items-center gap-3">
          <Badge severity={optimization.severity} size="md">
            {optimization.severity}
          </Badge>
          <Badge variant={getDifficultyColor(optimization.implementation.difficulty)} size="md">
            {optimization.implementation.difficulty} Implementation
          </Badge>
        </div>

        {/* Impact Metrics */}
        {(optimization.impact.runtime || optimization.impact.cost) && (
          <Card variant="outlined" padding="md">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Expected Impact
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {optimization.impact.runtime && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">Runtime</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {formatDuration(optimization.impact.runtime.before)}
                      </div>
                      <div className="text-xs text-gray-500">Before</div>
                    </div>

                    <ArrowRight className="h-5 w-5 text-gray-400" />

                    <div className="flex-1">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatDuration(optimization.impact.runtime.after)}
                      </div>
                      <div className="text-xs text-gray-500">After</div>
                    </div>
                  </div>

                  <div className="text-sm font-medium text-green-600 dark:text-green-400">
                    {(optimization.impact.runtime.improvement * 100).toFixed(0)}% faster
                  </div>
                </div>
              )}

              {optimization.impact.cost && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <DollarSign className="h-4 w-4" />
                    <span className="font-medium">Cost</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {formatCurrency(optimization.impact.cost.before)}
                      </div>
                      <div className="text-xs text-gray-500">Before</div>
                    </div>

                    <TrendingDown className="h-5 w-5 text-green-500" />

                    <div className="flex-1">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(optimization.impact.cost.after)}
                      </div>
                      <div className="text-xs text-gray-500">After</div>
                    </div>
                  </div>

                  <div className="text-sm font-medium text-green-600 dark:text-green-400">
                    Save {formatCurrency(optimization.impact.cost.savings)}/month
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Explanation */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
              <Info className="h-4 w-4 text-red-500" />
              The Problem
            </h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {optimization.explanation.problem}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
              <Info className="h-4 w-4 text-green-500" />
              The Solution
            </h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {optimization.explanation.solution}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              How It Works
            </h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {optimization.explanation.howItWorks}
            </p>
          </div>
        </div>

        {/* Implementation Steps */}
        <Card variant="outlined" padding="md" className="bg-blue-50 dark:bg-blue-900/10">
          <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
            Implementation Steps
          </h3>

          <ol className="space-y-2 list-decimal list-inside">
            {optimization.implementation.steps.map((step, index) => (
              <li key={index} className="text-gray-700 dark:text-gray-300">
                {step}
              </li>
            ))}
          </ol>

          {optimization.implementation.codeExample && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Code Example
              </h4>
              <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                {optimization.implementation.codeExample}
              </pre>
            </div>
          )}
        </Card>

        {/* Trade-offs */}
        {optimization.tradeoffs && optimization.tradeoffs.length > 0 && (
          <Card variant="outlined" padding="md" className="bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700">
            <h3 className="text-sm font-semibold mb-2 text-amber-900 dark:text-amber-100 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Trade-offs to Consider
            </h3>
            <ul className="space-y-1 list-disc list-inside text-sm text-amber-800 dark:text-amber-200">
              {optimization.tradeoffs.map((tradeoff, index) => (
                <li key={index}>{tradeoff}</li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Close
        </Button>
        <Button variant="primary">
          Apply Optimization
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default OptimizationExplanationModal;

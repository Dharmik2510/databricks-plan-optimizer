import React, { useState } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '../design-system/components/Card';
import Badge from '../design-system/components/Badge';
import Button from '../design-system/components/Button';
import Tooltip from '../design-system/components/Tooltip';
import { ArrowRight, Maximize2, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { formatDuration, formatCurrency, formatNumber, formatBytes } from '../design-system/utils';

export interface DAGComparison {
  before: {
    nodes: number;
    shuffles: number;
    runtime: number;
    cost: number;
    dataProcessed: number;
  };
  after: {
    nodes: number;
    shuffles: number;
    runtime: number;
    cost: number;
    dataProcessed: number;
  };
  improvements: {
    nodesReduced: number;
    shufflesReduced: number;
    runtimeImprovement: number;
    costSavings: number;
    dataReduction: number;
  };
}

interface BeforeAfterComparisonProps {
  comparison: DAGComparison;
  dagBefore?: React.ReactNode;
  dagAfter?: React.ReactNode;
  onViewDetails?: () => void;
}

const BeforeAfterComparison: React.FC<BeforeAfterComparisonProps> = ({
  comparison,
  dagBefore,
  dagAfter,
  onViewDetails,
}) => {
  const [view, setView] = useState<'side-by-side' | 'stacked'>('side-by-side');

  const MetricRow: React.FC<{
    label: string;
    before: string | number;
    after: string | number;
    improvement: number;
    unit?: string;
    inverse?: boolean;
    tooltip?: string;
  }> = ({ label, before, after, improvement, unit = '', inverse = false, tooltip }) => {
    const isPositive = inverse ? improvement < 0 : improvement > 0;
    const displayImprovement = Math.abs(improvement);

    return (
      <div className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </span>
          {tooltip && (
            <Tooltip content={tooltip}>
              <Info className="h-4 w-4 text-gray-400 cursor-help" />
            </Tooltip>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right min-w-[80px]">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {before}{unit}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">Before</div>
          </div>

          <ArrowRight className={`h-4 w-4 flex-shrink-0 ${
            isPositive ? 'text-green-500' : 'text-gray-400'
          }`} />

          <div className="text-right min-w-[80px]">
            <div className={`text-sm font-semibold ${
              isPositive ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'
            }`}>
              {after}{unit}
            </div>
            <div className="text-xs text-gray-500">After</div>
          </div>

          <div className="text-right min-w-[70px]">
            <div className={`flex items-center gap-1 text-sm font-semibold ${
              isPositive ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
            }`}>
              {isPositive ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <TrendingUp className="h-3 w-3" />
              )}
              {displayImprovement.toFixed(0)}%
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Before vs. After Optimization
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Compare the original and optimized query execution plans
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setView('side-by-side')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'side-by-side'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              Side by Side
            </button>
            <button
              onClick={() => setView('stacked')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'stacked'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              Stacked
            </button>
          </div>

          {onViewDetails && (
            <Button variant="outline" size="sm" onClick={onViewDetails} leftIcon={<Maximize2 className="h-4 w-4" />}>
              Full Screen
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Comparison Card */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <MetricRow
              label="Query Runtime"
              before={formatDuration(comparison.before.runtime)}
              after={formatDuration(comparison.after.runtime)}
              improvement={comparison.improvements.runtimeImprovement}
              tooltip="Total time to execute the query"
            />

            <MetricRow
              label="Execution Cost"
              before={formatCurrency(comparison.before.cost)}
              after={formatCurrency(comparison.after.cost)}
              improvement={comparison.improvements.costSavings}
              tooltip="Estimated compute cost based on cluster configuration"
            />

            <MetricRow
              label="DAG Nodes"
              before={comparison.before.nodes}
              after={comparison.after.nodes}
              improvement={comparison.improvements.nodesReduced}
              tooltip="Number of operations in the execution plan"
            />

            <MetricRow
              label="Shuffle Operations"
              before={comparison.before.shuffles}
              after={comparison.after.shuffles}
              improvement={comparison.improvements.shufflesReduced}
              tooltip="Network-intensive data redistribution operations"
            />

            <MetricRow
              label="Data Processed"
              before={formatBytes(comparison.before.dataProcessed)}
              after={formatBytes(comparison.after.dataProcessed)}
              improvement={comparison.improvements.dataReduction}
              tooltip="Total amount of data read and processed"
            />
          </div>
        </CardContent>
      </Card>

      {/* DAG Visual Comparison */}
      {(dagBefore || dagAfter) && (
        <div className={`grid ${view === 'side-by-side' ? 'grid-cols-2' : 'grid-cols-1'} gap-6`}>
          {/* Before DAG */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Original Plan</CardTitle>
                <Badge variant="default" size="sm">
                  {comparison.before.nodes} nodes
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 min-h-[300px] flex items-center justify-center">
                {dagBefore || (
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <p>Original DAG visualization</p>
                    <p className="text-sm mt-1">
                      {comparison.before.shuffles} shuffle operations
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {formatDuration(comparison.before.runtime)}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Runtime</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(comparison.before.cost)}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Cost</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* After DAG */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Optimized Plan</CardTitle>
                <Badge variant="success" size="sm">
                  {comparison.after.nodes} nodes
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 min-h-[300px] flex items-center justify-center border-2 border-green-200 dark:border-green-800">
                {dagAfter || (
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <p>Optimized DAG visualization</p>
                    <p className="text-sm mt-1">
                      {comparison.after.shuffles} shuffle operations
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center border-2 border-green-200 dark:border-green-800">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatDuration(comparison.after.runtime)}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Runtime</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center border-2 border-green-200 dark:border-green-800">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(comparison.after.cost)}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Cost</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary */}
      <Card variant="outlined" className="bg-green-50 dark:bg-green-900/10 border-green-300 dark:border-green-700">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-3">
            💡 Optimization Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-green-700 dark:text-green-300 font-semibold">
                {comparison.improvements.runtimeImprovement.toFixed(0)}% faster
              </span>
              <p className="text-green-800 dark:text-green-200 mt-1">
                Runtime improved from {formatDuration(comparison.before.runtime)} to {formatDuration(comparison.after.runtime)}
              </p>
            </div>
            <div>
              <span className="text-green-700 dark:text-green-300 font-semibold">
                {formatCurrency(comparison.before.cost - comparison.after.cost)} saved
              </span>
              <p className="text-green-800 dark:text-green-200 mt-1">
                Monthly cost reduction of {comparison.improvements.costSavings.toFixed(0)}%
              </p>
            </div>
            <div>
              <span className="text-green-700 dark:text-green-300 font-semibold">
                {comparison.improvements.shufflesReduced} fewer shuffles
              </span>
              <p className="text-green-800 dark:text-green-200 mt-1">
                Reduced expensive network operations significantly
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BeforeAfterComparison;

// Mock data generator
export const generateMockComparison = (): DAGComparison => {
  return {
    before: {
      nodes: 12,
      shuffles: 4,
      runtime: 900000, // 15 minutes
      cost: 12.5,
      dataProcessed: 536870912000, // 500GB
    },
    after: {
      nodes: 8,
      shuffles: 1,
      runtime: 180000, // 3 minutes
      cost: 2.5,
      dataProcessed: 107374182400, // 100GB
    },
    improvements: {
      nodesReduced: 33,
      shufflesReduced: 75,
      runtimeImprovement: 80,
      costSavings: 80,
      dataReduction: 80,
    },
  };
};

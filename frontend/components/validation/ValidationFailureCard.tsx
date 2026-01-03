// frontend/components/validation/ValidationFailureCard.tsx
// Failure explanation card with actionable guidance

import React, { useState } from 'react';
import { AlertTriangle, FileQuestion, Edit3, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { ValidationResult } from '../../store/useValidationStore';

interface ValidationFailureCardProps {
    result: ValidationResult;
    onEditInput: () => void;
}

const EXAMPLE_PLAN = `== Physical Plan ==
AdaptiveSparkPlan isFinalPlan=true
+- == Final Plan ==
   ResultQueryStage 1
   +- Project [user_id#12, sum(amount)#45 AS total_spend#99]
      +- HashAggregate(keys=[user_id#12], functions=[sum(amount#45)])
         +- Exchange hashpartitioning(user_id#12, 200), ENSURE_REQUIREMENTS
            +- HashAggregate(keys=[user_id#12], functions=[partial_sum(amount#45)])
               +- Project [user_id#12, amount#45]
                  +- Filter isnotnull(user_id#12)
                     +- FileScan parquet db.transactions[user_id#12, amount#45]
                        Batched: true
                        DataFilters: [isnotnull(user_id#12)]
                        Format: Parquet
                        Location: InMemoryFileIndex[s3://bucket/data/transactions]
                        PushedFilters: [IsNotNull(user_id)]
                        ReadSchema: struct<user_id:string,amount:double>`;

export const ValidationFailureCard: React.FC<ValidationFailureCardProps> = ({
    result,
    onEditInput,
}) => {
    const [showExample, setShowExample] = useState(false);

    // Determine the failure type for better messaging
    const getFailureType = () => {
        if (result.detected_plan_type === 'logical') {
            return {
                icon: <FileQuestion className="w-6 h-6" />,
                title: 'Logical Plan Detected',
                subtitle: 'We need a physical plan for performance analysis',
            };
        }
        if (result.detected_engine === 'unknown') {
            return {
                icon: <AlertTriangle className="w-6 h-6" />,
                title: 'Unrecognized Input',
                subtitle: 'This doesn\'t appear to be a Spark execution plan',
            };
        }
        return {
            icon: <AlertTriangle className="w-6 h-6" />,
            title: 'Invalid Plan Structure',
            subtitle: 'The plan may be incomplete or incorrectly formatted',
        };
    };

    const failureInfo = getFailureType();

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in zoom-in-95 duration-500">
            {/* Error Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm text-white">
                        {failureInfo.icon}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">{failureInfo.title}</h3>
                        <p className="text-amber-100 text-sm font-medium">
                            {failureInfo.subtitle}
                        </p>
                    </div>
                </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-6">
                {/* Explanation */}
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed font-medium">
                        {result.reason}
                    </p>
                </div>

                {/* Issues List */}
                {result.detected_issues && result.detected_issues.length > 0 && (
                    <div>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">
                            Issues Detected
                        </p>
                        <ul className="space-y-2">
                            {result.detected_issues.map((issue, idx) => (
                                <li
                                    key={idx}
                                    className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
                                >
                                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
                                    {issue}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Suggested Action */}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-2">
                        How to Fix
                    </p>
                    <p className="text-sm text-indigo-800 dark:text-indigo-200 leading-relaxed">
                        {result.suggested_user_action}
                    </p>
                </div>

                {/* Example Section */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <button
                        onClick={() => setShowExample(!showExample)}
                        className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                            <BookOpen className="w-4 h-4" />
                            View Example Physical Plan
                        </span>
                        {showExample ? (
                            <ChevronUp className="w-4 h-4 text-slate-500" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                        )}
                    </button>
                    {showExample && (
                        <div className="p-4 bg-slate-950 max-h-64 overflow-auto">
                            <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap">
                                {EXAMPLE_PLAN}
                            </pre>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <button
                    onClick={onEditInput}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                >
                    <Edit3 className="w-4 h-4" />
                    Edit Input
                </button>
            </div>
        </div>
    );
};

export default ValidationFailureCard;

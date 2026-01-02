// frontend/components/feedback/FeedbackModal.tsx
// Premium feedback modal with screenshot capture

import React, { useState, useRef } from 'react';
import {
    X,
    MessageSquarePlus,
    Send,
    Camera,
    Loader2,
    AlertCircle,
    CheckCircle,
    Bug,
    Lightbulb,
    HelpCircle,
    MoreHorizontal,
    ChevronDown,
} from 'lucide-react';
import { useFeedbackStore } from '../../store/useFeedbackStore';
import { feedbackApi, CreateFeedbackPayload } from '../../api/feedback';
import { apiClient } from '../../api/client';

type Severity = 'low' | 'medium' | 'high' | 'critical';
type Category = 'bug' | 'feature' | 'question' | 'other';

interface SeverityOption {
    value: Severity;
    label: string;
    color: string;
    bgColor: string;
}

interface CategoryOption {
    value: Category;
    label: string;
    icon: React.ReactNode;
}

const severityOptions: SeverityOption[] = [
    { value: 'low', label: 'Low', color: 'text-blue-500', bgColor: 'bg-blue-500/10 border-blue-500/30' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10 border-yellow-500/30' },
    { value: 'high', label: 'High', color: 'text-orange-500', bgColor: 'bg-orange-500/10 border-orange-500/30' },
    { value: 'critical', label: 'Critical', color: 'text-red-500', bgColor: 'bg-red-500/10 border-red-500/30' },
];

const categoryOptions: CategoryOption[] = [
    { value: 'bug', label: 'Bug Report', icon: <Bug className="w-4 h-4" /> },
    { value: 'feature', label: 'Feature Request', icon: <Lightbulb className="w-4 h-4" /> },
    { value: 'question', label: 'Question', icon: <HelpCircle className="w-4 h-4" /> },
    { value: 'other', label: 'Other', icon: <MoreHorizontal className="w-4 h-4" /> },
];

export const FeedbackModal: React.FC = () => {
    const { isModalOpen, closeModal, context } = useFeedbackStore();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [severity, setSeverity] = useState<Severity>('medium');
    const [category, setCategory] = useState<Category>('bug');
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const modalRef = useRef<HTMLDivElement>(null);

    // Pre-fill description with error context if available
    React.useEffect(() => {
        if (isModalOpen && context.errorMessage) {
            setDescription(`Error encountered: ${context.errorMessage}\n\n`);
            setCategory('bug');
            setSeverity('high');
        }
    }, [isModalOpen, context.errorMessage]);

    const handleCaptureScreenshot = async () => {
        setIsCapturing(true);
        try {
            // Temporarily hide the modal
            if (modalRef.current) {
                modalRef.current.style.visibility = 'hidden';
            }

            // Wait a moment for UI to update
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Dynamic import html2canvas
            const html2canvas = (await import('html2canvas')).default;

            const canvas = await html2canvas(document.body, {
                scale: 0.5, // Reduce size for faster upload
                useCORS: true,
                logging: false,
                backgroundColor: null,
            });

            const dataUrl = canvas.toDataURL('image/png');
            setScreenshot(dataUrl);
        } catch (error) {
            console.error('Failed to capture screenshot:', error);
            setErrorMessage('Failed to capture screenshot');
        } finally {
            // Restore modal visibility
            if (modalRef.current) {
                modalRef.current.style.visibility = 'visible';
            }
            setIsCapturing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !description.trim()) {
            setErrorMessage('Please fill in all required fields');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            const payload: CreateFeedbackPayload = {
                title: title.trim(),
                description: description.trim(),
                severity,
                category,
                pageUrl: context.pageUrl || window.location.href,
                userAgent: context.userAgent || navigator.userAgent,
                browserInfo: {
                    language: navigator.language,
                    platform: navigator.platform,
                    screenWidth: window.screen.width,
                    screenHeight: window.screen.height,
                    devicePixelRatio: window.devicePixelRatio,
                },
                appVersion: (window as any).__APP_VERSION__ || 'unknown',
                lastAction: context.lastAction,
                screenshot: screenshot || undefined,
            };

            await feedbackApi.createFeedback(payload);
            setSubmitStatus('success');

            // Reset form after short delay
            setTimeout(() => {
                handleClose();
            }, 2000);
        } catch (error) {
            setSubmitStatus('error');
            setErrorMessage(error instanceof Error ? error.message : 'Failed to submit feedback');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setTitle('');
        setDescription('');
        setSeverity('medium');
        setCategory('bug');
        setScreenshot(null);
        setSubmitStatus('idle');
        setErrorMessage('');
        closeModal();
    };

    if (!isModalOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div
                ref={modalRef}
                className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                <MessageSquarePlus className="w-5 h-5 text-orange-500 dark:text-orange-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                    Send Feedback
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Help us improve your experience
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Success State */}
                {submitStatus === 'success' ? (
                    <div className="p-12 text-center">
                        <div className="w-20 h-20 mx-auto bg-green-500/10 rounded-full flex items-center justify-center mb-6 relative">
                            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
                            <CheckCircle className="w-10 h-10 text-green-500 relative z-10" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                            Feedback Sent!
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400">
                            Thank you for contributing. We'll review this shortly.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Category Selection */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                Insight Category
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {categoryOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setCategory(option.value)}
                                        className="relative group p-[1px] rounded-xl overflow-hidden focus:outline-none"
                                    >
                                        <span className={`absolute inset-0 bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 transition-opacity duration-300 ${category === option.value ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`} />
                                        <span className={`relative flex items-center gap-3 px-4 py-3 rounded-[11px] w-full transition-colors duration-300 ${category === option.value ? 'bg-white dark:bg-slate-800/50' : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800'}`}>
                                            <span className={`${category === option.value ? 'text-orange-500 dark:text-orange-400' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'}`}>
                                                {option.icon}
                                            </span>
                                            <span className={`text-sm font-medium ${category === option.value ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'}`}>
                                                {option.label}
                                            </span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Title */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                Title <span className="text-orange-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Brief summary"
                                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all font-medium"
                                maxLength={200}
                                required
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                details <span className="text-orange-500">*</span>
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What happened? expecting vs actual..."
                                rows={4}
                                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all resize-none font-medium custom-scrollbar"
                                maxLength={5000}
                                required
                            />
                        </div>

                        <div className="flex gap-6">
                            {/* Severity */}
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                    Impact
                                </label>
                                <div className="relative">
                                    <select
                                        value={severity}
                                        onChange={(e) => setSeverity(e.target.value as Severity)}
                                        className="w-full appearance-none px-4 py-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all font-medium cursor-pointer"
                                    >
                                        {severityOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label} Priority
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                                </div>
                            </div>

                            {/* Screenshot Trigger */}
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                    Attachment
                                </label>
                                {screenshot ? (
                                    <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 h-[46px]">
                                        <img src={screenshot} alt="Preview" className="w-full h-full object-cover opacity-50 bg-slate-50 dark:bg-slate-950" />
                                        <div className="absolute inset-0 flex items-center justify-between px-3">
                                            <span className="text-xs text-slate-900 dark:text-white font-medium drop-shadow-md">Captured</span>
                                            <button
                                                type="button"
                                                onClick={() => setScreenshot(null)}
                                                className="p-1 bg-red-500/80 hover:bg-red-500 text-white rounded-md transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleCaptureScreenshot}
                                        disabled={isCapturing}
                                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-orange-500 dark:hover:text-white hover:border-orange-200 dark:hover:border-slate-700 transition-all group disabled:opacity-50"
                                    >
                                        <span className="text-sm font-medium">Add Screenshot</span>
                                        {isCapturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors" />}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Error Message */}
                        {errorMessage && (
                            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 dark:text-red-400 text-sm">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        {/* Submit Button - Sidebar Style */}
                        <button
                            type="submit"
                            disabled={isSubmitting || !title.trim() || !description.trim()}
                            className="w-full relative group overflow-hidden rounded-xl p-[1px] focus:outline-none focus:ring-2 focus:ring-orange-500/40 disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-lg shadow-orange-500/20"
                        >
                            <span className="absolute inset-0 bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 opacity-100 dark:opacity-80 dark:group-hover:opacity-100 transition-opacity duration-300"></span>
                            <span className="relative flex items-center justify-center gap-2 w-full bg-transparent dark:bg-slate-900 dark:group-hover:bg-slate-800/50 px-4 py-3.5 rounded-[11px] font-bold text-sm transition-colors duration-300">
                                {isSubmitting ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-white dark:text-orange-400" />
                                ) : (
                                    <Send className="w-5 h-5 group-hover:translate-x-0.5 transition-transform duration-300 text-white dark:text-orange-400" />
                                )}
                                <span className="text-white dark:bg-gradient-to-r dark:from-white dark:to-slate-200 dark:bg-clip-text dark:text-transparent">
                                    {isSubmitting ? 'Sending...' : 'Submit Feedback'}
                                </span>
                            </span>
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

// frontend/components/feedback/FeedbackButton.tsx
// Floating action button for opening feedback modal

import React from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { useFeedbackStore } from '../../store/useFeedbackStore';

export const FeedbackButton: React.FC = () => {
    const openModal = useFeedbackStore((state) => state.openModal);

    return (
        <button
            onClick={() => openModal()}
            className="fixed bottom-6 right-6 z-50 group"
            aria-label="Send feedback"
        >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 rounded-full blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-300" />

            {/* Gradient Border Container */}
            <div className="relative p-[1px] rounded-full overflow-hidden transition-transform duration-300 group-hover:scale-105">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 opacity-80 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Button Content */}
                <div className="relative flex items-center gap-2 px-5 py-3 bg-transparent dark:bg-slate-900 dark:group-hover:bg-slate-900/90 rounded-full transition-colors duration-300">
                    <MessageSquarePlus className="w-5 h-5 text-white dark:text-orange-400 transition-colors duration-300" />
                    <span className="text-sm font-bold text-white dark:bg-gradient-to-r dark:from-white dark:to-slate-200 dark:bg-clip-text dark:text-transparent hidden sm:inline">
                        Feedback
                    </span>
                </div>
            </div>
        </button>
    );
};

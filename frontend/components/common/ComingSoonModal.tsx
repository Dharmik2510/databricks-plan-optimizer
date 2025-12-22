import React from 'react';
import { X, Rocket, Bell } from 'lucide-react';

interface ComingSoonModalProps {
    isOpen: boolean;
    onClose: () => void;
    featureName?: string;
}

export const ComingSoonModal: React.FC<ComingSoonModalProps> = ({ isOpen, onClose, featureName = "This Feature" }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 relative"
            >
                {/* Decorative Background */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-10"></div>
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"></div>

                <div className="relative p-8 text-center">

                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-xl flex items-center justify-center mb-6 transform -rotate-3 border-4 border-white dark:border-slate-800">
                        <Rocket className="w-10 h-10 text-white" />
                    </div>

                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        Coming Soon!
                    </h3>

                    <p className="text-slate-600 dark:text-slate-400 font-medium mb-8">
                        The <span className="font-bold text-indigo-600 dark:text-indigo-400">{featureName}</span> module is currently under active development. Stay tuned for updates!
                    </p>

                    <div className="space-y-3">
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-opacity shadow-lg"
                        >
                            Got it
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

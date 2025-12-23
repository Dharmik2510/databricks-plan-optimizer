
import React from 'react';
import { X, Moon, Sun, Bell, Globe } from 'lucide-react';
import { useTheme } from '../../ThemeContext';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
    const { theme, toggleTheme } = useTheme();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">Settings</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
                </div>

                <div className="p-2">
                    <div className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors cursor-pointer" onClick={toggleTheme}>
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                            </div>
                            <div>
                                <div className="font-bold text-slate-900 dark:text-white">Appearance</div>
                                <div className="text-sm text-slate-500">Switch between light and dark mode</div>
                            </div>
                        </div>
                        <div className={`w-12 h-6 rounded-full p-1 transition-colors ${theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-200'} relative`}>
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                    </div>

                    <div className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors opacity-50 cursor-not-allowed">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                                <Bell className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-bold text-slate-900 dark:text-white">Notifications</div>
                                <div className="text-sm text-slate-500">Email and push alerts</div>
                            </div>
                        </div>
                        <div className="w-12 h-6 rounded-full bg-slate-200 p-1 relative"><div className="w-4 h-4 rounded-full bg-white shadow-sm translate-x-0"></div></div>
                    </div>

                    <div className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors opacity-50 cursor-not-allowed">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                <Globe className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-bold text-slate-900 dark:text-white">Language</div>
                                <div className="text-sm text-slate-500">Currently English (US) only</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};



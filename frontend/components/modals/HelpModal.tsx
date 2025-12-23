import React, { useState } from 'react';
import { X, HelpCircle, FileText, MessageCircle, ExternalLink, Mail, Book, ChevronDown, ChevronUp } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Tab = 'faq' | 'contact';

export const HelpModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<Tab>('faq');
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

    if (!isOpen) return null;

    const faqs = [
        {
            question: "How do I interpret the execution plan?",
            answer: "The execution plan visualizes the steps Spark takes to run your query. Each node represents an operation (like Scan, Filter, project). The edges show data flow. Look for red nodes which indicate potential bottlenecks."
        },
        {
            question: "How can I connect my repository?",
            answer: "Go to the 'New Analysis' page and enter your repository URL, branch, and access token. This allows the agent to map execution plan stages to your actual source code."
        },
        {
            question: "What does the 'Code Map' feature do?",
            answer: "Code Map correlates stages in the Spark execution plan with the specific lines of code in your repository that generated them, helping you pinpoint performance issues in your codebase."
        },
        {
            question: "Is my data secure?",
            answer: "Yes, we only analyze standard Spark execution plan logs. Your actual data is never accessed or stored. Repository access is read-only for analysis purposes."
        }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800 flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <HelpCircle className="w-6 h-6 text-orange-600" /> Help & Support
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="flex border-b border-slate-200 dark:border-slate-800">
                    <button
                        onClick={() => setActiveTab('faq')}
                        className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'faq' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50 dark:bg-orange-900/10' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <HelpCircle className="w-4 h-4" /> FAQ
                    </button>
                    <button
                        onClick={() => setActiveTab('contact')}
                        className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'contact' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50 dark:bg-orange-900/10' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <MessageCircle className="w-4 h-4" /> Contact
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {activeTab === 'faq' && (
                        <div className="space-y-4">
                            {faqs.map((faq, index) => (
                                <div key={index} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                    <button
                                        onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                                        className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                                    >
                                        <span className="font-medium text-slate-900 dark:text-white">{faq.question}</span>
                                        {openFaqIndex === index ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                    </button>
                                    {openFaqIndex === index && (
                                        <div className="p-4 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm leading-relaxed border-t border-slate-200 dark:border-slate-700">
                                            {faq.answer}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'contact' && (
                        <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
                            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                                <Mail className="w-8 h-8 text-orange-600" />
                            </div>
                            <div className="space-y-2 max-w-sm">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Get in Touch</h3>
                                <p className="text-slate-600 dark:text-slate-400">
                                    Have a complicated execution plan or need help optimizing your Spark jobs? We're here to help.
                                </p>
                            </div>
                            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                                <Mail className="w-5 h-5 text-slate-500" />
                                <span className="font-mono text-lg font-medium text-slate-900 dark:text-white select-all">
                                    brickoptima@gmail.com
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                We typically respond within 24 hours.
                            </p>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 text-center text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800">
                    Version {__APP_VERSION__}
                </div>
            </div>
        </div>
    );
};

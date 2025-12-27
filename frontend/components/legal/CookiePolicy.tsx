import React from 'react';
import { X } from 'lucide-react';

interface CookiePolicyProps {
    onClose: () => void;
    darkMode?: boolean;
}

export const CookiePolicy: React.FC<CookiePolicyProps> = ({ onClose, darkMode = true }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className={`w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden ${darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
                <div className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <h2 className="text-2xl font-bold">Cookie Policy</h2>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className={`p-6 overflow-y-auto max-h-[calc(90vh-80px)] ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    <p className="mb-4 text-sm text-slate-500">Last Updated: January 2025</p>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>1. What Are Cookies?</h3>
                        <p className="mb-4">
                            Cookies are small text files that are placed on your device when you visit our website. They help us provide you with a better experience by remembering your preferences and understanding how you use our service.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>2. How We Use Cookies</h3>
                        <p className="mb-4">BrickOptima uses cookies for the following purposes:</p>

                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>2.1 Essential Cookies</h4>
                        <p className="mb-4">
                            These cookies are necessary for the website to function properly. They enable core functionality such as:
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Authentication and account access</li>
                            <li>Security and fraud prevention</li>
                            <li>Session management</li>
                            <li>Load balancing</li>
                        </ul>

                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>2.2 Functional Cookies</h4>
                        <p className="mb-4">
                            These cookies enable enhanced functionality and personalization:
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Remembering your preferences (theme, language)</li>
                            <li>Storing your analysis history</li>
                            <li>Maintaining UI state between sessions</li>
                        </ul>

                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>2.3 Analytics Cookies</h4>
                        <p className="mb-4">
                            These cookies help us understand how visitors interact with our website:
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Pages visited and features used</li>
                            <li>Time spent on different sections</li>
                            <li>Error tracking and performance monitoring</li>
                            <li>User journey analysis</li>
                        </ul>

                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>2.4 Performance Cookies</h4>
                        <p className="mb-4">
                            These cookies help us improve the performance of our service:
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Identifying slow-loading pages</li>
                            <li>Testing new features with A/B testing</li>
                            <li>Optimizing content delivery</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>3. Third-Party Cookies</h3>
                        <p className="mb-4">
                            We may use third-party services that set their own cookies, including:
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Google Analytics for usage analytics</li>
                            <li>Authentication providers (Google, GitHub)</li>
                            <li>Cloud infrastructure providers</li>
                            <li>Customer support tools</li>
                        </ul>
                        <p className="mb-4">
                            These third parties have their own privacy policies and cookie practices.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>4. Cookie Duration</h3>
                        <p className="mb-4">We use both session and persistent cookies:</p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li><strong>Session Cookies:</strong> Deleted when you close your browser</li>
                            <li><strong>Persistent Cookies:</strong> Remain on your device for a set period or until manually deleted</li>
                        </ul>
                        <p className="mb-4">
                            Most of our cookies expire within 30 days to 1 year, except for essential authentication cookies which may last longer for your convenience.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>5. Managing Cookies</h3>
                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>5.1 Browser Controls</h4>
                        <p className="mb-4">
                            Most web browsers allow you to control cookies through their settings. You can:
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>View and delete existing cookies</li>
                            <li>Block all cookies</li>
                            <li>Block third-party cookies only</li>
                            <li>Clear cookies when you close the browser</li>
                        </ul>

                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>5.2 Impact of Blocking Cookies</h4>
                        <p className="mb-4">
                            Please note that blocking or deleting cookies may impact your ability to use BrickOptima. Essential features may not function properly if you disable necessary cookies.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>6. Local Storage and Similar Technologies</h3>
                        <p className="mb-4">
                            In addition to cookies, we may use similar technologies such as:
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li><strong>Local Storage:</strong> For storing larger amounts of data locally (e.g., cached analysis results)</li>
                            <li><strong>Session Storage:</strong> For temporary data during your browsing session</li>
                            <li><strong>IndexedDB:</strong> For storing structured data for offline functionality</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>7. Updates to This Policy</h3>
                        <p className="mb-4">
                            We may update this Cookie Policy from time to time to reflect changes in our practices or for legal reasons. We will notify you of significant changes by posting a notice on our website.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>8. Specific Cookie List</h3>
                        <div className={`overflow-x-auto rounded-lg border ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                            <table className="w-full text-sm">
                                <thead className={darkMode ? 'bg-slate-800' : 'bg-slate-100'}>
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold">Cookie Name</th>
                                        <th className="px-4 py-3 text-left font-semibold">Purpose</th>
                                        <th className="px-4 py-3 text-left font-semibold">Duration</th>
                                        <th className="px-4 py-3 text-left font-semibold">Type</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className={darkMode ? 'border-t border-slate-800' : 'border-t border-slate-200'}>
                                        <td className="px-4 py-3">auth_token</td>
                                        <td className="px-4 py-3">User authentication</td>
                                        <td className="px-4 py-3">30 days</td>
                                        <td className="px-4 py-3">Essential</td>
                                    </tr>
                                    <tr className={darkMode ? 'border-t border-slate-800' : 'border-t border-slate-200'}>
                                        <td className="px-4 py-3">session_id</td>
                                        <td className="px-4 py-3">Session management</td>
                                        <td className="px-4 py-3">Session</td>
                                        <td className="px-4 py-3">Essential</td>
                                    </tr>
                                    <tr className={darkMode ? 'border-t border-slate-800' : 'border-t border-slate-200'}>
                                        <td className="px-4 py-3">theme_preference</td>
                                        <td className="px-4 py-3">UI theme (dark/light mode)</td>
                                        <td className="px-4 py-3">1 year</td>
                                        <td className="px-4 py-3">Functional</td>
                                    </tr>
                                    <tr className={darkMode ? 'border-t border-slate-800' : 'border-t border-slate-200'}>
                                        <td className="px-4 py-3">_ga</td>
                                        <td className="px-4 py-3">Google Analytics</td>
                                        <td className="px-4 py-3">2 years</td>
                                        <td className="px-4 py-3">Analytics</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>9. Contact Us</h3>
                        <p className="mb-4">
                            If you have questions about our use of cookies, please contact us at:
                        </p>
                        <p className="mb-2">
                            Email:{' '}
                            <a href="mailto:brickoptima@gmail.com" className="text-orange-500 hover:text-orange-400">
                                brickoptima@gmail.com
                            </a>
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
};

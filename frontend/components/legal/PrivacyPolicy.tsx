import React from 'react';
import { X } from 'lucide-react';

interface PrivacyPolicyProps {
    onClose: () => void;
    darkMode?: boolean;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onClose, darkMode = true }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className={`w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden ${darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
                <div className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <h2 className="text-2xl font-bold">Privacy Policy</h2>
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
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>1. Introduction</h3>
                        <p className="mb-4">
                            BrickOptima ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Databricks optimization platform.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>2. Information We Collect</h3>
                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>2.1 Information You Provide</h4>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Account information (name, email address)</li>
                            <li>Databricks workspace credentials and configuration</li>
                            <li>GitHub repository access tokens (if you choose to connect)</li>
                            <li>Spark event logs and execution plans</li>
                        </ul>

                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>2.2 Automatically Collected Information</h4>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Usage data and analytics</li>
                            <li>Device and browser information</li>
                            <li>IP address and location data</li>
                            <li>Cookies and similar tracking technologies</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>3. How We Use Your Information</h3>
                        <p className="mb-4">We use your information to:</p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Provide and maintain our optimization services</li>
                            <li>Analyze your Spark execution plans and generate recommendations</li>
                            <li>Improve and personalize your experience</li>
                            <li>Communicate with you about updates, security alerts, and support</li>
                            <li>Monitor and prevent security threats</li>
                            <li>Comply with legal obligations</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>4. Data Security</h3>
                        <p className="mb-4">
                            We implement industry-standard security measures to protect your data:
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>All data transmission is encrypted using TLS 1.3</li>
                            <li>Data at rest is encrypted using AES-256</li>
                            <li>We are SOC2 Type II compliant</li>
                            <li>Your actual datasets never leave your VPC - we only analyze execution metadata</li>
                            <li>Access controls and authentication via OAuth 2.0</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>5. Data Sharing and Disclosure</h3>
                        <p className="mb-4">We do not sell your personal information. We may share your data with:</p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Service providers who assist in our operations (cloud infrastructure, analytics)</li>
                            <li>Law enforcement when required by law</li>
                            <li>In connection with a merger, acquisition, or sale of assets</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>6. Your Rights</h3>
                        <p className="mb-4">You have the right to:</p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Access and receive a copy of your personal data</li>
                            <li>Request correction of inaccurate data</li>
                            <li>Request deletion of your data</li>
                            <li>Object to or restrict certain processing</li>
                            <li>Data portability</li>
                            <li>Withdraw consent at any time</li>
                        </ul>
                        <p className="mb-4">
                            To exercise these rights, contact us at{' '}
                            <a href="mailto:brickoptima@gmail.com" className="text-orange-500 hover:text-orange-400">
                                brickoptima@gmail.com
                            </a>
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>7. Data Retention</h3>
                        <p className="mb-4">
                            We retain your information for as long as necessary to provide our services and comply with legal obligations. Event logs and analysis results are typically retained for 90 days unless you request earlier deletion.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>8. International Data Transfers</h3>
                        <p className="mb-4">
                            Your data may be processed in the United States or other countries where we or our service providers operate. We ensure appropriate safeguards are in place for such transfers.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>9. Changes to This Policy</h3>
                        <p className="mb-4">
                            We may update this Privacy Policy from time to time. We will notify you of material changes via email or through the platform.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>10. Contact Us</h3>
                        <p className="mb-4">
                            If you have questions about this Privacy Policy, please contact us at:
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

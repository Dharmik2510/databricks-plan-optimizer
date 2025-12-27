import React from 'react';
import { X } from 'lucide-react';

interface TermsOfServiceProps {
    onClose: () => void;
    darkMode?: boolean;
}

export const TermsOfService: React.FC<TermsOfServiceProps> = ({ onClose, darkMode = true }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className={`w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden ${darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
                <div className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <h2 className="text-2xl font-bold">Terms of Service</h2>
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
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>1. Acceptance of Terms</h3>
                        <p className="mb-4">
                            By accessing or using BrickOptima's services, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any part of these terms, you may not use our services.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>2. Description of Service</h3>
                        <p className="mb-4">
                            BrickOptima provides AI-powered optimization analysis for Apache Spark and Databricks workloads. Our service includes:
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>DAG visualization and bottleneck identification</li>
                            <li>AI-generated optimization recommendations</li>
                            <li>Code mapping to GitHub repositories</li>
                            <li>Performance analytics and cost estimation</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>3. User Accounts</h3>
                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>3.1 Account Creation</h4>
                        <p className="mb-4">
                            You must create an account to use BrickOptima. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate and current.
                        </p>

                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>3.2 Account Security</h4>
                        <p className="mb-4">
                            You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Notify us immediately of any unauthorized use.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>4. Acceptable Use</h3>
                        <p className="mb-4">You agree not to:</p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Use the service for any illegal purpose or in violation of any laws</li>
                            <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
                            <li>Interfere with or disrupt the service or servers</li>
                            <li>Upload malicious code, viruses, or harmful content</li>
                            <li>Reverse engineer, decompile, or disassemble any part of the service</li>
                            <li>Use the service to compete with BrickOptima</li>
                            <li>Share your account credentials with others</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>5. Intellectual Property</h3>
                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>5.1 Our Rights</h4>
                        <p className="mb-4">
                            All rights, title, and interest in and to the BrickOptima platform, including all intellectual property rights, are owned by BrickOptima. You are granted a limited, non-exclusive, non-transferable license to use the service.
                        </p>

                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>5.2 Your Content</h4>
                        <p className="mb-4">
                            You retain all rights to your data and code. By using our service, you grant us a limited license to process your execution logs and code solely to provide our optimization services.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>6. Payment and Billing</h3>
                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>6.1 Subscription Fees</h4>
                        <p className="mb-4">
                            Certain features require a paid subscription. Fees are billed in advance on a recurring basis. You authorize us to charge your payment method for all fees incurred.
                        </p>

                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>6.2 Cancellation and Refunds</h4>
                        <p className="mb-4">
                            You may cancel your subscription at any time. Cancellations take effect at the end of the current billing period. We do not provide refunds for partial months or unused time, except as required by law.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>7. Service Availability</h3>
                        <p className="mb-4">
                            We strive to maintain high availability but do not guarantee uninterrupted service. We may modify, suspend, or discontinue any part of the service at any time with reasonable notice.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>8. Disclaimer of Warranties</h3>
                        <p className="mb-4">
                            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                        </p>
                        <p className="mb-4">
                            Our optimization recommendations are suggestions based on analysis. We do not guarantee specific performance improvements or cost savings.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>9. Limitation of Liability</h3>
                        <p className="mb-4">
                            TO THE MAXIMUM EXTENT PERMITTED BY LAW, BRICKOPTIMA SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES.
                        </p>
                        <p className="mb-4">
                            Our total liability for all claims shall not exceed the amount you paid us in the 12 months preceding the claim.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>10. Indemnification</h3>
                        <p className="mb-4">
                            You agree to indemnify and hold harmless BrickOptima from any claims, damages, losses, liabilities, and expenses arising from your use of the service or violation of these terms.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>11. Termination</h3>
                        <p className="mb-4">
                            We may terminate or suspend your access immediately, without prior notice, for any reason, including breach of these terms. Upon termination, your right to use the service will cease immediately.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>12. Changes to Terms</h3>
                        <p className="mb-4">
                            We reserve the right to modify these terms at any time. We will provide notice of material changes. Continued use after changes constitutes acceptance of the new terms.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>13. Governing Law</h3>
                        <p className="mb-4">
                            These terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law provisions.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>14. Contact Information</h3>
                        <p className="mb-4">
                            For questions about these Terms of Service, contact us at:
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

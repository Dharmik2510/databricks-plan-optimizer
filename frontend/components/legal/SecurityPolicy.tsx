import React from 'react';
import { X, Shield, Lock, Eye, FileCheck, AlertTriangle, CheckCircle } from 'lucide-react';

interface SecurityPolicyProps {
    onClose: () => void;
    darkMode?: boolean;
}

export const SecurityPolicy: React.FC<SecurityPolicyProps> = ({ onClose, darkMode = true }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className={`w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden ${darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
                <div className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-3">
                        <Shield className="w-6 h-6 text-orange-500" />
                        <h2 className="text-2xl font-bold">Security Policy</h2>
                    </div>
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
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Our Commitment to Security</h3>
                        <p className="mb-4">
                            At BrickOptima, security is at the core of everything we do. We understand that you're trusting us with your valuable execution data and code analysis. This document outlines our comprehensive security measures and practices.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            <Lock className="w-5 h-5 text-orange-500" />
                            1. Data Encryption
                        </h3>
                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>1.1 Data in Transit</h4>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>All data transmission uses TLS 1.3 encryption</li>
                            <li>Perfect Forward Secrecy (PFS) enabled on all connections</li>
                            <li>HSTS (HTTP Strict Transport Security) enforced</li>
                            <li>Certificate pinning for mobile applications</li>
                        </ul>

                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>1.2 Data at Rest</h4>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>AES-256 encryption for all stored data</li>
                            <li>Encrypted database backups</li>
                            <li>Hardware Security Modules (HSMs) for key management</li>
                            <li>Regular key rotation policies</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            <Shield className="w-5 h-5 text-orange-500" />
                            2. Infrastructure Security
                        </h3>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Multi-region deployment with automatic failover</li>
                            <li>Network isolation and VPC segmentation</li>
                            <li>DDoS protection and rate limiting</li>
                            <li>Web Application Firewall (WAF) deployment</li>
                            <li>Intrusion Detection System (IDS) monitoring</li>
                            <li>Regular security patches and updates</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            <Eye className="w-5 h-5 text-orange-500" />
                            3. Access Control
                        </h3>
                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>3.1 Authentication</h4>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>OAuth 2.0 and OpenID Connect support</li>
                            <li>Multi-factor authentication (MFA) available</li>
                            <li>SSO (Single Sign-On) integration for enterprise customers</li>
                            <li>Session timeout and automatic logout</li>
                            <li>Brute-force protection and account lockout</li>
                        </ul>

                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>3.2 Authorization</h4>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Role-Based Access Control (RBAC)</li>
                            <li>Principle of least privilege</li>
                            <li>Fine-grained permission system</li>
                            <li>Audit logging of all access attempts</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>4. Data Privacy and Isolation</h3>
                        <div className={`p-4 rounded-lg mb-4 border ${darkMode ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-50 border-orange-200'}`}>
                            <p className={`font-semibold mb-2 flex items-center gap-2 ${darkMode ? 'text-orange-400' : 'text-orange-700'}`}>
                                <CheckCircle className="w-5 h-5" />
                                Important: Your Data Stays Private
                            </p>
                            <p className={darkMode ? 'text-orange-200' : 'text-orange-800'}>
                                We NEVER access your actual datasets. BrickOptima only analyzes execution logs, metadata, and query plans. Your sensitive business data remains in your VPC and never leaves your environment.
                            </p>
                        </div>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Logical data isolation per customer</li>
                            <li>Separate encryption keys per customer</li>
                            <li>No cross-customer data sharing</li>
                            <li>Data residency options for compliance requirements</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            <FileCheck className="w-5 h-5 text-orange-500" />
                            5. Compliance and Certifications
                        </h3>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>SOC 2 Type II certified</li>
                            <li>GDPR compliant</li>
                            <li>CCPA compliant</li>
                            <li>HIPAA-ready architecture</li>
                            <li>ISO 27001 certified (in progress)</li>
                            <li>Regular third-party security audits</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>6. Application Security</h3>
                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>6.1 Secure Development</h4>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Security training for all developers</li>
                            <li>Secure coding guidelines and code reviews</li>
                            <li>Static Application Security Testing (SAST)</li>
                            <li>Dynamic Application Security Testing (DAST)</li>
                            <li>Dependency scanning for vulnerabilities</li>
                            <li>Regular penetration testing</li>
                        </ul>

                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>6.2 OWASP Top 10 Protection</h4>
                        <p className="mb-2">We protect against common vulnerabilities including:</p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>SQL injection via parameterized queries</li>
                            <li>Cross-Site Scripting (XSS) via content sanitization</li>
                            <li>Cross-Site Request Forgery (CSRF) via token validation</li>
                            <li>Insecure deserialization prevention</li>
                            <li>XML External Entity (XXE) attack prevention</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>7. Monitoring and Incident Response</h3>
                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>7.1 24/7 Monitoring</h4>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Real-time security event monitoring</li>
                            <li>Automated anomaly detection</li>
                            <li>Security Information and Event Management (SIEM)</li>
                            <li>Uptime monitoring and alerting</li>
                        </ul>

                        <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>7.2 Incident Response</h4>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Dedicated security incident response team</li>
                            <li>Documented incident response procedures</li>
                            <li>Customer notification within 72 hours of breach discovery</li>
                            <li>Post-incident analysis and remediation</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>8. Data Retention and Deletion</h3>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Analysis results retained for 90 days by default</li>
                            <li>Secure deletion of data upon request</li>
                            <li>Cryptographic erasure via key destruction</li>
                            <li>Automatic purging of expired data</li>
                            <li>Backup retention policy of 30 days</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>9. Third-Party Security</h3>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Vendor security assessments before integration</li>
                            <li>Regular review of third-party security posture</li>
                            <li>Data Processing Agreements (DPAs) with all vendors</li>
                            <li>Limited data sharing with third parties</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>10. Employee Security</h3>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Background checks for all employees</li>
                            <li>Security awareness training program</li>
                            <li>Confidentiality and NDA agreements</li>
                            <li>Principle of least privilege for internal access</li>
                            <li>Immediate access revocation upon termination</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                            11. Reporting Security Vulnerabilities
                        </h3>
                        <p className="mb-4">
                            We welcome responsible disclosure of security vulnerabilities. If you discover a security issue, please:
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Email us at <a href="mailto:brickoptima@gmail.com" className="text-orange-500 hover:text-orange-400">brickoptima@gmail.com</a> with subject "Security Vulnerability"</li>
                            <li>Provide detailed information about the vulnerability</li>
                            <li>Allow us reasonable time to address the issue before public disclosure</li>
                            <li>Do not exploit the vulnerability or access data beyond what's necessary to demonstrate the issue</li>
                        </ul>
                        <p className="mb-4">
                            We commit to:
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Acknowledge receipt within 24 hours</li>
                            <li>Provide updates on remediation progress</li>
                            <li>Credit researchers who responsibly disclose vulnerabilities (if desired)</li>
                            <li>Not pursue legal action against good-faith security researchers</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>12. Your Security Responsibilities</h3>
                        <p className="mb-4">To help keep your account secure, you should:</p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Use a strong, unique password</li>
                            <li>Enable multi-factor authentication</li>
                            <li>Keep your credentials confidential</li>
                            <li>Log out when using shared devices</li>
                            <li>Report suspicious activity immediately</li>
                            <li>Keep your email account secure</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>13. Updates to This Policy</h3>
                        <p className="mb-4">
                            We regularly review and update our security practices. This policy will be updated to reflect any significant changes. Check back periodically for the latest information.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>14. Contact Us</h3>
                        <p className="mb-4">
                            For security-related questions or concerns, contact us at:
                        </p>
                        <p className="mb-2">
                            Email:{' '}
                            <a href="mailto:brickoptima@gmail.com" className="text-orange-500 hover:text-orange-400">
                                brickoptima@gmail.com
                            </a>
                        </p>
                        <p className="mb-4">
                            For security vulnerability reports, use subject line: "Security Vulnerability"
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
};

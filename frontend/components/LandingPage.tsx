import React, { useState, useEffect } from 'react';
import {
    Activity,
    ArrowRight,
    PlayCircle,
    Check,
    Zap,
    Shield,
    Sparkles,
    BarChart,
    Code,
    Database,
    Menu,
    X,
    Moon,
    Sun,
    Heart
} from 'lucide-react';
import { ThreeBackground } from './ThreeBackground';
import { PrivacyPolicy } from './legal/PrivacyPolicy';
import { TermsOfService } from './legal/TermsOfService';
import { CookiePolicy } from './legal/CookiePolicy';
import { SecurityPolicy } from './legal/SecurityPolicy';

interface LandingPageProps {
    onLoginClick: () => void;
    onGetStartedClick: () => void;
    darkMode?: boolean;
    toggleTheme?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
    onLoginClick,
    onGetStartedClick,
    darkMode = true,
    toggleTheme
}) => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeLegalModal, setActiveLegalModal] = useState<'privacy' | 'terms' | 'cookie' | 'security' | null>(null);

    // Handle scroll effect for navbar
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const features = [
        {
            icon: Zap,
            title: 'Real-time Analysis',
            desc: 'Visualize your DAGs as they execute. Identify bottlenecks instantly with intuitive color-coded nodes.'
        },
        {
            icon: Sparkles,
            title: 'AI Recommendations',
            desc: 'Get actionable insights to optimize partitions, join strategies, and instance types automatically.'
        },
        {
            icon: Code,
            title: 'Code Mapping',
            desc: 'Trace expensive stages directly back to your source code lines in GitHub. Fix issues at the root.'
        },
        {
            icon: Shield,
            title: 'Secure & Private',
            desc: 'Your data stays in your VPC. We only analyze execution plans and logs, never your actual dataset.'
        }
    ];

    return (
        <div className={`min-h-screen font-sans selection:bg-orange-500/30 ${darkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>

            {/* Background Effect */}
            {darkMode && (
                <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
                    <ThreeBackground showGrids={false} />
                </div>
            )}

            {/* Navbar */}
            <nav
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${scrolled
                    ? (darkMode ? 'bg-slate-900/80 border-slate-800 backdrop-blur-md py-4' : 'bg-white/80 border-slate-200 backdrop-blur-md py-4')
                    : 'bg-transparent border-transparent py-6'
                    }`}
            >
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/50 ring-2 ring-orange-500/20">
                            <Activity className="w-6 h-6 text-white" />
                        </div>
                        <span className={`text-xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            BrickOptima
                        </span>
                    </div>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center gap-8">
                        {['Features', 'How it Works'].map((item) => (
                            <a
                                key={item}
                                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                                className={`text-sm font-medium transition-colors ${darkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                {item}
                            </a>
                        ))}
                    </div>

                    <div className="hidden md:flex items-center gap-4">
                        {toggleTheme && (
                            <button
                                onClick={toggleTheme}
                                className={`p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'
                                    }`}
                            >
                                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                            </button>
                        )}
                        <button
                            onClick={onLoginClick}
                            className={`text-sm font-semibold transition-colors ${darkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={onGetStartedClick}
                            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 hover:-translate-y-0.5"
                        >
                            Get Started
                        </button>
                    </div>

                    {/* Mobile Menu Toggle */}
                    <div className="md:hidden flex items-center gap-4">
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className={darkMode ? 'text-white' : 'text-slate-900'}
                        >
                            {mobileMenuOpen ? <X /> : <Menu />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className={`md:hidden absolute top-full left-0 right-0 border-b p-6 flex flex-col gap-4 shadow-xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                        }`}>
                        <a
                            href="#features"
                            onClick={() => setMobileMenuOpen(false)}
                            className={`text-base font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}
                        >
                            Features
                        </a>
                        <a
                            href="#how-it-works"
                            onClick={() => setMobileMenuOpen(false)}
                            className={`text-base font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}
                        >
                            How it Works
                        </a>
                        <div className="h-px bg-slate-200 dark:bg-slate-800 my-2" />
                        <button
                            onClick={() => {
                                setMobileMenuOpen(false);
                                onLoginClick();
                            }}
                            className="w-full py-3 text-center font-semibold border border-slate-200 dark:border-slate-700 rounded-lg"
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => {
                                setMobileMenuOpen(false);
                                onGetStartedClick();
                            }}
                            className="w-full py-3 bg-orange-600 text-white font-semibold rounded-lg"
                        >
                            Get Started Free
                        </button>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-bold uppercase tracking-wider mb-8 animate-fade-in">
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                        New: GitHub Integration
                    </div>

                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight animate-fade-in-up">
                        Optimize Your <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500">
                            Databricks Workflows
                        </span>
                    </h1>

                    <p className={`text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-in-up delay-100 ${darkMode ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                        Stop guessing why your Spark jobs are slow. Get AI-powered recommendations,
                        visualize DAG bottlenecks, and cut compute costs by up to 40%.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-200">
                        <button
                            onClick={onGetStartedClick}
                            className="w-full sm:w-auto px-8 py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-all shadow-xl shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-1 flex items-center justify-center gap-2"
                        >
                            Get Started Free
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <button
                            className={`w-full sm:w-auto px-8 py-4 font-bold rounded-xl transition-all border flex items-center justify-center gap-2 ${darkMode
                                ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                        >
                            <PlayCircle className="w-5 h-5" />
                            Watch Demo
                        </button>
                    </div>

                    <div className={`mt-12 flex items-center justify-center gap-3 text-sm font-medium animate-fade-in delay-300 ${darkMode ? 'text-slate-500' : 'text-slate-500'
                        }`}>
                        <Shield className="w-4 h-4" />
                        <span className="mr-4">No credit card required</span>
                        <Check className="w-4 h-4" />
                        <span>SOC2 Compliant</span>
                    </div>
                </div>
            </section>

            {/* Social Proof */}
            <section className={`py-12 border-y ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <p className={`text-sm font-semibold uppercase tracking-wider mb-8 ${darkMode ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                        Trusted by data teams at innovative companies
                    </p>
                    <div className="flex flex-wrap justify-center items-center gap-12 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                        {/* Simple Text/Icon Placeholders for Brands - In real app use SVGs */}
                        <div className="flex items-center gap-2 text-xl font-bold"><Database className="w-6 h-6" /> Databricks</div>
                        <div className="flex items-center gap-2 text-xl font-bold"><Activity className="w-6 h-6" /> Spark</div>
                        <div className="flex items-center gap-2 text-xl font-bold"><Code className="w-6 h-6" /> GitHub</div>
                        <div className="flex items-center gap-2 text-xl font-bold"><BarChart className="w-6 h-6" /> Tableau</div>
                    </div>
                </div>
            </section>

            {/* Feature Grid */}
            <section id="features" className="py-24 px-6 relative z-10">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {features.map((feature, idx) => (
                            <div
                                key={idx}
                                className={`p-8 rounded-2xl border transition-all duration-300 hover:-translate-y-1 ${darkMode
                                    ? 'bg-slate-900/50 border-slate-800 hover:border-orange-500/30 hover:bg-slate-800'
                                    : 'bg-white border-slate-200 hover:border-orange-500/30 hover:shadow-xl'
                                    }`}
                            >
                                <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-6">
                                    <feature.icon className="w-6 h-6 text-orange-500" />
                                </div>
                                <h3 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{feature.title}</h3>
                                <p className={`leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it Works Section */}
            <section id="how-it-works" className={`py-24 px-6 relative z-10 ${darkMode ? 'bg-slate-900/30' : 'bg-slate-50'}`}>
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>How BrickOptima Works</h2>
                        <p className={`text-lg max-w-2xl mx-auto ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            Turn your execution logs into actionable insights in three simple steps.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { step: '01', title: 'Connect Logs', desc: 'Securely upload your Spark event logs or connect your Databricks workspace.' },
                            { step: '02', title: 'AI Analysis', desc: 'Our engine reconstructs the DAG and identifies inefficient scan, join, and shuffle operations.' },
                            { step: '03', title: 'Optimize', desc: 'Apply generated code fixes and config tuning to reduce runtime and cost.' }
                        ].map((item, idx) => (
                            <div key={idx} className="relative group">
                                <div className={`text-8xl font-bold absolute -top-10 -left-6 z-0 opacity-10 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                    {item.step}
                                </div>
                                <div className={`relative z-10 p-8 rounded-2xl border h-full transition-all ${darkMode ? 'bg-slate-800/50 border-slate-700 hover:border-orange-500/50' : 'bg-white border-slate-200 hover:border-orange-500/50'
                                    }`}>
                                    <h3 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{item.title}</h3>
                                    <p className={darkMode ? 'text-slate-400' : 'text-slate-600'}>{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>



            {/* Footer */}
            <footer className={`relative z-10 pt-20 pb-10 px-6 border-t ${darkMode ? 'bg-slate-950 border-slate-900' : 'bg-slate-50 border-slate-200'}`}>
                <div className="max-w-7xl mx-auto">

                    {/* Top CTA */}
                    <div className="flex justify-center mb-16">
                        <a
                            href="mailto:brickoptima@gmail.com"
                            className="flex items-center gap-2 text-orange-500 font-semibold hover:text-orange-400 transition-colors group"
                        >
                            Get Help & Support
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16 border-b border-slate-800/50 pb-12">
                        {/* Brand Column */}
                        <div className="col-span-1 md:col-span-2">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                                    <Activity className="w-5 h-5 text-white" />
                                </div>
                                <span className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                    BrickOptima
                                </span>
                            </div>
                            <p className={`mb-6 max-w-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                Your AI-Powered Optimization Engine for Databricks. Cut costs and accelerate pipelines with ease.
                            </p>
                        </div>

                        {/* Quick Links */}
                        <div>
                            <h4 className={`font-bold mb-6 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Quick Links</h4>
                            <ul className="space-y-4">
                                <li>
                                    <a href="#features" className={`block text-sm transition-colors cursor-pointer hover:underline ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                                        Features
                                    </a>
                                </li>
                                <li>
                                    <a href="#how-it-works" className={`block text-sm transition-colors cursor-pointer hover:underline ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                                        How it Works
                                    </a>
                                </li>
                                <li>
                                    <button onClick={onLoginClick} className={`block text-sm text-left transition-colors cursor-pointer hover:underline ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                                        Login
                                    </button>
                                </li>
                            </ul>
                        </div>

                        {/* Legal */}
                        <div>
                            <h4 className={`font-bold mb-6 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Legal</h4>
                            <ul className="space-y-4">
                                <li>
                                    <button onClick={() => setActiveLegalModal('privacy')} className={`block w-full text-sm text-left transition-colors cursor-pointer hover:underline ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                                        Privacy Policy
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => setActiveLegalModal('terms')} className={`block w-full text-sm text-left transition-colors cursor-pointer hover:underline ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                                        Terms of Service
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => setActiveLegalModal('cookie')} className={`block w-full text-sm text-left transition-colors cursor-pointer hover:underline ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                                        Cookie Policy
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => setActiveLegalModal('security')} className={`block w-full text-sm text-left transition-colors cursor-pointer hover:underline ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                                        Security
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Bottom Bar */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
                        <div className={darkMode ? 'text-slate-500' : 'text-slate-400'}>
                            © 2025 BrickOptima. All rights reserved.
                        </div>
                        <div className={`flex items-center gap-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            <span>Made with</span>
                            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                            <span>for data teams worldwide</span>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Legal Modals */}
            {activeLegalModal === 'privacy' && <PrivacyPolicy onClose={() => setActiveLegalModal(null)} darkMode={darkMode} />}
            {activeLegalModal === 'terms' && <TermsOfService onClose={() => setActiveLegalModal(null)} darkMode={darkMode} />}
            {activeLegalModal === 'cookie' && <CookiePolicy onClose={() => setActiveLegalModal(null)} darkMode={darkMode} />}
            {activeLegalModal === 'security' && <SecurityPolicy onClose={() => setActiveLegalModal(null)} darkMode={darkMode} />}
        </div>
    );
};

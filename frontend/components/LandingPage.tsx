import React, { useState, useEffect, useRef } from 'react';
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
    Heart,
    Linkedin,
} from 'lucide-react';
import {
    motion,
    useInView,
    useScroll,
    useTransform,
    AnimatePresence,
    type Transition,
} from 'framer-motion';
import { AnalysisShowcase } from './AnalysisShowcase';
import { CanvasBackground } from './CanvasBackground';
import { CustomCursor } from './CustomCursor';
import { PrivacyPolicy } from './legal/PrivacyPolicy';
import { TermsOfService } from './legal/TermsOfService';
import { CookiePolicy } from './legal/CookiePolicy';
import { SecurityPolicy } from './legal/SecurityPolicy';

// ─── Animation Variants ───────────────────────────────────────────────────────
const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0 },
};
const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
};
const staggerContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};
const springTransition: Transition = { type: 'spring', stiffness: 200, damping: 20 };

// ─── Animated Counter ─────────────────────────────────────────────────────────
function AnimatedCounter({ to, suffix = '' }: { to: number; suffix?: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true, margin: '-60px' });
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!inView) return;
        let start = 0;
        const duration = 1400;
        const step = 16;
        const increment = to / (duration / step);
        const timer = setInterval(() => {
            start += increment;
            if (start >= to) {
                setCount(to);
                clearInterval(timer);
            } else {
                setCount(Math.floor(start));
            }
        }, step);
        return () => clearInterval(timer);
    }, [inView, to]);

    return <span ref={ref}>{count}{suffix}</span>;
}

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

    const heroRef = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
    const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '20%']);
    const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const features = [
        {
            icon: Zap,
            title: 'Real-time Analysis',
            desc: 'Visualize your DAGs as they execute. Identify bottlenecks instantly with intuitive color-coded nodes.',
            color: 'from-yellow-500 to-orange-500',
            glow: 'shadow-yellow-500/20',
        },
        {
            icon: Sparkles,
            title: 'AI Recommendations',
            desc: 'Get actionable insights to optimize partitions, join strategies, and instance types automatically.',
            color: 'from-purple-500 to-pink-500',
            glow: 'shadow-purple-500/20',
        },
        {
            icon: Code,
            title: 'Code Mapping',
            desc: 'Trace expensive stages directly back to your source code lines in GitHub. Fix issues at the root.',
            color: 'from-cyan-500 to-blue-500',
            glow: 'shadow-cyan-500/20',
        },
        {
            icon: Shield,
            title: 'Secure & Private',
            desc: 'Your data stays in your VPC. We only analyze execution plans and logs, never your actual dataset.',
            color: 'from-green-500 to-emerald-500',
            glow: 'shadow-green-500/20',
        },
    ];

    const logoItems = [
        { icon: Database, label: 'Databricks' },
        { icon: Activity, label: 'Spark' },
        { icon: Code, label: 'GitHub' },
        { icon: BarChart, label: 'Tableau' },
        { icon: Database, label: 'Databricks' },
        { icon: Activity, label: 'Spark' },
        { icon: Code, label: 'GitHub' },
        { icon: BarChart, label: 'Tableau' },
    ];

    return (
        <div className={`min-h-screen font-sans selection:bg-orange-500/30 overflow-x-hidden ${darkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
            {/* Inline keyframes */}
            <style>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .marquee-track { animation: marquee 22s linear infinite; }
                .marquee-track:hover { animation-play-state: paused; }
                @keyframes shimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                .shimmer-btn {
                    background: linear-gradient(90deg, #ea580c 0%, #ea580c 40%, #fb923c 50%, #ea580c 60%, #ea580c 100%);
                    background-size: 200% auto;
                    animation: shimmer 3s linear infinite;
                }
                @keyframes mesh-move {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                .mesh-bg {
                    background: linear-gradient(135deg, #7c2d12, #ea580c, #b45309, #0f172a, #0c4a6e);
                    background-size: 300% 300%;
                    animation: mesh-move 8s ease infinite;
                }
            `}</style>

            {darkMode && <CanvasBackground />}
            {darkMode && <CustomCursor />}

            {/* ── Navbar ─────────────────────────────────────────────────────── */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
                scrolled
                    ? (darkMode ? 'bg-slate-900/80 border-slate-800 backdrop-blur-md py-4' : 'bg-white/80 border-slate-200 backdrop-blur-md py-4')
                    : 'bg-transparent border-transparent py-6'
            }`}>
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                    <motion.div
                        className="flex items-center gap-2"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/50 ring-2 ring-orange-500/20">
                            <Activity className="w-6 h-6 text-white" />
                        </div>
                        <span className={`text-xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            BrickOptima
                        </span>
                    </motion.div>

                    <motion.div
                        className="hidden md:flex items-center gap-8"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        {['Features', 'How it Works'].map((item) => (
                            <a
                                key={item}
                                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                                className={`text-sm font-medium transition-colors ${darkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                {item}
                            </a>
                        ))}
                    </motion.div>

                    <motion.div
                        className="hidden md:flex items-center gap-4"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.15 }}
                    >
                        {toggleTheme && (
                            <motion.button
                                onClick={toggleTheme}
                                whileHover={{ scale: 1.1, rotate: 15 }}
                                whileTap={{ scale: 0.9 }}
                                className={`p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
                            >
                                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                            </motion.button>
                        )}
                        <motion.button
                            onClick={onLoginClick}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.97 }}
                            className={`text-sm font-semibold transition-colors ${darkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Sign In
                        </motion.button>
                        <motion.button
                            onClick={onGetStartedClick}
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.97 }}
                            className="px-5 py-2.5 shimmer-btn text-white text-sm font-semibold rounded-lg shadow-lg shadow-orange-500/25"
                        >
                            Get Started
                        </motion.button>
                    </motion.div>

                    {/* Mobile toggle */}
                    <div className="md:hidden flex items-center gap-4">
                        <motion.button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            whileTap={{ scale: 0.9 }}
                            className={darkMode ? 'text-white' : 'text-slate-900'}
                        >
                            {mobileMenuOpen ? <X /> : <Menu />}
                        </motion.button>
                    </div>
                </div>

                {/* Mobile Menu */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.div
                            key="mobile-menu"
                            initial={{ opacity: 0, y: -16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -16 }}
                            transition={{ duration: 0.22 }}
                            className={`md:hidden absolute top-full left-0 right-0 border-b p-6 flex flex-col gap-4 shadow-xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                        >
                            <a href="#features" onClick={() => setMobileMenuOpen(false)} className={`text-base font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Features</a>
                            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className={`text-base font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>How it Works</a>
                            <div className="h-px bg-slate-800/50 my-1" />
                            <button onClick={() => { setMobileMenuOpen(false); onLoginClick(); }} className="w-full py-3 text-center font-semibold border border-slate-700 rounded-lg">Sign In</button>
                            <button onClick={() => { setMobileMenuOpen(false); onGetStartedClick(); }} className="w-full py-3 shimmer-btn text-white font-semibold rounded-lg">Get Started Free</button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>

            {/* ── Hero Section ───────────────────────────────────────────────── */}
            <section ref={heroRef} className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
                {/* Floating gradient orbs */}
                <motion.div
                    className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%)', filter: 'blur(40px)' }}
                    animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 9, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
                />
                <motion.div
                    className="absolute bottom-10 right-1/4 w-[400px] h-[400px] rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }}
                    animate={{ x: [0, -25, 0], y: [0, 20, 0], scale: [1, 1.08, 1] }}
                    transition={{ duration: 11, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut', delay: 2 }}
                />

                <motion.div
                    className="max-w-5xl mx-auto text-center relative z-10"
                    style={{ y: heroY, opacity: heroOpacity }}
                >
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ ...springTransition, delay: 0.1 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-bold uppercase tracking-wider mb-8"
                    >
                        <motion.span
                            className="w-2 h-2 rounded-full bg-orange-500"
                            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                            transition={{ duration: 1.8, repeat: Infinity }}
                        />
                        New: GitHub Integration
                    </motion.div>

                    {/* Headline */}
                    <div className="overflow-hidden mb-2">
                        <motion.h1
                            className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight"
                            initial="hidden"
                            animate="visible"
                            variants={staggerContainer}
                        >
                            {['Optimize', 'Your'].map((word, i) => (
                                <motion.span
                                    key={i}
                                    variants={fadeUp}
                                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                                    className="inline-block mr-4"
                                >
                                    {word}
                                </motion.span>
                            ))}
                            <br />
                            <motion.span
                                variants={fadeUp}
                                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                                className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500"
                                style={{ backgroundSize: '200% auto', animation: 'shimmer 4s linear infinite' }}
                            >
                                Databricks Workflows
                            </motion.span>
                        </motion.h1>
                    </div>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.55, duration: 0.6 }}
                        className={`text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed mt-6 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}
                    >
                        Stop guessing why your Spark jobs are slow. Get AI-powered recommendations,
                        visualize DAG bottlenecks, and cut compute costs by up to 40%.
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7, duration: 0.5 }}
                    >
                        <motion.button
                            onClick={onGetStartedClick}
                            whileHover={{ scale: 1.05, y: -3 }}
                            whileTap={{ scale: 0.97 }}
                            transition={springTransition}
                            className="w-full sm:w-auto px-8 py-4 shimmer-btn text-white font-bold rounded-xl shadow-xl shadow-orange-500/25 flex items-center justify-center gap-2"
                        >
                            Get Started Free
                            <motion.span
                                animate={{ x: [0, 4, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                            >
                                <ArrowRight className="w-5 h-5" />
                            </motion.span>
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.04, y: -2 }}
                            whileTap={{ scale: 0.97 }}
                            transition={springTransition}
                            className={`w-full sm:w-auto px-8 py-4 font-bold rounded-xl border flex items-center justify-center gap-2 ${
                                darkMode
                                    ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                        >
                            <PlayCircle className="w-5 h-5" />
                            Watch Demo
                        </motion.button>
                    </motion.div>

                    {/* Trust badges */}
                    <motion.div
                        className={`mt-10 flex items-center justify-center gap-3 text-sm font-medium ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.9 }}
                    >
                        <Shield className="w-4 h-4" />
                        <span className="mr-4">No credit card required</span>
                        <Check className="w-4 h-4" />
                        <span>SOC2 Compliant</span>
                    </motion.div>
                </motion.div>
            </section>

            {/* ── Stats Banner ───────────────────────────────────────────────── */}
            <motion.section
                className={`py-14 px-6 relative z-10 ${darkMode ? 'bg-slate-900/60 border-y border-slate-800' : 'bg-white border-y border-slate-200'}`}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={staggerContainer}
            >
                <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
                    {[
                        { value: 40, suffix: '%', label: 'Avg Cost Saved', color: 'text-orange-500' },
                        { value: 10, suffix: 'x', label: 'Faster Debugging', color: 'text-cyan-400' },
                        { value: 100, suffix: '%', label: 'Data Private', color: 'text-green-400' },
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            variants={fadeUp}
                            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                            className="flex flex-col items-center gap-1"
                        >
                            <span className={`text-5xl font-extrabold tabular-nums ${stat.color}`}>
                                <AnimatedCounter to={stat.value} suffix={stat.suffix} />
                            </span>
                            <span className={`text-sm font-semibold uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                {stat.label}
                            </span>
                        </motion.div>
                    ))}
                </div>
            </motion.section>

            {/* ── Analysis Showcase ──────────────────────────────────────────── */}
            <section className="py-10 pb-24 px-6 relative z-20 -mt-4">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        className="text-center mb-12"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-60px' }}
                        variants={staggerContainer}
                    >
                        <motion.p
                            variants={fadeUp}
                            transition={{ duration: 0.5 }}
                            className={`text-sm font-bold uppercase tracking-widest mb-3 ${darkMode ? 'text-orange-500' : 'text-orange-600'}`}
                        >
                            Intelligent Plan Analysis
                        </motion.p>
                        <motion.h2
                            variants={fadeUp}
                            transition={{ duration: 0.55 }}
                            className={`text-3xl md:text-4xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-slate-900'}`}
                        >
                            See What BrickOptima Sees In Your Code
                        </motion.h2>
                        <motion.p
                            variants={fadeUp}
                            transition={{ duration: 0.55 }}
                            className={`text-lg max-w-2xl mx-auto ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}
                        >
                            Our engine parses your Spark execution plans to identify critical bottlenecks, data skew, and cost-saving opportunities instantly.
                        </motion.p>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-60px' }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <AnalysisShowcase darkMode={darkMode} result={null} />
                    </motion.div>
                </div>
            </section>

            {/* ── Social Proof Marquee ───────────────────────────────────────── */}
            <section className={`py-12 border-y overflow-hidden ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="max-w-7xl mx-auto px-6 text-center mb-8">
                    <p className={`text-sm font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        Trusted by data teams at innovative companies
                    </p>
                </div>
                <div
                    className="relative"
                    style={{
                        maskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
                    }}
                >
                    <div className="flex marquee-track w-max">
                        {logoItems.map((item, i) => (
                            <div
                                key={i}
                                className={`flex items-center gap-2 text-xl font-bold mx-10 opacity-40 hover:opacity-80 transition-opacity duration-300 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}
                            >
                                <item.icon className="w-6 h-6" />
                                {item.label}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Feature Grid ───────────────────────────────────────────────── */}
            <section id="features" className="py-24 px-6 relative z-10">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        className="text-center mb-16"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-60px' }}
                        variants={staggerContainer}
                    >
                        <motion.p
                            variants={fadeUp}
                            transition={{ duration: 0.5 }}
                            className={`text-sm font-bold uppercase tracking-widest mb-3 ${darkMode ? 'text-orange-500' : 'text-orange-600'}`}
                        >
                            Core Capabilities
                        </motion.p>
                        <motion.h2
                            variants={fadeUp}
                            transition={{ duration: 0.55 }}
                            className={`text-3xl md:text-4xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}
                        >
                            Everything You Need to Optimize
                        </motion.h2>
                    </motion.div>

                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-60px' }}
                        variants={staggerContainer}
                    >
                        {features.map((feature, idx) => (
                            <motion.div
                                key={idx}
                                variants={fadeUp}
                                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                                whileHover={{ y: -10, scale: 1.02 }}
                                className={`group p-8 rounded-2xl border cursor-default transition-colors duration-300 ${
                                    darkMode
                                        ? 'bg-slate-900/50 border-slate-800 hover:border-orange-500/40 hover:bg-slate-800/80'
                                        : 'bg-white border-slate-200 hover:border-orange-500/30 hover:shadow-2xl'
                                }`}
                                style={{ boxShadow: undefined }}
                            >
                                <motion.div
                                    className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-gradient-to-br ${feature.color} shadow-lg ${feature.glow}`}
                                    whileHover={{ rotate: 12, scale: 1.15 }}
                                    transition={springTransition}
                                >
                                    <feature.icon className="w-6 h-6 text-white" />
                                </motion.div>
                                <h3 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{feature.title}</h3>
                                <p className={`leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{feature.desc}</p>
                                {/* Animated bottom accent */}
                                <motion.div
                                    className={`mt-6 h-0.5 rounded-full bg-gradient-to-r ${feature.color}`}
                                    initial={{ scaleX: 0, originX: 0 }}
                                    whileInView={{ scaleX: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.6, delay: idx * 0.1 + 0.3 }}
                                />
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ── How It Works ───────────────────────────────────────────────── */}
            <section id="how-it-works" className={`py-24 px-6 relative z-10 ${darkMode ? 'bg-slate-900/30' : 'bg-slate-50'}`}>
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        className="text-center mb-16"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-60px' }}
                        variants={staggerContainer}
                    >
                        <motion.p
                            variants={fadeUp}
                            transition={{ duration: 0.5 }}
                            className={`text-sm font-bold uppercase tracking-widest mb-3 ${darkMode ? 'text-orange-500' : 'text-orange-600'}`}
                        >
                            Simple Process
                        </motion.p>
                        <motion.h2
                            variants={fadeUp}
                            transition={{ duration: 0.55 }}
                            className={`text-3xl md:text-4xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}
                        >
                            How BrickOptima Works
                        </motion.h2>
                        <motion.p
                            variants={fadeUp}
                            transition={{ duration: 0.55 }}
                            className={`text-lg max-w-2xl mx-auto ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}
                        >
                            Turn your execution logs into actionable insights in three simple steps.
                        </motion.p>
                    </motion.div>

                    <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Connector line (desktop) */}
                        <div className="hidden md:block absolute top-16 left-1/3 right-1/3 h-px pointer-events-none overflow-visible" style={{ zIndex: 0 }}>
                            <svg width="100%" height="2" viewBox="0 0 400 2" preserveAspectRatio="none">
                                <motion.line
                                    x1="0" y1="1" x2="400" y2="1"
                                    stroke={darkMode ? '#f97316' : '#ea580c'}
                                    strokeWidth="2"
                                    strokeDasharray="6 4"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    whileInView={{ pathLength: 1, opacity: 0.4 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 1.2, delay: 0.4 }}
                                />
                            </svg>
                        </div>

                        {[
                            { step: '01', title: 'Connect Logs', desc: 'Securely upload your Spark event logs or connect your Databricks workspace.' },
                            { step: '02', title: 'AI Analysis', desc: 'Our engine reconstructs the DAG and identifies inefficient scan, join, and shuffle operations.' },
                            { step: '03', title: 'Optimize', desc: 'Apply generated code fixes and config tuning to reduce runtime and cost.' },
                        ].map((item, idx) => (
                            <motion.div
                                key={idx}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true, margin: '-60px' }}
                                variants={fadeUp}
                                transition={{ duration: 0.6, delay: idx * 0.15, ease: [0.22, 1, 0.36, 1] }}
                                whileHover={{ y: -8 }}
                                className="relative group cursor-default"
                                style={{ zIndex: 1 }}
                            >
                                <div className={`text-8xl font-bold absolute -top-10 -left-6 z-0 select-none ${darkMode ? 'text-white/5' : 'text-slate-900/5'}`}>
                                    {item.step}
                                </div>
                                <div className={`relative z-10 p-8 rounded-2xl border h-full transition-colors duration-300 ${
                                    darkMode
                                        ? 'bg-slate-800/50 border-slate-700 group-hover:border-orange-500/50'
                                        : 'bg-white border-slate-200 group-hover:border-orange-500/50 group-hover:shadow-xl'
                                }`}>
                                    {/* Step number circle */}
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold text-sm mb-6 shadow-lg shadow-orange-500/30">
                                        {idx + 1}
                                    </div>
                                    <h3 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{item.title}</h3>
                                    <p className={darkMode ? 'text-slate-400' : 'text-slate-600'}>{item.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Founders Section ───────────────────────────────────────────── */}
            <section className={`py-24 px-6 relative z-10 border-t ${darkMode ? 'bg-slate-950 border-slate-900' : 'bg-white border-slate-100'}`}>
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        className="text-center mb-16"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-60px' }}
                        variants={staggerContainer}
                    >
                        <motion.p
                            variants={fadeUp}
                            transition={{ duration: 0.5 }}
                            className={`text-sm font-bold uppercase tracking-widest mb-3 ${darkMode ? 'text-orange-500' : 'text-orange-600'}`}
                        >
                            About Us
                        </motion.p>
                        <motion.h2
                            variants={fadeUp}
                            transition={{ duration: 0.55 }}
                            className={`text-3xl md:text-4xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-slate-900'}`}
                        >
                            Meet the Founders
                        </motion.h2>
                        <motion.p
                            variants={fadeUp}
                            transition={{ duration: 0.55 }}
                            className={`text-lg max-w-2xl mx-auto ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}
                        >
                            We are passionate about solving complex data engineering challenges and building tools that empower data teams.
                        </motion.p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 max-w-4xl mx-auto">
                        {[
                            {
                                name: 'Dharmik Soni',
                                role: 'Co-Founder & Product Architect',
                                desc: "AI Developer at North America's largest P&C insurer. Building BrickOptima to solve the optimization visibility gaps we all face on the Databricks platform.",
                                image: '/images/dharmik.jpeg',
                                linkedin: 'https://www.linkedin.com/in/dharmik-soni-a385131a0/',
                            },
                            {
                                name: 'Dhruv Soni',
                                role: 'Co-Founder & Lead Engineer',
                                desc: 'Data Platform Engineer scaling petabyte-level pipelines. Engineering the solution to our shared performance headaches for the entire Databricks community.',
                                image: '/images/dhruv.jpeg',
                                linkedin: 'https://www.linkedin.com/in/-dhruvsoni/',
                            },
                        ].map((founder, idx) => (
                            <motion.div
                                key={idx}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true, margin: '-60px' }}
                                variants={fadeUp}
                                transition={{ duration: 0.6, delay: idx * 0.15, ease: [0.22, 1, 0.36, 1] }}
                                whileHover={{ rotateY: 4, rotateX: -2, scale: 1.02 }}
                                style={{ perspective: 1000 }}
                                className={`group relative p-8 rounded-3xl border cursor-default transition-colors duration-500 ${
                                    darkMode
                                        ? 'bg-slate-900/40 border-slate-800 hover:border-orange-500/30 hover:bg-slate-800/60'
                                        : 'bg-slate-50 border-slate-200 hover:border-orange-500/30 hover:shadow-xl hover:bg-white'
                                }`}
                            >
                                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-orange-500/5 via-transparent to-transparent" />

                                <div className="relative z-10 flex flex-col items-center text-center">
                                    <div className="relative mb-6">
                                        <motion.div
                                            className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 blur-xl"
                                            initial={{ opacity: 0.15, scale: 1 }}
                                            whileHover={{ opacity: 0.5, scale: 1.2 }}
                                            transition={{ duration: 0.4 }}
                                        />
                                        <img
                                            src={founder.image}
                                            alt={founder.name}
                                            className="w-32 h-32 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-xl relative z-10"
                                            onError={(e) => {
                                                e.currentTarget.src = `https://ui-avatars.com/api/?name=${founder.name.replace(' ', '+')}&background=f97316&color=fff&size=256`;
                                            }}
                                        />
                                        <div className="absolute bottom-0 right-0 z-20 bg-white dark:bg-slate-900 rounded-full p-2 shadow-lg border border-slate-100 dark:border-slate-800">
                                            <a
                                                href={founder.linkedin}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block text-[#0077b5]"
                                            >
                                                <motion.div whileHover={{ scale: 1.2, rotate: -8 }} transition={springTransition}>
                                                    <Linkedin className="w-5 h-5 fill-current" />
                                                </motion.div>
                                            </a>
                                        </div>
                                    </div>

                                    <h3 className={`text-2xl font-bold mb-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                        {founder.name}
                                    </h3>
                                    <p className={`text-sm font-medium mb-4 uppercase tracking-wide ${darkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                                        {founder.role}
                                    </p>

                                    {/* Animated underline */}
                                    <motion.div
                                        className="h-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 mb-6"
                                        initial={{ width: '3rem', opacity: 0.3 }}
                                        whileHover={{ width: '6rem', opacity: 1 }}
                                        transition={{ duration: 0.35 }}
                                    />

                                    <p className={`leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                        "{founder.desc}"
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Footer CTA Banner ──────────────────────────────────────────── */}
            <section className="relative py-24 px-6 overflow-hidden">
                <div className="absolute inset-0 mesh-bg opacity-90" />
                <div className="absolute inset-0 bg-slate-950/60" />
                {/* Floating orb */}
                <motion.div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.2) 0%, transparent 65%)', filter: 'blur(60px)' }}
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 6, repeat: Infinity, repeatType: 'reverse' }}
                />
                <motion.div
                    className="relative z-10 max-w-3xl mx-auto text-center"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-60px' }}
                    variants={staggerContainer}
                >
                    <motion.h2
                        variants={fadeUp}
                        transition={{ duration: 0.6 }}
                        className="text-4xl md:text-6xl font-extrabold text-white mb-6"
                    >
                        Ready to{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">
                            Optimize?
                        </span>
                    </motion.h2>
                    <motion.p
                        variants={fadeUp}
                        transition={{ duration: 0.6 }}
                        className="text-lg text-slate-300 mb-10 max-w-xl mx-auto"
                    >
                        Join data teams already cutting costs and shipping faster pipelines with BrickOptima.
                    </motion.p>
                    <motion.button
                        variants={fadeUp}
                        transition={{ duration: 0.6 }}
                        onClick={onGetStartedClick}
                        whileHover={{ scale: 1.06, y: -4 }}
                        whileTap={{ scale: 0.97 }}
                        className="inline-flex items-center gap-3 px-10 py-5 shimmer-btn text-white text-lg font-bold rounded-2xl shadow-2xl shadow-orange-500/40"
                    >
                        Get Started Free
                        <motion.span
                            animate={{ x: [0, 5, 0] }}
                            transition={{ duration: 1.4, repeat: Infinity }}
                        >
                            <ArrowRight className="w-6 h-6" />
                        </motion.span>
                    </motion.button>
                </motion.div>
            </section>

            {/* ── Footer ─────────────────────────────────────────────────────── */}
            <footer className={`relative z-10 pt-20 pb-10 px-6 border-t ${darkMode ? 'bg-slate-950 border-slate-900' : 'bg-slate-50 border-slate-200'}`}>
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16 border-b border-slate-800/50 pb-12">
                        <div className="col-span-1 md:col-span-2">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                                    <Activity className="w-5 h-5 text-white" />
                                </div>
                                <span className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>BrickOptima</span>
                            </div>
                            <p className={`mb-6 max-w-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                Your AI-Powered Optimization Engine for Databricks. Cut costs and accelerate pipelines with ease.
                            </p>
                        </div>

                        <div>
                            <h4 className={`font-bold mb-6 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Quick Links</h4>
                            <ul className="space-y-4">
                                {[{ label: 'Features', href: '#features' }, { label: 'How it Works', href: '#how-it-works' }].map(link => (
                                    <li key={link.label}>
                                        <a href={link.href} className={`block text-sm transition-colors hover:underline ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                                            {link.label}
                                        </a>
                                    </li>
                                ))}
                                <li>
                                    <button onClick={onLoginClick} className={`block text-sm text-left transition-colors hover:underline ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                                        Login
                                    </button>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h4 className={`font-bold mb-6 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Legal</h4>
                            <ul className="space-y-4">
                                {[
                                    { label: 'Privacy Policy', key: 'privacy' },
                                    { label: 'Terms of Service', key: 'terms' },
                                    { label: 'Cookie Policy', key: 'cookie' },
                                    { label: 'Security', key: 'security' },
                                ].map(item => (
                                    <li key={item.key}>
                                        <button
                                            onClick={() => setActiveLegalModal(item.key as any)}
                                            className={`block w-full text-sm text-left transition-colors hover:underline ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                                        >
                                            {item.label}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
                        <div className={darkMode ? 'text-slate-500' : 'text-slate-400'}>
                            © 2025 BrickOptima. All rights reserved.
                        </div>
                        <div className={`flex items-center gap-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            <span>Made with</span>
                            <motion.span
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ duration: 1.2, repeat: Infinity }}
                            >
                                <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                            </motion.span>
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

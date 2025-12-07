// src/components/auth/AuthPage.tsx
// Beautiful animated authentication page

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Zap,
  Shield,
  Check,
  AlertCircle,
  Loader2,
  Github,
  Chrome
} from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { ThreeBackground } from '../ThreeBackground';

interface AuthPageProps {
  onAuthSuccess?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Password validation state
  const [passwordFocus, setPasswordFocus] = useState(false);

  const { login, register, isLoading, error, clearError } = useAuth();

  // Password requirements
  const passwordRequirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One number', met: /\d/.test(password) },
  ];

  const allRequirementsMet = passwordRequirements.every(r => r.met);

  // Clear errors when switching modes
  useEffect(() => {
    clearError();
    setLocalError(null);
  }, [isLogin, clearError]);

  const handleToggleMode = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setIsLogin(!isLogin);
      setIsAnimating(false);
      // Reset form
      setEmail('');
      setPassword('');
      setName('');
    }, 300);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setIsSubmitting(true);

    // Validation
    if (!email || !password) {
      setLocalError('Please fill in all required fields');
      setIsSubmitting(false);
      return;
    }

    if (!isLogin && !name) {
      setLocalError('Please enter your name');
      setIsSubmitting(false);
      return;
    }

    if (!isLogin && !allRequirementsMet) {
      setLocalError('Please meet all password requirements');
      setIsSubmitting(false);
      return;
    }

    try {
      if (isLogin) {
        await login({ email, password });
      } else {
        await register({ email, password, name });
      }
      onAuthSuccess?.();
    } catch (err) {
      // Error is handled by the auth context
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background */}
      {/* 3D Animated Background */}
      <ThreeBackground showGrids={true} />

      {/* Main Container */}
      <div className="w-full max-w-5xl flex rounded-3xl overflow-hidden shadow-2xl shadow-black/50 z-10">

        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-slate-900/90 backdrop-blur-xl p-12 flex-col justify-between relative overflow-hidden border-r border-white/10">

          {/* Content */}
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Activity className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">BrickOptima</span>
            </div>

            <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
              Optimize your<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">
                Databricks Workflows
              </span>
            </h1>

            <p className="text-slate-400 text-lg leading-relaxed mb-8">
              AI-powered DAG analysis to identify bottlenecks and accelerate your Spark workloads.
            </p>

            {/* Features */}
            <div className="space-y-4">
              {[
                { icon: Zap, text: 'Real-time DAG Visualization' },
                { icon: Sparkles, text: 'AI-Powered Recommendations' },
                { icon: Shield, text: 'Secure & Private Analysis' },
              ].map((feature, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 text-slate-300 animate-fade-in-up"
                  style={{ animationDelay: `${idx * 150}ms` }}
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <feature.icon className="w-4 h-4 text-orange-400" />
                  </div>
                  <span className="font-medium">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom stats */}
          <div className="relative z-10 flex gap-8 pt-8 border-t border-white/10">
            {[
              { value: '10K+', label: 'Analyses Run' },
              { value: '40%', label: 'Avg. Speedup' },
              { value: '99.9%', label: 'Uptime' },
            ].map((stat, idx) => (
              <div key={idx} className="animate-fade-in" style={{ animationDelay: `${(idx + 3) * 150}ms` }}>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Auth Form */}
        <div className="w-full lg:w-1/2 bg-slate-900/80 backdrop-blur-xl p-8 lg:p-12 relative border-l border-white/5">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">BrickOptima</span>
          </div>

          {/* Form Header */}
          <div className={`transition-all duration-300 ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
            <h2 className="text-3xl font-bold text-white mb-2">
              {isLogin ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-slate-400 mb-8">
              {isLogin
                ? 'Enter your credentials to access your dashboard'
                : 'Start optimizing your Spark workloads today'}
            </p>
          </div>

          {/* Error Message */}
          {displayError && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-400 text-sm font-medium">{displayError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className={`space-y-5 transition-all duration-300 ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>

            {/* Name field (register only) */}
            {!isLogin && (
              <div className="space-y-2 animate-fade-in">
                <label className="block text-sm font-medium text-slate-300">
                  Full Name
                </label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all hover:bg-slate-800"
                  />
                </div>
              </div>
            )}

            {/* Email field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all hover:bg-slate-800"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocus(true)}
                  onBlur={() => setPasswordFocus(false)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all hover:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Password requirements (register only) */}
              {!isLogin && (passwordFocus || password.length > 0) && (
                <div className="mt-3 p-3 bg-slate-800/50 rounded-xl space-y-2 animate-fade-in border border-slate-700/50">
                  {passwordRequirements.map((req, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 text-sm transition-colors ${req.met ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                    >
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${req.met ? 'bg-emerald-500/20' : 'bg-slate-700'
                        }`}>
                        {req.met && <Check className="w-3 h-3" />}
                      </div>
                      <span className="font-medium">{req.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Forgot password (login only) */}
            {isLogin && (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm font-medium text-orange-400 hover:text-orange-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 group border border-orange-400/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{isLogin ? 'Signing in...' : 'Creating account...'}</span>
                </>
              ) : (
                <>
                  <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-slate-900/80 text-slate-500 font-medium">Or continue with</span>
              </div>
            </div>

            {/* Social login buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl text-slate-300 font-medium transition-all hover:shadow-lg hover:shadow-black/20"
              >
                <Github className="w-5 h-5" />
                <span>GitHub</span>
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl text-slate-300 font-medium transition-all hover:shadow-lg hover:shadow-black/20"
              >
                <Chrome className="w-5 h-5" />
                <span>Google</span>
              </button>
            </div>
          </form>

          {/* Toggle auth mode */}
          <p className="mt-8 text-center text-slate-400">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
            <button
              type="button"
              onClick={handleToggleMode}
              className="ml-2 text-orange-400 hover:text-orange-300 font-semibold transition-colors"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>

      {/* Custom styles */}
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }
        
        .animate-fade-in {
          animation: fade-in 0.4s ease-out forwards;
        }
        
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>);
};

export default AuthPage;

// AuthPageStandalone.tsx
// A complete, standalone authentication page component
// Copy this into your project and import where needed

import React, { useState, useEffect } from 'react';
import { 
  Activity, Mail, Lock, User, Eye, EyeOff, ArrowRight, 
  Sparkles, Zap, Shield, Check, AlertCircle, Loader2,
  Github, Chrome
} from 'lucide-react';

// Types
interface AuthPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (name: string, email: string, password: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  onClearError?: () => void;
}

export const AuthPageStandalone: React.FC<AuthPageProps> = ({
  onLogin,
  onRegister,
  isLoading = false,
  error = null,
  onClearError
}) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [passwordFocus, setPasswordFocus] = useState(false);
  
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
    onClearError?.();
    setLocalError(null);
  }, [isLoginMode]);

  const handleToggleMode = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setIsLoginMode(!isLoginMode);
      setIsAnimating(false);
      setEmail('');
      setPassword('');
      setName('');
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password) {
      setLocalError('Please fill in all required fields');
      return;
    }

    if (!isLoginMode && !name) {
      setLocalError('Please enter your name');
      return;
    }

    if (!isLoginMode && !allRequirementsMet) {
      setLocalError('Please meet all password requirements');
      return;
    }

    try {
      if (isLoginMode) {
        await onLogin(email, password);
      } else {
        await onRegister(name, email, password);
      }
    } catch (err) {
      // Error handling is done via props
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50" />
        
        {/* Animated orbs */}
        <div 
          className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-orange-200/40 to-orange-300/20 blur-3xl"
          style={{ animation: 'blob 15s ease-in-out infinite' }}
        />
        <div 
          className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-blue-200/30 to-indigo-300/20 blur-3xl"
          style={{ animation: 'blob 15s ease-in-out infinite 2s' }}
        />
        <div 
          className="absolute top-[40%] right-[20%] w-[30%] h-[30%] rounded-full bg-gradient-to-br from-orange-100/40 to-amber-200/20 blur-3xl"
          style={{ animation: 'blob 15s ease-in-out infinite 4s' }}
        />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      {/* Main Container */}
      <div className="w-full max-w-5xl flex rounded-3xl overflow-hidden shadow-2xl shadow-slate-900/10">
        
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-12 flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-96 h-96 bg-orange-500 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          </div>

          <div 
            className="absolute inset-0 opacity-5"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }}
          />

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

            <div className="space-y-4">
              {[
                { icon: Zap, text: 'Real-time DAG Visualization' },
                { icon: Sparkles, text: 'AI-Powered Recommendations' },
                { icon: Shield, text: 'Secure & Private Analysis' },
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center gap-3 text-slate-300">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <feature.icon className="w-4 h-4 text-orange-400" />
                  </div>
                  <span className="font-medium">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 flex gap-8 pt-8 border-t border-white/10">
            {[
              { value: '10K+', label: 'Analyses Run' },
              { value: '40%', label: 'Avg. Speedup' },
              { value: '99.9%', label: 'Uptime' },
            ].map((stat, idx) => (
              <div key={idx}>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Auth Form */}
        <div className="w-full lg:w-1/2 bg-white/80 backdrop-blur-xl p-8 lg:p-12 relative">
          
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">BrickOptima</span>
          </div>

          {/* Form Header */}
          <div className={`transition-all duration-300 ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">
              {isLoginMode ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-slate-600 mb-8">
              {isLoginMode 
                ? 'Enter your credentials to access your dashboard' 
                : 'Start optimizing your Spark workloads today'}
            </p>
          </div>

          {/* Error Message */}
          {displayError && (
            <div 
              className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3"
              style={{ animation: 'shake 0.5s ease-in-out' }}
            >
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700 text-sm font-medium">{displayError}</span>
            </div>
          )}

          {/* Form */}
          <form 
            onSubmit={handleSubmit} 
            className={`space-y-5 transition-all duration-300 ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}
          >
            
            {/* Name field (register only) */}
            {!isLoginMode && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Full Name</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Email field */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocus(true)}
                  onBlur={() => setPasswordFocus(false)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Password requirements (register only) */}
              {!isLoginMode && (passwordFocus || password.length > 0) && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl space-y-2">
                  {passwordRequirements.map((req, idx) => (
                    <div 
                      key={idx}
                      className={`flex items-center gap-2 text-sm transition-colors ${req.met ? 'text-emerald-600' : 'text-slate-500'}`}
                    >
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${req.met ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                        {req.met && <Check className="w-3 h-3" />}
                      </div>
                      <span className="font-medium">{req.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Forgot password (login only) */}
            {isLoginMode && (
              <div className="flex justify-end">
                <button type="button" className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors">
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{isLoginMode ? 'Signing in...' : 'Creating account...'}</span>
                </>
              ) : (
                <>
                  <span>{isLoginMode ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-slate-500 font-medium">Or continue with</span>
              </div>
            </div>

            {/* Social login buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-medium transition-all hover:shadow-md"
              >
                <Github className="w-5 h-5" />
                <span>GitHub</span>
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-medium transition-all hover:shadow-md"
              >
                <Chrome className="w-5 h-5" />
                <span>Google</span>
              </button>
            </div>
          </form>

          {/* Toggle auth mode */}
          <p className="mt-8 text-center text-slate-600">
            {isLoginMode ? "Don't have an account?" : 'Already have an account?'}
            <button
              type="button"
              onClick={handleToggleMode}
              className="ml-2 text-orange-600 hover:text-orange-700 font-semibold transition-colors"
            >
              {isLoginMode ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -30px) scale(1.05); }
          50% { transform: translate(-20px, 20px) scale(0.95); }
          75% { transform: translate(30px, 10px) scale(1.02); }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
};

export default AuthPageStandalone;

import React, { useEffect, useState } from 'react';
import { Check, X, Loader2, ArrowRight } from 'lucide-react';
import { ThreeBackground } from '../ThreeBackground';
import { authApi } from '../../api/auth';

export const VerifyEmail = () => {
    const [status, setStatus] = useState<'LOADING' | 'SUCCESS' | 'ERROR'>('LOADING');
    const [message, setMessage] = useState('');

    const verifyCalled = React.useRef(false);

    useEffect(() => {
        const verify = async () => {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('token');

            if (!token) {
                setStatus('ERROR');
                setMessage('Invalid verification link.');
                return;
            }

            if (verifyCalled.current) return;
            verifyCalled.current = true;

            try {
                const res = await authApi.verifyEmail(token);
                setStatus('SUCCESS');
                setMessage(res.message);
            } catch (err: any) {
                setStatus('ERROR');
                setMessage(err.message || 'Verification failed. The link may be invalid or expired.');
            }
        };

        verify();
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            <ThreeBackground showGrids={false} />

            <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/10 relative z-10 text-center">
                <div className="mb-6 flex justify-center">
                    {status === 'LOADING' && (
                        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center animate-pulse">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                    )}
                    {status === 'SUCCESS' && (
                        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center animate-bounce">
                            <Check className="w-8 h-8 text-emerald-500" />
                        </div>
                    )}
                    {status === 'ERROR' && (
                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center animate-shake">
                            <X className="w-8 h-8 text-red-500" />
                        </div>
                    )}
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">
                    {status === 'LOADING' && 'Verifying Email...'}
                    {status === 'SUCCESS' && 'Email Verified!'}
                    {status === 'ERROR' && 'Verification Failed'}
                </h2>

                <p className="text-slate-400 mb-8">
                    {message || (status === 'LOADING' ? 'Please wait while we verify your email address.' : '')}
                </p>

                {status !== 'LOADING' && (
                    <button
                        onClick={() => window.location.href = '/'}
                        className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/20 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
                    >
                        <span>Continue to Login</span>
                        <ArrowRight className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
    );
};

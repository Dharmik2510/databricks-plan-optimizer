
import React, { useState, useEffect } from 'react';
import { X, Save, User, Mail, Camera, Loader2, Link } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { userApi, UpdateUserDto } from '../../api/user';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
    const { user, updateUser } = useAuth();
    const [formData, setFormData] = useState<UpdateUserDto>({
        name: '',
        email: '',
        avatar: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name,
                email: user.email,
                avatar: user.avatar || ''
            });
        }
    }, [user]);

    if (!isOpen || !user) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setSuccess('');
        try {
            // Exclude email from the update payload
            const { email, ...updateData } = formData;

            // If avatar is empty, remove it from payload to avoid validation error
            if (!updateData.avatar) {
                delete updateData.avatar;
            }

            const updated = await userApi.updateProfile(updateData);
            updateUser(updated); // Update local context
            setSuccess('Profile updated successfully!');
            setTimeout(() => setSuccess(''), 3000);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><User className="w-5 h-5" /> Edit Profile</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="flex justify-center mb-6">
                        <div className="relative group cursor-pointer">
                            <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden ring-4 ring-white dark:ring-slate-900 shadow-lg">
                                {formData.avatar ? <img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-slate-400">{formData.name?.[0]}</div>}
                            </div>
                            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera className="w-8 h-8 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600 dark:text-slate-400">Full Name</label>
                        <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/50 text-slate-900 dark:text-white placeholder-slate-400" />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600 dark:text-slate-400">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                            <input value={formData.email} disabled className="w-full pl-10 p-3 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 cursor-not-allowed" />
                        </div>
                        <p className="text-xs text-slate-400">Email cannot be changed.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600 dark:text-slate-400">Avatar URL</label>
                        <div className="relative">
                            <Link className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                            <input value={formData.avatar} onChange={e => setFormData({ ...formData, avatar: e.target.value })} placeholder="https://..." className="w-full pl-10 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/50 text-slate-900 dark:text-white placeholder-slate-400" />
                        </div>
                    </div>

                    {success && <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-xl text-sm font-bold text-center animate-fade-in">{success}</div>}

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancel</button>
                        <button type="submit" disabled={isLoading} className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors flex items-center justify-center gap-2">
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

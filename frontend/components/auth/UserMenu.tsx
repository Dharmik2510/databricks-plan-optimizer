import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { userApi } from '../../api/user';
import { ProfileModal } from '../modals/ProfileModal';
import { SettingsModal } from '../modals/SettingsModal';
import { HelpModal } from '../modals/HelpModal';

export const UserMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'profile' | 'settings' | 'help' | null>(null);
  const [stats, setStats] = useState<{ analysisCount: number }>({ analysisCount: 0 });

  const menuRef = useRef<HTMLDivElement>(null);
  const { user, logout, isLoading } = useAuth();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch stats when menu opens
  useEffect(() => {
    if (isOpen) {
      userApi.getStats()
        .then(s => setStats(s))
        .catch(err => console.error('Failed to fetch stats:', err));
    }
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
  };

  if (!user) return null;

  // Get initials for avatar
  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <div className="relative" ref={menuRef}>
        {/* Trigger button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-all group"
        >
          {/* Avatar */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-orange-500/20 group-hover:shadow-orange-500/30 transition-shadow">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full rounded-xl object-cover" />
            ) : (
              initials
            )}
          </div>

          {/* Name (hidden on mobile) */}
          <div className="hidden md:block text-left">
            <div className="text-sm font-semibold text-white truncate max-w-[120px]">
              {user.name}
            </div>
            <div className="text-xs text-slate-400 truncate max-w-[120px]">
              {user.email}
            </div>
          </div>

          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-72 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 py-2 z-50 animate-dropdown">
            {/* User info header */}
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-orange-500/20">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{user.name}</div>
                  <div className="text-sm text-slate-500 truncate">{user.email}</div>
                </div>
              </div>

              {/* Usage stats */}
              <div className="mt-3 p-2 bg-slate-50 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-medium text-slate-600">
                    {stats.analysisCount} analyses
                  </span>
                </div>
                <span className="text-xs text-slate-400">Free Plan</span>
              </div>
            </div>

            {/* Menu items */}
            <div className="py-2">
              {[
                { icon: User, label: 'Profile', onClick: () => setActiveModal('profile') },
                { icon: Settings, label: 'Settings', onClick: () => setActiveModal('settings') },
                { icon: HelpCircle, label: 'Help & Support', onClick: () => setActiveModal('help') },
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setIsOpen(false);
                    item.onClick();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <item.icon className="w-4 h-4 text-slate-400" />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Logout */}
            <div className="border-t border-slate-100 pt-2">
              <button
                onClick={handleLogout}
                disabled={isLoading}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium">Sign out</span>
              </button>
            </div>
          </div>
        )}

        <style>{`
            @keyframes dropdown {
            from {
                opacity: 0;
                transform: translateY(-10px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            }
            
            .animate-dropdown {
            animation: dropdown 0.2s ease-out;
            }
        `}</style>
      </div>

      <ProfileModal isOpen={activeModal === 'profile'} onClose={() => setActiveModal(null)} />
      <SettingsModal isOpen={activeModal === 'settings'} onClose={() => setActiveModal(null)} />
      <HelpModal isOpen={activeModal === 'help'} onClose={() => setActiveModal(null)} />
    </>
  );
};

export default UserMenu;

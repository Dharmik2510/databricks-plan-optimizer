import React from 'react';
import { Mail, Activity as ActivityIcon, Calendar, Edit2, Ban, CheckCircle } from 'lucide-react';
import { Badge, Button } from '../../../design-system/components';
import { StatusBadge } from '../shared/StatusBadge';

interface User {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
    isActive: boolean;
    analysisCount: number;
    quotaLimit: number;
    lastLoginAt?: string;
    createdAt: string;
    _count: {
        analyses: number;
        chatSessions: number;
    };
}

interface UserTableProps {
    users: User[];
    loading: boolean;
    onViewUser: (userId: string) => void;
    onSuspendUser: (userId: string) => void;
    onActivateUser: (userId: string) => void;
}

export const UserTable: React.FC<UserTableProps> = ({
    users,
    loading,
    onViewUser,
    onSuspendUser,
    onActivateUser
}) => {
    const getRoleBadgeVariant = (role: string): 'error' | 'warning' | 'default' => {
        switch (role) {
            case 'SUPER_ADMIN': return 'error';
            case 'ADMIN': return 'warning';
            default: return 'default';
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">User</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Usage</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Joined</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                                </td>
                            </tr>
                        ) : users.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                    No users found matching your criteria
                                </td>
                            </tr>
                        ) : (
                            users.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10">
                                                {user.avatar ? (
                                                    <img className="h-10 w-10 rounded-full ring-2 ring-white dark:ring-slate-800" src={user.avatar} alt="" />
                                                ) : (
                                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold ring-2 ring-white dark:ring-slate-800">
                                                        {user.name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{user.name}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                                    <Mail className="w-3 h-3" />
                                                    {user.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Badge variant={getRoleBadgeVariant(user.role)}>
                                            {user.role.replace('_', ' ')}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <StatusBadge
                                            status={user.isActive ? 'active' : 'inactive'}
                                            variant={user.isActive ? 'success' : 'error'}
                                            dot
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                                <ActivityIcon className="w-3.5 h-3.5 text-slate-400" />
                                                {user._count.analyses} analyses
                                            </span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400 ml-5">
                                                {user._count.chatSessions} chats
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => onViewUser(user.id)}
                                                className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                                title="Edit User"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            {user.isActive ? (
                                                <button
                                                    onClick={() => onSuspendUser(user.id)}
                                                    className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Suspend User"
                                                >
                                                    <Ban className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => onActivateUser(user.id)}
                                                    className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                    title="Activate User"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

import React from 'react';
import { Search, Filter, Activity } from 'lucide-react';
import { Input } from '../../../design-system/components';

interface UserFiltersProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    roleFilter: string;
    onRoleFilterChange: (value: string) => void;
    statusFilter: string;
    onStatusFilterChange: (value: string) => void;
}

export const UserFilters: React.FC<UserFiltersProps> = ({
    searchQuery,
    onSearchChange,
    roleFilter,
    onRoleFilterChange,
    statusFilter,
    onStatusFilterChange
}) => {
    return (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
                <Input
                    placeholder="Search by email or name..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    leftIcon={<Search className="w-5 h-5 text-slate-400" />}
                    className="w-full"
                />
            </div>
            <div className="flex gap-4">
                <div className="relative min-w-[150px]">
                    <select
                        value={roleFilter}
                        onChange={(e) => onRoleFilterChange(e.target.value)}
                        className="w-full h-10 px-4 pl-10 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                    >
                        <option value="">All Roles</option>
                        <option value="USER">User</option>
                        <option value="ADMIN">Admin</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                    </select>
                    <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>

                <div className="relative min-w-[150px]">
                    <select
                        value={statusFilter}
                        onChange={(e) => onStatusFilterChange(e.target.value)}
                        className="w-full h-10 px-4 pl-10 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                    >
                        <option value="">All Status</option>
                        <option value="true">Active</option>
                        <option value="false">Suspended</option>
                    </select>
                    <Activity className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
            </div>
        </div>
    );
};

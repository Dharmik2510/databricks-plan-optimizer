import React, { useState, useEffect } from 'react';
import { Button, Modal, Input } from '../../../design-system/components';
import * as adminAPI from '../../../api/admin';
import { RefreshCw, CheckCircle, Mail, Activity as ActivityIcon } from 'lucide-react';
import { AdminPageHeader } from '../shared/AdminPageHeader';
import { UserFilters } from './UserFilters';
import { UserTable } from './UserTable';

const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [activeFilter, setActiveFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({ role: '', quotaLimit: 100, isActive: true });

    useEffect(() => {
        loadUsers();
    }, [currentPage, searchQuery, roleFilter, activeFilter]);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const params: any = { page: currentPage, limit: 20 };
            if (searchQuery) params.search = searchQuery;
            if (roleFilter) params.role = roleFilter;
            if (activeFilter !== '') params.isActive = activeFilter === 'true';

            const response = await adminAPI.getAllUsers(params) as any;
            setUsers(response.users);
            setTotalPages(response.pagination.totalPages);
        } catch (error) {
            console.error('Failed to load users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewUser = async (userId: string) => {
        try {
            const userDetails = await adminAPI.getUserDetails(userId) as any;
            setSelectedUser(userDetails);
            setEditForm({
                role: userDetails.role,
                quotaLimit: userDetails.quotaLimit,
                isActive: userDetails.isActive,
            });
            setShowEditModal(true);
        } catch (error) {
            console.error('Failed to load user details:', error);
        }
    };

    const handleUpdateUser = async () => {
        if (!selectedUser) return;

        try {
            await adminAPI.updateUser(selectedUser.id, editForm);
            setShowEditModal(false);
            loadUsers();
        } catch (error) {
            console.error('Failed to update user:', error);
        }
    };

    const handleSuspendUser = async (userId: string) => {
        if (!confirm('Are you sure you want to suspend this user?')) return;

        try {
            await adminAPI.suspendUser(userId);
            loadUsers();
        } catch (error) {
            console.error('Failed to suspend user:', error);
        }
    };

    const handleActivateUser = async (userId: string) => {
        try {
            await adminAPI.activateUser(userId);
            loadUsers();
        } catch (error) {
            console.error('Failed to activate user:', error);
        }
    };

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="User Management"
                subtitle="Manage user accounts, permissions, and access controls"
            >
                <Button variant="outline" onClick={loadUsers} leftIcon={<RefreshCw className="w-4 h-4" />}>
                    Refresh List
                </Button>
            </AdminPageHeader>

            <UserFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                roleFilter={roleFilter}
                onRoleFilterChange={setRoleFilter}
                statusFilter={activeFilter}
                onStatusFilterChange={setActiveFilter}
            />

            <UserTable
                users={users}
                loading={loading}
                onViewUser={handleViewUser}
                onSuspendUser={handleSuspendUser}
                onActivateUser={handleActivateUser}
            />

            {totalPages > 1 && (
                <div className="flex items-center justify-between px-2">
                    <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {showEditModal && selectedUser && (
                <Modal
                    open={showEditModal}
                    onOpenChange={setShowEditModal}
                    title="Edit User Details"
                >
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold ring-4 ring-white dark:ring-slate-900 shadow-md">
                                {selectedUser.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedUser.name}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5" /> {selectedUser.email}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    System Role
                                </label>
                                <select
                                    value={editForm.role}
                                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="USER">User (Standard)</option>
                                    <option value="ADMIN">Admin (Elevated)</option>
                                    <option value="SUPER_ADMIN">Super Admin (Full Access)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Monthly Analysis Quota
                                </label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        value={editForm.quotaLimit}
                                        onChange={(e) => setEditForm({ ...editForm, quotaLimit: parseInt(e.target.value) })}
                                        className="pl-10"
                                    />
                                    <ActivityIcon className="absolute left-3 top-2.5 w-5 h-5 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer" onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}>
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${editForm.isActive ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                                    {editForm.isActive && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <div className="flex-1">
                                    <span className="text-sm font-semibold text-slate-900 dark:text-white block">Active Account</span>
                                    <span className="text-xs text-slate-500 block">User can log in and access platform</span>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Activity Log</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{selectedUser._count.analyses}</p>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-1">Total Analyses</p>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{selectedUser._count.chatSessions}</p>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-1">Chat Sessions</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button variant="ghost" onClick={() => setShowEditModal(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleUpdateUser} leftIcon={<CheckCircle className="w-4 h-4" />}>
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default UserManagement;

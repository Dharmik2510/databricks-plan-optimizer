import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Input, Modal } from '../../design-system/components';
import * as adminAPI from '../../api/admin';
import { Search, Filter, RefreshCw, Edit2, Ban, CheckCircle, User as UserIcon, MoreVertical, Mail, Calendar, Activity } from 'lucide-react';

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

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('');
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

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'error';
      case 'ADMIN': return 'warning';
      default: return 'default';
    }
  };

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">User Management</h1>
          <p className="text-slate-600 dark:text-slate-400">Manage user accounts, permissions, and access controls</p>
        </div>
        <Button variant="outline" onClick={loadUsers} leftIcon={<RefreshCw className="w-4 h-4" />}>
          Refresh List
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by email or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-5 h-5 text-slate-400" />}
            className="w-full"
          />
        </div>
        <div className="flex gap-4">
          <div className="relative min-w-[150px]">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
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
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
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

      {/* Users Table */}
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
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold w-fit ${user.isActive
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                        {user.isActive ? <CheckCircle className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                        {user.isActive ? 'Active' : 'Suspended'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-slate-400" />
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
                          onClick={() => handleViewUser(user.id)}
                          className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          title="Edit User"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {user.isActive ? (
                          <button
                            onClick={() => handleSuspendUser(user.id)}
                            className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Suspend User"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivateUser(user.id)}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
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
      </div>

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
                  <Activity className="absolute left-3 top-2.5 w-5 h-5 text-slate-400 pointer-events-none" />
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

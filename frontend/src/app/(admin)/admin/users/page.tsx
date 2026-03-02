'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useState } from 'react';

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: async () => {
      const { data } = await api.get('/admin/users', { params: search ? { search } : {} });
      return data;
    },
  });

  const toggleBan = async (userId: string, isBanned: boolean) => {
    try {
      await api.patch(`/admin/users/${userId}`, {
        isBanned: !isBanned,
        banReason: !isBanned ? 'Banned by admin' : undefined,
      });
      toast.success(isBanned ? 'User unbanned' : 'User banned');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch {
      toast.error('Failed to update user');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Users (Admin)</h1>

      <input
        type="text"
        placeholder="Search by username or name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md border border-gray-200 rounded-lg px-4 py-2 text-sm mb-6"
      />

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Telegram ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Reputation</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Deals</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.users?.map((u: any) => (
                  <tr key={u._id} className={`hover:bg-gray-50 ${u.isBanned ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.firstName} {u.lastName || ''}</div>
                      {u.username && <div className="text-gray-500 text-xs">@{u.username}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.telegramId}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        u.role === 'admin' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">{u.reputation?.score}</td>
                    <td className="px-4 py-3">{u.reputation?.completedDeals}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{format(new Date(u.createdAt), 'MMM d, yyyy')}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleBan(u._id, u.isBanned)}
                        className={`px-3 py-1 rounded text-xs font-medium ${
                          u.isBanned
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {u.isBanned ? 'Unban' : 'Ban'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

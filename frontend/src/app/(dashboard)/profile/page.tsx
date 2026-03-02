'use client';

import { useAuthStore } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { User, Star, CheckCircle, AlertTriangle } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get('/users/profile');
      return data;
    },
  });

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>

      {/* User info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{user.firstName} {user.lastName || ''}</h2>
            {user.username && <p className="text-gray-500">@{user.username}</p>}
            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
              user.role === 'admin' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {user.role}
            </span>
          </div>
        </div>
      </div>

      {/* Reputation */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" /> Reputation
        </h2>
        <div className="text-center mb-4">
          <div className="text-4xl font-bold text-primary-600">
            {profile?.reputation?.score || user.reputation.score}
          </div>
          <div className="text-gray-500 text-sm">Reputation Score</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-lg font-bold text-green-600">
              <CheckCircle className="w-5 h-5 mx-auto mb-1" />
              {profile?.reputation?.completedDeals || user.reputation.completedDeals}
            </div>
            <div className="text-xs text-gray-500">Completed</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-lg font-bold text-blue-600">
              {profile?.stats?.totalDeals || 0}
            </div>
            <div className="text-xs text-gray-500">Total Deals</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-lg font-bold text-green-600">
              {profile?.reputation?.disputesWon || user.reputation.disputesWon}
            </div>
            <div className="text-xs text-gray-500">Disputes Won</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-lg font-bold text-red-600">
              {profile?.reputation?.disputesLost || user.reputation.disputesLost}
            </div>
            <div className="text-xs text-gray-500">Disputes Lost</div>
          </div>
        </div>
      </div>
    </div>
  );
}

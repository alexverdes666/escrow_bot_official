'use client';

import { useAdminAnalytics } from '@/hooks/useDeals';
import Link from 'next/link';
import { BarChart3, Users, Scale, CheckCircle, AlertTriangle, FileText, Search } from 'lucide-react';

export default function AdminDashboard() {
  const { data: analytics, isLoading } = useAdminAnalytics();

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">Loading analytics...</div>;
  }

  const stats = [
    { label: 'Total Deals', value: analytics?.totalDeals || 0, icon: <FileText className="w-6 h-6" />, color: 'text-blue-600 bg-blue-50' },
    { label: 'Active Deals', value: analytics?.activeDeals || 0, icon: <BarChart3 className="w-6 h-6" />, color: 'text-purple-600 bg-purple-50' },
    { label: 'Completed', value: analytics?.completedDeals || 0, icon: <CheckCircle className="w-6 h-6" />, color: 'text-green-600 bg-green-50' },
    { label: 'Pending Reviews', value: analytics?.dealsByStatus?.pending_review || 0, icon: <Search className="w-6 h-6" />, color: 'text-amber-600 bg-amber-50' },
    { label: 'Open Disputes', value: analytics?.openDisputes || 0, icon: <AlertTriangle className="w-6 h-6" />, color: 'text-red-600 bg-red-50' },
    { label: 'Total Users', value: analytics?.totalUsers || 0, icon: <Users className="w-6 h-6" />, color: 'text-indigo-600 bg-indigo-50' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              {s.icon}
            </div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-sm text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid md:grid-cols-4 gap-4">
        <Link href="/admin/deals" className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition">
          <FileText className="w-8 h-8 text-blue-600 mb-2" />
          <h3 className="font-semibold">Manage Deals</h3>
          <p className="text-sm text-gray-500">View all deals, confirm payments</p>
        </Link>
        <Link href="/admin/disputes" className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition">
          <Scale className="w-8 h-8 text-red-600 mb-2" />
          <h3 className="font-semibold">Dispute Queue</h3>
          <p className="text-sm text-gray-500">{analytics?.openDisputes || 0} disputes awaiting resolution</p>
        </Link>
        <Link href="/admin/users" className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition">
          <Users className="w-8 h-8 text-indigo-600 mb-2" />
          <h3 className="font-semibold">Users</h3>
          <p className="text-sm text-gray-500">Manage user accounts and roles</p>
        </Link>
        <Link href="/admin/templates" className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition">
          <BarChart3 className="w-8 h-8 text-green-600 mb-2" />
          <h3 className="font-semibold">Templates</h3>
          <p className="text-sm text-gray-500">Manage deal templates</p>
        </Link>
      </div>

      {/* Deals by Status */}
      {analytics?.dealsByStatus && Object.keys(analytics.dealsByStatus).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mt-8">
          <h2 className="font-semibold mb-4">Deals by Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(analytics.dealsByStatus).map(([status, count]) => (
              <div key={status} className="bg-gray-50 p-3 rounded-lg text-center">
                <div className="font-bold text-lg">{count as number}</div>
                <div className="text-xs text-gray-500 capitalize">{status.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

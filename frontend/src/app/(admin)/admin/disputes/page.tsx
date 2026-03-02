'use client';

import { useAdminDisputes } from '@/hooks/useDeals';
import Link from 'next/link';
import { format } from 'date-fns';

export default function AdminDisputesPage() {
  const { data: disputes, isLoading } = useAdminDisputes();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dispute Queue (Admin)</h1>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : !disputes?.length ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">No open disputes.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute: any) => (
            <Link
              key={dispute._id}
              href={`/admin/disputes/${dispute._id}`}
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-semibold text-lg">Deal {dispute.dealId}</span>
                  <span className={`ml-3 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    dispute.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {dispute.status}
                  </span>
                </div>
                <span className="text-sm text-gray-400">
                  {format(new Date(dispute.createdAt), 'MMM d, yyyy HH:mm')}
                </span>
              </div>
              <p className="text-gray-600 text-sm mt-2">{dispute.reason}</p>
              <div className="flex gap-4 text-xs text-gray-400 mt-2">
                <span>Amount: {dispute.deal?.terms?.totalAmount} {dispute.deal?.terms?.currency}</span>
                <span>Opened by: @{dispute.openedBy?.username} ({dispute.openedByRole})</span>
                <span>Evidence: {dispute.evidence?.length || 0}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

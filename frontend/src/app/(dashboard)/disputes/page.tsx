'use client';

import { useDisputes } from '@/hooks/useDeals';
import { DealStatusBadge } from '@/components/deals/DealStatusBadge';
import Link from 'next/link';
import { format } from 'date-fns';

export default function DisputesPage() {
  const { data: disputes, isLoading } = useDisputes();

  const statusColors: Record<string, string> = {
    open: 'bg-red-100 text-red-700',
    under_review: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Disputes</h1>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading disputes...</div>
      ) : !disputes?.length ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">No disputes. That's a good thing!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute: any) => (
            <Link
              key={dispute._id}
              href={`/disputes/${dispute._id}`}
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-semibold text-lg">Deal {dispute.dealId}</span>
                  <span className="text-gray-400 text-sm ml-3">
                    opened by @{dispute.openedBy?.username || dispute.openedBy?.firstName}
                  </span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[dispute.status] || ''}`}>
                  {dispute.status}
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-2">{dispute.reason}</p>
              <div className="flex gap-4 text-xs text-gray-400">
                <span>Amount: {dispute.deal?.terms?.totalAmount} {dispute.deal?.terms?.currency}</span>
                <span>Evidence: {dispute.evidence?.length || 0}</span>
                <span>Messages: {dispute.messages?.length || 0}</span>
                <span>{format(new Date(dispute.createdAt), 'MMM d, yyyy')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useAdminDeals } from '@/hooks/useDeals';
import { DealStatusBadge } from '@/components/deals/DealStatusBadge';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState } from 'react';
import Link from 'next/link';

export default function AdminDealsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const params: Record<string, string> = {};
  if (statusFilter) params.status = statusFilter;
  if (search) params.search = search;

  const { data, isLoading } = useAdminDeals(params);
  const queryClient = useQueryClient();

  const confirmPayment = async (dealId: string) => {
    try {
      await api.patch(`/admin/deals/${dealId}/confirm-payment`);
      toast.success(`Payment confirmed for ${dealId}`);
      queryClient.invalidateQueries({ queryKey: ['admin-deals'] });
    } catch {
      toast.error('Failed to confirm payment');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">All Deals (Admin)</h1>

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by Deal ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="active">Active (Awaiting Payment)</option>
          <option value="payment_confirmed">Payment Confirmed</option>
          <option value="pending_review">Pending Review</option>
          <option value="delivered">Delivered</option>
          <option value="disputed">Disputed</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Deal ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Buyer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Seller</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.deals?.map((deal: any) => (
                  <tr key={deal._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{deal.dealId}</td>
                    <td className="px-4 py-3">@{deal.buyer?.username || deal.buyer?.firstName}</td>
                    <td className="px-4 py-3">@{deal.seller?.username || deal.seller?.firstName}</td>
                    <td className="px-4 py-3 font-medium">{deal.terms?.totalAmount} {deal.terms?.currency}</td>
                    <td className="px-4 py-3"><DealStatusBadge status={deal.status} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{format(new Date(deal.createdAt), 'MMM d, yyyy')}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {deal.status === 'active' && (
                          <button
                            onClick={() => confirmPayment(deal.dealId)}
                            className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                          >
                            Confirm Payment
                          </button>
                        )}
                        {deal.status === 'pending_review' && (
                          <Link
                            href={`/admin/deals/${deal.dealId}/deliverables`}
                            className="bg-amber-600 text-white px-3 py-1 rounded text-xs hover:bg-amber-700"
                          >
                            Review Deliverables
                          </Link>
                        )}
                      </div>
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

'use client';

import { useDeals } from '@/hooks/useDeals';
import { DealStatusBadge } from '@/components/deals/DealStatusBadge';
import { DealOriginBadge } from '@/components/deals/DealOriginBadge';
import { useAuthStore } from '@/lib/auth';
import Link from 'next/link';
import { format } from 'date-fns';
import { useState } from 'react';
import { Search, Filter } from 'lucide-react';

export default function DealsPage() {
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');

  const params: Record<string, string> = {};
  if (statusFilter) params.status = statusFilter;
  if (roleFilter) params.role = roleFilter;
  if (search) params.search = search;

  const { data, isLoading } = useDeals(params);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Deals</h1>
        <a
          href={`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          + New Deal on Telegram
        </a>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Deal ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="pending_agreement">Pending</option>
          <option value="active">Active</option>
          <option value="payment_confirmed">Paid</option>
          <option value="delivered">Delivered</option>
          <option value="completed">Completed</option>
          <option value="disputed">Disputed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Roles</option>
          <option value="buyer">As Buyer</option>
          <option value="seller">As Seller</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading deals...</div>
      ) : !data?.deals?.length ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 mb-2">No deals found.</p>
          <p className="text-sm text-gray-400">Create a new deal via the Telegram bot.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Deal ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Counterparty</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Origin</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.deals.map((deal: any) => {
                  const isBuyer = deal.buyer?.telegramId === user?.telegramId;
                  const counterparty = isBuyer ? deal.seller : deal.buyer;

                  return (
                    <tr key={deal._id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <Link href={`/deals/${deal.dealId}`} className="text-primary-600 font-medium hover:underline">
                          {deal.dealId}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">
                        {deal.terms?.description}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {counterparty?.username ? `@${counterparty.username}` : counterparty?.firstName}
                        <span className="text-xs text-gray-400 ml-1">({isBuyer ? 'seller' : 'buyer'})</span>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {deal.terms?.totalAmount} {deal.terms?.currency}
                      </td>
                      <td className="px-4 py-3">
                        <DealStatusBadge status={deal.status} />
                      </td>
                      <td className="px-4 py-3">
                        <DealOriginBadge origin={deal.origin} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {format(new Date(deal.createdAt), 'MMM d, yyyy')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.pagination && data.pagination.pages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-500 flex justify-between">
              <span>
                Showing {data.deals.length} of {data.pagination.total} deals
              </span>
              <span>Page {data.pagination.page} of {data.pagination.pages}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

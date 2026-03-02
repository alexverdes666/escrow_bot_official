'use client';

import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  pending_agreement: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' },
  active: { label: 'Active', className: 'bg-blue-100 text-blue-700' },
  payment_confirmed: { label: 'Paid', className: 'bg-indigo-100 text-indigo-700' },
  in_progress: { label: 'In Progress', className: 'bg-purple-100 text-purple-700' },
  delivered: { label: 'Delivered', className: 'bg-cyan-100 text-cyan-700' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
  disputed: { label: 'Disputed', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' },
  resolved: { label: 'Resolved', className: 'bg-emerald-100 text-emerald-700' },
};

export function DealStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-700' };

  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}

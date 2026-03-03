'use client';

import { useDeal } from '@/hooks/useDeals';
import { useParams } from 'next/navigation';
import { DealStatusBadge } from '@/components/deals/DealStatusBadge';
import { DealOriginBadge } from '@/components/deals/DealOriginBadge';
import { useAuthStore } from '@/lib/auth';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { ArrowLeft, ExternalLink, Paperclip, FileText, Image, Download } from 'lucide-react';
import Link from 'next/link';

export default function DealDetailPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const { data: deal, isLoading } = useDeal(dealId);
  const { user } = useAuthStore();

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">Loading deal...</div>;
  }

  if (!deal) {
    return <div className="text-center py-12 text-gray-500">Deal not found.</div>;
  }

  const isBuyer = deal.buyer?.telegramId === user?.telegramId;
  const counterparty = isBuyer ? deal.seller : deal.buyer;
  const payTypeLabels: Record<string, string> = {
    full_prepay: 'Full Prepay',
    partial_prepay: 'Partial Prepay',
    milestone: 'Milestone-Based',
    no_prepay: 'No Prepay',
    custom: 'Custom',
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/deals" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Deals
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">{deal.dealId}</h1>
            <p className="text-gray-500">
              {deal.templateName && <span className="mr-3">{deal.templateName}</span>}
              <DealOriginBadge origin={deal.origin} />
            </p>
          </div>
          <DealStatusBadge status={deal.status} />
        </div>

        <p className="text-gray-700 mb-4">{deal.terms.description}</p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Buyer</span>
              <span className="font-medium">{deal.buyer.username ? `@${deal.buyer.username}` : deal.buyer.firstName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Seller</span>
              <span className="font-medium">{deal.seller.username ? `@${deal.seller.username}` : deal.seller.firstName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Your Role</span>
              <span className="font-medium capitalize">{isBuyer ? 'Buyer' : 'Seller'}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Amount</span>
              <span className="font-bold text-lg">{deal.terms.totalAmount} {deal.terms.currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Payment Type</span>
              <span className="font-medium">{payTypeLabels[deal.terms.paymentType] || deal.terms.paymentType}</span>
            </div>
            {deal.terms.depositPercent && (
              <div className="flex justify-between">
                <span className="text-gray-500">Deposit</span>
                <span className="font-medium">{deal.terms.depositPercent}% ({deal.terms.depositAmount} {deal.terms.currency})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Milestones */}
      {deal.terms.milestones && deal.terms.milestones.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold mb-3">Milestones</h2>
          <div className="space-y-2">
            {deal.terms.milestones.map((m: any, i: number) => (
              <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium">{i + 1}. {m.title}</span>
                  {m.description && <p className="text-xs text-gray-500">{m.description}</p>}
                </div>
                <span className="font-medium">{m.amount} {deal.terms.currency}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terms & Conditions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold mb-3">Terms & Conditions</h2>
        <div className="grid sm:grid-cols-3 gap-4 mb-4 text-sm">
          {deal.terms.deliveryDeadlineDays && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-gray-500 text-xs">Delivery Deadline</div>
              <div className="font-medium">{deal.terms.deliveryDeadlineDays} days</div>
            </div>
          )}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-gray-500 text-xs">Auto-Release</div>
            <div className="font-medium">{deal.terms.autoReleaseDays} days after delivery</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-gray-500 text-xs">Dispute Window</div>
            <div className="font-medium">{deal.terms.disputeWindowDays} days</div>
          </div>
        </div>

        {deal.terms.buyerObligations && (
          <div className="mb-3">
            <h3 className="text-sm font-medium text-gray-600 mb-1">Buyer Obligations</h3>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{deal.terms.buyerObligations}</p>
          </div>
        )}
        {deal.terms.sellerObligations && (
          <div className="mb-3">
            <h3 className="text-sm font-medium text-gray-600 mb-1">Seller Obligations</h3>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{deal.terms.sellerObligations}</p>
          </div>
        )}
        {deal.terms.customConditions?.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Custom Conditions</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              {deal.terms.customConditions.map((c: string, i: number) => (
                <li key={i} className="bg-gray-50 p-2 rounded">&#x2022; {c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Attachments */}
      {deal.attachments?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Paperclip className="w-4 h-4" />
            Attachments ({deal.attachments.length})
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {deal.attachments.map((att: any) => {
              const fileUrl = `${api.defaults.baseURL}/deals/${deal.dealId}/attachments/${att._id}/file`;
              const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
              const authedUrl = token ? `${fileUrl}?token=${token}` : fileUrl;
              const isPhoto = att.fileType === 'photo';
              const uploaderName = att.uploadedBy?.username
                ? `@${att.uploadedBy.username}`
                : att.uploadedBy?.firstName || 'Unknown';

              return (
                <div key={att._id} className="border border-gray-100 rounded-lg overflow-hidden">
                  {isPhoto ? (
                    <a href={authedUrl} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={authedUrl}
                        alt={att.caption || 'Attachment'}
                        className="w-full h-40 object-cover bg-gray-100"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <a
                      href={authedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center h-40 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <FileText className="w-10 h-10 text-gray-400" />
                    </a>
                  )}
                  <div className="p-2">
                    <p className="text-sm font-medium truncate">
                      {att.fileName || (isPhoto ? 'Photo' : 'Document')}
                    </p>
                    <div className="flex justify-between items-center text-xs text-gray-400 mt-1">
                      <span>{uploaderName}</span>
                      <span>{format(new Date(att.uploadedAt), 'MMM d')}</span>
                    </div>
                    {att.caption && (
                      <p className="text-xs text-gray-500 mt-1 truncate">{att.caption}</p>
                    )}
                    <a
                      href={authedUrl}
                      download={att.fileName || true}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                    >
                      <Download className="w-3 h-3" /> Download
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Status Timeline */}
      {deal.statusHistory?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold mb-3">Timeline</h2>
          <div className="space-y-3">
            {deal.statusHistory.map((entry: any, i: number) => (
              <div key={i} className="flex gap-3 text-sm">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                <div>
                  <DealStatusBadge status={entry.status} />
                  {entry.note && <span className="text-gray-500 ml-2">{entry.note}</span>}
                  <div className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(entry.changedAt), 'MMM d, yyyy HH:mm')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

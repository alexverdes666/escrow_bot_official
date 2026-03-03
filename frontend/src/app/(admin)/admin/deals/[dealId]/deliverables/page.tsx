'use client';

import { useAdminDealDeliverables } from '@/hooks/useDeals';
import { useParams, useRouter } from 'next/navigation';
import { DealStatusBadge } from '@/components/deals/DealStatusBadge';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useState } from 'react';
import { ArrowLeft, FileText, Download, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

export default function AdminDeliverablesReviewPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const { data: deal, isLoading } = useAdminDealDeliverables(dealId);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await api.post(`/admin/deals/${dealId}/deliverables/approve`);
      toast.success('Deliverables approved');
      queryClient.invalidateQueries({ queryKey: ['admin-deals'] });
      router.push('/admin/deals');
    } catch {
      toast.error('Failed to approve deliverables');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/admin/deals/${dealId}/deliverables/reject`, { reason: rejectionReason });
      toast.success('Deliverables rejected');
      queryClient.invalidateQueries({ queryKey: ['admin-deals'] });
      router.push('/admin/deals');
    } catch {
      toast.error('Failed to reject deliverables');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  if (!deal) {
    return <div className="text-center py-12 text-gray-500">Deal not found.</div>;
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/admin/deals" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Deals
      </Link>

      {/* Deal Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Review Deliverables — {deal.dealId}</h1>
            <p className="text-gray-500">{deal.terms?.description}</p>
          </div>
          <DealStatusBadge status={deal.status} />
        </div>
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Buyer:</span>{' '}
            <span className="font-medium">@{deal.buyer?.username || deal.buyer?.firstName}</span>
          </div>
          <div>
            <span className="text-gray-500">Seller:</span>{' '}
            <span className="font-medium">@{deal.seller?.username || deal.seller?.firstName}</span>
          </div>
          <div>
            <span className="text-gray-500">Amount:</span>{' '}
            <span className="font-medium">{deal.terms?.totalAmount} {deal.terms?.currency}</span>
          </div>
        </div>
      </div>

      {/* Deliverables Grid */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold mb-4">
          Deliverable Files ({deal.deliverables?.length || 0})
        </h2>
        {(!deal.deliverables || deal.deliverables.length === 0) ? (
          <p className="text-gray-500">No deliverables uploaded.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {deal.deliverables.map((d: any) => {
              const fileUrl = `${api.defaults.baseURL}/deals/${deal.dealId}/deliverables/${d._id}/file`;
              const authedUrl = token ? `${fileUrl}?token=${token}` : fileUrl;
              const isPhoto = d.fileType === 'photo';

              return (
                <div key={d._id} className="border border-gray-100 rounded-lg overflow-hidden">
                  {isPhoto ? (
                    <a href={authedUrl} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={authedUrl}
                        alt={d.caption || 'Deliverable'}
                        className="w-full h-48 object-cover bg-gray-100"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <a
                      href={authedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center h-48 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <FileText className="w-12 h-12 text-gray-400" />
                    </a>
                  )}
                  <div className="p-3">
                    <p className="text-sm font-medium truncate">
                      {d.fileName || (isPhoto ? 'Photo' : 'Document')}
                    </p>
                    {d.caption && (
                      <p className="text-xs text-gray-500 mt-1 truncate">{d.caption}</p>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {d.uploadedAt && format(new Date(d.uploadedAt), 'MMM d, yyyy HH:mm')}
                    </div>
                    <a
                      href={authedUrl}
                      download={d.fileName || true}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                    >
                      <Download className="w-3 h-3" /> Download
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Approve / Reject Actions */}
      {deal.status === 'pending_review' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold mb-4">Review Decision</h2>

          {!showRejectForm ? (
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                Approve Deliverables
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                disabled={submitting}
                className="flex items-center gap-2 bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason for rejection (required)..."
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  disabled={submitting}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
                <button
                  onClick={() => { setShowRejectForm(false); setRejectionReason(''); }}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Previous Review Result */}
      {deal.deliverableReview && deal.status !== 'pending_review' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold mb-2">Review Result</h2>
          <p className="text-sm">
            Status: <span className="font-medium capitalize">{deal.deliverableReview.status}</span>
          </p>
          {deal.deliverableReview.rejectionReason && (
            <p className="text-sm text-red-600 mt-1">
              Reason: {deal.deliverableReview.rejectionReason}
            </p>
          )}
          {deal.deliverableReview.reviewedAt && (
            <p className="text-xs text-gray-400 mt-1">
              Reviewed: {format(new Date(deal.deliverableReview.reviewedAt), 'MMM d, yyyy HH:mm')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

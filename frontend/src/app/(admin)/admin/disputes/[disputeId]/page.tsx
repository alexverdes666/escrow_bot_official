'use client';

import { useDispute } from '@/hooks/useDeals';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function AdminDisputeResolvePage() {
  const { disputeId } = useParams<{ disputeId: string }>();
  const { data: dispute, isLoading } = useDispute(disputeId);
  const [decision, setDecision] = useState('');
  const [splitBuyer, setSplitBuyer] = useState(50);
  const [explanation, setExplanation] = useState('');
  const router = useRouter();
  const queryClient = useQueryClient();

  const resolveDispute = useMutation({
    mutationFn: async () => {
      await api.post(`/admin/disputes/${disputeId}/resolve`, {
        decision,
        splitPercent: decision === 'split' ? { buyer: splitBuyer, seller: 100 - splitBuyer } : undefined,
        explanation,
      });
    },
    onSuccess: () => {
      toast.success('Dispute resolved');
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
      router.push('/admin/disputes');
    },
    onError: () => {
      toast.error('Failed to resolve dispute');
    },
  });

  if (isLoading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (!dispute) return <div className="text-center py-12 text-gray-500">Dispute not found.</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/admin/disputes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Queue
      </Link>

      <h1 className="text-2xl font-bold mb-6">Resolve Dispute — {dispute.dealId}</h1>

      {/* Dispute info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <p className="mb-2"><strong>Reason:</strong> {dispute.reason}</p>
        <p className="mb-2"><strong>Opened by:</strong> @{dispute.openedBy?.username} ({dispute.openedByRole})</p>
        <p className="text-sm text-gray-500">
          Amount: {dispute.deal?.terms?.totalAmount} {dispute.deal?.terms?.currency}
        </p>
      </div>

      {/* Evidence */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold mb-3">Evidence ({dispute.evidence?.length || 0})</h2>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {dispute.evidence?.map((ev: any, i: number) => (
            <div key={i} className="bg-gray-50 p-3 rounded text-sm">
              <span className="text-xs text-gray-400">@{ev.submittedBy?.username} — {format(new Date(ev.submittedAt), 'MMM d, HH:mm')}</span>
              <p className="mt-1">{ev.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold mb-3">Messages ({dispute.messages?.length || 0})</h2>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {dispute.messages?.map((msg: any, i: number) => (
            <div key={i} className={`p-3 rounded text-sm ${msg.authorRole === 'admin' ? 'bg-orange-50' : 'bg-gray-50'}`}>
              <span className="text-xs text-gray-400">@{msg.author?.username} ({msg.authorRole})</span>
              <p className="mt-1">{msg.message}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Resolution form */}
      {dispute.status !== 'resolved' && (
        <div className="bg-white rounded-xl border-2 border-orange-200 p-6">
          <h2 className="font-semibold text-orange-700 mb-4">Resolution Decision</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Decision</label>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              >
                <option value="">Select decision...</option>
                <option value="release_to_seller">Release to Seller</option>
                <option value="refund_to_buyer">Refund to Buyer</option>
                <option value="split">Split Payment</option>
              </select>
            </div>

            {decision === 'split' && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Split: Buyer {splitBuyer}% / Seller {100 - splitBuyer}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={splitBuyer}
                  onChange={(e) => setSplitBuyer(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Explanation</label>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Explain the reasoning behind this decision..."
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <button
              onClick={() => resolveDispute.mutate()}
              disabled={!decision || !explanation || resolveDispute.isPending}
              className="w-full bg-orange-600 text-white py-3 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50"
            >
              {resolveDispute.isPending ? 'Resolving...' : 'Resolve Dispute'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

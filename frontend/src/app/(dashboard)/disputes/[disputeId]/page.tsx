'use client';

import { useDispute } from '@/hooks/useDeals';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { api } from '@/lib/api';
import { useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, Send, Upload, XCircle, FileText, Download } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function DisputeDetailPage() {
  const { disputeId } = useParams<{ disputeId: string }>();
  const { data: dispute, isLoading } = useDispute(disputeId);
  const { user } = useAuthStore();
  const [message, setMessage] = useState('');
  const [evidenceText, setEvidenceText] = useState('');
  const queryClient = useQueryClient();

  const closeDispute = useMutation({
    mutationFn: async () => {
      await api.post(`/disputes/${disputeId}/close`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispute', disputeId] });
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      toast.success('Dispute closed');
    },
    onError: () => {
      toast.error('Failed to close dispute');
    },
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      await api.post(`/disputes/${disputeId}/messages`, { message });
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['dispute', disputeId] });
      toast.success('Message sent');
    },
  });

  const submitEvidence = useMutation({
    mutationFn: async () => {
      await api.post(`/disputes/${disputeId}/evidence`, {
        type: 'text',
        content: evidenceText,
      });
    },
    onSuccess: () => {
      setEvidenceText('');
      queryClient.invalidateQueries({ queryKey: ['dispute', disputeId] });
      toast.success('Evidence submitted');
    },
  });

  if (isLoading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (!dispute) return <div className="text-center py-12 text-gray-500">Dispute not found.</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/disputes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Disputes
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-2xl font-bold">Dispute — {dispute.dealId}</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            dispute.status === 'open' ? 'bg-red-100 text-red-700' :
            dispute.status === 'resolved' ? 'bg-green-100 text-green-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {dispute.status}
          </span>
        </div>
        <p className="text-gray-600 mb-2"><strong>Reason:</strong> {dispute.reason}</p>
        <p className="text-gray-400 text-sm">
          Opened by @{dispute.openedBy?.username || dispute.openedBy?.firstName} ({dispute.openedByRole}) on {format(new Date(dispute.createdAt), 'MMM d, yyyy HH:mm')}
        </p>

        {dispute.status !== 'resolved' && dispute.status !== 'closed' && (
          <button
            onClick={() => {
              if (confirm('Are you sure you want to close this dispute? The deal will return to delivered status.')) {
                closeDispute.mutate();
              }
            }}
            disabled={closeDispute.isPending}
            className="mt-4 inline-flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-100 disabled:opacity-50 text-sm font-medium"
          >
            <XCircle className="w-4 h-4" />
            {closeDispute.isPending ? 'Closing...' : 'Withdraw / Close Dispute'}
          </button>
        )}
      </div>

      {/* Resolution (if resolved) */}
      {dispute.resolution?.decision && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-green-800 mb-2">Resolution</h2>
          <p className="text-green-700 font-medium capitalize mb-1">
            {dispute.resolution.decision.replace(/_/g, ' ')}
          </p>
          {dispute.resolution.explanation && (
            <p className="text-green-600 text-sm">{dispute.resolution.explanation}</p>
          )}
          {dispute.resolution.decidedAt && (
            <p className="text-green-500 text-xs mt-2">
              Decided on {format(new Date(dispute.resolution.decidedAt), 'MMM d, yyyy HH:mm')}
            </p>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Evidence */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold mb-3">Evidence ({dispute.evidence?.length || 0})</h2>
          <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
            {dispute.evidence?.map((ev: any, i: number) => {
              const isFile = ev.type === 'image' || ev.type === 'document';
              const fileUrl = isFile && ev._id
                ? `${api.defaults.baseURL}/disputes/${disputeId}/evidence/${ev._id}/file`
                : null;
              const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
              const authedUrl = fileUrl && token ? `${fileUrl}?token=${token}` : fileUrl;

              return (
                <div key={i} className="bg-gray-50 p-3 rounded-lg text-sm">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>@{ev.submittedBy?.username || 'user'}</span>
                    <span>{format(new Date(ev.submittedAt), 'MMM d, HH:mm')}</span>
                  </div>
                  {ev.type === 'image' && authedUrl ? (
                    <a href={authedUrl} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={authedUrl}
                        alt={ev.fileName || 'Evidence'}
                        className="max-h-48 rounded mt-1 bg-gray-200"
                        loading="lazy"
                      />
                    </a>
                  ) : ev.type === 'document' && authedUrl ? (
                    <a
                      href={authedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 mt-1 text-primary-600 hover:text-primary-700"
                    >
                      <FileText className="w-4 h-4" />
                      <span>{ev.fileName || 'Document'}</span>
                      <Download className="w-3 h-3" />
                    </a>
                  ) : (
                    <p className="text-gray-700">{ev.content}</p>
                  )}
                </div>
              );
            })}
          </div>

          {dispute.status !== 'resolved' && dispute.status !== 'closed' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add text evidence..."
                  value={evidenceText}
                  onChange={(e) => setEvidenceText(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={() => submitEvidence.mutate()}
                  disabled={!evidenceText || submitEvidence.isPending}
                  className="bg-primary-600 text-white px-3 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-400">
                File evidence can be submitted via the Telegram bot.
              </p>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold mb-3">Discussion ({dispute.messages?.length || 0})</h2>
          <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
            {dispute.messages?.map((msg: any, i: number) => (
              <div key={i} className={`p-3 rounded-lg text-sm ${
                msg.authorRole === 'admin' ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'
              }`}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={`font-medium ${
                    msg.authorRole === 'admin' ? 'text-orange-600' : 'text-gray-500'
                  }`}>
                    @{msg.author?.username || 'user'} ({msg.authorRole})
                  </span>
                  <span className="text-gray-400">{format(new Date(msg.createdAt), 'MMM d, HH:mm')}</span>
                </div>
                <p className="text-gray-700">{msg.message}</p>
              </div>
            ))}
          </div>

          {dispute.status !== 'resolved' && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !sendMessage.isPending && message && sendMessage.mutate()}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={() => sendMessage.mutate()}
                disabled={!message || sendMessage.isPending}
                className="bg-primary-600 text-white px-3 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

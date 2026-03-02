'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function AdminTemplatesPage() {
  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await api.get('/templates');
      return data;
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Deal Templates (Admin)</h1>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates?.map((t: any) => (
            <div key={t._id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{t.emoji}</span>
                <h3 className="font-semibold">{t.name}</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">{t.description}</p>
              <div className="text-xs text-gray-400 space-y-1">
                <div>Payment: {t.defaultTerms.paymentType.replace(/_/g, ' ')}</div>
                {t.defaultTerms.depositPercent && <div>Deposit: {t.defaultTerms.depositPercent}%</div>}
                <div>Auto-release: {t.defaultTerms.autoReleaseDays} days</div>
                <div>Dispute window: {t.defaultTerms.disputeWindowDays} days</div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded text-xs ${t.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {t.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className="text-xs text-gray-400">Order: {t.sortOrder}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

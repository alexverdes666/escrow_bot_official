'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState } from 'react';
import { Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';

const PAYMENT_TYPES = [
  { value: 'full_prepay', label: 'Full Prepay' },
  { value: 'partial_prepay', label: 'Partial Prepay' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'no_prepay', label: 'No Prepay' },
  { value: 'custom', label: 'Custom' },
];

const emptyForm = {
  name: '',
  slug: '',
  emoji: '📋',
  description: '',
  sortOrder: 0,
  isActive: true,
  defaultTerms: {
    paymentType: 'full_prepay',
    depositPercent: undefined as number | undefined,
    autoReleaseDays: 3,
    disputeWindowDays: 3,
    deliveryDeadlineDays: undefined as number | undefined,
    buyerObligations: '',
    sellerObligations: '',
    customConditions: [] as string[],
  },
};

type TemplateForm = typeof emptyForm;

export default function AdminTemplatesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<TemplateForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [conditionInput, setConditionInput] = useState('');

  const { data: templates, isLoading } = useQuery({
    queryKey: ['admin-templates'],
    queryFn: async () => {
      const { data } = await api.get('/templates/all');
      return data;
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (form: TemplateForm) => {
      await api.post('/templates', form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      toast.success('Template created');
      setEditing(null);
      setEditingId(null);
    },
    onError: () => toast.error('Failed to create template'),
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: TemplateForm }) => {
      await api.patch(`/templates/${id}`, form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      toast.success('Template updated');
      setEditing(null);
      setEditingId(null);
    },
    onError: () => toast.error('Failed to update template'),
  });

  const toggleTemplate = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.patch(`/templates/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      toast.success('Template toggled');
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      toast.success('Template deactivated');
    },
  });

  function openCreate() {
    setEditing({ ...emptyForm, defaultTerms: { ...emptyForm.defaultTerms, customConditions: [] } });
    setEditingId(null);
    setConditionInput('');
  }

  function openEdit(t: any) {
    setEditing({
      name: t.name,
      slug: t.slug,
      emoji: t.emoji || '📋',
      description: t.description,
      sortOrder: t.sortOrder || 0,
      isActive: t.isActive,
      defaultTerms: {
        paymentType: t.defaultTerms.paymentType,
        depositPercent: t.defaultTerms.depositPercent,
        autoReleaseDays: t.defaultTerms.autoReleaseDays || 3,
        disputeWindowDays: t.defaultTerms.disputeWindowDays || 3,
        deliveryDeadlineDays: t.defaultTerms.deliveryDeadlineDays,
        buyerObligations: t.defaultTerms.buyerObligations || '',
        sellerObligations: t.defaultTerms.sellerObligations || '',
        customConditions: t.defaultTerms.customConditions || [],
      },
    });
    setEditingId(t._id);
    setConditionInput('');
  }

  function handleSave() {
    if (!editing) return;
    // Auto-generate slug from name if empty
    const form = {
      ...editing,
      slug: editing.slug || editing.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, ''),
    };
    if (editingId) {
      updateTemplate.mutate({ id: editingId, form });
    } else {
      createTemplate.mutate(form);
    }
  }

  function addCondition() {
    if (!conditionInput.trim() || !editing) return;
    setEditing({
      ...editing,
      defaultTerms: {
        ...editing.defaultTerms,
        customConditions: [...editing.defaultTerms.customConditions, conditionInput.trim()],
      },
    });
    setConditionInput('');
  }

  function removeCondition(index: number) {
    if (!editing) return;
    setEditing({
      ...editing,
      defaultTerms: {
        ...editing.defaultTerms,
        customConditions: editing.defaultTerms.customConditions.filter((_, i) => i !== index),
      },
    });
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Deal Templates</h1>
        {!editing && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium"
          >
            <Plus className="w-4 h-4" /> New Template
          </button>
        )}
      </div>

      {/* Edit/Create Form */}
      {editing && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">{editingId ? 'Edit Template' : 'Create Template'}</h2>
            <button onClick={() => { setEditing(null); setEditingId(null); }} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Basic Info */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="e.g., Full Prepay"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input
                type="text"
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                placeholder="auto-generated from name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Emoji</label>
              <input
                type="text"
                value={editing.emoji}
                onChange={(e) => setEditing({ ...editing, emoji: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <input
                type="number"
                value={editing.sortOrder}
                onChange={(e) => setEditing({ ...editing, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                placeholder="What is this template for?"
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* Terms */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type *</label>
              <select
                value={editing.defaultTerms.paymentType}
                onChange={(e) => setEditing({
                  ...editing,
                  defaultTerms: { ...editing.defaultTerms, paymentType: e.target.value },
                })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {PAYMENT_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>{pt.label}</option>
                ))}
              </select>
            </div>
            {editing.defaultTerms.paymentType === 'partial_prepay' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deposit %</label>
                <input
                  type="number"
                  value={editing.defaultTerms.depositPercent || ''}
                  onChange={(e) => setEditing({
                    ...editing,
                    defaultTerms: { ...editing.defaultTerms, depositPercent: parseInt(e.target.value) || undefined },
                  })}
                  placeholder="e.g., 50"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Auto-release (days)</label>
              <input
                type="number"
                value={editing.defaultTerms.autoReleaseDays}
                onChange={(e) => setEditing({
                  ...editing,
                  defaultTerms: { ...editing.defaultTerms, autoReleaseDays: parseInt(e.target.value) || 3 },
                })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dispute Window (days)</label>
              <input
                type="number"
                value={editing.defaultTerms.disputeWindowDays}
                onChange={(e) => setEditing({
                  ...editing,
                  defaultTerms: { ...editing.defaultTerms, disputeWindowDays: parseInt(e.target.value) || 3 },
                })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Deadline (days)</label>
              <input
                type="number"
                value={editing.defaultTerms.deliveryDeadlineDays || ''}
                onChange={(e) => setEditing({
                  ...editing,
                  defaultTerms: { ...editing.defaultTerms, deliveryDeadlineDays: parseInt(e.target.value) || undefined },
                })}
                placeholder="Optional"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* Obligations */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Buyer Obligations</label>
              <textarea
                value={editing.defaultTerms.buyerObligations}
                onChange={(e) => setEditing({
                  ...editing,
                  defaultTerms: { ...editing.defaultTerms, buyerObligations: e.target.value },
                })}
                rows={2}
                placeholder="Optional"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Seller Obligations</label>
              <textarea
                value={editing.defaultTerms.sellerObligations}
                onChange={(e) => setEditing({
                  ...editing,
                  defaultTerms: { ...editing.defaultTerms, sellerObligations: e.target.value },
                })}
                rows={2}
                placeholder="Optional"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* Custom Conditions */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Custom Conditions</label>
              {editing.defaultTerms.customConditions.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {editing.defaultTerms.customConditions.map((c, i) => (
                    <li key={i} className="flex items-center gap-2 bg-gray-50 rounded px-3 py-1.5 text-sm">
                      <span className="flex-1">{c}</span>
                      <button onClick={() => removeCondition(i)} className="text-red-400 hover:text-red-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={conditionInput}
                  onChange={(e) => setConditionInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCondition())}
                  placeholder="Add a condition..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={addCondition}
                  disabled={!conditionInput.trim()}
                  className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 text-sm disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button
              onClick={() => { setEditing(null); setEditingId(null); }}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!editing.name || !editing.description || createTemplate.isPending || updateTemplate.isPending}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
            >
              {createTemplate.isPending || updateTemplate.isPending ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Template List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates?.map((t: any) => (
            <div key={t._id} className={`bg-white rounded-xl border p-5 ${t.isActive ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-60'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{t.emoji}</span>
                <h3 className="font-semibold flex-1">{t.name}</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">{t.description}</p>
              <div className="text-xs text-gray-400 space-y-1">
                <div>Payment: {t.defaultTerms.paymentType.replace(/_/g, ' ')}</div>
                {t.defaultTerms.depositPercent && <div>Deposit: {t.defaultTerms.depositPercent}%</div>}
                <div>Auto-release: {t.defaultTerms.autoReleaseDays} days</div>
                <div>Dispute window: {t.defaultTerms.disputeWindowDays} days</div>
                {t.defaultTerms.deliveryDeadlineDays && <div>Deadline: {t.defaultTerms.deliveryDeadlineDays} days</div>}
                {t.defaultTerms.customConditions?.length > 0 && (
                  <div>{t.defaultTerms.customConditions.length} condition(s)</div>
                )}
              </div>
              <div className="mt-4 pt-3 border-t flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleTemplate.mutate({ id: t._id, isActive: !t.isActive })}
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${
                      t.isActive ? 'text-green-700 bg-green-50 hover:bg-green-100' : 'text-gray-500 bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    {t.isActive ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                    {t.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <span className="text-xs text-gray-400">#{t.sortOrder}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(t)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Deactivate "${t.name}"? It will no longer appear in the bot.`)) {
                        deleteTemplate.mutate(t._id);
                      }
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Deactivate"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

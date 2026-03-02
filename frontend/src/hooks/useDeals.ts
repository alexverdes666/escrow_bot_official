'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useDeals(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['deals', params],
    queryFn: async () => {
      const { data } = await api.get('/deals', { params });
      return data;
    },
  });
}

export function useDeal(dealId: string) {
  return useQuery({
    queryKey: ['deal', dealId],
    queryFn: async () => {
      const { data } = await api.get(`/deals/${dealId}`);
      return data;
    },
    enabled: !!dealId,
  });
}

export function useDisputes() {
  return useQuery({
    queryKey: ['disputes'],
    queryFn: async () => {
      const { data } = await api.get('/disputes');
      return data;
    },
  });
}

export function useDispute(disputeId: string) {
  return useQuery({
    queryKey: ['dispute', disputeId],
    queryFn: async () => {
      const { data } = await api.get(`/disputes/${disputeId}`);
      return data;
    },
    enabled: !!disputeId,
  });
}

export function useAdminAnalytics() {
  return useQuery({
    queryKey: ['admin-analytics'],
    queryFn: async () => {
      const { data } = await api.get('/admin/analytics');
      return data;
    },
  });
}

export function useAdminDeals(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin-deals', params],
    queryFn: async () => {
      const { data } = await api.get('/admin/deals', { params });
      return data;
    },
  });
}

export function useAdminDisputes(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin-disputes', params],
    queryFn: async () => {
      const { data } = await api.get('/admin/disputes', { params });
      return data;
    },
  });
}

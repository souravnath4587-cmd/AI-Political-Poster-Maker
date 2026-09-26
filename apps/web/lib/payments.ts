'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type { PaidPlan, PaymentsResponse, StartPaymentResponse } from '@app/shared';
import { api } from './api';

export const PAYMENTS_QUERY_KEY = ['payments'] as const;

/** The user's last 10 payments. */
export function usePayments() {
  return useQuery({
    queryKey: PAYMENTS_QUERY_KEY,
    queryFn: async () => (await api<PaymentsResponse>('/payments/me')).payments,
    staleTime: 30_000,
  });
}

/** Starts a bKash payment and sends the browser to bKash's payment page. */
export function useBuyPlan() {
  return useMutation({
    mutationFn: (plan: PaidPlan) =>
      api<StartPaymentResponse>('/payments/bkash', { method: 'POST', body: { plan } }),
    onSuccess: ({ bkashURL }) => window.location.assign(bkashURL),
  });
}

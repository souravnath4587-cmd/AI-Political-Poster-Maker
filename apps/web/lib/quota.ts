'use client';

import { useQuery } from '@tanstack/react-query';
import type { QuotaResponse } from '@app/shared';
import { api } from './api';

export const QUOTA_QUERY_KEY = ['quota'] as const;

/** Today's usage and limits; refreshed after every poster/regeneration. */
export function useQuota() {
  return useQuery({
    queryKey: QUOTA_QUERY_KEY,
    queryFn: async () => (await api<QuotaResponse>('/quota')).quota,
    staleTime: 30_000,
  });
}

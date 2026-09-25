'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { AuthUser, MeResponse } from '@app/shared';
import { api, ApiError } from './api';

export const ME_QUERY_KEY = ['me'] as const;

/** The logged-in user, or null when there's no valid session. */
export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async (): Promise<AuthUser | null> => {
      try {
        return (await api<MeResponse>('/auth/me')).user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

/** Ends this session (or every session with `everywhere`) and returns to the login page. */
export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (everywhere: boolean = false) =>
      api<void>(everywhere ? '/auth/logout-all' : '/auth/logout', { method: 'POST' }),
    onSettled: () => {
      queryClient.setQueryData(ME_QUERY_KEY, null);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_QUERY_KEY[0] });
      router.replace('/login');
    },
  });
}

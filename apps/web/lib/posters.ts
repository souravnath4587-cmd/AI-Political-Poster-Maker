'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreatePosterInput,
  PosterListResponse,
  PosterResponse,
  RegeneratePosterInput,
  TemplateSummary,
  UploadKind,
  UploadResponse,
} from '@app/shared';
import { api, ApiError } from './api';
import { prepareImage } from './image';
import { QUOTA_QUERY_KEY } from './quota';

export type TemplateDetail = TemplateSummary & { defaults: Record<string, string> };

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => (await api<{ templates: TemplateSummary[] }>('/templates')).templates,
    staleTime: 5 * 60_000,
  });
}

export function useTemplate(id: string | null) {
  return useQuery({
    queryKey: ['template', id],
    queryFn: async () => (await api<{ template: TemplateDetail }>(`/templates/${id}`)).template,
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  });
}

export function useMyPosters() {
  return useQuery({
    queryKey: ['posters', 'me'],
    queryFn: async () => (await api<PosterListResponse>('/posters/me')).posters,
  });
}

export function usePoster(id: string) {
  return useQuery({
    queryKey: ['poster', id],
    queryFn: async () => (await api<PosterResponse>(`/posters/${id}`)).poster,
    retry: false,
  });
}

export function useCreatePoster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePosterInput) =>
      (await api<PosterResponse>('/posters', { method: 'POST', body: input })).poster,
    onSuccess: (poster) => {
      queryClient.setQueryData(['poster', poster.id], poster);
      void queryClient.invalidateQueries({ queryKey: ['posters', 'me'] });
    },
    // Counts change on success, and a QUOTA_EXCEEDED error means ours were stale.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: QUOTA_QUERY_KEY }),
  });
}

export function useRegeneratePoster(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegeneratePosterInput) =>
      (await api<PosterResponse>(`/posters/${id}/regenerate`, { method: 'POST', body: input }))
        .poster,
    onSuccess: (poster) => {
      queryClient.setQueryData(['poster', poster.id], poster);
      void queryClient.invalidateQueries({ queryKey: ['posters', 'me'] });
    },
    // Counts change on success, and a QUOTA_EXCEEDED error means ours were stale.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: QUOTA_QUERY_KEY }),
  });
}

/** Asks the API for a download link (rendering A3 first if needed) and starts the download. */
export async function downloadPoster(downloadPath: string): Promise<void> {
  const path = downloadPath.replace(/^\/api/, '');
  const { url } = await api<{ url: string }>(`${path}&format=json`);
  window.location.href = url;
}

/**
 * Uploads a photo with progress reporting (fetch() can't report upload progress, XHR can).
 * Rejects with ApiError, like api().
 */
export async function uploadPhoto(
  file: File,
  kind: UploadKind,
  onProgress: (fraction: number) => void,
): Promise<UploadResponse['upload']> {
  const blob = await prepareImage(file);
  const form = new FormData();
  form.append('kind', kind);
  form.append('photo', blob, file.name || 'photo.jpg');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK_ERROR', 'Network request failed'));
    xhr.onload = () => {
      let data: { upload?: UploadResponse['upload']; error?: Record<string, unknown> } | null =
        null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // handled below
      }
      if (xhr.status >= 200 && xhr.status < 300 && data?.upload) {
        resolve(data.upload);
        return;
      }
      const { code = 'UNKNOWN', message = xhr.statusText, ...details } = data?.error ?? {};
      reject(new ApiError(xhr.status, String(code), String(message), details));
    };
    xhr.send(form);
  });
}

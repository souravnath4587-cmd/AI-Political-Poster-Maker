/** An error response from the API (or a network failure, code NETWORK_ERROR). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Extra fields from the error body, e.g. retryAfterSec, attemptsLeft. */
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Calls the Express API through this app's /api rewrite, so the session cookie is first-party.
 * Throws ApiError for non-2xx responses.
 */
export async function api<T>(
  path: string,
  { method = 'GET', body }: { method?: string; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network request failed');
  }

  if (res.status === 204) return undefined as T;

  const data = (await res.json().catch(() => null)) as {
    error?: { code?: string; message?: string } & Record<string, unknown>;
  } | null;

  if (!res.ok) {
    const { code = 'UNKNOWN', message = res.statusText, ...details } = data?.error ?? {};
    throw new ApiError(res.status, code, message, details);
  }
  return data as T;
}

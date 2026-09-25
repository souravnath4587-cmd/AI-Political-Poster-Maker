'use client';

import { useEffect, useState } from 'react';
import type { HealthResponse } from '@app/shared';

type Status = 'loading' | 'ok' | 'error';

export function ApiStatus() {
  const [status, setStatus] = useState<Status>('loading');
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? (res.json() as Promise<HealthResponse>) : Promise.reject()))
      .then((data) => {
        setHealth(data);
        setStatus('ok');
      })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') return <p className="text-sm text-neutral-500">সার্ভার যাচাই হচ্ছে…</p>;
  if (status === 'error') return <p className="text-sm text-red-600">সার্ভারের সাথে সংযোগ হয়নি</p>;

  return (
    <p className="text-sm text-green-700">
      সার্ভার চালু আছে · ডাটাবেস {health?.db === 'connected' ? 'সংযুক্ত' : 'সংযুক্ত নয়'}
    </p>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { toBanglaDigits } from '@app/shared';

interface ResendTimerProps {
  /** Time (ms since epoch) when a new code may be requested. */
  availableAt: number;
  onResend: () => void;
  disabled?: boolean;
}

/** "আবার পাঠান (৪৫সে.)" countdown that becomes a button when it reaches zero. */
export function ResendTimer({ availableAt, onResend, disabled }: ResendTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (availableAt <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [availableAt]);

  const secondsLeft = Math.max(0, Math.ceil((availableAt - now) / 1000));
  const waiting = secondsLeft > 0;

  return (
    <button
      type="button"
      onClick={onResend}
      disabled={waiting || disabled}
      className="text-xs font-medium text-slate-500 underline underline-offset-4 enabled:hover:text-emerald-700 disabled:text-slate-400 disabled:no-underline"
    >
      {waiting ? `আবার পাঠান (${toBanglaDigits(secondsLeft)}সে.)` : 'আবার কোড পাঠান'}
    </button>
  );
}

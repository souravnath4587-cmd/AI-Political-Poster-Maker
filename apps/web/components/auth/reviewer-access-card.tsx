'use client';

import { formatBdPhoneLocal, toBanglaDigits, type AuthOptionsResponse } from '@app/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ReviewerAccessCardProps {
  options: AuthOptionsResponse;
  /** Fills the phone field with a reviewer number. */
  onUsePhone: (localPhone: string) => void;
  showDevCode: boolean;
  onShowDevCodeChange: (show: boolean) => void;
  /** The code from the last request, when the server runs in dev mode. */
  devCode?: string;
}

/**
 * Shown only when the API is configured with reviewer numbers: lets reviewers without a
 * Bangladeshi SIM log in as a free or a premium user.
 */
export function ReviewerAccessCard({
  options,
  onUsePhone,
  showDevCode,
  onShowDevCodeChange,
  devCode,
}: ReviewerAccessCardProps) {
  const { reviewer, devMode } = options;
  if (!reviewer && !devMode) return null;

  const accounts = reviewer
    ? [
        { label: 'ফ্রি অ্যাকাউন্ট', phone: formatBdPhoneLocal(reviewer.freePhone) },
        { label: 'প্রিমিয়াম অ্যাকাউন্ট', phone: formatBdPhoneLocal(reviewer.premiumPhone) },
      ]
    : [];

  return (
    <section
      aria-labelledby="reviewer-access-title"
      className="border-t border-slate-200 bg-white px-6 py-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="reviewer-access-title"
          className="flex items-center gap-2 text-sm font-semibold text-slate-700"
        >
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
          রিভিউয়ার এক্সেস
        </h2>
        {devMode && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-500">
            <button
              type="button"
              role="switch"
              aria-checked={showDevCode}
              onClick={() => onShowDevCodeChange(!showDevCode)}
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors',
                showDevCode ? 'bg-emerald-500' : 'bg-slate-200',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform',
                  showDevCode && 'translate-x-5',
                )}
              />
            </button>
            ডেভেলপার কোড
          </label>
        )}
      </div>

      <div className="mt-4 space-y-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm">
        {accounts.map((account) => (
          <div key={account.phone} className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500">{account.label}</div>
              <div className="font-medium text-slate-800 tabular-nums">
                {toBanglaDigits(account.phone)}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onUsePhone(account.phone)}
            >
              ব্যবহার করুন
            </Button>
          </div>
        ))}
        {reviewer && (
          <div className="text-slate-600">
            ফিক্সড কোড:{' '}
            <span className="font-semibold text-slate-800">{toBanglaDigits(reviewer.code)}</span>
          </div>
        )}
        {devMode && showDevCode && (
          <div className="text-slate-600">
            সর্বশেষ পাঠানো কোড:{' '}
            <span className="font-semibold text-emerald-700">
              {devCode ? toBanglaDigits(devCode) : 'এখনও কোনো কোড পাঠানো হয়নি'}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

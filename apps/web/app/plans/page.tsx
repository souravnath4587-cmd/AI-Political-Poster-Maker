'use client';

import { Check, Crown, Loader2, Minus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { QUOTA_LIMITS, toBanglaDigits, type UserPlan } from '@app/shared';
import { AppHeader } from '@/components/app-header';
import { QuotaCard } from '@/components/quota-card';
import { useMe } from '@/lib/auth';
import { useQuota } from '@/lib/quota';
import { cn } from '@/lib/utils';

const bn = toBanglaDigits;

interface Feature {
  label: string;
  /** Text for a limit, or true/false for yes/no. */
  value: string | boolean;
}

function features(plan: UserPlan): Feature[] {
  const limits = QUOTA_LIMITS[plan];
  return [
    { label: 'দিনে পোস্টার', value: `${bn(limits.posters)}টি` },
    { label: 'দিনে আবার তৈরি', value: `${bn(limits.regenerations)} বার` },
    { label: 'এআই শিরোনাম পরামর্শ', value: `দিনে ${bn(limits.headlines)}টি` },
    { label: '৪:৫ সোশ্যাল ও A3 প্রিন্ট ডাউনলোড', value: true },
    { label: 'ওয়াটারমার্ক ছাড়া', value: plan === 'premium' },
  ];
}

const PLANS: { plan: UserPlan; name: string; note: string }[] = [
  { plan: 'free', name: 'ফ্রি', note: 'সবার জন্য, কোনো খরচ নেই' },
  { plan: 'premium', name: 'প্রিমিয়াম', note: 'শীঘ্রই আসছে' },
];

export default function PlansPage() {
  const router = useRouter();
  const me = useMe();
  const quota = useQuota();

  // The cookie existed (proxy.ts let us in) but the session is gone or expired.
  useEffect(() => {
    if (me.data === null) router.replace('/login');
  }, [me.data, router]);

  if (!me.data) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-slate-400" aria-label="লোড হচ্ছে" />
      </main>
    );
  }

  const current = me.data.plan;

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <AppHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-900">প্ল্যান</h1>
          <p className="text-sm text-slate-500">দৈনিক সীমা প্রতিদিন রাত ১২টায় আবার পূর্ণ হয়।</p>
        </div>

        {quota.data && <QuotaCard quota={quota.data} />}

        <div className="grid gap-4 sm:grid-cols-2">
          {PLANS.map(({ plan, name, note }) => {
            const mine = plan === current;
            const premium = plan === 'premium';
            return (
              <section
                key={plan}
                aria-labelledby={`plan-${plan}`}
                className={cn(
                  'space-y-4 rounded-2xl border p-5 shadow-sm',
                  premium ? 'border-slate-700 bg-slate-900 text-white' : 'bg-white',
                  mine ? 'ring-2 ring-emerald-500' : premium ? '' : 'border-slate-200',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id={`plan-${plan}`} className="flex items-center gap-2 text-lg font-bold">
                      {premium && <Crown className="size-5 text-amber-400" aria-hidden />}
                      {name}
                    </h2>
                    <p className={cn('text-xs', premium ? 'text-slate-400' : 'text-slate-500')}>
                      {note}
                    </p>
                  </div>
                  {mine && (
                    <span
                      className={cn(
                        'shrink-0 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold',
                        premium ? 'text-emerald-300' : 'text-emerald-700',
                      )}
                    >
                      আপনার প্ল্যান
                    </span>
                  )}
                </div>

                <ul className="space-y-2.5 text-sm">
                  {features(plan).map(({ label, value }) => (
                    <li key={label} className="flex items-center justify-between gap-3">
                      <span className={premium ? 'text-slate-300' : 'text-slate-600'}>{label}</span>
                      {typeof value === 'string' ? (
                        <span className="font-semibold tabular-nums">{value}</span>
                      ) : value ? (
                        <Check className="size-4 text-emerald-500" aria-label="আছে" />
                      ) : (
                        <Minus className="size-4 text-slate-400" aria-label="নেই" />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-500">
          অনলাইন পেমেন্ট এখনও চালু হয়নি। প্রিমিয়াম চালু হলে এখানেই নেওয়া যাবে।
        </p>
      </main>
    </div>
  );
}

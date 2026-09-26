'use client';

import { Check, Crown, Loader2, Minus, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PLAN_PRICE_BDT, QUOTA_LIMITS, toBanglaDigits, type UserPlan } from '@app/shared';
import { AppHeader } from '@/components/app-header';
import { QuotaCard } from '@/components/quota-card';
import { useMe } from '@/lib/auth';
import { PLAN_LABELS_BN } from '@/lib/labels';
import { useQuota } from '@/lib/quota';
import { cn } from '@/lib/utils';

const bn = toBanglaDigits;
const UNLIMITED = 'আনলিমিটেড';

interface Feature {
  label: string;
  /** Text for a limit, or true/false for yes/no. */
  value: string | boolean;
}

function features(plan: UserPlan): Feature[] {
  const limits = QUOTA_LIMITS[plan];
  const perDay = (limit: number | null, unit: string) =>
    limit === null ? UNLIMITED : `${bn(limit)}${unit}`;
  return [
    { label: 'দিনে পোস্টার', value: perDay(limits.posters, 'টি') },
    { label: 'দিনে আবার তৈরি', value: perDay(limits.regenerations, ' বার') },
    {
      label: 'এআই শিরোনাম পরামর্শ',
      value: limits.headlines === null ? UNLIMITED : `দিনে ${bn(limits.headlines)}টি`,
    },
    { label: '৪:৫ সোশ্যাল ও A3 প্রিন্ট ডাউনলোড', value: true },
    { label: 'ওয়াটারমার্ক ছাড়া', value: plan !== 'free' },
  ];
}

/** Card look per plan: free is plain, pro is dark, premium is gold. */
const PLANS: {
  plan: UserPlan;
  note: string;
  card: string;
  muted: string;
  label: string;
  badge: string;
  icon?: typeof Crown;
  iconClass?: string;
}[] = [
  {
    plan: 'free',
    note: 'সবার জন্য, কোনো খরচ নেই',
    card: 'border-slate-200 bg-white',
    muted: 'text-slate-500',
    label: 'text-slate-600',
    badge: 'text-emerald-700',
  },
  {
    plan: 'pro',
    note: 'শীঘ্রই আসছে',
    card: 'border-slate-700 bg-slate-900 text-white',
    muted: 'text-slate-400',
    label: 'text-slate-300',
    badge: 'text-emerald-300',
    icon: Zap,
    iconClass: 'text-emerald-400',
  },
  {
    plan: 'premium',
    note: 'সব সুবিধা আনলিমিটেড · শীঘ্রই আসছে',
    card: 'border-amber-300 bg-gradient-to-br from-amber-50 via-white to-amber-100 text-slate-900',
    muted: 'text-amber-800',
    label: 'text-slate-600',
    badge: 'text-emerald-700',
    icon: Crown,
    iconClass: 'text-amber-500',
  },
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
          <p className="text-sm text-slate-500">
            সব প্ল্যান মাসিক। দৈনিক সীমা প্রতিদিন রাত ১২টায় আবার পূর্ণ হয়।
          </p>
        </div>

        {quota.data && <QuotaCard quota={quota.data} />}

        <div className="grid gap-4">
          {PLANS.map(({ plan, note, card, muted, label, badge, icon: Icon, iconClass }) => {
            const mine = plan === current;
            const price = PLAN_PRICE_BDT[plan];
            return (
              <section
                key={plan}
                aria-labelledby={`plan-${plan}`}
                className={cn(
                  'space-y-4 rounded-2xl border p-5 shadow-sm',
                  card,
                  mine && 'ring-2 ring-emerald-500',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id={`plan-${plan}`} className="flex items-center gap-2 text-lg font-bold">
                      {Icon && <Icon className={cn('size-5', iconClass)} aria-hidden />}
                      {PLAN_LABELS_BN[plan]}
                    </h2>
                    <p className={cn('text-xs', muted)}>{note}</p>
                  </div>
                  {mine && (
                    <span
                      className={cn(
                        'shrink-0 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold',
                        badge,
                      )}
                    >
                      আপনার প্ল্যান
                    </span>
                  )}
                </div>

                <p className="flex items-baseline gap-1">
                  {price === 0 ? (
                    <span className="text-3xl font-bold">বিনামূল্যে</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold tabular-nums">৳{bn(price)}</span>
                      <span className={cn('text-sm', muted)}>/ মাস</span>
                    </>
                  )}
                </p>

                <ul className="space-y-2.5 text-sm">
                  {features(plan).map((feature) => (
                    <li key={feature.label} className="flex items-center justify-between gap-3">
                      <span className={label}>{feature.label}</span>
                      {typeof feature.value === 'string' ? (
                        <span className="font-semibold tabular-nums">{feature.value}</span>
                      ) : feature.value ? (
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
          অনলাইন পেমেন্ট এখনও চালু হয়নি। প্রো ও প্রিমিয়াম চালু হলে এখানেই নেওয়া যাবে।
        </p>
      </main>
    </div>
  );
}

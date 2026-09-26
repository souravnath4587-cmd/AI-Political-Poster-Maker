'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, Crown, Loader2, Minus, XCircle, Zap } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import {
  PLAN_DURATION_DAYS,
  PLAN_PRICE_BDT,
  QUOTA_LIMITS,
  toBanglaDigits,
  type AuthUser,
  type PaidPlan,
  type PaymentDto,
  type UserPlan,
} from '@app/shared';
import { AppHeader } from '@/components/app-header';
import { QuotaCard } from '@/components/quota-card';
import { Button } from '@/components/ui/button';
import { ME_QUERY_KEY, useMe } from '@/lib/auth';
import { PLAN_LABELS_BN } from '@/lib/labels';
import { errorMessage } from '@/lib/messages';
import { PAYMENTS_QUERY_KEY, useBuyPlan, usePayments } from '@/lib/payments';
import { QUOTA_QUERY_KEY, useQuota } from '@/lib/quota';
import { cn } from '@/lib/utils';

const bn = toBanglaDigits;
const UNLIMITED = 'আনলিমিটেড';

const dateFormat = new Intl.DateTimeFormat('bn-BD', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

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
    note: 'বেশি পোস্টার, ওয়াটারমার্ক ছাড়া',
    card: 'border-slate-700 bg-slate-900 text-white',
    muted: 'text-slate-400',
    label: 'text-slate-300',
    badge: 'text-emerald-300',
    icon: Zap,
    iconClass: 'text-emerald-400',
  },
  {
    plan: 'premium',
    note: 'সব সুবিধা আনলিমিটেড',
    card: 'border-amber-300 bg-gradient-to-br from-amber-50 via-white to-amber-100 text-slate-900',
    muted: 'text-amber-800',
    label: 'text-slate-600',
    badge: 'text-emerald-700',
    icon: Crown,
    iconClass: 'text-amber-500',
  },
];

/** What the buy button on a paid plan's card says, or why it's disabled. */
function buyAction(user: AuthUser, plan: PaidPlan): { label: string; disabled?: boolean } {
  const price = `৳${bn(PLAN_PRICE_BDT[plan])}`;
  if (user.plan === 'premium' && plan === 'pro') {
    return { label: 'প্রিমিয়াম চালু আছে', disabled: true };
  }
  if (user.plan === plan) {
    return user.planExpiresAt
      ? { label: `মেয়াদ ${bn(PLAN_DURATION_DAYS)} দিন বাড়ান · ${price}` }
      : { label: 'মেয়াদ ছাড়াই চালু আছে', disabled: true };
  }
  if (user.plan === 'pro' && plan === 'premium') {
    return { label: `প্রিমিয়ামে আপগ্রেড করুন · ${price}` };
  }
  return { label: `বিকাশ দিয়ে কিনুন · ${price}` };
}

const RESULT_BANNERS: Record<string, { ok: boolean; text: string }> = {
  success: { ok: true, text: 'পেমেন্ট সফল হয়েছে। আপনার প্ল্যান চালু হয়েছে।' },
  pending: { ok: true, text: 'পেমেন্ট যাচাই হচ্ছে। কিছুক্ষণ পর পাতাটি আবার দেখুন।' },
  cancelled: { ok: false, text: 'পেমেন্ট বাতিল করা হয়েছে। কোনো টাকা কাটা হয়নি।' },
  failed: {
    ok: false,
    text: 'পেমেন্ট সম্পন্ন হয়নি। টাকা কেটে থাকলে পেমেন্টের ইতিহাসে দেখুন বা আমাদের জানান।',
  },
};

const STATUS_LABELS: Record<PaymentDto['status'], string> = {
  pending: 'অসম্পূর্ণ',
  processing: 'যাচাই হচ্ছে',
  completed: 'সফল',
  failed: 'ব্যর্থ',
  cancelled: 'বাতিল',
};

export function PlansView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe();
  const quota = useQuota();
  const payments = usePayments();
  const buy = useBuyPlan();
  const result = useSearchParams().get('payment');
  const banner = result ? RESULT_BANNERS[result] : undefined;

  // The cookie existed (proxy.ts let us in) but the session is gone or expired.
  useEffect(() => {
    if (me.data === null) router.replace('/login');
  }, [me.data, router]);

  // Back from bKash: the plan, quota and history may have changed.
  useEffect(() => {
    if (!result) return;
    for (const key of [ME_QUERY_KEY, QUOTA_QUERY_KEY, PAYMENTS_QUERY_KEY]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  }, [result, queryClient]);

  if (!me.data) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-slate-400" aria-label="লোড হচ্ছে" />
      </main>
    );
  }

  const user = me.data;

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

        {banner && (
          <div
            role="status"
            className={cn(
              'flex items-start gap-3 rounded-2xl border p-4 text-sm font-medium',
              banner.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800',
            )}
          >
            {banner.ok ? (
              <CheckCircle2 className="size-5 shrink-0" aria-hidden />
            ) : (
              <XCircle className="size-5 shrink-0" aria-hidden />
            )}
            {banner.text}
          </div>
        )}

        {quota.data && <QuotaCard quota={quota.data} />}

        <div className="grid gap-4">
          {PLANS.map(({ plan, note, card, muted, label, badge, icon: Icon, iconClass }) => {
            const mine = plan === user.plan;
            const price = PLAN_PRICE_BDT[plan];
            const action = plan === 'free' ? null : buyAction(user, plan);
            const buying = buy.isPending && buy.variables === plan;
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

                <div>
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
                  {mine && user.planExpiresAt && (
                    <p className={cn('mt-1 text-xs font-medium', muted)}>
                      মেয়াদ শেষ: {dateFormat.format(new Date(user.planExpiresAt))}
                    </p>
                  )}
                </div>

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

                {plan !== 'free' && action && (
                  <div className="space-y-2">
                    <Button
                      onClick={() => buy.mutate(plan)}
                      disabled={action.disabled || buy.isPending}
                      className="h-12 w-full bg-[#e2136e] text-base font-bold text-white hover:bg-[#c50f5f] disabled:bg-slate-300 disabled:text-slate-600"
                    >
                      {buying && <Loader2 className="animate-spin" aria-hidden />}
                      {buying ? 'বিকাশে নিয়ে যাওয়া হচ্ছে…' : action.label}
                    </Button>
                    {buy.isError && buy.variables === plan && (
                      <p role="alert" className="text-sm font-medium text-red-600">
                        {errorMessage(buy.error)}
                      </p>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-500">
          পেমেন্ট হয় বিকাশের মাধ্যমে। প্রতিটি পেমেন্টে {bn(PLAN_DURATION_DAYS)} দিনের প্ল্যান; নিজে
          থেকে নবায়ন হয় না। প্রো থেকে প্রিমিয়ামে গেলে প্রো-র বাকি দিনগুলো প্রিমিয়ামে যোগ হয়।
        </p>

        {payments.data && payments.data.length > 0 && (
          <section aria-labelledby="payments-title" className="space-y-3">
            <h2 id="payments-title" className="text-sm font-bold text-slate-900">
              পেমেন্টের ইতিহাস
            </h2>
            <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
              {payments.data.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      {PLAN_LABELS_BN[p.plan]} · ৳{bn(p.amountBdt)}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {dateFormat.format(new Date(p.createdAt))}
                      {p.trxId && ` · TrxID ${p.trxId}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                      p.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : p.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {STATUS_LABELS[p.status]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

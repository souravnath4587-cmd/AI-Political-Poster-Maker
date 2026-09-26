'use client';

import { ChevronRight, History, LayoutTemplate, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  formatBdPhoneLocal,
  occasionTypeSchema,
  PLAN_PRICE_BDT,
  toBanglaDigits,
  type OccasionType,
} from '@app/shared';
import { AppHeader } from '@/components/app-header';
import { QuotaCard } from '@/components/quota-card';
import { Button } from '@/components/ui/button';
import { useLogout, useMe } from '@/lib/auth';
import { OCCASION_LABELS_BN, PLAN_LABELS_BN } from '@/lib/labels';
import { errorMessage } from '@/lib/messages';
import { useMyPosters, useTemplates } from '@/lib/posters';
import { useQuota } from '@/lib/quota';

const dateFormat = new Intl.DateTimeFormat('bn-BD', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export default function Dashboard() {
  const router = useRouter();
  const me = useMe();
  const logout = useLogout();
  const templates = useTemplates();
  const posters = useMyPosters();
  const quota = useQuota();
  const [occasion, setOccasion] = useState<OccasionType | 'all'>('all');

  // Only categories that have templates, in the usual occasion order.
  const occasions = useMemo(() => {
    const used = new Set(templates.data?.map((t) => t.occasionType));
    return occasionTypeSchema.options.filter((o) => used.has(o));
  }, [templates.data]);
  const shownTemplates = templates.data?.filter(
    (t) => occasion === 'all' || t.occasionType === occasion,
  );

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

  const user = me.data;
  const paid = user.plan !== 'free';

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <AppHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-4 py-6 sm:px-6">
        {/* Greeting and plan */}
        <section className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">স্বাগতম!</h1>
            <p className="text-sm text-slate-500 tabular-nums">
              {toBanglaDigits(formatBdPhoneLocal(user.phone))}
            </p>
          </div>
          <span
            className={
              paid
                ? 'rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800'
                : 'rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-700'
            }
          >
            {PLAN_LABELS_BN[user.plan]} অ্যাকাউন্ট
          </span>
        </section>

        {quota.data && <QuotaCard quota={quota.data} />}

        {/* Paid plans (payments are deferred: admins assign them for now) */}
        {!paid && (
          <Link
            href="/plans"
            className="block rounded-2xl border border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 p-4 shadow-lg transition-shadow hover:shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="font-bold text-white">প্রো বা প্রিমিয়াম নিন</h2>
                <p className="text-xs text-slate-400">
                  প্রো মাসে ৳{toBanglaDigits(PLAN_PRICE_BDT.pro)} · প্রিমিয়াম মাসে ৳
                  {toBanglaDigits(PLAN_PRICE_BDT.premium)}, সব আনলিমিটেড
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                শীঘ্রই আসছে
              </span>
            </div>
          </Link>
        )}

        {/* Templates */}
        <section className="space-y-4" aria-labelledby="templates-title">
          <h2
            id="templates-title"
            className="flex items-center gap-2 text-sm font-bold text-slate-900"
          >
            <LayoutTemplate className="size-4 text-emerald-600" aria-hidden />
            টেমপ্লেট বেছে নিন
          </h2>

          {occasions.length > 1 && (
            <div
              role="group"
              aria-label="ধরন অনুযায়ী টেমপ্লেট দেখুন"
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6"
            >
              {(['all', ...occasions] as const).map((value) => {
                const active = occasion === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setOccasion(value)}
                    className={
                      active
                        ? 'min-h-10 flex-none rounded-full border border-emerald-600 bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm'
                        : 'min-h-10 flex-none rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-emerald-500 hover:text-emerald-700'
                    }
                  >
                    {value === 'all' ? 'সব' : OCCASION_LABELS_BN[value]}
                  </button>
                );
              })}
            </div>
          )}

          {templates.isPending && (
            <div className="grid grid-cols-2 gap-4">
              {[0, 1].map((i) => (
                <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-slate-200" />
              ))}
            </div>
          )}
          {templates.isError && (
            <p className="text-sm text-red-600">{errorMessage(templates.error)}</p>
          )}
          {shownTemplates && (
            <div className="grid grid-cols-2 gap-4">
              {shownTemplates.map((template) => (
                <Link
                  key={template.id}
                  href={`/posters/new?template=${template.id}`}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-emerald-500 hover:shadow-md active:scale-[0.98]"
                >
                  <div className="aspect-[4/5] overflow-hidden bg-slate-100">
                    <img
                      src={template.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="space-y-0.5 p-3">
                    <h3 className="text-sm leading-snug font-bold text-slate-900">
                      {template.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {OCCASION_LABELS_BN[template.occasionType]}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* History */}
        <section className="space-y-4" aria-labelledby="history-title">
          <div className="flex items-center justify-between">
            <h2
              id="history-title"
              className="flex items-center gap-2 text-sm font-bold text-slate-900"
            >
              <History className="size-4 text-emerald-600" aria-hidden />
              আপনার পোস্টার
            </h2>
            {posters.data && posters.data.length > 0 && (
              <Link
                href="/history"
                className="inline-flex min-h-10 items-center -my-2.5 py-2.5 px-2 -mr-2 text-xs font-semibold text-emerald-700"
              >
                সবগুলো দেখুন
              </Link>
            )}
          </div>

          {posters.data?.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
              এখনও কোনো পোস্টার নেই। উপরের একটি টেমপ্লেট বেছে নিয়ে শুরু করুন।
            </p>
          )}
          {posters.data && posters.data.length > 0 && (
            <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
              {posters.data.map((poster) => (
                <Link
                  key={poster.id}
                  href={`/posters/${poster.id}`}
                  className="w-36 flex-none space-y-2"
                >
                  <div className="aspect-[4/5] overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
                    {poster.previewUrl && (
                      <img src={poster.previewUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <p className="truncate px-1 text-xs font-bold text-slate-800">
                    {poster.template.title}
                  </p>
                  <p className="flex items-center justify-between px-1 text-[11px] text-slate-400">
                    {dateFormat.format(new Date(poster.createdAt))}
                    <ChevronRight className="size-3" aria-hidden />
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <Button
          variant="outline"
          onClick={() => logout.mutate(true)}
          disabled={logout.isPending}
          className="h-11 w-full"
        >
          সব ডিভাইস থেকে লগআউট
        </Button>
      </main>
    </div>
  );
}

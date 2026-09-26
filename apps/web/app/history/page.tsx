'use client';

import { Loader2, Printer, Smartphone, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { OutputSize, PosterDto } from '@app/shared';
import { AppHeader } from '@/components/app-header';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/messages';
import { downloadPoster, useDeletePoster, usePosterHistory } from '@/lib/posters';

const dateFormat = new Intl.DateTimeFormat('bn-BD', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export default function HistoryPage() {
  const history = usePosterHistory();
  const posters = history.data?.pages.flatMap((p) => p.posters) ?? [];

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <h1 className="text-xl font-bold text-slate-900">আমার পোস্টার</h1>
        {history.isPending && (
          <Loader2 className="mx-auto size-6 animate-spin text-slate-400" aria-label="লোড হচ্ছে" />
        )}
        {history.isError && <FormAlert>{errorMessage(history.error)}</FormAlert>}
        {history.data && posters.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
            এখনও কোনো পোস্টার নেই।{' '}
            <Link href="/" className="font-medium text-emerald-700 underline">
              একটি টেমপ্লেট বেছে নিন
            </Link>
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          {posters.map((poster) => (
            <HistoryCard key={poster.id} poster={poster} />
          ))}
        </div>

        {history.hasNextPage && (
          <Button
            variant="outline"
            onClick={() => void history.fetchNextPage()}
            disabled={history.isFetchingNextPage}
            className="w-full"
          >
            {history.isFetchingNextPage && <Loader2 className="animate-spin" aria-hidden />}
            আরও দেখুন
          </Button>
        )}
      </main>
    </div>
  );
}

function HistoryCard({ poster }: { poster: PosterDto }) {
  const remove = useDeletePoster();
  const [confirming, setConfirming] = useState(false);
  const [downloading, setDownloading] = useState<OutputSize | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(size: OutputSize) {
    setDownloading(size);
    setError(null);
    try {
      await downloadPoster(poster.downloads[size]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDownloading(null);
    }
  }

  const iconButton =
    'flex flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white py-3 text-slate-600 hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50';

  return (
    <article className="space-y-2">
      <Link
        href={`/posters/${poster.id}`}
        className="block aspect-[4/5] overflow-hidden rounded-xl border border-slate-200 bg-slate-200"
      >
        {poster.previewUrl && (
          <img src={poster.previewUrl} alt="" className="h-full w-full object-cover" />
        )}
      </Link>
      <div className="px-1">
        <h2 className="truncate text-xs font-bold text-slate-800">{poster.template.title}</h2>
        <p className="text-[11px] text-slate-400">
          {dateFormat.format(new Date(poster.createdAt))}
        </p>
      </div>

      {confirming ? (
        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-2 text-center">
          <p className="text-xs font-semibold text-red-700">পোস্টার ও এর ছবি মুছে ফেলবেন?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                remove.mutate(poster.id, { onError: (err) => setError(errorMessage(err)) })
              }
              disabled={remove.isPending}
              className="flex-1 rounded-md bg-red-600 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {remove.isPending ? 'মুছছে…' : 'হ্যাঁ, মুছুন'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={remove.isPending}
              className="flex-1 rounded-md border border-slate-300 bg-white py-1.5 text-xs"
            >
              না
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => void download('a3')}
            disabled={downloading !== null}
            className={iconButton}
            aria-label="A3 প্রিন্ট ডাউনলোড"
            title="A3 প্রিন্ট"
          >
            {downloading === 'a3' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Printer className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => void download('social45')}
            disabled={downloading !== null}
            className={iconButton}
            aria-label="সোশ্যাল মিডিয়া ডাউনলোড"
            title="সোশ্যাল ৪:৫"
          >
            {downloading === 'social45' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Smartphone className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={`${iconButton} hover:border-red-400 hover:text-red-600`}
            aria-label="পোস্টার মুছুন"
            title="মুছুন"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      )}
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </article>
  );
}

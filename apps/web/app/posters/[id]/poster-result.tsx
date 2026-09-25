'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Download, Loader2, Pencil, Printer, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  posterTextSchema,
  toBanglaDigits,
  type OutputSize,
  type PosterDto,
  type PosterText,
} from '@app/shared';
import { AppHeader } from '@/components/app-header';
import { FormAlert } from '@/components/auth/form-alert';
import { HeadlineSuggestions } from '@/components/poster/headline-suggestions';
import {
  applyServerFieldError,
  PosterTextFields,
  type PosterTextForm,
} from '@/components/poster/poster-text-fields';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/messages';
import { downloadPoster, usePoster, useRegeneratePoster, useTemplate } from '@/lib/posters';
import { useQuota } from '@/lib/quota';

export function PosterResult() {
  const { id } = useParams<{ id: string }>();
  const justCreated = useSearchParams().get('new') === '1';
  const poster = usePoster(id);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <AppHeader title="আপনার পোস্টার" backHref="/" />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        {poster.isPending && (
          <Loader2 className="mx-auto size-6 animate-spin text-slate-400" aria-label="লোড হচ্ছে" />
        )}
        {poster.isError && (
          <>
            <FormAlert>{errorMessage(poster.error)}</FormAlert>
            <Link href="/" className="font-medium text-emerald-700 underline">
              ড্যাশবোর্ডে ফিরে যান
            </Link>
          </>
        )}
        {poster.data && <PosterView poster={poster.data} justCreated={justCreated} />}
      </main>
    </div>
  );
}

function PosterView({ poster, justCreated }: { poster: PosterDto; justCreated: boolean }) {
  const [editing, setEditing] = useState(false);
  const quota = useQuota();
  const regenerationsLeft = quota.data?.regenerations.remaining;
  const [downloading, setDownloading] = useState<OutputSize | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function download(size: OutputSize) {
    setDownloading(size);
    setDownloadError(null);
    try {
      await downloadPoster(poster.downloads[size]);
    } catch (err) {
      setDownloadError(errorMessage(err));
    } finally {
      setDownloading(null);
    }
  }

  return (
    <>
      {justCreated && poster.editCount === 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <CheckCircle2 className="size-6 shrink-0 text-emerald-600" aria-hidden />
          <div>
            <p className="font-bold text-emerald-800">পোস্টার তৈরি সফল হয়েছে!</p>
            <p className="text-sm text-emerald-700">
              নিচের বোতাম থেকে প্রিন্ট বা সোশ্যাল মিডিয়ার জন্য ডাউনলোড করুন।
            </p>
          </div>
        </div>
      )}

      <figure className="mx-auto w-full max-w-sm space-y-2">
        <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-xl">
          {poster.previewUrl && (
            <img
              src={poster.previewUrl}
              alt={`${poster.template.title} পোস্টার`}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        {poster.watermarked && (
          <figcaption className="text-center text-xs text-slate-500">
            ফ্রি সংস্করণে কোণায় একটি ছোট ওয়াটারমার্ক থাকে।
          </figcaption>
        )}
      </figure>

      <section className="space-y-3" aria-label="ডাউনলোড">
        <Button
          onClick={() => void download('a3')}
          disabled={downloading !== null}
          className="h-auto w-full rounded-xl bg-emerald-600 py-4 text-base font-bold text-white hover:bg-emerald-700"
        >
          {downloading === 'a3' ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Printer aria-hidden />
          )}
          {downloading === 'a3' ? 'প্রিন্ট ফাইল প্রস্তুত হচ্ছে…' : 'A3 প্রিন্ট ডাউনলোড (৩০০ DPI)'}
        </Button>
        <Button
          variant="outline"
          onClick={() => void download('social45')}
          disabled={downloading !== null}
          className="h-auto w-full rounded-xl py-3.5 text-base font-semibold"
        >
          {downloading === 'social45' ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Smartphone aria-hidden />
          )}
          সোশ্যাল মিডিয়া (৪:৫) ডাউনলোড
        </Button>
        {downloadError && <FormAlert>{downloadError}</FormAlert>}
      </section>

      {editing ? (
        <EditPanel poster={poster} onDone={() => setEditing(false)} />
      ) : (
        <Button
          variant="ghost"
          onClick={() => setEditing(true)}
          disabled={regenerationsLeft === 0}
          className="h-auto w-full py-3 text-slate-700"
        >
          <Pencil aria-hidden />
          {regenerationsLeft === 0
            ? 'আজ আর আবার তৈরি করা যাবে না'
            : `লেখা পরিবর্তন করে আবার তৈরি করুন${
                regenerationsLeft === undefined
                  ? ''
                  : ` (আর ${toBanglaDigits(regenerationsLeft)} বার)`
              }`}
        </Button>
      )}

      <Link
        href="/"
        className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-700 underline"
      >
        <Download className="size-4" aria-hidden />
        ড্যাশবোর্ডে ফিরে যান
      </Link>
    </>
  );
}

function EditPanel({ poster, onDone }: { poster: PosterDto; onDone: () => void }) {
  const template = useTemplate(poster.template.id);
  const regenerate = useRegeneratePoster(poster.id);
  const form = useForm<PosterTextForm, unknown, PosterText>({
    resolver: zodResolver(posterTextSchema),
    defaultValues: poster.text as PosterTextForm,
    mode: 'onTouched',
  });
  // useWatch (not form.watch) so the React Compiler can still optimize this component.
  const headline = useWatch({ control: form.control, name: 'headline' });

  if (!template.data) {
    return (
      <Loader2 className="mx-auto size-6 animate-spin text-slate-400" aria-label="লোড হচ্ছে" />
    );
  }

  const onSubmit = form.handleSubmit((text) =>
    regenerate.mutate(
      { text },
      { onSuccess: onDone, onError: (err) => applyServerFieldError(err, form.setError) },
    ),
  );

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 className="font-bold text-slate-900">লেখা পরিবর্তন করুন</h2>
      <PosterTextFields
        fields={template.data.requirements.textFields}
        defaults={template.data.defaults}
        register={form.register}
        watch={form.watch}
        errors={form.formState.errors}
        afterHeadline={
          <HeadlineSuggestions
            templateId={poster.template.id}
            getContext={() => {
              const v = form.getValues();
              return {
                name: v.name,
                designation: v.designation,
                organization: v.organization,
                location: v.location,
                leader1Name: v.leader1Name,
              };
            }}
            onPick={(headline) =>
              form.setValue('headline', headline, { shouldValidate: true, shouldDirty: true })
            }
            current={headline}
          />
        }
      />
      {regenerate.isError && <FormAlert>{errorMessage(regenerate.error)}</FormAlert>}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          disabled={regenerate.isPending}
          className="h-auto flex-1 py-3"
        >
          বাতিল
        </Button>
        <Button
          type="submit"
          disabled={regenerate.isPending}
          className="h-auto flex-1 bg-slate-900 py-3 font-bold text-white hover:bg-slate-800"
        >
          {regenerate.isPending && <Loader2 className="animate-spin" aria-hidden />}
          আবার তৈরি করুন
        </Button>
      </div>
    </form>
  );
}

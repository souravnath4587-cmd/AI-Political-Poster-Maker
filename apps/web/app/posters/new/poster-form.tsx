'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  PHOTO_FIELD_KIND,
  posterTextSchema,
  type PhotoField,
  type PosterText,
  type UploadDto,
} from '@app/shared';
import { AppHeader } from '@/components/app-header';
import { QuotaCard } from '@/components/quota-card';
import { FormAlert } from '@/components/auth/form-alert';
import { HeadlineSuggestions } from '@/components/poster/headline-suggestions';
import { PhotoSlot } from '@/components/poster/photo-slot';
import {
  applyServerFieldError,
  PosterTextFields,
  type PosterTextForm,
} from '@/components/poster/poster-text-fields';
import { Button } from '@/components/ui/button';
import { PHOTO_FIELD_LABELS } from '@/lib/labels';
import { errorMessage } from '@/lib/messages';
import { useCreatePoster, useTemplate } from '@/lib/posters';
import { useQuota } from '@/lib/quota';

const PEOPLE: PhotoField[] = ['leader1Photo', 'leader2Photo', 'requesterPhoto'];

export function PosterForm() {
  const router = useRouter();
  const templateId = useSearchParams().get('template');
  const template = useTemplate(templateId);
  const createPoster = useCreatePoster();
  const quota = useQuota();
  const outOfPosters = quota.data?.posters.remaining === 0;

  const [photos, setPhotos] = useState<Partial<Record<PhotoField, UploadDto | null>>>({});
  const [photoErrors, setPhotoErrors] = useState<Partial<Record<PhotoField, string>>>({});
  const [uploadingCount, setUploadingCount] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<PosterTextForm, unknown, PosterText>({
    resolver: zodResolver(posterTextSchema),
    mode: 'onTouched',
  });
  // useWatch (not form.watch) so the React Compiler can still optimize this component.
  const headline = useWatch({ control: form.control, name: 'headline' });

  if (!templateId || template.isError) {
    return (
      <Shell>
        <FormAlert>টেমপ্লেটটি পাওয়া যায়নি।</FormAlert>
        <Link href="/" className="font-medium text-emerald-700 underline">
          টেমপ্লেট তালিকায় ফিরে যান
        </Link>
      </Shell>
    );
  }
  if (!template.data) {
    return (
      <Shell>
        <Loader2 className="mx-auto size-6 animate-spin text-slate-400" aria-label="লোড হচ্ছে" />
      </Shell>
    );
  }

  const { requirements, defaults } = template.data;
  const photoSlots = requirements.photos;
  const hasSymbol = photoSlots.some((p) => p.field === 'partySymbol');
  const showsOrganization = requirements.textFields.includes('organization');

  const setPhoto = (field: PhotoField, upload: UploadDto | null) => {
    setPhotos((p) => ({ ...p, [field]: upload }));
    setPhotoErrors((e) => ({ ...e, [field]: undefined }));
  };
  const trackUploading = (uploading: boolean) => setUploadingCount((n) => n + (uploading ? 1 : -1));

  const slot = (field: PhotoField) => {
    const spec = photoSlots.find((p) => p.field === field);
    if (!spec) return null;
    return (
      <PhotoSlot
        key={field}
        label={PHOTO_FIELD_LABELS[field]}
        kind={PHOTO_FIELD_KIND[field]}
        optional={spec.optional}
        shape={field === 'partySymbol' ? 'square' : 'circle'}
        value={photos[field] ?? null}
        onChange={(upload) => setPhoto(field, upload)}
        onUploadingChange={trackUploading}
        error={photoErrors[field]}
      />
    );
  };

  /** Marks missing required photos; returns false if any are missing. */
  const checkPhotos = () => {
    const missing = photoSlots.filter((p) => !p.optional && !photos[p.field]);
    setPhotoErrors(Object.fromEntries(missing.map((p) => [p.field, 'এই ছবিটি দিন।'])));
    return missing.length === 0;
  };

  const onSubmit = form.handleSubmit(
    (text) => {
      setFormError(null);
      if (!checkPhotos()) {
        setFormError('প্রয়োজনীয় সব ছবি দিন।');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (uploadingCount > 0) {
        setFormError('ছবি আপলোড শেষ হওয়া পর্যন্ত অপেক্ষা করুন।');
        return;
      }
      createPoster.mutate(
        {
          templateId,
          text,
          photos: Object.fromEntries(
            photoSlots.filter((p) => photos[p.field]).map((p) => [p.field, photos[p.field]!.id]),
          ),
        },
        {
          onSuccess: (poster) => router.push(`/posters/${poster.id}?new=1`),
          onError: (err) => {
            applyServerFieldError(err, form.setError);
            setFormError(errorMessage(err));
          },
        },
      );
    },
    () => {
      // Show missing photos together with the text errors, not in a second round.
      checkPhotos();
      setFormError('লাল চিহ্নিত ঘরগুলো ঠিক করুন।');
    },
  );

  return (
    <Shell>
      {quota.data && <QuotaCard quota={quota.data} compact />}

      {/* Chosen template */}
      <section className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <img
          src={template.data.thumbnailUrl}
          alt=""
          className="h-20 w-16 shrink-0 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">টেমপ্লেট</p>
          <p className="line-clamp-2 leading-snug font-bold text-slate-900">
            {template.data.title}
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex min-h-10 items-center -my-2.5 py-2.5 shrink-0 px-1 text-sm font-medium text-emerald-700 underline"
        >
          পরিবর্তন করুন
        </Link>
      </section>

      <form onSubmit={onSubmit} noValidate className="space-y-8">
        {/* Photos */}
        <section className="space-y-4" aria-labelledby="photos-title">
          <h2
            id="photos-title"
            className="flex items-center gap-2 text-sm font-bold text-slate-900"
          >
            <Camera className="size-4 text-emerald-600" aria-hidden />
            ছবি আপলোড করুন
          </h2>
          <div className="flex flex-wrap justify-around gap-4">{PEOPLE.map(slot)}</div>
          <p className="text-xs text-slate-500">
            পরিষ্কার, সামনে থেকে তোলা ছবি দিন। মুখ খুঁজে পেলে ছবিটি নিজে থেকেই ফ্রেমের মাঝে বসানো
            হবে।
          </p>
        </section>

        {/* Text */}
        <section className="space-y-4" aria-labelledby="text-title">
          <h2 id="text-title" className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <FileText className="size-4 text-emerald-600" aria-hidden />
            তথ্য প্রদান করুন
          </h2>
          <PosterTextFields
            fields={requirements.textFields}
            defaults={defaults}
            register={form.register}
            watch={form.watch}
            errors={form.formState.errors}
            afterHeadline={
              <HeadlineSuggestions
                templateId={templateId}
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
            afterOrganization={
              hasSymbol ? <div className="pt-2">{slot('partySymbol')}</div> : undefined
            }
          />
          {hasSymbol && !showsOrganization && slot('partySymbol')}
        </section>

        {formError && <FormAlert>{formError}</FormAlert>}

        <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <Button
            type="submit"
            disabled={createPoster.isPending || uploadingCount > 0 || outOfPosters}
            className="h-auto w-full rounded-xl bg-emerald-600 py-4 text-base font-bold text-white shadow-lg shadow-emerald-900/10 hover:bg-emerald-700"
          >
            {outOfPosters
              ? 'আজকের পোস্টার বানানো শেষ'
              : uploadingCount > 0
                ? 'ছবি আপলোড হচ্ছে…'
                : 'পোস্টার তৈরি করুন'}
          </Button>
        </div>
      </form>

      {createPoster.isPending && (
        <div
          role="status"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-slate-900/70 text-white backdrop-blur-sm"
        >
          <Loader2 className="size-10 animate-spin" aria-hidden />
          <p className="text-lg font-semibold">পোস্টার তৈরি হচ্ছে…</p>
          <p className="text-sm text-slate-300">কয়েক সেকেন্ড সময় লাগতে পারে</p>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 pt-6 sm:px-6">
        <h1 className="text-xl font-bold text-slate-900">নতুন পোস্টার</h1>
        {children}
      </main>
    </div>
  );
}

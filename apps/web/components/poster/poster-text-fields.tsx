'use client';

import type { FieldErrors, UseFormRegister, UseFormSetError, UseFormWatch } from 'react-hook-form';
import { TEXT_FIELDS, TEXT_LIMITS, toBanglaDigits, type TextField } from '@app/shared';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { TEXT_FIELD_LABELS, TEXT_FIELD_PLACEHOLDERS } from '@/lib/labels';
import { cn } from '@/lib/utils';

/** Form values: every field may be empty or missing (the schema decides what is required). */
export type PosterTextForm = Partial<Record<TextField, string>>;

const REQUIRED = new Set<TextField>(['name', 'designation']);
const MULTILINE = new Set<TextField>(['headline', 'message']);
const LEADER_FIELDS: TextField[] = ['leader1Name', 'leader1Title', 'leader2Name', 'leader2Title'];
const MAIN_ORDER: TextField[] = [
  'name',
  'designation',
  'organization',
  'location',
  'headline',
  'message',
];

interface PosterTextFieldsProps {
  /** Fields the template shows; others are not rendered. */
  fields: TextField[];
  /** Template defaults (shown as hints for fields that may be left empty). */
  defaults: Partial<Record<TextField, string>>;
  register: UseFormRegister<PosterTextForm>;
  watch: UseFormWatch<PosterTextForm>;
  errors: FieldErrors<PosterTextForm>;
  /** Rendered right after the organization field (the party symbol upload in the form). */
  afterOrganization?: React.ReactNode;
  /** Rendered right after the headline field (AI suggestions). */
  afterHeadline?: React.ReactNode;
}

function fieldError(code: string | undefined, field: TextField): string | null {
  if (!code) return null;
  if (code === 'FIELD_REQUIRED') return 'এই ঘরটি পূরণ করুন।';
  if (code === 'BLOCKED_CONTENT') return 'এই লেখায় এমন শব্দ আছে যা ব্যবহার করা যাবে না।';
  if (code === 'TEXT_TOO_LONG')
    return `সর্বোচ্চ ${toBanglaDigits(TEXT_LIMITS[field])} অক্ষর লেখা যাবে।`;
  return 'লেখাটি ঠিক করুন।';
}

export function PosterTextFields({
  fields,
  defaults,
  register,
  watch,
  errors,
  afterOrganization,
  afterHeadline,
}: PosterTextFieldsProps) {
  const shown = new Set(fields);
  const main = MAIN_ORDER.filter((f) => shown.has(f));
  const leaders = LEADER_FIELDS.filter((f) => shown.has(f));

  const renderField = (field: TextField) => {
    const id = `field-${field}`;
    const value = watch(field) ?? '';
    const limit = TEXT_LIMITS[field];
    const nearLimit = value.length > limit * 0.8;
    const error = fieldError(errors[field]?.message, field);
    const hint = defaults[field]
      ? `খালি রাখলে: ${defaults[field]}`
      : TEXT_FIELD_PLACEHOLDERS[field];
    const inputClass = cn(
      'h-auto rounded-xl border-slate-200 bg-white px-4 py-3 text-base shadow-sm placeholder:text-slate-300 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20',
      // Red wins over the green focus ring while the field has an error.
      error && 'border-red-400 focus-visible:border-red-500 focus-visible:ring-red-500/20',
    );

    return (
      <div key={field} className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-semibold text-slate-700">
          {TEXT_FIELD_LABELS[field]}
          {REQUIRED.has(field) && <span className="text-red-500"> *</span>}
        </label>
        {MULTILINE.has(field) ? (
          <textarea
            id={id}
            rows={field === 'message' ? 4 : 2}
            placeholder={hint}
            aria-invalid={Boolean(error) || undefined}
            className={cn(
              inputClass,
              'w-full resize-none border outline-none focus-visible:ring-3',
            )}
            {...register(field)}
          />
        ) : (
          <Input
            id={id}
            placeholder={hint}
            aria-invalid={Boolean(error) || undefined}
            className={inputClass}
            {...register(field)}
          />
        )}
        <div className="flex justify-between gap-2 text-xs">
          <span className="text-red-600">{error}</span>
          {nearLimit && (
            <span className={value.length > limit ? 'text-red-600' : 'text-slate-400'}>
              {toBanglaDigits(value.length)}/{toBanglaDigits(limit)}
            </span>
          )}
        </div>
        {field === 'organization' && afterOrganization}
        {field === 'headline' && afterHeadline}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {main.map(renderField)}
      {leaders.length > 0 && (
        <details className="group rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            নেতাদের নাম ও পদবি <span className="font-normal text-slate-400">(ঐচ্ছিক)</span>
          </summary>
          <div className="mt-4 space-y-4">{leaders.map(renderField)}</div>
        </details>
      )}
    </div>
  );
}

/**
 * Puts a server-side field error (blocked content) on the field it names, so the red mark
 * appears where the problem is. Returns true if it did.
 */
export function applyServerFieldError(
  error: unknown,
  setError: UseFormSetError<PosterTextForm>,
): boolean {
  if (!(error instanceof ApiError) || error.code !== 'BLOCKED_CONTENT') return false;
  const field = error.details.field;
  if (typeof field !== 'string' || !(TEXT_FIELDS as readonly string[]).includes(field))
    return false;
  setError(
    field as TextField,
    { type: 'server', message: 'BLOCKED_CONTENT' },
    { shouldFocus: true },
  );
  return true;
}

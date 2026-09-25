'use client';

import { AlertTriangle, ImagePlus, ScanFace, UserPlus } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import {
  toBanglaDigits,
  UPLOAD_ACCEPTED_TYPES,
  type UploadDto,
  type UploadKind,
} from '@app/shared';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/messages';
import { uploadPhoto } from '@/lib/posters';

interface PhotoSlotProps {
  label: string;
  kind: UploadKind;
  optional?: boolean;
  value: UploadDto | null;
  onChange: (upload: UploadDto | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
  /** Error from the form (e.g. a required photo is missing). */
  error?: string | null;
  /** Rounded square for logos, circle for people. */
  shape?: 'circle' | 'square';
}

/** Tap to choose a photo; shows upload progress, then the photo with face/quality notes. */
export function PhotoSlot({
  label,
  kind,
  optional,
  value,
  onChange,
  onUploadingChange,
  error,
  shape = 'circle',
}: PhotoSlotProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setProgress(0);
    onUploadingChange?.(true);
    try {
      onChange(await uploadPhoto(file, kind, setProgress));
    } catch (err) {
      setUploadError(errorMessage(err));
    } finally {
      setProgress(null);
      onUploadingChange?.(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const uploading = progress !== null;
  const message = uploadError ?? error;
  const round = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';

  return (
    <div className="flex w-24 flex-col items-center gap-2 text-center">
      <label
        htmlFor={inputId}
        className={cn(
          'relative flex size-24 cursor-pointer items-center justify-center overflow-hidden border-2 transition-colors',
          round,
          value
            ? 'border-emerald-500 bg-white'
            : message
              ? 'border-dashed border-red-400 bg-red-50 text-red-400'
              : 'border-dashed border-slate-300 bg-white text-slate-400 hover:border-emerald-400 hover:text-emerald-500',
        )}
      >
        {value && (
          <img
            src={value.url}
            alt=""
            className={cn(
              'h-full w-full',
              kind === 'symbol' ? 'object-contain p-2' : 'object-cover',
            )}
            style={
              kind === 'symbol'
                ? undefined
                : { objectPosition: `${value.focus.x}% ${value.focus.y}%` }
            }
          />
        )}
        {!value &&
          !uploading &&
          (kind === 'symbol' ? (
            <ImagePlus className="size-7" aria-hidden />
          ) : (
            <UserPlus className="size-7" aria-hidden />
          ))}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/85 text-sm font-semibold text-emerald-700">
            {toBanglaDigits(Math.round((progress ?? 0) * 100))}%
          </span>
        )}
        {value?.faceDetected && !uploading && (
          <span
            className="absolute right-1 bottom-1 rounded-full bg-emerald-600 p-1 text-white shadow"
            title="মুখ শনাক্ত হয়েছে"
          >
            <ScanFace className="size-3.5" aria-hidden />
          </span>
        )}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={UPLOAD_ACCEPTED_TYPES.join(',')}
        className="sr-only"
        disabled={uploading}
        onChange={(e) => void handleFile(e.target.files?.[0])}
        aria-label={label}
      />
      <span className={cn('text-xs font-semibold', value ? 'text-emerald-700' : 'text-slate-600')}>
        {label}
        {optional && <span className="block font-normal text-slate-400">(ঐচ্ছিক)</span>}
      </span>
      {value && !uploading && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-[11px] text-slate-400 underline underline-offset-2 hover:text-red-600"
        >
          সরিয়ে দিন
        </button>
      )}
      {value?.lowResolution && (
        <span className="flex items-start gap-1 text-left text-[11px] leading-tight text-amber-700">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
          ছবির মান কম, প্রিন্টে ঝাপসা হতে পারে
        </span>
      )}
      {message && <span className="text-[11px] leading-tight text-red-600">{message}</span>}
    </div>
  );
}

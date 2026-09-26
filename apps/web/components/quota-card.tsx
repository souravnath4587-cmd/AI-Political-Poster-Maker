'use client';

import { CalendarCheck, CalendarX } from 'lucide-react';
import { toBanglaDigits, type QuotaDto } from '@app/shared';
import { cn } from '@/lib/utils';

const bn = toBanglaDigits;

/** "আজ আর Nটি পোস্টার বানাতে পারবেন" with regenerations left and the reset time. */
export function QuotaCard({ quota, compact = false }: { quota: QuotaDto; compact?: boolean }) {
  const { posters, regenerations } = quota;
  const done = posters.remaining === 0;
  const Icon = done ? CalendarX : CalendarCheck;

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-2xl border bg-white shadow-sm',
        compact ? 'p-3' : 'p-4',
        done ? 'border-amber-200' : 'border-slate-200',
      )}
      role="status"
    >
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full',
          done ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-600',
        )}
      >
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">
          {posters.remaining === null
            ? 'আনলিমিটেড পোস্টার বানাতে পারবেন'
            : done
              ? `আজকের ${bn(posters.limit ?? 0)}টি পোস্টার বানানো শেষ`
              : `আজ আর ${bn(posters.remaining)}টি পোস্টার বানাতে পারবেন`}
        </p>
        <p className="text-xs text-slate-500">
          {regenerations.remaining === null
            ? 'আবার তৈরি: আনলিমিটেড · প্রিমিয়াম প্ল্যান'
            : `আবার তৈরি: আর ${bn(regenerations.remaining)} বার · রাত ১২টায় আবার পূর্ণ হবে`}
        </p>
      </div>
      {!compact && (
        <span
          className={cn(
            'shrink-0 rounded-xl border px-3 py-1.5 text-center leading-none',
            done ? 'border-amber-200 bg-amber-50' : 'border-emerald-100 bg-emerald-50',
          )}
        >
          <span
            className={cn('block text-lg font-bold', done ? 'text-amber-700' : 'text-emerald-700')}
          >
            {posters.remaining === null
              ? '∞'
              : `${bn(posters.remaining)}/${bn(posters.limit ?? 0)}`}
          </span>
          <span className="text-[10px] text-slate-500">
            {posters.remaining === null ? 'সীমা নেই' : 'বাকি'}
          </span>
        </span>
      )}
    </div>
  );
}

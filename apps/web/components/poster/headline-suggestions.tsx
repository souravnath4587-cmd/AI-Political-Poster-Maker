'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import {
  toBanglaDigits,
  type HeadlineSuggestInput,
  type HeadlineSuggestResponse,
} from '@app/shared';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/messages';
import { QUOTA_QUERY_KEY } from '@/lib/quota';
import { cn } from '@/lib/utils';

interface HeadlineSuggestionsProps {
  templateId: string;
  /** What the user has typed so far (read when the button is pressed). */
  getContext: () => HeadlineSuggestInput['context'];
  onPick: (headline: string) => void;
  current?: string;
}

/** "এআই পরামর্শ": 3–5 Bangla headlines as chips; tapping one fills the headline field. */
export function HeadlineSuggestions({
  templateId,
  getContext,
  onPick,
  current,
}: HeadlineSuggestionsProps) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<HeadlineSuggestResponse | null>(null);

  const suggest = useMutation({
    mutationFn: () =>
      api<HeadlineSuggestResponse>('/headlines/suggest', {
        method: 'POST',
        body: { templateId, context: getContext() },
      }),
    onSuccess: setResult,
    onSettled: () => void queryClient.invalidateQueries({ queryKey: QUOTA_QUERY_KEY }),
  });

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => suggest.mutate()}
        disabled={suggest.isPending}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60"
      >
        {suggest.isPending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="size-3.5" aria-hidden />
        )}
        {suggest.isPending ? 'পরামর্শ তৈরি হচ্ছে…' : result ? 'আরও পরামর্শ' : 'এআই পরামর্শ'}
      </button>

      {result && result.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2" role="list" aria-label="শিরোনামের পরামর্শ">
          {result.suggestions.map((headline) => (
            <button
              key={headline}
              type="button"
              role="listitem"
              onClick={() => onPick(headline)}
              className={cn(
                'min-h-10 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                current === headline
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-400',
              )}
            >
              {headline}
            </button>
          ))}
        </div>
      )}
      {result && (
        <p className="text-[11px] text-slate-400">
          পছন্দের পরামর্শে চাপ দিন, তারপর চাইলে বদলে নিন
          {result.remaining !== null &&
            ` · আজ আর ${toBanglaDigits(result.remaining)} বার পরামর্শ নেওয়া যাবে`}
        </p>
      )}
      {suggest.isError && <p className="text-xs text-red-600">{errorMessage(suggest.error)}</p>}
    </div>
  );
}

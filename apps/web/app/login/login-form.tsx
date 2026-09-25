'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  formatBdPhoneLocal,
  normalizeBdPhone,
  OTP_LENGTH,
  toAsciiDigits,
  toBanglaDigits,
  type AuthOptionsResponse,
  type MeResponse,
  type OtpRequestResponse,
} from '@app/shared';
import { AuthHeader } from '@/components/auth/auth-header';
import { FormAlert } from '@/components/auth/form-alert';
import { OtpInput } from '@/components/auth/otp-input';
import { PhoneInput } from '@/components/auth/phone-input';
import { ResendTimer } from '@/components/auth/resend-timer';
import { ReviewerAccessCard } from '@/components/auth/reviewer-access-card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { api, ApiError } from '@/lib/api';
import { ME_QUERY_KEY, useMe } from '@/lib/auth';
import { errorMessage } from '@/lib/messages';

type Step = 'phone' | 'code';

/** Only same-site paths, so ?next= can't send users to another website. */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export function LoginForm() {
  const router = useRouter();
  const nextPath = safeNext(useSearchParams().get('next'));
  const queryClient = useQueryClient();
  const me = useMe();

  const [step, setStep] = useState<Step>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState<string | null>(null); // E.164, once a code was requested
  const [isNewUser, setIsNewUser] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [code, setCode] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [devCode, setDevCode] = useState<string>();
  const [showDevCode, setShowDevCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const options = useQuery({
    queryKey: ['auth-options'],
    queryFn: () => api<AuthOptionsResponse>('/auth/options'),
    staleTime: Infinity,
  });

  // Already logged in (e.g. opened /login from a bookmark): go straight on.
  useEffect(() => {
    if (me.data) router.replace(nextPath);
  }, [me.data, nextPath, router]);

  const requestCode = useMutation({
    mutationFn: (e164: string) =>
      api<OtpRequestResponse>('/auth/otp/request', { method: 'POST', body: { phone: e164 } }),
    onSuccess: (data, e164) => {
      setPhone(e164);
      setIsNewUser(data.isNewUser);
      setDevCode(data.devCode);
      setResendAt(Date.now() + data.resendAfterSec * 1000);
      setCode('');
      setError(null);
      setNotice(null);
      setStep('code');
    },
    onError: (err, e164) => {
      // A code was sent moments ago and is still valid: continue to the code step with it.
      if (err instanceof ApiError && err.code === 'RATE_LIMITED' && step === 'phone') {
        const retryAfterSec = Number(err.details.retryAfterSec) || 0;
        setPhone(e164);
        setIsNewUser(Boolean(err.details.isNewUser));
        setResendAt(Date.now() + retryAfterSec * 1000);
        setCode('');
        setError(null);
        setNotice('কিছুক্ষণ আগে পাঠানো কোডটি এখনও ব্যবহার করা যাবে।');
        setStep('code');
        return;
      }
      setError(errorMessage(err));
    },
  });

  const verify = useMutation({
    mutationFn: (value: string) =>
      api<MeResponse>('/auth/otp/verify', {
        method: 'POST',
        body: { phone, code: toAsciiDigits(value), ...(isNewUser ? { acceptTerms } : {}) },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(ME_QUERY_KEY, data.user);
      router.replace(nextPath);
    },
    onError: (err) => {
      setError(errorMessage(err));
      if (err instanceof ApiError && err.code !== 'TERMS_REQUIRED') setCode('');
    },
  });

  const busy = requestCode.isPending || verify.isPending;
  const codeDead =
    verify.error instanceof ApiError &&
    ['TOO_MANY_ATTEMPTS', 'CODE_EXPIRED'].includes(verify.error.code);

  function submitPhone(event: React.FormEvent) {
    event.preventDefault();
    const e164 = normalizeBdPhone(phoneInput);
    if (!e164) {
      setError(errorMessage(new ApiError(400, 'INVALID_PHONE', '')));
      return;
    }
    setError(null);
    requestCode.mutate(e164);
  }

  function submitCode(value = code) {
    if (value.length !== OTP_LENGTH || busy) return;
    if (isNewUser && !acceptTerms) {
      setError(errorMessage(new ApiError(400, 'TERMS_REQUIRED', '')));
      return;
    }
    setError(null);
    verify.mutate(value);
  }

  function fillPhone(localPhone: string) {
    setPhoneInput(localPhone);
    setStep('phone');
    setError(null);
    setNotice(null);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <AuthHeader />

      <main className="flex-1 px-6 py-8">
        {step === 'phone' ? (
          <form
            key="phone"
            onSubmit={submitPhone}
            className="animate-in space-y-4 duration-300 fade-in-0 slide-in-from-bottom-2"
            noValidate
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="phone" className="text-sm font-semibold text-slate-700">
                আপনার ফোন নম্বর
              </label>
              <PhoneInput
                id="phone"
                value={phoneInput}
                onChange={setPhoneInput}
                invalid={Boolean(error)}
                disabled={busy}
                autoFocus
              />
              <p className="text-xs text-slate-500">
                এসএমএস এর মাধ্যমে একটি যাচাইকরণ কোড পাঠানো হবে।
              </p>
            </div>

            {error && <FormAlert>{error}</FormAlert>}

            <Button
              type="submit"
              disabled={busy}
              className="h-auto w-full rounded-xl bg-emerald-600 py-4 text-base font-bold text-white shadow-lg shadow-emerald-900/10 hover:bg-emerald-700"
            >
              {requestCode.isPending && <Loader2 className="animate-spin" aria-hidden />}
              কোড পাঠান
            </Button>
          </form>
        ) : (
          <form
            key="code"
            onSubmit={(e) => {
              e.preventDefault();
              submitCode();
            }}
            className="animate-in space-y-5 duration-300 fade-in-0 slide-in-from-bottom-2"
          >
            <div className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800 tabular-nums">
                {phone && toBanglaDigits(formatBdPhoneLocal(phone))}
              </span>{' '}
              নম্বরে কোড পাঠানো হয়েছে।{' '}
              <button
                type="button"
                onClick={() => fillPhone(phoneInput)}
                className="font-medium text-emerald-700 underline underline-offset-4"
              >
                নম্বর পরিবর্তন করুন
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="otp" className="text-sm font-semibold text-slate-700">
                যাচাইকরণ কোড
              </label>
              <OtpInput
                id="otp"
                value={code}
                onChange={(value) => {
                  setCode(value);
                  if (error && !codeDead) setError(null);
                }}
                onComplete={(value) => submitCode(value)}
                invalid={Boolean(error) && !codeDead}
                disabled={verify.isPending || codeDead}
              />
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="size-4" aria-hidden />
                  কোডটি পাঠানো হয়েছে
                </p>
                <ResendTimer
                  availableAt={resendAt}
                  disabled={busy}
                  onResend={() => phone && requestCode.mutate(phone)}
                />
              </div>
            </div>

            {isNewUser && (
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                <Checkbox
                  checked={acceptTerms}
                  onCheckedChange={(checked) => {
                    setAcceptTerms(checked === true);
                    if (checked) setError(null);
                  }}
                  className="mt-0.5 data-checked:border-emerald-600 data-checked:bg-emerald-600"
                />
                <span>
                  আমি{' '}
                  <Link
                    href="/terms"
                    target="_blank"
                    className="font-medium text-emerald-700 underline"
                  >
                    ব্যবহারের শর্তাবলী
                  </Link>{' '}
                  মেনে নিচ্ছি এবং নিশ্চিত করছি যে পোস্টারে ব্যবহৃত ছবি ও তথ্য ব্যবহারের অনুমতি আমার
                  আছে।
                </span>
              </label>
            )}

            {notice && !error && <FormAlert tone="info">{notice}</FormAlert>}
            {error && <FormAlert>{error}</FormAlert>}

            <Button
              type="submit"
              disabled={busy || code.length !== OTP_LENGTH || codeDead}
              className="h-auto w-full rounded-xl bg-slate-900 py-4 text-base font-bold text-white hover:bg-slate-800"
            >
              {verify.isPending && <Loader2 className="animate-spin" aria-hidden />}
              লগইন করুন
            </Button>
          </form>
        )}
      </main>

      {options.data && (
        <ReviewerAccessCard
          options={options.data}
          onUsePhone={fillPhone}
          showDevCode={showDevCode}
          onShowDevCodeChange={setShowDevCode}
          devCode={devCode}
        />
      )}
    </div>
  );
}

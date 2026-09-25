'use client';

import { OTP_LENGTH } from '@app/shared';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

interface OtpInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
}

/** Six code boxes. Supports paste, SMS autofill (one-time-code) and Bangla digits. */
export function OtpInput({ id, value, onChange, onComplete, invalid, disabled }: OtpInputProps) {
  return (
    <InputOTP
      id={id}
      maxLength={OTP_LENGTH}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      pattern="^[0-9০-৯]*$"
      inputMode="numeric"
      autoComplete="one-time-code"
      disabled={disabled}
      aria-invalid={invalid || undefined}
      containerClassName="w-full"
    >
      <InputOTPGroup className="w-full justify-between gap-2">
        {Array.from({ length: OTP_LENGTH }, (_, i) => (
          <InputOTPSlot
            key={i}
            index={i}
            aria-invalid={invalid || undefined}
            className="h-14 max-w-14 min-w-0 flex-1 rounded-xl border bg-white text-xl font-bold text-slate-900 shadow-sm first:rounded-xl last:rounded-xl data-[active=true]:border-emerald-500 data-[active=true]:ring-emerald-500/20"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

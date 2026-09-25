'use client';

import { Input } from '@/components/ui/input';

interface PhoneInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

/** Local mobile number with a fixed +880 prefix. Accepts Bangla or English digits. */
export function PhoneInput({ id, value, onChange, invalid, disabled, autoFocus }: PhoneInputProps) {
  return (
    <div className="relative flex items-center">
      <span
        className="pointer-events-none absolute left-4 text-sm font-medium text-slate-400"
        aria-hidden
      >
        +৮৮০
      </span>
      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="১XXXXXXXXX"
        maxLength={16}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9০-৯+\s-]/g, ''))}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        autoFocus={autoFocus}
        className="h-auto rounded-xl border-slate-200 bg-white py-3.5 pr-4 pl-16 text-base text-slate-900 shadow-sm placeholder:text-slate-300 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
      />
    </div>
  );
}

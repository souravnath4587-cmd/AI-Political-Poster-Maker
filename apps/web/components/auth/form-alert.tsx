import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const STYLES = {
  error: {
    box: 'border-red-100 bg-red-50 text-red-600',
    icon: AlertCircle,
    iconClass: 'text-red-500',
  },
  info: { box: 'border-sky-100 bg-sky-50 text-sky-700', icon: Info, iconClass: 'text-sky-500' },
  success: {
    box: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    icon: CheckCircle2,
    iconClass: 'text-emerald-500',
  },
} as const;

export function FormAlert({
  tone = 'error',
  children,
}: {
  tone?: keyof typeof STYLES;
  children: React.ReactNode;
}) {
  const style = STYLES[tone];
  const Icon = style.icon;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-lg border p-3 text-sm font-medium', style.box)}
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', style.iconClass)} aria-hidden />
      <span>{children}</span>
    </div>
  );
}

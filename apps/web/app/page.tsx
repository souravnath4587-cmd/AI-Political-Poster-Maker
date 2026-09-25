'use client';

import { Loader2, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { formatBdPhoneLocal, toBanglaDigits } from '@app/shared';
import { Button } from '@/components/ui/button';
import { useLogout, useMe } from '@/lib/auth';

export default function Home() {
  const router = useRouter();
  const me = useMe();
  const logout = useLogout();

  // The cookie existed (proxy.ts let us in) but the session is gone or expired.
  useEffect(() => {
    if (me.data === null) router.replace('/login');
  }, [me.data, router]);

  if (!me.data) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-slate-400" aria-label="লোড হচ্ছে" />
      </main>
    );
  }

  const user = me.data;
  const premium = user.plan === 'premium';

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="flex items-center justify-between gap-3 bg-slate-900 px-6 py-4 text-white">
        <span className="text-lg font-bold">পোস্টার মেকার</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => logout.mutate(false)}
          disabled={logout.isPending}
          className="text-slate-200 hover:bg-slate-800 hover:text-white"
        >
          <LogOut aria-hidden />
          লগআউট
        </Button>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-6 py-8">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">স্বাগতম!</h1>
          <p className="mt-1 text-slate-600 tabular-nums">
            {toBanglaDigits(formatBdPhoneLocal(user.phone))}
          </p>
          <span
            className={
              premium
                ? 'mt-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800'
                : 'mt-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700'
            }
          >
            {premium ? 'প্রিমিয়াম' : 'ফ্রি'} অ্যাকাউন্ট
          </span>
        </section>

        <section className="rounded-xl border border-dashed border-slate-300 p-5 text-slate-600">
          পোস্টার টেমপ্লেট শীঘ্রই এখানে দেখা যাবে।
        </section>

        <Button
          variant="outline"
          onClick={() => logout.mutate(true)}
          disabled={logout.isPending}
          className="w-full"
        >
          সব ডিভাইস থেকে লগআউট
        </Button>
      </main>
    </div>
  );
}

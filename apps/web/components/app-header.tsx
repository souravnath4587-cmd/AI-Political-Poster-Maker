'use client';

import { ArrowLeft, LogOut } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/lib/auth';

/** Top bar for logged-in pages. `backHref` shows a back arrow instead of the logout button. */
export function AppHeader({ title, backHref }: { title?: string; backHref?: string }) {
  const logout = useLogout();

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 bg-slate-900 px-4 py-3 text-white">
      {backHref && (
        <Link
          href={backHref}
          aria-label="ফিরে যান"
          className="-ml-1 rounded-lg p-1.5 text-slate-200 hover:bg-slate-800 hover:text-white"
        >
          <ArrowLeft className="size-5" />
        </Link>
      )}
      <span className="flex-1 truncate text-lg font-bold">{title ?? 'পোস্টার মেকার'}</span>
      {!backHref && (
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
      )}
    </header>
  );
}

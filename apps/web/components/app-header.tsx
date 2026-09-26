'use client';

import { LogOut, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/lib/auth';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/', label: 'হোম' },
  { href: '/history', label: 'আমার পোস্টার' },
  { href: '/plans', label: 'প্ল্যান' },
] as const;

/** `/` matches only itself; other links also match their sub-pages. */
function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Top bar for logged-in pages: brand, the main routes and logout, on one row down to 360 px. */
export function AppHeader() {
  const pathname = usePathname();
  const logout = useLogout();

  return (
    <header className="sticky top-0 z-20 bg-slate-900 text-white">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-1 px-2 sm:gap-3 sm:px-6">
        <Link
          href="/"
          aria-label="পোস্টার মেকার"
          className="flex min-h-12 shrink-0 items-center gap-2 rounded-lg px-2 font-bold"
        >
          <Megaphone className="size-5 text-emerald-400" aria-hidden />
          <span className="hidden text-lg sm:inline">পোস্টার মেকার</span>
        </Link>

        <nav aria-label="প্রধান মেনু" className="flex min-w-0 flex-1 items-center">
          {NAV_LINKS.map(({ href, label }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 items-center border-b-2 px-2 text-sm font-semibold whitespace-nowrap transition-colors sm:px-3',
                  active
                    ? 'border-emerald-400 text-white'
                    : 'border-transparent text-slate-300 hover:text-white',
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => logout.mutate(false)}
          disabled={logout.isPending}
          aria-label="লগআউট"
          className="h-10 shrink-0 px-2.5 text-slate-200 hover:bg-slate-800 hover:text-white sm:px-3"
        >
          <LogOut aria-hidden />
          <span className="hidden sm:inline">লগআউট</span>
        </Button>
      </div>
    </header>
  );
}

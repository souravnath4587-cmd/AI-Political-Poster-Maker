import { ShieldCheck } from 'lucide-react';

export function AuthHeader() {
  return (
    <header className="bg-slate-900 px-6 pt-10 pb-7 text-white">
      <div className="flex items-center gap-2 text-sm text-slate-300">
        <ShieldCheck className="size-6 text-emerald-400" aria-hidden />
        <span>সুরক্ষিত প্রবেশ</span>
      </div>
      <h1 className="mt-4 text-3xl font-bold">পোস্টার মেকার</h1>
      <p className="mt-1 text-slate-400">আপনার রাজনৈতিক প্রচার সহজ ও উন্নত করুন</p>
    </header>
  );
}

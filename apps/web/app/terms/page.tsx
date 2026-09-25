import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'ব্যবহারের শর্তাবলী — পোস্টার মেকার' };

// First version; task 8.6 in implementation-plan.md finalizes it.
const TERMS = [
  'পোস্টারে ব্যবহৃত সব ছবি, নাম ও তথ্য ব্যবহারের অনুমতি আপনার থাকতে হবে। অন্য কারও ছবি বা নাম তাঁর সম্মতি ছাড়া ব্যবহার করবেন না।',
  'মানহানিকর, ঘৃণা ছড়ায় এমন, মিথ্যা সমর্থন দাবি করে এমন বা নিষিদ্ধ সংগঠনের কোনো কন্টেন্ট তৈরি করা যাবে না।',
  'নির্বাচনী প্রচারণার পোস্টার তৈরির ক্ষেত্রে নির্বাচন কমিশনের প্রচলিত আচরণবিধি মেনে চলা আপনার দায়িত্ব।',
  'অপব্যবহার রোধে প্রতিটি পোস্টার তৈরির তথ্য সংরক্ষণ করা হয়। নিয়ম ভঙ্গ করলে অ্যাকাউন্ট বন্ধ করা হতে পারে।',
  'আপনার আপলোড করা ছবি ও তৈরি করা পোস্টার আপনি মুছে না ফেলা পর্যন্ত সংরক্ষিত থাকে।',
];

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">ব্যবহারের শর্তাবলী</h1>
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-slate-700">
        {TERMS.map((term) => (
          <li key={term}>{term}</li>
        ))}
      </ol>
      <Link href="/login" className="mt-8 inline-block font-medium text-emerald-700 underline">
        লগইন পাতায় ফিরে যান
      </Link>
    </main>
  );
}

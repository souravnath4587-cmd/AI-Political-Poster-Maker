import { ApiStatus } from './api-status';

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-12">
      <h1 className="font-serif text-3xl font-bold">পোস্টার মেকার</h1>
      <p className="text-lg">
        নাম, পদবি আর ছবি দিন — মিনিটেই তৈরি হবে প্রিন্ট-উপযোগী পোস্টার। সংগ্রাম, শ্রদ্ধাঞ্জলি।
      </p>
      <ApiStatus />
    </main>
  );
}

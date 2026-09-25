import type { Metadata, Viewport } from 'next';
import { Hind_Siliguri, Noto_Serif_Bengali } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Providers } from './providers';
import './globals.css';

const hindSiliguri = Hind_Siliguri({
  variable: '--font-sans',
  subsets: ['bengali', 'latin'],
  weight: ['400', '500', '600', '700'],
});

const notoSerifBengali = Noto_Serif_Bengali({
  variable: '--font-noto-serif-bengali',
  subsets: ['bengali'],
});

export const metadata: Metadata = {
  title: 'পোস্টার মেকার',
  description: 'মিনিটেই প্রিন্ট-উপযোগী রাজনৈতিক পোস্টার তৈরি করুন',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="bn"
      className={cn('h-full antialiased', hindSiliguri.variable, notoSerifBengali.variable)}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

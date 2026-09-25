import { toBanglaDigits } from '@app/shared';
import { ApiError } from './api';

const bn = toBanglaDigits;

/** Bangla message for an API error code (the UI never shows the server's English text). */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।';

  const { code, details } = error;
  switch (code) {
    case 'INVALID_PHONE':
      return 'সঠিক মোবাইল নম্বর দিন (যেমন ০১৭১২৩৪৫৬৭৮)।';
    case 'CODE_INVALID': {
      const left = typeof details.attemptsLeft === 'number' ? details.attemptsLeft : null;
      if (left === null) return 'কোডটি সঠিক নয়।';
      return left > 0
        ? `কোডটি সঠিক নয়। আর ${bn(left)} বার চেষ্টা করতে পারবেন।`
        : 'কোডটি সঠিক নয়। নতুন কোড নিন।';
    }
    case 'CODE_EXPIRED':
      return 'কোডের মেয়াদ শেষ হয়ে গেছে। নতুন কোড নিন।';
    case 'TOO_MANY_ATTEMPTS':
      return 'অনেকবার ভুল কোড দেওয়া হয়েছে। নতুন কোড নিন।';
    case 'RATE_LIMITED': {
      const sec = typeof details.retryAfterSec === 'number' ? details.retryAfterSec : null;
      return sec
        ? `একটু অপেক্ষা করুন। ${bn(sec)} সেকেন্ড পর আবার কোড চাইতে পারবেন।`
        : 'অনেক বেশি অনুরোধ। একটু পরে আবার চেষ্টা করুন।';
    }
    case 'TERMS_REQUIRED':
      return 'অ্যাকাউন্ট খুলতে ব্যবহারের শর্তাবলীতে সম্মতি দিন।';
    case 'SMS_UNAVAILABLE':
      return 'এই মুহূর্তে এসএমএস পাঠানো যাচ্ছে না। একটু পরে চেষ্টা করুন।';
    case 'UNAUTHENTICATED':
      return 'অনুগ্রহ করে আবার লগইন করুন।';
    case 'FORBIDDEN':
      return 'এই কাজের অনুমতি নেই।';
    case 'NETWORK_ERROR':
      return 'সার্ভারের সাথে সংযোগ হচ্ছে না। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।';
    default:
      return 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।';
  }
}

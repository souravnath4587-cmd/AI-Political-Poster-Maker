import { toBanglaDigits, type PhotoField } from '@app/shared';
import { ApiError } from './api';
import { PHOTO_FIELD_LABELS } from './labels';

const bn = toBanglaDigits;

/** Bangla message for an API error code (the UI never shows the server's English text). */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।';

  const { code, details } = error;
  const field =
    typeof details.field === 'string' && details.field in PHOTO_FIELD_LABELS
      ? PHOTO_FIELD_LABELS[details.field as PhotoField]
      : null;

  switch (code) {
    // Uploads
    case 'NO_FILE':
      return 'একটি ছবি বেছে নিন।';
    case 'FILE_TOO_LARGE':
      return 'ছবিটি অনেক বড়। ১০ মেগাবাইটের কম ছবি দিন।';
    case 'UNSUPPORTED_IMAGE':
      return 'এই ধরনের ফাইল চলবে না। JPG, PNG বা WebP ছবি দিন।';
    case 'IMAGE_TOO_SMALL': {
      const min = typeof details.minSide === 'number' ? bn(details.minSide) : '৪০০';
      return `ছবিটি খুব ছোট। অন্তত ${min} পিক্সেলের ছবি দিন।`;
    }
    case 'STORAGE_UNAVAILABLE':
    case 'STORAGE_ERROR':
      return 'ছবি সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।';

    // Posters
    case 'PHOTO_REQUIRED':
      return field ? `"${field}" ছবিটি দিন।` : 'প্রয়োজনীয় সব ছবি দিন।';
    case 'PHOTO_NOT_FOUND':
      return field
        ? `"${field}" ছবিটি আবার আপলোড করুন।`
        : 'একটি ছবি পাওয়া যায়নি। আবার আপলোড করুন।';
    case 'PHOTO_WRONG_KIND':
      return field ? `"${field}" ঘরে ভুল ছবি দেওয়া হয়েছে।` : 'একটি ছবি ভুল ঘরে দেওয়া হয়েছে।';
    case 'FIELD_REQUIRED':
      return 'আপনার নাম ও পদবি লিখুন।';
    case 'TEXT_TOO_LONG':
      return 'কোনো একটি লেখা বেশি লম্বা হয়েছে। একটু ছোট করুন।';
    case 'RENDER_FAILED':
      return 'পোস্টার তৈরি করা যায়নি। আবার চেষ্টা করুন।';
    case 'TEMPLATE_NOT_FOUND':
      return 'টেমপ্লেটটি পাওয়া যায়নি। অন্য একটি বেছে নিন।';
    case 'BLOCKED_CONTENT':
      return 'লেখায় এমন শব্দ আছে যা ব্যবহার করা যাবে না। লাল চিহ্নিত ঘরটি ঠিক করুন।';
    case 'VALIDATION_ERROR':
      return 'কিছু তথ্য ঠিক নেই। দেখে নিয়ে আবার চেষ্টা করুন।';
    case 'NOT_FOUND':
      return 'যা খুঁজছেন তা পাওয়া যায়নি।';
    case 'AI_UNAVAILABLE':
      return 'এই মুহূর্তে এআই পরামর্শ পাওয়া যাচ্ছে না। একটু পরে চেষ্টা করুন, বা নিজে লিখুন।';
    case 'POSTER_NOT_FOUND':
      return 'পোস্টারটি পাওয়া যায়নি।';
    case 'QUOTA_EXCEEDED': {
      const limit = typeof details.limit === 'number' ? bn(details.limit) : '';
      if (details.kind === 'headlines') return 'আজকের এআই পরামর্শের সীমা শেষ। শিরোনাম নিজে লিখুন।';
      return details.kind === 'regenerations'
        ? `আজ ${limit} বার আবার তৈরি করা হয়ে গেছে। রাত ১২টার পর আবার পারবেন।`
        : `আজকের ${limit}টি পোস্টার বানানো শেষ। রাত ১২টার পর আবার বানাতে পারবেন।`;
    }

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
      // Burst limits on uploads, posters and suggestions (scope other than login codes).
      if (typeof details.scope === 'string' && details.scope !== 'otp-request') {
        return sec
          ? `অনেক বেশি অনুরোধ হয়েছে। ${bn(sec)} সেকেন্ড পর আবার চেষ্টা করুন।`
          : 'অনেক বেশি অনুরোধ হয়েছে। একটু পরে আবার চেষ্টা করুন।';
      }
      if (details.reason === 'hourly') {
        const min = sec ? Math.ceil(sec / 60) : null;
        return min
          ? `অনেকবার কোড চাওয়া হয়েছে। ${bn(min)} মিনিট পর আবার চেষ্টা করুন।`
          : 'অনেকবার কোড চাওয়া হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।';
      }
      return sec
        ? `একটু অপেক্ষা করুন। ${bn(sec)} সেকেন্ড পর আবার কোড চাইতে পারবেন।`
        : 'অনেক বেশি অনুরোধ। একটু পরে আবার চেষ্টা করুন।';
    }
    case 'TERMS_REQUIRED':
      return 'অ্যাকাউন্ট খুলতে ব্যবহারের শর্তাবলীতে সম্মতি দিন।';
    case 'SMS_UNAVAILABLE':
      return 'এই মুহূর্তে এসএমএস পাঠানো যাচ্ছে না। একটু পরে চেষ্টা করুন।';
    case 'SMS_FAILED':
      return 'এসএমএস পাঠানো যায়নি। নম্বরটি দেখে নিয়ে একটু পরে আবার চেষ্টা করুন।';
    case 'SERVICE_UNAVAILABLE':
      return 'সার্ভারে সাময়িক সমস্যা হচ্ছে। কিছুক্ষণ পর আবার চেষ্টা করুন।';
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

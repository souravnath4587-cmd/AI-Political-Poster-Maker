import type { OccasionType, PhotoField, TextField, UserPlan } from '@app/shared';

export const TEXT_FIELD_LABELS: Record<TextField, string> = {
  headline: 'শিরোনাম',
  message: 'বার্তা',
  name: 'আপনার নাম',
  designation: 'পদবি',
  organization: 'দল/সংস্থা',
  location: 'ইউনিয়ন/থানা/জেলা',
  leader1Name: 'নেতা ১-এর নাম',
  leader1Title: 'নেতা ১-এর পদবি',
  leader2Name: 'নেতা ২-এর নাম',
  leader2Title: 'নেতা ২-এর পদবি',
};

export const TEXT_FIELD_PLACEHOLDERS: Partial<Record<TextField, string>> = {
  name: 'যেমন: মোঃ আব্দুর রহিম',
  designation: 'যেমন: সভাপতি, ওয়ার্ড নং ০৫',
  organization: 'দলের বা সংগঠনের নাম',
  location: 'যেমন: মিরপুর, ঢাকা',
  leader1Name: 'যেমন: আলহাজ্ব মোঃ করিম',
  leader1Title: 'যেমন: সভাপতি, জেলা কমিটি',
  leader2Name: 'যেমন: অধ্যক্ষ শাহানা পারভীন',
  leader2Title: 'যেমন: সাধারণ সম্পাদক',
};

export const PHOTO_FIELD_LABELS: Record<PhotoField, string> = {
  leader1Photo: 'নেতা ১',
  leader2Photo: 'নেতা ২',
  requesterPhoto: 'আপনার ছবি',
  partySymbol: 'প্রতীক/লোগো',
};

export const OCCASION_LABELS_BN: Record<OccasionType, string> = {
  victory_day: 'বিজয় দিবস',
  national_day: 'জাতীয় দিবস',
  mourning: 'শোক ও স্মরণ',
  election: 'নির্বাচনী প্রচার',
  greeting: 'শুভেচ্ছা',
  festival: 'উৎসব',
};

export const PLAN_LABELS_BN: Record<UserPlan, string> = {
  free: 'ফ্রি',
  pro: 'প্রো',
  premium: 'প্রিমিয়াম',
};

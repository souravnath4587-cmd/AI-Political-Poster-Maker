import { PHOTO_PLACEHOLDER, type PosterContent } from '../render/posterHtml';
import { mourning } from './mourning';
import type { TemplateSeed } from './types';
import { victoryDay } from './victoryDay';

export type { TemplateSeed } from './types';

export const TEMPLATE_SEEDS: readonly TemplateSeed[] = [victoryDay, mourning];

/** Realistic content for thumbnails, samples and tests. Photos are grey placeholders. */
export const SAMPLE_CONTENT: PosterContent = {
  text: {
    name: 'মোঃ সাইফুল ইসলাম শান্ত',
    designation: 'সাংগঠনিক সম্পাদক',
    organization: 'যুব সংগঠন, ৫নং ওয়ার্ড',
    location: 'সদর দক্ষিণ, কুমিল্লা',
    leader1Name: 'আলহাজ্ব মোঃ রফিকুল ইসলাম',
    leader1Title: 'সভাপতি, জেলা কমিটি',
    leader2Name: 'অধ্যক্ষ শাহানা পারভীন',
    leader2Title: 'সাধারণ সম্পাদক, জেলা কমিটি',
  },
  photos: {
    leader1Photo: { url: PHOTO_PLACEHOLDER },
    leader2Photo: { url: PHOTO_PLACEHOLDER },
    requesterPhoto: { url: PHOTO_PLACEHOLDER },
  },
};

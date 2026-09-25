// Hard-coded poster for the Phase 1 render spike. Phase 2 replaces it with templates built from layoutConfig.
import { escapeHtml } from '../lib/html';
import { FONT_FAMILIES, fontFaceCss } from './fonts';

export interface TestPosterData {
  organization: string;
  headline: string;
  message: string;
  leaders: { name: string; title: string }[];
  requester: { name: string; designation: string; organization: string; location: string };
}

export const TEST_POSTER_FONTS = [FONT_FAMILIES.serif, FONT_FAMILIES.body] as const;

// Contains the conjuncts from the acceptance criteria: সংগ্রাম, শ্রদ্ধাঞ্জলি, ক্ষ (লক্ষ, রক্ষা), ন্ত্র (গণতন্ত্র).
export const SAMPLE_POSTER: TestPosterData = {
  organization: 'জেলা যুব সংগঠন, কুমিল্লা',
  headline: 'মহান বিজয় দিবস',
  message:
    'স্বাধীনতা সংগ্রামের সকল বীর শহীদের প্রতি বিনম্র শ্রদ্ধাঞ্জলি। ত্রিশ লক্ষ শহীদের রক্তে অর্জিত স্বাধীনতা ও গণতন্ত্র রক্ষায় আমরা ঐক্যবদ্ধ।',
  leaders: [
    { name: 'আলহাজ্ব মোঃ রফিকুল ইসলাম', title: 'সভাপতি, জেলা কমিটি' },
    { name: 'অধ্যক্ষ শাহানা পারভীন', title: 'সাধারণ সম্পাদক, জেলা কমিটি' },
  ],
  requester: {
    name: 'মোঃ সাইফুল ইসলাম শান্ত',
    designation: 'সাংগঠনিক সম্পাদক',
    organization: 'যুব সংগঠন, ৫নং ওয়ার্ড',
    location: 'সদর দক্ষিণ, কুমিল্লা',
  },
};

const PHOTO_PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='#90a4ae'/><circle cx='50' cy='38' r='18' fill='#eceff1'/><path d='M14 100c0-22 16-36 36-36s36 14 36 36z' fill='#eceff1'/></svg>",
  );

/** A text box that the fit script shrinks to fit. Sizes are in vw. */
function fitBox(id: string, text: string, min: number, max: number, lines: number, cls: string) {
  return `<div class="fit ${cls}" data-fit="${id}" data-fit-min="${min}" data-fit-max="${max}" data-fit-lines="${lines}"><div><span>${escapeHtml(text)}</span></div></div>`;
}

export function buildTestPosterHtml(data: TestPosterData): string {
  const leaders = data.leaders
    .map(
      (leader, i) => `
      <figure class="leader">
        <img class="photo" src="${PHOTO_PLACEHOLDER}" alt="">
        ${fitBox(`leader${i + 1}Name`, leader.name, 2.4, 3.6, 1, 'leader-name')}
        ${fitBox(`leader${i + 1}Title`, leader.title, 1.8, 2.6, 1, 'leader-title')}
      </figure>`,
    )
    .join('');

  const r = data.requester;

  return `<!doctype html>
<html lang="bn">
<head>
<meta charset="utf-8">
<style>
${fontFaceCss()}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100vw; height: 100vh; overflow: hidden; }
body { font-family: '${FONT_FAMILIES.body}'; color: #fff; }

.poster {
  position: relative; width: 100vw; height: 100vh; overflow: hidden;
  display: flex; flex-direction: column; align-items: center;
  background:
    radial-gradient(circle at 50% 30%, #f42a41 0 21vw, rgba(244,42,65,0) 21.3vw),
    linear-gradient(180deg, #003d2c 0%, #006a4e 50%, #0b7a55 100%);
}
.poster::after { /* paddy field stripes above the footer */
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 45%;
  background: repeating-linear-gradient(100deg, rgba(247,208,70,.28) 0 .5vw, rgba(247,208,70,0) .5vw 1.7vw);
  -webkit-mask-image: linear-gradient(to top, #000 30%, transparent);
  pointer-events: none;
}
.poster > * { position: relative; z-index: 1; }

.fit { overflow: hidden; display: flex; align-items: safe center; justify-content: center; text-align: center; }
.fit > div { width: 100%; }

.topline {
  width: 100%; height: 7vw; padding: 0 4vw; background: rgba(0,0,0,.25);
  font-weight: 600; color: #f7d046; border-bottom: .4vw solid #f7d046;
}

.leaders { display: flex; justify-content: center; gap: 12vw; margin-top: 4vw; }
.leader { width: 34vw; display: flex; flex-direction: column; align-items: center; }
.photo {
  width: 25vw; height: 25vw; border-radius: 50%; object-fit: cover;
  border: 1vw solid #f7d046; box-shadow: 0 1vw 3vw rgba(0,0,0,.45);
}
.leader-name { width: 100%; height: 5vw; margin-top: 1.5vw; font-weight: 700; }
.leader-title { width: 100%; height: 3.6vw; color: #ffe9a8; }

.headline {
  width: 92vw; height: 26vw; margin-top: 2vw;
  font-family: '${FONT_FAMILIES.serif}'; font-weight: 800; line-height: 1.3;
  color: #f7d046; text-shadow: 0 .5vw 0 #7a0010, 0 1vw 2.5vw rgba(0,0,0,.5);
}
.message {
  width: 84vw; flex: 1; min-height: 0; margin: 1vw 0 3vw;
  font-weight: 500; line-height: 1.6; text-shadow: 0 .3vw 1vw rgba(0,0,0,.6);
}

.footer {
  width: 100%; height: 25vw; flex-shrink: 0; display: flex; align-items: center; gap: 3vw;
  padding: 0 4vw; background: #fff; color: #004d38; border-top: 1.2vw solid #f42a41;
}
.footer .photo { width: 18vw; height: 18vw; border-width: .8vw; border-color: #006a4e; flex-shrink: 0; }
.footer .details { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.credit { font-size: 2.4vw; font-weight: 600; color: #f42a41; }
.footer .fit { justify-content: flex-start; text-align: left; }
.req-name { height: 6.5vw; font-weight: 700; }
.req-line { height: 3.8vw; font-weight: 500; }
</style>
</head>
<body>
<main class="poster">
  ${fitBox('organization', data.organization, 2.2, 3.4, 1, 'topline')}
  <section class="leaders">${leaders}</section>
  ${fitBox('headline', data.headline, 6, 12, 2, 'headline')}
  ${fitBox('message', data.message, 2.6, 4.6, 0, 'message')}
  <footer class="footer">
    <img class="photo" src="${PHOTO_PLACEHOLDER}" alt="">
    <div class="details">
      <div class="credit">প্রচারে:</div>
      ${fitBox('requesterName', r.name, 3, 5.2, 1, 'req-name')}
      ${fitBox('requesterDesignation', r.designation, 2.2, 3, 1, 'req-line')}
      ${fitBox('requesterOrganization', `${r.organization}, ${r.location}`, 2, 3, 1, 'req-line')}
    </div>
  </footer>
</main>
</body>
</html>`;
}

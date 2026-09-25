import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Fonts live in apps/api/assets (outside src) so dev (tsx) and prod (dist) resolve them the same way.
// Both `pnpm dev` and the Docker image run with apps/api as the working directory.
const FONTS_DIR = resolve(process.cwd(), 'assets/fonts');

export const FONT_FAMILIES = {
  serif: 'Noto Serif Bengali',
  sans: 'Noto Sans Bengali',
  body: 'Hind Siliguri',
} as const;

const FONT_FACES = [
  {
    family: FONT_FAMILIES.serif,
    file: 'NotoSerifBengali-Variable.ttf',
    weight: '100 900',
    stretch: '62.5% 100%',
  },
  {
    family: FONT_FAMILIES.sans,
    file: 'NotoSansBengali-Variable.ttf',
    weight: '100 900',
    stretch: '62.5% 100%',
  },
  { family: FONT_FAMILIES.body, file: 'HindSiliguri-Regular.ttf', weight: '400' },
  { family: FONT_FAMILIES.body, file: 'HindSiliguri-SemiBold.ttf', weight: '600' },
  { family: FONT_FAMILIES.body, file: 'HindSiliguri-Bold.ttf', weight: '700' },
];

let cachedCss: string | null = null;

/** @font-face rules with the font files inlined as data URIs (read from disk once). */
export function fontFaceCss(): string {
  cachedCss ??= FONT_FACES.map((face) => {
    const data = readFileSync(resolve(FONTS_DIR, face.file)).toString('base64');
    return `@font-face {
  font-family: '${face.family}';
  src: url(data:font/ttf;base64,${data}) format('truetype');
  font-weight: ${face.weight};
  ${face.stretch ? `font-stretch: ${face.stretch};` : ''}
  font-display: block;
}`;
  }).join('\n');
  return cachedCss;
}

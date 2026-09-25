// Scripts evaluated inside the Chromium page. Kept as plain JS strings: functions passed to
// page.evaluate() get esbuild helpers (e.g. __name) injected by tsx/tsup, which don't exist in the page.

export interface FitResult {
  id: string;
  fontSizePx: number;
  lines: number;
  overflow: boolean;
}

/**
 * Shrinks the text in every `[data-fit]` box until it fits.
 * Markup: <div data-fit="name" data-fit-min="3" data-fit-max="6" data-fit-lines="1"><span>…</span></div>
 * Sizes are in vw (percent of poster width) so the same template works at every output size.
 * The box must have a fixed width and height; the inner <span> is measured to count lines.
 */
export const FIT_TEXT_SCRIPT = `(() => {
  const results = [];
  const vw = window.innerWidth / 100;
  for (const box of document.querySelectorAll('[data-fit]')) {
    const span = box.querySelector('span') || box;
    const minPx = parseFloat(box.dataset.fitMin) * vw;
    const maxPx = parseFloat(box.dataset.fitMax) * vw;
    const maxLines = parseInt(box.dataset.fitLines || '0', 10);
    const measure = (px) => {
      box.style.fontSize = px + 'px';
      const lines = new Set([...span.getClientRects()].map((r) => Math.round(r.top))).size;
      const fits =
        box.scrollHeight <= box.clientHeight + 1 &&
        box.scrollWidth <= box.clientWidth + 1 &&
        (maxLines === 0 || lines <= maxLines);
      return { fits, lines };
    };
    let lo = Math.floor(minPx), hi = Math.floor(maxPx), best = null;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (measure(mid).fits) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    const size = best ?? Math.floor(minPx);
    const final = measure(size);
    results.push({ id: box.dataset.fit, fontSizePx: size, lines: final.lines, overflow: !final.fits });
  }
  return results;
})()`;

/** Returns the required font families that did not load, plus any font faces that failed. */
export function fontCheckScript(requiredFamilies: readonly string[]): string {
  return `(async () => {
  await document.fonts.ready;
  const faces = [...document.fonts];
  const family = (f) => f.family.replace(/["']/g, '');
  const required = ${JSON.stringify(requiredFamilies)};
  const missing = required.filter((name) => !faces.some((f) => family(f) === name && f.status === 'loaded'));
  const failed = faces.filter((f) => f.status === 'error').map((f) => family(f) + ' (error)');
  return [...missing, ...failed];
})()`;
}

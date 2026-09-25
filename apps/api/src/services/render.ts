import puppeteer, { type Browser } from 'puppeteer';
import sharp from 'sharp';
import { OUTPUT_SIZES, type OutputSize } from '@app/shared';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { Semaphore } from '../lib/semaphore';
import { FIT_TEXT_SCRIPT, fontCheckScript, type FitResult } from '../render/pageScripts';

const RENDER_TIMEOUT_MS = 25_000;

// Pages may only load inline data and images from our own storage (no SSRF, no tracking).
const ALLOWED_HOSTS = new Set(['res.cloudinary.com']);

export interface RenderOptions {
  size: OutputSize;
  /** Font families that must be loaded, or the render fails instead of showing fallback glyphs. */
  requiredFonts: readonly string[];
}

export interface RenderResult {
  png: Buffer;
  width: number;
  height: number;
  fit: FitResult[];
  renderMs: number;
}

export class RenderError extends Error {
  override name = 'RenderError';
}

const slots = new Semaphore(env.RENDER_CONCURRENCY);
let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (browserPromise) return browserPromise;

  const launching: Promise<Browser> = puppeteer
    .launch({
      headless: true,
      args: [
        '--disable-dev-shm-usage', // Docker's /dev/shm is tiny
        '--font-render-hinting=none', // same glyph metrics on every OS
        ...(env.CHROME_NO_SANDBOX ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
      ],
    })
    .then((browser) => {
      browser.on('disconnected', () => {
        // closeBrowser() clears browserPromise first, so this only fires on a crash.
        if (browserPromise !== launching) return;
        logger.warn('Chromium disconnected; relaunching on next render');
        browserPromise = null;
      });
      logger.info('Chromium launched');
      return browser;
    })
    .catch((err: unknown) => {
      if (browserPromise === launching) browserPromise = null;
      throw err;
    });

  browserPromise = launching;
  return launching;
}

function isAllowedUrl(url: string): boolean {
  if (url.startsWith('data:') || url === 'about:blank') return true;
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && ALLOWED_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

export function renderPoster(html: string, options: RenderOptions): Promise<RenderResult> {
  return slots.run(async () => {
    const started = performance.now();
    const spec = OUTPUT_SIZES[options.size];
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      page.setDefaultTimeout(RENDER_TIMEOUT_MS);
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (isAllowedUrl(request.url())) void request.continue();
        else void request.abort('blockedbyclient');
      });

      await page.setViewport({
        width: spec.cssWidth,
        height: spec.cssHeight,
        deviceScaleFactor: spec.width / spec.cssWidth,
      });
      await page.setContent(html, { waitUntil: 'load' });

      const missingFonts = (await page.evaluate(
        fontCheckScript(options.requiredFonts),
      )) as string[];
      if (missingFonts.length > 0) {
        throw new RenderError(`Fonts not loaded: ${missingFonts.join(', ')}`);
      }

      const fit = (await page.evaluate(FIT_TEXT_SCRIPT)) as FitResult[];

      const screenshot = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width: spec.cssWidth, height: spec.cssHeight },
        optimizeForSpeed: true,
      });

      // The fractional scale factor can land a pixel off; normalize to the exact size and set DPI.
      const png = await sharp(screenshot)
        .resize(spec.width, spec.height, { fit: 'fill' })
        .withMetadata({ density: spec.dpi })
        .png({ compressionLevel: 6 })
        .toBuffer();

      return {
        png,
        width: spec.width,
        height: spec.height,
        fit,
        renderMs: Math.round(performance.now() - started),
      };
    } finally {
      await page.close().catch(() => undefined);
    }
  });
}

/** Number of open tabs, excluding the one Chromium starts with. Used to check for leaked pages. */
export async function openPageCount(): Promise<number> {
  if (!browserPromise) return 0;
  const pages = await (await browserPromise).pages();
  return Math.max(0, pages.length - 1);
}

export async function closeBrowser(): Promise<void> {
  const pending = browserPromise;
  browserPromise = null;
  if (pending) await (await pending).close().catch(() => undefined);
}

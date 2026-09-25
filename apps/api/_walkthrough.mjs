// Captures every step of the app at phone size for the walkthrough guide.
import puppeteer from 'puppeteer';
import sharp from 'sharp';

const D = '.data/walkthrough';
const BASE = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('WT', ...a);

const b = await puppeteer.launch({ headless: true });
const p = await b.newPage();
p.setDefaultTimeout(120000);
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
// Hide the Next.js dev badge from screenshots.
await p.evaluateOnNewDocument(() => {
  const style = document.createElement('style');
  style.textContent = 'nextjs-portal{display:none!important}';
  document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
});

let n = 0;
async function shot(name, { scrollTo, block = 'start', offset = -80 } = {}) {
  if (scrollTo) {
    await p.$eval(scrollTo, (el, blk) => el.scrollIntoView({ block: blk }), block);
    if (block === 'start') await p.evaluate((o) => window.scrollBy(0, o), offset);
  }
  await sleep(700);
  const file = `${D}/${String(++n).padStart(2, '0')}-${name}.jpg`;
  const png = await p.screenshot({ type: 'png' });
  await sharp(png).jpeg({ quality: 74, mozjpeg: true }).toFile(file);
  log('shot', file);
}
const clickText = async (tag, text) => {
  const [el] = await p.$$(`xpath/.//${tag}[contains(., "${text}")]`);
  if (!el) throw new Error(`No ${tag} "${text}"`);
  await el.click();
};

let posterId = null;
try {
  // Login
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
  await shot('login');
  await shot('reviewer-panel', { scrollTo: '#reviewer-access-title', block: 'center' });
  const [useFree] = await p.$$('xpath/.//button[contains(., "ব্যবহার করুন")]');
  await useFree.click();
  await p.evaluate(() => window.scrollTo(0, 0));
  await clickText('button', 'কোড পাঠান');
  await p.waitForSelector('#otp');
  await shot('code-step');
  await p.focus('#otp');
  await p.keyboard.type('123456');
  await p.waitForFunction(() => location.pathname === '/');

  // Dashboard
  await p.waitForFunction(() => [...document.querySelectorAll('a[href^="/posters/new"] img')].every((i) => i.complete && i.naturalWidth > 0));
  await shot('dashboard');
  await shot('templates', { scrollTo: '#templates-title' });

  // Form
  const [victory] = await p.$$('xpath/.//a[contains(@href, "/posters/new") and contains(., "বিজয়")]');
  await victory.click();
  await p.waitForSelector('input[type=file]');
  await shot('form-top');
  const inputs = await p.$$('input[type=file]');
  const labels = await Promise.all(inputs.map((i) => i.evaluate((el) => el.getAttribute('aria-label'))));
  const byLabel = (l) => inputs[labels.indexOf(l)];
  await byLabel('নেতা ১').uploadFile(`${D}/leader1.jpg`);
  await byLabel('নেতা ২').uploadFile(`${D}/leader2.jpg`);
  await byLabel('আপনার ছবি').uploadFile(`${D}/me.jpg`);
  await byLabel('প্রতীক/লোগো').uploadFile(`${D}/symbol.png`);
  await p.waitForFunction(() => document.querySelectorAll('label img').length >= 4, { timeout: 90000 });
  await shot('photos-uploaded', { scrollTo: '#photos-title' });

  await p.type('#field-name', 'মোঃ করিম উদ্দিন');
  await p.type('#field-designation', 'সভাপতি, ৫নং ওয়ার্ড');
  await p.type('#field-organization', 'যুব সংগঠন');
  await p.type('#field-location', 'সদর দক্ষিণ, কুমিল্লা');
  await shot('text-filled', { scrollTo: '#text-title' });

  await clickText('button', 'এআই পরামর্শ');
  await p.waitForFunction(() => document.querySelectorAll('[aria-label="শিরোনামের পরামর্শ"] button').length > 0 || /পাওয়া যাচ্ছে না/.test(document.body.innerText), { timeout: 40000 });
  const chips = await p.$$('[aria-label="শিরোনামের পরামর্শ"] button');
  if (chips.length) {
    await chips[0].click();
    log('picked headline:', await p.$eval('#field-headline', (e) => e.value));
  } else log('AI suggestions unavailable right now');
  await shot('ai-headline', { scrollTo: '#field-headline', offset: -140 });

  // Generate
  await clickText('button', 'পোস্টার তৈরি করুন');
  await p.waitForSelector('[role=status].fixed', { timeout: 5000 }).then(() => shot('generating')).catch(() => log('overlay not captured'));
  await p.waitForFunction(() => /^\/posters\/[a-f0-9]{24}$/.test(location.pathname), { timeout: 90000 });
  posterId = new URL(p.url()).pathname.split('/').pop();
  await p.waitForFunction(() => { const i = document.querySelector('figure img'); return i && i.complete && i.naturalWidth > 0; });
  await shot('result');
  await shot('downloads', { scrollTo: 'section[aria-label="ডাউনলোড"]', block: 'center' });

  // Edit and regenerate
  await clickText('button', 'লেখা পরিবর্তন');
  await p.waitForSelector('#field-name');
  await p.$eval('#field-name', (e) => { e.focus(); e.select(); });
  await p.keyboard.press('Backspace');
  await p.type('#field-name', 'মোঃ করিম উদ্দিন সরকার');
  await shot('edit-panel', { scrollTo: '#field-name', block: 'center' });
  const before = await p.$eval('figure img', (i) => i.src);
  await clickText('button', 'আবার তৈরি করুন');
  await p.waitForFunction((src) => { const i = document.querySelector('figure img'); return i && i.src !== src && i.complete && i.naturalWidth > 0; }, { timeout: 90000 }, before);
  await p.evaluate(() => window.scrollTo(0, 0));
  await shot('after-edit');

  // History and delete
  await p.goto(`${BASE}/history`, { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => { const i = document.querySelector('article img'); return i && i.complete && i.naturalWidth > 0; });
  await shot('history');
  const card = (await p.$$('article'))[0];
  await (await card.$('button[aria-label="পোস্টার মুছুন"]')).click();
  await p.waitForFunction(() => /মুছে ফেলবেন/.test(document.body.innerText));
  await shot('delete-confirm');
  await clickText('button', 'হ্যাঁ, মুছুন');
  await p.waitForFunction(() => document.querySelectorAll('article').length === 0 || /এখনও কোনো পোস্টার নেই/.test(document.body.innerText), { timeout: 30000 });
  posterId = null;
  log('walkthrough poster deleted');
} catch (err) {
  log('FAILED:', err.message);
  await p.screenshot({ path: `${D}/failure.png` }).catch(() => {});
} finally {
  if (posterId) {
    const status = await p.evaluate((id) => fetch(`/api/posters/${id}`, { method: 'DELETE' }).then((r) => r.status), posterId).catch(() => 'n/a');
    log('cleanup delete:', status);
  }
  log('page errors:', errors.length ? errors : 'none');
  await b.close();
}

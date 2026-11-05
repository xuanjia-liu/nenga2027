// Smoke test: loads dist/preview.html in phone + PC mode, scrolls to every demo, screenshots it and
// fails on page errors. CDN libraries are served from vendor/ so it runs offline.
//   npm test                 (all demos)
//   npm test -- mochi omikuji   (only these demo ids)
// Screenshots go to tests/out/. WebGL runs on SwiftShader in headless Chromium: slow (a few fps),
// so judge visuals, not timing. Rhythm/physics feel must be checked on a real device.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const V = f => fs.readFileSync(path.join(ROOT, 'vendor', f), 'utf8');
const DEMOS = ['shear', 'count', 'gacha', 'post', 'flock', 'popup', 'dome', 'omikuji', 'fuku', 'mochi'];
const only = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  let failed = 0;
  for (const [w, h, mode] of [[1300, 900, 'pc'], [420, 900, 'phone']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(/fonts\.g/, r => r.abort());
    await page.route(/three\.min\.js/, r => r.fulfill({ body: V('three128.min.js'), contentType: 'application/javascript' }));
    await page.route(/GLTFLoader/, r => r.fulfill({ body: V('gltfloader128.js'), contentType: 'application/javascript' }));
    await page.route(/matter-js/, r => r.fulfill({ body: V('matter.min.js'), contentType: 'application/javascript' }));
    await page.addInitScript(m => { try { localStorage.setItem('nenga-mode', m); } catch (e) {} }, mode);
    await page.goto('file://' + path.join(ROOT, 'dist', 'preview.html'));
    await page.waitForTimeout(800);
    for (const id of DEMOS.filter(d => !only.length || only.includes(d))) {
      const dev = await page.$(`.dev:has(#${id})`);
      if (!dev) { console.log(`✗ ${mode} #${id} not found`); failed++; continue; }
      await dev.scrollIntoViewIfNeeded(); await page.waitForTimeout(2500);
      await dev.screenshot({ path: path.join(OUT, `${mode}_${id}.png`), timeout: 150000 });
      console.log(`✓ ${mode} #${id}`);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) { console.log(`✗ ${mode} horizontal overflow`); failed++; }
    if (errs.length) { console.log(`✗ ${mode} page errors:`, errs); failed++; }
    await page.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();

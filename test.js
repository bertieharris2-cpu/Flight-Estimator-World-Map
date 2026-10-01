// Headless checks + screenshots. Usage: node test.js
const { chromium } = require('playwright');
const path = require('path');
const url = 'file://' + path.join(__dirname, 'world-map-estimator.html');
const out = n => path.join(__dirname, 'screenshots', n);
let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures++; };

(async () => {
  const browser = await chromium.launch();
  for (const vp of [{ name: 'whiteboard', width: 1920, height: 1080, touch: false }, { name: 'ipad', width: 1180, height: 820, touch: true }, { name: 'ipad-portrait', width: 820, height: 1180, touch: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    const errors = [], requests = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(String(e)));
    page.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) requests.push(r.url()); });
    await page.goto(url);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: out(vp.name + '-1-start.png') });
    check(errors.length === 0, `${vp.name}: no console errors ${errors.join(' | ')}`);
    const markers = await page.$$eval('#markers [data-dest]', els => els.map(e => e.getAttribute('data-dest')));
    check(markers.length === 24, `${vp.name}: 23 flags + home shown (${markers.length})`);
    check(await page.$eval('#grid', e => getComputedStyle(e).display) === 'none', `${vp.name}: grid hidden at start`);
    check(/Spain/.test(await page.textContent('#known')) && /8 hours/.test(await page.textContent('#known')), `${vp.name}: known flights always on display`);

    // tap a flag (Japan), estimate, reveal
    const jp = await page.$('[data-dest="jp"] .badgeInner use');
    await jp.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: out(vp.name + '-2-flying.png') });
    check(await page.isVisible('#estVal') && /Tokyo/.test(await page.textContent('#estimate')), `${vp.name}: stepper visible after tapping Japan`);
    check(await page.$eval('#markers', e => e.classList.contains('planning')), `${vp.name}: other flags step back while planning`);
    for (let i = 0; i < 20; i++) await page.click('#plus');
    await page.click('#minus');
    check(await page.textContent('#estVal') === '9½ hours', `${vp.name}: stepper shows 9½ hours`);
    await page.waitForTimeout(3500);
    await page.click('#revealBtn');
    await page.waitForTimeout(300);
    const res = await page.textContent('#estimate');
    check(/14 − 9½ = 4½/.test(res) && /Too short by 4½ hours/.test(res), `${vp.name}: reveal shows subtraction and wording`);
    check((await page.$$('#tableWrap tbody tr')).length === 1, `${vp.name}: result added to board`);
    await page.screenshot({ path: out(vp.name + '-3-reveal.png') });
    await page.click('#squaresBtn');
    check(await page.$eval('#grid', e => getComputedStyle(e).display) !== 'none' && await page.isVisible('#key'), `${vp.name}: Show squares button reveals grid`);
    await page.screenshot({ path: out(vp.name + '-3b-squares.png') });
    await page.click('#squaresBtn');
    await page.click('#resultsBtn');
    await page.screenshot({ path: out(vp.name + '-3c-results.png') });
    await page.click('#closeResults');

    // typed entry
    await page.click('#againBtn');
    await page.click('[data-dest="fr"] .badgeInner use', { force: true });
    await page.fill('#typed', '1 1/2');
    check(await page.textContent('#estVal') === '1½ hours', `${vp.name}: typed "1 1/2" parsed`);
    await page.click('#revealBtn');
    check(/Spot on/.test(await page.textContent('#estimate')), `${vp.name}: spot on wording`);

    // zoom in with buttons, wheel, and drag pan
    const k0 = await page.evaluate(() => window.__fe.cam.k);
    await page.click('#zoomIn'); await page.click('#zoomIn');
    const k1 = await page.evaluate(() => window.__fe.cam.k);
    check(k1 > k0 * 2, `${vp.name}: zoom in button works`);
    const tx0 = await page.evaluate(() => window.__fe.cam.tx);
    const box = await page.$eval('#map', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    await page.mouse.move(box.x + box.w * 0.3, box.y + box.h * 0.2);
    await page.mouse.down(); await page.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.25, { steps: 5 }); await page.mouse.up();
    check(await page.evaluate(() => window.__fe.cam.tx) !== tx0, `${vp.name}: drag pans the map`);
    // zoom into Europe via wheel near home
    await page.click('#zoomReset');
    const home = await page.$eval('.marker.home', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * 0.8 }; });
    for (let i = 0; i < 6; i++) { await page.mouse.move(home.x, home.y); await page.mouse.wheel(0, -400); await page.waitForTimeout(50); }
    check(await page.evaluate(() => window.__fe.cam.k) > k0 * 5, `${vp.name}: wheel zoom works`);
    // flag stays same pixel size when zoomed
    const wFr = await page.$eval('[data-dest="fr"] .frame', e => e.getBoundingClientRect().width);
    await page.screenshot({ path: out(vp.name + '-4-europe.png') });
    await page.click('#zoomReset');
    const wFr0 = await page.$eval('[data-dest="fr"] .frame', e => e.getBoundingClientRect().width);
    check(Math.abs(wFr - wFr0) < 1, `${vp.name}: flags keep their size when zoomed (${wFr0.toFixed(0)}px)`);
    if (vp.touch) {
      // double-tap on open ocean zooms in
      const kA = await page.evaluate(() => window.__fe.cam.k);
      await page.tap('#map', { position: { x: box.w * 0.45, y: box.h * 0.85 } });
      await page.waitForTimeout(100);
      await page.tap('#map', { position: { x: box.w * 0.45, y: box.h * 0.85 } });
      check(await page.evaluate(() => window.__fe.cam.k) > kA * 1.5, `${vp.name}: double-tap zooms in`);
      await page.click('#zoomReset');
    }

    // teacher filters
    await page.click('#teacherBtn');
    await page.click('#hideAll');
    let shown = await page.$$eval('#markers [data-dest]', els => els.map(e => e.getAttribute('data-dest')).sort());
    check(JSON.stringify(shown) === JSON.stringify(['es', 'uk', 'us'].sort()), `${vp.name}: hide all keeps home + benchmarks (${shown})`);
    await page.screenshot({ path: out(vp.name + '-5-teacher.png') });
    await page.click('#tBench');
    shown = await page.$$eval('#markers [data-dest]', els => els.map(e => e.getAttribute('data-dest')));
    check(shown.length === 1 && (await page.$$('#lines .bench')).length === 0, `${vp.name}: benchmarks off removes lines and flags`);
    const ids = require('./data.json').destinations.map(d => d.id);
    for (const id of ids) {
      await page.check(`#countryList input[data-id="${id}"]`);
      const on = await page.$(`#markers [data-dest="${id}"]`);
      await page.uncheck(`#countryList input[data-id="${id}"]`);
      const off = await page.$(`#markers [data-dest="${id}"]`);
      check(on && !off, `${vp.name}: ${id} shows and hides from its tickbox`);
    }
    await page.click('[data-cont="Asia"]');
    shown = await page.$$eval('#markers [data-dest]', els => els.map(e => e.getAttribute('data-dest')).sort());
    check(JSON.stringify(shown) === JSON.stringify(['ae', 'cn', 'in', 'jp', 'kr', 'sg', 'th', 'uk']), `${vp.name}: continent button (${shown})`);
    await page.click('#showAll'); await page.click('#tBench');
    check((await page.$$('#markers [data-dest]')).length === 24, `${vp.name}: show all`);
    await page.click('#tGrid');
    check(await page.$eval('#grid', e => getComputedStyle(e).display) !== 'none', `${vp.name}: teacher grid toggle on`);
    await page.click('#tGrid');

    // animations fully off
    await page.click('#tAnim');
    await page.click('#closeTeacher');
    await page.click('[data-dest="au"] .badgeInner use', { force: true });
    const planeShown = await page.$eval('#planeIcon', e => e.style.display !== 'none');
    const lineDone = await page.evaluate(() => { const l = document.querySelector('#lines .flight'); return !!l; });
    const popAnims = await page.evaluate(() => document.getAnimations().length);
    check(!planeShown && lineDone && popAnims === 0, `${vp.name}: animations off = no plane, line drawn at once, no CSS animations (${popAnims})`);
    await page.click('#teacherBtn'); await page.click('#hideAll'); await page.click('#showAll');
    check(await page.evaluate(() => document.getAnimations().length) === 0, `${vp.name}: no pop animation when animations off`);
    await page.click('#closeTeacher');

    // persisted results survive reload
    await page.reload(); await page.waitForTimeout(300);
    check((await page.$$('#tableWrap tbody tr')).length === 2, `${vp.name}: results saved on device`);
    check(requests.length === 0, `${vp.name}: no network requests ${requests.join(' ')}`);
    check(errors.length === 0, `${vp.name}: still no errors ${errors.join(' | ')}`);
    await ctx.close();
  }
  // reduced motion default
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage(); await page.goto(url);
  check(await page.evaluate(() => window.__fe.S().anim) === false, 'prefers-reduced-motion turns animations off by default');
  await browser.close();
  console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();

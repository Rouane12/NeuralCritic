'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');

const BASE = process.env.NC_UI_BASE_URL || 'http://127.0.0.1:4173';
const OUTPUT = path.resolve(process.env.NC_UI_OUTPUT || 'tmp/public-ui-sweep');

const routes = [
  ['home', '/'],
  ['games', '/games/'],
  ['reviews', '/reviews/'],
  ['guides', '/guides/'],
  ['news', '/category.html?section=news'],
  ['features', '/category.html?section=features'],
  ['what-to-play', '/category.html?section=what-to-play'],
  ['search', '/search.html'],
  ['article', '/stories/intergalactic-heretic-prophet-wraps-cinematic-shoot/'],
  ['game-elden-ring', '/games/elden-ring/'],
  ['game-baldurs-gate-3', '/games/baldurs-gate-3/'],
  ['topic-elden-ring', '/topics/game/elden-ring/'],
  ['about', '/about.html'],
  ['standards', '/standards.html'],
  ['privacy', '/privacy.html'],
  ['deals', '/deals.html'],
  ['not-found', '/404.html'],
];

const viewports = [
  ['desktop', { width: 1440, height: 1000 }],
  ['mid-desktop', { width: 1136, height: 900 }],
  ['tablet', { width: 768, height: 1024 }],
  ['mobile', { width: 390, height: 844 }],
];

const themes = ['dark', 'light'];
const badImpacts = new Set(['serious', 'critical']);
const ignoredConsole = [
  /favicon\.ico/i,
  /Failed to load resource.*fonts\.gstatic/i,
  /Failed to load resource.*fonts\.googleapis/i,
];

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function overlaps(a, b) {
  return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
}

async function inspectPage(page, routeName, routePath, viewportName, theme) {
  const issues = [];
  const pageErrors = [];
  const consoleErrors = [];
  const badResponses = [];
  const baseOrigin = new URL(BASE).origin;

  page.on('pageerror', error => pageErrors.push(String(error && error.message || error)));
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (!ignoredConsole.some(pattern => pattern.test(text))) consoleErrors.push(text);
  });
  page.on('response', response => {
    try {
      const url = new URL(response.url());
      if (url.origin === baseOrigin && response.status() >= 400 && !url.pathname.endsWith('/favicon.ico')) {
        badResponses.push(`${response.status()} ${url.pathname}${url.search}`);
      }
    } catch (_) {}
  });

  await page.addInitScript(selectedTheme => {
    try { localStorage.setItem('neural-critic-theme', selectedTheme); } catch (_) {}
  }, theme);

  await page.goto(new URL(routePath, BASE).href, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await wait(1400);

  const state = await page.evaluate(() => {
    const root = document.documentElement;
    const visible = el => {
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && r.width > 0 && r.height > 0;
    };
    const navRects = [...document.querySelectorAll('header nav a')]
      .filter(visible)
      .map(el => {
        const r = el.getBoundingClientRect();
        return { text: (el.textContent || '').trim(), left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      });
    return {
      theme: root.dataset.theme || '',
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      navRects,
      title: document.title,
      bodyText: (document.body && document.body.innerText || '').slice(0, 500),
    };
  });

  if (state.theme !== theme) issues.push(`theme mismatch: expected ${theme}, rendered ${state.theme || '(none)'}`);
  if (state.scrollWidth > state.clientWidth + 2) {
    issues.push(`horizontal overflow: scrollWidth=${state.scrollWidth}, clientWidth=${state.clientWidth}`);
  }

  for (let i = 0; i < state.navRects.length; i++) {
    for (let j = i + 1; j < state.navRects.length; j++) {
      if (overlaps(state.navRects[i], state.navRects[j])) {
        issues.push(`nav collision: "${state.navRects[i].text}" overlaps "${state.navRects[j].text}"`);
      }
    }
  }

  if (pageErrors.length) issues.push(...pageErrors.map(x => `page error: ${x}`));
  if (badResponses.length) issues.push(...[...new Set(badResponses)].map(x => `same-origin HTTP error: ${x}`));
  if (consoleErrors.length) issues.push(...[...new Set(consoleErrors)].slice(0, 6).map(x => `console error: ${x}`));

  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  for (const violation of axe.violations.filter(v => badImpacts.has(v.impact))) {
    const targets = violation.nodes.slice(0, 4).flatMap(node => node.target).join(' | ');
    issues.push(`axe ${violation.impact}: ${violation.id} (${violation.nodes.length}) ${targets}`);
  }

  if (issues.length) {
    const file = path.join(OUTPUT, `${routeName}__${viewportName}__${theme}.png`);
    await page.screenshot({ path: file, fullPage: true });
  }

  return { routeName, routePath, viewportName, theme, title: state.title, issues };
}

(async () => {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const [viewportName, viewport] of viewports) {
      for (const theme of themes) {
        const context = await browser.newContext({ viewport });
        for (const [routeName, routePath] of routes) {
          const page = await context.newPage();
          try {
            results.push(await inspectPage(page, routeName, routePath, viewportName, theme));
          } catch (error) {
            results.push({ routeName, routePath, viewportName, theme, title: '', issues: [`test harness error: ${error.message || error}`] });
          } finally {
            await page.close();
          }
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const failures = results.filter(result => result.issues.length);
  fs.writeFileSync(path.join(OUTPUT, 'results.json'), JSON.stringify(results, null, 2));

  console.log(`Public UI browser sweep: ${results.length} route/theme/viewport combinations; ${failures.length} with issues.`);
  for (const result of failures) {
    console.log(`\n[${result.viewportName} / ${result.theme}] ${result.routePath}`);
    for (const issue of result.issues) console.log(` - ${issue}`);
  }

  if (failures.length) process.exit(1);
  console.log('Public UI browser sweep passed: no serious/critical axe violations, same-origin HTTP failures, page errors, horizontal overflow, or visible desktop-nav collisions detected.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});

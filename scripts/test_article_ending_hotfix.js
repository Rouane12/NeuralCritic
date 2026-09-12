#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const css = read('assets/article-ending-hotfix.css');
const footerRuntime = read('assets/article-footer-v2.js');

const checks = [];
const check = (name, ok) => checks.push([name, Boolean(ok)]);

check('footer runtime loads the post-launch hotfix stylesheet',
  footerRuntime.includes("const HOTFIX_STYLE_HREF = 'assets/article-ending-hotfix.css?v=20260912-postlaunch1'") &&
  footerRuntime.includes("hotfix.dataset.ncArticleEndingHotfix = '1'"));

check('Continue Exploring card pseudo overlays are disabled',
  css.includes('.nc-recirc-card::before') &&
  css.includes('.nc-recirc-card::after') &&
  css.includes('.nc-recirc-media::before') &&
  css.includes('content:none!important'));

check('Continue Exploring keeps only the intended bottom media gradient',
  css.includes('.nc-recirc-media::after') &&
  css.includes('height:48%!important') &&
  css.includes('background:linear-gradient(transparent,rgba(5,9,18,.42))!important') &&
  css.includes('border-radius:0!important'));

check('recirculation images are protected from clipping or masks',
  css.includes('clip-path:none!important') &&
  css.includes('-webkit-mask:none!important') &&
  css.includes('box-shadow:none!important'));

check('Weekly Drop light headings have explicit high-contrast fill',
  css.includes('.nc-weekly-drop-copy h2') &&
  css.includes('.nc-weekly-drop-signup h3') &&
  css.includes('color:#17212f!important') &&
  css.includes('-webkit-text-fill-color:#17212f!important'));

check('Weekly Drop light supporting copy is explicitly readable',
  css.includes('color:#5f6f82!important') &&
  css.includes('color:#667688!important') &&
  css.includes('opacity:1!important'));

check('legacy article bottom padding is removed when the publication footer is active',
  css.includes('body:has(#shared-footer .nc-publication-footer) #article.work-article-page') &&
  css.includes('padding-bottom:0!important'));

check('Weekly Drop owns a compact final gap before the footer',
  css.includes('margin-bottom:46px!important') &&
  css.includes('margin-bottom:38px!important') &&
  css.includes('margin-bottom:30px!important'));

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed++;
}
if (failed) {
  console.error(`Article ending hotfix failed: ${failed}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`Article ending hotfix passed: ${checks.length}/${checks.length} checks.`);

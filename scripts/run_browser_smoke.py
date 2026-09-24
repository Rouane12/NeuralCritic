#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import quote

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

ROOT = Path(__file__).resolve().parents[1]
PORT = 8765
BASE = f"http://127.0.0.1:{PORT}"
ARTIFACTS = ROOT / "artifacts" / "browser-smoke"
ARTIFACTS.mkdir(parents=True, exist_ok=True)

TARGETS = [
    {"kind":"home","path":"/","viewport":{"width":1440,"height":1100}},
    {"kind":"article","path":"/stories/physint-bill-skarsgard-lead-xbox-tgs-2026/","viewport":{"width":1440,"height":1100}},
    {"kind":"article","path":"/stories/gen-atlas-fumito-ueda-most-ambitious-world-yet/","viewport":{"width":1440,"height":1100}},
    {"kind":"category","path":"/category.html?category=latest","viewport":{"width":1440,"height":1100}},
    {"kind":"search","path":"/search.html","viewport":{"width":1440,"height":1100}},
    {"kind":"game","path":"/games/elden-ring/","viewport":{"width":1440,"height":1100}},
    {"kind":"article-mobile","path":"/stories/physint-bill-skarsgard-lead-xbox-tgs-2026/","viewport":{"width":390,"height":844}},
    {"kind":"article-mobile","path":"/stories/gen-atlas-fumito-ueda-most-ambitious-world-yet/","viewport":{"width":390,"height":844}},
    {"kind":"home","path":"/","viewport":{"width":320,"height":740},"theme":"light","touch":True,"hold_images":True},
    {"kind":"home","path":"/","viewport":{"width":390,"height":844},"touch":True},
    {"kind":"home","path":"/","viewport":{"width":768,"height":1024},"theme":"light","touch":True},
    {"kind":"article-mobile","path":"/stories/breath-of-the-wild-beginners-guide/","viewport":{"width":320,"height":740},"theme":"light","touch":True},
    {"kind":"game","path":"/games/the-legend-of-zelda-breath-of-the-wild/","viewport":{"width":390,"height":844},"touch":True},
]

EVALUATE = r"""
({kind}) => {
  const visible = el => {
    if (!el) return false;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  };
  const rect = el => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x:Math.round(r.x), y:Math.round(r.y), width:Math.round(r.width),
      height:Math.round(r.height), right:Math.round(r.right), bottom:Math.round(r.bottom)
    };
  };
  const checks = [];
  const check = (name, ok, value=null) => checks.push({name, ok:Boolean(ok), value});
  const diagnostics = {};
  diagnostics.header = [...document.querySelectorAll('header .menu,header .brand,header .header-tools > *')]
    .filter(visible).map(el=>({label:el.getAttribute('aria-label')||el.textContent.trim(),rect:rect(el)}));
  diagnostics.media = [...document.images].map(img=>({src:img.getAttribute('src'),loading:img.loading,priority:img.fetchPriority,rect:rect(img)}));
  const heroImage=document.querySelector('#hero .lead img,#article > .article-hero,#article .work-hero-figure > img');
  if(heroImage)check('lead image is eager and has high fetch priority',heroImage.loading==='eager'&&heroImage.fetchPriority==='high');

  check('document rendered', !!document.body, !!document.body);
  check(
    'no page-wide horizontal overflow',
    document.documentElement.scrollWidth <= innerWidth + 12,
    {scrollWidth:document.documentElement.scrollWidth, innerWidth}
  );

  if (kind === 'home') {
    const hero=document.querySelector('#hero');
    const supporting=[...document.querySelectorAll('#hero .features img')];
    check('supporting hero images retain deferred loading after enhancement',supporting.length>0&&supporting.every(img=>img.loading==='lazy'&&img.fetchPriority!=='high'),supporting.map(img=>({loading:img.loading,priority:img.fetchPriority})));
    const stories=[...document.querySelectorAll('a[href*="/stories/"],a[href^="stories/"]')];
    check('homepage hero visible',visible(hero),rect(hero));
    check('homepage exposes story navigation',stories.length>=3,stories.length);
  }

  if (kind === 'category') {
    const title=document.querySelector('#category-title');
    const feed=document.querySelector('#category-feed');
    check('category title resolved',visible(title)&&!/loading/i.test(title.textContent||''),title?.textContent?.trim());
    check('category feed visible',visible(feed),rect(feed));
  }

  if (kind === 'search') {
    const form=document.querySelector('#work-search-form');
    const input=document.querySelector('#work-search-input');
    check('search form visible',visible(form),rect(form));
    check('search input visible',visible(input),rect(input));
  }

  if (kind === 'game') {
    const page=document.querySelector('#game-page');
    const title=document.querySelector('#game-title');
    check('game page visible',visible(page),rect(page));
    check('game title resolved',visible(title)&&!/loading|unavailable|not found/i.test(title.textContent||''),title?.textContent?.trim());
  }

  if (kind === 'article' || kind === 'article-mobile') {
    const mobile = kind === 'article-mobile';
    const article=document.querySelector('#article.work-article-page');
    const grid=article?.querySelector(':scope > .work-reading-grid');
    const body=grid?.querySelector(':scope > .article-body');
    const rail=grid?.querySelector(':scope > .work-react-rail.standard-react-rail');
    const sidebar=grid?.querySelector(':scope > .work-article-sidebar');
    const recirc=article?.querySelector(':scope > .nc-recirculation');
    const newsletter=article?.querySelector(':scope > .work-newsletter-band');
    const legacyThread=article?.querySelector('#reader-thread,.article-thread,.work-bottom-grid');
    const legacyRelated=article?.querySelector('.work-related-card.nc-related-intelligent');
    const gridRect=rect(grid),bodyRect=rect(body),railRect=rect(rail),sideRect=rect(sidebar),recircRect=rect(recirc),newsletterRect=rect(newsletter);

    diagnostics.article = {
      gridInlineStyle:grid?.getAttribute('style')||'',
      gridComputed:grid ? {
        display:getComputedStyle(grid).display,
        width:getComputedStyle(grid).width,
        height:getComputedStyle(grid).height,
        minHeight:getComputedStyle(grid).minHeight,
        gridTemplateColumns:getComputedStyle(grid).gridTemplateColumns,
        gridTemplateRows:getComputedStyle(grid).gridTemplateRows,
        gridAutoRows:getComputedStyle(grid).gridAutoRows,
        alignItems:getComputedStyle(grid).alignItems,
        alignContent:getComputedStyle(grid).alignContent
      } : null,
      directChildren:grid ? [...grid.children].map(el=>({
        tag:el.tagName,
        className:el.className,
        style:el.getAttribute('style')||'',
        rect:rect(el),
        display:getComputedStyle(el).display,
        position:getComputedStyle(el).position,
        gridColumn:getComputedStyle(el).gridColumn,
        gridRow:getComputedStyle(el).gridRow,
        height:getComputedStyle(el).height,
        minHeight:getComputedStyle(el).minHeight,
        marginTop:getComputedStyle(el).marginTop,
        marginBottom:getComputedStyle(el).marginBottom
      })) : [],
      recirculation:{
        initStarted:Boolean(window.NeuralCriticRecirculationInitStarted),
        discovery:Boolean(window.NeuralCriticDiscovery),
        discoveryReady:Boolean(window.NeuralCriticDiscoveryReady),
        slug:window.NEURAL_CRITIC_STATIC_SLUG||new URLSearchParams(location.search).get('slug')||'',
        moduleCount:document.querySelectorAll('.nc-recirculation').length
      }
    };

    check('article shell upgraded',visible(article),rect(article));
    check('reading layout visible',visible(grid),gridRect);
    check('retired Reader Thread absent',!legacyThread,legacyThread?.className||null);
    check('retired generic Related Coverage absent',!legacyRelated,legacyRelated?.className||null);
    check('reaction rail normalized',visible(rail),railRect);
    check('reading action icons work without remote fonts',!!rail?.querySelector('[data-article-like] svg')&&!!rail?.querySelector('[data-article-share] svg')&&!rail?.querySelector('.material-symbols-rounded'));
    check('Continue Exploring visible',visible(recirc),recircRect);
    check('Weekly Drop visible',visible(newsletter),newsletterRect);

    if (!mobile) {
      check('reading layout is desktop grid',getComputedStyle(grid).display==='grid',getComputedStyle(grid).display);
      check('editorial body width is sane',visible(body)&&bodyRect.width>=560&&bodyRect.width<=850,bodyRect);
      check('reaction rail width is sane',visible(rail)&&railRect.width>=80&&railRect.width<=150,railRect);
      check('sidebar width is sane',visible(sidebar)&&sideRect.width>=220&&sideRect.width<=360,sideRect);
      check('rail starts beside article body',railRect&&gridRect&&Math.abs(railRect.y-gridRect.y)<180,{rail:railRect,grid:gridRect});
      check('sidebar starts beside article body',sideRect&&gridRect&&Math.abs(sideRect.y-gridRect.y)<180,{sidebar:sideRect,grid:gridRect});
      check(
        'reading grid has no runaway vertical whitespace',
        gridRect&&bodyRect&&gridRect.height <= bodyRect.height + Math.max(1100,bodyRect.height*.22),
        {grid:gridRect,body:bodyRect}
      );
      check('Continue Exploring has full editorial width',visible(recirc)&&recircRect.width>=700,recircRect);
      check('Weekly Drop has full editorial width',visible(newsletter)&&newsletterRect.width>=700,newsletterRect);
    } else {
      check('mobile reading layout is single column',getComputedStyle(grid).display==='block',getComputedStyle(grid).display);
      const minimumWidth = innerWidth - 60;
      check('mobile body fills reading width',visible(body)&&bodyRect.width>=minimumWidth&&bodyRect.width<=innerWidth,bodyRect);
      check('mobile reaction rail is horizontal',visible(rail)&&railRect.width>=minimumWidth,railRect);
      check('mobile sidebar fills reading width',visible(sidebar)&&sideRect.width>=minimumWidth,sideRect);
      check('mobile Continue Exploring fills reading width',visible(recirc)&&recircRect.width>=minimumWidth,recircRect);
      check('mobile Weekly Drop fills reading width',visible(newsletter)&&newsletterRect.width>=minimumWidth,newsletterRect);
      const map=article.querySelector('.work-mobile-reading-map');
      diagnostics.readingMap = {map:rect(map),body:bodyRect};
      check('compact section map precedes article text',visible(map)&&!map.open&&rect(map).bottom<=bodyRect.y,diagnostics.readingMap);
    }

    if (gridRect && recircRect) {
      check('Continue Exploring follows reading layout',recircRect.y>=gridRect.bottom-30,{grid:gridRect,recirculation:recircRect});
    }
    if (recircRect && newsletterRect) {
      check('Weekly Drop follows Continue Exploring',newsletterRect.y>=recircRect.bottom-30,{recirculation:recircRect,newsletter:newsletterRect});
    }

    const badMedia=[...(body?.querySelectorAll('img,video,iframe,.article-video-shell')||[])]
      .filter(el=>el.getBoundingClientRect().right>innerWidth+12||el.getBoundingClientRect().left<-12);
    check('article media remains inside viewport',badMedia.length===0,badMedia.map(el=>({tag:el.tagName,className:el.className,rect:rect(el)})));

    const narrowCards=[...(sidebar?.querySelectorAll('.work-side-card')||[])]
      .filter(el=>el.getBoundingClientRect().width<180);
    check('sidebar cards never collapse into strips',mobile||narrowCards.length===0,narrowCards.map(rect));
  }

  return {
    pass:checks.every(item=>item.ok),
    checks,
    failures:checks.filter(item=>!item.ok),
    viewport:{width:innerWidth,height:innerHeight},
    scrollWidth:document.documentElement.scrollWidth,
    diagnostics,
    url:location.href
  };
}
"""

def chrome_binary() -> str | None:
    for name in ("google-chrome-stable", "google-chrome", "chromium", "chromium-browser"):
        path = shutil.which(name)
        if path:
            return path
    return None

def safe_name(kind: str, path: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", path.lower()).strip("-") or "home"
    return f"{kind}-{slug}"[:110]

def run_case(browser, case: dict) -> dict:
    context = browser.new_context(viewport=case["viewport"], device_scale_factor=1, has_touch=case.get("touch", False))
    # Only the tested first-party document owns theme storage. Sandboxed video
    # frames have opaque origins and deliberately cannot access localStorage.
    context.add_init_script("if (location.origin === " + json.dumps(BASE) + ") localStorage.setItem('neural-critic-theme', " + json.dumps(case.get("theme", "dark")) + ");")
    page = context.new_page()
    page.set_default_timeout(12_000)
    pending_images = []
    holding_images = case.get('hold_images',False)

    def route_local_only(route):
        url = route.request.url
        if url.startswith(BASE) or url.startswith("data:") or url.startswith("blob:"):
            if holding_images and route.request.resource_type == 'image':
                pending_images.append(route)
                return
            route.continue_()
        else:
            route.abort()

    page.route("**/*", route_local_only)
    console_errors: list[str] = []
    page_errors: list[dict] = []
    request_failures: list[str] = []

    def record_page_error(exc):
        page_errors.append({
            "message": str(exc),
            "name": getattr(exc, "name", None),
            "stack": getattr(exc, "stack", None),
        })

    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", record_page_error)
    page.on("requestfailed", lambda req: request_failures.append(f"{req.url} :: {req.failure or 'failed'}"))
    url = BASE + case["path"]

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=15_000)
        early_nav = None
        if holding_images:
            page.wait_for_selector('nav[data-publication-ready="1"]',state='attached',timeout=5_000)
            page.wait_for_function("[...document.images].some(img => !img.complete)")
            early_nav = page.evaluate("document.readyState !== 'complete'")
            holding_images = False
            for pending in pending_images:
                pending.continue_()
        kind=case["kind"]
        if kind.startswith("article"):
            page.wait_for_selector("#article.work-article-page .work-reading-grid", state="visible", timeout=12_000)
            try:
                page.wait_for_selector("#article.work-article-page > .nc-recirculation", state="visible", timeout=7_000)
            except PlaywrightTimeoutError:
                pass
            page.wait_for_timeout(750)
        elif kind == "home":
            page.wait_for_selector("#hero", state="visible", timeout=12_000)
            page.wait_for_timeout(2_000)
        else:
            page.wait_for_timeout(2_000)

        consent = page.get_by_role('button', name=re.compile('essential only', re.I))
        if consent.is_visible():
            consent.click()
        result = page.evaluate(EVALUATE, {"kind":kind})
        if early_nav is not None:
            result['checks'].append({'name':'navigation initializes while images are still loading','ok':early_nav})
        name = safe_name(kind, case["path"]) + f"-{case['viewport']['width']}-{case.get('theme','dark')}"
        page.screenshot(path=str(ARTIFACTS / f"{name}.jpg"), type="jpeg", quality=75)
        if case.get("touch"):
            menu = page.get_by_role('button', name='Open navigation', exact=True)
            menu.tap()
            page.wait_for_function("document.body.classList.contains('mobile-nav-open')")
            page.get_by_role('button', name='Open News menu', exact=True).tap()
            page.get_by_role('link', name='Latest News', exact=False).wait_for(state='visible')
            page.wait_for_function("""() => {
                const menu=document.querySelector('[data-nav-section="news"] .nav-menu');
                return menu && getComputedStyle(menu).opacity === '1' && menu.getBoundingClientRect().height > 300;
            }""")
            page.screenshot(path=str(ARTIFACTS / f"{name}-navigation.jpg"), type="jpeg", quality=75)
            page.keyboard.press('Escape')
            page.wait_for_function("!document.body.classList.contains('mobile-nav-open')")
            focused = page.evaluate("document.activeElement.matches('header .menu')")
            result['checks'].append({'name':'mobile menu opens, submenu responds, Escape restores focus','ok':focused})
        if kind == 'article-mobile':
            disclosure = page.locator('.work-mobile-reading-map')
            disclosure.locator('summary').scroll_into_view_if_needed()
            page.screenshot(path=str(ARTIFACTS / f"{name}-compact.jpg"), type="jpeg", quality=75)
            disclosure.locator('summary').click()
            page.wait_for_function("document.querySelector('.work-mobile-reading-map').open")
            page.screenshot(path=str(ARTIFACTS / f"{name}-map.jpg"), type="jpeg", quality=75)
            links = disclosure.locator('nav a')
            target = links.nth(1).get_attribute('href')
            links.nth(1).focus()
            page.keyboard.press('Enter')
            page.wait_for_function('target => location.hash === target', arg=target)
            page.wait_for_function("""target => {
                const section=document.getElementById(decodeURIComponent(target.slice(1)));
                const rect=section.getBoundingClientRect();
                return rect.top >= 0 && rect.top < innerHeight / 2 && getComputedStyle(section).opacity === '1';
            }""", arg=target)
            page.screenshot(path=str(ARTIFACTS / f"{name}-reading.jpg"), type="jpeg", quality=75)
            result['checks'].append({'name':'mobile section map opens and keyboard navigation reaches visible content','ok':True,'value':target})
            page.set_viewport_size({'width':1280,'height':900})
            page.wait_for_selector('.work-article-sidebar .work-toc', state='attached')
            map_count = page.locator('.work-toc').count()
            result['checks'].append({'name':'resize restores the same single map to the desktop sidebar','ok':map_count == 1,'value':map_count})
        result['checks'].append({'name':'no uncaught page exceptions','ok':not page_errors,'value':page_errors})
        result['pass'] = all(check['ok'] for check in result['checks'])
        result['failures'] = [check for check in result['checks'] if not check['ok']]
        result.update({
            "kind":kind,
            "path":case["path"],
            "console_errors":console_errors[-20:],
            "page_errors":page_errors[-20:],
            "request_failures":request_failures[-30:],
        })
    except PlaywrightTimeoutError as exc:
        try:
            debug = page.evaluate("""() => {
              const article=document.querySelector('#article');
              return {
                location:location.href,
                readyState:document.readyState,
                title:document.title,
                staticSlug:window.NEURAL_CRITIC_STATIC_SLUG||null,
                articleClass:article?.className||'',
                articleHtmlLength:article?.innerHTML?.length||0,
                articleText:(article?.innerText||'').slice(0,1200),
                hasArticleBody:!!article?.querySelector('.article-body'),
                hasReadingGrid:!!article?.querySelector('.work-reading-grid'),
                loadingState:article?.querySelector('.article-loading-state')?.textContent?.trim()||null,
                notice:article?.querySelector('.notice')?.textContent?.trim()||null,
                contentApiReady:!!window.NeuralCriticContentAPI,
                discoveryReady:!!window.NeuralCriticDiscovery,
                recirculationStarted:!!window.NeuralCriticRecirculationInitStarted,
                runtimeState:article?.dataset?.runtimeState||null,
                runtimeChecks:article?.dataset?.runtimeChecks||null,
                scripts:[...document.scripts].map(s=>s.src).filter(Boolean).slice(-40)
              };
            }""")
        except Exception as debug_exc:
            debug={"debug_error":str(debug_exc)}
        result={
            "pass":False,
            "kind":case["kind"],
            "path":case["path"],
            "error":f"Browser wait timed out: {exc}",
            "console_errors":console_errors[-20:],
            "page_errors":page_errors[-20:],
            "request_failures":request_failures[-30:],
            "debug":debug,
        }
    except Exception as exc:
        result={
            "pass":False,
            "kind":case["kind"],
            "path":case["path"],
            "error":f"Browser smoke exception: {exc}",
            "console_errors":console_errors[-20:],
            "page_errors":page_errors[-20:],
            "request_failures":request_failures[-30:],
        }

    return result

def run_child(case_index: int) -> int:
    chrome = chrome_binary()
    if not chrome:
        print(json.dumps({"pass": False, "error": "No Chrome/Chromium binary available."}))
        return 0

    case = TARGETS[case_index]
    p = sync_playwright().start()
    browser = p.chromium.launch(
        executable_path=chrome,
        headless=True,
        args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    )
    result = run_case(browser, case)
    print(json.dumps(result), flush=True)
    os._exit(0)


def main() -> int:
    if "--case" in sys.argv:
        try:
            index = int(sys.argv[sys.argv.index("--case") + 1])
        except (ValueError, IndexError):
            print(json.dumps({"pass": False, "error": "Invalid --case index"}))
            return 0
        if index < 0 or index >= len(TARGETS):
            print(json.dumps({"pass": False, "error": f"Case index out of range: {index}"}))
            return 0
        return run_child(index)

    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    results = []
    try:
        time.sleep(1.0)
        for index, case in enumerate(TARGETS):
            try:
                completed = subprocess.run(
                    [sys.executable, str(Path(__file__).resolve()), "--case", str(index)],
                    cwd=ROOT,
                    text=True,
                    capture_output=True,
                    timeout=30,
                )
                payload = (completed.stdout or "").strip().splitlines()
                if not payload:
                    result = {
                        "pass": False,
                        "kind": case["kind"],
                        "path": case["path"],
                        "error": "Browser child returned no diagnostic payload.",
                        "stderr": (completed.stderr or "")[-3000:],
                    }
                else:
                    try:
                        result = json.loads(payload[-1])
                    except json.JSONDecodeError as exc:
                        result = {
                            "pass": False,
                            "kind": case["kind"],
                            "path": case["path"],
                            "error": f"Invalid browser child JSON: {exc}",
                            "stdout": (completed.stdout or "")[-3000:],
                            "stderr": (completed.stderr or "")[-3000:],
                        }
            except subprocess.TimeoutExpired as exc:
                result = {
                    "pass": False,
                    "kind": case["kind"],
                    "path": case["path"],
                    "error": "Hard per-route browser timeout after 30 seconds.",
                    "stdout": (exc.stdout or "")[-2000:] if isinstance(exc.stdout, str) else "",
                    "stderr": (exc.stderr or "")[-2000:] if isinstance(exc.stderr, str) else "",
                }

            results.append(result)
    finally:
        server.terminate()
        try:
            server.wait(timeout=3)
        except subprocess.TimeoutExpired:
            server.kill()

    report = ARTIFACTS / "report.json"
    report.write_text(json.dumps(results, indent=2), encoding="utf-8")

    failed = False
    for result in results:
        state = "PASS" if result.get("pass") else "FAIL"
        print(f"{state} {result.get('kind')} {result.get('path')}")
        for check in result.get("checks", []):
            print(f"  {'PASS' if check.get('ok') else 'FAIL'} {check.get('name')}: {check.get('value')}")
        if result.get("page_errors"):
            print(f"  PAGE ERRORS: {result['page_errors']}")
        if result.get("console_errors"):
            print(f"  CONSOLE ERRORS: {result['console_errors']}")
        if result.get("debug"):
            print(f"  DEBUG: {json.dumps(result['debug'], ensure_ascii=False)}")
        if result.get("request_failures"):
            print(f"  REQUEST FAILURES: {result['request_failures']}")
        if result.get("error"):
            print(f"  ERROR: {result['error']}")
        if not result.get("pass"):
            failed = True

    if failed:
        print(json.dumps(results, indent=2))
        return 1

    print(f"Rendered browser smoke suite passed: {len(results)}/{len(results)} route/viewport cases.")
    return 0


if __name__=="__main__":
    raise SystemExit(main())

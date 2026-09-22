#!/usr/bin/env python3
from __future__ import annotations

import json
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

  check('document rendered', !!document.body, !!document.body);
  check(
    'no page-wide horizontal overflow',
    document.documentElement.scrollWidth <= innerWidth + 12,
    {scrollWidth:document.documentElement.scrollWidth, innerWidth}
  );

  if (kind === 'home') {
    const hero=document.querySelector('#hero');
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

    check('article shell upgraded',visible(article),rect(article));
    check('reading layout visible',visible(grid),gridRect);
    check('retired Reader Thread absent',!legacyThread,legacyThread?.className||null);
    check('retired generic Related Coverage absent',!legacyRelated,legacyRelated?.className||null);
    check('reaction rail normalized',visible(rail),railRect);
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
      check('mobile body fills reading width',visible(body)&&bodyRect.width>=330&&bodyRect.width<=390,bodyRect);
      check('mobile reaction rail is horizontal',visible(rail)&&railRect.width>=330,railRect);
      check('mobile sidebar fills reading width',visible(sidebar)&&sideRect.width>=330,sideRect);
      check('mobile Continue Exploring fills reading width',visible(recirc)&&recircRect.width>=330,recircRect);
      check('mobile Weekly Drop fills reading width',visible(newsletter)&&newsletterRect.width>=330,newsletterRect);
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
    context = browser.new_context(viewport=case["viewport"], device_scale_factor=1)
    page = context.new_page()
    console_errors: list[str] = []
    page_errors: list[str] = []
    request_failures: list[str] = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: page_errors.append(str(exc)))
    page.on("requestfailed", lambda req: request_failures.append(f"{req.url} :: {req.failure or 'failed'}"))
    url = BASE + case["path"]

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=20_000)
        kind=case["kind"]
        if kind.startswith("article"):
            page.wait_for_selector("#article.work-article-page .work-reading-grid", state="visible", timeout=20_000)
            page.wait_for_timeout(8_000)
        elif kind == "home":
            page.wait_for_selector("#hero", state="visible", timeout=15_000)
            page.wait_for_timeout(4_000)
        else:
            page.wait_for_timeout(5_000)

        result = page.evaluate(EVALUATE, {"kind":kind})
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

    if not result.get("pass"):
        shot=ARTIFACTS / f"{safe_name(case['kind'],case['path'])}.png"
        try:
            page.screenshot(path=str(shot), full_page=True)
            result["screenshot"]=str(shot.relative_to(ROOT))
        except Exception:
            pass
    context.close()
    return result

def main() -> int:
    chrome=chrome_binary()
    if not chrome:
        print("No Chrome/Chromium binary available.", file=sys.stderr)
        return 2

    server=subprocess.Popen(
        [sys.executable,"-m","http.server",str(PORT),"--bind","127.0.0.1"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    results=[]
    try:
        time.sleep(1.0)
        with sync_playwright() as p:
            browser=p.chromium.launch(
                executable_path=chrome,
                headless=True,
                args=["--no-sandbox","--disable-dev-shm-usage","--disable-gpu"],
            )
            try:
                for case in TARGETS:
                    result = run_case(browser, case)
                    results.append(result)
                    if not result.get("pass"):
                        break
            finally:
                browser.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=3)
        except subprocess.TimeoutExpired:
            server.kill()

    report=ARTIFACTS/"report.json"
    report.write_text(json.dumps(results,indent=2),encoding="utf-8")

    failed=False
    for result in results:
        state="PASS" if result.get("pass") else "FAIL"
        print(f"{state} {result.get('kind')} {result.get('path')}")
        for check in result.get("checks",[]):
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
            failed=True

    if failed:
        print(json.dumps(results,indent=2))
        return 1
    print(f"Rendered browser smoke suite passed: {len(results)}/{len(results)} route/viewport cases.")
    return 0

if __name__=="__main__":
    raise SystemExit(main())

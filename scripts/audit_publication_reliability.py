#!/usr/bin/env python3
"""Publication Reliability / QA V2 for Neural Critic."""
from __future__ import annotations
import json,re,urllib.parse,urllib.request,xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]; CONFIG=ROOT/'assets'/'supabase-config.js'; SITEMAP=ROOT/'sitemap.xml'; STORIES=ROOT/'stories'; GAMES=ROOT/'games'
ERRORS=[]; WARNINGS=[]
def fail(m): ERRORS.append(m)
def warn(m): WARNINGS.append(m)
def cfg():
    t=CONFIG.read_text(encoding='utf-8'); u=re.search(r"url:\s*['\"]([^'\"]+)['\"]",t); k=re.search(r"publishableKey:\s*['\"]([^'\"]+)['\"]",t)
    if not u or not k: raise RuntimeError('Supabase public configuration is unreadable')
    return u.group(1).rstrip('/'),k.group(1)
def rest(table,params):
    base,key=cfg(); q=urllib.parse.urlencode(params,safe='.*,:()+-'); req=urllib.request.Request(f'{base}/rest/v1/{table}?{q}',headers={'apikey':key,'Authorization':f'Bearer {key}','Accept':'application/json','User-Agent':'NeuralCritic-ReliabilityAudit/2.0'})
    with urllib.request.urlopen(req,timeout=20) as r: data=json.loads(r.read().decode())
    if not isinstance(data,list): raise RuntimeError(f'{table} did not return a list')
    return [x for x in data if isinstance(x,dict)]
def dt(v):
    s=str(v or '').strip()
    if not s:return None
    try:
        d=datetime.fromisoformat(s.replace('Z','+00:00')); return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d.astimezone(timezone.utc)
    except ValueError:return None
def sitemap_urls():
    if not SITEMAP.exists(): fail('sitemap.xml is missing'); return set()
    try:t=ET.parse(SITEMAP)
    except ET.ParseError as e: fail(f'sitemap.xml is malformed: {e}'); return set()
    ns='{http://www.sitemaps.org/schemas/sitemap/0.9}'; return {(n.text or '').strip() for n in t.findall(f'.//{ns}loc') if (n.text or '').strip()}
def validate_articles(rows,game_titles,game_slugs,urls):
    for s,c in Counter(str(r.get('slug') or '').strip() for r in rows).items():
        if s and c>1: fail(f'duplicate published article slug: {s}')
    now=datetime.now(timezone.utc)
    for r in rows:
        s=str(r.get('slug') or '').strip(); title=str(r.get('title') or '').strip(); desc=str(r.get('description') or '').strip(); img=str(r.get('image_url') or '').strip(); alt=str(r.get('image_alt') or '').strip(); sec=str(r.get('editorial_section') or '').lower(); game=str(r.get('game_key') or '').strip(); review=r.get('review_meta') if isinstance(r.get('review_meta'),dict) else {}; news=r.get('news_meta') if isinstance(r.get('news_meta'),dict) else {}; published=dt(r.get('published_at'))
        if not s or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]*',s): fail(f'invalid published article slug: {s or "<empty>"}'); continue
        if not title: fail(f'{s}: missing title')
        if len(desc)<40: warn(f'{s}: description is unusually short')
        if published is None: fail(f'{s}: published_at is missing or invalid')
        elif published>now: fail(f'{s}: published article is dated in the future')
        if img and not alt: fail(f'{s}: image has no alt text')
        if not img: warn(f'{s}: no feature image')
        canonical=f'https://www.neuralcritic.net/stories/{urllib.parse.quote(s,safe="-._~")}/'; shell=STORIES/s/'index.html'
        if not shell.exists(): fail(f'{s}: canonical story shell is missing')
        elif canonical not in shell.read_text(encoding='utf-8',errors='ignore'): fail(f'{s}: canonical story shell lacks canonical URL')
        if canonical not in urls: fail(f'{s}: canonical story URL missing from sitemap')
        is_review=sec=='reviews' or str(r.get('article_format') or '').lower()=='review' or bool(review.get('score'))
        if is_review:
            try: score=float(review.get('score'))
            except (TypeError,ValueError): fail(f'{s}: review has invalid score'); score=None
            if score is not None and not 0<=score<=10: fail(f'{s}: review score is outside 0–10')
            if not str(review.get('verdict') or '').strip(): fail(f'{s}: review is missing verdict')
            if not game: warn(f'{s}: scored review has no game_key')
        if sec=='news' and (not str(news.get('sourceName') or news.get('source_name') or '').strip() or not str(news.get('sourceUrl') or news.get('source_url') or '').strip()): warn(f'{s}: news story is missing source provenance')
        if game and game.casefold() not in game_titles and game.casefold() not in game_slugs: warn(f"{s}: game_key '{game}' has no Games Database record")
def validate_games(rows,review_scores,urls):
    for s,c in Counter(str(r.get('slug') or '').strip() for r in rows).items():
        if s and c>1: fail(f'duplicate game slug: {s}')
    for r in rows:
        s=str(r.get('slug') or '').strip(); title=str(r.get('title') or '').strip()
        if not s or not title: fail(f'game record missing slug/title: {s or "<empty>"}'); continue
        canonical=f'https://www.neuralcritic.net/games/{urllib.parse.quote(s,safe="-._~")}/'; shell=GAMES/s/'index.html'
        if not shell.exists(): fail(f'{s}: canonical game shell is missing')
        if canonical not in urls: fail(f'{s}: canonical game URL missing from sitemap')
        rs=str(r.get('score_article_slug') or '').strip(); db=r.get('neural_critic_score')
        if rs:
            if rs not in review_scores: fail(f"{s}: score_article_slug '{rs}' is not a published scored review")
            elif db is not None:
                try:
                    if abs(float(db)-review_scores[rs])>.01: fail(f'{s}: game score does not match linked review score')
                except (TypeError,ValueError): fail(f'{s}: neural_critic_score is invalid')
        elif db is not None: warn(f'{s}: has Neural Critic score but no score_article_slug')
def main():
    try:
        articles=rest('articles',{'select':'slug,title,description,status,published_at,article_format,editorial_section,image_url,image_alt,game_key,review_meta,news_meta','status':'eq.published','order':'published_at.desc','limit':'500'}); games=rest('games',{'select':'slug,title,neural_critic_score,score_article_slug','order':'title.asc','limit':'500'})
    except Exception as e: print(f'RELIABILITY AUDIT FAILED: live publication data unavailable: {e}'); return 1
    urls=sitemap_urls(); titles={str(g.get('title') or '').casefold() for g in games if g.get('title')}; slugs={str(g.get('slug') or '').casefold() for g in games if g.get('slug')}; scores={}
    for r in articles:
        m=r.get('review_meta') if isinstance(r.get('review_meta'),dict) else {}
        try:scores[str(r.get('slug') or '')]=float(m['score'])
        except (KeyError,TypeError,ValueError):pass
    validate_articles(articles,titles,slugs,urls); validate_games(games,scores,urls)
    print(f'Reliability audit inspected {len(articles)} published stories and {len(games)} game records.')
    for m in WARNINGS: print('WARNING:',m)
    for m in ERRORS: print('ERROR:',m)
    print(f'Reliability result: {len(ERRORS)} error(s), {len(WARNINGS)} warning(s).')
    return 1 if ERRORS else 0
if __name__=='__main__': raise SystemExit(main())

(() => {
  'use strict';

  const DAY = 86400000;
  const normalize = (value = '') => String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();
  const slugify = (value = '') => normalize(value).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const when = value => {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  };
  const unique = values => [...new Set(values.filter(Boolean))];
  const tagsOf = article => Array.isArray(article?.tags) ? article.tags : [];
  const platformsOf = article => Array.isArray(article?.platforms) ? article.platforms : [];
  const articleHref = article => `article.html?slug=${encodeURIComponent(article.slug)}`;

  function entityHref(type, name) {
    const slug = slugify(name);
    if (!slug) return '#';
    if (type === 'author') return `authors/${slug}/`;
    return `topics/${type}/${slug}/`;
  }

  function buildEntities(articles = []) {
    const map = new Map();
    const add = (type, name, article) => {
      const clean = String(name || '').trim();
      if (!clean) return;
      const key = `${type}:${normalize(clean)}`;
      let entity = map.get(key);
      if (!entity) {
        entity = {
          key,
          type,
          name: clean,
          slug: slugify(clean),
          href: entityHref(type, clean),
          count: 0,
          latestAt: null,
          image: '',
          stories: []
        };
        map.set(key, entity);
      }
      entity.count += 1;
      entity.stories.push(article);
      const articleTime = when(article.updatedAt || article.publishedAt);
      if (!entity.latestAt || articleTime > when(entity.latestAt)) {
        entity.latestAt = article.updatedAt || article.publishedAt || null;
        entity.image = article.imageLocal || entity.image;
      }
    };

    articles.forEach(article => {
      add('game', article.gameKey, article);
      add('series', article.series, article);
      add('franchise', article.franchise, article);
      add('author', article.author, article);
    });

    return [...map.values()].sort((a, b) => b.count - a.count || when(b.latestAt) - when(a.latestAt) || a.name.localeCompare(b.name));
  }

  function overlapCount(a = [], b = []) {
    const right = new Set(b.map(normalize));
    return unique(a.map(normalize)).filter(item => right.has(item)).length;
  }

  function relatedReason(current, candidate) {
    if (current.gameKey && normalize(current.gameKey) === normalize(candidate.gameKey)) return 'SAME GAME';
    if (current.series && normalize(current.series) === normalize(candidate.series)) return 'SAME SERIES';
    if (current.franchise && normalize(current.franchise) === normalize(candidate.franchise)) return 'SAME FRANCHISE';
    if (overlapCount(tagsOf(current), tagsOf(candidate))) return 'SHARED TOPIC';
    if (normalize(current.category) === normalize(candidate.category)) return 'SAME DESK';
    return 'MORE COVERAGE';
  }

  function relatedScore(current, candidate) {
    if (!current || !candidate || current.slug === candidate.slug) return -Infinity;
    let score = 0;
    if (current.gameKey && normalize(current.gameKey) === normalize(candidate.gameKey)) score += 120;
    if (current.series && normalize(current.series) === normalize(candidate.series)) score += 78;
    if (current.franchise && normalize(current.franchise) === normalize(candidate.franchise)) score += 58;
    score += overlapCount(tagsOf(current), tagsOf(candidate)) * 14;
    score += overlapCount(platformsOf(current), platformsOf(candidate)) * 3;
    if (normalize(current.category) === normalize(candidate.category)) score += 7;
    if (current.articleFormat && current.articleFormat === candidate.articleFormat) score += 4;
    const ageDays = Math.max(0, (Date.now() - when(candidate.updatedAt || candidate.publishedAt)) / DAY);
    score += Math.max(0, 12 - ageDays * 0.45);
    return score;
  }

  function related(current, articles = [], limit = 3) {
    return articles
      .filter(candidate => candidate?.slug && candidate.slug !== current?.slug)
      .map(article => ({ article, score: relatedScore(current, article), reason: relatedReason(current, article) }))
      .filter(item => Number.isFinite(item.score) && item.score > 0)
      .sort((a, b) => b.score - a.score || when(b.article.updatedAt || b.article.publishedAt) - when(a.article.updatedAt || a.article.publishedAt))
      .slice(0, limit);
  }

  function trendScore(article, articles = []) {
    if (!article) return -Infinity;
    const published = when(article.publishedAt);
    const updated = when(article.updatedAt || article.publishedAt);
    const ageHours = Math.max(0, (Date.now() - Math.max(published, updated)) / 3600000);
    let score = Math.max(0, 70 - ageHours * 0.85);

    const category = normalize(article.category);
    const kind = article.newsMeta?.kind;
    if (category === 'news') {
      score += 18;
      if (kind === 'breaking') score += 42;
      if (kind === 'update') score += 24;
      if (kind === 'report') score += 10;
      if (article.newsMeta?.developing) score += 18;
      if (Array.isArray(article.newsMeta?.updates)) score += Math.min(18, article.newsMeta.updates.length * 6);
    }
    if (article.homepageSlot === 'lead') score += 12;
    if (String(article.homepageSlot || '').startsWith('secondary')) score += 5;
    if (article.articleFormat === 'review' && Number(article.reviewMeta?.score) >= 9) score += 7;

    const sameGame = article.gameKey ? articles.filter(other => other.slug !== article.slug && normalize(other.gameKey) === normalize(article.gameKey)).length : 0;
    const sameFranchise = article.franchise ? articles.filter(other => other.slug !== article.slug && normalize(other.franchise) === normalize(article.franchise)).length : 0;
    score += Math.min(18, sameGame * 7 + sameFranchise * 3);
    return score;
  }

  function trending(articles = [], limit = 3) {
    const ranked = articles
      .filter(article => article?.slug)
      .map(article => ({ article, score: trendScore(article, articles) }))
      .sort((a, b) => b.score - a.score || when(b.article.updatedAt || b.article.publishedAt) - when(a.article.updatedAt || a.article.publishedAt));

    const picked = [];
    const topicUse = new Map();
    for (const item of ranked) {
      const topic = normalize(item.article.gameKey || item.article.franchise || item.article.series || item.article.category || item.article.slug);
      const used = topicUse.get(topic) || 0;
      if (used >= 1 && picked.length < Math.max(2, limit - 1)) continue;
      picked.push(item);
      topicUse.set(topic, used + 1);
      if (picked.length >= limit) break;
    }
    return picked;
  }

  function isFreshDevelopingNews(article) {
    if (normalize(article?.category) !== 'news' || !article.newsMeta?.developing) return false;
    const kind = article.newsMeta?.kind;
    return kind === 'breaking' || kind === 'update';
  }

  function homepageProgram(articles = []) {
    const sorted = [...articles].filter(article => article?.slug).sort((a, b) => when(b.publishedAt) - when(a.publishedAt));
    const urgent = sorted.filter(isFreshDevelopingNews).sort((a, b) => trendScore(b, articles) - trendScore(a, articles))[0];
    const manualLead = sorted.find(article => article.homepageSlot === 'lead');
    const lead = urgent || manualLead || sorted[0] || null;
    const chosen = new Set(lead ? [lead.slug] : []);
    const secondaries = [];
    const take = article => {
      if (!article || chosen.has(article.slug) || secondaries.length >= 2) return;
      chosen.add(article.slug);
      secondaries.push(article);
    };

    take(sorted.find(article => normalize(article.category) === 'news'));
    take(sorted.find(article => article.articleFormat === 'review' || normalize(article.category) === 'review'));
    sorted.filter(article => String(article.homepageSlot || '').startsWith('secondary')).forEach(take);
    sorted.forEach(take);

    return {
      lead,
      secondaries: secondaries.slice(0, 2),
      trending: trending(articles, 3),
      featuredSlugs: unique([lead?.slug, ...secondaries.map(article => article.slug)])
    };
  }

  function articleSearchText(article) {
    return [
      article.title,
      article.description,
      article.category,
      article.author,
      article.gameKey,
      article.series,
      article.franchise,
      ...tagsOf(article),
      ...platformsOf(article),
      article.body,
      ...(Array.isArray(article.contentBlocks) ? article.contentBlocks.flatMap(block => [block?.heading, block?.text]) : []),
      article.conclusion
    ].filter(Boolean).join(' ');
  }

  function tokenScore(haystack, query, weight) {
    const text = normalize(haystack);
    if (!text || !query) return 0;
    if (text === query) return weight * 2.4;
    if (text.startsWith(query)) return weight * 1.65;
    if (text.includes(query)) return weight;
    const tokens = query.split(/\s+/).filter(Boolean);
    if (tokens.length > 1 && tokens.every(token => text.includes(token))) return weight * 0.72;
    return 0;
  }

  function storySearchScore(article, query) {
    if (!query) return when(article.publishedAt) / 1e13;
    let score = 0;
    score += tokenScore(article.title, query, 120);
    score += tokenScore(article.gameKey, query, 85);
    score += tokenScore(article.franchise, query, 70);
    score += tokenScore(article.series, query, 62);
    score += tokenScore(article.author, query, 58);
    score += Math.max(0, ...tagsOf(article).map(tag => tokenScore(tag, query, 44)));
    score += Math.max(0, ...platformsOf(article).map(platform => tokenScore(platform, query, 38)));
    score += tokenScore(article.category, query, 30);
    score += tokenScore(article.description, query, 24);
    score += tokenScore(articleSearchText(article), query, 8);
    return score;
  }

  function entitySearchScore(entity, query) {
    if (!query) return entity.count * 10 + when(entity.latestAt) / 1e13;
    let score = tokenScore(entity.name, query, 130);
    if (normalize(entity.type) === query) score += 12;
    score += entity.count * 2;
    return score;
  }

  function storyMatchesFilter(article, filter) {
    const active = normalize(filter || 'all');
    if (!active || active === 'all') return true;
    const category = normalize(article.category);
    const format = normalize(article.articleFormat);
    const tags = tagsOf(article).map(normalize);
    const platforms = platformsOf(article).map(normalize);
    if (active === 'guide') return category === 'guide' || format === 'game-guide' || tags.includes('guide');
    if (active === 'review') return category === 'review' || format === 'review' || tags.includes('review');
    return category === active || tags.includes(active) || platforms.includes(active);
  }

  function entityMatchesFilter(entity, filter) {
    const active = normalize(filter || 'all');
    if (active === 'games') return entity.type === 'game';
    if (active === 'series') return entity.type === 'series';
    if (active === 'franchises') return entity.type === 'franchise';
    if (active === 'authors') return entity.type === 'author';
    return active === 'all';
  }

  function search(articles = [], rawQuery = '', filter = 'all') {
    const query = normalize(rawQuery);
    const entityOnly = ['games', 'series', 'franchises', 'authors'].includes(normalize(filter));
    const stories = entityOnly ? [] : articles
      .filter(article => storyMatchesFilter(article, filter))
      .map(article => ({ article, score: storySearchScore(article, query) }))
      .filter(item => !query || item.score > 0)
      .sort((a, b) => b.score - a.score || when(b.article.publishedAt) - when(a.article.publishedAt));

    const entities = buildEntities(articles)
      .filter(entity => entityMatchesFilter(entity, filter))
      .map(entity => ({ entity, score: entitySearchScore(entity, query) }))
      .filter(item => (!query && entityOnly) || (query && item.score > 0))
      .sort((a, b) => b.score - a.score || b.entity.count - a.entity.count || when(b.entity.latestAt) - when(a.entity.latestAt));

    return { query, stories, entities };
  }

  window.NeuralCriticDiscovery = {
    normalize,
    slugify,
    articleHref,
    entityHref,
    buildEntities,
    related,
    trending,
    trendScore,
    homepageProgram,
    search
  };

  if (document.getElementById('hero') && typeof window.renderHero === 'function') {
    queueMicrotask(() => {
      window.renderHero?.();
      window.renderTrending?.();
      window.renderFeed?.();
    });
  }
})();

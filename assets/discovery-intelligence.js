(() => {
  'use strict';

  const DAY = 86400000;
  const GENERIC_TAGS = new Set([
    'review','reviews','feature','features','news','guide','guides',
    'pc','playstation','xbox','nintendo','mobile','gaming','game','games',
    'rpg','action rpg','action-rpg','open world','open-world'
  ]);
  const normalize = (value = '') => String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();
  const slugify = (value = '') => normalize(value).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const when = value => {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  };
  const unique = values => [...new Set(values.filter(Boolean))];
  const tagsOf = article => Array.isArray(article?.tags) ? article.tags : [];
  const platformsOf = article => Array.isArray(article?.platforms) ? article.platforms : [];
  const articleHref = article => `stories/${encodeURIComponent(article.slug)}/`;

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

  function overlapValues(a = [], b = [], { meaningful = false } = {}) {
    const right = new Set(b.map(normalize).filter(Boolean));
    const seen = new Set();
    return a.map(value => ({ value: String(value || '').trim(), key: normalize(value) }))
      .filter(item => item.key && right.has(item.key))
      .filter(item => !meaningful || !GENERIC_TAGS.has(item.key))
      .filter(item => !seen.has(item.key) && seen.add(item.key));
  }

  function overlapCount(a = [], b = [], options) {
    return overlapValues(a, b, options).length;
  }

  function articleKind(article) {
    const category = normalize(article?.category);
    const format = normalize(article?.articleFormat);
    const tags = tagsOf(article).map(normalize);
    if (format === 'review' || category === 'review' || tags.includes('review')) return 'review';
    if (format.includes('guide') || category === 'guide' || tags.includes('guide')) return 'guide';
    if (format === 'ranked-list' || format === 'ranking' || tags.includes('ranking')) return 'ranking';
    if (category === 'news') return 'news';
    return 'feature';
  }

  function relatedRelation(current, candidate) {
    const currentGame = String(current?.gameKey || '').trim();
    if (currentGame && normalize(currentGame) === normalize(candidate?.gameKey)) {
      return { key:'same_game', type:'game', value:currentGame, label:'SAME GAME', weight:150 };
    }
    const currentSeries = String(current?.series || '').trim();
    if (currentSeries && normalize(currentSeries) === normalize(candidate?.series)) {
      return { key:'same_series', type:'series', value:currentSeries, label:'SAME SERIES', weight:98 };
    }
    const currentFranchise = String(current?.franchise || '').trim();
    if (currentFranchise && normalize(currentFranchise) === normalize(candidate?.franchise)) {
      return { key:'same_franchise', type:'franchise', value:currentFranchise, label:'SAME FRANCHISE', weight:72 };
    }
    const sharedTopics = overlapValues(tagsOf(current), tagsOf(candidate), { meaningful:true });
    if (sharedTopics.length) {
      return { key:'shared_topic', type:'', value:sharedTopics[0].value, label:'SHARED TOPIC', weight:28 };
    }
    if (current?.collection && normalize(current.collection) === normalize(candidate?.collection)) {
      return { key:'same_collection', type:'', value:String(current.collection), label:'SAME COLLECTION', weight:18 };
    }
    if (normalize(current?.category) && normalize(current.category) === normalize(candidate?.category)) {
      return { key:'same_desk', type:'', value:String(current.category || ''), label:'SAME DESK', weight:7 };
    }
    return { key:'related', type:'', value:'', label:'MORE COVERAGE', weight:0 };
  }

  function complementaryKindBonus(currentKind, candidateKind) {
    if (!currentKind || !candidateKind || currentKind === candidateKind) return 0;
    const usefulPairs = {
      review: new Set(['guide','feature','news','ranking']),
      guide: new Set(['review','feature','news','ranking']),
      news: new Set(['feature','guide','review','ranking']),
      feature: new Set(['review','guide','news','ranking']),
      ranking: new Set(['review','guide','feature','news'])
    };
    return usefulPairs[currentKind]?.has(candidateKind) ? 10 : 5;
  }

  function relatedScore(current, candidate) {
    if (!current || !candidate || (current.slug && current.slug === candidate.slug)) return -Infinity;
    const relation = relatedRelation(current, candidate);
    const meaningfulTopics = overlapValues(tagsOf(current), tagsOf(candidate), { meaningful:true });
    const platformOverlap = overlapCount(platformsOf(current), platformsOf(candidate));
    const currentKind = articleKind(current);
    const candidateKind = articleKind(candidate);

    let score = relation.weight;
    score += meaningfulTopics.length * 16;
    score += Math.min(8, platformOverlap * 2);
    if (normalize(current.category) && normalize(current.category) === normalize(candidate.category)) score += 5;
    if (current.collection && normalize(current.collection) === normalize(candidate.collection)) score += 9;
    score += complementaryKindBonus(currentKind, candidateKind);
    if (currentKind === candidateKind) score += 2;

    const ageDays = Math.max(0, (Date.now() - when(candidate.updatedAt || candidate.publishedAt)) / DAY);
    score += Math.max(0, 8 - ageDays * 0.22);
    return score;
  }

  function relatedItem(current, article) {
    const relation = relatedRelation(current, article);
    const meaningfulTopics = overlapValues(tagsOf(current), tagsOf(article), { meaningful:true });
    return {
      article,
      score: relatedScore(current, article),
      reason: relation.label,
      relation,
      kind: articleKind(article),
      signals: {
        meaningfulTopics: meaningfulTopics.map(item => item.value),
        platformOverlap: overlapCount(platformsOf(current), platformsOf(article))
      }
    };
  }

  function selectRelated(ranked, limit, currentKind) {
    const remaining = [...ranked];
    const selected = [];
    const kindUse = new Map();
    const relationUse = new Map();

    while (remaining.length && selected.length < limit) {
      let bestIndex = 0;
      let bestAdjusted = -Infinity;
      remaining.forEach((item, index) => {
        const usedKind = kindUse.get(item.kind) || 0;
        const usedRelation = relationUse.get(item.relation.key) || 0;
        let adjusted = item.score;
        if (item.kind && item.kind !== currentKind && usedKind === 0) adjusted += 8;
        if (usedKind > 0) adjusted -= Math.min(16, usedKind * 8);
        if (usedRelation > 0 && !['same_game','same_series','same_franchise'].includes(item.relation.key)) adjusted -= Math.min(10, usedRelation * 5);
        if (item.relation.key === 'related') adjusted -= 12;
        if (adjusted > bestAdjusted) {
          bestAdjusted = adjusted;
          bestIndex = index;
        }
      });
      const [picked] = remaining.splice(bestIndex, 1);
      selected.push(picked);
      kindUse.set(picked.kind, (kindUse.get(picked.kind) || 0) + 1);
      relationUse.set(picked.relation.key, (relationUse.get(picked.relation.key) || 0) + 1);
    }
    return selected;
  }

  function related(current, articles = [], limit = 3) {
    const safeLimit = Math.max(0, Number(limit) || 0);
    if (!current || !safeLimit) return [];
    const ranked = articles
      .filter(candidate => candidate?.slug && candidate.slug !== current?.slug)
      .map(article => relatedItem(current, article))
      .filter(item => Number.isFinite(item.score) && item.score > 0)
      .sort((a, b) => b.score - a.score || when(b.article.updatedAt || b.article.publishedAt) - when(a.article.updatedAt || a.article.publishedAt));
    return selectRelated(ranked, safeLimit, articleKind(current));
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
    relatedScore,
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

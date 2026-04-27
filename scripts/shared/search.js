import { t } from "./i18n.js";
import { clamp, createFaviconUrl, getDomain, limitedEditDistance, normalizeText, parseQuery, tokenize, tokenizeForFuzzy } from "./utils.js";

function scoreTokenMatches(tokens, haystackTokens) {
  if (!tokens.length) {
    return { score: 0, matched: [] };
  }

  let score = 0;
  const matched = [];
  for (const token of tokens) {
    const hit = haystackTokens.find((candidate) => candidate.includes(token));
    if (!hit) {
      continue;
    }
    matched.push(token);
    if (hit === token) {
      score += 22;
    } else if (hit.startsWith(token)) {
      score += 16;
    } else {
      score += 9;
    }
  }

  return { score, matched };
}

function getFuzzyThreshold(token) {
  if (!/^[a-z0-9-]+$/i.test(token)) {
    return 0;
  }
  if (token.length >= 8) {
    return 2;
  }
  if (token.length >= 5) {
    return 1;
  }
  return 0;
}

function scoreFuzzyTokenMatches(tokens, haystackTokens) {
  if (!tokens.length || !haystackTokens.length) {
    return { score: 0, matched: [], strongMatches: 0 };
  }

  let score = 0;
  const matched = [];
  let strongMatches = 0;
  for (const token of tokens) {
    const maxDistance = getFuzzyThreshold(token);
    if (!maxDistance) {
      continue;
    }

    let bestDistance = maxDistance + 1;
    let bestCandidate = "";
    for (const candidate of haystackTokens) {
      if (!candidate || candidate === token) {
        continue;
      }
      const distance = limitedEditDistance(token, candidate, maxDistance);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCandidate = candidate;
      }
      if (bestDistance === 1) {
        break;
      }
    }

    if (bestDistance <= maxDistance) {
      matched.push(token);
      score += bestDistance === 1 ? 14 : 8;
      if (isStrongFuzzyCandidate(token, bestCandidate, bestDistance)) {
        strongMatches += 1;
      }
    }
  }

  return { score, matched, strongMatches };
}

function computeItemScore(item, parsedQuery, usageStats, language) {
  const normalizedTitle = normalizeText(item.title);
  const normalizedPath = normalizeText(item.folderPath.join(" "));
  const normalizedUrl = normalizeText(item.url || "");
  const normalizedDomain = normalizeText(item.domain || getDomain(item.url));
  const aiText = normalizeText(item.aiTags.join(" "));
  const titleTokens = tokenize(item.title);
  const pathTokens = tokenize(item.folderPath.join(" "));
  const urlTokens = tokenize(`${item.url || ""} ${item.domain || ""}`);
  const aiTokens = tokenize(item.aiTags.join(" "));
  const titleFuzzyTokens = tokenizeForFuzzy(item.title);
  const urlFuzzyTokens = tokenizeForFuzzy(`${item.url || ""} ${item.domain || ""}`);
  const aiFuzzyTokens = tokenizeForFuzzy(item.aiTags.join(" "));

  let score = 0;
  const reasons = [];

  if (!parsedQuery.queryText) {
    score = item.zeroStateScore || 0;
    const usageKey = `${item.type}:${item.entityId}`;
    score += clamp((usageStats.openCounts?.[usageKey] || 0) * 3, 0, 18);
    if (item.lastUsedAt) {
      const ageHours = Math.max(0, (Date.now() - item.lastUsedAt) / 36e5);
      score += clamp(24 - ageHours, 0, 24);
    }
    return { score: Math.round(score), reasons };
  }

  if (normalizedTitle.startsWith(parsedQuery.normalized)) {
    score += 90;
    reasons.push(t(language, "reasonTitlePrefixMatch"));
  } else if (normalizedTitle.includes(parsedQuery.normalized) && parsedQuery.normalized) {
    score += 70;
    reasons.push(t(language, "reasonTitleMatch"));
  }

  const titleMatch = scoreTokenMatches(parsedQuery.tokens, titleTokens);
  if (titleMatch.score > 0) {
    score += titleMatch.score;
    if (!reasons.includes(t(language, "reasonTitleMatch"))) {
      reasons.push(t(language, "reasonTitleTokenMatch"));
    }
  }

  const titleFuzzyMatch = scoreFuzzyTokenMatches(parsedQuery.tokens, titleFuzzyTokens);
  if (titleFuzzyMatch.score > 0) {
    score += titleFuzzyMatch.score;
    score += titleFuzzyMatch.strongMatches * 34;
    reasons.push(t(language, "reasonFuzzyMatch"));
  }

  if (normalizedPath.includes(parsedQuery.normalized) && parsedQuery.normalized) {
    score += 45;
    reasons.push(t(language, "reasonPathMatch"));
  }

  const pathMatch = scoreTokenMatches(parsedQuery.tokens, pathTokens);
  if (pathMatch.score > 0) {
    score += pathMatch.score * 0.85;
    if (!reasons.includes(t(language, "reasonPathMatch"))) {
      reasons.push(t(language, "reasonPathTokenMatch"));
    }
  }

  if ((normalizedDomain.includes(parsedQuery.normalized) || normalizedUrl.includes(parsedQuery.normalized)) && parsedQuery.normalized) {
    score += 34;
    reasons.push(t(language, "reasonUrlMatch"));
  }

  const urlMatch = scoreTokenMatches(parsedQuery.tokens, urlTokens);
  if (urlMatch.score > 0) {
    score += urlMatch.score * 0.75;
    if (!reasons.includes(t(language, "reasonUrlMatch"))) {
      reasons.push(t(language, "reasonUrlOrDomainMatch"));
    }
  }

  const urlFuzzyMatch = scoreFuzzyTokenMatches(parsedQuery.tokens, urlFuzzyTokens);
  if (urlFuzzyMatch.score > 0) {
    score += urlFuzzyMatch.score * 0.7;
    score += urlFuzzyMatch.strongMatches * 10;
    reasons.push(t(language, "reasonFuzzyMatch"));
  }

  if (aiText && parsedQuery.normalized && aiText.includes(parsedQuery.normalized)) {
    score += 24;
    reasons.push(t(language, "reasonAiTagMatch"));
  }

  const aiMatch = scoreTokenMatches(parsedQuery.tokens, aiTokens);
  if (aiMatch.score > 0) {
    score += aiMatch.score * 0.6;
    if (!reasons.includes(t(language, "reasonAiTagMatch"))) {
      reasons.push(t(language, "reasonAiTagMatch"));
    }
  }

  const aiFuzzyMatch = scoreFuzzyTokenMatches(parsedQuery.tokens, aiFuzzyTokens);
  if (aiFuzzyMatch.score > 0) {
    score += aiFuzzyMatch.score * 0.45;
    score += aiFuzzyMatch.strongMatches * 4;
    reasons.push(t(language, "reasonFuzzyMatch"));
  }

  if (parsedQuery.site) {
    if (normalizedDomain.includes(parsedQuery.site) || normalizedUrl.includes(parsedQuery.site)) {
      score += 28;
      reasons.push(t(language, "reasonSiteFilterMatch"));
    } else {
      score = 0;
    }
  }

  if (parsedQuery.type === "folder" && item.type === "folder") {
    score += 16;
  } else if (parsedQuery.type === "folder" && item.type !== "folder") {
    score = 0;
  }

  if (item.type === "tab") {
    score += 10;
  }

  const usageKey = `${item.type}:${item.entityId}`;
  score += clamp((usageStats.openCounts?.[usageKey] || 0) * 2, 0, 12);

  if (item.lastUsedAt) {
    const ageHours = Math.max(0, (Date.now() - item.lastUsedAt) / 36e5);
    score += clamp(18 - ageHours, 0, 18);
  }

  return { score: Math.round(score), reasons: [...new Set(reasons)] };
}

function isStrongFuzzyCandidate(token, candidate, distance) {
  if (!candidate || !token || distance <= 0) {
    return false;
  }

  if (token.length < 5 || candidate.length < 5) {
    return false;
  }

  if (Math.abs(token.length - candidate.length) > 1) {
    return false;
  }

  return token[0] === candidate[0] && token.at(-1) === candidate.at(-1);
}

function mergeDuplicateItems(items, language) {
  const byUrl = new Map();
  const merged = [];

  for (const item of items) {
    if (!item.url) {
      merged.push(item);
      continue;
    }

    const key = normalizeText(item.url);
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, item);
      merged.push(item);
      continue;
    }

    existing.sourceBadges = [...new Set([...existing.sourceBadges, ...item.sourceBadges])];
    existing.matchReasons = [...new Set([...existing.matchReasons, ...item.matchReasons])];
    existing.aiTags = [...new Set([...existing.aiTags, ...item.aiTags])];
    existing.aiSummary = existing.aiSummary || item.aiSummary || "";
    existing.folderPath = existing.folderPath.length >= item.folderPath.length ? existing.folderPath : item.folderPath;
    existing.score = Math.max(existing.score, item.score + (item.type === "tab" ? 3 : 0));

    if (item.type === "tab") {
      existing.type = "tab";
      existing.tabId = item.tabId;
      existing.windowId = item.windowId;
      existing.sourceBadges = [...new Set([t(language, "sourceCurrentTab"), ...existing.sourceBadges])];
    }

    if (item.type === "bookmark") {
      existing.bookmarkId = item.bookmarkId;
      existing.sourceBadges = [...new Set([t(language, "sourceSaved"), ...existing.sourceBadges])];
    }
  }

  return merged;
}

export function buildAiCandidateItems({ bookmarks, folders, tabs, aiTagMap, language = "zh-CN" }) {
  const bookmarkItems = bookmarks.map((bookmark) => ({
    id: `bookmark:${bookmark.id}`,
    entityId: bookmark.id,
    bookmarkId: bookmark.id,
    type: "bookmark",
    title: bookmark.title || bookmark.url || t(language, "bgUnnamed"),
    url: bookmark.url || "",
    domain: getDomain(bookmark.url),
    folderPath: bookmark.folderPath,
    sourceBadges: [t(language, "sourceBookmark")],
    matchReasons: [],
    aiTags: aiTagMap.get(`bookmark:${bookmark.id}`)?.tags || [],
    aiSummary: aiTagMap.get(`bookmark:${bookmark.id}`)?.summary || "",
    lastUsedAt: bookmark.lastUsedAt || null,
    zeroStateScore: bookmark.zeroStateScore || 0,
    faviconUrl: createFaviconUrl(bookmark.url)
  }));

  const folderItems = folders.map((folder) => ({
    id: `folder:${folder.id}`,
    entityId: folder.id,
    type: "folder",
    title: folder.title || t(language, "bgUnnamed"),
    url: "",
    domain: "",
    folderPath: folder.folderPath,
    sourceBadges: [t(language, "sourceFolder")],
    matchReasons: [],
    aiTags: aiTagMap.get(`folder:${folder.id}`)?.tags || [],
    aiSummary: aiTagMap.get(`folder:${folder.id}`)?.summary || "",
    lastUsedAt: folder.lastUsedAt || null,
    zeroStateScore: folder.zeroStateScore || 0,
    childPreview: folder.childPreview || [],
    descendantBookmarkIds: folder.descendantBookmarkIds || []
  }));

  const tabItems = tabs.map((tab) => ({
    id: `tab:${tab.id}`,
    entityId: tab.id,
    tabId: tab.id,
    windowId: tab.windowId,
    type: "tab",
    title: tab.title || tab.url || t(language, "bgUnnamed"),
    url: tab.url || "",
    domain: getDomain(tab.url),
    folderPath: [],
    sourceBadges: [t(language, "sourceCurrentTab")],
    matchReasons: [],
    aiTags: aiTagMap.get(`tab:${tab.id}`)?.tags || [],
    aiSummary: aiTagMap.get(`tab:${tab.id}`)?.summary || "",
    lastUsedAt: tab.lastAccessed || null,
    zeroStateScore: tab.zeroStateScore || 0,
    faviconUrl: tab.favIconUrl || createFaviconUrl(tab.url)
  }));

  return [...tabItems, ...bookmarkItems, ...folderItems].map((item) => ({
    ...item,
    usageKey: `${item.type}:${item.entityId}`,
    score: 0
  }));
}

export function buildSearchItems({ bookmarks, folders, tabs, aiTagMap, language = "zh-CN" }) {
  const merged = mergeDuplicateItems(buildAiCandidateItems({ bookmarks, folders, tabs, aiTagMap, language }), language);
  return merged.map((item) => ({
    ...item,
    usageKey: `${item.type}:${item.entityId}`,
    score: 0
  }));
}

export function searchItems({ items, queryText, scope = "all", limit = 20, usageStats, language = "zh-CN" }) {
  const parsedQuery = parseQuery(queryText, scope);
  const filtered = items.filter((item) => {
    if (!parsedQuery.scope.tabs && item.type === "tab") {
      return false;
    }
    if (!parsedQuery.scope.bookmarks && item.type === "bookmark") {
      return false;
    }
    if (!parsedQuery.scope.folders && item.type === "folder") {
      return false;
    }
    return true;
  });

  return filtered
    .map((item) => {
      const { score, reasons } = computeItemScore(item, parsedQuery, usageStats, language);
      return {
        ...item,
        score,
        matchReasons: reasons
      };
    })
    .filter((item) => (parsedQuery.queryText ? item.score > 0 : item.zeroStateScore > 0))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.title.localeCompare(right.title, language === "zh-CN" ? "zh-CN" : "en");
    })
    .slice(0, limit);
}

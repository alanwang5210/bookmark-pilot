import { buildAiCandidateItems } from "../shared/search.js";

export function canAutoAnalyzeCreatedBookmark({ bookmarkNode, settings }) {
  return Boolean(
    bookmarkNode?.url &&
    settings?.ai?.enabled &&
    settings?.ai?.apiKey &&
    settings?.ai?.baseUrl
  );
}

export function buildCreatedBookmarkCandidate({ bookmarkId, searchIndex, language = "zh-CN" }) {
  if (!bookmarkId) {
    return null;
  }

  const items = buildAiCandidateItems({
    bookmarks: searchIndex.bookmarks || [],
    folders: searchIndex.folders || [],
    tabs: [],
    aiTagMap: searchIndex.aiTagMap || new Map(),
    language
  });

  return items.find((item) => item.type === "bookmark" && String(item.entityId) === String(bookmarkId)) || null;
}

export async function autoAnalyzeCreatedBookmark({
  bookmarkNode,
  settings,
  language = "zh-CN",
  searchIndex,
  enrichItemsWithAi,
  refreshAiTagMap
}) {
  if (!canAutoAnalyzeCreatedBookmark({ bookmarkNode, settings })) {
    return false;
  }

  const candidate = buildCreatedBookmarkCandidate({
    bookmarkId: bookmarkNode.id,
    searchIndex,
    language
  });
  if (!candidate) {
    return false;
  }

  await enrichItemsWithAi([candidate], { language });
  await refreshAiTagMap();
  return true;
}

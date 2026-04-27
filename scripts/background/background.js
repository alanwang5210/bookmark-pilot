import { AI_PROGRESS_KEY, DEAD_LINK_PROGRESS_KEY, MESSAGE_TYPES, MAX_OMNIBOX_RESULTS } from "../shared/constants.js";
import { getEffectiveLanguage, t } from "../shared/i18n.js";
import { getSettings, recordUsage, saveSettings } from "../shared/storage.js";
import { SearchIndex } from "./indexer.js";
import { buildAiCandidateItems, buildSearchItems } from "../shared/search.js";
import { getDefaultScopeSelection, hasScopeSelection, resolveBookmarkScopeSelection, resolveTabScopeSelection, summarizeScopeSelection } from "../shared/ai-scope.js";
import { enrichItemsWithAi, clearAllAiTags, isAbortError } from "./ai.js";
import { autoAnalyzeCreatedBookmark } from "./bookmark-auto-ai.js";
import { cleanupDeadLinkItems, scanDeadLinkItems } from "./dead-links.js";

const searchIndex = new SearchIndex();
let aiAbortController = null;
let aiProgress = {
  running: false,
  processed: 0,
  total: 0,
  percent: 0,
  message: "Not started",
  currentTitle: "",
  entityType: "",
  error: "",
  completedAt: ""
};
let deadLinkScanProgress = {
  running: false,
  processed: 0,
  total: 0,
  percent: 0,
  results: [],
  message: "Not started",
  currentTitle: "",
  currentType: "",
  error: "",
  completedAt: "",
  cleanupSummary: null
};

chrome.runtime.onInstalled.addListener(async () => {
  await ensureWarmIndex();
  await syncOmniboxSuggestion();
});

chrome.runtime.onStartup?.addListener(async () => {
  await ensureWarmIndex();
  await syncOmniboxSuggestion();
});

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  await ensureWarmIndex();
  const settings = await getSettings();
  const language = getEffectiveLanguage(settings);
  const response = await searchIndex.search({
    text,
    scope: "all",
    limit: MAX_OMNIBOX_RESULTS,
    language
  });
  const omniboxItems = response.items.filter((item) => item.type !== "folder").slice(0, MAX_OMNIBOX_RESULTS);

  suggest(
    omniboxItems.map((item) => ({
      content: JSON.stringify({ id: item.id }),
      description: formatOmniboxDescription(item, language)
    }))
  );
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  await ensureWarmIndex();
  const settings = await getSettings();
  const language = getEffectiveLanguage(settings);
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    const response = await searchIndex.search({ text, scope: "all", limit: 1, language });
    payload = { id: response.items[0]?.id || "" };
  }

  if (!payload.id) {
    return;
  }

  const item = await findItemById(payload.id, language);
  if (item) {
    await openItem(item, disposition === "currentTab");
  }
});

chrome.bookmarks.onCreated.addListener((id, bookmarkNode) => {
  void handleBookmarkCreated(id, bookmarkNode);
});
chrome.bookmarks.onRemoved.addListener(() => searchIndex.refreshBookmarks());
chrome.bookmarks.onChanged.addListener(() => searchIndex.refreshBookmarks());
chrome.bookmarks.onMoved.addListener(() => searchIndex.refreshBookmarks());
chrome.bookmarks.onChildrenReordered.addListener(() => searchIndex.refreshBookmarks());

chrome.tabs.onCreated.addListener(() => searchIndex.refreshTabs());
chrome.tabs.onRemoved.addListener(() => searchIndex.refreshTabs());
chrome.tabs.onUpdated.addListener(() => searchIndex.refreshTabs());
chrome.tabs.onActivated.addListener(() => searchIndex.refreshTabs());

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    });
  return true;
});

async function handleMessage(message) {
  await ensureWarmIndex();
  const settings = await getSettings();
  const language = getEffectiveLanguage(settings);

  switch (message.type) {
    case MESSAGE_TYPES.SEARCH: {
      const response = await searchIndex.search({
        text: message.text,
        scope: message.scope,
        folderId: message.folderId,
        language
      });
      return { ok: true, ...response };
    }
    case MESSAGE_TYPES.GET_ZERO_STATE: {
      const response = await searchIndex.getZeroState(message.scope, message.folderId, language);
      return { ok: true, ...response };
    }
    case MESSAGE_TYPES.OPEN_ITEM: {
      const item = await findItemById(message.id, language);
      if (!item) {
        throw new Error("Item not found.");
      }
      await openItem(item, false);
      return { ok: true };
    }
    case MESSAGE_TYPES.CLOSE_TAB: {
      const item = await findItemById(message.id, language);
      if (!item || item.type !== "tab" || !item.tabId) {
        throw new Error("Tab not found.");
      }
      await chrome.tabs.remove(item.tabId);
      await searchIndex.refreshTabs();
      return { ok: true };
    }
    case MESSAGE_TYPES.GET_SETTINGS: {
      return {
        ok: true,
        settings,
        status: searchIndex.status
      };
    }
    case MESSAGE_TYPES.GET_AI_SCOPE_SOURCE: {
      return {
        ok: true,
        source: {
          folders: searchIndex.folders,
          bookmarks: searchIndex.bookmarks,
          tabs: searchIndex.tabs,
          aiRecords: [...searchIndex.aiTagMap.values()]
        }
      };
    }
    case MESSAGE_TYPES.SAVE_SETTINGS: {
      const nextSettings = await saveSettings(message.settings);
      await syncOmniboxSuggestion(nextSettings);
      return { ok: true, settings: nextSettings };
    }
    case MESSAGE_TYPES.GET_INDEX_STATUS: {
      return { ok: true, status: searchIndex.status };
    }
    case MESSAGE_TYPES.REBUILD_INDEX: {
      await searchIndex.refreshAll();
      return { ok: true, status: searchIndex.status };
    }
    case MESSAGE_TYPES.REBUILD_AI: {
      if (!isAiReady(settings)) {
        throw new Error(t(language, "bgAiNotReady"));
      }
      if (!aiProgress.running) {
        void startAiRebuild(settings, language);
      }
      return { ok: true, progress: aiProgress, status: searchIndex.status };
    }
    case MESSAGE_TYPES.STOP_AI_REBUILD: {
      if (aiAbortController && aiProgress.running) {
        aiAbortController.abort();
      }
      return { ok: true, progress: await getAiProgressState() };
    }
    case MESSAGE_TYPES.GET_AI_PROGRESS: {
      return { ok: true, progress: await getAiProgressState() };
    }
    case MESSAGE_TYPES.CLEAR_AI: {
      await clearAllAiTags();
      await updateAiProgress({
        running: false,
        processed: 0,
        total: 0,
        percent: 0,
        message: t(language, "bgAiCleared"),
        currentTitle: "",
        entityType: "",
        error: "",
        completedAt: new Date().toISOString()
      });
      await searchIndex.refreshAiTagMap();
      return { ok: true, status: searchIndex.status };
    }
    case MESSAGE_TYPES.SCAN_DEAD_LINKS: {
      if (!deadLinkScanProgress.running) {
        void startDeadLinkScan(language);
      }
      return { ok: true, progress: await getDeadLinkProgressState() };
    }
    case MESSAGE_TYPES.GET_DEAD_LINK_SCAN_PROGRESS: {
      return { ok: true, progress: await getDeadLinkProgressState() };
    }
    case MESSAGE_TYPES.CLEAN_DEAD_LINKS: {
      const items = Array.isArray(message.items) ? message.items : [];
      const cleanup = await cleanupDeadLinkItems({
        items,
        removeBookmark: (bookmarkId) => chrome.bookmarks.remove(bookmarkId),
        removeTab: (tabId) => chrome.tabs.remove(tabId)
      });

      await Promise.all([
        searchIndex.refreshBookmarks(),
        searchIndex.refreshTabs()
      ]);

      const previousProgress = await getDeadLinkProgressState();
      const cleanedIds = new Set(cleanup.cleanedIds || []);
      const remainingResults = (previousProgress.results || []).filter((item) => !cleanedIds.has(item.id));

      await updateDeadLinkProgress({
        running: false,
        processed: remainingResults.length,
        total: remainingResults.length,
        percent: remainingResults.length ? 100 : 0,
        results: remainingResults,
        message: t(language, "deadLinksCleanupDone"),
        currentTitle: "",
        currentType: "",
        error: "",
        completedAt: new Date().toISOString(),
        cleanupSummary: cleanup
      });

      return {
        ok: true,
        cleanup,
        progress: await getDeadLinkProgressState(),
        status: searchIndex.status
      };
    }
    default:
      throw new Error(`Unsupported message type: ${message.type}`);
  }
}

async function handleBookmarkCreated(id, bookmarkNode) {
  await searchIndex.refreshBookmarks();

  try {
    const settings = await getSettings();
    const language = getEffectiveLanguage(settings);
    await autoAnalyzeCreatedBookmark({
      bookmarkNode: {
        id,
        ...bookmarkNode
      },
      settings,
      language,
      searchIndex,
      enrichItemsWithAi,
      refreshAiTagMap: () => searchIndex.refreshAiTagMap()
    });
  } catch (error) {
    console.warn("Bookmark auto AI analysis skipped:", error);
  }
}

async function ensureWarmIndex() {
  if (!searchIndex.status.lastBuiltAt) {
    await searchIndex.refreshAll();
  }
}

function isAiReady(settings) {
  const explicitSelection = settings.ai.scopeSelection || { bookmarkNodeIds: [], tabNodeIds: [] };
  const effectiveSelection = hasScopeSelection(explicitSelection)
    ? explicitSelection
    : getDefaultScopeSelection({
        folders: searchIndex.folders,
        bookmarks: searchIndex.bookmarks,
        tabs: searchIndex.tabs
      });
  return Boolean(
    settings.ai.enabled &&
    settings.ai.baseUrl &&
    settings.ai.apiKey &&
    hasScopeSelection(effectiveSelection)
  );
}

async function syncOmniboxSuggestion(settings = null) {
  const currentSettings = settings || await getSettings();
  const language = getEffectiveLanguage(currentSettings);
  chrome.omnibox.setDefaultSuggestion({
    description: t(language, "omniboxSuggestion")
  });
}

async function startAiRebuild(settings, language) {
  const items = buildAiCandidateItems({
    bookmarks: searchIndex.bookmarks,
    folders: searchIndex.folders,
    tabs: searchIndex.tabs,
    aiTagMap: new Map(),
    language
  });

  const savedSelection = settings.ai.scopeSelection || { bookmarkNodeIds: [], tabNodeIds: [] };
  const selection =
    hasScopeSelection(savedSelection)
      ? savedSelection
      : getDefaultScopeSelection({
          folders: searchIndex.folders,
          bookmarks: searchIndex.bookmarks,
          tabs: searchIndex.tabs
        });
  const bookmarkScope = resolveBookmarkScopeSelection({
    folders: searchIndex.folders,
    bookmarks: searchIndex.bookmarks,
    selectedNodeIds: selection.bookmarkNodeIds
  });
  const tabScope = resolveTabScopeSelection({
    tabs: searchIndex.tabs,
    selectedNodeIds: selection.tabNodeIds
  });
  const scopeSummary = summarizeScopeSelection({
    bookmarkResolution: bookmarkScope,
    tabResolution: tabScope
  });
  const eligibleItems = items.filter((item) => {
    if (item.type === "tab") {
      return tabScope.tabIds.includes(String(item.entityId));
    }
    if (item.type === "folder") {
      return bookmarkScope.folderIds.includes(String(item.entityId));
    }
    return bookmarkScope.bookmarkIds.includes(String(item.entityId));
  });

  aiAbortController = new AbortController();

  await updateAiProgress({
    running: true,
    processed: 0,
    total: eligibleItems.length,
    percent: 0,
    message: formatScopeSummary(language, scopeSummary),
    currentTitle: "",
    entityType: "",
    scopeSummary,
    error: "",
    completedAt: ""
  });

  try {
    const result = await enrichItemsWithAi(eligibleItems, {
      language,
      signal: aiAbortController.signal,
      onProgress: async ({ processed, total, currentTitle, entityType }) => {
        await updateAiProgress({
          running: true,
          processed,
          total,
          percent: total ? Math.round((processed / total) * 100) : 0,
          message: describeAiProcessing(language, entityType, currentTitle),
          currentTitle,
          entityType,
          scopeSummary,
          error: "",
          completedAt: ""
        });
      }
    });

    await searchIndex.refreshAiTagMap();
    await updateAiProgress({
      running: false,
      processed: result.processed,
      total: result.total,
      percent: result.total ? 100 : 0,
      message: t(language, "bgAiDone"),
      currentTitle: "",
      entityType: "",
      scopeSummary,
      error: "",
      completedAt: new Date().toISOString()
    });
  } catch (error) {
    if (isAbortError(error)) {
      await updateAiProgress({
        running: false,
        processed: aiProgress.processed,
        total: aiProgress.total,
        percent: aiProgress.percent,
        message: t(language, "bgAiStopped"),
        currentTitle: "",
        entityType: "",
        scopeSummary,
        error: "",
        completedAt: new Date().toISOString()
      });
    } else {
      await updateAiProgress({
        running: false,
        processed: aiProgress.processed,
        total: aiProgress.total,
        percent: aiProgress.percent,
        message: t(language, "bgAiFailed"),
        currentTitle: "",
        entityType: "",
        scopeSummary,
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date().toISOString()
      });
    }
  } finally {
    aiAbortController = null;
  }
}

async function startDeadLinkScan(language) {
  const items = buildAiCandidateItems({
    bookmarks: searchIndex.bookmarks,
    folders: [],
    tabs: searchIndex.tabs,
    aiTagMap: new Map(),
    language
  }).filter((item) => (item.type === "bookmark" || item.type === "tab") && /^https?:/i.test(item.url || ""));

  await updateDeadLinkProgress({
    running: true,
    processed: 0,
    total: items.length,
    percent: 0,
    results: [],
    message: t(language, "deadLinksScanPreparing"),
    currentTitle: "",
    currentType: "",
    error: "",
    completedAt: "",
    cleanupSummary: null
  });

  try {
    const results = await scanDeadLinkItems({
      items,
      onProgress: async ({ processed, total, title, type, results: partialResults }) => {
        await updateDeadLinkProgress({
          running: true,
          processed,
          total,
          percent: total ? Math.round((processed / total) * 100) : 0,
          results: partialResults || [],
          message: describeDeadLinkProcessing(language, type, title),
          currentTitle: title || "",
          currentType: type || "",
          error: "",
          completedAt: "",
          cleanupSummary: null
        });
      }
    });

    await updateDeadLinkProgress({
      running: false,
      processed: items.length,
      total: items.length,
      percent: items.length ? 100 : 0,
      results,
      message: t(language, results.length ? "deadLinksScanDone" : "deadLinksScanEmpty"),
      currentTitle: "",
      currentType: "",
      error: "",
      completedAt: new Date().toISOString(),
      cleanupSummary: null
    });
  } catch (error) {
    await updateDeadLinkProgress({
      running: false,
      processed: deadLinkScanProgress.processed,
      total: deadLinkScanProgress.total,
      percent: deadLinkScanProgress.percent,
      results: deadLinkScanProgress.results || [],
      message: t(language, "deadLinksScanFailed"),
      currentTitle: "",
      currentType: "",
      error: error instanceof Error ? error.message : String(error),
      completedAt: new Date().toISOString(),
      cleanupSummary: null
    });
  }
}

function formatScopeSummary(language, summary) {
  return t(language, "optionsScopeSummary", summary);
}

function describeAiProcessing(language, entityType, title) {
  const safeTitle = title || t(language, "bgUnnamed");
  if (entityType === "tab") {
    return t(language, "bgAiProcessingTab", { title: safeTitle });
  }
  if (entityType === "folder") {
    return t(language, "bgAiProcessingFolder", { title: safeTitle });
  }
  return t(language, "bgAiProcessingBookmark", { title: safeTitle });
}

async function updateAiProgress(nextState) {
  aiProgress = {
    ...aiProgress,
    ...nextState
  };
  await chrome.storage.local.set({ [AI_PROGRESS_KEY]: aiProgress });
}

async function getAiProgressState() {
  const stored = await chrome.storage.local.get(AI_PROGRESS_KEY);
  return stored[AI_PROGRESS_KEY] || aiProgress;
}

function describeDeadLinkProcessing(language, entityType, title) {
  const safeTitle = title || t(language, "bgUnnamed");
  if (entityType === "tab") {
    return t(language, "deadLinksScanningTab", { title: safeTitle });
  }
  return t(language, "deadLinksScanningBookmark", { title: safeTitle });
}

async function updateDeadLinkProgress(nextState) {
  deadLinkScanProgress = {
    ...deadLinkScanProgress,
    ...nextState
  };
  await chrome.storage.local.set({ [DEAD_LINK_PROGRESS_KEY]: deadLinkScanProgress });
}

async function getDeadLinkProgressState() {
  const stored = await chrome.storage.local.get(DEAD_LINK_PROGRESS_KEY);
  return stored[DEAD_LINK_PROGRESS_KEY] || deadLinkScanProgress;
}

async function findItemById(id, language) {
  const [entityType, entityId] = String(id).split(":");
  const items = buildSearchItems({
    bookmarks: searchIndex.bookmarks,
    folders: searchIndex.folders,
    tabs: searchIndex.tabs,
    aiTagMap: searchIndex.aiTagMap,
    language
  });
  return items.find((item) => item.type === entityType && String(item.entityId) === entityId);
}

async function openItem(item, forceCurrentTab = false) {
  if (item.type === "tab" && item.tabId) {
    await chrome.tabs.update(item.tabId, { active: true });
    if (item.windowId) {
      await chrome.windows.update(item.windowId, { focused: true });
    }
    await recordUsage(item);
    return;
  }

  if (item.type === "folder") {
    return;
  }

  if (forceCurrentTab) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id) {
      await chrome.tabs.update(activeTab.id, { url: item.url });
      await recordUsage(item);
      return;
    }
  }

  await chrome.tabs.create({ url: item.url });
  await recordUsage(item);
}

function formatOmniboxDescription(item, language) {
  const safeTitle = escapeXml(item.title || t(language, "bgUnnamed"));
  const detail = escapeXml(
    item.type === "folder"
      ? item.folderPath.join(" / ") || t(language, "sourceFolder")
      : item.domain || item.url || item.folderPath.join(" / ")
  );
  return `<match>${safeTitle}</match> <dim>${detail}</dim>`;
}

function escapeXml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

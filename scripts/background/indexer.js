import { getAllAiTagRecords } from "../shared/db.js";
import { buildSearchItems, searchItems } from "../shared/search.js";
import { MAX_POPUP_RESULTS, MAX_ZERO_STATE_RESULTS } from "../shared/constants.js";
import { getUsageStats } from "../shared/storage.js";

export class SearchIndex {
  constructor() {
    this.bookmarks = [];
    this.folders = [];
    this.tabs = [];
    this.aiTagMap = new Map();
    this.status = {
      bookmarks: 0,
      folders: 0,
      tabs: 0,
      aiTagRecords: 0,
      lastBuiltAt: null
    };
  }

  async refreshAll() {
    const [bookmarkTree, tabs, aiTagRecords] = await Promise.all([
      chrome.bookmarks.getTree(),
      chrome.tabs.query({}),
      getAllAiTagRecords()
    ]);

    const { bookmarks, folders } = flattenBookmarkTree(bookmarkTree);
    this.bookmarks = bookmarks;
    this.folders = folders;
    this.tabs = tabs
      .filter((tab) => tab.url && !tab.url.startsWith("chrome://"))
      .map((tab) => ({
        ...tab,
        zeroStateScore: Math.max(2, 90 - tab.index)
      }));
    this.aiTagMap = new Map(aiTagRecords.map((record) => [record.key, record]));
    this.status = {
      bookmarks: this.bookmarks.length,
      folders: this.folders.length,
      tabs: this.tabs.length,
      aiTagRecords: aiTagRecords.length,
      lastBuiltAt: new Date().toISOString()
    };
  }

  async refreshTabs() {
    const tabs = await chrome.tabs.query({});
    this.tabs = tabs
      .filter((tab) => tab.url && !tab.url.startsWith("chrome://"))
      .map((tab) => ({
        ...tab,
        zeroStateScore: Math.max(2, 90 - tab.index)
      }));
    this.status.tabs = this.tabs.length;
    this.status.lastBuiltAt = new Date().toISOString();
  }

  async refreshBookmarks() {
    const bookmarkTree = await chrome.bookmarks.getTree();
    const { bookmarks, folders } = flattenBookmarkTree(bookmarkTree);
    this.bookmarks = bookmarks;
    this.folders = folders;
    this.status.bookmarks = this.bookmarks.length;
    this.status.folders = this.folders.length;
    this.status.lastBuiltAt = new Date().toISOString();
  }

  async refreshAiTagMap() {
    const aiTagRecords = await getAllAiTagRecords();
    this.aiTagMap = new Map(aiTagRecords.map((record) => [record.key, record]));
    this.status.aiTagRecords = aiTagRecords.length;
    this.status.lastBuiltAt = new Date().toISOString();
  }

  async search({ text = "", scope = "all", limit = MAX_POPUP_RESULTS, folderId = "", language = "zh-CN" }) {
    const usageStats = await getUsageStats();
    let bookmarks = this.bookmarks;
    let folders = this.folders;

    if (folderId) {
      bookmarks = bookmarks.filter((bookmark) => bookmark.parentId === folderId);
      folders = folders.filter((folder) => folder.parentId === folderId);
    }

    const items = buildSearchItems({
      bookmarks,
      folders,
      tabs: folderId ? [] : this.tabs,
      aiTagMap: this.aiTagMap,
      language
    });

    const startedAt = performance.now();
    const rankedItems = searchItems({
      items,
      queryText: text,
      scope,
      limit,
      usageStats,
      language
    });

    return {
      items: rankedItems,
      latencyMs: Math.round(performance.now() - startedAt),
      sourceCounts: {
        bookmarks: bookmarks.length,
        folders: folders.length,
        tabs: folderId ? 0 : this.tabs.length
      },
      hasMore: rankedItems.length >= limit
    };
  }

  async getZeroState(scope = "all", folderId = "", language = "zh-CN") {
    return this.search({
      text: "",
      scope,
      limit: MAX_ZERO_STATE_RESULTS,
      folderId,
      language
    });
  }
}

function flattenBookmarkTree(tree) {
  const bookmarks = [];
  const folders = [];

  function visit(node, path = []) {
    if (node.url) {
      bookmarks.push({
        id: node.id,
        parentId: node.parentId || "",
        title: node.title,
        url: node.url,
        folderPath: path,
        zeroStateScore: Math.max(2, 60 - bookmarks.length)
      });
      return 1;
    }

    if (node.id !== "0") {
      folders.push({
        id: node.id,
        parentId: node.parentId || "",
        title: node.title || "",
        folderPath: path,
        childPreview: [],
        descendantBookmarkIds: [],
        zeroStateScore: Math.max(1, 36 - folders.length)
      });
    }

    let descendantCount = 0;
    for (const child of node.children || []) {
      const childPath = node.id === "0" ? path : [...path, node.title || ""].filter(Boolean);
      descendantCount += visit(child, childPath);
    }

    if (node.id !== "0") {
      const folderRecord = folders.find((folder) => folder.id === node.id);
      folderRecord.childPreview = (node.children || []).slice(0, 3).map((child) => child.title || child.url || "");
      folderRecord.descendantBookmarkIds = collectBookmarkIds(node);
      folderRecord.zeroStateScore += Math.min(descendantCount, 10);
    }

    return descendantCount;
  }

  for (const rootNode of tree) {
    visit(rootNode, []);
  }

  return { bookmarks, folders };
}

function collectBookmarkIds(node) {
  const results = [];
  for (const child of node.children || []) {
    if (child.url) {
      results.push(child.id);
    } else {
      results.push(...collectBookmarkIds(child));
    }
  }
  return results;
}

import test from "node:test";
import assert from "node:assert/strict";

import { searchItems } from "./search.js";

function createItem(overrides = {}) {
  return {
    id: "bookmark:1",
    entityId: "1",
    bookmarkId: "1",
    type: "bookmark",
    title: "Apifox",
    url: "https://apifox.com",
    domain: "apifox.com",
    folderPath: [],
    sourceBadges: ["Bookmark"],
    matchReasons: [],
    aiTags: [],
    aiSummary: "",
    lastUsedAt: null,
    zeroStateScore: 0,
    faviconUrl: "",
    usageKey: "bookmark:1",
    score: 0,
    ...overrides
  };
}

test("searchItems returns typo-tolerant matches for close misspellings", () => {
  const results = searchItems({
    items: [createItem()],
    queryText: "apifix",
    scope: "all",
    limit: 20,
    usageStats: { openCounts: {} },
    language: "en"
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].title, "Apifox");
});

test("searchItems keeps exact matches ahead of typo-tolerant matches", () => {
  const results = searchItems({
    items: [
      createItem({
        id: "bookmark:1",
        entityId: "1",
        title: "Apifox",
        url: "https://apifox.com",
        domain: "apifox.com",
        usageKey: "bookmark:1"
      }),
      createItem({
        id: "bookmark:2",
        entityId: "2",
        title: "Apifix handbook",
        url: "https://example.com/apifix",
        domain: "example.com",
        usageKey: "bookmark:2"
      })
    ],
    queryText: "apifix",
    scope: "all",
    limit: 20,
    usageStats: { openCounts: {} },
    language: "en"
  });

  assert.equal(results.length, 2);
  assert.equal(results[0].title, "Apifix handbook");
  assert.equal(results[1].title, "Apifox");
});

test("searchItems keeps typo tolerance for split brand tokens like API Fox", () => {
  const results = searchItems({
    items: [
      createItem({
        id: "bookmark:1",
        entityId: "1",
        title: "API Fox",
        url: "https://api-fox.example.com",
        domain: "api-fox.example.com",
        usageKey: "bookmark:1"
      }),
      createItem({
        id: "bookmark:2",
        entityId: "2",
        title: "API Docs",
        url: "https://api.example.com/docs",
        domain: "api.example.com",
        usageKey: "bookmark:2"
      })
    ],
    queryText: "apifix",
    scope: "all",
    limit: 20,
    usageStats: { openCounts: {} },
    language: "en"
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].title, "API Fox");
});

test("searchItems ranks close typo title matches above weaker metadata-only matches", () => {
  const results = searchItems({
    items: [
      createItem({
        id: "bookmark:1",
        entityId: "1",
        title: "Apifox",
        url: "https://app.apifox.com",
        domain: "app.apifox.com",
        usageKey: "bookmark:1"
      }),
      createItem({
        id: "bookmark:2",
        entityId: "2",
        title: "接口平台",
        url: "https://tools.example.com",
        domain: "tools.example.com",
        folderPath: ["团队", "apifix 备份"],
        usageKey: "bookmark:2"
      }),
      createItem({
        id: "bookmark:3",
        entityId: "3",
        title: "接口文档",
        url: "https://docs.example.com",
        domain: "docs.example.com",
        aiTags: ["apifix", "api"],
        usageKey: "bookmark:3"
      })
    ],
    queryText: "apifix",
    scope: "all",
    limit: 20,
    usageStats: { openCounts: {} },
    language: "zh-CN"
  });

  assert.equal(results.length, 3);
  assert.equal(results[0].title, "Apifox");
});

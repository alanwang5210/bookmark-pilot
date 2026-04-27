import test from "node:test";
import assert from "node:assert/strict";

import { autoAnalyzeCreatedBookmark } from "./bookmark-auto-ai.js";

test("autoAnalyzeCreatedBookmark skips nodes without a bookmark URL", async () => {
  let enrichCalled = false;

  const analyzed = await autoAnalyzeCreatedBookmark({
    bookmarkNode: { id: "folder-1", title: "Folder only" },
    settings: {
      ai: {
        enabled: true,
        apiKey: "test-key",
        baseUrl: "https://example.com/v1"
      }
    },
    language: "zh-CN",
    searchIndex: {
      bookmarks: [],
      folders: [],
      tabs: [],
      aiTagMap: new Map()
    },
    enrichItemsWithAi: async () => {
      enrichCalled = true;
    },
    refreshAiTagMap: async () => {}
  });

  assert.equal(analyzed, false);
  assert.equal(enrichCalled, false);
});

test("autoAnalyzeCreatedBookmark enriches exactly one created bookmark and refreshes AI cache", async () => {
  const calls = [];

  const analyzed = await autoAnalyzeCreatedBookmark({
    bookmarkNode: {
      id: "101",
      parentId: "10",
      title: "OpenAI Docs",
      url: "https://platform.openai.com/docs"
    },
    settings: {
      ai: {
        enabled: true,
        apiKey: "test-key",
        baseUrl: "https://example.com/v1"
      }
    },
    language: "zh-CN",
    searchIndex: {
      bookmarks: [
        {
          id: "101",
          parentId: "10",
          title: "OpenAI Docs",
          url: "https://platform.openai.com/docs",
          folderPath: ["Research"],
          zeroStateScore: 10
        }
      ],
      folders: [],
      tabs: [],
      aiTagMap: new Map()
    },
    enrichItemsWithAi: async (items, options) => {
      calls.push({ type: "enrich", items, options });
    },
    refreshAiTagMap: async () => {
      calls.push({ type: "refresh" });
    }
  });

  assert.equal(analyzed, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].type, "enrich");
  assert.equal(calls[0].items.length, 1);
  assert.equal(calls[0].items[0].type, "bookmark");
  assert.equal(String(calls[0].items[0].entityId), "101");
  assert.equal(calls[0].options.language, "zh-CN");
  assert.equal(calls[1].type, "refresh");
});

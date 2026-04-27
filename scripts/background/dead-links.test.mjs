import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyDeadLinkResult,
  createDeadLinkRecord,
  shouldTreatFetchErrorAsDeadLink,
  cleanupDeadLinkItems,
  scanDeadLinkItems,
  checkLinkHealth
} from "./dead-links.js";

test("404 and 410 are classified as dead links", () => {
  assert.deepEqual(classifyDeadLinkResult({ ok: false, status: 404 }), {
    isDead: true,
    reason: "404"
  });
  assert.deepEqual(classifyDeadLinkResult({ ok: false, status: 410 }), {
    isDead: true,
    reason: "410"
  });
});

test("DNS failures and connection failures are classified as dead links", () => {
  assert.equal(shouldTreatFetchErrorAsDeadLink(new TypeError("fetch failed")), true);
  assert.equal(shouldTreatFetchErrorAsDeadLink(new Error("getaddrinfo ENOTFOUND example.com")), true);
  assert.equal(shouldTreatFetchErrorAsDeadLink(new Error("connect ECONNREFUSED 127.0.0.1:80")), true);
});

test("403, 500 and timeout are not directly classified as dead links", () => {
  assert.deepEqual(classifyDeadLinkResult({ ok: false, status: 403 }), {
    isDead: false,
    reason: ""
  });
  assert.deepEqual(classifyDeadLinkResult({ ok: false, status: 500 }), {
    isDead: false,
    reason: ""
  });
  assert.equal(shouldTreatFetchErrorAsDeadLink(new Error("request timeout after 5000ms")), false);
});

test("createDeadLinkRecord preserves identity and reason", () => {
  assert.deepEqual(
    createDeadLinkRecord(
      {
        id: "bookmark:7",
        entityId: "7",
        type: "bookmark",
        title: "Broken bookmark",
        url: "https://broken.example.com"
      },
      "404"
    ),
    {
      id: "bookmark:7",
      entityId: "7",
      type: "bookmark",
      title: "Broken bookmark",
      url: "https://broken.example.com",
      reason: "404"
    }
  );
});

test("cleanupDeadLinkItems removes bookmarks and closes tabs separately", async () => {
  const calls = [];

  const result = await cleanupDeadLinkItems({
    items: [
      { type: "bookmark", entityId: "10", id: "bookmark:10" },
      { type: "tab", tabId: 22, entityId: "22", id: "tab:22" }
    ],
    removeBookmark: async (bookmarkId) => {
      calls.push(["bookmark", bookmarkId]);
    },
    removeTab: async (tabId) => {
      calls.push(["tab", tabId]);
    }
  });

  assert.deepEqual(calls, [
    ["bookmark", "10"],
    ["tab", 22]
  ]);
  assert.deepEqual(result, {
    cleaned: 2,
    failed: 0,
    cleanedIds: ["bookmark:10", "tab:22"],
    failedIds: []
  });
});

test("cleanupDeadLinkItems keeps failed ids so the UI can retain them", async () => {
  const result = await cleanupDeadLinkItems({
    items: [
      { type: "bookmark", entityId: "10", id: "bookmark:10" },
      { type: "tab", tabId: 22, entityId: "22", id: "tab:22" }
    ],
    removeBookmark: async () => {
      throw new Error("remove failed");
    },
    removeTab: async () => {}
  });

  assert.deepEqual(result, {
    cleaned: 1,
    failed: 1,
    cleanedIds: ["tab:22"],
    failedIds: ["bookmark:10"]
  });
});

test("checkLinkHealth maps DNS and connection failures to readable reasons", async () => {
  await assert.doesNotReject(async () => {
    const dnsResult = await checkLinkHealth("https://dns.example.com", async () => {
      throw new Error("getaddrinfo ENOTFOUND dns.example.com");
    });
    assert.deepEqual(dnsResult, {
      isDead: true,
      reason: "DNS failure"
    });

    const connectionResult = await checkLinkHealth("https://conn.example.com", async () => {
      throw new TypeError("fetch failed");
    });
    assert.deepEqual(connectionResult, {
      isDead: true,
      reason: "Connection failure"
    });
  });
});

test("scanDeadLinkItems only returns dead http items and preserves tab metadata", async () => {
  const visited = [];
  const results = await scanDeadLinkItems({
    items: [
      {
        id: "bookmark:1",
        entityId: "1",
        type: "bookmark",
        title: "Healthy",
        url: "https://ok.example.com"
      },
      {
        id: "bookmark:2",
        entityId: "2",
        type: "bookmark",
        title: "Gone",
        url: "https://gone.example.com"
      },
      {
        id: "tab:3",
        entityId: "3",
        tabId: 3,
        type: "tab",
        title: "Broken tab",
        url: "https://dead.example.com"
      },
      {
        id: "bookmark:4",
        entityId: "4",
        type: "bookmark",
        title: "Chrome page",
        url: "chrome://extensions"
      }
    ],
    fetchImpl: async (url) => {
      visited.push(url);
      if (url === "https://gone.example.com") {
        return { status: 410 };
      }
      if (url === "https://dead.example.com") {
        throw new Error("getaddrinfo ENOTFOUND dead.example.com");
      }
      return { status: 200 };
    }
  });

  assert.deepEqual(visited, [
    "https://ok.example.com",
    "https://gone.example.com",
    "https://dead.example.com"
  ]);
  assert.deepEqual(results, [
    {
      id: "bookmark:2",
      entityId: "2",
      type: "bookmark",
      title: "Gone",
      url: "https://gone.example.com",
      reason: "410"
    },
    {
      id: "tab:3",
      entityId: "3",
      tabId: 3,
      type: "tab",
      title: "Broken tab",
      url: "https://dead.example.com",
      reason: "DNS failure"
    }
  ]);
});

test("scanDeadLinkItems reports progress for each scanned http item", async () => {
  const progressCalls = [];

  await scanDeadLinkItems({
    items: [
      {
        id: "bookmark:1",
        entityId: "1",
        type: "bookmark",
        title: "One",
        url: "https://one.example.com"
      },
      {
        id: "bookmark:2",
        entityId: "2",
        type: "bookmark",
        title: "Two",
        url: "https://two.example.com"
      },
      {
        id: "bookmark:3",
        entityId: "3",
        type: "bookmark",
        title: "Skip",
        url: "chrome://extensions"
      }
    ],
    fetchImpl: async () => ({ status: 200 }),
    onProgress: async (progress) => {
      progressCalls.push(progress);
    }
  });

  assert.deepEqual(progressCalls, [
    {
      processed: 1,
      total: 2,
      itemId: "bookmark:1",
      title: "One",
      type: "bookmark",
      results: []
    },
    {
      processed: 2,
      total: 2,
      itemId: "bookmark:2",
      title: "Two",
      type: "bookmark",
      results: []
    }
  ]);
});

test("scanDeadLinkItems runs multiple requests concurrently up to the configured limit", async () => {
  const deferredMap = new Map();
  let inFlight = 0;
  let maxInFlight = 0;

  const scanPromise = scanDeadLinkItems({
    items: [
      { id: "bookmark:1", entityId: "1", type: "bookmark", title: "One", url: "https://one.example.com" },
      { id: "bookmark:2", entityId: "2", type: "bookmark", title: "Two", url: "https://two.example.com" },
      { id: "bookmark:3", entityId: "3", type: "bookmark", title: "Three", url: "https://three.example.com" }
    ],
    concurrency: 2,
    fetchImpl: async (url) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => {
        deferredMap.set(url, resolve);
      });
      inFlight -= 1;
      return { status: 200 };
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(maxInFlight, 2);
  assert.equal(deferredMap.has("https://one.example.com"), true);
  assert.equal(deferredMap.has("https://two.example.com"), true);
  assert.equal(deferredMap.has("https://three.example.com"), false);

  deferredMap.get("https://one.example.com")();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(deferredMap.has("https://three.example.com"), true);

  deferredMap.get("https://two.example.com")();
  deferredMap.get("https://three.example.com")();
  await scanPromise;
});

test("scanDeadLinkItems preserves source order for results under concurrency", async () => {
  const results = await scanDeadLinkItems({
    items: [
      { id: "bookmark:1", entityId: "1", type: "bookmark", title: "First", url: "https://first.example.com" },
      { id: "bookmark:2", entityId: "2", type: "bookmark", title: "Second", url: "https://second.example.com" },
      { id: "bookmark:3", entityId: "3", type: "bookmark", title: "Third", url: "https://third.example.com" }
    ],
    concurrency: 3,
    fetchImpl: async (url) => {
      if (url === "https://second.example.com") {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { status: 410 };
      }
      if (url === "https://third.example.com") {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { status: 410 };
      }
      return { status: 200 };
    }
  });

  assert.deepEqual(
    results.map((item) => item.id),
    ["bookmark:2", "bookmark:3"]
  );
});

test("scanDeadLinkItems exposes partial dead-link results during progress updates", async () => {
  const progressSnapshots = [];

  const results = await scanDeadLinkItems({
    items: [
      { id: "bookmark:1", entityId: "1", type: "bookmark", title: "Alive", url: "https://alive.example.com" },
      { id: "bookmark:2", entityId: "2", type: "bookmark", title: "Dead early", url: "https://dead-early.example.com" },
      { id: "bookmark:3", entityId: "3", type: "bookmark", title: "Dead later", url: "https://dead-later.example.com" }
    ],
    concurrency: 2,
    fetchImpl: async (url) => {
      if (url === "https://alive.example.com") {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { status: 200 };
      }
      if (url === "https://dead-early.example.com") {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { status: 410 };
      }
      return { status: 410 };
    },
    onProgress: async (progress) => {
      progressSnapshots.push({
        processed: progress.processed,
        resultIds: (progress.results || []).map((item) => item.id)
      });
    }
  });

  assert.deepEqual(progressSnapshots, [
    { processed: 1, resultIds: ["bookmark:2"] },
    { processed: 2, resultIds: ["bookmark:2", "bookmark:3"] },
    { processed: 3, resultIds: ["bookmark:2", "bookmark:3"] }
  ]);
  assert.deepEqual(
    results.map((item) => item.id),
    ["bookmark:2", "bookmark:3"]
  );
});

export function classifyDeadLinkResult(response) {
  if (!response) {
    return { isDead: false, reason: "" };
  }

  if (response.status === 404) {
    return { isDead: true, reason: "404" };
  }
  if (response.status === 410) {
    return { isDead: true, reason: "410" };
  }

  return { isDead: false, reason: "" };
}

export function shouldTreatFetchErrorAsDeadLink(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("enotfound") ||
    message.includes("dns") ||
    message.includes("econnrefused") ||
    message.includes("connection refused") ||
    message.includes("fetch failed")
  ) && !message.includes("timeout");
}

export function createDeadLinkRecord(item, reason) {
  const record = {
    id: item.id,
    entityId: item.entityId,
    type: item.type,
    title: item.title,
    url: item.url,
    reason
  };

  if (item.type === "tab" && Number.isInteger(item.tabId)) {
    record.tabId = item.tabId;
  }

  return record;
}

export async function cleanupDeadLinkItems({
  items = [],
  removeBookmark,
  removeTab
}) {
  let cleaned = 0;
  let failed = 0;
  const cleanedIds = [];
  const failedIds = [];

  for (const item of items) {
    try {
      if (item.type === "bookmark") {
        await removeBookmark(String(item.entityId));
        cleaned += 1;
        cleanedIds.push(item.id);
        continue;
      }
      if (item.type === "tab") {
        await removeTab(item.tabId);
        cleaned += 1;
        cleanedIds.push(item.id);
      }
    } catch {
      failed += 1;
      failedIds.push(item.id);
    }
  }

  return { cleaned, failed, cleanedIds, failedIds };
}

export async function checkLinkHealth(url, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "follow"
    });
    return classifyDeadLinkResult(response);
  } catch (error) {
    if (shouldTreatFetchErrorAsDeadLink(error)) {
      const message = String(error?.message || "");
      if (message.toLowerCase().includes("enotfound") || message.toLowerCase().includes("dns")) {
        return { isDead: true, reason: "DNS failure" };
      }
      return { isDead: true, reason: "Connection failure" };
    }
    return { isDead: false, reason: "" };
  }
}

export async function scanDeadLinkItems({
  items = [],
  fetchImpl = fetch,
  onProgress = null,
  concurrency = 6
}) {
  const eligibleItems = items.filter((item) => /^https?:/i.test(item.url || ""));
  let processed = 0;
  const total = eligibleItems.length;
  const limit = Math.max(1, Math.min(Number.isFinite(concurrency) ? Math.floor(concurrency) : 6, total || 1));
  let nextIndex = 0;
  const foundResults = [];

  async function worker() {
    while (nextIndex < total) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const item = eligibleItems[currentIndex];
      const verdict = await checkLinkHealth(item.url, fetchImpl);
      processed += 1;

      if (verdict.isDead) {
        foundResults.push({
          index: currentIndex,
          record: createDeadLinkRecord(item, verdict.reason)
        });
      }

      if (typeof onProgress === "function") {
        const partialResults = foundResults
          .slice()
          .sort((left, right) => left.index - right.index)
          .map((entry) => entry.record);
        await onProgress({
          processed,
          total,
          itemId: item.id,
          title: item.title,
          type: item.type,
          results: partialResults
        });
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return foundResults
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.record);
}

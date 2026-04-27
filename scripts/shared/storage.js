import { DEFAULT_SETTINGS, SETTINGS_KEY, STATS_KEY } from "./constants.js";

function mergeSettings(stored = {}) {
  return {
    ui: {
      ...DEFAULT_SETTINGS.ui,
      ...(stored.ui || {})
    },
    ai: {
      ...DEFAULT_SETTINGS.ai,
      ...(stored.ai || {}),
      applyTo: {
        ...DEFAULT_SETTINGS.ai.applyTo,
        ...(stored.ai?.applyTo || {})
      },
      scopeSelection: {
        ...DEFAULT_SETTINGS.ai.scopeSelection,
        ...(stored.ai?.scopeSelection || {})
      }
    }
  };
}

export async function getSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return mergeSettings(result[SETTINGS_KEY]);
}

export async function saveSettings(nextSettings) {
  const merged = mergeSettings(nextSettings);
  await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
  return merged;
}

export async function getUsageStats() {
  const result = await chrome.storage.local.get(STATS_KEY);
  return {
    recentItems: [],
    openCounts: {},
    ...result[STATS_KEY]
  };
}

export async function recordUsage(item) {
  const stats = await getUsageStats();
  const key = `${item.type}:${item.entityId || item.id}`;
  const recentItems = [
    {
      key,
      type: item.type,
      title: item.title,
      url: item.url || "",
      openedAt: Date.now()
    },
    ...stats.recentItems.filter((entry) => entry.key !== key)
  ].slice(0, 30);
  const openCounts = {
    ...stats.openCounts,
    [key]: (stats.openCounts[key] || 0) + 1
  };
  await chrome.storage.local.set({
    [STATS_KEY]: {
      recentItems,
      openCounts
    }
  });
}

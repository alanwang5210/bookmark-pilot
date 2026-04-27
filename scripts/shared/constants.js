export const MESSAGE_TYPES = {
  SEARCH: "search",
  OPEN_ITEM: "open-item",
  CLOSE_TAB: "close-tab",
  GET_ZERO_STATE: "get-zero-state",
  GET_SETTINGS: "get-settings",
  GET_AI_SCOPE_SOURCE: "get-ai-scope-source",
  SAVE_SETTINGS: "save-settings",
  GET_INDEX_STATUS: "get-index-status",
  REBUILD_INDEX: "rebuild-index",
  REBUILD_AI: "rebuild-ai",
  GET_AI_PROGRESS: "get-ai-progress",
  STOP_AI_REBUILD: "stop-ai-rebuild",
  CLEAR_AI: "clear-ai",
  SCAN_DEAD_LINKS: "scan-dead-links",
  GET_DEAD_LINK_SCAN_PROGRESS: "get-dead-link-scan-progress",
  CLEAN_DEAD_LINKS: "clean-dead-links"
};

export const DEFAULT_SETTINGS = {
  ui: {
    defaultScope: "all",
    language: "auto",
    showRecents: true
  },
  ai: {
    enabled: false,
    provider: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4.1-mini",
    analysisMode: "metadata-only",
    applyTo: {
      bookmarks: true,
      tabs: true
    },
    scopeSelection: {
      bookmarkNodeIds: [],
      tabNodeIds: []
    }
  }
};

export const DB_NAME = "bookmark-pilot";
export const DB_VERSION = 1;
export const AI_STORE = "ai-tags";
export const STATS_KEY = "usage-stats";
export const SETTINGS_KEY = "settings";
export const AI_PROGRESS_KEY = "ai-progress";
export const DEAD_LINK_PROGRESS_KEY = "dead-link-progress";
export const MAX_OMNIBOX_RESULTS = 6;
export const MAX_POPUP_RESULTS = 20;
export const MAX_ZERO_STATE_RESULTS = 8;

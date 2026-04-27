import { MESSAGE_TYPES } from "../shared/constants.js";
import { getEffectiveLanguage, t } from "../shared/i18n.js";
import { escapeHtml } from "../shared/utils.js";

const elements = {
  input: document.getElementById("search-input"),
  results: document.getElementById("results"),
  latencyBadge: document.getElementById("latency-badge"),
  statusBar: document.getElementById("status-bar"),
  contextBar: document.getElementById("context-bar"),
  folderBack: document.getElementById("folder-back"),
  openOptions: document.getElementById("open-options"),
  scopeGroup: document.getElementById("scope-group"),
  shortcutOpen: document.getElementById("popup-shortcut-open"),
  shortcutNavigate: document.getElementById("popup-shortcut-navigate"),
  shortcutFolder: document.getElementById("popup-shortcut-folder"),
  signalsLabel: document.getElementById("popup-signals-label"),
  signalsCopy: document.getElementById("popup-signals-copy"),
  template: document.getElementById("result-template")
};

const state = {
  scope: "all",
  activeIndex: 0,
  results: [],
  folderStack: [],
  settings: null,
  language: "en"
};

bootstrap().catch(showError);

async function bootstrap() {
  bindEvents();
  const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_SETTINGS });
  if (!response.ok) {
    throw new Error(response.error);
  }

  state.settings = response.settings;
  state.language = getEffectiveLanguage(response.settings);
  applyTranslations();

  setScope(response.settings.ui.defaultScope);
  await performSearch("");
  elements.input.focus();
}

function bindEvents() {
  elements.input.addEventListener("input", () => {
    void performSearch(elements.input.value);
  });
  elements.input.addEventListener("keydown", handleInputKeydown);
  elements.folderBack.addEventListener("click", () => {
    state.folderStack.pop();
    updateFolderContext();
    void performSearch(elements.input.value);
  });
  elements.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());

  elements.scopeGroup.querySelectorAll(".scope-chip").forEach((button) => {
    button.addEventListener("click", () => {
      setScope(button.dataset.scope);
      void performSearch(elements.input.value);
    });
  });
}

function applyTranslations() {
  document.documentElement.lang = state.language === "zh-CN" ? "zh-CN" : "en";
  elements.openOptions.title = t(state.language, "settings");
  elements.openOptions.setAttribute("aria-label", t(state.language, "settings"));
  elements.folderBack.textContent = t(state.language, "popupBack");
  elements.folderBack.setAttribute("aria-label", t(state.language, "popupBack"));
  elements.input.placeholder = t(state.language, "popupSearchPlaceholder");
  elements.shortcutOpen.textContent = t(state.language, "popupShortcutOpen");
  elements.shortcutNavigate.textContent = t(state.language, "popupShortcutNavigate");
  elements.shortcutFolder.textContent = t(state.language, "popupShortcutFolder");
  elements.signalsLabel.textContent = t(state.language, "popupSignalsLabel");
  elements.signalsCopy.textContent = t(state.language, "popupSignalsCopy");

  elements.scopeGroup.querySelector('[data-scope="all"]').textContent = t(state.language, "all");
  elements.scopeGroup.querySelector('[data-scope="bookmarks"]').textContent = t(state.language, "bookmarks");
  elements.scopeGroup.querySelector('[data-scope="tabs"]').textContent = t(state.language, "tabs");
  elements.scopeGroup.querySelector('[data-scope="folders"]').textContent = t(state.language, "folders");
}

function setScope(scope) {
  state.scope = scope;
  elements.scopeGroup.querySelectorAll(".scope-chip").forEach((button) => {
    button.classList.toggle("active", button.dataset.scope === scope);
  });
}

async function performSearch(text) {
  if (!text.trim() && state.settings && !state.settings.ui.showRecents) {
    state.results = [];
    elements.latencyBadge.classList.add("hidden");
    elements.statusBar.classList.add("hidden");
    elements.results.innerHTML = `<div class="empty-state">${escapeHtml(t(state.language, "popupZeroStateDisabled"))}</div>`;
    return;
  }

  const folderId = state.folderStack.at(-1)?.id || "";
  const type = text.trim() ? MESSAGE_TYPES.SEARCH : MESSAGE_TYPES.GET_ZERO_STATE;
  const response = await chrome.runtime.sendMessage({
    type,
    text,
    scope: state.scope,
    folderId
  });

  if (!response.ok) {
    throw new Error(response.error);
  }

  state.results = response.items;
  state.activeIndex = 0;
  renderResults(response.items);
  renderStatus(response);
  updateFolderContext();
}

function renderStatus(response) {
  elements.latencyBadge.textContent = `${response.latencyMs} ms`;
  elements.latencyBadge.classList.remove("hidden");
  elements.statusBar.textContent = t(state.language, "popupStatusSummary", {
    bookmarks: response.sourceCounts.bookmarks,
    folders: response.sourceCounts.folders,
    tabs: response.sourceCounts.tabs
  });
  elements.statusBar.classList.remove("hidden");
}

function updateFolderContext() {
  const folder = state.folderStack.at(-1);
  if (!folder) {
    elements.contextBar.classList.add("hidden");
    elements.folderBack.classList.add("hidden");
    return;
  }

  elements.contextBar.innerHTML = `
    <div>${escapeHtml(t(state.language, "popupCurrentFolder", { title: folder.title }))}</div>
    <div>${escapeHtml(folder.path)}</div>
  `;
  elements.contextBar.classList.remove("hidden");
  elements.folderBack.classList.remove("hidden");
}

function renderResults(items) {
  elements.results.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = t(state.language, "popupEmptyResults");
    elements.results.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item, index) => {
    const node = elements.template.content.firstElementChild.cloneNode(true);
    const favicon = node.querySelector(".favicon-shell");
    const title = node.querySelector(".result-title");
    const badges = node.querySelector(".result-badges");
    const meta = node.querySelector(".result-meta");
    const path = node.querySelector(".result-path");
    const insight = node.querySelector(".result-insight");
    const insightLabel = node.querySelector(".result-insight-label");
    const reasons = node.querySelector(".result-reasons");
    const aiDetails = node.querySelector(".result-ai");
    const aiLabel = node.querySelector(".result-ai-label");
    const aiTags = node.querySelector(".result-ai-tags");
    const aiSummaryText = node.querySelector(".result-ai-summary");
    const actions = node.querySelector(".result-actions");

    node.dataset.id = item.id;
    node.dataset.type = item.type;
    node.classList.toggle("is-active", index === state.activeIndex);
    node.classList.toggle("is-best-match", index === 0);
    favicon.style.backgroundImage = item.faviconUrl ? `url("${item.faviconUrl}")` : "";
    title.textContent = item.title;
    aiLabel.textContent = t(state.language, "popupAiSummaryLabel");

    if (index === 0) {
      const best = document.createElement("span");
      best.className = "badge badge-best";
      best.textContent = t(state.language, "popupBestMatch");
      badges.appendChild(best);
    }

    item.sourceBadges.forEach((badge) => {
      const span = document.createElement("span");
      span.className = "badge";
      span.textContent = badge;
      badges.appendChild(span);
    });

    meta.textContent =
      item.domain ||
      item.url ||
      (item.type === "folder"
        ? t(state.language, "sourceFolder")
        : item.type === "tab"
          ? t(state.language, "sourceCurrentTab")
          : t(state.language, "sourceBookmark"));
    path.textContent = item.folderPath.length
      ? t(state.language, "popupPathLabel", { path: item.folderPath.join(" / ") })
      : item.type === "tab"
        ? t(state.language, "popupCurrentSessionTab")
        : t(state.language, "popupDirectBookmark");

    if (item.matchReasons.length) {
      insight.classList.remove("hidden");
      insightLabel.textContent = t(state.language, "popupReasonLabel");
    }

    item.matchReasons.slice(0, 2).forEach((reason) => {
      const span = document.createElement("span");
      span.className = "reason-chip";
      span.textContent = reason;
      reasons.appendChild(span);
    });

    if (item.aiTags.length || item.aiSummary) {
      aiDetails.classList.remove("hidden");
      aiSummaryText.textContent = item.aiSummary || "";
      aiSummaryText.classList.toggle("hidden", !item.aiSummary);
      item.aiTags.forEach((tag) => {
        const span = document.createElement("span");
        span.className = "tag-chip";
        span.textContent = tag;
        aiTags.appendChild(span);
      });
    }

    if (item.type === "folder" && item.childPreview?.length) {
      const preview = document.createElement("div");
      preview.className = "folder-preview";
      item.childPreview.forEach((entry) => {
        const span = document.createElement("span");
        span.className = "preview-chip";
        span.textContent = entry;
        preview.appendChild(span);
      });
      path.after(preview);
    }

    const primaryAction = document.createElement("button");
    primaryAction.type = "button";
    primaryAction.className = "result-action-primary";
    primaryAction.textContent =
      item.type === "folder"
        ? t(state.language, "popupEnterFolder")
        : item.type === "tab"
          ? t(state.language, "popupSwitchTab")
          : t(state.language, "popupOpen");
    primaryAction.addEventListener("click", (event) => {
      event.stopPropagation();
      void activateItem(item);
    });
    actions.appendChild(primaryAction);

    if (item.type === "tab" && item.tabId) {
      const closeAction = document.createElement("button");
      closeAction.type = "button";
      closeAction.className = "ghost-button danger-button result-action-secondary";
      closeAction.textContent = t(state.language, "popupCloseTab");
      closeAction.addEventListener("click", (event) => {
        event.stopPropagation();
        void closeTabItem(item);
      });
      actions.appendChild(closeAction);
    }

    if (item.url) {
      const copyAction = document.createElement("button");
      copyAction.type = "button";
      copyAction.className = "ghost-button result-action-secondary";
      copyAction.textContent = t(state.language, "popupCopyLink");
      copyAction.addEventListener("click", async (event) => {
        event.stopPropagation();
        await navigator.clipboard.writeText(item.url);
      });
      actions.appendChild(copyAction);
    }

    node.addEventListener("click", () => {
      state.activeIndex = index;
      refreshActiveCard();
    });
    node.addEventListener("dblclick", () => {
      void activateItem(item);
    });
    fragment.appendChild(node);
  });

  elements.results.appendChild(fragment);
}

function refreshActiveCard() {
  elements.results.querySelectorAll(".result-card").forEach((card, index) => {
    card.classList.toggle("is-active", index === state.activeIndex);
  });
}

async function activateItem(item) {
  if (item.type === "folder") {
    state.folderStack.push({
      id: item.entityId,
      title: item.title,
      path: [...item.folderPath, item.title].join(" / ")
    });
    updateFolderContext();
    await performSearch(elements.input.value);
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.OPEN_ITEM,
    id: item.id
  });
  if (!response.ok) {
    throw new Error(response.error);
  }
  window.close();
}

async function closeTabItem(item) {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.CLOSE_TAB,
    id: item.id
  });

  if (!response.ok) {
    throw new Error(response.error);
  }

  await performSearch(elements.input.value);
}

function handleInputKeydown(event) {
  if (!state.results.length) {
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.activeIndex = (state.activeIndex + 1) % state.results.length;
    refreshActiveCard();
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    state.activeIndex = (state.activeIndex - 1 + state.results.length) % state.results.length;
    refreshActiveCard();
  }
  if (event.key === "Enter") {
    event.preventDefault();
    void activateItem(state.results[state.activeIndex]);
  }
  if (event.key === "Backspace" && !elements.input.value && state.folderStack.length) {
    state.folderStack.pop();
    updateFolderContext();
    void performSearch("");
  }
}

function showError(error) {
  elements.results.innerHTML = `
    <div class="empty-state">
      ${escapeHtml(t(state.language, "popupError", { message: error instanceof Error ? error.message : String(error) }))}
    </div>
  `;
}

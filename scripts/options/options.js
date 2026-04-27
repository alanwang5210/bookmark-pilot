import { MESSAGE_TYPES } from "../shared/constants.js";
import { getEffectiveLanguage, t } from "../shared/i18n.js";
import {
  attachAiMetadataToScopeTree,
  buildBookmarkScopeTree,
  buildTabScopeTree,
  deriveNodeSelectionState,
  expandSelectionForNode,
  getDefaultScopeSelection,
  hasScopeSelection,
  resolveBookmarkScopeSelection,
  resolveTabScopeSelection,
  summarizeScopeSelection
} from "../shared/ai-scope.js";

const elements = {
  heading: document.getElementById("options-heading"),
  copy: document.getElementById("options-copy"),
  basicSectionTitle: document.getElementById("basic-section-title"),
  basicSectionCopy: document.getElementById("basic-section-copy"),
  showRecentsLabel: document.getElementById("show-recents-label"),
  showRecents: document.getElementById("show-recents"),
  defaultScopeLabel: document.getElementById("default-scope-label"),
  defaultScope: document.getElementById("default-scope"),
  languageLabel: document.getElementById("language-label"),
  languageSelect: document.getElementById("language-select"),
  omniboxLabel: document.getElementById("omnibox-label"),
  omniboxHint: document.getElementById("omnibox-hint"),
  aiSectionTitle: document.getElementById("ai-section-title"),
  aiSectionCopy: document.getElementById("ai-section-copy"),
  aiReadinessTitle: document.getElementById("ai-readiness-title"),
  aiReadinessBadge: document.getElementById("ai-readiness-badge"),
  aiReadinessText: document.getElementById("ai-readiness-text"),
  aiEnableLabel: document.getElementById("ai-enable-label"),
  aiEnabled: document.getElementById("ai-enabled"),
  providerLabel: document.getElementById("provider-label"),
  aiProvider: document.getElementById("ai-provider"),
  baseUrlLabel: document.getElementById("base-url-label"),
  aiBaseUrl: document.getElementById("ai-base-url"),
  apiKeyLabel: document.getElementById("api-key-label"),
  aiApiKey: document.getElementById("ai-api-key"),
  modelLabel: document.getElementById("model-label"),
  aiModel: document.getElementById("ai-model"),
  analysisModeLabel: document.getElementById("analysis-mode-label"),
  aiAnalysisMode: document.getElementById("ai-analysis-mode"),
  scopeSectionTitle: document.getElementById("scope-section-title"),
  scopeSectionCopy: document.getElementById("scope-section-copy"),
  scopeSummary: document.getElementById("scope-summary"),
  scopeReviewHint: document.getElementById("scope-review-hint"),
  toggleScopeReview: document.getElementById("toggle-scope-review"),
  scopePanel: document.getElementById("scope-panel"),
  scopeBookmarksTitle: document.getElementById("scope-bookmarks-title"),
  bookmarkScopeTree: document.getElementById("bookmark-scope-tree"),
  scopeTabsTitle: document.getElementById("scope-tabs-title"),
  tabScopeTree: document.getElementById("tab-scope-tree"),
  saveSettings: document.getElementById("save-settings"),
  requestEnhanced: document.getElementById("request-enhanced"),
  privacySectionTitle: document.getElementById("privacy-section-title"),
  privacySectionCopy: document.getElementById("privacy-section-copy"),
  privacyNote: document.getElementById("privacy-note"),
  actionFeedback: document.getElementById("action-feedback"),
  aiProgressPanel: document.getElementById("ai-progress-panel"),
  aiProgressLabel: document.getElementById("ai-progress-label"),
  aiProgressCount: document.getElementById("ai-progress-count"),
  aiProgressFill: document.getElementById("ai-progress-fill"),
  aiProgressMessage: document.getElementById("ai-progress-message"),
  stopAi: document.getElementById("stop-ai"),
  indexStatus: document.getElementById("index-status"),
  rebuildAi: document.getElementById("rebuild-ai"),
  rebuildIndex: document.getElementById("rebuild-index"),
  clearAi: document.getElementById("clear-ai"),
  deadLinksSectionTitle: document.getElementById("dead-links-section-title"),
  deadLinksSectionCopy: document.getElementById("dead-links-section-copy"),
  scanDeadLinks: document.getElementById("scan-dead-links"),
  deadLinksProgressPanel: document.getElementById("dead-links-progress-panel"),
  deadLinksProgressLabel: document.getElementById("dead-links-progress-label"),
  deadLinksProgressCount: document.getElementById("dead-links-progress-count"),
  deadLinksProgressFill: document.getElementById("dead-links-progress-fill"),
  deadLinksProgressMessage: document.getElementById("dead-links-progress-message"),
  deadLinksResultsPanel: document.getElementById("dead-links-results-panel"),
  deadLinksSelectAll: document.getElementById("dead-links-select-all"),
  deadLinksSelectAllLabel: document.getElementById("dead-links-select-all-label"),
  deadLinksSummary: document.getElementById("dead-links-summary"),
  deadLinksResults: document.getElementById("dead-links-results"),
  cleanDeadLinks: document.getElementById("clean-dead-links")
};

let aiProgressTimer = null;
let deadLinkProgressTimer = null;
let currentSettings = null;
let currentStatus = null;
let currentLanguage = "en";
let currentScopeSource = { folders: [], bookmarks: [], tabs: [], aiRecords: [] };
let currentSavedScopeSelection = { bookmarkNodeIds: [], tabNodeIds: [] };
let draftScopeSelection = { bookmarkNodeIds: [], tabNodeIds: [] };
let bookmarkScopeTree = [];
let tabScopeTree = [];
let currentDeadLinkProgress = null;
let deadLinkSelectionSignature = "";
const selectedDeadLinkIds = new Set();
const expandedScopeNodes = {
  bookmarks: new Set(),
  tabs: new Set()
};

bootstrap().catch(showFeedback);

async function bootstrap() {
  bindEvents();
  await refreshPage();
}

function bindEvents() {
  elements.saveSettings.addEventListener("click", () => void runSafely(saveSettings));
  elements.requestEnhanced.addEventListener("click", () => void runSafely(requestEnhancedPermissions));
  elements.rebuildIndex.addEventListener("click", () => void runSafely(() => runAction(MESSAGE_TYPES.REBUILD_INDEX, t(currentLanguage, "feedbackProcessing"), t(currentLanguage, "feedbackIndexRebuilt"))));
  elements.rebuildAi.addEventListener("click", () => void runSafely(rebuildAiWithProgress));
  elements.stopAi.addEventListener("click", () => void runSafely(stopAiRebuild));
  elements.clearAi.addEventListener("click", () => void runSafely(() => runAction(MESSAGE_TYPES.CLEAR_AI, t(currentLanguage, "feedbackProcessing"), t(currentLanguage, "feedbackAiCleared"))));
  elements.scanDeadLinks.addEventListener("click", () => void runSafely(scanDeadLinksWithProgress));
  elements.cleanDeadLinks.addEventListener("click", () => void runSafely(cleanSelectedDeadLinks));
  elements.deadLinksSelectAll.addEventListener("change", handleToggleAllDeadLinks);
  elements.toggleScopeReview.addEventListener("click", () => {
    elements.scopePanel.classList.toggle("hidden");
  });

  [
    elements.aiEnabled,
    elements.aiBaseUrl,
    elements.aiApiKey,
    elements.aiModel,
    elements.languageSelect,
    elements.showRecents,
    elements.aiAnalysisMode
  ].forEach((control) => {
    control.addEventListener("input", renderDraftUi);
    control.addEventListener("change", renderDraftUi);
  });

  elements.defaultScope.addEventListener("input", renderDraftUi);
  elements.defaultScope.addEventListener("change", renderDraftUi);
  elements.languageSelect.addEventListener("change", () => void runSafely(saveLanguagePreference));
}

async function runSafely(task) {
  try {
    await task();
  } catch (error) {
    showFeedback(error);
  }
}

async function refreshPage() {
  const [settingsResponse, scopeResponse, progressResponse, deadLinkResponse] = await Promise.all([
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_SETTINGS }),
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_AI_SCOPE_SOURCE }),
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_AI_PROGRESS }),
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_DEAD_LINK_SCAN_PROGRESS })
  ]);

  if (!settingsResponse.ok) {
    throw new Error(settingsResponse.error);
  }

  currentSettings = settingsResponse.settings;
  currentStatus = settingsResponse.status;
  currentScopeSource = scopeResponse?.ok
    ? scopeResponse.source
    : { folders: [], bookmarks: [], tabs: [], aiRecords: [] };
  if (!hasUsableScopeSource(currentScopeSource)) {
    currentScopeSource = await loadScopeSourceFallback();
  }
  currentSavedScopeSelection = getEffectiveSavedScopeSelection(currentSettings);
  draftScopeSelection = cloneScopeSelection(currentSavedScopeSelection);
  currentLanguage = getEffectiveLanguage(currentSettings);
  hydrateForm(currentSettings);
  rebuildScopeTrees();
  applyTranslations();
  renderStatus(currentStatus);
  renderAiReadiness(collectSettingsFromForm());
  renderScopeSection();

  if (progressResponse.ok) {
    renderAiProgress(progressResponse.progress);
    if (progressResponse.progress.running) {
      startAiProgressPolling();
    }
  }

  if (deadLinkResponse.ok) {
    renderDeadLinkState(deadLinkResponse.progress);
    if (deadLinkResponse.progress.running) {
      startDeadLinkProgressPolling();
    }
  }
}

function rebuildScopeTrees() {
  bookmarkScopeTree = attachAiMetadataToScopeTree(
    buildBookmarkScopeTree({
      folders: currentScopeSource.folders,
      bookmarks: currentScopeSource.bookmarks
    }),
    currentScopeSource.aiRecords
  );
  tabScopeTree = attachAiMetadataToScopeTree(
    buildTabScopeTree({
      tabs: currentScopeSource.tabs
    }),
    currentScopeSource.aiRecords
  );
}

function hasUsableScopeSource(source) {
  return Boolean(source && (source.folders?.length || source.bookmarks?.length || source.tabs?.length));
}

async function loadScopeSourceFallback() {
  const [bookmarkTree, tabs] = await Promise.all([
    chrome.bookmarks.getTree(),
    chrome.tabs.query({})
  ]);

  const flattened = flattenBookmarkTreeForScope(bookmarkTree);
  return {
    folders: flattened.folders,
    bookmarks: flattened.bookmarks,
    tabs: tabs.filter((tab) => tab.url && !tab.url.startsWith("chrome://")),
    aiRecords: []
  };
}

function flattenBookmarkTreeForScope(tree) {
  const bookmarks = [];
  const folders = [];

  function visit(node, path = []) {
    if (node.url) {
      bookmarks.push({
        id: node.id,
        parentId: node.parentId || "",
        title: node.title,
        url: node.url,
        folderPath: path
      });
      return;
    }

    if (node.id !== "0") {
      folders.push({
        id: node.id,
        parentId: node.parentId || "",
        title: node.title || "",
        folderPath: path
      });
    }

    for (const child of node.children || []) {
      const childPath = node.id === "0" ? path : [...path, node.title || ""].filter(Boolean);
      visit(child, childPath);
    }
  }

  for (const rootNode of tree) {
    visit(rootNode, []);
  }

  return { folders, bookmarks };
}

function hydrateForm(settings) {
  elements.showRecents.checked = settings.ui.showRecents;
  elements.defaultScope.value = settings.ui.defaultScope;
  elements.languageSelect.value = settings.ui.language;
  elements.aiEnabled.checked = settings.ai.enabled;
  elements.aiProvider.value = settings.ai.provider;
  elements.aiBaseUrl.value = settings.ai.baseUrl;
  elements.aiApiKey.value = settings.ai.apiKey;
  elements.aiModel.value = settings.ai.model;
  elements.aiAnalysisMode.value = settings.ai.analysisMode;
}

function collectSettingsFromForm() {
  return {
    ui: {
      showRecents: elements.showRecents.checked,
      defaultScope: elements.defaultScope.value,
      language: elements.languageSelect.value
    },
    ai: {
      enabled: elements.aiEnabled.checked,
      provider: elements.aiProvider.value,
      baseUrl: elements.aiBaseUrl.value.trim(),
      apiKey: elements.aiApiKey.value.trim(),
      model: elements.aiModel.value.trim(),
      analysisMode: elements.aiAnalysisMode.value,
      applyTo: currentSettings?.ai?.applyTo || { bookmarks: true, tabs: true },
      scopeSelection: cloneScopeSelection(draftScopeSelection)
    }
  };
}

function getDraftLanguage() {
  return getEffectiveLanguage({ ui: { language: elements.languageSelect.value } });
}

function getEffectiveSavedScopeSelection(settings) {
  const explicit = normalizeScopeSelection(settings.ai.scopeSelection);
  if (hasScopeSelection(explicit)) {
    return explicit;
  }

  return getDefaultScopeSelection({
    folders: currentScopeSource.folders,
    bookmarks: currentScopeSource.bookmarks,
    tabs: currentScopeSource.tabs
  });
}

function normalizeScopeSelection(selection = {}) {
  return {
    bookmarkNodeIds: [...new Set((selection.bookmarkNodeIds || []).map((id) => String(id)))].sort((left, right) => left.localeCompare(right, "en")),
    tabNodeIds: [...new Set((selection.tabNodeIds || []).map((id) => String(id)))].sort((left, right) => left.localeCompare(right, "en"))
  };
}

function cloneScopeSelection(selection) {
  const normalized = normalizeScopeSelection(selection);
  return {
    bookmarkNodeIds: [...normalized.bookmarkNodeIds],
    tabNodeIds: [...normalized.tabNodeIds]
  };
}

function areScopeSelectionsEqual(left, right) {
  const a = normalizeScopeSelection(left);
  const b = normalizeScopeSelection(right);
  return JSON.stringify(a) === JSON.stringify(b);
}

function getScopeSummary(selection = draftScopeSelection) {
  const bookmarkResolution = resolveBookmarkScopeSelection({
    folders: currentScopeSource.folders,
    bookmarks: currentScopeSource.bookmarks,
    selectedNodeIds: selection.bookmarkNodeIds
  });
  const tabResolution = resolveTabScopeSelection({
    tabs: currentScopeSource.tabs,
    selectedNodeIds: selection.tabNodeIds
  });

  return {
    bookmarkResolution,
    tabResolution,
    summary: summarizeScopeSelection({ bookmarkResolution, tabResolution })
  };
}

function renderScopeSection() {
  const draftSummary = getScopeSummary(draftScopeSelection).summary;
  const hasUnsavedScope = !areScopeSelectionsEqual(draftScopeSelection, currentSavedScopeSelection);

  elements.scopeSummary.textContent = t(currentLanguage, "optionsScopeSummary", draftSummary);
  elements.scopeReviewHint.textContent = draftSummary.isEmpty
    ? t(currentLanguage, "optionsScopeEmpty")
    : hasUnsavedScope
      ? t(currentLanguage, "optionsScopeUnsaved")
      : t(currentLanguage, "optionsScopeReviewHint");

  renderScopeTree(elements.bookmarkScopeTree, bookmarkScopeTree, "bookmarks");
  renderScopeTree(elements.tabScopeTree, tabScopeTree, "tabs");
}

function renderScopeTree(container, nodes, treeType) {
  container.innerHTML = "";

  if (!nodes.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = t(currentLanguage, "optionsScopeEmpty");
    container.appendChild(empty);
    return;
  }

  const selectedSet = new Set(draftScopeSelection[treeType === "bookmarks" ? "bookmarkNodeIds" : "tabNodeIds"]);
  const fragment = document.createDocumentFragment();
  nodes.forEach((node) => fragment.appendChild(renderScopeNode(node, treeType, selectedSet)));
  container.appendChild(fragment);
}

function renderScopeNode(node, treeType, selectedSet, inheritedSelection = false) {
  const wrapper = document.createElement("div");
  wrapper.className = "scope-node";
  const state = deriveNodeSelectionState(node, selectedSet, inheritedSelection);
  if (state.partial) {
    wrapper.classList.add("partial");
  }

  const row = document.createElement("div");
  row.className = "scope-node-row";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "scope-toggle ghost-button";
  toggle.textContent = node.children?.length ? (expandedScopeNodes[treeType].has(node.id) ? "-" : "+") : "";
  toggle.disabled = !node.children?.length;
  toggle.addEventListener("click", () => {
    if (!node.children?.length) {
      return;
    }
    if (expandedScopeNodes[treeType].has(node.id)) {
      expandedScopeNodes[treeType].delete(node.id);
    } else {
      expandedScopeNodes[treeType].add(node.id);
    }
    renderScopeSection();
  });

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "scope-checkbox";
  checkbox.checked = state.checked;
  checkbox.indeterminate = state.partial;
  checkbox.addEventListener("change", () => {
    updateDraftScope(treeType, node.id, checkbox.checked);
  });

  const content = document.createElement("div");
  content.className = "scope-node-content";

  const title = document.createElement("div");
  title.className = "scope-node-title";
  title.textContent = node.title || (node.type === "window" ? "Window" : t(currentLanguage, "bgUnnamed"));
  content.appendChild(title);

  if (node.children?.length && node.analyzedLeafCount > 0) {
    const aggregate = document.createElement("p");
    aggregate.className = "scope-node-aggregate";
    aggregate.textContent = t(currentLanguage, "optionsScopeAnalyzedLeaves", { count: node.analyzedLeafCount });
    content.appendChild(aggregate);
  }

  if (node.aiSummary) {
    wrapper.classList.add("has-ai");
    const aiSummary = document.createElement("p");
    aiSummary.className = "scope-node-ai-summary";
    aiSummary.textContent = node.aiSummary;
    aiSummary.title = node.aiSummary;
    content.appendChild(aiSummary);
  }

  if (node.aiTags?.length) {
    wrapper.classList.add("has-ai");
    const aiTags = document.createElement("div");
    aiTags.className = "scope-node-ai-tags";
    node.aiTags.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "scope-node-tag";
      chip.textContent = tag;
      aiTags.appendChild(chip);
    });
    content.appendChild(aiTags);
  }

  if (node.type === "bookmark" && node.url) {
    const meta = document.createElement("span");
    meta.className = "scope-node-meta";
    meta.textContent = node.url;
    content.appendChild(meta);
  }

  row.append(toggle, checkbox, content);

  wrapper.appendChild(row);

  if (node.children?.length && expandedScopeNodes[treeType].has(node.id)) {
    const children = document.createElement("div");
    children.className = "scope-node-children";
    const childInheritedSelection = inheritedSelection || selectedSet.has(node.id);
    node.children.forEach((child) => children.appendChild(renderScopeNode(child, treeType, selectedSet, childInheritedSelection)));
    wrapper.appendChild(children);
  }

  return wrapper;
}

function updateDraftScope(treeType, nodeId, nextChecked) {
  const key = treeType === "bookmarks" ? "bookmarkNodeIds" : "tabNodeIds";
  const roots = treeType === "bookmarks" ? bookmarkScopeTree : tabScopeTree;
  const selectedSet = new Set(draftScopeSelection[key]);
  applySelectionChange(roots, selectedSet, nodeId, nextChecked);
  draftScopeSelection[key] = [...selectedSet].sort((left, right) => left.localeCompare(right, "en"));
  renderDraftUi();
}

function applySelectionChange(roots, selectedSet, nodeId, nextChecked) {
  const path = findNodePath(roots, nodeId);
  if (!path.length) {
    return;
  }

  const node = path[path.length - 1];

  if (nextChecked) {
    if (path.slice(0, -1).some((ancestor) => selectedSet.has(ancestor.id))) {
      return;
    }

    for (const descendantId of expandSelectionForNode(node)) {
      selectedSet.delete(descendantId);
    }
    selectedSet.add(node.id);
    return;
  }

  for (const descendantId of expandSelectionForNode(node)) {
    selectedSet.delete(descendantId);
  }

  if (selectedSet.has(node.id)) {
    selectedSet.delete(node.id);
    return;
  }

  const selectedAncestor = [...path.slice(0, -1)].reverse().find((ancestor) => selectedSet.has(ancestor.id));
  if (!selectedAncestor) {
    return;
  }

  selectedSet.delete(selectedAncestor.id);
  const remainingPath = path.slice(path.findIndex((entry) => entry.id === selectedAncestor.id) + 1).map((entry) => entry.id);
  preserveSelectionExcludingNode(selectedAncestor, remainingPath, selectedSet);
}

function preserveSelectionExcludingNode(node, pathIds, selectedSet) {
  const [nextId, ...restPath] = pathIds;
  for (const child of node.children || []) {
    if (child.id !== nextId) {
      selectedSet.add(child.id);
      continue;
    }
    if (restPath.length) {
      preserveSelectionExcludingNode(child, restPath, selectedSet);
    }
  }
}

function findNodePath(nodes, targetId, trail = []) {
  for (const node of nodes) {
    const nextTrail = [...trail, node];
    if (node.id === targetId) {
      return nextTrail;
    }
    if (node.children?.length) {
      const nested = findNodePath(node.children, targetId, nextTrail);
      if (nested.length) {
        return nested;
      }
    }
  }
  return [];
}

function applyTranslations() {
  document.documentElement.lang = currentLanguage === "zh-CN" ? "zh-CN" : "en";
  document.title = `Bookmark Pilot ${currentLanguage === "zh-CN" ? "设置" : "Settings"}`;
  elements.heading.textContent = t(currentLanguage, "optionsHeading");
  elements.copy.textContent = t(currentLanguage, "optionsCopy");
  elements.basicSectionTitle.textContent = t(currentLanguage, "optionsBasic");
  elements.basicSectionCopy.textContent = t(currentLanguage, "optionsBasicCopy");
  elements.showRecentsLabel.textContent = t(currentLanguage, "optionsShowRecents");
  elements.defaultScopeLabel.textContent = t(currentLanguage, "optionsDefaultScope");
  elements.defaultScope.querySelector('[value="all"]').textContent = t(currentLanguage, "all");
  elements.defaultScope.querySelector('[value="bookmarks"]').textContent = t(currentLanguage, "bookmarks");
  elements.defaultScope.querySelector('[value="tabs"]').textContent = t(currentLanguage, "tabs");
  elements.defaultScope.querySelector('[value="folders"]').textContent = t(currentLanguage, "folders");
  elements.languageLabel.textContent = t(currentLanguage, "optionsLanguage");
  elements.languageSelect.querySelector('[value="auto"]').textContent = t(currentLanguage, "optionsLanguageAuto");
  elements.languageSelect.querySelector('[value="zh-CN"]').textContent = t(currentLanguage, "optionsLanguageZh");
  elements.languageSelect.querySelector('[value="en"]').textContent = t(currentLanguage, "optionsLanguageEn");
  elements.omniboxLabel.textContent = t(currentLanguage, "optionsOmniboxKeyword");
  elements.omniboxHint.textContent = t(currentLanguage, "optionsOmniboxHint");
  elements.aiSectionTitle.textContent = t(currentLanguage, "optionsAiSection");
  elements.aiSectionCopy.textContent = t(currentLanguage, "optionsAiCopy");
  elements.aiReadinessTitle.textContent = t(currentLanguage, "optionsAiReadinessTitle");
  elements.aiEnableLabel.textContent = t(currentLanguage, "optionsAiEnable");
  elements.providerLabel.textContent = t(currentLanguage, "optionsProvider");
  elements.baseUrlLabel.textContent = t(currentLanguage, "optionsApiBaseUrl");
  elements.apiKeyLabel.textContent = t(currentLanguage, "optionsApiKey");
  elements.modelLabel.textContent = t(currentLanguage, "optionsModel");
  elements.analysisModeLabel.textContent = t(currentLanguage, "optionsAnalysisMode");
  elements.aiAnalysisMode.querySelector('[value="metadata-only"]').textContent = t(currentLanguage, "optionsAnalysisMetadata");
  elements.aiAnalysisMode.querySelector('[value="enhanced"]').textContent = t(currentLanguage, "optionsAnalysisEnhanced");
  elements.scopeSectionTitle.textContent = t(currentLanguage, "optionsScopeSection");
  elements.scopeSectionCopy.textContent = t(currentLanguage, "optionsScopeCopy");
  elements.toggleScopeReview.textContent = t(currentLanguage, "optionsScopeAdjust");
  elements.scopeBookmarksTitle.textContent = t(currentLanguage, "optionsScopeBookmarks");
  elements.scopeTabsTitle.textContent = t(currentLanguage, "optionsScopeTabs");
  elements.saveSettings.textContent = t(currentLanguage, "saveSettings");
  elements.requestEnhanced.textContent = t(currentLanguage, "requestEnhanced");
  elements.privacySectionTitle.textContent = t(currentLanguage, "optionsIndexPrivacy");
  elements.privacySectionCopy.textContent = t(currentLanguage, "optionsPrivacyCopy");
  elements.privacyNote.textContent = t(currentLanguage, "optionsPrivacyNote");
  elements.deadLinksSectionTitle.textContent = t(currentLanguage, "deadLinksSectionTitle");
  elements.deadLinksSectionCopy.textContent = t(currentLanguage, "deadLinksSectionCopy");
  elements.scanDeadLinks.textContent = t(currentLanguage, "deadLinksScanAction");
  elements.deadLinksSelectAllLabel.textContent = t(currentLanguage, "deadLinksSelectAll");
  elements.cleanDeadLinks.textContent = t(currentLanguage, "deadLinksCleanupAction");
  elements.stopAi.textContent = t(currentLanguage, "stopAi");
  elements.rebuildAi.textContent = t(currentLanguage, "rebuildAi");
  elements.rebuildIndex.textContent = t(currentLanguage, "rebuildIndex");
  elements.clearAi.textContent = t(currentLanguage, "clearAi");
}

function getAiReadiness(settings) {
  if (!settings.ai.enabled) {
    return { ready: false, message: t(currentLanguage, "optionsAiReadyOff") };
  }
  if (!settings.ai.baseUrl) {
    return { ready: false, message: t(currentLanguage, "optionsAiReadyNeedBaseUrl") };
  }
  if (!settings.ai.apiKey) {
    return { ready: false, message: t(currentLanguage, "optionsAiReadyNeedApiKey") };
  }
  return { ready: true, message: t(currentLanguage, "optionsAiReadyOkay") };
}

function renderAiReadiness(settings) {
  const readiness = getAiReadiness(settings);
  const scopeSummary = getScopeSummary().summary;
  const label = readiness.ready ? t(currentLanguage, "optionsAiReady") : t(currentLanguage, "optionsAiNotReady");
  elements.aiReadinessBadge.textContent = label;
  elements.aiReadinessBadge.classList.toggle("ready", readiness.ready);
  elements.aiReadinessText.textContent = readiness.ready && scopeSummary.isEmpty
    ? t(currentLanguage, "optionsScopeEmpty")
    : readiness.message;
  elements.rebuildAi.disabled = !readiness.ready || scopeSummary.isEmpty;
}

function renderDraftUi() {
  currentLanguage = getDraftLanguage();
  applyTranslations();
  renderScopeSection();
  renderAiReadiness(collectSettingsFromForm());
  renderDeadLinkState(currentDeadLinkProgress);
}

async function persistSettings(settings, { successMessage = t(currentLanguage, "feedbackSettingsSaved") } = {}) {
  currentLanguage = getEffectiveLanguage(settings);
  applyTranslations();

  if (settings.ai.enabled) {
    await ensureAiHostPermission(settings.ai.baseUrl);
  }

  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.SAVE_SETTINGS,
    settings
  });
  if (!response.ok) {
    throw new Error(response.error);
  }

  currentSettings = response.settings;
  currentSavedScopeSelection = getEffectiveSavedScopeSelection(currentSettings);
  draftScopeSelection = cloneScopeSelection(currentSavedScopeSelection);
  showFeedback(successMessage);
  await refreshPage();
}

async function saveSettings() {
  await persistSettings(collectSettingsFromForm());
}

async function saveLanguagePreference() {
  if (!currentSettings) {
    return;
  }

  const nextLanguage = elements.languageSelect.value;
  if (nextLanguage === currentSettings.ui.language) {
    currentLanguage = getEffectiveLanguage({ ui: { language: nextLanguage } });
    applyTranslations();
    renderScopeSection();
    renderAiReadiness(collectSettingsFromForm());
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.SAVE_SETTINGS,
    settings: {
      ...currentSettings,
      ui: {
        ...currentSettings.ui,
        language: nextLanguage
      }
    }
  });
  if (!response.ok) {
    throw new Error(response.error);
  }

  currentSettings = response.settings;
  currentLanguage = getEffectiveLanguage(currentSettings);
  applyTranslations();
  renderStatus(currentStatus);
  renderScopeSection();
  renderAiReadiness(collectSettingsFromForm());
  renderDeadLinkState(currentDeadLinkProgress);
  showFeedback(t(currentLanguage, "feedbackSettingsSaved"));
}

async function requestEnhancedPermissions() {
  const granted = await chrome.permissions.request({
    permissions: ["scripting"],
    origins: ["http://*/*", "https://*/*"]
  });
  showFeedback(granted ? t(currentLanguage, "feedbackPermissionGranted") : t(currentLanguage, "feedbackPermissionDenied"));
}

async function runAction(type, pendingMessage, successMessage) {
  showFeedback(pendingMessage);
  const response = await chrome.runtime.sendMessage({ type });
  if (!response.ok) {
    throw new Error(response.error);
  }
  if (response.status) {
    currentStatus = response.status;
    renderStatus(response.status);
  }
  showFeedback(successMessage);
}

async function rebuildAiWithProgress() {
  const draftSettings = collectSettingsFromForm();
  currentLanguage = getEffectiveLanguage(draftSettings);
  applyTranslations();
  renderScopeSection();
  renderAiReadiness(draftSettings);

  const readiness = getAiReadiness(draftSettings);
  const draftSummary = getScopeSummary(draftScopeSelection).summary;

  if (!readiness.ready) {
    showFeedback(readiness.message);
    return;
  }
  if (draftSummary.isEmpty) {
    showFeedback(t(currentLanguage, "optionsScopeEmpty"));
    return;
  }

  const needsSave =
    JSON.stringify(currentSettings?.ai || {}) !== JSON.stringify(draftSettings.ai) ||
    currentSettings?.ui?.language !== draftSettings.ui.language;

  if (needsSave) {
    await persistSettings(draftSettings, { successMessage: t(currentLanguage, "optionsScopeSavingAndRunning") });
  } else if (!areScopeSelectionsEqual(draftScopeSelection, currentSavedScopeSelection)) {
    await persistSettings(draftSettings, { successMessage: t(currentLanguage, "optionsScopeSavingAndRunning") });
  }

  await ensureAiHostPermission(draftSettings.ai.baseUrl);
  showFeedback(t(currentLanguage, "feedbackAiStarting"));
  const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REBUILD_AI });
  if (!response.ok) {
    throw new Error(response.error);
  }
  renderAiProgress(response.progress);
  startAiProgressPolling();
}

async function stopAiRebuild() {
  const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.STOP_AI_REBUILD });
  if (!response.ok) {
    throw new Error(response.error);
  }
  renderAiProgress(response.progress);
  showFeedback(t(currentLanguage, "feedbackAiStopped"));
}

function startAiProgressPolling() {
  stopAiProgressPolling();
  aiProgressTimer = window.setInterval(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_AI_PROGRESS });
      if (!response.ok) {
        throw new Error(response.error);
      }
      renderAiProgress(response.progress);
      if (!response.progress.running) {
        stopAiProgressPolling();
        await refreshPage();
        if (response.progress.error) {
          showFeedback(t(currentLanguage, "feedbackAiTaskFailed", { message: response.progress.error }));
        } else if (response.progress.message === t(currentLanguage, "bgAiStopped")) {
          showFeedback(t(currentLanguage, "feedbackAiStopped"));
        } else if (response.progress.completedAt) {
          showFeedback(t(currentLanguage, "feedbackAiRefreshed"));
        }
      }
    } catch (error) {
      stopAiProgressPolling();
      showFeedback(error);
    }
  }, 500);
}

function stopAiProgressPolling() {
  if (aiProgressTimer) {
    window.clearInterval(aiProgressTimer);
    aiProgressTimer = null;
  }
}

function renderAiProgress(progress) {
  const total = progress.total || 0;
  const processed = progress.processed || 0;
  const percent = Math.max(0, Math.min(100, progress.percent || 0));
  const shouldShow = progress.running || total > 0 || Boolean(progress.completedAt) || Boolean(progress.error);

  elements.aiProgressPanel.classList.toggle("hidden", !shouldShow);
  elements.aiProgressFill.style.width = `${percent}%`;
  elements.aiProgressCount.textContent = `${processed} / ${total}`;
  elements.aiProgressLabel.textContent = progress.running
    ? t(currentLanguage, "optionsProgressRunning")
    : progress.error
      ? t(currentLanguage, "optionsProgressFailed")
      : progress.message === t(currentLanguage, "bgAiStopped")
        ? t(currentLanguage, "optionsProgressStopped")
        : t(currentLanguage, "optionsProgressDone");

  const scopeText = progress.scopeSummary ? t(currentLanguage, "optionsScopeSummary", progress.scopeSummary) : "";
  elements.aiProgressMessage.textContent = [scopeText, progress.error || progress.message || t(currentLanguage, "optionsProgressPreparing")]
    .filter(Boolean)
    .join(" | ");
  elements.stopAi.classList.toggle("hidden", !progress.running);

  if (progress.running) {
    elements.rebuildAi.disabled = true;
  } else {
    renderAiReadiness(currentSettings || collectSettingsFromForm());
  }
}

async function scanDeadLinksWithProgress() {
  await ensureDeadLinkHostPermissions();
  showFeedback(t(currentLanguage, "feedbackDeadLinksScanning"));
  const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SCAN_DEAD_LINKS });
  if (!response.ok) {
    throw new Error(response.error);
  }
  deadLinkSelectionSignature = "";
  selectedDeadLinkIds.clear();
  renderDeadLinkState(response.progress);
  startDeadLinkProgressPolling();
}

function startDeadLinkProgressPolling() {
  stopDeadLinkProgressPolling();
  deadLinkProgressTimer = window.setInterval(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_DEAD_LINK_SCAN_PROGRESS });
      if (!response.ok) {
        throw new Error(response.error);
      }
      renderDeadLinkState(response.progress);
      if (!response.progress.running) {
        stopDeadLinkProgressPolling();
        await refreshPage();
        if (response.progress.error) {
          showFeedback(t(currentLanguage, "feedbackDeadLinksFailed", { message: response.progress.error }));
        } else if (response.progress.completedAt) {
          showFeedback(
            response.progress.results?.length
              ? t(currentLanguage, "feedbackDeadLinksReady", { count: response.progress.results.length })
              : t(currentLanguage, "feedbackDeadLinksEmpty")
          );
        }
      }
    } catch (error) {
      stopDeadLinkProgressPolling();
      showFeedback(error);
    }
  }, 250);
}

function stopDeadLinkProgressPolling() {
  if (deadLinkProgressTimer) {
    window.clearInterval(deadLinkProgressTimer);
    deadLinkProgressTimer = null;
  }
}

function renderDeadLinkState(progress) {
  currentDeadLinkProgress = progress || null;
  renderDeadLinkProgress(progress);
  renderDeadLinkResults(progress);
}

function renderDeadLinkProgress(progress = {}) {
  const total = progress.total || 0;
  const processed = progress.processed || 0;
  const percent = Math.max(0, Math.min(100, progress.percent || 0));
  const shouldShow = progress.running || total > 0 || Boolean(progress.completedAt) || Boolean(progress.error);

  elements.deadLinksProgressPanel.classList.toggle("hidden", !shouldShow);
  elements.deadLinksProgressFill.style.width = `${percent}%`;
  elements.deadLinksProgressCount.textContent = `${processed} / ${total}`;

  if (progress.running) {
    elements.deadLinksProgressLabel.textContent = t(currentLanguage, "deadLinksProgressRunning");
  } else if (progress.error) {
    elements.deadLinksProgressLabel.textContent = t(currentLanguage, "deadLinksProgressFailed");
  } else if (progress.completedAt) {
    elements.deadLinksProgressLabel.textContent = t(currentLanguage, "deadLinksProgressDone");
  } else {
    elements.deadLinksProgressLabel.textContent = t(currentLanguage, "deadLinksProgressPreparing");
  }

  elements.deadLinksProgressMessage.textContent = progress.error || progress.message || t(currentLanguage, "deadLinksProgressPreparing");
  elements.scanDeadLinks.disabled = Boolean(progress.running);
}

function renderDeadLinkResults(progress = {}) {
  const results = Array.isArray(progress.results) ? progress.results : [];
  const shouldShow = progress.running || Boolean(progress.completedAt) || Boolean(progress.error) || results.length > 0;
  elements.deadLinksResultsPanel.classList.toggle("hidden", !shouldShow);

  if (!shouldShow) {
    return;
  }

  syncDeadLinkSelection(results);
  const selectedCount = results.filter((item) => selectedDeadLinkIds.has(item.id)).length;
  const allSelected = results.length > 0 && selectedCount === results.length;
  elements.deadLinksSelectAll.checked = allSelected;
  elements.deadLinksSelectAll.indeterminate = selectedCount > 0 && selectedCount < results.length;
  elements.deadLinksSelectAll.disabled = progress.running || results.length === 0;
  elements.cleanDeadLinks.disabled = progress.running || selectedCount === 0;

  const cleanupSummary = progress.cleanupSummary
    ? t(currentLanguage, "deadLinksCleanupSummary", {
        cleaned: progress.cleanupSummary.cleaned || 0,
        failed: progress.cleanupSummary.failed || 0
      })
    : "";
  elements.deadLinksSummary.textContent = cleanupSummary || t(currentLanguage, "deadLinksSummary", {
    total: results.length,
    selected: selectedCount
  });

  elements.deadLinksResults.innerHTML = "";
  if (!results.length) {
    const empty = document.createElement("div");
    empty.className = "dead-links-empty";
    empty.textContent = progress.running
      ? t(currentLanguage, "deadLinksProgressPreparing")
      : progress.error
        ? t(currentLanguage, "deadLinksScanFailed")
        : t(currentLanguage, "deadLinksEmptyState");
    elements.deadLinksResults.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  results.forEach((item) => {
    const card = document.createElement("label");
    card.className = "dead-links-item";

    const top = document.createElement("div");
    top.className = "dead-links-item-top";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "dead-links-item-checkbox";
    checkbox.checked = selectedDeadLinkIds.has(item.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedDeadLinkIds.add(item.id);
      } else {
        selectedDeadLinkIds.delete(item.id);
      }
      renderDeadLinkResults(currentDeadLinkProgress);
    });

    const main = document.createElement("div");
    main.className = "dead-links-item-main";

    const head = document.createElement("div");
    head.className = "dead-links-item-head";

    const title = document.createElement("h4");
    title.className = "dead-links-item-title";
    title.textContent = item.title || t(currentLanguage, "bgUnnamed");

    const meta = document.createElement("div");
    meta.className = "dead-links-item-meta";

    const typeBadge = document.createElement("span");
    typeBadge.className = "dead-links-type-badge";
    typeBadge.textContent = item.type === "tab" ? t(currentLanguage, "tabs") : t(currentLanguage, "bookmarks");

    const reasonBadge = document.createElement("span");
    reasonBadge.className = "dead-links-reason-badge";
    reasonBadge.textContent = item.reason;

    meta.append(typeBadge, reasonBadge);
    head.append(title, meta);

    const url = document.createElement("div");
    url.className = "dead-links-item-url";
    url.textContent = item.url || "";

    main.append(head, url);
    top.append(checkbox, main);
    card.appendChild(top);
    fragment.appendChild(card);
  });
  elements.deadLinksResults.appendChild(fragment);
}

function syncDeadLinkSelection(results) {
  const signature = results.map((item) => item.id).join("|");
  if (signature === deadLinkSelectionSignature) {
    return;
  }

  deadLinkSelectionSignature = signature;
  selectedDeadLinkIds.clear();
  results.forEach((item) => selectedDeadLinkIds.add(item.id));
}

function handleToggleAllDeadLinks() {
  const results = Array.isArray(currentDeadLinkProgress?.results) ? currentDeadLinkProgress.results : [];
  if (elements.deadLinksSelectAll.checked) {
    results.forEach((item) => selectedDeadLinkIds.add(item.id));
  } else {
    results.forEach((item) => selectedDeadLinkIds.delete(item.id));
  }
  renderDeadLinkResults(currentDeadLinkProgress);
}

async function cleanSelectedDeadLinks() {
  const results = Array.isArray(currentDeadLinkProgress?.results) ? currentDeadLinkProgress.results : [];
  const selectedItems = results.filter((item) => selectedDeadLinkIds.has(item.id));
  if (!selectedItems.length) {
    showFeedback(t(currentLanguage, "deadLinksNothingSelected"));
    return;
  }

  showFeedback(t(currentLanguage, "feedbackDeadLinksCleaning"));
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.CLEAN_DEAD_LINKS,
    items: selectedItems
  });
  if (!response.ok) {
    throw new Error(response.error);
  }

  if (response.status) {
    currentStatus = response.status;
    renderStatus(response.status);
  }

  renderDeadLinkState(response.progress);
  showFeedback(t(currentLanguage, "feedbackDeadLinksCleaned", {
    cleaned: response.cleanup?.cleaned || 0,
    failed: response.cleanup?.failed || 0
  }));
}

function renderStatus(status) {
  if (!status) {
    elements.indexStatus.textContent = t(currentLanguage, "optionsIndexLoading");
    return;
  }

  elements.indexStatus.innerHTML = [
    `<strong>${t(currentLanguage, "optionsStatusTitle")}</strong>`,
    t(currentLanguage, "optionsStatusBookmarks", { count: status.bookmarks }),
    t(currentLanguage, "optionsStatusFolders", { count: status.folders }),
    t(currentLanguage, "optionsStatusTabs", { count: status.tabs }),
    t(currentLanguage, "optionsStatusAiTags", { count: status.aiTagRecords }),
    t(currentLanguage, "optionsStatusLastBuilt", {
      value: status.lastBuiltAt ? new Date(status.lastBuiltAt).toLocaleString() : t(currentLanguage, "optionsStatusNotBuilt")
    })
  ].join("<br>");
}

function showFeedback(text) {
  elements.actionFeedback.textContent = text instanceof Error ? `${t(currentLanguage, "errorPrefix")}: ${text.message}` : text;
  elements.actionFeedback.classList.remove("hidden");
}

async function ensureDeadLinkHostPermissions() {
  const origins = ["http://*/*", "https://*/*"];
  const alreadyGranted = await chrome.permissions.contains({ origins });
  if (alreadyGranted) {
    return true;
  }

  const granted = await chrome.permissions.request({ origins });
  if (!granted) {
    throw new Error(t(currentLanguage, "feedbackDeadLinksPermissionDenied"));
  }
  return true;
}

function toOriginPattern(baseUrl) {
  try {
    const url = new URL(baseUrl);
    return `${url.origin}/*`;
  } catch {
    throw new Error(t(currentLanguage, "feedbackInvalidBaseUrl"));
  }
}

async function ensureAiHostPermission(baseUrl) {
  const originPattern = toOriginPattern(baseUrl);
  const alreadyGranted = await chrome.permissions.contains({
    origins: [originPattern]
  });
  if (alreadyGranted) {
    return true;
  }

  const granted = await chrome.permissions.request({
    origins: [originPattern]
  });
  if (!granted) {
    throw new Error(t(currentLanguage, "feedbackHostPermissionDenied", { origin: originPattern }));
  }
  return true;
}

function toSortedArray(values) {
  return [...values].sort((left, right) => String(left).localeCompare(String(right), "en"));
}

function normalizeAiRecord(record = {}) {
  return {
    summary: typeof record.summary === "string" ? record.summary.trim() : "",
    tags: Array.isArray(record.tags)
      ? record.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : []
  };
}

function createAiRecordMap(aiRecords = []) {
  if (aiRecords instanceof Map) {
    return aiRecords;
  }

  if (Array.isArray(aiRecords)) {
    return new Map(
      aiRecords
        .filter((record) => record?.key)
        .map((record) => [String(record.key), normalizeAiRecord(record)])
    );
  }

  return new Map(
    Object.entries(aiRecords || {}).map(([key, record]) => [String(key), normalizeAiRecord(record)])
  );
}

function getAiRecordKeyForNode(node) {
  if (node.type === "bookmark" || node.type === "folder") {
    return `${node.type}:${node.id}`;
  }
  if (node.type === "tab" || node.type === "window") {
    return node.id;
  }
  return "";
}

function buildBookmarkMaps({ folders = [], bookmarks = [] }) {
  const folderMap = new Map();
  const bookmarkMap = new Map();

  for (const folder of folders) {
    folderMap.set(String(folder.id), {
      id: String(folder.id),
      type: "folder",
      title: folder.title || "",
      parentId: String(folder.parentId || ""),
      folderPath: folder.folderPath || [],
      childFolderIds: [],
      childBookmarkIds: []
    });
  }

  for (const bookmark of bookmarks) {
    bookmarkMap.set(String(bookmark.id), {
      id: String(bookmark.id),
      type: "bookmark",
      title: bookmark.title || bookmark.url || "",
      parentId: String(bookmark.parentId || ""),
      url: bookmark.url || "",
      folderPath: bookmark.folderPath || []
    });
  }

  for (const folder of folderMap.values()) {
    const parent = folderMap.get(folder.parentId);
    if (parent) {
      parent.childFolderIds.push(folder.id);
    }
  }

  for (const bookmark of bookmarkMap.values()) {
    const parent = folderMap.get(bookmark.parentId);
    if (parent) {
      parent.childBookmarkIds.push(bookmark.id);
    }
  }

  return { folderMap, bookmarkMap };
}

function attachBookmarkChildren(folderId, maps) {
  const folder = maps.folderMap.get(folderId);
  if (!folder) {
    return null;
  }

  const folderChildren = folder.childFolderIds
    .map((childId) => attachBookmarkChildren(childId, maps))
    .filter(Boolean)
    .sort((left, right) => left.title.localeCompare(right.title, "en"));

  const bookmarkChildren = folder.childBookmarkIds
    .map((bookmarkId) => maps.bookmarkMap.get(bookmarkId))
    .filter(Boolean)
    .map((bookmark) => ({
      id: bookmark.id,
      type: "bookmark",
      title: bookmark.title,
      parentId: bookmark.parentId,
      children: []
    }))
    .sort((left, right) => left.title.localeCompare(right.title, "en"));

  return {
    id: folder.id,
    type: "folder",
    title: folder.title,
    parentId: folder.parentId,
    children: [...folderChildren, ...bookmarkChildren]
  };
}

export function buildBookmarkScopeTree({ folders = [], bookmarks = [] }) {
  const maps = buildBookmarkMaps({ folders, bookmarks });
  const roots = [...maps.folderMap.values()]
    .filter((folder) => !maps.folderMap.has(folder.parentId))
    .sort((left, right) => left.title.localeCompare(right.title, "en"))
    .map((folder) => attachBookmarkChildren(folder.id, maps))
    .filter(Boolean);

  return roots;
}

export function buildTabScopeTree({ tabs = [] }) {
  const windows = new Map();

  for (const tab of tabs) {
    const windowId = String(tab.windowId);
    const key = `window:${windowId}`;
    if (!windows.has(key)) {
      windows.set(key, {
        id: key,
        type: "window",
        title: `Window ${windowId}`,
        windowId,
        children: []
      });
    }

    windows.get(key).children.push({
      id: `tab:${tab.id}`,
      type: "tab",
      title: tab.title || tab.url || "",
      parentId: key,
      tabId: String(tab.id),
      windowId,
      index: Number(tab.index || 0),
      url: tab.url || "",
      children: []
    });
  }

  return [...windows.values()]
    .map((windowNode) => ({
      ...windowNode,
      children: windowNode.children.sort((left, right) => {
        return left.index - right.index;
      })
    }))
    .sort((left, right) => Number(left.windowId) - Number(right.windowId));
}

export function attachAiMetadataToScopeTree(nodes = [], aiRecords = []) {
  const aiRecordMap = createAiRecordMap(aiRecords);

  function decorateNode(node) {
    const aiRecord = aiRecordMap.get(getAiRecordKeyForNode(node)) || { summary: "", tags: [] };
    const children = (node.children || []).map((child) => decorateNode(child));
    const hasOwnAiContent = Boolean(aiRecord.summary || aiRecord.tags.length);
    const analyzedLeafCount = children.length
      ? children.reduce((total, child) => total + (child.analyzedLeafCount || 0), 0)
      : hasOwnAiContent
        ? 1
        : 0;

    return {
      ...node,
      aiSummary: aiRecord.summary,
      aiTags: aiRecord.tags,
      hasOwnAiContent,
      analyzedLeafCount,
      children
    };
  }

  return nodes.map((node) => decorateNode(node));
}

function collectDescendantIds(node) {
  const ids = new Set();
  for (const child of node.children || []) {
    ids.add(child.id);
    for (const descendantId of collectDescendantIds(child)) {
      ids.add(descendantId);
    }
  }
  return ids;
}

function deriveFromChildren(node, selectedNodeIds) {
  if (!node.children || !node.children.length) {
    return { checked: false, partial: false };
  }

  const childStates = node.children.map((child) => deriveNodeSelectionState(child, selectedNodeIds));
  const anyChecked = childStates.some((state) => state.checked || state.partial);
  const allChecked = childStates.every((state) => state.checked);

  if (allChecked) {
    return { checked: true, partial: false };
  }

  if (anyChecked) {
    return { checked: false, partial: true };
  }

  return { checked: false, partial: false };
}

export function deriveNodeSelectionState(node, selectedNodeIds, inheritedSelection = false) {
  const selectedSet = selectedNodeIds instanceof Set ? selectedNodeIds : new Set(selectedNodeIds || []);
  if (inheritedSelection || selectedSet.has(node.id)) {
    return { checked: true, partial: false };
  }
  return deriveFromChildren(node, selectedSet);
}

export function expandSelectionForNode(node) {
  const ids = new Set([node.id]);
  for (const descendantId of collectDescendantIds(node)) {
    ids.add(descendantId);
  }
  return ids;
}

export function resolveBookmarkScopeSelection({ folders = [], bookmarks = [], selectedNodeIds = [] }) {
  const selectedSet = new Set(selectedNodeIds || []);
  const { folderMap, bookmarkMap } = buildBookmarkMaps({ folders, bookmarks });
  const selectedFolderIds = new Set();
  const selectedBookmarkIds = new Set();

  function collectFolderDescendants(folderId) {
    const folder = folderMap.get(folderId);
    if (!folder) {
      return;
    }

    selectedFolderIds.add(folder.id);
    for (const bookmarkId of folder.childBookmarkIds) {
      selectedBookmarkIds.add(bookmarkId);
    }
    for (const childFolderId of folder.childFolderIds) {
      collectFolderDescendants(childFolderId);
    }
  }

  for (const nodeId of selectedSet) {
    const id = String(nodeId);
    if (folderMap.has(id)) {
      collectFolderDescendants(id);
      continue;
    }
    if (bookmarkMap.has(id)) {
      selectedBookmarkIds.add(id);
    }
  }

  return {
    folderIds: toSortedArray(selectedFolderIds),
    bookmarkIds: toSortedArray(selectedBookmarkIds),
    selectedNodeIds: toSortedArray(selectedSet)
  };
}

export function resolveTabScopeSelection({ tabs = [], selectedNodeIds = [] }) {
  const selectedSet = new Set(selectedNodeIds || []);
  const tabsByWindow = new Map();
  const tabsById = new Map();
  const selectedWindowIds = new Set();
  const selectedTabIds = new Set();

  for (const tab of tabs) {
    const windowKey = `window:${tab.windowId}`;
    const tabKey = `tab:${tab.id}`;
    if (!tabsByWindow.has(windowKey)) {
      tabsByWindow.set(windowKey, []);
    }
    tabsByWindow.get(windowKey).push(String(tab.id));
    tabsById.set(tabKey, String(tab.id));
  }

  for (const nodeId of selectedSet) {
    const id = String(nodeId);
    if (tabsByWindow.has(id)) {
      selectedWindowIds.add(id);
      for (const tabId of tabsByWindow.get(id)) {
        selectedTabIds.add(tabId);
      }
      continue;
    }
    if (tabsById.has(id)) {
      selectedTabIds.add(tabsById.get(id));
    }
  }

  return {
    windowIds: toSortedArray(selectedWindowIds),
    tabIds: toSortedArray(selectedTabIds),
    selectedNodeIds: toSortedArray(selectedSet)
  };
}

export function summarizeScopeSelection({ bookmarkResolution, tabResolution }) {
  const folders = bookmarkResolution?.folderIds?.length || 0;
  const bookmarks = bookmarkResolution?.bookmarkIds?.length || 0;
  const windows = tabResolution?.windowIds?.length || 0;
  const tabs = tabResolution?.tabIds?.length || 0;

  return {
    folders,
    bookmarks,
    windows,
    tabs,
    isEmpty: folders + bookmarks + windows + tabs === 0
  };
}

export function hasScopeSelection(selection = {}) {
  return Boolean((selection.bookmarkNodeIds || []).length || (selection.tabNodeIds || []).length);
}

export function getDefaultScopeSelection({ folders = [], bookmarks = [], tabs = [] }) {
  const bookmarkNodeIds = buildBookmarkScopeTree({ folders, bookmarks }).map((node) => node.id);

  return {
    bookmarkNodeIds,
    tabNodeIds: []
  };
}

import { putAiTagRecord, clearAiTagRecords } from "../shared/db.js";
import { t } from "../shared/i18n.js";
import { getSettings } from "../shared/storage.js";
import { nowIso } from "../shared/utils.js";

function buildPrompt(item, language) {
  const parts = [
    `title: ${item.title || ""}`,
    `url: ${item.url || ""}`,
    `folderPath: ${(item.folderPath || []).join(" / ")}`,
    `entityType: ${item.type}`
  ];

  if (item.pageDescription) {
    parts.push(`pageDescription: ${item.pageDescription}`);
  }

  return `${t(language, "aiUserPrompt")}\n${parts.join("\n")}`;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const error = new Error("AI task aborted");
    error.name = "AbortError";
    throw error;
  }
}

async function fetchEnhancedMetadata(tab) {
  try {
    const permissions = await chrome.permissions.contains({
      permissions: ["scripting"],
      origins: ["http://*/*", "https://*/*"]
    });

    if (!permissions || !tab.id || !tab.url || !/^https?:/i.test(tab.url)) {
      return "";
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const description = document.querySelector('meta[name="description"]')?.content || "";
        const ogDescription = document.querySelector('meta[property="og:description"]')?.content || "";
        return [document.title, description, ogDescription].filter(Boolean).join(" | ");
      }
    });
    return result?.result || "";
  } catch {
    return "";
  }
}

async function ensureAiEndpointPermission(baseUrl, language) {
  let originPattern = "";
  try {
    const url = new URL(baseUrl);
    originPattern = `${url.origin}/*`;
  } catch {
    throw new Error(t(language, "aiInvalidBaseUrl"));
  }

  const granted = await chrome.permissions.contains({
    origins: [originPattern]
  });

  if (!granted) {
    throw new Error(t(language, "aiMissingHostPermission", { origin: originPattern }));
  }
}

async function requestTags(settings, item, { language, signal }) {
  await ensureAiEndpointPermission(settings.ai.baseUrl, language);
  throwIfAborted(signal);

  const endpoint = `${settings.ai.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.ai.apiKey}`
    },
    body: JSON.stringify({
      model: settings.ai.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: t(language, "aiSystemPrompt")
        },
        {
          role: "user",
          content: buildPrompt(item, language)
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || "{\"tags\":[]}";
  return parseAiResponseContent(content);
}

export function parseAiResponseContent(content) {
  const parsed = JSON.parse(content);
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.slice(0, 6).map((tag) => String(tag).trim()).filter(Boolean)
    : [];
  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";

  return {
    tags: [...new Set(tags)],
    summary
  };
}

export async function enrichItemsWithAi(items, { onProgress, signal, language = "zh-CN" } = {}) {
  const settings = await getSettings();
  if (!settings.ai.enabled || !settings.ai.apiKey) {
    throw new Error("AI is disabled or API key is missing.");
  }

  const candidates = items;

  let processed = 0;
  for (const item of candidates) {
    throwIfAborted(signal);

    const workingItem = { ...item };
    if (settings.ai.analysisMode === "enhanced" && item.type === "tab") {
      workingItem.pageDescription = await fetchEnhancedMetadata(item);
    }

    const result = await requestTags(settings, workingItem, { language, signal });
    await putAiTagRecord({
      key: `${item.type}:${item.entityId}`,
      entityType: item.type,
      entityId: item.entityId,
      title: item.title,
      url: item.url || "",
      tags: result.tags,
      summary: result.summary,
      updatedAt: nowIso()
    });

    processed += 1;
    if (onProgress) {
      await onProgress({
        processed,
        total: candidates.length,
        currentTitle: item.title,
        entityType: item.type
      });
    }
  }

  return { processed, total: candidates.length };
}

export function isAbortError(error) {
  return error?.name === "AbortError";
}

export async function clearAllAiTags() {
  await clearAiTagRecords();
}

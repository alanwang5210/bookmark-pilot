export function normalizeText(value = "") {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[|/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value = "") {
  const parts = splitTokenParts(value);

  const segments = [];
  for (const part of parts) {
    segments.push(part);
    if (/[\u4e00-\u9fff]/.test(part)) {
      segments.push(...part.split(""));
    }
  }

  return [...new Set(segments)];
}

export function tokenizeForFuzzy(value = "") {
  const parts = splitTokenParts(value);
  if (!parts.length) {
    return [];
  }

  const segments = new Set(tokenize(value));

  for (let index = 0; index < parts.length - 1; index += 1) {
    const left = parts[index];
    const right = parts[index + 1];
    if (!isFuzzyJoinableToken(left) || !isFuzzyJoinableToken(right)) {
      continue;
    }

    const compound = `${left}${right}`;
    if (compound.length >= 5 && compound.length <= 32) {
      segments.add(compound);
    }
  }

  return [...segments];
}

export function limitedEditDistance(left = "", right = "", maxDistance = 1) {
  if (left === right) {
    return 0;
  }

  const a = normalizeText(left);
  const b = normalizeText(right);
  if (!a || !b) {
    return maxDistance + 1;
  }
  if (Math.abs(a.length - b.length) > maxDistance) {
    return maxDistance + 1;
  }

  let previousRow = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let rowIndex = 1; rowIndex <= a.length; rowIndex += 1) {
    const currentRow = [rowIndex];
    let minInRow = currentRow[0];

    for (let columnIndex = 1; columnIndex <= b.length; columnIndex += 1) {
      const substitutionCost = a[rowIndex - 1] === b[columnIndex - 1] ? 0 : 1;
      const value = Math.min(
        previousRow[columnIndex] + 1,
        currentRow[columnIndex - 1] + 1,
        previousRow[columnIndex - 1] + substitutionCost
      );
      currentRow.push(value);
      minInRow = Math.min(minInRow, value);
    }

    if (minInRow > maxDistance) {
      return maxDistance + 1;
    }
    previousRow = currentRow;
  }

  return previousRow[b.length];
}

export function parseQuery(text = "", forcedScope = "all") {
  const rawTokens = text.trim().split(/\s+/).filter(Boolean);
  const scope = {
    bookmarks: forcedScope === "all" || forcedScope === "bookmarks",
    tabs: forcedScope === "all" || forcedScope === "tabs",
    folders: forcedScope === "all" || forcedScope === "folders"
  };

  let site = "";
  let type = "";
  const cleanTokens = [];

  for (const token of rawTokens) {
    if (token.startsWith("in:")) {
      const target = token.slice(3);
      scope.bookmarks = target === "bookmarks";
      scope.tabs = target === "tabs";
      scope.folders = target === "bookmarks" || target === "folders";
      continue;
    }
    if (token.startsWith("type:")) {
      type = token.slice(5);
      continue;
    }
    if (token.startsWith("site:")) {
      site = normalizeText(token.slice(5));
      continue;
    }
    cleanTokens.push(token);
  }

  return {
    text,
    queryText: cleanTokens.join(" ").trim(),
    normalized: normalizeText(cleanTokens.join(" ")),
    tokens: tokenize(cleanTokens.join(" ")),
    scope,
    site,
    type
  };
}

export function getDomain(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function createFaviconUrl(url = "") {
  if (!url || !/^https?:/i.test(url)) {
    return "";
  }
  return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(url)}`;
}

export function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function toSentenceList(values = []) {
  return values.filter(Boolean).join(" · ");
}

export function nowIso() {
  return new Date().toISOString();
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function splitTokenParts(value = "") {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/[\s,._:;!?()[\]{}"'`~<>#&+=*-]+/g)
    .filter(Boolean);
}

function isFuzzyJoinableToken(value = "") {
  return /^[a-z0-9]+$/i.test(value);
}

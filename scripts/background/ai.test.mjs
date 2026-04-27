import test from "node:test";
import assert from "node:assert/strict";

import { parseAiResponseContent } from "./ai.js";

test("parseAiResponseContent returns deduped tags and a trimmed summary", () => {
  const result = parseAiResponseContent('{"tags":[" docs ","api","api",""],"summary":"  用于查阅 API 文档。  "}');

  assert.deepEqual(result, {
    tags: ["docs", "api"],
    summary: "用于查阅 API 文档。"
  });
});

test("parseAiResponseContent tolerates missing summary", () => {
  const result = parseAiResponseContent('{"tags":["reference"]}');

  assert.deepEqual(result, {
    tags: ["reference"],
    summary: ""
  });
});

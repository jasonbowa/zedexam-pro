import test from "node:test";
import assert from "node:assert/strict";

import { resolveApiBase, resolveApiRoot } from "./apiBase.js";

test("removes escaped and real line endings from deployment URLs", () => {
  assert.equal(
    resolveApiBase({
      apiBaseUrl: "https://zedexam.onrender.com/api\\r\n",
      apiUrl: "https://wrong.example",
    }),
    "https://zedexam.onrender.com/api"
  );
  assert.equal(
    resolveApiRoot({ apiUrl: "https://zedexam.onrender.com\r\n" }),
    "https://zedexam.onrender.com"
  );
});

test("normalizes root and /api URL forms", () => {
  assert.equal(
    resolveApiBase({ apiUrl: "https://zedexam.onrender.com/" }),
    "https://zedexam.onrender.com/api"
  );
  assert.equal(
    resolveApiRoot({ apiBaseUrl: "https://zedexam.onrender.com/api/" }),
    "https://zedexam.onrender.com"
  );
});

test("uses the production backend when environment values are absent", () => {
  assert.equal(resolveApiBase(), "https://zedexam.onrender.com/api");
});

import { describe, expect, it } from "vitest";
import { matchesEntry, searchWords } from "./search";
import type { WordEntry } from "./types";

const entries: WordEntry[] = [
  { word: "root", meaning: { "n.": "根" }, added_at: "2026-01-01T00:00:00.000Z" },
  { word: "take root", meaning: { "v.": "生根" }, added_at: "2026-01-02T00:00:00.000Z" },
  { word: "uproot", meaning: { "v.": "连根拔起" }, added_at: "2026-01-03T00:00:00.000Z" },
];

describe("phrase-aware search", () => {
  it("keeps exact search strict", () => {
    expect(matchesEntry(entries[1], "root", "exact")).toBe(false);
  });

  it("matches phrase tokens for prefix search", () => {
    expect(searchWords(entries, "roo", "prefix").map((entry) => entry.word)).toEqual(["root", "take root"]);
  });

  it("matches phrase tokens for suffix search", () => {
    expect(searchWords(entries, "oot", "suffix").map((entry) => entry.word)).toEqual(["root", "take root", "uproot"]);
  });

  it("matches phrase tokens for substring search", () => {
    expect(searchWords(entries, "ak", "contains").map((entry) => entry.word)).toEqual(["take root"]);
  });
});

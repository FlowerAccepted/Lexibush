import type { WordEntry } from "./types";

export type SearchMode = "exact" | "prefix" | "suffix" | "contains";

const normalize = (value: string) => value.trim().toLowerCase();

export function tokenizePhrase(value: string): string[] {
  return normalize(value).split(/\s+/).filter(Boolean);
}

export function matchesEntry(entry: WordEntry, query: string, mode: SearchMode): boolean {
  const target = normalize(entry.word);
  const needle = normalize(query);
  if (!needle) return false;
  if (mode === "exact") return target === needle;

  const targets = target.includes(" ") ? tokenizePhrase(target) : [target];
  const needles = tokenizePhrase(needle);
  const queryParts = needles.length ? needles : [needle];

  return queryParts.some((part) =>
    targets.some((token) => {
      if (mode === "prefix") return token.startsWith(part);
      if (mode === "suffix") return token.endsWith(part);
      return token.includes(part);
    }),
  );
}

export function searchWords(words: WordEntry[], query: string, mode: SearchMode): WordEntry[] {
  return words
    .filter((entry) => matchesEntry(entry, query, mode))
    .sort((left, right) => left.word.localeCompare(right.word));
}

export function failJump(words: WordEntry[], word: string, direction: "prefix" | "suffix") {
  const target = normalize(word);
  if (!target) return [];

  const candidates = words
    .map((entry) => normalize(entry.word))
    .filter((candidate) => candidate && candidate !== target);

  const chain = candidates
    .filter((candidate) =>
      direction === "prefix" ? target.endsWith(candidate) : target.startsWith(candidate),
    )
    .sort((left, right) => right.length - left.length);

  return Array.from(new Set(chain));
}

export function extractDifference(word: string, matched: string, direction: "prefix" | "suffix") {
  const target = normalize(word);
  const base = normalize(matched);
  if (!target || !base) return "";
  if (direction === "prefix" && target.endsWith(base)) return target.slice(0, target.length - base.length);
  if (direction === "suffix" && target.startsWith(base)) return target.slice(base.length);
  return "";
}

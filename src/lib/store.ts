import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASIC_AFFIXES } from "./affixes";
import { importAffixes, importWords, nowIso } from "./importers";
import { extractDifference, failJump, searchWords, type SearchMode } from "./search";
import type { AffixEntry, ArchiveCommit, MeaningMap, WordEntry } from "./types";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dataDir = join(rootDir, "data");
const wordsFile = join(dataDir, "words.json");
const affixesFile = join(dataDir, "affixes.json");

function ensureDataDir() {
  mkdirSync(dataDir, { recursive: true });
  if (!existsSync(wordsFile)) writeJson(wordsFile, []);
  if (!existsSync(affixesFile)) writeJson(affixesFile, []);
  ensureDataGit();
}

function readJson<T>(path: string, fallback: T): T {
  ensureDataDir();
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function git(args: string[]) {
  return execFileSync("git", args, { cwd: dataDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function ensureDataGit() {
  mkdirSync(dataDir, { recursive: true });
  try {
    if (!existsSync(join(dataDir, ".git"))) git(["init"]);
    try {
      git(["config", "user.email"]);
    } catch {
      git(["config", "user.email", "lexibush@local"]);
    }
    try {
      git(["config", "user.name"]);
    } catch {
      git(["config", "user.name", "Lexibush"]);
    }
  } catch {
    // Git is best-effort; core JSON storage should still work.
  }
}

function commitSnapshot(message: string) {
  ensureDataDir();
  try {
    git(["add", "words.json", "affixes.json"]);
    const status = git(["status", "--porcelain"]);
    if (status) git(["commit", "-m", message]);
  } catch {
    // Archives are best-effort; the API reports current data regardless.
  }
}

function cleanWord(word: string) {
  return word.trim().replace(/\s+/g, " ");
}

export const store = {
  dataDir,

  words() {
    return readJson<WordEntry[]>(wordsFile, []);
  },

  affixes() {
    return readJson<AffixEntry[]>(affixesFile, []);
  },

  saveWords(words: WordEntry[]) {
    writeJson(wordsFile, words);
  },

  saveAffixes(affixes: AffixEntry[]) {
    writeJson(affixesFile, affixes);
  },

  overview() {
    const words = this.words();
    const affixes = this.affixes();
    return { words, affixes, stats: buildStats(words, affixes) };
  },

  addWord(word: string, meaning: MeaningMap, notes = "", tags: string[] = []) {
    const words = this.words();
    const normalized = cleanWord(word);
    if (!normalized) throw new Error("单词不能为空");
    if (words.some((entry) => entry.word.toLowerCase() === normalized.toLowerCase())) {
      throw new Error(`词条已存在: ${normalized}`);
    }
    const entry: WordEntry = { word: normalized, meaning, added_at: nowIso(), notes, tags };
    words.push(entry);
    this.saveWords(words);
    commitSnapshot(`Add word: ${normalized}`);
    return entry;
  },

  updateWord(original: string, next: Partial<WordEntry>) {
    const words = this.words();
    const index = words.findIndex((entry) => entry.word.toLowerCase() === original.toLowerCase());
    if (index === -1) throw new Error(`未找到词条: ${original}`);
    const word = cleanWord(next.word || words[index].word);
    if (words.some((entry, entryIndex) => entryIndex !== index && entry.word.toLowerCase() === word.toLowerCase())) {
      throw new Error(`词条已存在: ${word}`);
    }
    words[index] = {
      ...words[index],
      ...next,
      word,
      updated_at: nowIso(),
      tags: Array.isArray(next.tags) ? next.tags : words[index].tags || [],
    };
    this.saveWords(words);
    commitSnapshot(`Update word: ${word}`);
    return words[index];
  },

  deleteWord(word: string) {
    commitSnapshot(`Archive before deleting: ${word}`);
    const words = this.words();
    const next = words.filter((entry) => entry.word.toLowerCase() !== word.toLowerCase());
    if (next.length === words.length) throw new Error(`未找到词条: ${word}`);
    this.saveWords(next);
    commitSnapshot(`Delete word: ${word}`);
  },

  importWords(input: string, format = "auto") {
    const parsed = importWords(input, this.words(), format);
    this.saveWords(parsed.words);
    commitSnapshot(`Import ${parsed.result.successCount} words`);
    return parsed.result;
  },

  addAffix(affix: string, type: AffixEntry["type"], meanings: string[]) {
    const affixes = this.affixes();
    const normalized = affix.trim();
    if (!normalized) throw new Error("词根词缀不能为空");
    if (affixes.some((entry) => entry.affix.toLowerCase() === normalized.toLowerCase())) {
      throw new Error(`词根词缀已存在: ${normalized}`);
    }
    const entry: AffixEntry = { affix: normalized, type, meanings, added_at: nowIso() };
    affixes.push(entry);
    this.saveAffixes(affixes);
    commitSnapshot(`Add affix: ${normalized}`);
    return entry;
  },

  deleteAffix(affix: string) {
    commitSnapshot(`Archive before deleting affix: ${affix}`);
    const affixes = this.affixes();
    const next = affixes.filter((entry) => entry.affix.toLowerCase() !== affix.toLowerCase());
    if (next.length === affixes.length) throw new Error(`未找到词根词缀: ${affix}`);
    this.saveAffixes(next);
    commitSnapshot(`Delete affix: ${affix}`);
  },

  importAffixes(input: string, format = "auto") {
    const parsed = importAffixes(input, this.affixes(), format);
    this.saveAffixes(parsed.affixes);
    commitSnapshot(`Import ${parsed.result.successCount} affixes`);
    return parsed.result;
  },

  seedAffixes() {
    const existing = this.affixes();
    const known = new Set(existing.map((entry) => entry.affix.toLowerCase()));
    const additions = BASIC_AFFIXES.filter((entry) => !known.has(entry.affix.toLowerCase())).map((entry) => ({
      ...entry,
      added_at: nowIso(),
    }));
    this.saveAffixes([...existing, ...additions]);
    commitSnapshot(`Seed ${additions.length} basic affixes`);
    return additions.length;
  },

  search(query: string, mode: SearchMode) {
    return searchWords(this.words(), query, mode);
  },

  fail(word: string, direction: "prefix" | "suffix") {
    const words = this.words();
    const chain = failJump(words, word, direction);
    const affixes = this.affixes();
    return chain.map((matched) => {
      const difference = extractDifference(word, matched, direction);
      const affix = affixes.find((entry) => entry.affix.replace(/^-|-$/g, "").toLowerCase() === difference.toLowerCase());
      return { matched, difference, affix };
    });
  },

  snapshot(message = "Manual archive") {
    commitSnapshot(message);
  },

  archives(): ArchiveCommit[] {
    ensureDataDir();
    try {
      const output = git(["log", "--date=iso", "--pretty=format:%H%x09%ad%x09%s", "--", "words.json", "affixes.json"]);
      return output
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [hash, date, ...message] = line.split("\t");
          return { hash, date, message: message.join("\t") };
        });
    } catch {
      return [];
    }
  },

  restore(hash: string) {
    if (!/^[a-f0-9]{7,40}$/i.test(hash)) throw new Error("无效存档哈希");
    commitSnapshot(`Archive before restore ${hash}`);
    git(["checkout", hash, "--", "words.json", "affixes.json"]);
    commitSnapshot(`Restore archive: ${hash.slice(0, 7)}`);
  },
};

function buildStats(words: WordEntry[], affixes: AffixEntry[]) {
  const byPartOfSpeech: Record<string, number> = {};
  const byAffixType: Record<string, number> = {};
  const dailyWords: Record<string, number> = {};
  const dailyAffixes: Record<string, number> = {};
  for (const entry of words) {
    for (const pos of Object.keys(entry.meaning || { "": "" })) byPartOfSpeech[pos || "未标注"] = (byPartOfSpeech[pos || "未标注"] || 0) + 1;
    const day = entry.added_at?.slice(0, 10) || "未知";
    dailyWords[day] = (dailyWords[day] || 0) + 1;
  }
  for (const entry of affixes) {
    byAffixType[entry.type] = (byAffixType[entry.type] || 0) + 1;
    const day = entry.added_at?.slice(0, 10) || "未知";
    dailyAffixes[day] = (dailyAffixes[day] || 0) + 1;
  }
  return {
    totalWords: words.length,
    totalAffixes: affixes.length,
    phrases: words.filter((entry) => entry.word.includes(" ")).length,
    byPartOfSpeech,
    byAffixType,
    dailyWords,
    dailyAffixes,
  };
}

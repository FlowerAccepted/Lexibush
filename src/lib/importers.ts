import type { AffixEntry, ImportResult, MeaningMap, WordEntry } from "./types";

const POS_PATTERN = /([a-z]+\.|modalv\.)\s*([^]+?)(?=\s+(?:[a-z]+\.|modalv\.)|$)/gi;

export function nowIso() {
  return new Date().toISOString();
}

export function parseMeaning(text: string): MeaningMap {
  const trimmed = text.trim();
  const meaning: MeaningMap = {};
  for (const match of trimmed.matchAll(POS_PATTERN)) {
    meaning[match[1].toLowerCase()] = match[2].trim();
  }
  return Object.keys(meaning).length ? meaning : { "": trimmed };
}

export function importWords(input: string, existing: WordEntry[], format = "auto"): { words: WordEntry[]; result: ImportResult } {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const words = [...existing];
  const known = new Set(words.map((entry) => entry.word.toLowerCase()));
  const errors: string[] = [];
  let successCount = 0;
  let detected = format;

  if (detected === "auto") {
    detected = lines[0]?.startsWith("{") || lines[0]?.startsWith("[") ? "json" : lines.some((line) => line.includes(",")) ? "comma" : "space";
  }

  if (detected === "json") {
    try {
      const data = JSON.parse(lines.join("\n"));
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || typeof item.word !== "string") {
          errors.push(`无效 JSON 词条: ${JSON.stringify(item)}`);
          continue;
        }
        const key = item.word.trim().toLowerCase();
        if (!key || known.has(key)) {
          errors.push(`单词已存在或为空: ${item.word}`);
          continue;
        }
        words.push({
          word: item.word.trim(),
          meaning: typeof item.meaning === "string" ? parseMeaning(item.meaning) : item.meaning || {},
          added_at: item.added_at || nowIso(),
          notes: item.notes,
          tags: Array.isArray(item.tags) ? item.tags : [],
        });
        known.add(key);
        successCount += 1;
      }
    } catch (error) {
      errors.push(`JSON 解析错误: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { words, result: { successCount, errors } };
  }

  for (const line of lines) {
    const parts = detected === "comma" ? line.split(",", 2) : line.split(/\s+(.+)/, 2);
    const word = parts[0]?.trim();
    const meaningText = parts[1]?.trim();
    if (!word || !meaningText) {
      errors.push(`格式错误: ${line}`);
      continue;
    }
    const key = word.toLowerCase();
    if (known.has(key)) {
      errors.push(`单词已存在: ${word}`);
      continue;
    }
    words.push({ word, meaning: parseMeaning(meaningText), added_at: nowIso(), tags: [] });
    known.add(key);
    successCount += 1;
  }

  return { words, result: { successCount, errors } };
}

export function importAffixes(input: string, existing: AffixEntry[], format = "auto"): { affixes: AffixEntry[]; result: ImportResult } {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const affixes = [...existing];
  const known = new Set(affixes.map((entry) => entry.affix.toLowerCase()));
  const errors: string[] = [];
  let successCount = 0;
  let detected = format;

  if (detected === "auto") {
    detected = lines[0]?.startsWith("{") || lines[0]?.startsWith("[") ? "json" : lines.some((line) => line.includes(",")) ? "comma" : "space";
  }

  if (detected === "json") {
    try {
      const data = JSON.parse(lines.join("\n"));
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || typeof item.affix !== "string") {
          errors.push(`无效 JSON 词缀: ${JSON.stringify(item)}`);
          continue;
        }
        const key = item.affix.trim().toLowerCase();
        if (!key || known.has(key)) {
          errors.push(`词根词缀已存在或为空: ${item.affix}`);
          continue;
        }
        affixes.push({
          affix: item.affix.trim(),
          type: item.type || "root",
          meanings: Array.isArray(item.meanings) ? item.meanings : String(item.meanings || "").split(";").map((part) => part.trim()).filter(Boolean),
          added_at: item.added_at || nowIso(),
        });
        known.add(key);
        successCount += 1;
      }
    } catch (error) {
      errors.push(`JSON 解析错误: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { affixes, result: { successCount, errors } };
  }

  for (const line of lines) {
    const parts = detected === "comma" ? line.split(",").map((part) => part.trim()) : line.split(/\s+/, 3);
    const [affix, type] = parts;
    const meaningsText = detected === "comma" ? parts.slice(2).join(",") : line.split(/\s+/).slice(2).join(" ");
    if (!affix || !type || !meaningsText) {
      errors.push(`格式错误: ${line}`);
      continue;
    }
    const key = affix.toLowerCase();
    if (known.has(key)) {
      errors.push(`词根词缀已存在: ${affix}`);
      continue;
    }
    affixes.push({
      affix,
      type: type as AffixEntry["type"],
      meanings: meaningsText.split(";").map((part) => part.trim()).filter(Boolean),
      added_at: nowIso(),
    });
    known.add(key);
    successCount += 1;
  }

  return { affixes, result: { successCount, errors } };
}

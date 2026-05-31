import type { AffixEntry } from "./types";

export const BASIC_AFFIXES: Omit<AffixEntry, "added_at">[] = [
  { affix: "anti-", type: "prefix", meanings: ["反对", "抵抗"] },
  { affix: "auto-", type: "prefix", meanings: ["自己", "自动"] },
  { affix: "bio", type: "root", meanings: ["生命"] },
  { affix: "chron", type: "root", meanings: ["时间"] },
  { affix: "geo", type: "root", meanings: ["土地", "地球"] },
  { affix: "graph", type: "root", meanings: ["写", "记录"] },
  { affix: "inter-", type: "prefix", meanings: ["在……之间", "相互"] },
  { affix: "micro-", type: "prefix", meanings: ["小", "微"] },
  { affix: "pre-", type: "prefix", meanings: ["之前", "预先"] },
  { affix: "re-", type: "prefix", meanings: ["再次", "回"] },
  { affix: "-able", type: "suffix", meanings: ["可……的"] },
  { affix: "-er", type: "suffix", meanings: ["人", "物"] },
  { affix: "-ful", type: "suffix", meanings: ["充满……的"] },
  { affix: "-less", type: "suffix", meanings: ["无……的"] },
  { affix: "-tion", type: "suffix", meanings: ["名词后缀", "行为或状态"] },
];

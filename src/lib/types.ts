export type MeaningMap = Record<string, string>;

export interface WordEntry {
  word: string;
  meaning: MeaningMap;
  added_at: string;
  updated_at?: string;
  notes?: string;
  tags?: string[];
}

export interface AffixEntry {
  affix: string;
  type: "prefix" | "suffix" | "root";
  meanings: string[];
  added_at: string;
}

export interface ImportResult {
  successCount: number;
  errors: string[];
}

export interface ArchiveCommit {
  hash: string;
  date: string;
  message: string;
}

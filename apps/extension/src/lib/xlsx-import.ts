import * as XLSX from "xlsx";
import type {
  TargetLanguage,
  Word,
  WordCreateInput,
} from "@i-speak-hello/shared";
import type { EnrichResult } from "./openrouter";
import { enrichWordsBatch } from "./openrouter";
import { useWordStore } from "./../stores/wordStore";

export interface ImportRow {
  original: string;
  translation?: string;
  targetLanguage: TargetLanguage;
  pinyin?: string;
  notes?: string;
}

export interface SkippedRow {
  rowNumber: number;
  reason: string;
}

export interface DuplicateRow {
  rowNumber: number;
  original: string;
  targetLanguage: TargetLanguage;
}

export interface ValidationResult {
  validRows: ImportRow[];
  skippedRows: SkippedRow[];
  duplicates: DuplicateRow[];
}

export interface ImportProgress {
  phase: "parsing" | "saving" | "enriching" | "done" | "error";
  current: number;
  total: number;
  message: string;
}

// Column header aliases (Indonesian + English)
const COLUMN_MAP: Record<string, keyof ImportRow> = {
  original: "original",
  kata: "original",
  word: "original",
  translation: "translation",
  terjemahan: "translation",
  arti: "translation",
  targetlanguage: "targetLanguage",
  bahasa: "targetLanguage",
  language: "targetLanguage",
  lang: "targetLanguage",
  pinyin: "pinyin",
  notes: "notes",
  catatan: "notes",
};

function normalizeHeader(header: string): keyof ImportRow | undefined {
  // Strip parenthetical suffixes like "(opsional)" and normalize
  const key = header
    .trim()
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, "")
    .replace(/[_\s-]/g, "");
  return COLUMN_MAP[key];
}

export async function parseExcelFile(file: File): Promise<ImportRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("File Excel kosong");

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  if (rawRows.length === 0) throw new Error("File Excel tidak memiliki data");

  // Map column headers
  const firstRow = rawRows[0];
  const headerMapping = new Map<string, keyof ImportRow>();
  for (const key of Object.keys(firstRow)) {
    const mapped = normalizeHeader(key);
    if (mapped) headerMapping.set(key, mapped);
  }

  return rawRows.map((raw) => {
    const row: Partial<ImportRow> = {};
    for (const [originalKey, mappedKey] of headerMapping) {
      const value = raw[originalKey];
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        (row as Record<string, string>)[mappedKey] = String(value).trim();
      }
    }
    return row as ImportRow;
  });
}

export function validateRows(rows: ImportRow[]): ValidationResult {
  const validRows: ImportRow[] = [];
  const skippedRows: SkippedRow[] = [];

  rows.forEach((row, i) => {
    const rowNumber = i + 2; // Excel row (1-indexed header + 1-indexed data)

    if (!row.original || row.original.trim() === "") {
      skippedRows.push({ rowNumber, reason: "Kolom 'original' kosong" });
      return;
    }

    const lang = row.targetLanguage?.toLowerCase().trim();
    if (lang !== "zh" && lang !== "en") {
      skippedRows.push({
        rowNumber,
        reason: "targetLanguage harus 'zh' atau 'en'",
      });
      return;
    }

    if (!row.translation || row.translation.trim() === "") {
      skippedRows.push({ rowNumber, reason: "Kolom 'translation' kosong" });
      return;
    }

    validRows.push({
      original: row.original.trim(),
      translation: row.translation?.trim(),
      targetLanguage: lang as TargetLanguage,
      pinyin: row.pinyin?.trim(),
      notes: row.notes?.trim(),
    });
  });

  return { validRows, skippedRows, duplicates: [] };
}

export function checkDuplicates(
  rows: ImportRow[],
  existingWords: Word[],
): DuplicateRow[] {
  const existingSet = new Set(
    existingWords.map(
      (w) => `${w.original.toLowerCase().trim()}|${w.targetLanguage}`,
    ),
  );

  const duplicates: DuplicateRow[] = [];
  rows.forEach((row, i) => {
    const key = `${row.original.toLowerCase().trim()}|${row.targetLanguage}`;
    if (existingSet.has(key)) {
      duplicates.push({
        rowNumber: i + 2,
        original: row.original,
        targetLanguage: row.targetLanguage,
      });
    }
  });

  return duplicates;
}

export function toWordCreateInputs(rows: ImportRow[]): WordCreateInput[] {
  return rows.map((row) => ({
    targetLanguage: row.targetLanguage,
    original: row.original,
    translation: row.translation,
    pinyin: row.pinyin,
    notes: row.notes,
    source: "import" as const,
  }));
}

export async function enrichWordsWithProgress(
  apiKey: string,
  words: Array<{
    id: string;
    original: string;
    translation: string;
    targetLanguage: TargetLanguage;
  }>,
  onBatchComplete: (
    completed: number,
    total: number,
    results: Map<string, EnrichResult>,
  ) => void,
  abortSignal: { aborted: boolean },
  model?: string,
): Promise<Map<string, EnrichResult>> {
  const allResults = new Map<string, EnrichResult>();
  const batchSize = 5;
  const totalBatches = Math.ceil(words.length / batchSize);

  for (let i = 0; i < words.length; i += batchSize) {
    if (abortSignal.aborted) break;

    const batch = words.slice(i, i + batchSize);
    const batchResults = await enrichWordsBatch(apiKey, batch, model);

    for (const [id, result] of batchResults) {
      allResults.set(id, result);
    }

    const completedBatches = Math.floor(i / batchSize) + 1;
    onBatchComplete(completedBatches, totalBatches, batchResults);
  }

  return allResults;
}

export function downloadTemplate(): void {
  const words = useWordStore.getState().words;
  const wb = XLSX.utils.book_new();
  const data = [
    [
      "original",
      "translation",
      "targetLanguage",
      "pinyin (opsional)",
      "notes (opsional)",
    ],
    ...words.map((word) => [
      word.original,
      word.translation,
      word.targetLanguage,
      word.pinyin,
      word.notes,
    ]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  sheet["!cols"] = [
    { wch: 15 },
    { wch: 20 },
    { wch: 16 },
    { wch: 12 },
    { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(wb, sheet, "Kata");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "i-speak-hello-template.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

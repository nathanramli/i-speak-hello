import { useState, useRef } from 'react';
import { useWordStore } from '../../stores/wordStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { cn } from '../../lib/cn';
import {
  parseExcelFile,
  validateRows,
  checkDuplicates,
  toWordCreateInputs,
  enrichWordsWithProgress,
  downloadTemplate,
  type ValidationResult,
  type ImportProgress,
} from '../../lib/xlsx-import';
import type { Word } from '@i-speak-hello/shared';

export function ExcelImportSection() {
  const { words, addWords, updateWord, addSentences } = useWordStore();
  const { settings } = useSettingsStore();
  const hasApiKey = !!settings.openRouterApiKey;

  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [enableEnrichment, setEnableEnrichment] = useState(true);
  const [showSkipped, setShowSkipped] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [enrichedCount, setEnrichedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef({ aborted: false });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidation(null);
    setProgress(null);
    setError(null);
    setImportedCount(0);
    setEnrichedCount(0);

    if (!file.name.endsWith('.xlsx')) {
      setError('File harus berformat .xlsx');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setProgress({ phase: 'parsing', current: 0, total: 1, message: 'Membaca file Excel...' });
      const rows = await parseExcelFile(file);
      const result = validateRows(rows);
      result.duplicates = checkDuplicates(result.validRows, words);
      setValidation(result);
      setEnableEnrichment(hasApiKey);
      setProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membaca file Excel');
      setProgress(null);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    if (!validation) return;

    abortRef.current = { aborted: false };
    setError(null);

    // Filter out duplicates if requested
    const duplicateOriginals = new Set(
      validation.duplicates.map(d => `${d.original.toLowerCase().trim()}|${d.targetLanguage}`)
    );

    const finalRows = skipDuplicates
      ? validation.validRows.filter(
          r => !duplicateOriginals.has(`${r.original.toLowerCase().trim()}|${r.targetLanguage}`)
        )
      : validation.validRows;

    if (finalRows.length === 0) {
      setError('Tidak ada kata untuk diimpor');
      return;
    }

    // Phase 1: Save words
    setProgress({ phase: 'saving', current: 0, total: finalRows.length, message: 'Menyimpan kata...' });

    let savedWords: Word[];
    try {
      const inputs = toWordCreateInputs(finalRows);
      savedWords = await addWords(inputs);
      setProgress({ phase: 'saving', current: finalRows.length, total: finalRows.length, message: 'Kata tersimpan!' });
      setImportedCount(savedWords.length);
    } catch (err) {
      setError('Gagal menyimpan kata');
      setProgress({ phase: 'error', current: 0, total: 0, message: 'Gagal menyimpan' });
      return;
    }

    // Phase 2: AI Enrichment
    if (enableEnrichment && hasApiKey && savedWords.length > 0) {
      const enrichInput = savedWords.map(w => ({
        id: w.id,
        original: w.original,
        translation: w.translation,
        targetLanguage: w.targetLanguage,
      }));

      setProgress({
        phase: 'enriching',
        current: 0,
        total: enrichInput.length,
        message: 'Ditambahkan dengan AI...',
      });

      try {
        const results = await enrichWordsWithProgress(
          settings.openRouterApiKey!,
          enrichInput,
          (completed, total, batchResults) => {
            setProgress({
              phase: 'enriching',
              current: completed,
              total,
              message: `Ditambahkan dengan AI... (${completed}/${total})`,
            });

            // Apply enrichment results as they come
            for (const [wordId, result] of batchResults) {
              const updates: Record<string, unknown> = {};
              if (result.pinyin) updates.pinyin = result.pinyin;
              if (result.distractors.length > 0) updates.distractors = result.distractors;
              if (result.acceptedAnswers.length > 0) updates.acceptedAnswers = result.acceptedAnswers;
              if (Object.keys(updates).length > 0) {
                updateWord(wordId, updates);
              }
              if (result.sentences.length > 0) {
                addSentences(wordId, result.sentences);
              }
            }
          },
          abortRef.current,
          settings.openRouterModel,
        );

        setEnrichedCount(results.size);
      } catch (err) {
        console.warn('AI enrichment failed:', err);
      }
    }

    setProgress({ phase: 'done', current: 0, total: 0, message: 'Selesai!' });
  };

  const handleCancel = () => {
    abortRef.current.aborted = true;
  };

  const handleReset = () => {
    setValidation(null);
    setProgress(null);
    setError(null);
    setImportedCount(0);
    setEnrichedCount(0);
  };

  const isDone = progress?.phase === 'done';
  const isWorking = progress && progress.phase !== 'done' && progress.phase !== 'error';

  return (
    <section className="mb-8 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800">
      <h2 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white">
        📊 Impor Kata dari Excel
      </h2>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Impor banyak kata sekaligus dari file Excel (.xlsx).
      </p>

      {/* Template download + File picker */}
      {!validation && !isWorking && !isDone && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={downloadTemplate}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            📥 Download Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors"
          >
            📂 Pilih File .xlsx
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      )}

      {/* Parsing progress */}
      {progress?.phase === 'parsing' && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Membaca file Excel...</p>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Validation result */}
      {validation && !isWorking && !isDone && (
        <div className="mt-4 space-y-4">
          {/* Summary */}
          <div className="space-y-2">
            {validation.validRows.length > 0 && (
              <p className="text-sm text-green-600 dark:text-green-400">
                ✓ {validation.validRows.length} kata valid ditemukan
              </p>
            )}

            {validation.skippedRows.length > 0 && (
              <div>
                <button
                  onClick={() => setShowSkipped(!showSkipped)}
                  className="text-sm text-orange-500 hover:text-orange-600 dark:text-orange-400"
                >
                  ⚠ {validation.skippedRows.length} baris dilewati {showSkipped ? '▲' : '▼'}
                </button>
                {showSkipped && (
                  <ul className="mt-1 ml-4 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                    {validation.skippedRows.map((s, i) => (
                      <li key={i}>Baris {s.rowNumber}: {s.reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {validation.duplicates.length > 0 && (
              <div>
                <button
                  onClick={() => setShowDuplicates(!showDuplicates)}
                  className="text-sm text-orange-500 hover:text-orange-600 dark:text-orange-400"
                >
                  ⚠ {validation.duplicates.length} kata duplikat {showDuplicates ? '▲' : '▼'}
                </button>
                {showDuplicates && (
                  <ul className="mt-1 ml-4 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                    {validation.duplicates.map((d, i) => (
                      <li key={i}>Baris {d.rowNumber}: "{d.original}" ({d.targetLanguage})</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Options */}
          <div className="space-y-2">
            {validation.duplicates.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={e => setSkipDuplicates(e.target.checked)}
                  className="h-4 w-4 rounded accent-primary"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  Lewati kata duplikat
                </span>
              </label>
            )}

            {hasApiKey && (
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={enableEnrichment}
                  onChange={e => setEnableEnrichment(e.target.checked)}
                  className="h-4 w-4 rounded accent-primary"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  Perkaya dengan AI setelah impor (pinyin, kalimat, quiz)
                </span>
              </label>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={validation.validRows.length === 0}
              className={cn(
                'rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors',
                validation.validRows.length > 0
                  ? 'bg-primary hover:bg-primary-dark'
                  : 'bg-gray-400 cursor-not-allowed'
              )}
            >
              Mulai Impor ({
                skipDuplicates
                  ? validation.validRows.length - validation.duplicates.length
                  : validation.validRows.length
              } kata)
            </button>
            <button
              onClick={handleReset}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {isWorking && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-300">{progress.message}</p>
          {progress.total > 0 && (
            <>
              <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">{progress.current} / {progress.total}</p>
            </>
          )}
          {progress.phase === 'enriching' && (
            <button
              onClick={handleCancel}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 transition-colors"
            >
              Batalkan AI
            </button>
          )}
        </div>
      )}

      {/* Done */}
      {isDone && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-green-600 dark:text-green-400">
            ✓ {importedCount} kata berhasil diimpor!
          </p>
          {enrichedCount > 0 && (
            <p className="text-sm text-green-600 dark:text-green-400">
              ✓ {enrichedCount} kata diperkaya dengan AI
            </p>
          )}
          <button
            onClick={handleReset}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            Impor Lagi
          </button>
        </div>
      )}
    </section>
  );
}

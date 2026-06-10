import { useState } from "react";
import type { TargetLanguage, WordCreateInput } from "@i-speak-hello/shared";
import { LANGUAGES } from "@i-speak-hello/shared";
import { useWordStore } from "../../stores/wordStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { enrichWordFull, enrichWord } from "../../lib/openrouter";
import { cn } from "../../lib/cn";
import { ExcelImportSection } from "../import/ExcelImportSection";

interface WordFormProps {
  onSaved?: () => void;
}

export function WordForm({ onSaved }: WordFormProps) {
  const { addWord, updateWord, addSentences } = useWordStore();
  const { settings } = useSettingsStore();

  const hasApiKey = !!settings.openRouterApiKey;

  const [targetLanguage, setTargetLanguage] = useState<TargetLanguage>(
    settings.learningLanguages[0] ?? "zh",
  );
  const [original, setOriginal] = useState("");
  const [translation, setTranslation] = useState(""); // only used when no API key
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!original.trim()) return;
    // Without API key, translation is required
    if (!hasApiKey && !translation.trim()) return;

    setSaving(true);
    setError("");

    try {
      if (hasApiKey) {
        // AI-powered flow: only the foreign word is needed
        setEnriching(true);
        try {
          const result = await enrichWordFull(
            settings.openRouterApiKey!,
            original.trim(),
            targetLanguage,
            settings.openRouterModel,
          );

          const input: WordCreateInput = {
            targetLanguage,
            original: original.trim(),
            translation: result.translation || original.trim(),
            notes: notes.trim() || undefined,
          };

          const word = await addWord(input);

          // Update word with pinyin, distractors, acceptedAnswers
          const updates: Record<string, unknown> = {};
          if (result.pinyin) updates.pinyin = result.pinyin;
          if (result.distractors.length > 0)
            updates.distractors = result.distractors;
          if (result.acceptedAnswers.length > 0)
            updates.acceptedAnswers = result.acceptedAnswers;
          if (Object.keys(updates).length > 0) {
            await updateWord(word.id, updates);
          }

          // Add sentences
          if (result.sentences.length > 0) {
            await addSentences(word.id, result.sentences);
          }
        } catch (err) {
          console.error("AI enrichment failed:", err);
          setError(
            "Gagal menghubungi AI. Coba lagi atau tambahkan secara manual.",
          );
          setSaving(false);
          setEnriching(false);
          return;
        }
        setEnriching(false);
      } else {
        // Manual flow: user provides translation
        const input: WordCreateInput = {
          targetLanguage,
          original: original.trim(),
          translation: translation.trim(),
          notes: notes.trim() || undefined,
        };

        await addWord(input);
      }

      // Reset form
      setOriginal("");
      setTranslation("");
      setNotes("");
      onSaved?.();
    } catch (err) {
      setError("Gagal menyimpan kata. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-stone-800 dark:text-white">
        Tambah Kata Baru
      </h2>

      {/* Language selector */}
      <div>
        <label className="mb-1 block text-sm font-medium text-stone-600 dark:text-stone-300">
          Bahasa yang dipelajari
        </label>
        <div className="flex gap-2">
          {settings.learningLanguages.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setTargetLanguage(lang)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                targetLanguage === lang
                  ? "bg-primary text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-700 dark:text-stone-300",
              )}
            >
              {LANGUAGES[lang].flag} {LANGUAGES[lang].nativeName}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <ExcelImportSection />
      </div>

      {/* Word */}
      <div>
        <label className="mb-1 block text-sm font-medium text-stone-600 dark:text-stone-300">
          Kata ({LANGUAGES[targetLanguage].nativeName})
        </label>
        <input
          type="text"
          value={original}
          onChange={(e) => setOriginal(e.target.value)}
          placeholder={targetLanguage === "zh" ? "你好" : "hello"}
          className="w-full rounded-lg border border-stone-200 px-4 py-2 outline-none focus:border-primary dark:border-stone-600 dark:bg-stone-800 dark:text-white"
          required
        />
        {hasApiKey && (
          <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
            {targetLanguage === "zh"
              ? "🤖 Cukup tulis hanzi — AI auto-generate arti, pinyin, kalimat & quiz"
              : "🤖 AI akan otomatis menerjemahkan dan membuat contoh kalimat"}
          </p>
        )}
      </div>

      {/* Translation — only shown when no API key */}
      {!hasApiKey && (
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-600 dark:text-stone-300">
            Arti (Bahasa Indonesia)
          </label>
          <input
            type="text"
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
            placeholder="halo"
            className="w-full rounded-lg border border-stone-200 px-4 py-2 outline-none focus:border-primary dark:border-stone-600 dark:bg-stone-800 dark:text-white"
            required
          />
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="mb-1 block text-sm font-medium text-stone-600 dark:text-stone-300">
          Catatan (opsional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Catatan pribadi tentang kata ini..."
          rows={2}
          className="w-full rounded-lg border border-stone-200 px-4 py-2 outline-none focus:border-primary dark:border-stone-600 dark:bg-stone-800 dark:text-white"
        />
      </div>

      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={
          saving || !original.trim() || (!hasApiKey && !translation.trim())
        }
        className={cn(
          "w-full rounded-lg py-3 font-medium text-white transition-colors",
          saving
            ? "bg-stone-400 cursor-not-allowed"
            : "bg-primary hover:bg-primary-dark",
        )}
      >
        {saving
          ? enriching
            ? "🤖 AI: terjemah + pinyin + kalimat + quiz..."
            : "Menyimpan..."
          : "Simpan Kata"}
      </button>

      {!hasApiKey && (
        <p className="text-center text-xs text-stone-400 dark:text-stone-500">
          💡 Tambahkan OpenRouter API key di Pengaturan untuk auto-translate dan
          generate kalimat
        </p>
      )}
    </form>
  );
}

import { useEffect, useState, useRef } from 'react';
import type { TargetLanguage, QuizType } from '@i-speak-hello/shared';
import { LANGUAGES, DEFAULT_OPENROUTER_MODEL } from '@i-speak-hello/shared';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { exportData, importData, downloadBackupFile, readBackupFile, getLastBackupTimestamp } from '../../src/lib/backup';
import { cn } from '../../src/lib/cn';
import { useTheme } from '../../src/hooks/useTheme';
import { ExcelImportSection } from '../../src/components/import/ExcelImportSection';

const OPENROUTER_MODEL_SUGGESTIONS = [
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'openai/gpt-5-mini',
  'anthropic/claude-haiku-4.5',
  'meta-llama/llama-3.3-70b-instruct',
  'deepseek/deepseek-chat-v3.1',
];

const ALL_QUIZ_TYPES: { key: QuizType; label: string; desc: string }[] = [
  { key: 'flashcard', label: '🃏 Flashcard', desc: 'Kartu bolak-balik' },
  { key: 'mcq', label: '📝 Pilihan Ganda', desc: 'Pilih jawaban benar dari 4 opsi' },
  { key: 'typing', label: '⌨️ Ketik Jawaban', desc: 'Tulis arti kata' },
  { key: 'sentence', label: '📖 Lengkapi Kalimat', desc: 'Isi kata yang hilang dalam kalimat' },
];

const ALL_LANGUAGES: { key: TargetLanguage; label: string }[] = [
  { key: 'zh', label: `${LANGUAGES.zh.flag} ${LANGUAGES.zh.nativeName}` },
  { key: 'en', label: `${LANGUAGES.en.flag} ${LANGUAGES.en.nativeName}` },
];

export default function App() {
  const { settings, loadSettings, updateSettings } = useSettingsStore();
  const [saved, setSaved] = useState(false);
  const [newSite, setNewSite] = useState('');
  const [lastBackupTime, setLastBackupTime] = useState<number | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useTheme(settings.theme);

  useEffect(() => {
    loadSettings();
    getLastBackupTimestamp().then(setLastBackupTime);
  }, [loadSettings]);

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleLanguage = (lang: TargetLanguage) => {
    const langs = settings.learningLanguages.includes(lang)
      ? settings.learningLanguages.filter(l => l !== lang)
      : [...settings.learningLanguages, lang];
    if (langs.length === 0) return;
    updateSettings({ learningLanguages: langs });
    showSaved();
  };

  const toggleQuizType = (type: QuizType) => {
    const types = settings.quizTypes.includes(type)
      ? settings.quizTypes.filter(t => t !== type)
      : [...settings.quizTypes, type];
    if (types.length === 0) return;
    updateSettings({ quizTypes: types });
    showSaved();
  };

  const handleExport = async () => {
    const data = await exportData();
    downloadBackupFile(data);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('Mengimpor...');
    try {
      const data = await readBackupFile(file);
      await importData(data);
      setImportStatus('✓ Data berhasil dipulihkan! Muat ulang halaman...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setImportStatus(`✗ ${err instanceof Error ? err.message : 'Gagal mengimpor'}`);
      setTimeout(() => setImportStatus(null), 3000);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Gradient accent stripe */}
        <div className="h-1 w-20 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 mb-6" />
        <h1 className="mb-6 text-2xl font-bold text-stone-900 dark:text-white">
          ⚙️ Pengaturan
        </h1>

        {saved && (
          <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-green-600 text-white px-4 py-2.5 text-sm font-medium shadow-lg animate-slide-up">
            ✓ Tersimpan
          </div>
        )}

        {/* Learning Languages */}
        <section className="mb-8 rounded-2xl bg-surface-1 ring-1 ring-stone-900/5 dark:ring-white/5 p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-stone-800 dark:text-white">
            Bahasa yang dipelajari
          </h2>
          <div className="flex gap-3">
            {ALL_LANGUAGES.map(lang => (
              <button
                key={lang.key}
                onClick={() => toggleLanguage(lang.key)}
                className={cn(
                  'rounded-lg px-4 py-3 text-sm font-medium transition-all',
                  settings.learningLanguages.includes(lang.key)
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-700 dark:text-stone-300'
                )}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </section>

        {/* Quiz Types */}
        <section className="mb-8 rounded-2xl bg-surface-1 ring-1 ring-stone-900/5 dark:ring-white/5 p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-stone-800 dark:text-white">
            Tipe Quiz
          </h2>
          <div className="space-y-2">
            {ALL_QUIZ_TYPES.map(qt => (
              <label
                key={qt.key}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-stone-50 dark:hover:bg-stone-700"
              >
                <input
                  type="checkbox"
                  checked={settings.quizTypes.includes(qt.key)}
                  onChange={() => toggleQuizType(qt.key)}
                  className="h-4 w-4 rounded accent-primary"
                />
                <div>
                  <p className="font-medium text-stone-700 dark:text-stone-200">{qt.label}</p>
                  <p className="text-xs text-stone-400">{qt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Quiz Difficulty Bias */}
        <section className="mb-8 rounded-2xl bg-surface-1 ring-1 ring-stone-900/5 dark:ring-white/5 p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-stone-800 dark:text-white">
            📊 Tingkat Kesulitan Quiz
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-xs text-stone-400">Mudah</span>
            <input
              type="range"
              min="0"
              max="100"
              step="10"
              value={settings.difficultyBias}
              onChange={e => {
                updateSettings({ difficultyBias: parseInt(e.target.value) });
                showSaved();
              }}
              className="flex-1 accent-primary"
            />
            <span className="text-xs text-stone-400">Sulit</span>
            <span className="min-w-[3rem] text-center text-lg font-bold text-primary">
              {settings.difficultyBias}
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
            Rendah = lebih banyak flashcard/pilihan ganda. Tinggi = lebih banyak ketik/kalimat
          </p>
        </section>

        {/* New Word Ratio */}
        <section className="mb-8 rounded-2xl bg-surface-1 ring-1 ring-stone-900/5 dark:ring-white/5 p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-stone-800 dark:text-white">
            📐 Rasio Kata Baru
          </h2>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="50"
              step="5"
              value={settings.newWordRatio}
              onChange={e => {
                updateSettings({ newWordRatio: parseInt(e.target.value) });
                showSaved();
              }}
              className="flex-1 accent-primary"
            />
            <span className="min-w-[3rem] text-center text-lg font-bold text-primary">
              {settings.newWordRatio}%
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
            Persentase kata baru dalam setiap sesi quiz (sisanya kata review)
          </p>
        </section>

        {/* Daily Goal */}
        <section className="mb-8 rounded-2xl bg-surface-1 ring-1 ring-stone-900/5 dark:ring-white/5 p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-stone-800 dark:text-white">
            Target harian
          </h2>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={settings.dailyGoal}
              onChange={e => {
                updateSettings({ dailyGoal: parseInt(e.target.value) });
                showSaved();
              }}
              className="flex-1 accent-primary"
            />
            <span className="min-w-[3rem] text-center text-lg font-bold text-primary">
              {settings.dailyGoal}
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">Jumlah kata yang ingin kamu review per hari</p>
        </section>

        {/* Words per session */}
        <section className="mb-8 rounded-2xl bg-surface-1 ring-1 ring-stone-900/5 dark:ring-white/5 p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-stone-800 dark:text-white">
            Kata per sesi quiz
          </h2>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="5"
              max="30"
              step="5"
              value={settings.wordsPerSession}
              onChange={e => {
                updateSettings({ wordsPerSession: parseInt(e.target.value) });
                showSaved();
              }}
              className="flex-1 accent-primary"
            />
            <span className="min-w-[3rem] text-center text-lg font-bold text-primary">
              {settings.wordsPerSession}
            </span>
          </div>
        </section>

        {/* Mandarin settings */}
        {settings.learningLanguages.includes('zh') && (
          <section className="mb-8 rounded-2xl bg-surface-1 ring-1 ring-stone-900/5 dark:ring-white/5 p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-stone-800 dark:text-white">
              🇨🇳 Pengaturan Mandarin
            </h2>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={settings.showPinyin}
                onChange={e => {
                  updateSettings({ showPinyin: e.target.checked });
                  showSaved();
                }}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-stone-700 dark:text-stone-200">Tampilkan pinyin</span>
            </label>
          </section>
        )}

        {/* Audio */}
        <section className="mb-8 rounded-2xl bg-surface-1 ring-1 ring-stone-900/5 dark:ring-white/5 p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-stone-800 dark:text-white">
            🔊 Audio
          </h2>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={settings.autoPlayAudio}
                onChange={e => {
                  updateSettings({ autoPlayAudio: e.target.checked });
                  showSaved();
                }}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-stone-700 dark:text-stone-200">Auto-play pengucapan saat review</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={settings.autoSpeakOnQuiz}
                onChange={e => {
                  updateSettings({ autoSpeakOnQuiz: e.target.checked });
                  showSaved();
                }}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-stone-700 dark:text-stone-200">Auto-putar saat quiz muncul</span>
            </label>
          </div>
        </section>

        {/* Study Reminder */}
        <section className="mb-8 rounded-2xl bg-surface-1 ring-1 ring-stone-900/5 dark:ring-white/5 p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-stone-800 dark:text-white">
            ⏰ Pengingat Belajar
          </h2>
          <label className="mb-3 flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={settings.reminderEnabled}
              onChange={e => {
                updateSettings({ reminderEnabled: e.target.checked });
                showSaved();
              }}
              className="h-4 w-4 rounded accent-primary"
            />
            <span className="text-stone-700 dark:text-stone-200">Aktifkan pengingat harian</span>
          </label>
          {settings.reminderEnabled && (
            <div className="mt-2">
              <label className="mb-1 block text-sm font-medium text-stone-600 dark:text-stone-300">
                Waktu pengingat
              </label>
              <input
                type="time"
                value={settings.reminderTime}
                onChange={e => {
                  updateSettings({ reminderTime: e.target.value });
                  showSaved();
                }}
                className="rounded-lg border border-stone-200 px-4 py-2 outline-none focus:border-primary dark:border-stone-600 dark:bg-stone-700 dark:text-white"
              />
              <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                Notifikasi browser akan muncul saat ada kata yang perlu di-review
              </p>
            </div>
          )}
        </section>

        {/* OpenRouter API Key */}
        <section className="mb-8 rounded-2xl bg-surface-1 ring-1 ring-stone-900/5 dark:ring-white/5 p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-stone-800 dark:text-white">
            🤖 OpenRouter API Key
          </h2>
          <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">
            Untuk auto-translate, generate contoh kalimat, pinyin, dan opsi quiz saat menambah kata baru.
            Dapatkan API key gratis di{' '}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              openrouter.ai/keys
            </a>
          </p>
          <input
            type="password"
            value={settings.openRouterApiKey ?? ''}
            onChange={e => {
              updateSettings({ openRouterApiKey: e.target.value || undefined });
              showSaved();
            }}
            placeholder="sk-or-v1-..."
            className="w-full rounded-lg border border-stone-200 px-4 py-2 font-mono text-sm outline-none focus:border-primary dark:border-stone-600 dark:bg-stone-700 dark:text-white"
          />
          {settings.openRouterApiKey && (
            <p className="mt-2 text-xs text-green-600 dark:text-green-400">✓ API key tersimpan</p>
          )}

          {/* Model selection */}
          {settings.openRouterApiKey && (
            <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-700">
              <label className="mb-1 block text-sm font-medium text-stone-600 dark:text-stone-300">
                Model AI
              </label>
              <input
                type="text"
                list="openrouter-models"
                value={settings.openRouterModel ?? ''}
                onChange={e => {
                  updateSettings({ openRouterModel: e.target.value.trim() || undefined });
                  showSaved();
                }}
                placeholder={DEFAULT_OPENROUTER_MODEL}
                className="w-full rounded-lg border border-stone-200 px-4 py-2 font-mono text-sm outline-none focus:border-primary dark:border-stone-600 dark:bg-stone-700 dark:text-white"
              />
              <datalist id="openrouter-models">
                {OPENROUTER_MODEL_SUGGESTIONS.map(m => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              {settings.openRouterModel && !/^[\w.-]+\/[\w.:-]+$/.test(settings.openRouterModel) && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  ⚠ Format tidak valid. Gunakan format "provider/model", mis. {DEFAULT_OPENROUTER_MODEL}.
                </p>
              )}
              <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                ID model OpenRouter. Kosongkan untuk default ({DEFAULT_OPENROUTER_MODEL}). Lihat daftar di{' '}
                <a
                  href="https://openrouter.ai/models"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  openrouter.ai/models
                </a>
              </p>
            </div>
          )}

          {/* Sentence refresh interval */}
          {settings.openRouterApiKey && (
            <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-700">
              <label className="mb-1 block text-sm font-medium text-stone-600 dark:text-stone-300">
                Auto-refresh kalimat AI
              </label>
              <select
                value={settings.sentenceRefreshDays ?? 0}
                onChange={e => {
                  updateSettings({ sentenceRefreshDays: parseInt(e.target.value) });
                  showSaved();
                }}
                className="rounded-lg border border-stone-200 px-4 py-2 outline-none focus:border-primary dark:border-stone-600 dark:bg-stone-700 dark:text-white"
              >
                <option value="0">Off</option>
                <option value="7">Setiap 7 hari</option>
                <option value="14">Setiap 14 hari</option>
                <option value="30">Setiap 30 hari</option>
              </select>
              <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                Otomatis regenerate kalimat contoh & opsi quiz untuk variasi belajar
              </p>
            </div>
          )}
        </section>

        {/* Theme */}
        <section className="mb-8 rounded-2xl bg-surface-1 ring-1 ring-stone-900/5 dark:ring-white/5 p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-stone-800 dark:text-white">
            🎨 Tema
          </h2>
          <div className="flex gap-2">
            {(['light', 'dark', 'system'] as const).map(theme => (
              <button
                key={theme}
                onClick={() => {
                  updateSettings({ theme });
                  showSaved();
                }}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  settings.theme === theme
                    ? 'bg-primary text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-700 dark:text-stone-300'
                )}
              >
                {theme === 'light' && '☀️ Terang'}
                {theme === 'dark' && '🌙 Gelap'}
                {theme === 'system' && '💻 Sistem'}
              </button>
            ))}
          </div>
        </section>

        {/* Site Quiz */}
        <section className="mb-8 rounded-2xl bg-surface-1 ring-1 ring-stone-900/5 dark:ring-white/5 p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold text-stone-800 dark:text-white">
            🧠 Site Quiz
          </h2>
          <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
            Tampilkan quiz sebelum membuka situs tertentu. Belajar kata baru sambil browsing!
          </p>

          <label className="mb-4 flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={settings.siteBlocker?.enabled ?? false}
              onChange={e => {
                updateSettings({
                  siteBlocker: { ...settings.siteBlocker, enabled: e.target.checked },
                });
                showSaved();
              }}
              className="h-4 w-4 rounded accent-primary"
            />
            <span className="font-medium text-stone-700 dark:text-stone-200">Aktifkan Site Quiz</span>
          </label>

          {settings.siteBlocker?.enabled && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-600 dark:text-stone-300">
                  Tambah situs
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSite}
                    onChange={e => setNewSite(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newSite.trim()) {
                        const site = newSite.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
                        if (site && !settings.siteBlocker.blockedSites.includes(site)) {
                          updateSettings({
                            siteBlocker: {
                              ...settings.siteBlocker,
                              blockedSites: [...settings.siteBlocker.blockedSites, site],
                            },
                          });
                          setNewSite('');
                          showSaved();
                        }
                      }
                    }}
                    placeholder="contoh: youtube.com"
                    className="flex-1 rounded-lg border border-stone-200 px-4 py-2 text-sm outline-none focus:border-primary dark:border-stone-600 dark:bg-stone-700 dark:text-white"
                  />
                  <button
                    onClick={() => {
                      const site = newSite.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
                      if (site && !settings.siteBlocker.blockedSites.includes(site)) {
                        updateSettings({
                          siteBlocker: {
                            ...settings.siteBlocker,
                            blockedSites: [...settings.siteBlocker.blockedSites, site],
                          },
                        });
                        setNewSite('');
                        showSaved();
                      }
                    }}
                    className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark"
                  >
                    Tambah
                  </button>
                </div>
              </div>

              {settings.siteBlocker.blockedSites.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-600 dark:text-stone-300">
                    Situs yang diblokir
                  </label>
                  <div className="space-y-1">
                    {settings.siteBlocker.blockedSites.map(site => (
                      <div
                        key={site}
                        className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2"
                      >
                        <span className="text-sm text-stone-700 dark:text-stone-200">🌐 {site}</span>
                        <button
                          onClick={() => {
                            updateSettings({
                              siteBlocker: {
                                ...settings.siteBlocker,
                                blockedSites: settings.siteBlocker.blockedSites.filter(s => s !== site),
                              },
                            });
                            showSaved();
                          }}
                          className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300"
                        >
                          Hapus
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-600 dark:text-stone-300">
                  Jumlah pertanyaan untuk membuka situs
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={settings.siteBlocker.questionsToUnlock}
                    onChange={e => {
                      updateSettings({
                        siteBlocker: {
                          ...settings.siteBlocker,
                          questionsToUnlock: parseInt(e.target.value),
                        },
                      });
                      showSaved();
                    }}
                    className="flex-1 accent-primary"
                  />
                  <span className="min-w-[2rem] text-center text-lg font-bold text-primary">
                    {settings.siteBlocker.questionsToUnlock}
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-600 dark:text-stone-300">
                  Durasi unlock setelah quiz (menit)
                </label>
                <input
                  type="number"
                  min="1"
                  max="480"
                  value={settings.siteBlocker.unlockDurationMinutes ?? 30}
                  onChange={e => {
                    const val = Math.max(1, Math.min(480, parseInt(e.target.value) || 30));
                    updateSettings({
                      siteBlocker: {
                        ...settings.siteBlocker,
                        unlockDurationMinutes: val,
                      },
                    });
                    showSaved();
                  }}
                  className="w-24 rounded-lg border border-stone-200 px-4 py-2 text-center outline-none focus:border-primary dark:border-stone-600 dark:bg-stone-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                  Situs akan tetap terbuka selama {settings.siteBlocker.unlockDurationMinutes ?? 30} menit setelah menjawab quiz
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-600 dark:text-stone-300">
                  Waktu tunggu untuk melewati (detik)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="5"
                    value={settings.siteBlocker.skipCooldownSeconds}
                    onChange={e => {
                      updateSettings({
                        siteBlocker: {
                          ...settings.siteBlocker,
                          skipCooldownSeconds: parseInt(e.target.value),
                        },
                      });
                      showSaved();
                    }}
                    className="flex-1 accent-primary"
                  />
                  <span className="min-w-[3rem] text-center text-lg font-bold text-primary">
                    {settings.siteBlocker.skipCooldownSeconds === 0
                      ? 'Off'
                      : `${settings.siteBlocker.skipCooldownSeconds}s`}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                  {settings.siteBlocker.skipCooldownSeconds === 0
                    ? 'Tidak bisa melewati — harus menjawab semua pertanyaan'
                    : `Bisa melewati setelah menunggu ${settings.siteBlocker.skipCooldownSeconds} detik`}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Excel Import */}
        <ExcelImportSection />

        {/* Backup & Restore */}
        <section className="mb-8 rounded-2xl bg-surface-1 ring-1 ring-stone-900/5 dark:ring-white/5 p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-stone-800 dark:text-white">
            💾 Backup & Restore
          </h2>
          <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
            Data otomatis di-backup ke IndexedDB setiap 30 menit. Kamu juga bisa ekspor/impor secara manual.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors"
            >
              📥 Ekspor Data
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-700 transition-colors"
            >
              📤 Impor Data
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
          </div>
          {importStatus && (
            <p className={cn(
              'mt-3 text-sm',
              importStatus.startsWith('✓') ? 'text-green-600 dark:text-green-400' : importStatus.startsWith('✗') ? 'text-red-500 dark:text-red-400' : 'text-stone-500'
            )}>
              {importStatus}
            </p>
          )}
          {lastBackupTime && (
            <p className="mt-3 text-xs text-stone-400 dark:text-stone-500">
              Auto-backup terakhir: {new Date(lastBackupTime).toLocaleString('id-ID')}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

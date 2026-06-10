import { useState, useEffect } from 'react';
import { QuizContainer } from '../../src/components/quiz/QuizContainer';
import { WordList } from '../../src/components/words/WordList';
import { WordForm } from '../../src/components/words/WordForm';
import { useWordStore } from '../../src/stores/wordStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useStreakStore } from '../../src/stores/streakStore';
import { StatusBar } from '../../src/components/gamification/StatusBar';
import { StudyHeatmap } from '../../src/components/gamification/StudyHeatmap';
import { cn } from '../../src/lib/cn';
import { useTheme } from '../../src/hooks/useTheme';

type Tab = 'home' | 'words' | 'add';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi! 👋';
  if (h < 15) return 'Selamat siang! 👋';
  if (h < 18) return 'Selamat sore! 👋';
  return 'Selamat malam! 👋';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [quizActive, setQuizActive] = useState(false);
  const { words, loadWords, getDueWords } = useWordStore();
  const { settings, loadSettings } = useSettingsStore();
  const { streak, todayReviewed, level, loadStreak } = useStreakStore();
  const [loading, setLoading] = useState(true);
  const [seedingStatus, setSeedingStatus] = useState<string | null>(null);

  useTheme(settings.theme);

  useEffect(() => {
    Promise.all([loadWords(), loadSettings(), loadStreak()]).then(() => {
      setLoading(false);
    });
  }, [loadWords, loadSettings, loadStreak]);

  const hasWords = words.length > 0;
  const dueCount = getDueWords().length;
  const dailyComplete = todayReviewed >= settings.dailyGoal;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-4xl animate-bounce">🌏</p>
          <p className="mt-2 text-stone-500">Memuat...</p>
        </div>
      </div>
    );
  }

  // Contextual subtitle for greeting
  let subtitle = '';
  if (!hasWords) {
    subtitle = 'Tambahkan kata pertamamu untuk mulai belajar';
  } else if (dueCount > 0 && !dailyComplete && todayReviewed === 0 && streak > 0) {
    subtitle = `Jangan putus streak ${streak} hari-mu!`;
  } else if (dueCount > 0) {
    subtitle = `${dueCount} kata menunggu review-mu`;
  } else {
    subtitle = 'Semua kata sudah di-review. Kembali lagi besok!';
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Sticky Top Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-stone-950/80 border-b border-stone-200/50 dark:border-stone-700/50">
        <div className="mx-auto max-w-2xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌏</span>
            <span className="text-lg font-bold text-stone-900 dark:text-white">I Speak Hello</span>
          </div>
          <StatusBar
            streak={streak}
            reviewed={todayReviewed}
            goal={settings.dailyGoal}
            level={level}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className={cn(
        'flex-1 px-4 sm:px-6 pb-24',
        activeTab === 'home' && quizActive ? 'flex items-start justify-center pt-6 sm:pt-10' : 'pt-6',
      )}>
        <div className={cn(
          'w-full',
          activeTab === 'home' ? 'max-w-md mx-auto' : 'max-w-2xl mx-auto',
        )}>

          {/* HOME TAB */}
          {activeTab === 'home' && !quizActive && (
            hasWords ? (
              /* ===== DASHBOARD ===== */
              <div>
                {/* Greeting */}
                <div className="mb-5">
                  <h2 className="text-2xl font-extrabold text-stone-900 dark:text-white mb-1">
                    {dueCount === 0 && dailyComplete ? 'Kerja bagus! 🎉' : getGreeting()}
                  </h2>
                  <p className="text-stone-500 dark:text-stone-400 text-sm">{subtitle}</p>
                </div>

                {/* Daily Progress */}
                <div className={cn(
                  'rounded-2xl p-4 shadow-sm mb-5 ring-1',
                  dailyComplete
                    ? 'bg-green-50 dark:bg-green-950/20 ring-green-200 dark:ring-green-800'
                    : 'bg-surface-1 ring-stone-900/5 dark:ring-white/5',
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={cn(
                      'text-sm font-semibold',
                      dailyComplete ? 'text-green-700 dark:text-green-300' : 'text-stone-700 dark:text-stone-200',
                    )}>
                      {dailyComplete ? '🎉 Target Tercapai!' : 'Progres Hari Ini'}
                    </h3>
                    <span className={cn(
                      'text-xs',
                      dailyComplete ? 'text-green-600 dark:text-green-400 font-medium' : 'text-stone-400',
                    )}>
                      {todayReviewed} / {settings.dailyGoal} target
                    </span>
                  </div>
                  <div className={cn(
                    'h-2.5 overflow-hidden rounded-full',
                    dailyComplete ? 'bg-green-200 dark:bg-green-900/40' : 'bg-stone-100 dark:bg-stone-700',
                  )}>
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        dailyComplete
                          ? 'bg-gradient-to-r from-green-600 to-green-400'
                          : 'bg-gradient-to-r from-teal-600 to-teal-400',
                      )}
                      style={{ width: `${Math.min((todayReviewed / settings.dailyGoal) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Start Quiz Button */}
                <div className="mb-6">
                  <button
                    onClick={() => setQuizActive(true)}
                    className="border-light-btn w-full cursor-pointer group"
                  >
                    <div className="btn-inner text-white py-5 px-6">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                        <div className="text-left">
                          <p className="text-lg font-bold">Mulai Quiz</p>
                          <p className="text-sm text-teal-200 font-normal">
                            {dueCount > 0 ? `${dueCount} kata perlu review` : 'Latihan tambahan'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Study Calendar Heatmap */}
                <StudyHeatmap />
              </div>
            ) : (
              /* ===== WELCOME / EMPTY STATE ===== */
              <div className="text-center pt-4">
                <div className="text-7xl mb-6 animate-scale-in">🌏</div>
                <h1 className="text-3xl font-extrabold text-stone-900 dark:text-white mb-3 animate-slide-up">
                  Mulai Perjalanan<br/>Bahasamu
                </h1>
                <p className="text-stone-500 dark:text-stone-400 mb-10 animate-slide-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
                  Belajar kata-kata baru setiap hari dengan metode spaced repetition
                </p>

                {/* Fanned Preview Cards */}
                <div className="relative h-32 mb-10 flex justify-center items-center animate-slide-up" style={{ animationDelay: '0.2s', opacity: 0 }}>
                  <div className="absolute w-40 h-24 rounded-2xl bg-surface-1 ring-1 ring-stone-900/5 dark:ring-white/5 shadow-lg flex flex-col items-center justify-center -rotate-6 -translate-x-12 opacity-60">
                    <p className="text-2xl font-bold text-stone-900 dark:text-white">你好</p>
                    <p className="text-xs text-stone-400 mt-1">Halo</p>
                  </div>
                  <div className="absolute w-40 h-24 rounded-2xl bg-surface-1 ring-1 ring-stone-900/5 dark:ring-white/5 shadow-xl flex flex-col items-center justify-center z-10">
                    <p className="text-2xl font-bold text-stone-900 dark:text-white">Hello</p>
                    <p className="text-xs text-stone-400 mt-1">Halo</p>
                  </div>
                  <div className="absolute w-40 h-24 rounded-2xl bg-surface-1 ring-1 ring-stone-900/5 dark:ring-white/5 shadow-lg flex flex-col items-center justify-center rotate-6 translate-x-12 opacity-60">
                    <p className="text-2xl font-bold text-stone-900 dark:text-white">谢谢</p>
                    <p className="text-xs text-stone-400 mt-1">Terima kasih</p>
                  </div>
                </div>

                {/* CTAs */}
                <div className="space-y-3 animate-slide-up" style={{ animationDelay: '0.3s', opacity: 0 }}>
                  <button
                    onClick={() => setActiveTab('add')}
                    disabled={!!seedingStatus}
                    className="w-full rounded-2xl bg-primary hover:bg-primary-dark py-4 text-lg font-semibold text-white shadow-lg shadow-teal-600/25 hover:shadow-xl transition-all"
                  >
                    Tambah Kata Sendiri
                  </button>

                  <div className="flex items-center gap-3 text-stone-400">
                    <div className="flex-1 h-px bg-stone-200 dark:bg-stone-700" />
                    <span className="text-xs">atau</span>
                    <div className="flex-1 h-px bg-stone-200 dark:bg-stone-700" />
                  </div>

                  <button
                    onClick={async () => {
                      setSeedingStatus('Memuat kata...');
                      const { SEED_WORDS } = await import('../../src/lib/seed-data');
                      const { addWord, updateWord, addSentences } = useWordStore.getState();
                      const { settings: currentSettings } = useSettingsStore.getState();

                      const addedWords = [];
                      for (const input of SEED_WORDS) {
                        const w = await addWord(input);
                        addedWords.push(w);
                      }
                      await chrome.storage.local.set({ seeded: true });

                      if (currentSettings.openRouterApiKey) {
                        setSeedingStatus('AI sedang generate pinyin + kalimat + opsi quiz...');
                        try {
                          const { enrichWordsBatch } = await import('../../src/lib/openrouter');
                          const results = await enrichWordsBatch(
                            currentSettings.openRouterApiKey,
                            addedWords.map(w => ({
                              id: w.id,
                              original: w.original,
                              translation: w.translation,
                              targetLanguage: w.targetLanguage,
                            })),
                            currentSettings.openRouterModel,
                          );

                          for (const [wordId, result] of results) {
                            const updates: Record<string, unknown> = {};
                            if (result.pinyin) updates.pinyin = result.pinyin;
                            if (result.distractors.length > 0) updates.distractors = result.distractors;
                            if (result.acceptedAnswers.length > 0) updates.acceptedAnswers = result.acceptedAnswers;
                            if (Object.keys(updates).length > 0) {
                              await updateWord(wordId, updates);
                            }
                            if (result.sentences.length > 0) {
                              await addSentences(wordId, result.sentences);
                            }
                          }
                        } catch (err) {
                          console.warn('Batch enrich failed:', err);
                        }
                      }

                      setSeedingStatus(null);
                    }}
                    disabled={!!seedingStatus}
                    className={cn(
                      'w-full rounded-2xl border-2 py-4 text-lg font-semibold transition-all',
                      seedingStatus
                        ? 'border-stone-300 text-stone-400 cursor-wait dark:border-stone-600'
                        : 'border-stone-200 dark:border-stone-600 bg-surface-1 text-stone-700 dark:text-stone-200 hover:border-teal-400 dark:hover:border-teal-500 hover:shadow-md'
                    )}
                  >
                    {seedingStatus || '📦 Muat 50 Kata Bawaan'}
                  </button>

                  <p className="text-xs text-stone-400 mt-2">
                    25 kata Mandarin + 25 kata English dengan terjemahan Indonesia
                  </p>
                </div>
              </div>
            )
          )}

          {/* HOME TAB - QUIZ ACTIVE */}
          {activeTab === 'home' && quizActive && (
            <QuizContainer onGoToWords={() => { setQuizActive(false); setActiveTab('words'); }} onFinish={() => setQuizActive(false)} />
          )}

          {activeTab === 'words' && <WordList />}
          {activeTab === 'add' && <WordForm onSaved={() => setActiveTab('words')} />}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-40 backdrop-blur-xl bg-white/90 dark:bg-stone-950/90 border-t border-stone-200/50 dark:border-stone-700/50">
        <div className="mx-auto max-w-md flex justify-around py-2 pb-3">
          {([
            { key: 'home' as Tab, label: 'Beranda', icon: '🏠' },
            { key: 'words' as Tab, label: `Kata Saya (${words.length})`, icon: '📚' },
            { key: 'add' as Tab, label: 'Tambah', icon: '➕' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); if (tab.key !== 'home') setQuizActive(false); }}
              className={cn(
                'flex flex-col items-center gap-0.5 px-4 py-1 transition-colors relative',
                activeTab === tab.key
                  ? 'text-teal-600 dark:text-teal-400'
                  : 'text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'
              )}
            >
              {activeTab === tab.key && (
                <div className="absolute -top-0.5 w-5 h-0.5 rounded-full bg-teal-500" />
              )}
              <span className="text-lg">{tab.icon}</span>
              <span className={cn('text-[10px]', activeTab === tab.key ? 'font-semibold' : 'font-medium')}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

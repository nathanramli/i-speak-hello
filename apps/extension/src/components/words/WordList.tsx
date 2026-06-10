import { useState } from 'react';
import type { Word, TargetLanguage } from '@i-speak-hello/shared';
import { LANGUAGES, getSRSStatus } from '@i-speak-hello/shared';
import { useWordStore } from '../../stores/wordStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { enrichWord } from '../../lib/openrouter';
import { WordCard } from './WordCard';
import { cn } from '../../lib/cn';

type LangFilter = 'all' | TargetLanguage;
type StatusFilter = 'all' | 'new' | 'learning' | 'mastered';

export function WordList() {
  const { words, deleteWord, updateWord, searchWords } = useWordStore();
  const { settings } = useSettingsStore();
  const [langFilter, setLangFilter] = useState<LangFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Stats
  const newCount = words.filter(w => getSRSStatus(w) === 'new').length;
  const learningCount = words.filter(w => getSRSStatus(w) === 'learning').length;
  const masteredCount = words.filter(w => getSRSStatus(w) === 'mastered').length;
  const total = words.length || 1;

  // Filter
  let filtered = search ? searchWords(search) : words;
  if (langFilter !== 'all') filtered = filtered.filter(w => w.targetLanguage === langFilter);
  if (statusFilter !== 'all') filtered = filtered.filter(w => getSRSStatus(w) === statusFilter);

  const handleRefresh = async (word: Word) => {
    if (!settings.openRouterApiKey) return;
    const result = await enrichWord(
      settings.openRouterApiKey,
      word.original,
      word.translation,
      word.targetLanguage,
      settings.openRouterModel,
    );
    await updateWord(word.id, {
      sentences: result.sentences.length > 0 ? result.sentences : word.sentences,
      distractors: result.distractors.length > 0 ? result.distractors : word.distractors,
      acceptedAnswers: result.acceptedAnswers.length > 0 ? result.acceptedAnswers : word.acceptedAnswers,
      lastEnrichedAt: Date.now(),
    });
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirm === id) {
      setDeleting(id);
      setDeleteConfirm(null);
      await deleteWord(id);
      setDeleting(null);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(prev => prev === id ? null : prev), 3000);
    }
  };

  return (
    <div>
      {/* Sticky search & filters */}
      <div className="sticky top-14 z-30 bg-surface-0/90 backdrop-blur-md pb-4">
        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari kata..."
            className="w-full rounded-xl bg-surface-1 ring-1 ring-stone-900/5 dark:ring-white/5 shadow-sm pl-12 pr-4 py-3 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
          />
        </div>

        {/* Language + Status Filters */}
        <div className="flex items-center gap-2 mb-3 overflow-x-auto flex-nowrap">
          <button
            onClick={() => { setLangFilter('all'); setStatusFilter('all'); }}
            className={cn(
              'shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              langFilter === 'all' && statusFilter === 'all'
                ? 'bg-teal-700 text-white'
                : 'bg-surface-1 ring-1 ring-stone-900/10 dark:ring-white/10 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700',
            )}
          >
            Semua
          </button>
          {settings.learningLanguages.map(lang => {
            const count = words.filter(w => w.targetLanguage === lang).length;
            return (
              <button
                key={lang}
                onClick={() => { setLangFilter(lang); setStatusFilter('all'); }}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  langFilter === lang
                    ? 'bg-teal-700 text-white'
                    : 'bg-surface-1 ring-1 ring-stone-900/10 dark:ring-white/10 text-stone-600 dark:text-stone-300',
                )}
              >
                {LANGUAGES[lang].flag} {LANGUAGES[lang].nativeName} <span className="text-stone-400 ml-1">{count}</span>
              </button>
            );
          })}

          <div className="h-4 w-px bg-stone-300 dark:bg-stone-600 shrink-0" />

          {([
            { key: 'new' as StatusFilter, label: 'Baru', count: newCount, dot: 'bg-teal-600' },
            { key: 'learning' as StatusFilter, label: 'Belajar', count: learningCount, dot: 'bg-amber-500' },
            { key: 'mastered' as StatusFilter, label: 'Lancar', count: masteredCount, dot: 'bg-green-500' },
          ]).map(s => (
            <button
              key={s.key}
              onClick={() => { setStatusFilter(s.key); setLangFilter('all'); }}
              className={cn(
                'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5',
                statusFilter === s.key
                  ? 'bg-teal-700 text-white'
                  : 'bg-surface-1 ring-1 ring-stone-900/10 dark:ring-white/10 text-stone-600 dark:text-stone-300',
              )}
            >
              <span className={cn('w-2 h-2 rounded-full', statusFilter === s.key ? 'bg-white' : s.dot)} />
              {s.label} <span className={statusFilter === s.key ? 'text-white/70' : 'text-stone-400'}>{s.count}</span>
            </button>
          ))}
        </div>

        {/* Stats Proportion Bar */}
        <div className="flex h-1.5 rounded-full overflow-hidden mb-1">
          <div className="bg-teal-600 transition-all" style={{ width: `${(newCount / total) * 100}%` }} />
          <div className="bg-amber-500 transition-all" style={{ width: `${(learningCount / total) * 100}%` }} />
          <div className="bg-green-500 transition-all" style={{ width: `${(masteredCount / total) * 100}%` }} />
        </div>
        <p className="text-[11px] text-stone-400">{newCount} baru · {learningCount} belajar · {masteredCount} lancar</p>
      </div>

      {/* Word Cards */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-4xl mb-4">📚</p>
          <p className="text-stone-500 dark:text-stone-400">
            {search ? 'Tidak ada kata yang cocok' : 'Belum ada kata'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 mt-4">
          {filtered.map(word => (
            <WordCard
              key={word.id}
              word={word}
              onDelete={handleDelete}
              onRefresh={settings.openRouterApiKey ? handleRefresh : undefined}
              isConfirming={deleteConfirm === word.id}
              isDeleting={deleting === word.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

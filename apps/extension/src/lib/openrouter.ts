import { DEFAULT_OPENROUTER_MODEL, type Sentence, type TargetLanguage } from '@i-speak-hello/shared';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface EnrichResult {
  pinyin?: string;
  translation?: string;
  sentences: Sentence[];
  distractors: string[];
  acceptedAnswers: string[];
}

const LANG_NAMES: Record<TargetLanguage, string> = {
  zh: 'Mandarin Chinese',
  en: 'English',
};

/**
 * Full AI enrichment — user only provides the foreign word, AI generates everything:
 * - translation (Indonesian)
 * - pinyin (for Mandarin)
 * - acceptedAnswers (3-5 synonym translations for typing quiz)
 * - 2 example sentences with Indonesian translations (+ pinyin for zh)
 * - 3 similar-meaning distractors (plausible wrong answers for MCQ)
 *
 * Used when adding a word with API key — no manual translation needed.
 */
export async function enrichWordFull(
  apiKey: string,
  word: string,
  targetLanguage: TargetLanguage,
  model: string = DEFAULT_OPENROUTER_MODEL,
): Promise<EnrichResult> {
  const isZh = targetLanguage === 'zh';
  const langName = LANG_NAMES[targetLanguage];

  const systemPrompt = `You are a language assistant for Indonesian speakers learning ${langName}. Respond ONLY with valid JSON, no markdown, no explanation.`;

  const userPrompt = isZh
    ? `Word: "${word}" (${langName})
Return:{"translation":"<Indonesian>","pinyin":"<tone marks>","acceptedAnswers":["<3-5 alternative correct Indonesian translations/synonyms>"],"sentences":[{"s":"<sentence in ${langName}>","t":"<Indonesian>","p":"<pinyin>"},{"s":"...","t":"...","p":"..."}],"distractors":["<3 plausible but WRONG Indonesian translations>"]}`
    : `Word: "${word}" (${langName})
Return:{"translation":"<Indonesian>","acceptedAnswers":["<3-5 alternative correct Indonesian translations/synonyms>"],"sentences":[{"s":"<sentence in ${langName}>","t":"<Indonesian>"},{"s":"...","t":"..."}],"distractors":["<3 plausible but WRONG Indonesian translations>"]}`;

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'chrome-extension://i-speak-hello',
      'X-Title': 'I Speak Hello',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 450,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
  }

  const data: OpenRouterResponse = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenRouter');

  const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(jsonStr);

  const sentences: Sentence[] = (parsed.sentences || []).map(
    (s: { s: string; t: string; p?: string }) => ({
      id: crypto.randomUUID(),
      sentence: s.s,
      translation: s.t,
      pinyin: s.p,
    }),
  );

  const distractors: string[] = (parsed.distractors || [])
    .filter((d: string) => typeof d === 'string' && d.trim() !== '')
    .slice(0, 3);

  const acceptedAnswers: string[] = (parsed.acceptedAnswers || [])
    .filter((a: string) => typeof a === 'string' && a.trim() !== '')
    .slice(0, 5);

  return {
    translation: parsed.translation || undefined,
    pinyin: isZh ? parsed.pinyin : undefined,
    sentences,
    distractors,
    acceptedAnswers,
  };
}

/**
 * Enrich an existing word (when translation is already known):
 * - pinyin (for Mandarin)
 * - acceptedAnswers (3-5 synonym translations)
 * - 2 example sentences with Indonesian translations (+ pinyin for zh)
 * - 3 similar-meaning distractors
 *
 * Used when adding a word WITHOUT API key (manual translation),
 * then enriching later, or for existing words.
 */
export async function enrichWord(
  apiKey: string,
  word: string,
  translation: string,
  targetLanguage: TargetLanguage,
  model: string = DEFAULT_OPENROUTER_MODEL,
): Promise<EnrichResult> {
  const isZh = targetLanguage === 'zh';
  const langName = LANG_NAMES[targetLanguage];

  const systemPrompt = `You are a language assistant. Respond ONLY with valid JSON, no markdown, no explanation.`;

  const userPrompt = isZh
    ? `Word: "${word}" (${langName}), Indonesian: "${translation}"
Return:{"pinyin":"<tone marks>","acceptedAnswers":["<3-5 alternative correct Indonesian translations/synonyms>"],"sentences":[{"s":"<sentence in ${langName}>","t":"<Indonesian>","p":"<pinyin>"},{"s":"...","t":"...","p":"..."}],"distractors":["<3 plausible but WRONG Indonesian translations>"]}`
    : `Word: "${word}" (${langName}), Indonesian: "${translation}"
Return:{"acceptedAnswers":["<3-5 alternative correct Indonesian translations/synonyms>"],"sentences":[{"s":"<sentence in ${langName}>","t":"<Indonesian>"},{"s":"...","t":"..."}],"distractors":["<3 plausible but WRONG Indonesian translations>"]}`;

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'chrome-extension://i-speak-hello',
      'X-Title': 'I Speak Hello',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 400,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
  }

  const data: OpenRouterResponse = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenRouter');

  const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(jsonStr);

  const sentences: Sentence[] = (parsed.sentences || []).map(
    (s: { s: string; t: string; p?: string }) => ({
      id: crypto.randomUUID(),
      sentence: s.s,
      translation: s.t,
      pinyin: s.p,
    }),
  );

  const distractors: string[] = (parsed.distractors || [])
    .filter((d: string) => typeof d === 'string' && d.trim() !== '')
    .slice(0, 3);

  const acceptedAnswers: string[] = (parsed.acceptedAnswers || [])
    .filter((a: string) => typeof a === 'string' && a.trim() !== '')
    .slice(0, 5);

  return {
    pinyin: isZh ? parsed.pinyin : undefined,
    sentences,
    distractors,
    acceptedAnswers,
  };
}

/**
 * Batch enrich multiple words in a single API call.
 * Used for enriching seed data efficiently (5 words per call).
 * Now also returns acceptedAnswers for each word.
 */
export async function enrichWordsBatch(
  apiKey: string,
  words: Array<{ id: string; original: string; translation: string; targetLanguage: TargetLanguage }>,
  model: string = DEFAULT_OPENROUTER_MODEL,
): Promise<Map<string, EnrichResult>> {
  const results = new Map<string, EnrichResult>();

  // Process in batches of 5
  const batchSize = 5;
  for (let i = 0; i < words.length; i += batchSize) {
    const batch = words.slice(i, i + batchSize);
    const hasZh = batch.some(w => w.targetLanguage === 'zh');

    const wordList = batch
      .map((w, idx) => `${idx + 1}."${w.original}"(${w.targetLanguage})="${w.translation}"`)
      .join('\n');

    const systemPrompt = `Language assistant. JSON array only, no markdown.`;
    const userPrompt = `For each word: 3 wrong-but-plausible Indonesian translations (distractors), 3-5 correct synonym translations (acceptedAnswers)${hasZh ? ', pinyin' : ''}, 1 sentence + Indonesian translation${hasZh ? ' + pinyin' : ''}.

${wordList}

[{${hasZh ? '"pinyin":"...","' : '"'}sentences":[{"s":"...","t":"..."${hasZh ? ',"p":"..."' : ''}}],"distractors":["...","...","..."],"acceptedAnswers":["...","...","..."]}]`;

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'chrome-extension://i-speak-hello',
          'X-Title': 'I Speak Hello',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.5,
          max_tokens: 300 * batch.length,
        }),
      });

      if (!response.ok) continue;

      const data: OpenRouterResponse = await response.json();
      const content = data.choices[0]?.message?.content;
      if (!content) continue;

      const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr) as Array<{
        pinyin?: string;
        sentences?: Array<{ s: string; t: string; p?: string }>;
        distractors?: string[];
        acceptedAnswers?: string[];
      }>;

      batch.forEach((w, idx) => {
        const item = parsed[idx];
        if (!item) return;

        results.set(w.id, {
          pinyin: w.targetLanguage === 'zh' ? item.pinyin : undefined,
          sentences: (item.sentences || []).map(s => ({
            id: crypto.randomUUID(),
            sentence: s.s,
            translation: s.t,
            pinyin: s.p,
          })),
          distractors: (item.distractors || []).filter(d => typeof d === 'string').slice(0, 3),
          acceptedAnswers: (item.acceptedAnswers || []).filter(a => typeof a === 'string').slice(0, 5),
        });
      });
    } catch {
      console.warn(`[I Speak Hello] Batch enrich failed for batch starting at index ${i}`);
    }
  }

  return results;
}

import type { FullCardItem, GameTemplate, GameTemplateConfig, GameType } from './types';

// Session storage is temporary recovery, never a saved teacher resource. Bound to both
// auth user and academy; one draft per game avoids accumulating sample records.
const memory = new Map<string, GameTemplate>();
export interface QuickActivitySource {
  cards: FullCardItem[]; kind: 'word' | 'sentence'; name: string; id?: string;
  ownerId?: string; academyId?: string;
}
export function ownedQuickSource(value: QuickActivitySource | undefined, user: string | undefined, academy: string | undefined) {
  return value && user && academy && value.ownerId === user && value.academyId === academy ? value : undefined;
}
export function recentSourceUses(user: string | undefined, academy: string | undefined): Record<string, number> {
  if (!user || !academy) return {};
  try {
    const value = JSON.parse(sessionStorage.getItem(`classbank:recent-sources:${user}:${academy}`) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))) : {};
  } catch { return {}; }
}
export function rememberSourceUse(user: string, academy: string, id: string) {
  if (id === 'composition' || id === 'temporary' || /^(activity|lesson):/.test(id)) return;
  const uses = { ...recentSourceUses(user, academy), [id]: Date.now() };
  const bounded = Object.fromEntries(Object.entries(uses).sort((a,b) => b[1] - a[1]).slice(0, 50));
  try { sessionStorage.setItem(`classbank:recent-sources:${user}:${academy}`, JSON.stringify(bounded)); } catch { /* browsing remains available */ }
}
export const DRAFT_EVENT = 'classbank:activity-draft';
export const isActivityDraft = (id: string) => id.startsWith('activity-draft:');
export const draftId = (user: string, academy: string, game: GameType) => `activity-draft:${user}:${academy}:${game}`;
const storageKey = (id: string) => id.split(':').slice(0, 4).join(':');
export function readActivityDraft(id: string): GameTemplate | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey(id)) || 'null');
    if ((value?.id === id || (id === storageKey(id) && value?.id?.startsWith(id + ':'))) && Array.isArray(value.items) && value.config) return value;
  } catch { /* private browsing / damaged recovery data */ }
  const value = memory.get(storageKey(id));
  return value && (value.id === id || id === storageKey(id)) ? structuredClone(value) : null;
}
export function writeActivityDraft(draft: GameTemplate, announce=true) {
  memory.set(storageKey(draft.id), structuredClone(draft));
  try { sessionStorage.setItem(storageKey(draft.id), JSON.stringify(draft)); } catch { /* in-memory recovery remains available */ }
  if (draft.config.classroomSource?.id === 'composition') {
    try { sessionStorage.setItem(`composition:${storageKey(draft.id)}:${draft.config.classroomSource.kind}`, JSON.stringify(draft)); } catch { /* in-memory draft remains */ }
  }
  if(announce)window.dispatchEvent(new CustomEvent(DRAFT_EVENT, { detail: storageKey(draft.id) }));
}
export function patchActivityDraft(id: string, patch: { items?: GameTemplate['items']; config?: GameTemplateConfig; name?: string }) {
  const draft = readActivityDraft(id);
  if (!draft) throw new Error('missing_activity_draft');
  const next = { ...draft, ...patch, updated_at: new Date().toISOString() };
  const source = next.config.classroomSource;
  if (source) {
    const pairs = ['matchup','whackamole'].includes(next.game_type) ? next.config.pairs : next.game_type === 'flashcards' ? next.config.flashcards : undefined;
    let cards = source.cards;
    const card = (id: string, word: string, meaning: string) => ({ ...source.cards.find(c => c.word === word), id, word, meaning, imageUrl: source.cards.find(c => c.word === word)?.imageUrl || null });
    if (next.game_type === 'typeanswer' && next.config.typeAnswerEntries) cards = next.config.typeAnswerEntries.filter(p => p.answer.trim()).map(p => card(p.id, p.answer, p.prompt));
    else if (pairs) cards = pairs.filter(p => p.left.trim() && p.right.trim()).map(p => card(p.id, p.left, p.right));
    else if (next.config.questions && ['quiz','gameshowquiz','winlosequiz'].includes(next.game_type)) cards = next.config.questions.filter(q => q.question.trim() && q.choices[q.correctIndex]?.trim()).map(q => card(q.id, q.question, q.choices[q.correctIndex]));
    else if (next.game_type === 'imagequiz' && next.config.imageQuizItems) cards = next.config.imageQuizItems.filter(item=>item.answer.trim()).map(item=>({...card(item.id,item.answer,''),imageUrl:item.imageUrl}));
    else if (next.game_type === 'groupsort' && next.config.groups) cards = next.config.groups.flatMap(group=>group.items.filter(item=>item.text.trim()).map(item=>({...card(item.id,item.text,source.cards.find(c=>c.word===item.text)?.meaning || ''),category:group.name})));
    else if (patch.items) cards = patch.items.filter(item => item.label.trim()).map(item => { const [word, ...meanings] = item.label.split(/\s*\|\s*/); return card(item.id, word.trim(), meanings.join(' | ') || source.cards.find(c => c.word === word)?.meaning || ''); });
    next.config = { ...next.config, classroomSource: { ...source, cards } };
  }
  writeActivityDraft(next);
}
export function sampleActivityCards(kind: 'word' | 'sentence'): FullCardItem[] {
  const pairs = kind === 'sentence'
    ? [['I like apples.', '나는 사과를 좋아해요.'], ['This is my book.', '이것은 내 책이에요.'], ['The cat is small.', '고양이는 작아요.'], ['I can swim.', '나는 수영할 수 있어요.']]
    : [['apple', '사과'], ['banana', '바나나'], ['cat', '고양이'], ['dog', '강아지'], ['sun', '해'], ['book', '책'], ['fish', '물고기'], ['milk', '우유']];
  return pairs.map(([word, meaning], index) => ({ id: `sample-${index}`, word, meaning, imageUrl: kind === 'word' ? `/word-bank-images/${word}.webp` : null, category: null }));
}
export function parseActivityInput(text: string): FullCardItem[] {
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, index) => {
    const [word, ...meaning] = line.split(/\t|\s*\|\s*/);
    return { id: `input-${index}`, word: word.trim(), meaning: meaning.join(' | ').trim(), imageUrl: null, category: null };
  });
}

export function readComposition(base: string, kind: 'word' | 'sentence'): GameTemplate | null {
  try { const draft = JSON.parse(sessionStorage.getItem(`composition:${base}:${kind}`) || 'null'); return draft?.id?.startsWith(base + ':') && draft.config?.classroomSource?.kind === kind ? draft : null; } catch { return null; }
}

/** Recovery-only bridge from the retired common textarea; no second input UI. */
export function legacyActivityInput(user: string, academy: string, kind: 'word' | 'sentence') {
  try { const value=JSON.parse(sessionStorage.getItem(`classbank:quick-input:${user}:${academy}`)||'null'); return value?.kind===kind && typeof value.input==='string' ? parseActivityInput(value.input) : null; } catch { return null; }
}

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { grammarLevelTag, plainText } from '../lib/grammar';
import { extractLyricGrammar } from '../lib/lyricGrammar';
import { buildLyricHandoutHtml, type HandoutVocabRow } from '../lib/lyricHandout';
import { extractLyricVocab } from '../lib/lyricWords';
import type { WordBankEntry, WordListItem } from '../lib/types';

type Draft = Omit<WordListItem, 'id'>;

interface Props {
  /** 사전(word_bank) 전체. 아직 못 불러왔으면 null. */
  dictionary: WordBankEntry[] | null;
  /** 이미 단어장에 있는 낱말(`낱말::뜻`) — 같은 것은 다시 담지 않는다. */
  existingKeys: Set<string>;
  onAdd: (drafts: Draft[]) => void;
}

const draftKey = (d: { word: string; meaning: string }) => `${d.word}::${d.meaning}`;

/**
 * 노래 가사를 붙여 넣으면 단어·숙어를 찾아 체크 목록으로 보여 주고, 고른 것만 단어장에 담는다.
 * 가사 원문은 이 화면 상태에만 있고 어디에도 저장하지 않는다(저작권). 추출은 lib/lyricWords.ts.
 */
export default function LyricsWordPicker({ dictionary, existingKeys, onAdd }: Props) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [text, setText] = useState('');
  /** 고른 문법(id) — 기본은 아무것도 고르지 않는다: "이번 수업에서 쓸 문법"은 선생님이 정한다 */
  const [gChecked, setGChecked] = useState<Record<string, boolean>>({});
  const [handoutTitle, setHandoutTitle] = useState('');
  const [analyzed, setAnalyzed] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [sense, setSense] = useState<Record<string, number>>({});
  const [meanings, setMeanings] = useState<Record<string, string>>({});

  const vocab = useMemo(
    () => (analyzed !== null && dictionary ? extractLyricVocab(analyzed, dictionary) : null),
    [analyzed, dictionary],
  );

  const grammar = useMemo(() => (analyzed !== null ? extractLyricGrammar(analyzed) : []), [analyzed]);
  useEffect(() => {
    setGChecked({});
  }, [grammar]);

  // 새로 찾을 때마다 기본 선택을 다시 정한다: 초등 단어·숙어는 켜고, 중·고등 단어는 끈다.
  useEffect(() => {
    if (!vocab) return;
    const next: Record<string, boolean> = {};
    for (const w of vocab.words) next[`w:${w.key}`] = (w.senses[0].level ?? 1) <= 4;
    for (const p of vocab.phrases) next[`p:${p.key}`] = true;
    setChecked(next);
    setSense({});
    setMeanings({});
  }, [vocab]);

  function wordDraft(key: string, senses: WordBankEntry[]): Draft {
    const e = senses[sense[`w:${key}`] ?? 0] ?? senses[0];
    return { word: e.word, meaning: e.meaning, image_url: e.image_url, category: e.category, partOfSpeech: e.part_of_speech };
  }

  const drafts = useMemo(() => {
    if (!vocab) return [] as Draft[];
    const out: Draft[] = [];
    for (const p of vocab.phrases) {
      if (!checked[`p:${p.key}`]) continue;
      const meaning = (meanings[`p:${p.key}`] ?? p.meaning).trim();
      if (!meaning) continue;
      out.push(
        p.entry
          ? { word: p.entry.word, meaning, image_url: p.entry.image_url, category: p.entry.category, partOfSpeech: p.entry.part_of_speech }
          : { word: p.phrase, meaning, image_url: null, category: null, partOfSpeech: '숙어' },
      );
    }
    for (const w of vocab.words) {
      if (checked[`w:${w.key}`]) out.push(wordDraft(w.key, w.senses));
    }
    for (const u of vocab.unknown) {
      const meaning = (meanings[`u:${u.key}`] ?? '').trim();
      if (checked[`u:${u.key}`] && meaning) out.push({ word: u.key, meaning, image_url: null, category: null, partOfSpeech: null });
    }
    // 고른 문법: 단어장에 "문법 항목"으로 담는다(이름 + 한 줄 정리). 가사 줄은 저장하지 않는다.
    for (const g of grammar) {
      if (!gChecked[g.id]) continue;
      out.push({
        word: plainText(g.point.name),
        meaning: g.point.tip ? plainText(g.point.tip) : plainText(g.point.explain),
        image_url: null,
        category: '문법',
        partOfSpeech: '문법',
        grammarId: g.id,
      });
    }
    return out.filter((d) => !existingKeys.has(draftKey(d)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocab, checked, sense, meanings, existingKeys, grammar, gChecked]);

  /** 고른 단어·숙어·문법으로 수업 자료(인쇄물)를 만든다 — 가사는 이 화면 안에서만 쓰고 저장하지 않는다 */
  function printHandout() {
    if (!vocab || analyzed === null) return;
    const rows: HandoutVocabRow[] = [];
    for (const p of vocab.phrases) {
      if (!checked[`p:${p.key}`]) continue;
      const meaning = (meanings[`p:${p.key}`] ?? p.meaning).trim();
      if (!meaning) continue;
      rows.push({ word: p.entry?.word ?? p.phrase, pos: p.entry?.part_of_speech ?? '숙어', meaning, example: p.entry?.example_sentence ?? '', line: p.example });
    }
    for (const w of vocab.words) {
      if (!checked[`w:${w.key}`]) continue;
      const e = w.senses[sense[`w:${w.key}`] ?? 0] ?? w.senses[0];
      rows.push({ word: e.word, pos: e.part_of_speech, meaning: e.meaning, example: e.example_sentence ?? '', line: w.example });
    }
    for (const u of vocab.unknown) {
      const meaning = (meanings[`u:${u.key}`] ?? '').trim();
      if (checked[`u:${u.key}`] && meaning) rows.push({ word: u.key, pos: '', meaning, example: '', line: u.example });
    }
    const chosen = grammar.filter((g) => gChecked[g.id]);
    if (rows.length === 0 && chosen.length === 0) {
      notify(t('lyricsPicker.handoutNothing'), 'error');
      return;
    }
    const html = buildLyricHandoutHtml({ title: handoutTitle, source: analyzed, rows, grammar: chosen });
    const w = window.open('', '_blank');
    if (!w) {
      notify(t('lyricsPicker.popupBlocked'), 'error');
      return;
    }
    w.document.write(html.replace('</body>', '<script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body>'));
    w.document.close();
  }

  function setAllGrammar(value: boolean) {
    const next: Record<string, boolean> = {};
    for (const g of grammar) next[g.id] = value;
    setGChecked(next);
  }

  function setAll(prefix: 'w' | 'p', value: boolean) {
    if (!vocab) return;
    setChecked((prev) => {
      const next = { ...prev };
      for (const k of (prefix === 'w' ? vocab.words : vocab.phrases).map((x) => x.key)) next[`${prefix}:${k}`] = value;
      return next;
    });
  }

  function toggle(k: string) {
    setChecked((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  function add() {
    if (drafts.length === 0) return;
    onAdd(drafts);
    setChecked({});
  }

  const empty = vocab && vocab.words.length === 0 && vocab.phrases.length === 0 && grammar.length === 0;
  const inputCls =
    'bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none';

  return (
    <div className="space-y-3">
      <p className="font-caption text-caption text-on-surface-variant">{t('lyricsPicker.intro')}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={t('lyricsPicker.placeholder')}
        aria-label={t('lyricsPicker.tab')}
        className="w-full resize-y bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!text.trim() || dictionary === null}
          onClick={() => setAnalyzed(text)}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('lyricsPicker.analyze')}
        </button>
        {dictionary === null && (
          <span className="font-caption text-caption text-on-surface-variant">{t('lyricsPicker.loadingDictionary')}</span>
        )}
      </div>

      {empty && <p className="font-body-md text-body-md text-on-surface-variant">{t('lyricsPicker.empty')}</p>}

      {vocab && !empty && (
        <div className="space-y-4">
          <p className="font-label-md text-label-md text-deep-navy">
            {t('lyricsPicker.summaryGrammar', { words: vocab.words.length, phrases: vocab.phrases.length, grammar: grammar.length })}
          </p>

          {vocab.phrases.length > 0 && (
            <section>
              <div className="mb-1.5 flex items-center justify-between">
                <h4 className="font-title-md text-title-md text-deep-navy">{t('lyricsPicker.phrasesTitle')}</h4>
                <span className="flex gap-3">
                  <button type="button" onClick={() => setAll('p', true)} className="font-label-md text-label-md text-primary hover:underline">
                    {t('lyricsPicker.selectAll')}
                  </button>
                  <button type="button" onClick={() => setAll('p', false)} className="font-label-md text-label-md text-on-surface-variant hover:underline">
                    {t('lyricsPicker.deselectAll')}
                  </button>
                </span>
              </div>
              <ul className="max-h-60 space-y-1 overflow-y-auto">
                {vocab.phrases.map((p) => {
                  const k = `p:${p.key}`;
                  const meaning = meanings[k] ?? p.meaning;
                  const have = existingKeys.has(draftKey({ word: p.entry?.word ?? p.phrase, meaning: meaning.trim() }));
                  return (
                    <li key={p.key} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-container-lowest px-2 py-1.5">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(checked[k]) && !have}
                          disabled={have}
                          onChange={() => toggle(k)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span className="font-label-md text-label-md text-on-surface">{p.phrase}</span>
                      </label>
                      <input
                        value={meaning}
                        onChange={(e) => setMeanings((prev) => ({ ...prev, [k]: e.target.value }))}
                        aria-label={t('lyricsPicker.meaningPlaceholder')}
                        className={`${inputCls} min-w-[140px] flex-1`}
                      />
                      <span className="rounded-full bg-tertiary-container/50 px-2 text-[11px] text-on-surface-variant">
                        {p.entry ? t('lyricsPicker.fromDictionary') : t('lyricsPicker.basicPhrase')}
                      </span>
                      {p.count > 1 && <span className="font-caption text-caption text-on-surface-variant">×{p.count}</span>}
                      {have && <span className="font-caption text-caption text-on-surface-variant">{t('lyricsPicker.alreadyIn')}</span>}
                      <span className="basis-full truncate pl-6 font-caption text-caption text-on-surface-variant">{p.example}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {grammar.length > 0 && (
            <section>
              <div className="mb-1.5 flex items-center justify-between">
                <h4 className="font-title-md text-title-md text-deep-navy">{t('lyricsPicker.grammarTitle')}</h4>
                <span className="flex gap-3">
                  <button type="button" onClick={() => setAllGrammar(true)} className="font-label-md text-label-md text-primary hover:underline">
                    {t('lyricsPicker.selectAll')}
                  </button>
                  <button type="button" onClick={() => setAllGrammar(false)} className="font-label-md text-label-md text-on-surface-variant hover:underline">
                    {t('lyricsPicker.deselectAll')}
                  </button>
                </span>
              </div>
              <p className="mb-1.5 font-caption text-caption text-on-surface-variant">{t('lyricsPicker.grammarNote')}</p>
              <ul className="max-h-80 space-y-1.5 overflow-y-auto">
                {grammar.map((g) => {
                  const have = existingKeys.has(
                    draftKey({ word: plainText(g.point.name), meaning: g.point.tip ? plainText(g.point.tip) : plainText(g.point.explain) }),
                  );
                  return (
                    <li key={g.id} className="rounded-lg bg-surface-container-lowest px-2 py-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(gChecked[g.id]) && !have}
                            disabled={have}
                            onChange={() => setGChecked((prev) => ({ ...prev, [g.id]: !prev[g.id] }))}
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="font-label-md text-label-md text-on-surface">{plainText(g.point.name)}</span>
                        </label>
                        <span className="rounded-full bg-tertiary-container/50 px-2 text-[11px] text-on-surface-variant">{grammarLevelTag(g.point)}</span>
                        <span className="font-caption text-caption text-on-surface-variant">×{g.count}</span>
                        {have && <span className="font-caption text-caption text-on-surface-variant">{t('lyricsPicker.alreadyIn')}</span>}
                      </div>
                      <p className="pl-6 font-caption text-caption text-on-surface-variant">{plainText(g.point.explain)}</p>
                      {g.hits.slice(0, 2).map((h, i) => (
                        <p key={i} className="truncate pl-6 font-caption text-caption text-on-surface">
                          ♪ {h.line} <span className="font-bold text-primary">→ {h.match}</span>
                        </p>
                      ))}
                      <details className="pl-6">
                        <summary className="cursor-pointer font-caption text-caption text-primary">{t('lyricsPicker.grammarMore')}</summary>
                        <div className="mt-1 space-y-1 font-caption text-caption text-on-surface">
                          {g.point.usage?.map((u, i) => (
                            <p key={`u${i}`}>• {plainText(u)}</p>
                          ))}
                          {g.point.pitfalls?.slice(0, 2).map((p, i) => (
                            <p key={`p${i}`}>
                              <span className="text-error">✗ {plainText(p.wrong)}</span>
                              {' · '}
                              <span className="text-primary">✓ {plainText(p.right)}</span> <span className="text-on-surface-variant">({p.why})</span>
                            </p>
                          ))}
                          {g.point.tip && <p className="font-bold">{plainText(g.point.tip)}</p>}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {vocab.words.length > 0 && (
            <section>
              <div className="mb-1.5 flex items-center justify-between">
                <h4 className="font-title-md text-title-md text-deep-navy">{t('lyricsPicker.wordsTitle')}</h4>
                <span className="flex gap-3">
                  <button type="button" onClick={() => setAll('w', true)} className="font-label-md text-label-md text-primary hover:underline">
                    {t('lyricsPicker.selectAll')}
                  </button>
                  <button type="button" onClick={() => setAll('w', false)} className="font-label-md text-label-md text-on-surface-variant hover:underline">
                    {t('lyricsPicker.deselectAll')}
                  </button>
                </span>
              </div>
              <p className="mb-1.5 font-caption text-caption text-on-surface-variant">{t('lyricsPicker.upperLevelNote')}</p>
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {vocab.words.map((w) => {
                  const k = `w:${w.key}`;
                  const d = wordDraft(w.key, w.senses);
                  const have = existingKeys.has(draftKey(d));
                  const level = w.senses[sense[k] ?? 0]?.level ?? w.senses[0].level ?? 1;
                  return (
                    <li key={w.key} title={w.example} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-container-lowest px-2 py-1.5">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(checked[k]) && !have}
                          disabled={have}
                          onChange={() => toggle(k)}
                          className="h-4 w-4 accent-primary"
                        />
                        {d.image_url && <img src={d.image_url} alt="" className="h-6 w-6 rounded object-cover" />}
                        <span className="font-label-md text-label-md text-on-surface">{d.word}</span>
                      </label>
                      {w.senses.length > 1 ? (
                        <select
                          value={sense[k] ?? 0}
                          onChange={(e) => setSense((prev) => ({ ...prev, [k]: Number(e.target.value) }))}
                          aria-label={t('lyricsPicker.sense')}
                          className={`${inputCls} max-w-[260px]`}
                        >
                          {w.senses.map((s, i) => (
                            <option key={s.id} value={i}>
                              {s.part_of_speech} · {s.meaning}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-body-md text-sm text-on-surface-variant">
                          {d.partOfSpeech} · {d.meaning}
                        </span>
                      )}
                      {level >= 5 && (
                        <span className="rounded-full bg-secondary-container px-2 text-[11px] text-on-secondary-container">
                          {t('lyricsPicker.upperLevel')}
                        </span>
                      )}
                      {w.count > 1 && <span className="font-caption text-caption text-on-surface-variant">×{w.count}</span>}
                      {have && <span className="font-caption text-caption text-on-surface-variant">{t('lyricsPicker.alreadyIn')}</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {vocab.unknown.length > 0 && (
            <details className="rounded-lg bg-surface-container-low p-2">
              <summary className="cursor-pointer font-label-md text-label-md text-on-surface-variant">
                {t('lyricsPicker.unknownTitle', { count: vocab.unknown.length })}
              </summary>
              <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                {vocab.unknown.map((u) => {
                  const k = `u:${u.key}`;
                  return (
                    <li key={u.key} title={u.example} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-container-lowest px-2 py-1.5">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(checked[k])}
                          onChange={() => toggle(k)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span className="font-label-md text-label-md text-on-surface">{u.key}</span>
                      </label>
                      <input
                        value={meanings[k] ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMeanings((prev) => ({ ...prev, [k]: v }));
                          if (v.trim()) setChecked((prev) => ({ ...prev, [k]: true }));
                        }}
                        placeholder={t('lyricsPicker.meaningPlaceholder')}
                        aria-label={t('lyricsPicker.meaningPlaceholder')}
                        className={`${inputCls} min-w-[140px] flex-1`}
                      />
                      {u.count > 1 && <span className="font-caption text-caption text-on-surface-variant">×{u.count}</span>}
                    </li>
                  );
                })}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={drafts.length === 0}
              onClick={add}
              className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-base">add</span>
              {t('lyricsPicker.addButton', { count: drafts.length })}
            </button>
            <input
              value={handoutTitle}
              onChange={(e) => setHandoutTitle(e.target.value)}
              placeholder={t('lyricsPicker.handoutTitlePlaceholder')}
              aria-label={t('lyricsPicker.handoutTitlePlaceholder')}
              className={`${inputCls} min-w-[160px] flex-1`}
            />
            <button
              type="button"
              onClick={printHandout}
              className="flex items-center gap-1.5 rounded-full border-2 border-primary px-4 py-2 font-label-md text-label-md text-primary transition-colors hover:bg-primary/10"
            >
              <span className="material-symbols-outlined text-base">print</span>
              {t('lyricsPicker.handoutButton')}
            </button>
          </div>
          <p className="font-caption text-caption text-on-surface-variant">{t('lyricsPicker.handoutHint')}</p>
        </div>
      )}
    </div>
  );
}

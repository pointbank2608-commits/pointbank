import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BANK_LEVELS, SENTENCE_BANK, allBankSentences, bankSentences, commonPatterns, sentencePattern, type BankLevel, type BankSentence } from '../data/sentenceBank';
import { PURPOSE_BANK } from '../data/sentencePurposes';
import { QA_BANK } from '../data/sentenceQA';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { createWordList } from '../lib/api';

interface Props {
  /** `영어 | 우리말` 한 줄씩(withKo=false면 영어만) */
  onImportLabels: (labels: string[]) => void;
  withKo?: boolean;
  /** 문장 목록으로 저장할 때 붙일 반(없으면 모든 반 공용) */
  classId?: string | null;
  /** 문장 목록 편집 화면처럼 이미 목록 안이면 "새 목록으로 저장"을 숨긴다 */
  hideSaveAsList?: boolean;
}

/**
 * 문장 은행에서 담기(2026-10-16) — 같은 상황(음식 주문·길 묻기 …)을 레벨(유치·초등·중등·고등)별 문장으로 골라 게임에 담는다.
 * 문장은 전부 Claude 초안(검수 전)이라 화면에 "초안"으로 알린다.
 */
export default function SentenceBankPicker({ onImportLabels, withKo = true, classId = null, hideSaveAsList = false }: Props) {
  const { t, i18n } = useTranslation();
  const { academy, profile } = useAuth();
  const { notify } = useToast();
  const isKo = i18n.language.startsWith('ko');
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<BankLevel>('elem');
  const [axis, setAxis] = useState<'situation' | 'purpose' | 'pattern' | 'qa'>('situation');
  const [situation, setSituation] = useState<string>(SENTENCE_BANK[0].id);
  const [purpose, setPurpose] = useState<string>(PURPOSE_BANK[0].id);
  const [pattern, setPattern] = useState<string | null>(null);
  const [qaTopic, setQaTopic] = useState<string>(QA_BANK[0].id);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // 검수: 문장·해석을 고쳐서 쓴다(원문 키 → 고친 값)
  const [edits, setEdits] = useState<Record<string, { en: string; ko: string }>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [listName, setListName] = useState('');
  const [saving, setSaving] = useState(false);

  const topic = axis === 'purpose' ? purpose : situation;
  const patterns = useMemo(() => commonPatterns(level), [level]);
  const list = useMemo<(BankSentence & { answer?: { en: string; ko: string } })[]>(() => {
    if (axis === 'qa') {
      const split = (line: string) => {
        const cut = line.indexOf(' | ');
        return { en: cut >= 0 ? line.slice(0, cut) : line, ko: cut >= 0 ? line.slice(cut + 3) : '' };
      };
      return (QA_BANK.find((x) => x.id === qaTopic)?.pairs[level] ?? []).map((pair) => {
        const q = split(pair.q);
        return { ...q, level, situation: `qa:${qaTopic}`, answer: split(pair.a) };
      });
    }
    if (axis !== 'pattern') return bankSentences(topic, level);
    const p = pattern ?? patterns[0]?.[0] ?? null;
    return p ? allBankSentences(level).filter((x) => sentencePattern(x.en) === p) : [];
  }, [axis, topic, level, pattern, patterns, qaTopic]);
  const keyOf = (s: { situation: string; en: string }) => `${s.situation}|${level}|${s.en}`;
  const pickedHere = list.filter((s) => picked.has(keyOf(s)));

  function toggle(sent: { situation: string; en: string }) {
    const k = keyOf(sent);
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }

  function selectAll() {
    setPicked((p) => {
      const n = new Set(p);
      const all = list.every((s) => n.has(keyOf(s)));
      list.forEach((s) => (all ? n.delete(keyOf(s)) : n.add(keyOf(s))));
      return n;
    });
  }

  /** 고른 문장을(고친 값 반영) 전체 은행에서 모은다 */
  function collect(): { en: string; ko: string }[] {
    const out: { en: string; ko: string }[] = [];
    for (const s of [...SENTENCE_BANK, ...PURPOSE_BANK]) {
      for (const lv of BANK_LEVELS) {
        for (const raw of s.lines[lv]) {
          const cut = raw.indexOf(' | ');
          const en = cut >= 0 ? raw.slice(0, cut) : raw;
          const k = `${s.id}|${lv}|${en}`;
          if (!picked.has(k)) continue;
          const e = edits[k];
          out.push({ en: (e?.en ?? en).trim(), ko: (e?.ko ?? (cut >= 0 ? raw.slice(cut + 3) : '')).trim() });
        }
      }
    }
    for (const tp of QA_BANK) {
      for (const lv of BANK_LEVELS) {
        for (const pair of tp.pairs[lv]) {
          const q = pair.q.split(' | ');
          if (!picked.has(`qa:${tp.id}|${lv}|${q[0]}`)) continue;
          const a = pair.a.split(' | ');
          out.push({ en: q[0].trim(), ko: (q[1] ?? '').trim() }, { en: a[0].trim(), ko: (a[1] ?? '').trim() });
        }
      }
    }
    return out.filter((s) => s.en);
  }

  function add() {
    const out = collect().map((s) => (withKo && s.ko ? `${s.en} | ${s.ko}` : s.en));
    if (out.length === 0) return;
    onImportLabels(out);
    setPicked(new Set());
  }

  async function saveAsList() {
    const sentences = collect();
    if (sentences.length === 0 || !academy || !profile) return;
    const sit = [...SENTENCE_BANK, ...PURPOSE_BANK, ...QA_BANK].find((s) => s.id === (axis === 'qa' ? qaTopic : topic));
    const name = listName.trim() || `${isKo ? sit?.ko : sit?.en} · ${t(`sentenceBank.level_${level}`)}`;
    setSaving(true);
    try {
      await createWordList({
        academyId: academy.id,
        classId,
        name,
        kind: 'sentence',
        teacherId: profile.id,
        items: sentences.map((s) => ({ id: crypto.randomUUID(), word: s.en, meaning: s.ko, image_url: null, category: null })),
      });
      notify(t('sentenceBank.savedToast', { name, count: sentences.length }));
      setPicked(new Set());
      setListName('');
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${
      active ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
    }`;

  return (
    <div className="!min-w-0 w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-2 font-label-md text-label-md text-primary transition-colors hover:bg-primary/10"
      >
        📚 {t('sentenceBank.open')} {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-3 space-y-3 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4">
          <div className="rounded-lg bg-tertiary-container/40 px-3 py-2 font-caption text-caption text-on-surface">{t('sentenceBank.draftNote')}</div>
          <div>
            <div className="mb-1.5 font-caption text-caption text-on-surface-variant">{t('sentenceBank.levelLabel')}</div>
            <div className="flex flex-wrap gap-1.5">
              {BANK_LEVELS.map((lv) => (
                <button key={lv} type="button" onClick={() => setLevel(lv)} className={chip(level === lv)}>
                  {t(`sentenceBank.level_${lv}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 font-caption text-caption text-on-surface-variant">{t('sentenceBank.axisLabel')}</div>
            <div className="flex flex-wrap gap-1.5">
              {(['situation', 'purpose', 'pattern', 'qa'] as const).map((a) => (
                <button key={a} type="button" onClick={() => setAxis(a)} className={chip(axis === a)}>
                  {t(`sentenceBank.axis_${a}`)}
                </button>
              ))}
            </div>
          </div>
          {axis === 'qa' ? (
            <div>
              <div className="mb-1.5 font-caption text-caption text-on-surface-variant">{t('sentenceBank.qaLabel')}</div>
              <div className="flex flex-wrap gap-1.5">
                {QA_BANK.map((entry) => (
                  <button key={entry.id} type="button" onClick={() => setQaTopic(entry.id)} className={chip(qaTopic === entry.id)}>
                    {isKo ? entry.ko : entry.en}
                  </button>
                ))}
              </div>
            </div>
          ) : axis !== 'pattern' ? (
            <div>
              <div className="mb-1.5 font-caption text-caption text-on-surface-variant">{t(axis === 'purpose' ? 'sentenceBank.purposeLabel' : 'sentenceBank.situationLabel')}</div>
              <div className="flex flex-wrap gap-1.5">
                {(axis === 'purpose' ? PURPOSE_BANK : SENTENCE_BANK).map((entry) => {
                  const active = (axis === 'purpose' ? purpose : situation) === entry.id;
                  return (
                    <button key={entry.id} type="button" onClick={() => (axis === 'purpose' ? setPurpose : setSituation)(entry.id)} className={chip(active)}>
                      {isKo ? entry.ko : entry.en}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-1.5 font-caption text-caption text-on-surface-variant">{t('sentenceBank.patternLabel')}</div>
              <div className="flex flex-wrap gap-1.5">
                {patterns.map(([pat, n], i) => (
                  <button key={pat} type="button" onClick={() => setPattern(pat)} className={chip((pattern ?? patterns[0]?.[0]) === pat || (pattern === null && i === 0))}>
                    {pat} … <span className="opacity-70">{n}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {axis === 'qa' && <div className="font-caption text-caption text-on-surface-variant">{t('sentenceBank.qaHint')}</div>}
          <ul className="divide-y divide-surface-container rounded-lg border border-outline-variant/40">
            {list.map((s) => {
              const k = keyOf(s);
              const on = picked.has(k);
              const shown = edits[k] ?? { en: s.en, ko: s.ko };
              const isEdit = editing === k;
              return (
                <li key={k} className={on ? 'bg-primary/5' : ''}>
                  <div className="flex items-start gap-3 px-3 py-2">
                    <input type="checkbox" checked={on} onChange={() => toggle(s)} className="mt-1.5" />
                    {isEdit ? (
                      <span className="flex-1 space-y-1">
                        <input
                          value={shown.en}
                          onChange={(e) => setEdits((m) => ({ ...m, [k]: { ...shown, en: e.target.value } }))}
                          className="w-full rounded-md border border-outline-variant bg-surface-container-low px-2 py-1 font-body-md text-body-md text-on-surface outline-none focus:border-primary"
                        />
                        <input
                          value={shown.ko}
                          onChange={(e) => setEdits((m) => ({ ...m, [k]: { ...shown, ko: e.target.value } }))}
                          className="w-full rounded-md border border-outline-variant bg-surface-container-low px-2 py-1 font-caption text-caption text-on-surface outline-none focus:border-primary"
                        />
                      </span>
                    ) : (
                      <span className="flex-1">
                        <span className="block font-body-md text-body-md text-on-surface">{axis === 'qa' ? 'Q. ' : ''}{shown.en}</span>
                        <span className="block font-caption text-caption text-on-surface-variant">{shown.ko}</span>
                        {s.answer && (
                          <span className="mt-1 block border-l-2 border-primary/40 pl-2">
                            <span className="block font-body-md text-body-md text-on-surface">A. {s.answer.en}</span>
                            <span className="block font-caption text-caption text-on-surface-variant">{s.answer.ko}</span>
                          </span>
                        )}
                      </span>
                    )}
                    {!s.answer && <button
                      type="button"
                      onClick={() => setEditing(isEdit ? null : k)}
                      className="shrink-0 rounded-md px-2 py-1 font-label-md text-label-md text-primary hover:bg-primary/10"
                      title={t('sentenceBank.edit')}
                    >
                      {isEdit ? '✔' : '✎'}
                    </button>}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={selectAll} className="font-label-md text-label-md text-primary hover:underline">
              {list.length > 0 && pickedHere.length === list.length ? t('sentenceBank.clearAll') : t('sentenceBank.selectAll')}
            </button>
            <button
              type="button"
              disabled={picked.size === 0}
              onClick={add}
              className="rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container disabled:opacity-50"
            >
              {t('sentenceBank.add', { n: picked.size })}
            </button>
          </div>
          {!hideSaveAsList && <div className="flex flex-wrap items-center gap-2 border-t border-surface-container pt-3">
            <input
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder={t('sentenceBank.listNamePlaceholder')}
              className="min-w-[10rem] flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 font-body-md text-sm text-on-surface outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={picked.size === 0 || saving}
              onClick={() => void saveAsList()}
              className="rounded-lg border border-primary px-4 py-2 font-label-md text-label-md text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
            >
              {saving ? t('sentenceBank.saving') : t('sentenceBank.saveAsList', { n: picked.size })}
            </button>
          </div>}
          <div className="font-caption text-caption text-on-surface-variant">{t('sentenceBank.reviewHint')}</div>
        </div>
      )}
    </div>
  );
}

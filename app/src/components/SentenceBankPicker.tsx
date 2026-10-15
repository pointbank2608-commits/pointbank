import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BANK_LEVELS, SENTENCE_BANK, bankSentences, type BankLevel } from '../data/sentenceBank';

interface Props {
  /** `영어 | 우리말` 한 줄씩(withKo=false면 영어만) */
  onImportLabels: (labels: string[]) => void;
  withKo?: boolean;
}

/**
 * 문장 은행에서 담기(2026-10-16) — 같은 상황(음식 주문·길 묻기 …)을 레벨(유치·초등·중등·고등)별 문장으로 골라 게임에 담는다.
 * 문장은 전부 Claude 초안(검수 전)이라 화면에 "초안"으로 알린다.
 */
export default function SentenceBankPicker({ onImportLabels, withKo = true }: Props) {
  const { t, i18n } = useTranslation();
  const isKo = i18n.language.startsWith('ko');
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<BankLevel>('elem');
  const [situation, setSituation] = useState<string>(SENTENCE_BANK[0].id);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const list = useMemo(() => bankSentences(situation, level), [situation, level]);
  const keyOf = (en: string) => `${situation}|${level}|${en}`;
  const pickedHere = list.filter((s) => picked.has(keyOf(s.en)));

  function toggle(en: string) {
    const k = keyOf(en);
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
      const all = list.every((s) => n.has(keyOf(s.en)));
      list.forEach((s) => (all ? n.delete(keyOf(s.en)) : n.add(keyOf(s.en))));
      return n;
    });
  }

  function add() {
    // 선택은 여러 상황·레벨을 오가며 모을 수 있다 — 전체 은행에서 찾아 담는다
    const out: string[] = [];
    for (const s of SENTENCE_BANK) {
      for (const lv of BANK_LEVELS) {
        for (const raw of s.lines[lv]) {
          const cut = raw.indexOf(' | ');
          const en = cut >= 0 ? raw.slice(0, cut) : raw;
          if (!picked.has(`${s.id}|${lv}|${en}`)) continue;
          out.push(withKo && cut >= 0 ? raw : en);
        }
      }
    }
    if (out.length === 0) return;
    onImportLabels(out);
    setPicked(new Set());
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
            <div className="mb-1.5 font-caption text-caption text-on-surface-variant">{t('sentenceBank.situationLabel')}</div>
            <div className="flex flex-wrap gap-1.5">
              {SENTENCE_BANK.map((s) => (
                <button key={s.id} type="button" onClick={() => setSituation(s.id)} className={chip(situation === s.id)}>
                  {isKo ? s.ko : s.en}
                </button>
              ))}
            </div>
          </div>
          <ul className="divide-y divide-surface-container rounded-lg border border-outline-variant/40">
            {list.map((s) => {
              const on = picked.has(keyOf(s.en));
              return (
                <li key={s.en}>
                  <label className={`flex cursor-pointer items-start gap-3 px-3 py-2 ${on ? 'bg-primary/5' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(s.en)} className="mt-1.5" />
                    <span>
                      <span className="block font-body-md text-body-md text-on-surface">{s.en}</span>
                      <span className="block font-caption text-caption text-on-surface-variant">{s.ko}</span>
                    </span>
                  </label>
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
        </div>
      )}
    </div>
  );
}

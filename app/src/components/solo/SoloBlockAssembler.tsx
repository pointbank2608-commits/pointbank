import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { kindOf, stepSummary } from '../../lib/soloEdit';
import type { SoloStep } from '../../lib/soloLessons';

export interface AssembleLesson {
  name: string;
  steps: SoloStep[];
  minutes: number;
}

/**
 * 블록 조립기 — 만들어질 수업을 "활동 블록"(만나기·그림 고르기·쓰기·말하기 …)으로 나눠 보여 주고,
 * 필요한 블록만 켜서 만든다. 블록 = 같은 종류의 단계 묶음이라 순서(권장 흐름)는 그대로 지켜진다.
 * 더 세밀한 수정(문제 하나, 순서 바꾸기)은 만든 뒤 "고치기" 편집기에서 한다.
 * 소개 화면은 늘 들어가고, 단계가 하나도 안 남는 조합은 만들 수 없다.
 */
export default function SoloBlockAssembler({
  title,
  lessons,
  busy,
  onMake,
}: {
  title: string;
  lessons: AssembleLesson[];
  busy: boolean;
  onMake: (lessons: AssembleLesson[]) => void;
}) {
  const { t } = useTranslation();
  const [off, setOff] = useState<Set<string>>(new Set());

  /** 종류별 묶음(처음 나온 순서) */
  const blocks = useMemo(() => {
    const order: SoloStep['t'][] = [];
    const info = new Map<SoloStep['t'], { count: number; sample: string }>();
    for (const l of lessons) {
      for (const s of l.steps) {
        if (s.t === 'intro') continue;
        const cur = info.get(s.t);
        if (cur) cur.count += 1;
        else {
          order.push(s.t);
          info.set(s.t, { count: 1, sample: stepSummary(s) });
        }
      }
    }
    return order.map((type) => ({ type, ...(info.get(type) as { count: number; sample: string }) }));
  }, [lessons]);

  const total = blocks.reduce((n, b) => n + b.count, 0);
  const kept = blocks.filter((b) => !off.has(b.type)).reduce((n, b) => n + b.count, 0);
  const sumMinutes = lessons.reduce((n, l) => n + l.minutes, 0);
  const minutes = total === 0 ? 0 : Math.max(5 * lessons.length, Math.round((sumMinutes * kept) / total));

  const toggle = (type: string) =>
    setOff((cur) => {
      const n = new Set(cur);
      if (n.has(type)) n.delete(type);
      else n.add(type);
      return n;
    });

  // 처음 만나는 단계 없이 문제만 있으면 알려 준다
  const has = (type: string) => blocks.some((b) => b.type === type && !off.has(b.type));
  const quizOn = ['pickWord', 'pickMeaning', 'listenPick', 'spell', 'typeWord', 'fillBlank', 'dictation'].some(has);
  const warnNoMeet = blocks.some((b) => b.type === 'meet') && !has('meet') && quizOn;

  function make() {
    const made = lessons.map((l) => {
      const steps = l.steps.filter((s) => s.t === 'intro' || !off.has(s.t));
      const non = steps.filter((s) => s.t !== 'intro').length;
      const origin = l.steps.filter((s) => s.t !== 'intro').length || 1;
      return { ...l, steps, minutes: Math.max(5, Math.round((l.minutes * non) / origin)) };
    });
    onMake(made);
  }

  const allOn = off.size === 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-primary-fixed/25 p-3">
        <div className="font-label-md text-label-md font-bold text-deep-navy">{title}</div>
        <p className="font-caption text-caption text-on-surface-variant">
          {lessons.length > 1 ? t('solo.asm_hintMany', { count: lessons.length }) : t('solo.asm_hint')}
        </p>
      </div>

      <ul className="space-y-1.5">
        {blocks.map((b) => {
          const on = !off.has(b.type);
          return (
            <li key={b.type}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2 transition-colors ${on ? 'border-primary/60 bg-primary/5' : 'border-outline-variant/50 bg-surface-container-lowest opacity-70'}`}
              >
                <input type="checkbox" checked={on} onChange={() => toggle(b.type)} className="h-5 w-5 shrink-0 accent-primary" />
                <span className="material-symbols-outlined shrink-0 text-[22px] text-primary">{kindOf(b.type).icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-label-md text-label-md font-bold text-on-surface">{t(`soloEdit.stepType_${b.type}`)}</span>
                  <span className="block truncate font-caption text-caption text-on-surface-variant">
                    {t(`soloEdit.stepHelp_${b.type}`)}
                    {b.sample ? ` · ${t('solo.asm_example', { text: b.sample })}` : ''}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 font-caption text-caption tabular-nums text-on-surface-variant">
                  {t('solo.asm_steps', { count: b.count })}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {warnNoMeet && <p className="rounded-lg bg-warm-yellow/25 px-3 py-2 font-caption text-caption text-on-surface">{t('solo.asm_warnNoMeet')}</p>}

      <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant/40 pt-3">
        <button
          type="button"
          disabled={busy || kept === 0}
          onClick={make}
          className="rounded-full bg-primary px-6 py-2.5 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-50"
        >
          {busy ? t('common.loading') : allOn ? t('solo.asm_makeAll') : t('solo.asm_makeSelected')}
        </button>
        <span className="font-caption text-caption text-on-surface-variant">
          {t('solo.asm_summary', { steps: kept, minutes })}
          {lessons.length > 1 ? ` · ${t('solo.asm_lessons', { count: lessons.length })}` : ''}
        </span>
        {!allOn && (
          <button type="button" onClick={() => setOff(new Set())} className="ml-auto font-caption text-caption text-primary hover:underline">
            {t('solo.asm_reset')}
          </button>
        )}
      </div>
      {kept === 0 && <p className="font-caption text-caption text-error">{t('solo.asm_none')}</p>}
    </div>
  );
}

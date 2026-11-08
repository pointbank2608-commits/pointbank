import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { answerTextLocal, gradeLocal } from '../../../lib/homework/grade';
import type { HwItem, HwItemDraft } from '../../../lib/homework/types';
import { hintMask, type HintLevel } from '../../../lib/homework/spellingHints';
import HomeworkRunner from '../HomeworkRunner';
import type { RunnerApi } from '../runnerTypes';

/**
 * 선생님 미리보기 — 학생 화면과 같은 HomeworkRunner 를 휴대폰 모양 안에서 그대로 돌린다.
 * 서버에 아무것도 저장하지 않고, 채점은 같은 규칙의 브라우저 채점(gradeLocal)으로 한다.
 * startItem: 처음 열 활동(교사용 예시의 대표 화면), startHidden: 말하기 활동을 가리고 말하기 단계부터 연다.
 * showStages: 위에서 다른 단계를 바로 골라 볼 수 있다(교사용 예시 전용).
 */
export default function HomeworkPreview({ title, items, studentName, startImmediately = false, startItem = 0, showStages = false, startHidden = false }: { title: string; items: HwItemDraft[]; studentName?: string; startImmediately?: boolean; startItem?: number; showStages?: boolean; startHidden?: boolean }) {
  const { t } = useTranslation();
  const [round, setRound] = useState(0);
  const [itemIndex, setItemIndex] = useState(Math.max(0, Math.min(startItem, items.length - 1)));
  const withIds: HwItem[] = useMemo(() => items.map((it, i) => ({ ...it, id: `preview-${i}` })), [items]);
  const api = useMemo<RunnerApi>(() => {
    const byId = new Map(withIds.map((it) => [it.id, it]));
    const firsts = new Map<string, boolean>();
    const hints = new Map<string, HintLevel>();
    return {
      spellingHint: async (id, index, level) => {
        const q = byId.get(id)?.content.questions[index];
        const configured = (byId.get(id)?.config.block?.spellingHints?.defaultLevel ?? 0) as HintLevel;
        const allowed = (q && q.word.length < 3 ? Math.min(configured, 1) : configured) as HintLevel;
        const key = `${id}:${index}`;
        const used = Math.max(hints.get(key) ?? 0, Math.min(allowed, level)) as HintLevel;
        hints.set(key, used);
        return { allowed, used, mask: hintMask(q?.word ?? '', used) };
      },
      submit: async (itemId, qIndex, response) => {
        const q = byId.get(itemId)?.content.questions[qIndex];
        if (!q) return { correct: false, answer: null };
        const ok = gradeLocal(q, response);
        const key = `${itemId}:${qIndex}`;
        if (!firsts.has(key)) firsts.set(key, ok);
        return { correct: ok, answer: answerTextLocal(q) };
      },
      progress: async () => undefined,
      finish: async () => {
        const total = withIds.reduce((n, it) => n + it.content.questions.length, 0);
        return { score: [...firsts.values()].filter(Boolean).length, total };
      },
    };
    // round 이 바뀌면 처음부터 다시
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withIds, round]);

  return (
    <div className="flex flex-col items-center gap-2">
      {showStages && items.length > 1 && (
        <label className="flex items-center gap-2">
          {t('studentHw.previewStage', { defaultValue: '미리 볼 단계' })}
          <select className="rounded-lg border p-2" value={itemIndex} onChange={(event) => { setItemIndex(Number(event.target.value)); setRound((r) => r + 1); }}>
            {items.map((item, index) => <option key={index} value={index}>{index + 1}. {item.title}</option>)}
          </select>
        </label>
      )}
      <div className="hw-student-screen relative w-full max-w-[380px] overflow-hidden rounded-[2rem] border-[10px] border-[#0e1530] bg-[#f8f1e3] text-[#1c2742] shadow-xl" style={{ height: 640 }}>
        <div className="flex h-full flex-col overflow-y-auto">
          <HomeworkRunner
            key={`${round}-${itemIndex}`}
            title={title}
            studentName={studentName}
            items={withIds}
            initialAnswers={new Map()}
            finishedItems={new Set()}
            shadowLinesDone={new Map()}
            alreadyFinished={false}
            api={api}
            saveState="saved"
            preview
            startImmediately={startImmediately || startItem > 0 || startHidden || showStages}
            previewStart={itemIndex}
            previewHidden={startHidden}
          />
        </div>
      </div>
      <button type="button" onClick={() => setRound((r) => r + 1)} className="flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-4 font-label-md text-label-md text-on-surface hover:bg-surface-container-low">
        <span className="material-symbols-outlined text-[18px]">restart_alt</span>
        {t('studentHw.previewRestart')}
      </button>
    </div>
  );
}

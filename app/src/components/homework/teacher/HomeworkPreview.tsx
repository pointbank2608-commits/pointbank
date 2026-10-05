import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { answerTextLocal, gradeLocal } from '../../../lib/homework/grade';
import type { HwItem, HwItemDraft } from '../../../lib/homework/types';
import HomeworkRunner from '../HomeworkRunner';
import type { RunnerApi } from '../runnerTypes';

/**
 * 선생님 미리보기 — 학생 화면과 같은 HomeworkRunner 를 휴대폰 모양 안에서 그대로 돌린다.
 * 서버에 아무것도 저장하지 않고, 채점은 같은 규칙의 브라우저 채점(gradeLocal)으로 한다.
 */
export default function HomeworkPreview({ title, items, studentName }: { title: string; items: HwItemDraft[]; studentName?: string }) {
  const { t } = useTranslation();
  const [round, setRound] = useState(0);
  const withIds: HwItem[] = useMemo(() => items.map((it, i) => ({ ...it, id: `preview-${i}` })), [items]);
  const api = useMemo<RunnerApi>(() => {
    const byId = new Map(withIds.map((it) => [it.id, it]));
    const firsts = new Map<string, boolean>();
    return {
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
      <div className="relative w-full max-w-[380px] overflow-hidden rounded-[2rem] border-[10px] border-[#0e1530] bg-[#16213e] text-white shadow-xl" style={{ height: 640 }}>
        <div className="flex h-full flex-col overflow-y-auto">
          <HomeworkRunner
            key={round}
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
          />
        </div>
      </div>
      <button type="button" onClick={() => setRound((r) => r + 1)} className="flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant px-4 font-label-md text-label-md text-on-surface hover:bg-surface-container-low">
        <span className="material-symbols-outlined text-[18px]">restart_alt</span>
        {t('studentHw.previewRestart')}
      </button>
    </div>
  );
}

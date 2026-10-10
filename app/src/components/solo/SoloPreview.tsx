import { useMemo } from 'react';
import { gradeSoloLocal, soloCorrectText, toPublicStep, type SoloStep } from '../../lib/soloLessons';
import SoloPlayer, { type SoloPlayerApi } from './SoloPlayer';

/** 학생 화면 미리보기(기록은 남지 않는다) — 목록의 "미리보기"와 편집기가 같이 쓴다. 저장 전 단계도 미리볼 수 있다. */
export default function SoloPreview({ steps, onClose, startAt = 0 }: { steps: SoloStep[]; onClose: () => void; startAt?: number }) {
  const api = useMemo<SoloPlayerApi>(
    () => ({
      answer: async (step, value) => gradeSoloLocal(steps[step], value) ?? true,
      advance: async (step, unsure) => ({ answer: unsure ? soloCorrectText(steps[step]) : null }),
      reveal: async (step) => soloCorrectText(steps[step]),
    }),
    [steps],
  );
  const pub = useMemo(() => steps.map(toPublicStep), [steps]);
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#16213e]">
      <SoloPlayer steps={pub} startAt={startAt} api={api} onExit={onClose} preview />
    </div>
  );
}

import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import { gradeSoloLocal, soloCorrectText, toPublicStep, type SoloStep } from '../../lib/soloLessons';
import { gradeTestLocal } from '../../lib/soloTest';
import SoloPlayer, { type SoloPlayerApi } from './SoloPlayer';

/** 학생 화면 미리보기(기록은 남지 않는다) — 목록의 "미리보기"와 편집기가 같이 쓴다. 저장 전 단계도 미리볼 수 있다. */
export default function SoloPreview({ steps: lessonSteps, onClose, startAt = 0 }: { steps: SoloStep[]; onClose: () => void; startAt?: number }) {
  const { t } = useTranslation();
  // "틀린 것 다시 풀기"를 누르면 미리보기 안에서 틀린 문제만으로 된 복습을 이어서 보여 준다(서버의 059 와 같은 모양)
  const [retry, setRetry] = useState<{ key: number; steps: SoloStep[] } | null>(null);
  const steps = retry?.steps ?? lessonSteps;
  const api = useMemo<SoloPlayerApi>(
    () => ({
      answer: async (step, value) => {
        const s = steps[step];
        const ok = gradeSoloLocal(s, value) ?? true;
        // 서버(065)처럼 조건 영작을 맞히면 예시 답을 같이 보여 준다
        return s && s.t === 'condWrite' && ok ? { ok, model: s.model } : ok;
      },
      advance: async (step, unsure) => ({ answer: unsure ? soloCorrectText(steps[step]) : null }),
      reveal: async (step) => soloCorrectText(steps[step]),
      // 선생님 미리보기: 로그인한 선생님이 직접 읽는다(RLS 로 자기 학원 것만)
      gameTemplate: async (templateId) => {
        const { data } = await supabase.from('game_templates').select('game_type,name,items,config').eq('id', templateId).maybeSingle();
        return data ? { game_type: data.game_type as string, name: data.name as string, items: (data.items ?? []) as unknown[], config: (data.config ?? {}) as Record<string, unknown> } : null;
      },
      submitTest: async (step, answers) => {
        const s = steps[step];
        return gradeTestLocal(s && s.t === 'test' ? s.items : [], answers);
      },
      retryTest: async (step, wrong) => {
        const s = steps[step];
        if (!s || s.t !== 'test') return;
        const items = wrong.map((i) => s.items[i]).filter(Boolean).map(({ area: _a, sec: _s, ...q }) => q as SoloStep);
        setRetry((cur) => ({
          key: (cur?.key ?? 0) + 1,
          steps: [{ t: 'intro', title: t('soloTest.retryName'), text: t('soloTest.retryIntro', { count: items.length }) }, ...items],
        }));
      },
    }),
    [steps, t],
  );
  const pub = useMemo(() => steps.map(toPublicStep), [steps]);
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#16213e]">
      <SoloPlayer key={retry?.key ?? 0} steps={pub} startAt={retry ? 0 : startAt} api={api} onExit={onClose} preview />
    </div>
  );
}

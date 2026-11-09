import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { createSoloLesson } from '../../lib/soloApi';
import { SOLO_STARTERS, SOLO_STARTER_LABELS, type SoloStarter } from '../../lib/soloStarters';
import SoloPreview from './SoloPreview';

export default function SoloStarterLibrary({ academyId, classId, onSaved }: {
  academyId: string;
  classId: string | null;
  onSaved: () => void;
}) {
  const { i18n, t } = useTranslation();
  const { notify } = useToast();
  const english = i18n.language.startsWith('en');
  const [preview, setPreview] = useState<SoloStarter | null>(null);
  const [saving, setSaving] = useState<SoloStarter | null>(null);

  async function save(starter: SoloStarter) {
    if (!classId || saving) return;
    setSaving(starter);
    try {
      await createSoloLesson({
        academyId,
        classId,
        name: starter.name,
        level: SOLO_STARTER_LABELS[starter.category][english ? 1 : 0],
        minutes: starter.minutes,
        steps: starter.steps,
        source: 'solo-starter-v1',
      });
      notify(english ? 'Saved to individual lessons.' : '저장한 개별수업에 추가했어요.');
      onSaved();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
      <div>
        <h2 className="text-xl font-bold text-deep-navy">{english ? 'Ready-made individual lessons' : '바로 쓰는 개별수업'}</h2>
        <p className="mt-1 text-on-surface-variant">
          {english ? 'Preview the Korean-guided lesson, then save a copy to the selected class.' : '설명과 게임 두 종류, 마지막 확인 문제까지 준비했어요. 미리 보고 선택한 반에 저장하세요.'}
        </p>
        {!classId && <p className="mt-1 text-on-surface-variant">{english ? 'Select a class to save a lesson.' : '수업을 저장하려면 반을 선택하세요.'}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SOLO_STARTERS.map((starter) => (
          <article key={starter.name} className="flex flex-col gap-2 rounded-xl border border-outline-variant p-4">
            <p className="text-sm font-bold text-primary">
              {SOLO_STARTER_LABELS[starter.category][english ? 1 : 0]} · {starter.minutes}{english ? ' min' : '분'}
            </p>
            <h3 className="font-bold text-deep-navy">{starter.name}</h3>
            <p className="flex-1 text-sm text-on-surface-variant">{starter.goal}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPreview(starter)} className="min-h-11 rounded-full border border-outline-variant px-4 font-bold">
                {english ? 'Preview' : '미리보기'}
              </button>
              <button type="button" disabled={!classId || saving !== null} onClick={() => void save(starter)}
                className="min-h-11 rounded-full bg-primary px-4 font-bold text-on-primary disabled:opacity-50">
                {saving === starter ? t('common.loading') : english ? 'Save to class' : '이 반에 저장'}
              </button>
            </div>
          </article>
        ))}
      </div>
      {preview && <SoloPreview steps={preview.steps} onClose={() => setPreview(null)} />}
    </section>
  );
}

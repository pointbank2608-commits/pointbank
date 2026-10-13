import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import type { StagedGame } from '../../lib/soloCurriculum';
import { SOLO_GAME_TYPES, type SoloGameType } from '../../lib/soloLessons';

interface Row {
  id: string;
  name: string;
  gameType: SoloGameType;
}

/**
 * 교과과정 3단계 틀의 "게임" 자리 3곳(기본·심화·총정리)에 선생님이 만든 게임 템플릿을 고른다.
 * 안 고르면 그 자리는 빠른 문제로 채워진다. 학생이 읽을 수 있게 학원 공용이거나 이 반 것만 보인다.
 */
export default function StagedGameSlots({
  academyId,
  classId,
  slots,
  onChange,
}: {
  academyId: string;
  classId: string | null;
  slots: (StagedGame | null)[];
  onChange: (slots: (StagedGame | null)[]) => void;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    let alive = true;
    void supabase
      .from('game_templates')
      .select('id,name,class_id,game_type')
      .eq('academy_id', academyId)
      .in('game_type', SOLO_GAME_TYPES)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!alive) return;
        const list = (data ?? []) as { id: string; name: string; class_id: string | null; game_type: SoloGameType }[];
        setRows(list.filter((r) => r.class_id === null || r.class_id === classId).map((r) => ({ id: r.id, name: r.name, gameType: r.game_type })));
      });
    return () => {
      alive = false;
    };
  }, [academyId, classId]);

  const names = [t('solo.stageName1'), t('solo.stageName2'), t('solo.stageName3')];
  return (
    <div className="space-y-2 rounded-xl border border-outline-variant/50 bg-surface-container-low p-2.5">
      <div className="font-label-md text-label-md font-bold text-on-surface">{t('solo.stageGamesTitle')}</div>
      {rows !== null && rows.length === 0 ? (
        <p className="font-caption text-caption text-on-surface-variant">{t('solo.stageGamesNone')}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          {names.map((n, i) => (
            <label key={i} className="space-y-1">
              <span className="block font-caption text-caption text-on-surface-variant">{n}</span>
              <select
                value={slots[i]?.templateId ?? ''}
                disabled={rows === null}
                onChange={(e) => {
                  const r = rows?.find((x) => x.id === e.target.value);
                  const next = [...slots];
                  next[i] = r ? { gameType: r.gameType, templateId: r.id, title: r.name } : null;
                  onChange(next);
                }}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-2 py-2 text-sm text-on-surface outline-none focus:border-primary"
              >
                <option value="">{t('solo.stageGameDefault')}</option>
                {(rows ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {t(`solo.stageGameKind_${r.gameType}`)} · {r.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      <p className="font-caption text-caption text-on-surface-variant">{t('solo.stageGamesHint')}</p>
    </div>
  );
}

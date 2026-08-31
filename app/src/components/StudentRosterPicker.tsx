import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';
import type { RosterScope } from '../lib/useGameTemplates';

interface Props {
  roster: GameItem[];
  existingLabels: string[];
  scope: RosterScope;
  onScopeChange: (s: RosterScope) => void;
  loading: boolean;
  onAdd: (labels: string[]) => void;
}

/**
 * 게임 참가자를 매번 직접 입력하지 않도록, 이 반/학원 전체 학생 명단에서 클릭 한 번으로
 * 추가할 수 있게 해주는 공통 패널. 돌림판·사다리·순서정하기가 모두 같이 쓴다.
 */
export default function StudentRosterPicker({ roster, existingLabels, scope, onScopeChange, loading, onAdd }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const existingSet = new Set(existingLabels);
  const remaining = roster.filter((s) => !existingSet.has(s.label));

  return (
    <div className="my-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-label-md text-label-md transition-colors ${
          open
            ? 'bg-secondary-container text-on-secondary-container'
            : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
        }`}
      >
        <span className="material-symbols-outlined text-base">groups</span>
        {open ? t('musicPicker.homeworkRosterClose') : t('musicPicker.homeworkRosterOpen')}
      </button>

      {open && (
        <div className="mt-3 p-4 bg-surface-container-low rounded-lg">
          <div className="flex bg-surface-container-lowest rounded-lg p-1 mb-3 w-fit">
            <button
              type="button"
              onClick={() => onScopeChange('class')}
              className={`px-3 py-1 rounded-md font-label-md text-label-md transition-all ${
                scope === 'class' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              {t('musicPicker.rosterThisClass')}
            </button>
            <button
              type="button"
              onClick={() => onScopeChange('academy')}
              className={`px-3 py-1 rounded-md font-label-md text-label-md transition-all ${
                scope === 'academy' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              {t('musicPicker.rosterAcademy')}
            </button>
          </div>

          {loading ? (
            <div className="font-caption text-caption text-on-surface-variant py-2">{t('musicPicker.rosterLoading')}</div>
          ) : remaining.length === 0 ? (
            <div className="font-caption text-caption text-on-surface-variant py-2">
              {roster.length === 0 ? t('musicPicker.rosterEmptyNone') : t('musicPicker.rosterEmptyAllAdded')}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {remaining.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onAdd([s.label])}
                    className="px-3 py-1.5 rounded-full font-label-md text-label-md bg-surface-container-lowest text-on-surface border border-outline-variant/40 hover:bg-secondary-container hover:text-on-secondary-container transition-colors"
                  >
                    + {s.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onAdd(remaining.map((s) => s.label))}
                className="px-3 py-1.5 rounded-lg font-label-md text-label-md bg-primary text-on-primary hover:bg-primary-container transition-colors"
              >
                {t('musicPicker.rosterAddAll', { count: remaining.length })}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

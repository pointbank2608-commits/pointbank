import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playMusic } from '../lib/gameMusic';
import { colorFor } from '../lib/wheel';
import GameFitText from './GameFitText';
import { useGamePlay } from './GameThemeFrame';
import type { GameItem, MusicSelection } from '../lib/types';

interface Props {
  items: GameItem[];
  minSec: number;
  maxSec: number;
  music?: MusicSelection | null;
  resultSound?: MusicSelection | null;
  /** true면 오른쪽에 항목 개수 조절 + 이름 수정 목록 패널을 보여준다(선생님용 실제 플레이 화면에서만). */
  editable?: boolean;
  onEditItem?: (id: string, label: string) => void;
  /** 상단 이름 표시/수정 + 항목 개수 +/- 툴바. GameThemeFrame 안(전체화면 포함)에서도
   * 보이도록 PassTheBall 자체에 둔다 — 페이지 바깥에 두면 전체화면에서 안 보였다. */
  templateName?: string;
  onRenameTemplate?: (name: string) => void;
  onAddItem?: () => void;
  onRemoveItem?: () => void;
}

type Phase = 'idle' | 'active' | 'revealed';

const BALL_SRC = '/skins/passball.png';
const woodShadow = '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)';

/**
 * 공 돌리기. 음악이 흐르는 동안(min~maxSec 사이 무작위 시각에 멈춤) 화면 밖에서 실제 공을
 * 돌리다가, 음악이 멈추면 무작위 "오늘의 미션 단어"가 공개된다 — 그 순간 공을 든 학생이 읽는다.
 */
export default function PassTheBall({
  items,
  minSec,
  maxSec,
  music,
  resultSound,
  editable,
  onEditItem,
  templateName,
  onRenameTemplate,
  onAddItem,
  onRemoveItem,
}: Props) {
  const { t } = useTranslation();
  const { itemsHidden } = useGamePlay();
  const [phase, setPhase] = useState<Phase>('idle');
  const [missionWord, setMissionWord] = useState<GameItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopMusicRef = useRef<() => void>(() => {});
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopMusicRef.current();
    };
  }, []);

  // 오른쪽 목록 입력창의 초안 텍스트를 실제 항목과 맞춰둔다 — 타이핑 중엔 이 draft를
  // 보여주다가(반응성), blur/Enter 시점에 onEditItem으로 실제 반영한다.
  useEffect(() => {
    setItemDrafts(Object.fromEntries(items.map((i) => [i.id, i.label])));
  }, [items]);

  function handleItemDraftChange(id: string, value: string) {
    setItemDrafts((prev) => ({ ...prev, [id]: value }));
  }

  function commitItemDraft(id: string) {
    const value = (itemDrafts[id] ?? '').trim();
    if (value) onEditItem?.(id, value);
  }

  function startEditTemplateName() {
    setTemplateNameDraft(templateName ?? '');
    setEditingTemplateName(true);
  }

  function commitTemplateNameEdit() {
    const trimmed = templateNameDraft.trim();
    setEditingTemplateName(false);
    if (trimmed && trimmed !== templateName) onRenameTemplate?.(trimmed);
  }

  function start() {
    if (phase === 'active' || items.length === 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    stopMusicRef.current();

    setMissionWord(null);
    setPhase('active');
    stopMusicRef.current = playMusic(music, { loop: true });

    const span = Math.max(maxSec - minSec, 0);
    const delaySec = minSec + Math.random() * span;
    timerRef.current = setTimeout(() => {
      const word = items[Math.floor(Math.random() * items.length)];
      setMissionWord(word);
      setPhase('revealed');
      stopMusicRef.current();
      playMusic(resultSound);
    }, delaySec * 1000);
  }

  function reset() {
    if (timerRef.current) clearTimeout(timerRef.current);
    stopMusicRef.current();
    setPhase('idle');
    setMissionWord(null);
  }

  const pill =
    'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <img src={BALL_SRC} alt="" className="mx-auto mb-3 h-16 w-auto" />
        <div className="font-body-md text-body-md">{t('gamePassBall.needParticipants')}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-3 pb-2">
      <div
        className={`flex w-full flex-col items-center gap-6 ${editable ? 'md:flex-row md:items-start md:justify-center' : ''}`}
      >
        <div className={`flex flex-col items-center ${editable && !itemsHidden ? '' : 'w-full'}`}>
          {editable &&
            (editingTemplateName ? (
              <input
                autoFocus
                value={templateNameDraft}
                onChange={(e) => setTemplateNameDraft(e.target.value)}
                onBlur={commitTemplateNameEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTemplateNameEdit();
                  if (e.key === 'Escape') setEditingTemplateName(false);
                }}
                className="mb-2 w-full max-w-[420px] font-headline-lg-mobile text-headline-lg-mobile text-deep-navy bg-surface-container-lowest border border-primary rounded-lg px-2 outline-none text-center"
              />
            ) : (
              <button
                type="button"
                onClick={startEditTemplateName}
                title={t('gameAdmin.renameInlineHint')}
                className="mb-2 max-w-[420px] truncate font-headline-lg-mobile text-headline-lg-mobile text-deep-navy hover:bg-surface-container-lowest rounded-lg px-2 transition-colors"
              >
                {templateName}
              </button>
            ))}
          {editable && !itemsHidden && (
            <div className="mb-3 max-w-[420px] text-center font-caption text-caption text-on-surface-variant">
              {t('gameAdmin.editHintItems')}
            </div>
          )}
          <img
            src={BALL_SRC}
            alt=""
            data-skin-object="ball"
            draggable={false}
            className={`mb-5 w-[min(280px,62vw)] select-none ${phase === 'active' ? 'pb-pass' : ''}`}
            style={{ filter: 'drop-shadow(0 12px 16px rgba(90, 50, 18, 0.22))' }}
          />

          {phase === 'idle' && (
            <button type="button" onClick={start} className={pill}>
              {t('gamePassBall.startButton')}
            </button>
          )}

          {phase === 'active' && (
            <div className="px-4 text-center font-title-md text-[22px] font-bold text-deep-navy [word-break:keep-all]">
              {t('gamePassBall.playingHint')}
            </div>
          )}

          {phase === 'revealed' && missionWord && (
            <>
              <div className="result-pop mb-5 w-[min(420px,92%)] text-center">
                <div className="mb-2 font-title-md text-[15px] font-bold text-secondary">
                  {t('gamePassBall.missionLabel')}
                </div>
                <div
                  className="flex items-center justify-center px-2 py-2"
                  style={{
                    borderRadius: 22,
                    background: 'linear-gradient(180deg, #f8e4b8 0%, #e8c48a 42%, #c9964e 100%)',
                    boxShadow: woodShadow,
                  }}
                >
                  <span
                    className="flex min-h-[72px] w-full items-center justify-center px-4 py-2"
                    style={{
                      borderRadius: 16,
                      background: 'linear-gradient(180deg, #fffef9 0%, #fff4e0 100%)',
                      boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -3px 4px rgba(166,112,48,0.16)',
                    }}
                  >
                    <span className="block w-full min-h-[72px]">
                      <GameFitText text={missionWord.label} fit="block" />
                    </span>
                  </span>
                </div>
              </div>
              <button type="button" onClick={reset} className={pill}>
                {t('gamePassBall.resetButton')}
              </button>
            </>
          )}
        </div>

        {editable && !itemsHidden && (
          <div className="w-full md:w-[260px] md:shrink-0 space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-full bg-surface-container-lowest px-2 py-1.5 shadow-sm">
              <button
                type="button"
                onClick={onRemoveItem}
                disabled={items.length <= 1}
                aria-label={t('gameAdmin.removeItemQuick')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">remove</span>
              </button>
              <span className="font-label-md text-label-md text-on-surface-variant tabular-nums whitespace-nowrap">
                {t('gameAdmin.itemCountLabel', { count: items.length })}
              </span>
              <button
                type="button"
                onClick={onAddItem}
                aria-label={t('gameAdmin.addItemQuick')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary hover:bg-primary-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
              </button>
            </div>
            <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
              {items.map((item, i) => (
                <input
                  key={item.id}
                  value={itemDrafts[item.id] ?? item.label}
                  onChange={(e) => handleItemDraftChange(item.id, e.target.value)}
                  onBlur={() => commitItemDraft(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  style={{ color: colorFor(i) }}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

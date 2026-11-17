import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PhonicsGameCover } from './PhonicsGameArt';
import { gameAvailability, gameName, PHONICS_GAMES } from '../lib/phonicsGames';
import type { CourseUnit } from '../data/phonicsLessons';
import { lessonPhonicsUnits, phonicsLessonOptions, phonicsSlideState, unitsForGame } from '../lib/phonicsLessonGame';
import type { FullCardItem, PhonicsGameSlide } from '../lib/types';
import { useGamePanelAnchor } from './useGamePanelAnchor';
import '../styles/phonics-games.css';
import '../styles/phonics-games-v2.css';
import '../styles/phonics-slide.css';

/** 수업 슬라이드의 파닉스 게임 상세 — 어느 유닛으로 열지, 문제 수·난이도·팀을 정한다(발표 중에는 바로 이 설정으로 열린다). */
export default function PhonicsGameSlideDetail({ slide, cards, topic, onUpdate }: {
  slide: PhonicsGameSlide;
  cards: FullCardItem[];
  topic?: CourseUnit | null;
  onUpdate: (patch: Partial<PhonicsGameSlide>) => void;
}) {
  const { i18n } = useTranslation();
  const [panel, setPanel] = useState<'content' | 'class' | 'settings' | null>(null);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  useGamePanelAnchor(popup, panel ? anchor : null, 512, toolbar);
  const en = i18n.language.startsWith('en');
  const l = (ko: string, english: string) => (en ? english : ko);
  const state = phonicsSlideState(slide.gameId, slide.unitId, cards, en, undefined, topic);
  const game = state.game;
  if (!game) return <p role="alert">{l('이 파닉스 게임을 찾을 수 없어요.', 'This phonics game could not be found.')}</p>;
  const units = unitsForGame(game, lessonPhonicsUnits());
  const unit = state.unit;
  const options = phonicsLessonOptions(slide);
  const steps = [...new Set(units.map(u => u.step))];
  const availableStep = unit && steps.includes(unit.step) ? unit.step : null;
  const alternatives = unit && state.reason ? PHONICS_GAMES.filter(candidate => !gameAvailability(candidate, unit, en)) : [];
  const select = 'min-h-11 rounded-lg border border-outline-variant bg-white px-3 text-on-surface';
  return <div className="phonics-slide-detail space-y-4" data-phonics-slide-detail>
    <div ref={toolbar} className="relative z-30 rounded-2xl border border-outline-variant bg-white p-2 shadow-sm" data-game-toolbar
      onKeyDown={event => { if (panel && event.key === 'Escape') { event.stopPropagation(); setPanel(null); anchor?.focus(); } }}>
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="px-2 font-extrabold text-deep-navy">{gameName(game, en)}</h3>
        <div role="group" aria-label={l('설정', 'Settings')} className="flex flex-wrap gap-1 rounded-xl bg-surface-container-low p-1">
          {([['content', l('수업 유닛', 'Unit')], ['class', l('반 설정', 'Class')], ['settings', l('게임설정', 'Game settings')]] as const)
            .map(([id, name]) => <button key={id} type="button" aria-expanded={panel === id}
              className={`min-h-10 rounded-xl px-3 font-bold ${panel === id ? 'bg-white text-primary ring-1 ring-primary' : 'text-deep-navy'}`}
              onClick={event => { setAnchor(event.currentTarget); setPanel(panel === id ? null : id); }}>{name}</button>)}
        </div>
      </div>
      {panel && <div ref={popup} data-game-toolbar-panel={panel}
        className="absolute z-40 space-y-3 overflow-y-auto rounded-2xl border border-outline-variant bg-white p-4 text-left shadow-xl">
        <div className="flex justify-end"><button type="button" className={select}
          onClick={() => {setPanel(null); anchor?.focus();}}>{l('닫기', 'Close')}</button></div>
        {panel === 'content' && <>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block font-bold">{l('단계', 'Level')}
        <select className={`${select} mt-1 w-full`} aria-label={l('단계', 'Level')} value={availableStep ?? ''}
          onChange={e => { const first = units.find(u => u.step === Number(e.target.value)); if (first) onUpdate({ unitId: first.id }); }}>
          <option value="" disabled>{l('단계 고르기', 'Choose a level')}</option>
          {steps.map(step => <option key={step} value={step}>{l(`${step}단계`, `Level ${step}`)}</option>)}
        </select>
      </label>
      <label className="block font-bold">{l('수업 유닛', 'Unit')}
        <select className={`${select} mt-1 w-full`} aria-label={l('수업 유닛', 'Unit')} value={slide.unitId ?? ''}
          onChange={e => onUpdate({ unitId: e.target.value || undefined })}>
          <option value="">{l('수업 자료에 맞춰 자동', 'Match lesson materials')}</option>
          {units.filter(u => !availableStep || u.step === availableStep).map(u => <option key={u.id} value={u.id}>{l(`${u.step}단계`, `Level ${u.step}`)} · Unit {u.number} · {u.groups.map(g => g.label).join(' / ')}</option>)}
        </select>
      </label>
    </div>
    {alternatives.length > 0 && <label className="block font-bold">{l('이 유닛에 맞는 게임으로 바꾸기', 'Switch to a game for this unit')}
      <select className={`${select} mt-1 w-full`} value="" onChange={e => { if (e.target.value) onUpdate({ gameId: e.target.value }); }}>
        <option value="">{l('게임 고르기', 'Choose a game')}</option>
        {alternatives.map(candidate => <option key={candidate.id} value={candidate.id}>{gameName(candidate, en)}</option>)}
      </select>
    </label>}
        </>}
        {panel === 'settings' && <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-1 font-bold">{l('게임 설정', 'Game settings')}</legend>
          <label className="block">{l('문제 수', 'Rounds')}
            <select className={`${select} mt-1 w-full`} aria-label={l('문제 수', 'Rounds')} value={options.rounds} onChange={e => onUpdate({ rounds: Number(e.target.value) as PhonicsGameSlide['rounds'] })}>
              {[3, 6, 10].map(n => <option key={n} value={n}>{l(`${n}문제`, `${n} rounds`)}</option>)}
            </select>
          </label>
          <label className="block">{l('난이도', 'Difficulty')}
            <select className={`${select} mt-1 w-full`} aria-label={l('난이도', 'Difficulty')} value={options.level} onChange={e => onUpdate({ level: e.target.value as PhonicsGameSlide['level'] })}>
              <option value="easy">{l('쉬움', 'Easy')}</option><option value="normal">{l('보통', 'Normal')}</option><option value="hard">{l('도전', 'Challenge')}</option>
            </select>
          </label>
        </fieldset>}
        {panel === 'class' && <label className="block font-bold">{l('팀', 'Teams')}
          <select className={`${select} mt-1 w-full`} aria-label={l('팀', 'Teams')} value={options.teams} onChange={e => onUpdate({ teams: Number(e.target.value) as PhonicsGameSlide['teams'] })}>
            {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n === 1 ? l('모두 함께', 'Everyone together') : l(`${n}팀`, `${n} teams`)}</option>)}
          </select>
        </label>}
      </div>}
    </div>
    <div className="phonics-slide-cover"><PhonicsGameCover game={game} large /></div>
    <p className="text-on-surface-variant">{game.goal[en ? 1 : 0]}</p>
    {unit && <p className="rounded-xl bg-surface-container-low p-3" data-phonics-unit-summary>
      {slide.unitId ? l('고른 유닛', 'Chosen unit') : topic ? l('워크북에 맞는 유닛', 'Unit matching the workbook') : cards.length ? l('수업 단어에 맞는 유닛', 'Unit matching lesson words') : l('기본 유닛', 'Default unit')}
      {': '}<b>{l(`${unit.step}단계`, `Level ${unit.step}`)} · Unit {unit.number}</b> · <span lang="en">{unit.entries.slice(0, 8).map(e => e.word).join(' · ')}</span>
    </p>}
    {state.reason && <p role="alert" data-phonics-reason className="rounded-xl bg-amber-50 p-3 font-bold text-amber-950">{state.reason}</p>}
    <p className="text-on-surface-variant">{l('수업을 시작하면 이 유닛과 설정으로 게임이 바로 열려요.', 'In class, the game opens right away with this unit and these settings.')}</p>
  </div>;
}

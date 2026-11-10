import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import type { WorkspaceContextValue } from '../context/GameWorkspaceContext';
import { GRAMMAR_POINTS, grammarLevelTag, grammarPoint } from '../lib/grammar';
import { GRAMMAR_GAME_TYPES, type GrammarGameType } from '../lib/grammarGames';
import { grammarGameSupport, MIN_ROUNDS } from '../lib/grammarGamesB';
import { isActivityDraft } from '../lib/quickActivity';
import { gamePreparation } from '../lib/gamePreparation';
import { isSentenceList, listsForGame } from '../lib/gameWorkspace';
import { preparePlayableList } from '../lib/gameGuide';
import { pictureWordModeKind, pictureWordQuestions } from '../lib/pictureWordQuestions';
import { getGrammarPlay, setGrammarPlay } from '../lib/grammarPlay';
import { setGameSoundOn, useGameSoundOn } from '../lib/gameSfx';
import { wordListToCards } from '../lib/gameFromWords';
import BombSoundPicker from './BombSoundPicker';
import { hasOwnTurnDisplay } from '../lib/gamePreparation';
import type { BombSound } from '../lib/bombSound';
import { fetchStudentsOfClass } from '../lib/api';
import TeamOrderPanel from './TeamOrderPanel';
import { useAuth } from '../context/AuthContext';
import { ABSENT_EVENT, loadAbsent, saveAbsent } from '../lib/absent';
import { ROUND_DONE_EVENT, TEAM_ORDER_EVENT, isAutoTurnOn, isShowOrderOn, loadTeamOrder, saveTeamOrder, setAutoTurnOn, setShowOrderOn } from '../lib/teamOrder';
import { GAME_CATALOG } from '../lib/gameCatalog';
import type { GameItem, MusicSelection, WordList } from '../lib/types';
import { MAX_POP_CARDS, MAX_ROUND_CARDS, popcornCount } from '../lib/popcorn';
import GameMusicPicker from './GameMusicPicker';
import { resolveResultSound } from '../lib/gameMusic';
import { PASS_BALL_MUSIC, passBallMusic } from '../lib/passBallMusic';
import GameReportButton from './GameReportButton';

const btn = 'min-h-11 rounded-xl border border-outline-variant bg-white px-4 py-2 text-base font-bold text-deep-navy focus-visible:outline-4 focus-visible:outline-primary disabled:opacity-40';
const primaryBtn = 'min-h-11 rounded-xl bg-primary px-5 py-2 text-base font-bold text-white focus-visible:outline-4 focus-visible:outline-primary disabled:opacity-40';
const tab = (on: boolean) => `min-h-10 rounded-lg px-3.5 text-sm font-bold text-deep-navy transition-colors focus-visible:outline-4 focus-visible:outline-primary ${on ? 'bg-white shadow-sm ring-1 ring-primary/40' : 'hover:bg-white/70'}`;
const util = 'min-h-10 rounded-lg border border-outline-variant bg-white px-3 text-sm font-bold text-deep-navy hover:bg-surface-container-low focus-visible:outline-4 focus-visible:outline-primary';
const field = 'mt-1 min-h-11 w-full rounded-xl border border-outline-variant bg-white px-3 py-2 font-normal';
const ITEM_SETTINGS_GAMES = new Set<string>(['wheel', 'order']);
/** 게임설정 패널에서 바로 고르는 간단한 옵션(옛 페이지 아래 편집 카드를 대신한다). */
type SimpleOpt = { key: string; ko: string; en: string; kind: 'choice' | 'number'; def: string | number; min?: number; max?: number; choices?: { v: string; ko: string; en: string }[]; parse?: (v: string) => unknown; nullAs?: string };
const PICTURE_WORD_OPTION = { v: 'picture', ko: '그림 보고 영어 단어 고르기', en: 'Pick the English word from a picture' };
const SIMPLE_OPTS: Record<string, SimpleOpt[]> = {
  anagram: [{ key: 'anagramStyle', ko: '모양', en: 'Look', kind: 'choice', def: 'rack', choices: [{ v: 'rack', ko: '나무 글자판', en: 'Wooden rack' }, { v: 'tags', ko: '나무 이름표', en: 'Wooden tags' }] }],
  rankorder: [{ key: 'rankOrderStyle', ko: '모양', en: 'Look', kind: 'choice', def: 'podium', choices: [{ v: 'podium', ko: '나무 단상', en: 'Wooden podium' }, { v: 'plates', ko: '점토 명패', en: 'Clay plates' }] }],
  spellword: [
    { key: 'spellwordStyle', ko: '모양', en: 'Look', kind: 'choice', def: 'slate', choices: [{ v: 'slate', ko: '나무 슬레이트', en: 'Slate' }, { v: 'stamps', ko: '점토 스탬프', en: 'Stamps' }] },
    { key: 'spellPreviewSeconds', ko: '단어를 보여주는 시간(초)', en: 'Preview (sec)', kind: 'number', def: 3, min: 1, max: 10 },
  ],
  hangman: [{ key: 'maxAttempts', ko: '기회 횟수 (오답 허용)', en: 'Wrong guesses allowed', kind: 'number', def: 6, min: 1, max: 10 }],
  wordsearch: [{ key: 'wordSearchStyle', ko: '모양', en: 'Look', kind: 'choice', def: 'board', choices: [{ v: 'board', ko: '나무 격자판', en: 'Wooden board' }, { v: 'tiles', ko: '점토 타일', en: 'Clay tiles' }] }],
  crossword: [{ key: 'crosswordStyle', ko: '모양', en: 'Look', kind: 'choice', def: 'board', choices: [{ v: 'board', ko: '나무 퍼즐판', en: 'Wooden board' }, { v: 'blocks', ko: '점토 블록', en: 'Clay blocks' }] }],
  mazechase: [{ key: 'mazeChaseStyle', ko: '모양', en: 'Look', kind: 'choice', def: 'wood', choices: [{ v: 'wood', ko: '나무 미로', en: 'Wooden maze' }, { v: 'garden', ko: '점토 정원', en: 'Clay garden' }] }],
  airplane: [{ key: 'airplaneStyle', ko: '모양', en: 'Look', kind: 'choice', def: 'wood', choices: [{ v: 'wood', ko: '나무 활주로', en: 'Wooden runway' }, { v: 'clay', ko: '점토 하늘', en: 'Clay sky' }] }],
  findmissing: [
    { key: 'revealCount', ko: '숨길 개수', en: 'Hidden cards', kind: 'choice', def: '1', parse: Number, choices: [{ v: '1', ko: '1개', en: '1' }, { v: '2', ko: '2개', en: '2' }, { v: '3', ko: '3개', en: '3' }] },
    { key: 'memorizeSeconds', ko: '외우는 시간', en: 'Memorize time', kind: 'choice', def: '10', nullAs: 'manual', parse: (v) => (v === 'manual' ? null : Number(v)), choices: [{ v: '5', ko: '5초', en: '5s' }, { v: '10', ko: '10초', en: '10s' }, { v: '15', ko: '15초', en: '15s' }, { v: '20', ko: '20초', en: '20s' }, { v: 'manual', ko: '직접 진행(수동)', en: 'Manual' }] },
    { key: 'shuffleCards', ko: '카드 섞기', en: 'Shuffle cards', kind: 'choice', def: 'false', parse: (v) => v === 'true', choices: [{ v: 'false', ko: '자리 그대로', en: 'Keep order' }, { v: 'true', ko: '섞기', en: 'Shuffle' }] },
  ],
  treasuredig: [{ key: 'digTeams', ko: '팀 수', en: 'Teams', kind: 'number', def: 3, min: 2, max: 8 }, { key: 'digMounds', ko: '모래 언덕 수', en: 'Mounds', kind: 'choice', def: '20', parse: Number, choices: [{ v: '12', ko: '12개', en: '12' }, { v: '20', ko: '20개', en: '20' }, { v: '30', ko: '30개', en: '30' }] }],
  fourclues: [{ key: 'clueTeams', ko: '팀 수', en: 'Teams', kind: 'number', def: 3, min: 2, max: 8 }],
  catchsentence: [{ key: 'catchTeams', ko: '팀 수', en: 'Teams', kind: 'number', def: 3, min: 2, max: 8 }],
  lastbox: [{ key: 'boxTeams', ko: '팀 수', en: 'Teams', kind: 'number', def: 3, min: 2, max: 8 }, { key: 'boxCount', ko: '박스 수', en: 'Boxes', kind: 'choice', def: '31', parse: Number, choices: [{ v: '15', ko: '15개', en: '15' }, { v: '21', ko: '21개', en: '21' }, { v: '31', ko: '31개', en: '31' }] }],
  mysterybox: [{ key: 'mysteryMode', ko: '진행 방식', en: 'Mode', kind: 'choice', def: 'mushroom', choices: [{ v: 'mushroom', ko: '버섯 3택 1', en: 'Mushrooms' }, { v: 'quiz', ko: '문제 맞히기', en: 'Questions' }] }, { key: 'boxTeams', ko: '팀 수', en: 'Teams', kind: 'number', def: 3, min: 2, max: 8 }, { key: 'mysteryBlocks', ko: '상자 수', en: 'Boxes', kind: 'choice', def: '28', parse: Number, choices: [{ v: '20', ko: '20칸', en: '20' }, { v: '28', ko: '28칸', en: '28' }] }],
  shufflefind: [{ key: 'shuffleTeams', ko: '팀 수', en: 'Teams', kind: 'number', def: 2, min: 1, max: 4 }, { key: 'shuffleCups', ko: '컵 수', en: 'Cups', kind: 'number', def: 3, min: 3, max: 5 }, { key: 'shuffleRounds', ko: '판 수', en: 'Rounds', kind: 'number', def: 6, min: 1, max: 30 }, { key: 'shuffleSpeed', ko: '섞는 속도', en: 'Speed', kind: 'choice', def: 'normal', choices: [{ v: 'slow', ko: '느리게', en: 'Slow' }, { v: 'normal', ko: '보통', en: 'Normal' }, { v: 'fast', ko: '빠르게', en: 'Fast' }] }],
  tugofwar: [
    { key: 'tugMode', ko: '문제 방식', en: 'Question type', kind: 'choice', def: 'text', choices: [{ v: 'text', ko: '기존 글 문제', en: 'Text questions' }, PICTURE_WORD_OPTION] },
    { key: 'tugPull', ko: '이기는 데 필요한 칸 수', en: 'Pulls to win', kind: 'choice', def: '5', parse: Number, choices: [{ v: '3', ko: '3칸 (짧게)', en: '3' }, { v: '4', ko: '4칸', en: '4' }, { v: '5', ko: '5칸', en: '5' }, { v: '6', ko: '6칸', en: '6' }, { v: '8', ko: '8칸', en: '8' }, { v: '10', ko: '10칸 (길게)', en: '10' }] },
    { key: 'tugFreeze', ko: '틀렸을 때 얼음 시간', en: 'Freeze time', kind: 'choice', def: '3', parse: Number, choices: [{ v: '2', ko: '2초', en: '2s' }, { v: '3', ko: '3초', en: '3s' }, { v: '5', ko: '5초', en: '5s' }] },
    { key: 'tugSeconds', ko: '제한 시간', en: 'Time limit', kind: 'choice', def: '180', parse: Number, choices: [{ v: '0', ko: '제한 없음', en: 'None' }, { v: '60', ko: '1분', en: '1 min' }, { v: '120', ko: '2분', en: '2 min' }, { v: '180', ko: '3분', en: '3 min' }, { v: '300', ko: '5분', en: '5 min' }] },
  ],
  twodice: [
    { key: 'twoDiceSize', ko: '보드 크기', en: 'Board size', kind: 'choice', def: 6, parse: Number, choices: [3, 4, 5, 6].map(n => ({ v: String(n), ko: `${n}×${n}`, en: `${n}×${n}` })) },
    { key: 'twoDiceRounds', ko: '팀당 굴리는 횟수', en: 'Rolls per team', kind: 'choice', def: 9, parse: Number, choices: [6, 9, 12].map(n => ({ v: String(n), ko: `${n}회`, en: String(n) })) },
  ],
  wordhoops: [
    { key: 'hoopsTeams', ko: '참여', en: 'Players', kind: 'choice', def: '2', parse: Number, choices: [{ v: '2', ko: '두 팀 대결', en: 'Two teams' }, { v: '1', ko: '혼자 연습', en: 'Solo practice' }] },
    { key: 'hoopsRule', ko: '승부 방식', en: 'Game rule', kind: 'choice', def: 'race', choices: [{ v: 'race', ko: '정해진 슛을 빨리·정확히', en: 'Fixed shots, fastest' }, { v: 'timed', ko: '제한 시간 안에 많이', en: 'Most baskets in time' }] },
    { key: 'hoopsSeconds', ko: '제한 시간(시간제일 때)', en: 'Time limit (timed)', kind: 'choice', def: '60', parse: Number, choices: [{ v: '30', ko: '30초', en: '30s' }, { v: '45', ko: '45초', en: '45s' }, { v: '60', ko: '1분', en: '1 min' }, { v: '90', ko: '1분 30초', en: '1:30' }, { v: '120', ko: '2분', en: '2 min' }, { v: '180', ko: '3분', en: '3 min' }] },
    { key: 'hoopsMode', ko: '문제 방식', en: 'Question type', kind: 'choice', def: 'meaning', choices: [{ v: 'meaning', ko: '영어 보고 뜻 고르기', en: 'Pick the meaning' }, { v: 'word', ko: '뜻 보고 영어 고르기', en: 'Pick the word' }, { v: 'mixed', ko: '섞어서', en: 'Mixed' }, PICTURE_WORD_OPTION] },
    { key: 'hoopsShots', ko: '슛 수(정해진 슛일 때)', en: 'Shots', kind: 'number', def: 10, min: 3, max: 30 },
  ],
  telepathy: [{ key: 'telepathyTeams', ko: '팀 수', en: 'Teams', kind: 'number', def: 3, min: 2, max: 6 }, { key: 'telepathyChoices', ko: '후보 수', en: 'Choices', kind: 'number', def: 3, min: 3, max: 4 }, { key: 'telepathyRounds', ko: '판 수', en: 'Rounds', kind: 'number', def: 8, min: 1, max: 30 }, { key: 'telepathySeconds', ko: '적는 시간', en: 'Time', kind: 'choice', def: '20', parse: Number, choices: [{ v: '0', ko: '제한 없음', en: 'No limit' }, { v: '10', ko: '10초', en: '10s' }, { v: '15', ko: '15초', en: '15s' }, { v: '20', ko: '20초', en: '20s' }, { v: '30', ko: '30초', en: '30s' }, { v: '45', ko: '45초', en: '45s' }, { v: '60', ko: '60초', en: '60s' }] }],
  lightning: [{ key: 'lightningPlayers', ko: '학생 수', en: 'Players', kind: 'number', def: 8, min: 2, max: 40 }, { key: 'lightningMin', ko: '번개 최소(초)', en: 'Min (sec)', kind: 'number', def: 4, min: 2, max: 30 }, { key: 'lightningMax', ko: '번개 최대(초)', en: 'Max (sec)', kind: 'number', def: 12, min: 3, max: 40 }, { key: 'lightningChar', ko: '번개 맞을 친구', en: 'Character', kind: 'choice', def: 'sheep', choices: [{ v: 'sheep', ko: '양 빌리', en: 'Billy' }, { v: 'boy', ko: '남자아이', en: 'Boy' }, { v: 'girl', ko: '여자아이', en: 'Girl' }, { v: 'umbrella', ko: '우산 든 아저씨', en: 'Umbrella man' }, { v: 'zeus', ko: '번개의 신 제우스', en: 'Zeus' }, { v: 'mermaid', ko: '인어공주', en: 'Mermaid' }] }],
  doctor: [{ key: 'doctorKo', ko: '우리말 해석', en: 'Korean', kind: 'choice', def: 'false', parse: (v) => v === 'true', choices: [{ v: 'false', ko: '가려 두기', en: 'Hidden' }, { v: 'true', ko: '처음부터 보여 주기', en: 'Shown' }] }],
  icecream: [{ key: 'iceCreamKo', ko: '우리말 해석', en: 'Korean', kind: 'choice', def: 'false', parse: (v) => v === 'true', choices: [{ v: 'false', ko: '가려 두기', en: 'Hidden' }, { v: 'true', ko: '처음부터 보여 주기', en: 'Shown' }] }, { key: 'iceCreamMenu', ko: '메뉴 수준', en: 'Menu', kind: 'choice', def: 'full', choices: [{ v: 'basic', ko: '쉬운 메뉴(맛 6가지)', en: 'Easy (6 flavours)' }, { v: 'full', ko: '전체 메뉴(맛 9가지)', en: 'Full (9 flavours)' }] }, { key: 'iceCreamCurrency', ko: '가격 기호', en: 'Currency', kind: 'choice', def: '£', choices: [{ v: '$', ko: '$', en: '$' }, { v: '£', ko: '£', en: '£' }] }],
  flashcards: [
    { key: 'flashcardsStyle', ko: '모양', en: 'Look', kind: 'choice', def: 'wood', choices: [{ v: 'wood', ko: '나무 액자', en: 'Wooden frame' }, { v: 'clay', ko: '점토 카드', en: 'Clay cards' }] },
    { key: 'flashcardsShowPos', ko: '뒷면에 품사 보이기', en: 'Show part of speech on back', kind: 'choice', def: 'false', parse: (v) => v === 'true', choices: [{ v: 'false', ko: '안 보임', en: 'Hidden' }, { v: 'true', ko: '보임', en: 'Shown' }] },
    { key: 'flashcardsShowExample', ko: '뒷면에 예문 보이기', en: 'Show example on back', kind: 'choice', def: 'false', parse: (v) => v === 'true', choices: [{ v: 'false', ko: '안 보임', en: 'Hidden' }, { v: 'true', ko: '보임', en: 'Shown' }] },
  ],
  baskin31: [{ key: 'targetCount', ko: '목표 숫자', en: 'Target number', kind: 'number', def: 31, min: 2, max: 500 }],
};
type ItemSource = 'list' | 'class' | 'type' | 'number';
type Open = 'content' | 'class' | 'settings' | 'saves' | null;
type Mode = 'none' | 'solo' | 'team';

/** 패널 맨 위: 제목 + 적용 + 닫기. 적용을 누르면 "설정이 적용되었습니다."가 잠깐 떴다 사라진다. */
function PanelHead({ title, onApply, busy, onClose, text }: {
  title: string; onApply?: () => void; busy: boolean; onClose: () => void; text: (ko: string, en: string) => string;
}) {
  return (
    <div className="sticky top-0 z-10 -mx-4 mb-1 flex items-center justify-between gap-2 rounded-t-2xl border-b border-outline-variant bg-white px-4 py-3">
      <p className="text-lg font-extrabold">{title}</p>
      <div className="flex items-center gap-2">
        {onApply && <button type="button" className={primaryBtn} disabled={busy} onClick={onApply}>{text('적용', 'Apply')}</button>}
        <button type="button" className={btn} onClick={onClose}>{text('닫기', 'Close')}</button>
      </div>
    </div>
  );
}

/**
 * 게임 상단 도구줄(2026-11-04): 내 단어/문장(문법 게임은 문법) · 반 설정 · 게임설정 · 저장/불러오기 · 다시하기 · 나가기 · 전체화면.
 * 들어오면 샘플로 바로 돌아가고, 위 버튼에서 고른 뒤 "적용"을 누르면 바뀐다.
 */
/** 결과 칸을 참가자 수에 맞춘다: 모자라면 "꽝"으로 채우고, 남으면 뒤에서부터 줄인다. */
function fitResults(results: { id: string; label: string }[], n: number): { id: string; label: string }[] {
  return Array.from({ length: n }, (_, i) => ({ id: results[i]?.id ?? crypto.randomUUID(), label: results[i]?.label?.trim() ? results[i].label : '꽝' }));
}

export default function GameToolbar({ workspace, onRestart, fullscreen, onFullscreen, onExitFullscreen }: {
  workspace: WorkspaceContextValue;
  onRestart?: () => void;
  fullscreen: boolean;
  onFullscreen?: () => void;
  onExitFullscreen?: () => void;
}) {
  const { i18n, t } = useTranslation();
  const text = (ko: string, en: string) => (i18n.language.startsWith('en') ? en : ko);
  const { notify } = useToast();
  const info = workspace.info;
  const soundOn = useGameSoundOn();
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  // 적용을 누르기 전까지 고른 값
  const [pGrammar, setPGrammar] = useState('');
  const [pList, setPList] = useState('');
  const [pPictureMode, setPPictureMode] = useState(false);
  const [pPictureList, setPPictureList] = useState('');
  const [pSaved, setPSaved] = useState('');
  const [pClass, setPClass] = useState('');
  const [pMode, setPMode] = useState<Mode>('none');
  const [pTeams, setPTeams] = useState(2);
  const [pDiceTeams, setPDiceTeams] = useState(2);
  const [pSound, setPSound] = useState(true);
  const [pItemSource, setPItemSource] = useState<ItemSource>('list');
  const [pText, setPText] = useState('');
  const [pEliminate, setPEliminate] = useState(false);
  const [pFrom, setPFrom] = useState('1');
  const [pTo, setPTo] = useState('30');
  const [pStep, setPStep] = useState('1');
  const [pResMode, setPResMode] = useState<'type' | 'rank' | 'one'>('type');
  const [pResText, setPResText] = useState('');
  const [pWinner, setPWinner] = useState('');
  const [pWin, setPWin] = useState(1);
  const [pPartText, setPPartText] = useState('');
  const [pBombSrc, setPBombSrc] = useState<'type' | 'list' | 'none'>('type');
  const [pBombWords, setPBombWords] = useState('');
  const [pBombMin, setPBombMin] = useState('15');
  const [pBombMax, setPBombMax] = useState('60');
  const [pBombSound, setPBombSound] = useState<BombSound>('clock');
  const [pBombMode, setPBombMode] = useState<'pass' | 'timer'>('pass');
  const [pBombCaught, setPBombCaught] = useState(true);
  const [pTimerShow, setPTimerShow] = useState(false);
  const [pPop, setPPop] = useState('1');
  const [pRound, setPRound] = useState('');
  const [pOpt, setPOpt] = useState<Record<string, string>>({});
  const [pBallMin, setPBallMin] = useState('10');
  const [pBallMax, setPBallMax] = useState('30');
  const [pBallWords, setPBallWords] = useState('10');
  const [pTimerMusic, setPTimerMusic] = useState<MusicSelection | null | undefined>(undefined);
  const [pTimerResult, setPTimerResult] = useState<MusicSelection | null | undefined>(undefined);
  const [pTimerSec, setPTimerSec] = useState('10');
  const [pBombTW, setPBombTW] = useState<'none' | 'during' | 'after'>('none');
  const [pItemClass, setPItemClass] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { session, academy } = useAuth();
  const [pAutoTurn, setPAutoTurn] = useState(true);
  const [pAbsent, setPAbsent] = useState<string[]>([]);
  const [absentOpen, setAbsentOpen] = useState(false);
  const [pStudents, setPStudents] = useState<GameItem[]>([]);
  const [pStudentsLoading, setPStudentsLoading] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const pEff = useMemo(() => pStudents.filter((row) => !pAbsent.includes(row.id)), [pStudents, pAbsent]);
  const [showTurn, setShowTurn] = useState(isShowOrderOn);
  const [orderRev, setOrderRev] = useState(0);
  useEffect(() => {
    const update = () => { setShowTurn(isShowOrderOn()); setOrderRev((n) => n + 1); };
    window.addEventListener(TEAM_ORDER_EVENT, update);
    window.addEventListener(ABSENT_EVENT, update);
    return () => { window.removeEventListener(TEAM_ORDER_EVENT, update); window.removeEventListener(ABSENT_EVENT, update); };
  }, []);

  const type = info?.gameType;
  const pictureKind = pictureWordModeKind(type);
  const currentPictureMode = !!info?.selected?.config.pictureWordMode;
  const pictureLists = pictureKind ? (info?.lists ?? []).filter(list => !isSentenceList(list)) : [];
  const pictureList = pictureLists.find(list => list.id === pPictureList);
  const pictureCards = pictureList ? wordListToCards(pictureList).map(({id, word, imageUrl}) => ({id, word, imageUrl})) : undefined;
  const pictureConfig = { ...info?.selected?.config, ...(pictureCards ? { pictureWords: pictureCards, pictureWordListId: pictureList?.id } : {}) };
  const pictureCount = pPictureMode ? pictureWordQuestions(pictureConfig).length : 0;
  const isGrammar = !!type && (GRAMMAR_GAME_TYPES as readonly string[]).includes(type);
  const caps = gamePreparation(type || 'wheel');
  const kinds = caps.kinds as readonly string[];
  const shownLists = useMemo(() => listsForGame(kinds, info?.lists ?? []), [kinds, info?.lists]);
  const nativeTeams = info?.teamCount !== undefined;
  const sample = !info?.selected || isActivityDraft(info.selected.id);
  const saved = (info?.templates ?? []).filter((row) => !isActivityDraft(row.id));
  const current = (info?.selected?.config.grammarId as string | undefined) ?? 'third-s';
  const fullRoster = info?.roster ?? [];
  const absentIds = useMemo(() => { void orderRev; return info?.classId ? loadAbsent(info.classId) : []; }, [info?.classId, orderRev]);
  const currentSource = info?.selected?.config.classroomSource;
  const currentSourceId = currentSource && (info?.lists ?? []).some((row) => row.id === currentSource.id) ? currentSource.id : '';
  const roster = useMemo(() => fullRoster.filter((row) => !absentIds.includes(row.id)), [fullRoster, absentIds]);
  const turnScope = `${session?.user.id}:${academy?.id}`;
  const turnState = useMemo(() => { void orderRev; return roster.length > 0 ? loadTeamOrder(roster, turnScope) : null; }, [roster, turnScope, orderRev]);
  const moveTurn = (to: number) => {
    if (!turnState || turnState.order.length === 0) return;
    const n = turnState.order.length;
    saveTeamOrder(roster, { ...turnState, turn: ((to % n) + n) % n }, turnScope);
  };
  // 한 판이 끝났다는 신호가 오면(돌림판에서 하나를 뽑았다 등) 다음 차례로 넘긴다
  const moveTurnRef = useRef(moveTurn);
  moveTurnRef.current = moveTurn;
  const turnRef = useRef(turnState);
  turnRef.current = turnState;
  useEffect(() => {
    const onDone = () => {
      if (!isShowOrderOn() || !isAutoTurnOn() || !turnRef.current) return;
      moveTurnRef.current(turnRef.current.turn + 1);
    };
    window.addEventListener(ROUND_DONE_EVENT, onDone);
    return () => window.removeEventListener(ROUND_DONE_EVENT, onDone);
  }, []);
  const turnLabel = (id: string) => {
    if (!turnState) return '';
    if (turnState.mode === 'team') {
      const idx = Number(id.split('-')[1]);
      return turnState.teamNames?.[id] || t('teamOrder.teamLabel', { n: idx + 1 });
    }
    return roster.find((row) => row.id === id)?.label ?? '';
  };
  const turnMembers = (id: string) => (turnState?.mode === 'team' ? roster.filter((row) => (turnState.teamOf[row.id] ?? 0) === Number(id.split('-')[1])).map((row) => row.label).join(', ') : '');
  const itemSettings = !!type && ITEM_SETTINGS_GAMES.has(type);
  const isLadder = type === 'ladder';
  const isTwoDice = type === 'twodice';
  const diceTeams = info?.selected?.config.twoDiceTeams ?? 2;
  const isBomb = type === 'bomb';
  const isTimerMatch = type === 'timer';
  const isPopcorn = type === 'popcorn';
  const isPassBall = type === 'passball';
  const simpleOpts = SIMPLE_OPTS[type ?? ''] ?? [];
  // 개인·팀은 반 학생이 있어야 하므로 반이 없으면 첫 반을 자동으로 고른다.
  function pickMode(next: Mode) {
    setPMode(next);
    if (next !== 'none' && !pClass && info?.classes.length) {
      const first = info.classes[0].id;
      setPClass(first);
      setAbsentOpen(false);
      setPAbsent(loadAbsent(first));
    }
  }
  const splitGame = isLadder || isBomb || isTimerMatch; // 참가자는 반 설정, 나머지는 게임설정
  const isWheel = type === 'wheel';
  const hasNumbers = type === 'order';
  const nonEmpty = (v: string) => v.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  const gameName = (() => { const g = GAME_CATALOG.find((row) => row.type === type); return g ? t(g.nameKey) : ''; })();
  const hasContentButton = isGrammar || kinds.length > 0;

  const options = useMemo(
    () => (isGrammar ? GRAMMAR_POINTS.filter((p) => grammarGameSupport(p.id)[type as GrammarGameType] >= MIN_ROUNDS[type as GrammarGameType]) : []),
    [isGrammar, type],
  );
  const usable = (list: WordList) => !!info && !!preparePlayableList(info.gameType, list);

  // 패널을 열 때마다 지금 상태로 초기화
  useEffect(() => {
    if (!open) return;
    const play = getGrammarPlay();
    setPGrammar(current);
    setPList(currentSourceId);
    setPPictureMode(currentPictureMode);
    setPPictureList('');
    setPSaved('');
    setPClass(info?.classId || '');
    setPDiceTeams(diceTeams);
    const teamCap = isGrammar ? 4 : nativeTeams ? 8 : 6;
    setPMode(isGrammar ? (play.teams > 0 ? 'team' : play.showScore ? 'solo' : 'none') : !isShowOrderOn() ? 'none' : turnState?.mode === 'team' ? 'team' : 'solo');
    setPTeams(Math.min(teamCap, Math.max(2, nativeTeams ? (info?.teamCount ?? 2) : (turnState?.mode === 'team' ? turnState.teamCount : play.teams || 2))));
    setPAbsent(info?.classId ? loadAbsent(info.classId) : []);
    setAbsentOpen(false);
    if (!isTwoDice && !info?.classId && info?.classes.length && !(isGrammar ? play.teams === 0 && !play.showScore : !isShowOrderOn())) {
      const first = info.classes[0].id;
      setPClass(first);
      setPAbsent(loadAbsent(first));
    }
    setPSound(soundOn);
    setPItemSource('type');
    setPItemClass(info?.classId || '');
    setPText((info?.selected?.items ?? []).map((row) => row.label).join('\n'));
    setPEliminate(!!info?.selected?.config.wheelEliminate);
    setPResMode('type');
    setPBombSrc('type');
    setPBombWords((info?.selected?.config.words ?? []).map((row) => row.label).join('\n'));
    setPBombMin(String(info?.selected?.config.bombRange?.min ?? 15));
    setPBombMax(String(info?.selected?.config.bombRange?.max ?? 60));
    setPBombSound(info?.selected?.config.bombSound ?? 'clock');
    setPBombMode(info?.selected?.config.bombMode ?? 'pass');
    setPBombCaught(info?.selected?.config.bombStartFromCaught !== false);
    setPTimerShow(info?.selected?.config.timerShowClock ?? false);
    setPPop(String(popcornCount(info?.selected?.items.length ?? 0, info?.selected?.config.popcornPopCount, info?.selected?.config.popcornRoundCards)));
    setPBallMin(String(info?.selected?.config.ballRange?.min ?? 10));
    setPBallMax(String(info?.selected?.config.ballRange?.max ?? 30));
    setPBallWords(String(info?.selected?.config.passBallRoundWords ?? Math.min(info?.selected?.items.length ?? 10, 10)));
    setPRound(info?.selected?.config.popcornRoundCards ? String(info.selected.config.popcornRoundCards) : '');
    setPOpt(Object.fromEntries((SIMPLE_OPTS[type ?? ''] ?? []).map((o) => [o.key, (() => { const v = (info?.selected?.config as Record<string, unknown> | undefined)?.[o.key]; return v === null ? (o.nullAs ?? String(o.def)) : String(v ?? o.def); })()])));
    setPTimerMusic(info?.selected?.config.music);
    setPTimerResult(resolveResultSound(info?.selected?.config.resultSound));
    setPTimerSec(String(((info?.selected?.config.targetMs ?? 10000) / 1000).toFixed(2)).replace(/\.?0+$/, ''));
    setPBombTW(info?.selected?.config.bombTimerWords ?? 'none');
    setPResText((info?.selected?.config.results ?? []).map((row) => row.label).join('\n'));
    setPWinner('');
    setPWin(1);
    setPPartText((info?.selected?.items ?? []).map((row) => row.label).join('\n'));
    setSavedMsg('');
    setDeleteId(null);
    setPAutoTurn(isAutoTurnOn());
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // 저장한 게임을 불러오면 그 게임에 담긴 참여 방식도 같이 적용한다(문법 게임)
  const appliedFor = useRef('');
  useEffect(() => {
    const row = info?.selected;
    if (!isGrammar || !row || isActivityDraft(row.id) || appliedFor.current === row.id) return;
    appliedFor.current = row.id;
    const p = row.config.grammarPlay;
    if (p) setGrammarPlay({ teams: p.teams, showScore: p.showScore });
  }, [info?.selected, isGrammar]);

  // 반 설정에서 고른 반의 학생을 미리 불러와 보여 준다. 반을 실제로 바꾸는 것은 "적용"을 눌렀을 때뿐이다
  // (고르자마자 바꾸면 게임이 다시 준비되면서 이 패널이 닫혀 버렸다).
  useEffect(() => {
    if (open !== 'class' || !pClass) { setPStudents([]); return; }
    let live = true;
    setPStudentsLoading(true);
    fetchStudentsOfClass(pClass)
      .then((rows) => { if (live) setPStudents(rows.map((row): GameItem => ({ id: row.id, label: row.name }))); })
      .catch(() => { if (live) setPStudents([]); })
      .finally(() => { if (live) setPStudentsLoading(false); });
    return () => { live = false; };
  }, [open, pClass]);

  const teamCapOf = () => (isGrammar ? 4 : nativeTeams ? 8 : 6);
  const toggle = (next: Exclude<Open, null>) => setOpen((o) => (o === next ? null : next));
  const done = () => { notify(text('설정이 적용되었습니다.', 'Your settings have been applied.')); setOpen(null); };
  async function run(fn: () => Promise<void> | void) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      done();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      notify(msg === 'guide_not_available' ? text('저장한 게임의 항목은 여기서 바꿀 수 없어요. 새 게임에서 다시 시도해 주세요.', 'Items of a saved game cannot be changed here.') : msg || text('적용하지 못했어요. 다시 시도해 주세요.', 'Could not apply. Please try again.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  const applyContent = () => run(async () => {
    if (!info) return;
    if (isBomb && info.selected) {
      let labels: string[] = [];
      if (pBombSrc === 'type') labels = nonEmpty(pBombWords);
      else if (pBombSrc === 'list') {
        const list = info.lists.find((row) => row.id === pList);
        if (!list) throw new Error(text('읽을 내용으로 쓸 단어장을 골라 주세요.', 'Pick a list.'));
        labels = wordListToCards(list).map((card) => card.word.trim()).filter(Boolean);
        if (!labels.length) throw new Error(text('읽을 내용이 있는 단어장을 골라 주세요.', 'Pick a list with words or sentences.'));
      }
      const oldWords = info.selected.config.words ?? [];
      const words = labels.map((label, i) => (oldWords[i]?.label === label ? oldWords[i] : { id: crypto.randomUUID(), label }));
      await workspace.applyGuideAndPlay({ items: info.selected.items, config: { ...info.selected.config, words, classroomSource: undefined } });
      return;
    }
    if (isGrammar) {
      if (pGrammar !== current && info.selected) {
        await info.applyGuide({ items: [{ id: `grammar-${pGrammar}`, label: grammarPoint(pGrammar)?.name ?? pGrammar }], config: { ...info.selected.config, grammarId: pGrammar } });
      }
      return;
    }
    if (pList && pList !== currentSourceId) {
      const list = info.lists.find((row) => row.id === pList);
      if (list) await workspace.applyListAndPlay(list);
    } else if (pSaved) info.selectTemplate(pSaved);
    else if (pList && workspace.canStart && !workspace.running) workspace.start();
  });
  const applyClass = () => run(async () => {
    if (!info) return;
    const classChanged = pClass !== (info.classId || '');
    if (pClass) saveAbsent(pClass, pAbsent);
    if (isTwoDice) {
      if (info.selected && pDiceTeams !== diceTeams) {
        await info.applyGuide({
          items: info.selected.items,
          config: { ...info.selected.config, twoDiceTeams: pDiceTeams },
        });
      }
      if (classChanged) info.selectClass(pClass);
      return;
    }
    // 차례·팀을 짤 명단(결석 제외). 반을 바꾸는 중이면 그 반 학생을 바로 불러온다.
    const students = pStudents.length > 0 ? pStudents : classChanged && pClass ? (await fetchStudentsOfClass(pClass)).map((row): GameItem => ({ id: row.id, label: row.name })) : fullRoster;
    const gone = pClass ? loadAbsent(pClass) : [];
    const eff = students.filter((row) => !gone.includes(row.id));
    setShowOrderOn(pMode !== 'none');
    setAutoTurnOn(pAutoTurn);
    if (pMode !== 'none' && eff.length > 0) {
      const cur = loadTeamOrder(eff, turnScope);
      const mode = pMode === 'team' ? 'team' : 'individual';
      const changed = cur.mode !== mode || (mode === 'team' && cur.teamCount !== pTeams);
      if (mode === 'team' && changed) {
        // 팀은 무작위로 나누고 팀 순서도 섞는다(직접 바꾸려면 "팀·순서 정하기")
        const shuffled = [...eff].sort(() => Math.random() - 0.5);
        const teamOf: Record<string, number> = {};
        shuffled.forEach((row, i) => { teamOf[row.id] = i % pTeams; });
        const order = Array.from({ length: pTeams }, (_, i) => `team-${i}`).sort(() => Math.random() - 0.5);
        saveTeamOrder(eff, { ...cur, mode, teamCount: pTeams, teamOf, order, turn: 0 }, turnScope);
      } else {
        saveTeamOrder(eff, { ...cur, mode, teamCount: pTeams, order: changed ? [] : cur.order, turn: changed ? 0 : cur.turn }, turnScope);
      }
    } else {
      window.dispatchEvent(new Event(TEAM_ORDER_EVENT));
    }
    if (splitGame && pMode !== 'none' && info.selected) {
      // 사다리의 참가자는 반 설정이 정한다: 개인 = 학생 이름, 팀 = 팀 이름. 결과 칸은 참가자 수에 자동으로 맞춘다(모자라면 꽝).
      const labels = pMode === 'team' ? Array.from({ length: pTeams }, (_, i) => t('teamOrder.teamLabel', { n: i + 1 })) : eff.map((row) => row.label);
      if (labels.length >= 2) {
        const old = info.selected.items;
        const items = labels.map((label, i): GameItem => ({ id: old[i]?.id ?? crypto.randomUUID(), label }));
        if (isLadder) {
          const results = fitResults(info.selected.config.results ?? [], items.length);
          await info.applyGuide({ items, config: { ...info.selected.config, results } });
        } else {
          await info.applyGuide({ items, config: { ...info.selected.config, classroomSource: undefined } });
        }
      }
    }
    if (classChanged) info.selectClass(pClass);
    if (isGrammar) setGrammarPlay(pMode === 'none' ? { teams: 0, showScore: false } : pMode === 'solo' ? { teams: 0, showScore: true } : { teams: pTeams, showScore: true });
    if (nativeTeams && pMode === 'team' && pTeams !== info.teamCount) await info.configureTeams(pTeams);
  });
  const applySettings = () => run(async () => {
    setGameSoundOn(pSound);
    if (pictureKind && info?.selected && (pPictureMode || currentPictureMode)) {
      if (pPictureMode && !pictureCount) throw new Error(t('gameWordHoops.pictureNeedsList'));
      await workspace.applyGuideAndPlay({ items: info.selected.items, config: { ...pictureConfig, pictureWordMode: pPictureMode } });
      return;
    }
    if (info?.selected && isBomb) {
      const parts = nonEmpty(pPartText);
      if (pBombMode === 'pass' && parts.length < 2) throw new Error(text('참가자 순서대로 하려면 참가자가 2명 이상 있어야 해요. 반 설정에서 반을 고르거나 아래에 직접 입력해 주세요.', 'Need at least 2 players.'));
      const min = Math.max(1, Math.round(Number(pBombMin)) || 1);
      const max = Math.max(min, Math.round(Number(pBombMax)) || min);
      const old = info.selected.items;
      const items = parts.length >= 2 ? parts.map((label, i): GameItem => (old[i]?.label === label ? old[i] : { id: old[i]?.id ?? crypto.randomUUID(), label })) : old;
      await info.applyGuide({ items, config: { ...info.selected.config, bombMode: pBombMode, bombTimerWords: pBombTW, bombStartFromCaught: pBombCaught, bombRange: { min, max }, bombSound: pBombSound, classroomSource: undefined } });
      return;
    }
    if (info?.selected && simpleOpts.length > 0) {
      const patch: Record<string, unknown> = {};
      for (const o of simpleOpts) {
        const raw = pOpt[o.key] ?? String(o.def);
        if (o.kind === 'number') {
          const n = Math.round(Number(raw));
          if (!Number.isFinite(n) || n < (o.min ?? 0) || n > (o.max ?? 9999)) throw new Error(text(`${o.ko}은(는) ${o.min ?? 0}~${o.max ?? 9999} 사이로 적어 주세요.`, `${o.en}: ${o.min ?? 0}-${o.max ?? 9999}.`));
          patch[o.key] = n;
        } else patch[o.key] = (o.parse ? o.parse(raw) : raw) as string | number;
      }
      if (typeof patch.lightningMin === 'number' && typeof patch.lightningMax === 'number' && patch.lightningMin >= patch.lightningMax) throw new Error(text('번개 최소 시간은 최대 시간보다 작아야 해요.', 'Min must be less than max.'));
      const content = { items: info.selected.items, config: { ...info.selected.config, ...patch } };
      if (type === 'wordhoops' || type === 'tugofwar') {
        if ((patch.hoopsMode === 'picture' || patch.tugMode === 'picture') && !pictureWordQuestions(content.config).length) {
          throw new Error(t('gameWordHoops.pictureNeedsList'));
        }
        await workspace.applyGuideAndPlay(content);
      } else await info.applyGuide(content);
      return;
    }
    if (info?.selected && isPassBall) {
      const min = Math.round(Number(pBallMin));
      const max = Math.round(Number(pBallMax));
      if (!Number.isFinite(min) || !Number.isFinite(max) || min < 1 || max < min) throw new Error(text('시간은 1초 이상, 최소 ≤ 최대로 적어 주세요.', 'Use at least 1 sec, with min ≤ max.'));
      const words = Math.round(Number(pBallWords));
      if (!Number.isFinite(words) || words < 1 || words > 100) throw new Error(text('라운드당 단어/문장 수는 1~100개로 적어 주세요.', 'Words per round: 1-100.'));
      await info.applyGuide({ items: info.selected.items, config: { ...info.selected.config, ballRange: { min, max }, passBallRoundWords: words, music: pTimerMusic, resultSound: pTimerResult } });
      return;
    }
    if (info?.selected && isPopcorn) {
      const v = Number(pPop);
      if (!Number.isInteger(v) || v < 0 || v > MAX_POP_CARDS) throw new Error(text(`POP 카드는 0~${MAX_POP_CARDS}개로 적어 주세요.`, `Pop cards: 0-${MAX_POP_CARDS}.`));
      const rcRaw = pRound.trim();
      const rc = rcRaw === '' ? 0 : Number(rcRaw);
      if (!Number.isInteger(rc) || rc < 0 || rc > MAX_ROUND_CARDS) throw new Error(text(`라운드당 카드 수는 1~${MAX_ROUND_CARDS}장(비우면 낱말 전부)으로 적어 주세요.`, `Cards per round: 1-${MAX_ROUND_CARDS} (blank = all words).`));
      if (rc > 0 && v > rc) throw new Error(text('POP 카드 수는 라운드당 카드 수보다 많을 수 없어요.', 'Pop cards cannot exceed cards per round.'));
      await info.applyGuide({ items: info.selected.items, config: { ...info.selected.config, popcornPopCount: v, popcornRoundCards: rc > 0 ? rc : undefined } });
      return;
    }
    if (info?.selected && isTimerMatch) {
      const sec = Number(pTimerSec);
      if (!Number.isFinite(sec) || sec < 0.5) throw new Error(text('목표 시간은 0.5초 이상으로 적어 주세요.', 'Target must be at least 0.5 sec.'));
      const parts = nonEmpty(pPartText);
      if (parts.length < 1) throw new Error(text('참가자가 1명 이상 있어야 해요. 반 설정에서 반을 고르거나 아래에 직접 입력해 주세요.', 'Need at least 1 player.'));
      const old = info.selected.items;
      const items = parts.map((label, i): GameItem => (old[i]?.label === label ? old[i] : { id: old[i]?.id ?? crypto.randomUUID(), label }));
      await info.applyGuide({ items, config: { ...info.selected.config, targetMs: Math.round(sec * 1000), timerShowClock: pTimerShow, music: pTimerMusic, resultSound: pTimerResult, classroomSource: undefined } });
      return;
    }
    if (info?.selected && isLadder) {
      const parts = nonEmpty(pPartText);
      if (parts.length < 2) throw new Error(text('참가자가 2명 이상 있어야 해요. 반 설정에서 반을 고르거나 아래에 직접 입력해 주세요.', 'Need at least 2 players.'));
      const old = info.selected.items;
      const items = parts.map((label, i): GameItem => (old[i]?.label === label ? old[i] : { id: old[i]?.id ?? crypto.randomUUID(), label }));
      let labels: string[];
      if (pResMode === 'rank') labels = items.map((_, i) => text(`${i + 1}등`, `#${i + 1}`));
      else if (pResMode === 'one') labels = items.map((_, i) => (i < Math.min(pWin, Math.max(1, items.length - 1)) ? (pWinner.trim() || text('당첨!', 'Win!')) : '꽝'));
      else labels = nonEmpty(pResText);
      const results = fitResults(labels.map((label, i) => ({ id: info.selected!.config.results?.[i]?.id ?? crypto.randomUUID(), label })), items.length);
      await info.applyGuide({ items, config: { ...info.selected.config, results, ladderResultOrder: pResMode === 'type' ? info.selected.config.ladderResultOrder : 'random' } });
      return;
    }
    if (!info || !itemSettings || !info.selected) return;
    const base = isWheel ? { ...info.selected.config, wheelEliminate: pEliminate } : type === 'order' ? { ...info.selected.config, music: pTimerMusic, resultSound: pTimerResult } : { ...info.selected.config };
    if (pItemSource === 'list' && pList) {
      const list = info.lists.find((row) => row.id === pList);
      const content = list ? preparePlayableList(info.gameType, list) : null;
      if (!list || !content) throw new Error(text('이 게임에 쓸 수 없는 단어장이에요.', 'This list cannot be used here.'));
      await workspace.applyGuideAndPlay({ items: content.items, config: { ...base, ...content.config, classroomSource: { id: list.id, name: list.name, kind: isSentenceList(list) ? 'sentence' : 'word', version: list.updated_at, cards: wordListToCards(list) } } });
    } else if (pItemSource === 'class') {
      if (!pItemClass) throw new Error(text('반을 먼저 골라 주세요.', 'Pick a class first.'));
      // 반을 바꾸는 데 시간이 걸리므로 학생 명단은 여기서 직접 불러온다
      const students = await fetchStudentsOfClass(pItemClass);
      const names = students.map((row) => row.name.trim()).filter(Boolean);
      if (names.length < 2) throw new Error(text('이 반에 학생이 2명 이상 있어야 해요. 학생·출석 메뉴에서 먼저 추가해 주세요.', 'This class needs at least 2 students.'));
      await info.applyGuide({ items: names.map((label): GameItem => ({ id: crypto.randomUUID(), label })), config: base });
    } else if (pItemSource === 'number') {
      const from = Number(pFrom);
      const to = Number(pTo);
      const step = Number(pStep);
      if (![from, to, step].every(Number.isFinite) || step <= 0 || to < from) throw new Error(text('시작 숫자·끝 숫자·간격을 확인해 주세요. (끝 숫자는 시작보다 크고 간격은 1 이상)', 'Check the start, end and step numbers.'));
      const count = Math.floor((to - from) / step) + 1;
      if (count < 2) throw new Error(text('숫자가 2개 이상 나오게 범위를 넓혀 주세요.', 'The range needs at least 2 numbers.'));
      if (count > 500) throw new Error(text('숫자는 500개까지만 만들 수 있어요.', 'At most 500 numbers.'));
      await info.applyGuide({ items: Array.from({ length: count }, (_, i): GameItem => ({ id: crypto.randomUUID(), label: String(from + i * step) })), config: base });
    } else if (pItemSource === 'type') {
      const lines = pText.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error(text('항목을 2개 이상 입력해 주세요.', 'Enter at least 2 items.'));
      // 같은 자리에 같은 글이면 원래 항목(id)을 그대로 둔다
      const old = info.selected.items;
      await info.applyGuide({ items: lines.map((label, i): GameItem => (old[i]?.label === label ? old[i] : { ...old[i], id: crypto.randomUUID(), label })), config: base });
    } else {
      // 항목은 그대로 두고 순서 정하기 옵션만 바꾼다
      await info.applyGuide({ items: info.selected.items, config: base });
    }
  });
  async function removeSaved(id: string) {
    if (!info || busy) return;
    setBusy(true);
    try {
      await info.removeTemplate(id);
      setDeleteId(null);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!info?.selected || busy) return;
    setBusy(true);
    try {
      if (isGrammar) {
        const play = getGrammarPlay();
        await info.applyGuide({ items: info.selected.items, config: { ...info.selected.config, grammarPlay: { teams: play.teams, showScore: play.showScore } } });
      }
      await info.saveSettings(name.trim() || undefined, true);
      setName('');
      setSavedMsg(text('저장했어요.', 'Saved.'));
      notify(text('저장했어요.', 'Saved.'));
    } catch (err) {
      notify(err instanceof Error ? err.message : text('저장하지 못했어요.', 'Could not save.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  const close = () => setOpen(null);
  const chip = (on: boolean) => `${btn} min-w-16 ${on ? 'ring-2 ring-primary' : ''}`;
  // 샘플·임시 자료는 게임 이름만, 저장한 게임을 불러왔을 때는 저장한 이름을 보여 준다
  const status = isGrammar
    ? (grammarPoint(current)?.name ?? '')
    : (info?.selected && !isActivityDraft(info.selected.id) ? info.selected.name : gameName);
  const panel = (children: ReactNode) => (
    <div className="absolute right-2 top-full z-40 mt-1 max-h-[75vh] w-[min(32rem,94vw)] space-y-3 overflow-y-auto rounded-2xl border border-outline-variant bg-white p-4 pt-0 text-left shadow-xl">{children}</div>
  );

  return (
    <div className="relative z-30 shrink-0 rounded-2xl border border-outline-variant bg-white/95 p-2 shadow-sm backdrop-blur" data-frame-controls data-play-controls data-game-toolbar>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="min-w-0 max-w-[14rem] truncate px-2 text-base font-extrabold text-deep-navy" role="status">{status}</p>
        <div className="flex flex-wrap gap-1 rounded-xl bg-surface-container-low p-1" role="group" aria-label={text('설정', 'Settings')}>
          {isLadder && <button className={`${tab(false)} cursor-not-allowed opacity-40`} disabled title={text('사다리는 참가자를 반 설정에서, 결과를 게임설정에서 정해요', 'Set players in Class and results in Settings')}>{text('내 단어/문장', 'My words')}</button>}
          {hasContentButton && !isLadder && <button className={tab(open === 'content')} aria-expanded={open === 'content'} onClick={() => toggle('content')}>{isGrammar ? text('문법', 'Grammar') : text('내 단어/문장', 'My words')}</button>}
          <button className={tab(open === 'class')} aria-expanded={open === 'class'} onClick={() => toggle('class')}>{text('반 설정', 'Class')}</button>
          <button className={tab(open === 'settings')} aria-expanded={open === 'settings'} onClick={() => (pictureKind || isGrammar || itemSettings || splitGame || isPopcorn || isPassBall || simpleOpts.length > 0 ? toggle('settings') : (close(), workspace.open('settings')))}>{text('게임설정', 'Settings')}</button>
          <button className={tab(open === 'saves')} aria-expanded={open === 'saves'} onClick={() => toggle('saves')}>{text('저장/불러오기', 'Save / Load')}</button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {workspace.playing && <button type="button" className={`${util} ${workspace.running ? '' : 'bg-primary! text-white!'}`} disabled={!workspace.running && !workspace.canStart} onClick={workspace.running ? workspace.pause : workspace.start}>
            {t(workspace.running ? 'teacherGame.pause' : 'flow.resume')}
          </button>}
          {onRestart && <button className={util} onClick={onRestart} data-frame-restart>{text('다시하기', 'Restart')}</button>}
          <button className={util} onClick={fullscreen ? onExitFullscreen : onFullscreen}>{text(fullscreen ? '전체화면 끄기' : '전체화면', fullscreen ? 'Exit fullscreen' : 'Fullscreen')}</button>
          <button className={`${util} text-error`} onClick={() => { close(); workspace.exitPlay(); }}>{text('나가기', 'Exit')}</button>
          {gameName && <GameReportButton gameName={gameName} className={util} />}
        </div>
      </div>
      {showTurn && !hasOwnTurnDisplay(info?.gameType ?? 'wheel', info?.selected?.config) && turnState && turnState.order.length > 0 && (() => {
        const n = turnState.order.length;
        const now = turnState.order[turnState.turn];
        const upcoming = [1, 2, 3].filter((k) => k < n).map((k) => turnState.order[(turnState.turn + k) % n]);
        const members = turnMembers(now);
        return (
          <div className="mt-2 flex w-full items-center gap-3 rounded-xl bg-gradient-to-r from-warm-yellow/40 via-primary-fixed to-white px-3 py-2" data-turn-bar role="status" aria-live="polite">
            <button type="button" disabled={workspace.playing && !workspace.running} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-deep-navy shadow-sm hover:bg-surface-container-low disabled:opacity-40" aria-label={text('이전 차례', 'Previous turn')} onClick={() => moveTurn(turnState.turn - 1)}>◀</button>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
              <p className="flex min-w-0 items-center gap-2 text-2xl font-extrabold text-deep-navy">
                <span className="shrink-0 rounded-full bg-deep-navy px-3 py-0.5 text-xs font-bold text-white">{text('지금 차례', 'Now')}</span>
                <span className="truncate">{turnLabel(now)}</span>
                {members && <span className="truncate text-sm font-medium text-on-surface-variant">{members}</span>}
              </p>
              {upcoming.length > 0 && (
                <p className="flex min-w-0 items-center gap-1.5 text-sm text-on-surface-variant">
                  <span className="shrink-0 font-bold">{text('다음', 'Next')}</span>
                  {upcoming.map((id) => <span key={id} className="truncate rounded-full bg-white/80 px-2.5 py-0.5 font-semibold text-deep-navy">{turnLabel(id)}</span>)}
                </p>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-bold tabular-nums text-on-surface-variant">{turnState.turn + 1} / {n}</span>
            <button type="button" disabled={workspace.playing && !workspace.running} className={primaryBtn} onClick={() => moveTurn(turnState.turn + 1)}>{text('다음 차례', 'Next turn')}</button>
          </div>
        );
      })()}

      {open === 'content' && panel(<>
        <PanelHead title={isGrammar ? text('문법', 'Grammar') : text('내 단어/문장', 'My words / sentences')} onApply={() => void applyContent()} busy={busy} onClose={close} text={text} />
        {!isGrammar && (
          <p className="rounded-xl bg-sky-50 p-3 text-sm font-bold">
            {currentSource
              ? text(`지금 쓰는 자료: ${currentSource.name} (${currentSource.cards.length}개)`, `Current: ${currentSource.name} (${currentSource.cards.length})`)
              : sample
                ? text('지금은 샘플 자료예요. 고르고 "적용"을 누르면 바뀌어요.', 'This is a sample. Pick one and press Apply.')
                : text(`지금 쓰는 자료: 직접 입력한 항목 ${info?.selected?.items.length ?? 0}개`, `Current: ${info?.selected?.items.length ?? 0} typed items`)}
          </p>
        )}
        {isBomb ? (
          <div className="space-y-3">
            <p className="text-sm text-on-surface-variant">{text('폭탄이 터지기 전에 읽을 단어나 문장이에요. 참가자는 반 설정에서 정해요.', 'Words or sentences to read before the bomb goes off.')}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(pBombSrc === 'type')} aria-pressed={pBombSrc === 'type'} onClick={() => setPBombSrc('type')}>{text('직접 입력·편집', 'Type / edit')}</button>
              <button type="button" className={chip(pBombSrc === 'list')} aria-pressed={pBombSrc === 'list'} onClick={() => setPBombSrc('list')}>{text('내 단어장/문장', 'My lists')}</button>
              <button type="button" className={chip(pBombSrc === 'none')} aria-pressed={pBombSrc === 'none'} onClick={() => setPBombSrc('none')}>{text('읽을 내용 없음', 'None')}</button>
            </div>
            {pBombSrc === 'type' && (
              <label className="block text-sm font-bold">{text('읽을 내용 (한 줄에 하나)', 'Words to read (one per line)')}
                <span className="ml-2 font-normal text-on-surface-variant">{text(`지금 ${nonEmpty(pBombWords).length}개`, `${nonEmpty(pBombWords).length}`)}</span>
                <textarea className={`${field} min-h-36 text-base`} value={pBombWords} onChange={(e) => setPBombWords(e.target.value)} spellCheck={false} />
              </label>
            )}
            {pBombSrc === 'list' && (
              <label className="block text-sm font-bold">{text('내 단어장 · 문장 모음', 'My word / sentence lists')}
                <select className={field} value={pList} onChange={(e) => setPList(e.target.value)}>
                  <option value="">{text('선택하세요', 'Choose')}</option>
                  {(info?.lists ?? []).map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
                </select>
              </label>
            )}
          </div>
        ) : isGrammar ? (
          <label className="block font-bold">{text('문법 항목', 'Grammar point')}
            <select className={field} value={pGrammar} onChange={(e) => setPGrammar(e.target.value)}>
              {pGrammar && !options.some(p => p.id === pGrammar) && <option value={pGrammar} disabled>{grammarPoint(pGrammar)?.name || pGrammar} · {text('이 게임에서 지원하지 않음', 'Unavailable in this game')}</option>}
              {options.map((p) => <option key={p.id} value={p.id}>{grammarLevelTag(p)} · {p.name}</option>)}
            </select>
          </label>
        ) : (
          <>
            <label className="block font-bold">{kinds.includes('sentence') && !kinds.includes('word') ? text('내 문장 모음', 'My sentence lists') : text('내 단어장 · 문장 모음', 'My word / sentence lists')}
              <select className={field} value={pList} onChange={(e) => { setPList(e.target.value); setPSaved(''); }}>
                <option value="">{text('선택하세요', 'Choose')}</option>
                {shownLists.map((list) => <option key={list.id} value={list.id} disabled={!usable(list)}>{list.name}{usable(list) ? '' : text(' (이 게임에는 쓸 수 없어요)', ' (not usable here)')}</option>)}
              </select>
            </label>
            {shownLists.length === 0 && <p className="text-sm text-on-surface-variant">{kinds.includes('sentence') && !kinds.includes('word') ? text('저장한 문장 모음이 없어요. 아래 "직접 입력하기"로 바로 넣을 수 있어요.', 'No sentence lists saved yet. Use "Type it in" below.') : text('만든 단어장이 없어요. 아래 "직접 입력하기"로 바로 넣을 수 있어요.', 'No lists yet. Use "Type it in" below.')}</p>}
            <details className="rounded-xl border border-outline-variant p-3" open={shownLists.length === 0}>
              <summary className="cursor-pointer font-bold">{text('직접 입력하기', 'Type it in')}</summary>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className={btn} onClick={() => { close(); workspace.open('guide'); }}>{text('직접 입력 화면 열기', 'Open the input screen')}</button>
              </div>
            </details>
          </>
        )}
      </>)}

      {open === 'class' && panel(<>
        <PanelHead title={text('반 설정', 'Class settings')} onApply={() => void applyClass()} busy={busy} onClose={close} text={text} />
        {info && info.classes.length > 0 && (
          <div className="space-y-2 rounded-xl bg-surface-container-low p-3">
            <label className="block text-sm font-bold">{text('반', 'Class')}
              <select className={field} value={pClass} onChange={(e) => { const next = e.target.value; setPClass(next); setAbsentOpen(false); setPAbsent(next ? loadAbsent(next) : []); }}>
                <option value="" disabled={!isTwoDice && pMode !== 'none'}>{text('반 없이 하기', 'No class')}</option>
                {info.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            {pClass && (
              <p className="text-sm" aria-live="polite">
                {pStudentsLoading
                  ? text('학생 명단을 불러오는 중…', 'Loading students…')
                  : pStudents.length > 0
                    ? <>{text(`학생 ${pStudents.length}명: `, `${pStudents.length} students: `)}<span className="font-semibold">{pStudents.slice(0, 8).map((r) => r.label).join(', ')}{pStudents.length > 8 ? ' …' : ''}</span></>
                    : text('이 반에는 학생이 없어요. 학생·출석 메뉴에서 먼저 추가해 주세요.', 'This class has no students yet.')}
              </p>
            )}
          </div>
        )}
        {pClass && pStudents.length > 0 && (
          <div className="space-y-2">
            <button type="button" className={btn} aria-expanded={absentOpen} onClick={() => setAbsentOpen((o) => !o)}>
              {text('결석 학생 제외', 'Exclude absent students')}{pAbsent.length > 0 ? text(` (${pAbsent.length}명)`, ` (${pAbsent.length})`) : ''}
            </button>
            {absentOpen && (
              <div className="rounded-xl border border-outline-variant p-3">
                <p className="mb-2 text-sm text-on-surface-variant">{text('오늘 빠지는 학생을 체크하세요. 차례와 팀에서 빠져요.', 'Check students who are absent today.')}</p>
                <div className="flex flex-wrap gap-2">
                  {pStudents.map((row) => {
                    const gone = pAbsent.includes(row.id);
                    return (
                      <label key={row.id} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 font-bold ${gone ? 'border-error bg-error-container/40 text-error line-through' : 'border-outline-variant bg-white'}`}>
                        <input type="checkbox" className="h-5 w-5" checked={gone} onChange={(e) => setPAbsent((old) => (e.target.checked ? [...old, row.id] : old.filter((id) => id !== row.id)))} />
                        {row.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        {isTwoDice ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold">{text('참여 방식', 'How to play')}</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4].map(count => (
                <button key={count} type="button" className={chip(pDiceTeams === count)} aria-pressed={pDiceTeams === count} onClick={() => setPDiceTeams(count)}>
                  {count === 1 ? text('혼자 연습', 'Solo practice') : text(`${count}팀 대결`, `${count} teams`)}
                </button>
              ))}
            </div>
            <p className="text-xs text-on-surface-variant">{text('반을 선택하지 않아도 참여 방식을 고를 수 있어요. 참여 방식을 바꾸면 새 판을 시작해요.', 'You can choose how to play without a class. Changing this starts a new board.')}</p>
          </fieldset>
        ) : <div className="space-y-2">
          <p className="text-sm font-bold">{text('참여 방식', 'How to play')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={chip(pMode === 'none')} aria-pressed={pMode === 'none'} onClick={() => setPMode('none')}>{text('없음', 'None')}</button>
            <button type="button" className={chip(pMode === 'solo')} aria-pressed={pMode === 'solo'} onClick={() => pickMode('solo')}>{text('개인', 'Solo')}</button>
            <button type="button" className={chip(pMode === 'team')} aria-pressed={pMode === 'team'} onClick={() => pickMode('team')}>{text('팀', 'Teams')}</button>
          </div>
          {pMode === 'team' && (
            <div className="flex items-center gap-3" role="group" aria-label={text('팀 수', 'Number of teams')}>
              <span className="text-sm font-bold">{text('팀 수', 'Teams')}</span>
              <button type="button" className={btn} aria-label={text('팀 하나 줄이기', 'Fewer teams')} disabled={pTeams <= 2} onClick={() => setPTeams((n) => Math.max(2, n - 1))}>−</button>
              <span className="min-w-12 text-center text-2xl font-extrabold tabular-nums text-deep-navy">{pTeams}{text('팀', '')}</span>
              <button type="button" className={btn} aria-label={text('팀 하나 늘리기', 'More teams')} disabled={pTeams >= teamCapOf()} onClick={() => setPTeams((n) => Math.min(teamCapOf(), n + 1))}>＋</button>
            </div>
          )}
          <p className="text-xs text-on-surface-variant">{text('개인·팀을 고르면 도구줄 아래에 지금 차례가 보여요. 팀은 "적용"을 누르면 학생이 무작위로 나뉘어요. 직접 바꾸려면 아래 팀·순서 정하기를 쓰세요.', 'Press Apply to split students into random teams. Use Set teams and order to adjust by hand.')}</p>
        </div>}
        {!isTwoDice && pMode !== 'none' && !isBomb && (
          <label className="flex min-h-11 items-center gap-2 font-bold">
            <input type="checkbox" className="h-5 w-5" checked={pAutoTurn} onChange={(e) => setPAutoTurn(e.target.checked)} />
            {text('한 판이 끝나면 자동으로 다음 차례로 넘기기', 'Move to the next turn automatically')}
          </label>
        )}
        {!isTwoDice && pEff.length > 0 && pMode !== 'none' && (
          <button type="button" className={btn} onClick={() => setOrderOpen(true)}>{text('팀·순서 정하기 (반 명단)', 'Set teams and order')}</button>
        )}
      </>)}

      {open === 'settings' && panel(<>
        <PanelHead title={text('게임설정', 'Game settings')} onApply={() => void applySettings()} busy={busy} onClose={close} text={text} />
        {pictureKind && <fieldset className="space-y-3 rounded-xl bg-surface-container-low p-3">
          <legend className="px-1 font-bold">{text('문제 방식', 'Question type')}</legend>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(!pPictureMode)} aria-pressed={!pPictureMode} onClick={() => setPPictureMode(false)}>{text('기존 게임 방식', 'Original game')}</button>
            <button type="button" className={chip(pPictureMode)} aria-pressed={pPictureMode} onClick={() => setPPictureMode(true)}>{text(PICTURE_WORD_OPTION.ko, PICTURE_WORD_OPTION.en)}</button>
          </div>
          {pPictureMode && <>
            <label className="block text-sm font-bold">{text('그림 문제에 쓸 단어장', 'Word list for picture questions')}
              <select className={field} value={pPictureList} onChange={event => setPPictureList(event.target.value)}>
                <option value="">{pictureLists.find(list => list.id === info?.selected?.config.pictureWordListId)?.name ?? text('지금 게임 자료 사용', 'Use current game material')}</option>
                {pictureLists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
              </select>
            </label>
            <p className="text-sm text-on-surface-variant">{pictureCount ? text(`그림 문제 ${pictureCount}개`, `${pictureCount} picture questions`) : t('gameWordHoops.pictureNeedsList')}</p>
            {pictureKind === 'turn' && <p className="text-sm text-on-surface-variant">{text('게임을 진행하는 중에 그림 문제가 나와요. 영어 단어를 고르면 이어서 진행돼요.', 'Picture questions appear during the game. Pick the English word to continue the move.')}</p>}
          </>}
          {!pPictureMode && !currentPictureMode && <button type="button" className={btn} onClick={() => { close(); workspace.open('settings'); }}>{text('자세히 설정', 'More settings')}</button>}
        </fieldset>}
        {!(pictureKind && (pPictureMode || currentPictureMode)) && <>
        {isPopcorn && (
          <div className="space-y-3 rounded-xl bg-surface-container-low p-3">
            <p className="font-bold">{text('팝콘 설정', 'Popcorn settings')}</p>
            <div className="space-y-1">
              <p className="text-sm font-bold">{text('라운드당 카드 수', 'Cards per round')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <input className={`${field} !mt-0 !w-28`} type="number" min={1} max={MAX_ROUND_CARDS} placeholder={text('전체', 'All')} value={pRound} onChange={(e) => setPRound(e.target.value)} aria-label={text('라운드당 카드 수', 'Cards per round')} />
                <span className="text-sm text-on-surface-variant">{text('POP을 포함한 총 카드 수예요. 비우면 낱말 전부와 POP 카드로 한 라운드를 진행해요.', 'Total cards including POP. Leave blank to use all words plus POP cards in each round.')}</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold">{text('POP 카드 수', 'Pop cards')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <input className={`${field} !mt-0 !w-28`} type="number" min={0} max={MAX_POP_CARDS} value={pPop} onChange={(e) => setPPop(e.target.value)} aria-label={text('POP 카드 수', 'Pop cards')} />
                <span className="text-sm text-on-surface-variant">{text('라운드 카드 중 뽑으면 점수가 0이 되는 POP 카드', 'Cards that reset the score')}</span>
              </div>
            </div>
          </div>
        )}
        {simpleOpts.length > 0 && (
          <div className="space-y-3 rounded-xl bg-surface-container-low p-3">
            {simpleOpts.filter(o => o.key !== 'twoDiceRounds' || diceTeams >= 3).map((o) => (
              <div key={o.key} className="space-y-1">
                <p className="text-sm font-bold">{text(o.ko, o.en)}</p>
                {o.kind === 'choice' ? (
                  <div className="flex flex-wrap gap-2">
                    {o.choices?.map((c) => <button key={c.v} type="button" className={chip(pOpt[o.key] === c.v)} aria-pressed={pOpt[o.key] === c.v} onClick={() => setPOpt((old) => ({ ...old, [o.key]: c.v }))}>{text(c.ko, c.en)}</button>)}
                  </div>
                ) : (
                  <input className={`${field} !mt-0 !w-28`} type="number" min={o.min} max={o.max} value={pOpt[o.key] ?? ''} onChange={(e) => setPOpt((old) => ({ ...old, [o.key]: e.target.value }))} aria-label={text(o.ko, o.en)} />
                )}
              </div>
            ))}
            {isTwoDice && <p className="text-sm text-on-surface-variant">{diceTeams >= 3
              ? text('한 줄을 먼저 채우면 승리해요. 횟수를 다 쓰거나 판이 가득 차면 가장 많은 칸을 차지한 팀이 이겨요. 같은 점수는 공동 1위예요.', 'Complete a line to win. If rolls run out or the board fills, most cells wins. Equal scores share first place.')
              : text('가로·세로·대각선 중 한 줄을 채우면 빙고예요.', 'Complete a row, column, or diagonal to get bingo.')}</p>}
            {(pOpt.hoopsMode === 'picture' || pOpt.tugMode === 'picture') && <p className="text-sm text-on-surface-variant">{t(pictureWordQuestions(info?.selected?.config).length ? 'gameWordHoops.pictureHint' : 'gameWordHoops.pictureNeedsList')}</p>}
          </div>
        )}
        {isPassBall && (
          <div className="space-y-3 rounded-xl bg-surface-container-low p-3">
            <div className="space-y-1">
              <p className="text-sm font-bold">{text('음악이 멈추는 시간 범위(초)', 'Music stops between (sec)')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <input className={`${field} !mt-0 !w-24`} type="number" min={1} value={pBallMin} onChange={(e) => setPBallMin(e.target.value)} aria-label={text('최소(초)', 'Min (sec)')} />
                <span>~</span>
                <input className={`${field} !mt-0 !w-24`} type="number" min={1} value={pBallMax} onChange={(e) => setPBallMax(e.target.value)} aria-label={text('최대(초)', 'Max (sec)')} />
                <span className="text-sm text-on-surface-variant">{text('이 사이 무작위 시각에 멈춰요', 'at a random moment')}</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold">{text('라운드당 단어/문장 수', 'Words per round')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <input className={`${field} !mt-0 !w-24`} type="number" min={1} max={100} value={pBallWords} onChange={(e) => setPBallWords(e.target.value)} aria-label={text('라운드당 단어/문장 수', 'Words per round')} />
              </div>
            </div>
            {academy && (
              <div className="divide-y divide-surface-container">
                <GameMusicPicker academyId={academy.id} isStaff value={passBallMusic(pTimerMusic)} presets={[{ music: PASS_BALL_MUSIC, label: text('기본 음악', 'Default music') }]} onChange={setPTimerMusic} />
                <GameMusicPicker academyId={academy.id} isStaff label={text('결과 소리', 'Result sound')} value={pTimerResult} onChange={setPTimerResult} />
              </div>
            )}
          </div>
        )}
        {isTimerMatch && (
          <div className="space-y-3 rounded-xl bg-surface-container-low p-3">
            <p className="font-bold">{text('타이머 설정', 'Timer settings')}</p>
            <div className="space-y-1">
              <p className="text-sm font-bold">{text('시간 숫자', 'Clock digits')}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={chip(!pTimerShow)} aria-pressed={!pTimerShow} onClick={() => setPTimerShow(false)}>{text('숨기기 (감으로 맞히기)', 'Hidden')}</button>
                <button type="button" className={chip(pTimerShow)} aria-pressed={pTimerShow} onClick={() => setPTimerShow(true)}>{text('보이기', 'Shown')}</button>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold">{text('목표 시간(초)', 'Target (sec)')}</p>
              <div className="flex flex-wrap items-center gap-2">
                {[5, 10, 15, 30].map((sec) => (
                  <button key={sec} type="button" className={chip(Number(pTimerSec) === sec)} aria-pressed={Number(pTimerSec) === sec} onClick={() => setPTimerSec(String(sec))}>{sec}{text('초', 's')}</button>
                ))}
                <input className={`${field} !mt-0 !w-28`} inputMode="decimal" value={pTimerSec} onChange={(e) => setPTimerSec(e.target.value)} aria-label={text('목표 시간(초)', 'Target (sec)')} />
              </div>
            </div>
            {academy && (
              <div className="divide-y divide-surface-container">
                <GameMusicPicker academyId={academy.id} isStaff value={pTimerMusic} onChange={setPTimerMusic} />
                <GameMusicPicker academyId={academy.id} isStaff label={text('결과 소리', 'Result sound')} value={pTimerResult} onChange={setPTimerResult} />
              </div>
            )}
            <p className="text-sm text-on-surface-variant">{text(`참가자 ${nonEmpty(pPartText).length}명 · 참가자는 반 설정에서 정해요.`, `${nonEmpty(pPartText).length} players. Set players in Class.`)}</p>
            <details className="rounded-xl border border-outline-variant bg-white p-3">
              <summary className="cursor-pointer font-bold">{text('참가자 직접 입력 (반 없이 할 때)', 'Type players (no class)')}</summary>
              <textarea className={`${field} mt-2 min-h-32 text-base`} value={pPartText} onChange={(e) => setPPartText(e.target.value)} spellCheck={false} aria-label={text('참가자 (한 줄에 하나)', 'Players (one per line)')} />
            </details>
          </div>
        )}
        {isBomb && (
          <div className="space-y-3 rounded-xl bg-surface-container-low p-3">
            <p className="font-bold">{text('폭탄 설정', 'Bomb settings')}</p>
            <div className="space-y-2">
              <p className="text-sm font-bold">{text('진행 방식', 'Mode')}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={chip(pBombMode === 'pass')} aria-pressed={pBombMode === 'pass'} onClick={() => setPBombMode('pass')}>{text('참가자 순서대로', 'Pass in order')}</button>
                <button type="button" className={chip(pBombMode === 'timer')} aria-pressed={pBombMode === 'timer'} onClick={() => setPBombMode('timer')}>{text('타이머만', 'Timer only')}</button>
              </div>
              <p className="text-xs text-on-surface-variant">{pBombMode === 'pass'
                ? text('"다음 사람에게 넘기기"를 누를 때마다 폭탄을 든 사람이 바뀌고, 터질 때 들고 있던 사람이 걸려요.', 'The holder changes each time you pass; whoever holds it when it explodes is out.')
                : text('참가자 없이 숨겨진 타이머와 폭발만 나와요. 실제 인형이나 공을 돌릴 때 쓰세요.', 'Only the hidden timer and the explosion. Use it with a real ball or toy.')}</p>
              {pBombMode === 'timer' && (
                <div className="space-y-1">
                  <p className="text-sm font-bold">{text('단어 보여주기', 'Words')}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={chip(pBombTW === 'none')} aria-pressed={pBombTW === 'none'} onClick={() => setPBombTW('none')}>{text('단어 없이 타이머만', 'Timer only')}</button>
                    <button type="button" className={chip(pBombTW === 'during')} aria-pressed={pBombTW === 'during'} onClick={() => setPBombTW('during')}>{text('단어 하나씩 돌아가며', 'One word at a time')}</button>
                    <button type="button" className={chip(pBombTW === 'after')} aria-pressed={pBombTW === 'after'} onClick={() => setPBombTW('after')}>{text('터진 뒤 단어 보드', 'Words after boom')}</button>
                  </div>
                </div>
              )}
              {pBombMode === 'pass' && (
                <label className="flex min-h-11 items-center gap-2 font-bold">
                  <input type="checkbox" className="h-5 w-5" checked={pBombCaught} onChange={(e) => setPBombCaught(e.target.checked)} />
                  {text('폭탄이 터지면 걸린 친구부터 다음 판 시작', 'Next round starts with the caught student')}
                </label>
              )}
            </div>
            <p className="text-sm text-on-surface-variant">{text(`참가자 ${nonEmpty(pPartText).length}명 · 참가자는 반 설정에서, 읽을 내용은 내 단어/문장에서 정해요.`, `${nonEmpty(pPartText).length} players. Set players in Class and words in My words.`)}</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm font-bold">{text('가장 빨리 터지는 시간(초)', 'Shortest (sec)')}<input className={field} inputMode="numeric" value={pBombMin} onChange={(e) => setPBombMin(e.target.value)} /></label>
              <label className="block text-sm font-bold">{text('가장 늦게 터지는 시간(초)', 'Longest (sec)')}<input className={field} inputMode="numeric" value={pBombMax} onChange={(e) => setPBombMax(e.target.value)} /></label>
            </div>
            <p className="text-xs text-on-surface-variant">{text('폭탄은 이 범위 안에서 매번 무작위 시간에 터져요.', 'The bomb goes off at a random time in this range.')}</p>
            <div>
              <p className="mb-1 text-sm font-bold">{text('폭탄 소리', 'Bomb sound')}</p>
              <BombSoundPicker value={pBombSound} onChange={setPBombSound} />
            </div>
            <details className="rounded-xl border border-outline-variant bg-white p-3">
              <summary className="cursor-pointer font-bold">{text('참가자 직접 입력 (반 없이 할 때)', 'Type players (no class)')}</summary>
              <textarea className={`${field} mt-2 min-h-32 text-base`} value={pPartText} onChange={(e) => setPPartText(e.target.value)} spellCheck={false} aria-label={text('참가자 (한 줄에 하나)', 'Players (one per line)')} />
            </details>
          </div>
        )}
        {isLadder && (
          <div className="space-y-3 rounded-xl bg-surface-container-low p-3">
            <p className="font-bold">{text('결과 설정', 'Results')}</p>
            <p className="text-sm text-on-surface-variant">{text(`참가자 ${nonEmpty(pPartText).length}명 · 결과도 같은 수만큼 만들어져요. 모자라면 "꽝"으로 채워요. 참가자는 반 설정에서 정해요.`, `${nonEmpty(pPartText).length} players. Missing results become "miss".`)}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(pResMode === 'type')} aria-pressed={pResMode === 'type'} onClick={() => setPResMode('type')}>{text('직접 입력', 'Type')}</button>
              <button type="button" className={chip(pResMode === 'rank')} aria-pressed={pResMode === 'rank'} onClick={() => setPResMode('rank')}>{text('등수 (1등, 2등…)', 'Ranks')}</button>
              <button type="button" className={chip(pResMode === 'one')} aria-pressed={pResMode === 'one'} onClick={() => setPResMode('one')}>{text('당첨/꽝 자동', 'Prizes & misses')}</button>
            </div>
            {pResMode === 'type' && (
              <label className="block text-sm font-bold">{text('결과 (한 줄에 하나)', 'Results (one per line)')}
                <span className="ml-2 font-normal text-on-surface-variant">{text(`지금 ${nonEmpty(pResText).length}개`, `${nonEmpty(pResText).length}`)}</span>
                <textarea className={`${field} min-h-40 text-base`} value={pResText} onChange={(e) => setPResText(e.target.value)} spellCheck={false} />
              </label>
            )}
            {pResMode === 'one' && (() => {
              const total = Math.max(2, nonEmpty(pPartText).length || (info?.selected?.items.length ?? 2));
              const win = Math.min(pWin, total - 1);
              return (
                <div className="space-y-3">
                  <label className="block text-sm font-bold">{text('당첨 이름', 'Prize name')}
                    <input className={field} value={pWinner} onChange={(e) => setPWinner(e.target.value)} placeholder={text('당첨!', 'Win!')} />
                  </label>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2" role="group" aria-label={text('당첨·꽝 개수', 'Prize and miss counts')}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{text('당첨', 'Prizes')}</span>
                      <button type="button" className={btn} aria-label={text('당첨 하나 줄이기', 'Fewer prizes')} disabled={win <= 1} onClick={() => setPWin(Math.max(1, win - 1))}>−</button>
                      <span className="min-w-8 text-center text-2xl font-extrabold tabular-nums text-deep-navy">{win}</span>
                      <button type="button" className={btn} aria-label={text('당첨 하나 늘리기', 'More prizes')} disabled={win >= total - 1} onClick={() => setPWin(Math.min(total - 1, win + 1))}>＋</button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{text('꽝', 'Misses')}</span>
                      <button type="button" className={btn} aria-label={text('꽝 하나 줄이기', 'Fewer misses')} disabled={total - win <= 1} onClick={() => setPWin(Math.min(total - 1, win + 1))}>−</button>
                      <span className="min-w-8 text-center text-2xl font-extrabold tabular-nums text-deep-navy">{total - win}</span>
                      <button type="button" className={btn} aria-label={text('꽝 하나 늘리기', 'More misses')} disabled={win <= 1} onClick={() => setPWin(Math.max(1, win - 1))}>＋</button>
                    </div>
                  </div>
                  <p className="text-xs text-on-surface-variant">{text(`당첨 + 꽝 = 참가자 ${total}명`, `Prizes + misses = ${total} players`)}</p>
                </div>
              );
            })()}
            {pResMode !== 'type' && <p className="text-xs text-on-surface-variant">{text('결과 자리는 매번 무작위로 섞여요.', 'Result positions are shuffled each time.')}</p>}
            <details className="rounded-xl border border-outline-variant bg-white p-3">
              <summary className="cursor-pointer font-bold">{text('참가자 직접 입력 (반 없이 할 때)', 'Type players (no class)')}</summary>
              <textarea className={`${field} mt-2 min-h-32 text-base`} value={pPartText} onChange={(e) => setPPartText(e.target.value)} spellCheck={false} aria-label={text('참가자 (한 줄에 하나)', 'Players (one per line)')} />
            </details>
          </div>
        )}
        {itemSettings && (
          <div className="space-y-3 rounded-xl bg-surface-container-low p-3">
            <p className="font-bold">{text('항목 설정', 'Items')}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(pItemSource === 'list')} aria-pressed={pItemSource === 'list'} onClick={() => setPItemSource('list')}>{text('내 단어장/문장', 'My lists')}</button>
              <button type="button" className={chip(pItemSource === 'class')} aria-pressed={pItemSource === 'class'} onClick={() => setPItemSource('class')}>{hasNumbers ? text('이름(반 학생)', 'Names') : text('참여자', 'Players')}</button>
              {hasNumbers && <button type="button" className={chip(pItemSource === 'number')} aria-pressed={pItemSource === 'number'} onClick={() => setPItemSource('number')}>{text('숫자', 'Numbers')}</button>}
              <button type="button" className={chip(pItemSource === 'type')} aria-pressed={pItemSource === 'type'} onClick={() => setPItemSource('type')}>{text('직접 입력·편집', 'Type / edit')}</button>
            </div>
            {pItemSource === 'list' && (
              <label className="block text-sm font-bold">{text('내 단어장 · 문장 모음', 'My word / sentence lists')}
                <select className={field} value={pList} onChange={(e) => setPList(e.target.value)}>
                  <option value="">{text('지금 항목 그대로', 'Keep current items')}</option>
                  {shownLists.map((list) => <option key={list.id} value={list.id} disabled={!usable(list)}>{list.name}{usable(list) ? '' : text(' (이 게임에는 쓸 수 없어요)', ' (not usable)')}</option>)}
                </select>
              </label>
            )}
            {pItemSource === 'class' && (
              <label className="block text-sm font-bold">{text('반 (학생 이름이 항목이 돼요)', 'Class (students become the items)')}
                <select className={field} value={pItemClass} onChange={(e) => setPItemClass(e.target.value)}>
                  <option value="">{text('반을 선택하세요', 'Choose a class')}</option>
                  {(info?.classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
            {pItemSource === 'number' && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <label className="block text-sm font-bold">{text('시작 숫자', 'Start')}<input className={field} inputMode="numeric" value={pFrom} onChange={(e) => setPFrom(e.target.value)} /></label>
                  <label className="block text-sm font-bold">{text('끝 숫자', 'End')}<input className={field} inputMode="numeric" value={pTo} onChange={(e) => setPTo(e.target.value)} /></label>
                  <label className="block text-sm font-bold">{text('간격', 'Step')}<input className={field} inputMode="numeric" value={pStep} onChange={(e) => setPStep(e.target.value)} /></label>
                </div>
                <p className="text-xs text-on-surface-variant">{text('예: 1 ~ 30, 간격 1이면 1, 2, 3 … 30', 'Example: 1 to 30, step 1')}</p>
              </div>
            )}
            {pItemSource === 'type' && (
              <>
              <label className="block text-sm font-bold">
                {text('한 줄에 항목 하나', 'One item per line')}
                <span className="ml-2 font-normal text-on-surface-variant">{text(`지금 ${pText.split(/\r?\n/).filter((row) => row.trim()).length}개`, `${pText.split(/\r?\n/).filter((row) => row.trim()).length} items`)}</span>
                <textarea className={`${field} min-h-48 font-mono text-base`} value={pText} onChange={(e) => setPText(e.target.value)} placeholder={'apple\nbanana\ncat'} spellCheck={false} />
              </label>
              <p className="text-xs text-on-surface-variant">{text('지금 항목이 채워져 있어요. 고치거나 지우거나 붙여 넣은 뒤 "적용"을 누르세요.', 'Your current items are filled in. Edit them and press Apply.')}</p>
              </>
            )}
            {type === 'order' && academy && (
              <div className="divide-y divide-surface-container">
                <GameMusicPicker academyId={academy.id} isStaff value={pTimerMusic} onChange={setPTimerMusic} />
                <GameMusicPicker academyId={academy.id} isStaff label={text('결과 소리', 'Result sound')} value={pTimerResult} onChange={setPTimerResult} />
              </div>
            )}
            {isWheel && (
              <label className="flex min-h-11 items-center gap-2 font-bold">
                <input type="checkbox" className="h-5 w-5" checked={pEliminate} onChange={(e) => setPEliminate(e.target.checked)} />
                {text('순서 정하기 (한 번 뽑은 항목은 빼고 돌려요)', 'Set an order (picked items are removed)')}
              </label>
            )}
          </div>
        )}
        </>}
        <label className="flex min-h-11 items-center gap-2 font-bold">
          <input type="checkbox" className="h-5 w-5" checked={pSound} onChange={(e) => setPSound(e.target.checked)} />
          {text('효과음 켜기', 'Sound effects')}
        </label>
      </>)}

      {open === 'saves' && panel(<>
        <PanelHead title={text('저장/불러오기', 'Save / Load')} busy={busy} onClose={close} text={text} />
        <div className="space-y-2">
          <p className="font-bold">{text('저장하기', 'Save')}</p>
          <p className="text-xs text-on-surface-variant">{isGrammar ? text('지금 문법과 참여 방식이 함께 저장돼요.', 'The grammar point and play mode are saved together.') : text('지금 자료와 설정이 "내 게임"으로 저장돼요.', 'Your current content and settings are saved as "My games".')}</p>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={status || text('게임 이름', 'Game name')} aria-label={text('저장할 이름', 'Name')} />
          <button className={primaryBtn} disabled={busy || !info?.selected} onClick={() => void save()}>{text('저장하기', 'Save')}</button>
          {savedMsg && <p role="status" className="text-sm font-bold text-green-700">{savedMsg}</p>}
        </div>
        <div className="space-y-2 border-t border-outline-variant pt-3">
          <p className="font-bold">{text('불러오기', 'Load')}</p>
          {saved.length === 0
            ? <p className="text-sm text-on-surface-variant">{text('아직 저장한 게임이 없어요.', 'No saved games yet.')}</p>
            : <ul className="space-y-1">{saved.map((row) => (
              <li key={row.id}>
                {deleteId === row.id ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-error bg-error-container/40 p-2">
                    <span className="min-w-0 flex-1 font-bold">{text(`"${row.name}"을(를) 삭제할까요?`, `Delete "${row.name}"?`)}</span>
                    <button className={`${btn} bg-error! text-white!`} disabled={busy} onClick={() => void removeSaved(row.id)}>{text('삭제', 'Delete')}</button>
                    <button className={btn} onClick={() => setDeleteId(null)}>{text('취소', 'Cancel')}</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button className={`${btn} min-w-0 flex-1 truncate text-left`} onClick={() => { info?.selectTemplate(row.id); notify(text('설정이 적용되었습니다.', 'Your settings have been applied.')); setOpen(null); }}>{row.name}</button>
                    <button className={btn} aria-label={text(`${row.name} 삭제`, `Delete ${row.name}`)} onClick={() => setDeleteId(row.id)}>{text('삭제', 'Delete')}</button>
                  </div>
                )}
              </li>
            ))}</ul>}
        </div>
      </>)}
      {orderOpen && pEff.length > 0 && (
        <TeamOrderPanel key={`${turnScope}:${pMode}:${pTeams}:${pEff.map((row) => row.id).join(',')}`} scope={turnScope} roster={pEff} fixedMode={pMode === 'team' ? 'team' : 'individual'} fixedTeams={pMode === 'team' ? pTeams : undefined} onClose={() => setOrderOpen(false)} />
      )}
    </div>
  );
}

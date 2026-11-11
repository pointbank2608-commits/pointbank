import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { GAME_CATALOG } from '../lib/gameCatalog';


import { classroomGameRequirement } from '../lib/gameWorkspace';
import { gamePreparation } from '../lib/gamePreparation';
import type { GameContent } from '../lib/gameFromWords';
import { gameAvailability, PHONICS_GAMES, phonicsGameUnits } from '../lib/phonicsGames';
import { PhonicsGameCover } from './PhonicsGameArt';
import { MATERIALS_CATALOG } from '../lib/materialsCatalog';
import { extractYoutubeId } from '../lib/youtube';
import { workbookOfMaterial } from '../data/cvcWorkbook';
import type { BlockDef } from '../lib/blocks/types';
import type { FullCardItem, GameTemplateConfig, LessonSlide, MaterialSlide, PhonicsBankEntry } from '../lib/types';
import { newCanvasSlide, newTextElement, themeTextDefaults } from './CanvasSlideEditor';
import CanvasSlideView from './CanvasSlideView';
import LessonPrintPreview, { dedicatedPrintMaterials, wordPrintMaterials, workbookStep } from './LessonPrintPreview';
import PhonicsSlidePreview from './worksheets/PhonicsSlidePreview';
const NativeGamePreview = lazy(() => import('./LessonNativeGamePreview'));
const PhonicsGamePreview = lazy(() => import('../pages/PhonicsGamesPage').then(m => ({ default: m.PhonicsLessonGame })));
const phonicsUnits = phonicsGameUnits();

export type CanvasExample = 'title' | 'word' | 'blank';
export const LESSON_SAMPLE_WORDS: FullCardItem[] = [
  { id: 'sample-apple', word: 'apple', meaning: '사과', imageUrl: '/phonics-images/apple.webp' },
  { id: 'sample-ant', word: 'ant', meaning: '개미', imageUrl: '/phonics-images/ant.webp' },
  { id: 'sample-axe', word: 'axe', meaning: '도끼', imageUrl: '/phonics-images/axe.webp' },
];
export const LESSON_BINGO_SAMPLE_WORDS = [...LESSON_SAMPLE_WORDS, ...['bag', 'bat', 'bus', 'cap', 'cat', 'cup'].map(word => ({
  id: `sample-${word}`, word, meaning: '', imageUrl: null,
}))];

export function LessonWordThumbnail({card, study}: {card: FullCardItem; study: boolean}) {
  if (study) return <div className="grid h-full w-full place-items-center bg-sky-100 p-2 text-center">
    <strong lang="en" className="w-4/5 break-words rounded-xl border border-blue-200 bg-white p-2 text-lg text-deep-navy shadow-sm">{card.word}</strong>
  </div>;
  return <div className="activity-word-example">
    {card.imageUrl && <img src={card.imageUrl} alt="" loading="lazy" />}
    <div className="min-w-0"><b lang="en">{card.word}</b><small className="block break-words">{card.meaning}</small></div>
  </div>;
}

export function canvasExample(layout: CanvasExample, theme: string | null, title: string, card: FullCardItem) {
  const slide = newCanvasSlide(theme);
  if (layout === 'blank') slide.elements = [];
  else if (layout === 'title') slide.elements = [newTextElement({
    x: 8, y: 30, w: 84, h: 40, text: title, ...themeTextDefaults(theme, 'title'),
  })];
  else {
    slide.elements = [newTextElement({
      x: 10, y: card.imageUrl ? 73 : 36, w: 80, h: 20, text: card.word, ...themeTextDefaults(theme, 'title'),
    })];
    if (card.imageUrl) slide.elements.unshift({ id: crypto.randomUUID(), type: 'image', x: 25, y: 7, w: 50, h: 62, url: card.imageUrl, fit: 'contain' });
  }
  return slide;
}

export function activityMaterial(block: BlockDef, selected: LessonSlide | null): MaterialSlide {
  const materialId = block.slide?.materialId === 'library' ? 'worksheet' : block.slide?.materialId ?? 'worksheet';
  if (selected?.kind === 'material' && selected.materialId === materialId && !block.id.startsWith('worksheet.')) {
    return selected;
  }
  return {
    id: block.id, kind: 'material', materialId,
    ...(materialId === 'worksheet' ? { worksheetTab: block.id.startsWith('worksheet.') ? block.id.slice(10) : 'list', boardTheme: 'whiteboard' } : {}),
    ...(block.id === 'worksheet.tracing' ? { worksheetOptions: { tracingShow: { meaning: false, image: true } } } : {}),
    ...(materialId === 'phonics' ? { phonicsTab: 'phonicsBlank' } : {}),
  };
}

export function LessonActivityExample({ block, cards, sourceKind, prepared, selected, entries, layout, theme, title, large = false }: {
  block: BlockDef;
  cards: FullCardItem[];
  sourceKind: 'word' | 'sentence';
  prepared: GameContent | null;
  selected: LessonSlide | null;
  entries: PhonicsBankEntry[];
  layout?: CanvasExample;
  theme: string | null;
  title: string;
  large?: boolean;
}) {
  const { t } = useTranslation();
  const kind = block.slide?.kind;
  const game = GAME_CATALOG.find(g => g.type === block.slide?.gameType);
  const phonicsGame = PHONICS_GAMES.find(g => g.id === block.slide?.phonicsGameId);
  const words = cards.length ? cards : LESSON_SAMPLE_WORDS;
  const first = words[0];
  let actual = false;
  let next: string | undefined;
  let requirement: string | undefined;
  let picture: React.ReactNode;
  if (kind === 'material') {
    const material = activityMaterial(block, selected);
    const unit = workbookOfMaterial(material.materialId) || workbookStep(material.materialId);
    const worksheet = material.materialId === 'worksheet';
    const wordPrint = wordPrintMaterials.includes(material.materialId);
    const phonics = material.materialId === 'phonics';
    const wordCount = material.words?.length || cards.length;
    actual = unit ? !!(material.phonicsUnitIds?.length || material.cvcUnits?.length) :
      (worksheet || phonics || wordPrint) && wordCount >= (material.materialId === 'bingo' ? 8 : 1);
    next = (unit || phonics) && !actual ? 'needUnit' : (worksheet || wordPrint) && !actual ? 'needWords' : undefined;
    const bingoSample = material.materialId === 'bingo' && !actual;
    picture = unit || worksheet || wordPrint || dedicatedPrintMaterials.includes(material.materialId)
      ? <LessonPrintPreview slide={bingoSample ? { ...material, words: undefined } : material} cards={bingoSample ? LESSON_BINGO_SAMPLE_WORDS : words} entries={entries} large={large} />
      : phonics ? <PhonicsSlidePreview tab={material.phonicsTab ?? 'phonicsBlank'} words={material.words ?? words} options={material.phonicsOptions ?? {}} />
        : <img src={MATERIALS_CATALOG.find(m => m.id === material.materialId)?.cover ?? '/covers/material-phonics.jpg'} alt="" />;
  } else if (kind === 'video') {
    const video = selected?.kind === 'video' ? selected : null;
    const id = extractYoutubeId(video?.videoUrl ?? '');
    actual = !!id;
    next = id ? undefined : 'needVideo';
    picture = <><img src={id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : '/worksheets/samples/alphabet.webp'} alt="" />
      <span className="activity-media-title">{id ? video?.title || t('curriculum.slides.kindVideo') : t('lessonUx.sampleVideo')}</span></>;
  } else if (kind === 'image') {
    const url = selected?.kind === 'image' ? selected.imageUrl : '';
    actual = !!url;
    next = url ? undefined : 'needImage';
    picture = <img src={url || LESSON_SAMPLE_WORDS[0].imageUrl!} alt="" />;
  } else if (kind === 'pdf') {
    picture = <div className="activity-generic-example"><span className="material-symbols-outlined text-4xl" aria-hidden>picture_as_pdf</span><b>{t('lessonUx.pdfSelect')}</b></div>;
  } else if (phonicsGame) {
    const selectedUnit = selected?.kind === 'phonicsGame' && selected.gameId === phonicsGame.id ? selected.unitId : '';
    const unit = selectedUnit || (large ? phonicsUnits.find(candidate => !gameAvailability(phonicsGame, candidate))?.id : undefined);
    actual = !!selectedUnit;
    next = actual ? undefined : 'needPhonicsUnit';
    picture = large && unit ? <Suspense fallback={t('common.loading')}><PhonicsGamePreview gameId={phonicsGame.id} unitId={unit} /></Suspense>
      : <PhonicsGameCover game={phonicsGame} />;
  } else if (kind === 'web') {
    const web = selected?.kind === 'web' ? selected : null;
    actual = !!web?.url;
    next = actual ? undefined : 'needLink';
    picture = <div className="activity-generic-example">
      <span className="material-symbols-outlined" aria-hidden>web</span>
      <b>{web?.title || t('lessonUx.sampleWeb')}</b>
      <small className="break-all">{web?.url || 'https://example.org'}</small>
    </div>;
  } else if (layout) {
    actual = layout === 'word' && !!cards.length;
    picture = <CanvasSlideView slide={canvasExample(layout, theme, title, first)} className="pointer-events-none" />;
  } else if (kind === 'wordshow' || kind === 'study') {
    actual = cards.length > 0;
    next = actual ? undefined : 'needWords';
    picture = <LessonWordThumbnail card={first} study={kind === 'study'} />;
  } else if (game) {
    actual = !!prepared;
    const config: GameTemplateConfig | undefined = prepared?.config;
    const sentence = config?.adventure?.sentences[0];
    const question = config?.questions?.[0];
    const live = config?.liveQuestions?.[0];
    const imageQuestion = config?.imageQuizItems?.[0];
    const prompt = sentence?.text ?? question?.question ?? live?.prompt ?? config?.adventure?.cases[0]?.incorrect ??
      config?.adventure?.words[0]?.meaning ?? config?.pairs?.[0]?.left ?? config?.flashcards?.[0]?.left ??
      config?.storybook?.questions[0]?.prompt ?? config?.typeAnswerEntries?.[0]?.prompt ??
      config?.statements?.[0]?.text ?? config?.groups?.[0]?.name ?? imageQuestion?.answer ?? prepared?.items[0]?.label;
    const choices = sentence?.tokens ?? question?.choices ?? live?.choices ?? (game.type === 'tictactoe'
      ? prepared?.items.slice(0, 3).map(item => item.label) : config?.adventure?.words.slice(0, 3).map(word => word.word));
    const sentenceScene = sentence && (game.type === 'wordtrain' || game.type === 'sentencerocket');
    picture = large ? <Suspense fallback={t('common.loading')}>
      <NativeGamePreview path={game.path} title={t(game.nameKey)} content={prepared} />
    </Suspense> : <div className="activity-game-cover" data-game-scene={game.type}>
      {sentenceScene ? <>
        <img src={game.type === 'wordtrain' ? '/skins/adventure/train.webp' : '/skins/adventure/rocket.webp'} alt="" loading="lazy" />
        <div className={`activity-sentence-scene activity-sentence-${game.type}`}>
          <img src={game.type === 'wordtrain' ? '/skins/adventure/engine.webp' : '/skins/adventure/rocket-sprite.webp'} alt="" />
          <div>{sentence.tokens.map((token, i) => <span key={i}>{token}</span>)}</div>
        </div>
      </> : game.cover ? <img src={game.cover} alt="" loading="lazy" /> : <span className="material-symbols-outlined" aria-hidden>{game.icon}</span>}
      {prompt && !sentenceScene && <div className="activity-game-prompt">
        <b>{prompt}</b>
        {choices?.length ? <div className="activity-game-choices">{choices.slice(0, 5).map((choice, index) => <span key={index}>{choice}</span>)}</div> : null}
      </div>}
    </div>;
    if (!actual) {
      const kinds = gamePreparation(game.type).kinds as readonly string[];
      const needed = kinds.includes('sentence') && !kinds.includes('word')
        ? { key: !cards.length || sourceKind !== 'sentence' ? 'lessonUx.needSentenceList' : 'quick.needSentence', count: 0 }
        : classroomGameRequirement(game.type, sourceKind);
      requirement = t(needed.key, { count: needed.count });
    }
  } else {
    next = kind === 'reading' || kind === 'shadow' ? 'needScript' :
      kind === 'qna' || kind === 'drill' || kind === 'grammar' ? 'needDetails' : undefined;
    picture = <div className="activity-generic-example"><span className="material-symbols-outlined" aria-hidden>{block.icon}</span>
      <b>{block.nameKey ? t(block.nameKey) : block.name?.[t('lessonUx.language') === 'ko' ? 'ko' : 'en']}</b>
    </div>;
  }
  return <>
    <div className={`activity-example ${large ? 'activity-example-large' : ''} ${kind === 'material' ? 'activity-example-print' : ''}`}>{picture}</div>
    {kind !== 'pdf' && <div className="activity-example-tags">
      <span className={actual ? 'is-linked' : ''}>{t(actual ? 'lessonUx.linked' : 'lessonUx.sample')}</span>
      {next && <span className="is-needed">{t(`lessonUx.${next}`)}</span>}
      {requirement && <span className="is-needed">{requirement}</span>}
    </div>}
  </>;
}

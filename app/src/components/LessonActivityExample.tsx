import { useTranslation } from 'react-i18next';
import { GAME_CATALOG } from '../lib/gameCatalog';
import { ADVENTURE_TYPES, sampleAdventure, type AdventureType } from '../lib/adventureGames';
import { sampleActivityCards } from '../lib/quickActivity';
import { storySample } from '../lib/storybook';
import { dedicatedGameSample } from '../lib/lessonGameSample';
import type { GameContent } from '../lib/gameFromWords';
import { classroomGameRequirement, prepareClassroomGame } from '../lib/gameWorkspace';
import { MATERIALS_CATALOG } from '../lib/materialsCatalog';
import { extractYoutubeId } from '../lib/youtube';
import { workbookOfMaterial } from '../data/cvcWorkbook';
import type { BlockDef } from '../lib/blocks/types';
import type { FullCardItem, LessonSlide, MaterialSlide, PhonicsBankEntry } from '../lib/types';
import { newCanvasSlide, newTextElement, themeTextDefaults } from './CanvasSlideEditor';
import CanvasSlideView from './CanvasSlideView';
import LessonPrintPreview, { dedicatedPrintMaterials, wordPrintMaterials, workbookStep } from './LessonPrintPreview';
import PhonicsSlidePreview from './worksheets/PhonicsSlidePreview';
import { SAMPLE_DIAGRAM_IMAGE, SAMPLE_DIAGRAM_PINS } from './LabeledDiagram';

export type CanvasExample = 'title' | 'word' | 'blank';
export const LESSON_SAMPLE_WORDS: FullCardItem[] = [
  { id: 'sample-apple', word: 'apple', meaning: '사과', imageUrl: '/phonics-images/apple.webp' },
  { id: 'sample-ant', word: 'ant', meaning: '개미', imageUrl: '/phonics-images/ant.webp' },
  { id: 'sample-axe', word: 'axe', meaning: '도끼', imageUrl: '/phonics-images/axe.webp' },
];
export const LESSON_BINGO_SAMPLE_WORDS = [...LESSON_SAMPLE_WORDS, ...['bag', 'bat', 'bus', 'cap', 'cat', 'cup'].map(word => ({
  id: `sample-${word}`, word, meaning: '', imageUrl: null,
}))];

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

export function LessonActivityExample({ block, cards, sourceKind, selected, entries, layout, theme, title, large = false }: {
  block: BlockDef;
  cards: FullCardItem[];
  sourceKind: 'word' | 'sentence';
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
    picture = <div className="activity-word-example">
      {first.imageUrl && <img src={first.imageUrl} alt="" />}
      <div><b>{first.word}</b><small>{first.meaning}</small></div>
    </div>;
  } else if (game) {
    const prepared = prepareClassroomGame(game.type, cards, sourceKind);
    const type = game.type;
    const source: GameContent | null = prepared ?? prepareClassroomGame(type, LESSON_BINGO_SAMPLE_WORDS, 'word') ??
      prepareClassroomGame(type, sampleActivityCards('sentence'), 'sentence');
    const question = source?.config?.questions?.[0];
    const adventure = source?.config?.adventure ?? ((ADVENTURE_TYPES as readonly string[]).includes(type) ? sampleAdventure(type as AdventureType) : undefined);
    const detective = type === 'grammardetective' ? adventure?.cases[0] : undefined;
    const sentence = type === 'wordtrain' || type === 'sentencerocket' ? adventure?.sentences[0] : undefined;
    const clue = type === 'treasurehunt' ? adventure?.clues[0] : undefined;
    const mission = type === 'wordclaw' ? adventure?.missions[0] : undefined;
    const pair = source?.config?.pairs?.[0] ?? source?.config?.flashcards?.[0];
    const story = source?.config?.storybook?.questions[0] ?? (type === 'sentencebridge' ? storySample(type).questions[0] : undefined);
    const tower = type === 'sentencetower' ? storySample(type) : undefined;
    const statement = source?.config?.statements?.[0];
    if (type === 'labeleddiagram') {
      picture = <div className="relative h-full w-full overflow-hidden">
        <img src={SAMPLE_DIAGRAM_IMAGE} alt="" />
        {SAMPLE_DIAGRAM_PINS.map((pin, index) => <span key={pin.id} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary px-1.5 text-xs font-bold text-white" style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}>{index + 1}</span>)}
      </div>;
    } else if (question || pair || story || statement || adventure || tower || source?.items.length) {
      actual = !!prepared && source === prepared;
      const choices = question?.choices ?? (pair ? [pair.right] : story ? [story.answer, ...story.wrong] :
        detective?.errors[0]?.choices ?? sentence?.tokens ?? tower?.steps.map(step => step.phrase) ??
        (clue ? adventure?.places.slice(0, 3).map(place => place.name) : adventure?.words.slice(0, 3).map(word => word.word))) ??
        source?.items.slice(1, 4).map(item => item.label) ?? [];
      picture = <div className={`activity-game-example activity-game-${game.type}`}>
        <b>{question?.question ?? pair?.left ?? story?.prompt ?? statement?.text ?? detective?.incorrect ??
          sentence?.text ?? clue?.text ?? mission?.text ?? tower?.start ?? adventure?.words[0]?.meaning ?? source?.items[0]?.label}</b>
        <div className="activity-game-choices">
          {choices.map((choice, i) => <span key={i}>{choice}</span>)}
        </div>
      </div>;
    } else {
      const sample = dedicatedGameSample(type);
      picture = sample ? <div className={`activity-game-example activity-game-${type}`}>
        <b>{sample.prompt}</b>
        <div className="activity-game-choices">{sample.choices?.map((choice, index) => <span key={index}>{choice}</span>)}</div>
      </div> : game.cover ? <img src={game.cover} alt="" /> : <span className="material-symbols-outlined">{game.icon}</span>;
    }
    if (!actual) {
      if (!cards.length) next = 'needWords';
      else if (!prepared) {
        const needed = classroomGameRequirement(game.type, sourceKind);
        requirement = t(needed.key, { count: needed.count });
      } else next = 'needGame';
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
    <div className="activity-example-tags">
      <span className={actual ? 'is-linked' : ''}>{t(actual ? 'lessonUx.linked' : 'lessonUx.sample')}</span>
      {next && <span className="is-needed">{t(`lessonUx.${next}`)}</span>}
      {requirement && <span className="is-needed">{requirement}</span>}
    </div>
  </>;
}

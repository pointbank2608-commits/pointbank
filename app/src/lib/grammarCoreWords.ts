import { CORE_COMPARISONS, CORE_GERUNDS, CORE_INFINITIVES, CORE_MASS_NOUNS, CORE_PASSIVES, CORE_PLURALS, CORE_PRONOUNS, CORE_SPELLING, CORE_VERBS } from '../data/grammarCoreWords';
import type { HwItemDraft, HwQuestion } from './homework/types';
import { ingForm, pluralize, thirdPersonS } from './grammar';
import { effectiveSlides } from './lessonSlides';
import { newHelper } from './slideHelpers';
import type { CurriculumLesson, LessonSlide } from './types';

export const GRAMMAR_WORD_SHEET = 'grammar-core-words';
const VERSION = 'grammar-core-words-v1';

const comparisonIds = {
  comparative: 'comparative', superlative: 'superlative',
  'm-comparison': 'both', 'm-superlative-one-of': 'superlative',
  'm-comparative-emphasis': 'comparative',
} as const;
const pastIds = new Set(['past-irregular', 'm-past', 'tense-past', 'm-subjunctive', 'h-wish-as-if']);
const perfectPrefixes: Record<string, string> = {
  'm-present-perfect': 'have', 'tense-present-perfect': 'have',
  'm-past-perfect': 'had', 'tense-past-perfect': 'had',
  'tense-future-perfect': 'will have', 'h-modal-perfect': 'might have',
};
const passiveIds = new Set(['m-passive', 'm-passive-advanced', 'h-passive-advanced']);
const pluralIds = new Set(['plural', 'these-those', 'how-many', 'countable-uncountable', 'm-noun-count', 'h-agreement', 'h-article-noun']);
const massNounIds = new Set(['countable-uncountable', 'm-noun-count', 'h-article-noun', 'h-quantifiers']);
const gerundIds = new Set(['m-gerund', 'm-gerund-vs-inf', 'h-gerund-idioms']);
const infinitiveIds = new Set(['want-to', 'm-to-inf-noun', 'm-gerund-vs-inf']);
const pronounModes = {
  'object-pronouns': 'object', possessive: 'adjective', 'm-pronoun-case': 'case', 'm-reflexive': 'reflexive',
} as const;
const objectContexts: Contexts = ['Mia waved to ___.', 'Leo sent ___ a message.', 'Mia called ___ yesterday.', 'Leo showed ___ the map.', 'Mia invited ___ to the show.'];
const adjectiveContexts: Contexts = ['This is ___ bike.', 'I found ___ notebook.', 'We saw ___ project.', 'Do you have ___ ticket?', 'The teacher looked at ___ drawing.'];
const possessiveContexts: Contexts = ['This bag is ___.', 'The blue pencil is ___.', 'The book on the table is ___.', 'Is the seat by the door ___?', 'That poster is ___.'];
const reflexiveContexts: Contexts = ['___ in the mirror.', '___ in the photo.', '___ to a new neighbor.', '___ in the video.', '___ on the screen.'];
const spellingModes: Record<string, 'past' | 'third' | 'ing'> = {
  'past-regular': 'past',
  'third-s': 'third', 'm-general-verb': 'third', 'tense-present': 'third',
  'present-progressive': 'ing', 'tense-present-progressive': 'ing',
  'm-present-vs-progressive': 'ing', 'm-past-progressive': 'ing', 'tense-past-progressive': 'ing',
};

type Contexts = readonly [string, string, string, string, string];
export interface GrammarWordTarget {
  cue: string;
  answer: string;
  contexts: Contexts;
}
export interface GrammarWordEntry {
  id: string;
  label: string;
  meaning: string;
  targets: GrammarWordTarget[];
}
export interface GrammarWordSelection {
  version: typeof VERSION;
  recommendationId: string;
  grammarId: string;
  topic: string;
  entries: GrammarWordEntry[];
}
export type GrammarWordReference = Pick<GrammarWordSelection, 'recommendationId' | 'version' | 'grammarId'> & {
  lessonId?: string;
  slideId?: string;
  lessonVersion?: string;
};

function contextsFor(contexts: Contexts, format: (context: string, index: number) => string): Contexts {
  const [a, b, c, d, e] = contexts;
  return [format(a, 0), format(b, 1), format(c, 2), format(d, 3), format(e, 4)];
}

const pastTime = ['Yesterday', 'Last Saturday', 'Last week', 'Two days ago', 'Last night'];
const progressivePast = new Set(['m-past-progressive', 'tense-past-progressive']);
const presentBe = new Set(['i-am', 'he-she-is', 'm-be-verb']);
const doubledIng: Record<string, string> = { plan: 'planning', drop: 'dropping' };
const gerundBase: Record<string, string> = {
  swimming: 'swim', making: 'make', writing: 'write', packing: 'pack', driving: 'drive',
  touching: 'touch', closing: 'close', moving: 'move', taking: 'take', changing: 'change',
  practicing: 'practice', using: 'use', getting: 'get', living: 'live', sharing: 'share',
};

export function grammarWordCandidates(grammarId: string): GrammarWordEntry[] {
  const comparison = Object.hasOwn(comparisonIds, grammarId) ? comparisonIds[grammarId as keyof typeof comparisonIds] : undefined;
  if (comparison) {
    return CORE_COMPARISONS.map(([base, comparative, superlative, meaning, nouns]) => {
      const long = comparative.startsWith('more ');
      const emphasis = grammarId === 'm-comparative-emphasis' ? 'much ' : '';
      const comp = contextsFor(nouns, (noun, index) => [
        `This ${noun} is ${emphasis}___ than that one.`,
        `Is this ${noun} ${emphasis}___ than that one?`,
        `Compared with that ${noun}, this one is ${emphasis}___.`,
        `My ${noun} is ${emphasis}___ than yours.`,
        `I think this ${noun} is ${emphasis}___ than the other one.`,
      ][index]);
      const sup = grammarId === 'm-superlative-one-of'
        ? contextsFor(nouns, noun => `This is one of the ___ ${pluralize(noun) ?? noun} here.`)
        : contextsFor(nouns, (noun, index) => [
          `Of the three, this is the ___ ${noun}.`,
          `Which is the ___ ${noun} of all?`,
          `I think this is the ___ ${noun} in the group.`,
          `Look at these three. Which ${noun} is the ___?`,
          `We chose the ___ ${noun} out of all five.`,
        ][index]);
      return {
        id: base, meaning,
        label: [base, ...(comparison === 'superlative' ? [] : [comparative]), ...(comparison === 'comparative' ? [] : [superlative])].join(' → '),
        targets: [
          ...(comparison === 'superlative' ? [] : [{ cue: base, answer: comparative, contexts: comp }]),
          ...(comparison === 'comparative' ? [] : [{ cue: base, answer: superlative, contexts: sup }]),
        ],
        priority: base === 'good' || base === 'bad' ? 2 : long ? 1 : 0,
      };
    }).sort((a, b) => grammarId === 'm-comparison' ? b.priority - a.priority : 0)
      .map(({ id, meaning, label, targets }) => ({ id, meaning, label, targets }));
  }
  const spelling = Object.hasOwn(spellingModes, grammarId) ? spellingModes[grammarId] : undefined;
  if (spelling) {
    const irregularThird = spelling === 'third' ? CORE_VERBS
      .filter(([base]) => ['go', 'have', 'do'].includes(base))
      .map(([base, past, , meaning, phrases]) => [base, past, meaning, phrases] as const) : [];
    return [...irregularThird, ...CORE_SPELLING].filter(([base]) => spelling !== 'ing' || base !== 'hope').map(([base, past, meaning, phrases]) => {
      const answer = spelling === 'past' ? past : spelling === 'third' ? thirdPersonS(base) : doubledIng[base] ?? ingForm(base);
      const contexts = contextsFor(phrases, (phrase, index) =>
        spelling === 'past' ? `${pastTime[index]}, Mia ___ ${phrase}.`
          : spelling === 'third' ? `Mia usually ___ ${phrase}.`
          : progressivePast.has(grammarId) ? `When I called, Mia was ___ ${phrase}.`
          : `Right now, Mia is ___ ${phrase}.`,
      );
      return { id: base, label: `${base} → ${answer}`, meaning, targets: [{ cue: base, answer, contexts }] };
    });
  }
  if (grammarId === 'past-be' || presentBe.has(grammarId)) {
    const states: Contexts = ['at the library', 'ready for the game', 'in the kitchen', 'at the bus stop', 'excited about the trip'];
    const forms = grammarId === 'past-be'
      ? [['I / she / he', 'was', ['I', 'She', 'He', 'Leo', 'Mia']], ['you / we / they', 'were', ['We', 'They', 'You', 'The girls', 'The boys']]] as const
      : [
        ['I', 'am', ['I', 'I', 'I', 'I', 'I']],
        ['he / she / it', 'is', ['He', 'She', 'Mia', 'Leo', 'She']],
        ['you / we / they', 'are', ['We', 'They', 'You', 'The girls', 'The boys']],
      ] as const;
    const selected = grammarId === 'i-am' ? forms.slice(0, 1) : grammarId === 'he-she-is' ? forms.slice(1, 2) : forms;
    return selected.map(([label, answer, subjects]) => ({
      id: answer, label: `${label} → ${answer}`, meaning: 'be동사',
      targets: [{ cue: 'be', answer, contexts: contextsFor(states, (state, index) =>
        grammarId === 'past-be' ? `${subjects[index]} ___ ${state} ${pastTime[index].toLowerCase()}.` : `${subjects[index]} ___ ${state}.`,
      ) }],
    }));
  }
  const perfect = Object.hasOwn(perfectPrefixes, grammarId) ? perfectPrefixes[grammarId] : undefined;
  if (pastIds.has(grammarId) || perfect) {
    return CORE_VERBS.map(([base, past, participle, meaning, phrases]) => {
      const answer = perfect ? participle : past;
      const contexts = contextsFor(phrases, (phrase, i) =>
        grammarId === 'm-subjunctive' ? `If they ___ ${phrase}, it would make a difference.`
          : grammarId === 'h-wish-as-if' ? `I wish they ___ ${phrase} more often.`
          : perfect === 'had' ? `Before we arrived, they had ___ ${phrase}.`
          : perfect === 'will have' ? `By tomorrow, they will have ___ ${phrase}.`
          : perfect ? `They ${perfect} ___ ${phrase}.`
          : `${pastTime[i]}, they ___ ${phrase}.`,
      );
      return { id: base, label: `${base} → ${answer}`, meaning, targets: [{ cue: base, answer, contexts }] };
    });
  }
  if (passiveIds.has(grammarId)) {
    return CORE_PASSIVES.map(([id, label, meaning, cue, answer, contexts]) => ({
      id, label, meaning, targets: [{ cue, answer, contexts }],
    }));
  }
  if (pluralIds.has(grammarId) || massNounIds.has(grammarId)) {
    const units = massNounIds.has(grammarId) ? CORE_MASS_NOUNS.map(([noun, unit, plural, meaning, phrases]) => ({
      id: noun, label: `${noun} → a ${unit} of ${noun}`, meaning,
      targets: [{ cue: `a ${unit} of ${noun}`, answer: `${plural} of ${noun}`, contexts: contextsFor(phrases, (phrase, i) =>
        `They ${noun === 'luggage' ? 'had' : 'needed'} ${['two', 'three', 'four', 'five', 'six'][i]} ___ ${phrase}.`) }],
    })) : [];
    const plurals = pluralIds.has(grammarId) ? CORE_PLURALS.map(([base, answer, meaning, phrases]) => ({
      id: base, label: `${base} → ${answer}`, meaning, targets: [{ cue: base, answer, contexts: contextsFor(phrases, (phrase, i) =>
        grammarId === 'these-those' ? `${i % 2 ? 'Those' : 'These'} are the ___ ${phrase}.`
          : grammarId === 'how-many' ? `How many ___ are ${phrase}?`
          : `There are ${['two', 'three', 'four', 'five', 'six'][i]} ___ ${phrase}.`,
      ) }],
    })) : [];
    return [...units, ...plurals];
  }
  const pronouns = Object.hasOwn(pronounModes, grammarId) ? pronounModes[grammarId as keyof typeof pronounModes] : undefined;
  if (pronouns) {
    return CORE_PRONOUNS.filter(([subject]) => subject !== 'you all' || pronouns === 'reflexive')
      .filter(([subject]) => subject !== 'it' || pronouns !== 'reflexive')
      .map(([cue, object, adjective, possessive, reflexive, meaning]) => {
        const targets: GrammarWordTarget[] = [];
        if (pronouns === 'object' || pronouns === 'case') targets.push({ cue, answer: object, contexts: objectContexts });
        if (pronouns === 'adjective' || pronouns === 'case') targets.push({ cue, answer: adjective, contexts: adjectiveContexts });
        if (pronouns === 'case' && possessive) targets.push({ cue, answer: possessive, contexts: possessiveContexts });
        if (pronouns === 'reflexive') {
          const subject = cue[0].toUpperCase() + cue.slice(1);
          const contexts = contextsFor(reflexiveContexts, (context, i) =>
            `${subject} ${i === 2 ? 'introduced' : i === 1 ? 'recognized' : 'saw'} ${context}`);
          targets.push({ cue, answer: reflexive, contexts });
        }
        return { id: cue, label: [cue, ...targets.map(target => target.answer)].join(' → '), meaning, targets };
      });
  }
  const idioms = ['give up', 'look forward', 'be used', 'feel like', 'have trouble'];
  const gerunds = gerundIds.has(grammarId) ? CORE_GERUNDS
    .filter(([verb]) => grammarId === 'h-gerund-idioms' ? idioms.includes(verb) : !idioms.includes(verb))
    .map(([verb, connector, meaning, activities]) => {
      const frame = verb === 'be used' ? 'are used to' : [verb, connector].filter(Boolean).join(' ');
      // Split the activity into the form to recall and the rest of the sentence.
      return patternEntry(verb, `${[verb, connector].filter(Boolean).join(' ')} + -ing`, meaning, frame, activities, true);
    }) : [];
  const infinitives = infinitiveIds.has(grammarId) ? CORE_INFINITIVES.map(([verb, , meaning, activities]) =>
    patternEntry(verb, `${verb} + to + verb`, meaning, verb, activities, false)) : [];
  return [...gerunds, ...infinitives];
}

function patternEntry(id: string, label: string, meaning: string, frame: string, activities: Contexts, gerund: boolean): GrammarWordEntry {
  // The question bank stores a different verb in each context, so each has its own cue and answer.
  const targets = activities.map((activity, index) => {
    const [form, ...rest] = activity.split(' ');
    const cue = gerund ? gerundBase[form] ?? form.slice(0, -3) : form;
    const answer = gerund ? form : `to ${form}`;
    const subject = id === 'mind' ? 'Do they' : 'They';
    const sentence = `${subject} ${frame} ___ ${rest.join(' ')}${id === 'mind' ? '?' : '.'}`;
    return { cue, answer, contexts: contextsFor(activities, (_, i) => i === index ? sentence : '') };
  });
  return { id, label, meaning, targets };
}

export const GRAMMAR_WORD_USE = { discover: 0, recall: 1, worksheet: 2, review: 3, homework: 4 } as const;

export function grammarWordQuestions(selection: GrammarWordSelection, use: keyof typeof GRAMMAR_WORD_USE) {
  const index = GRAMMAR_WORD_USE[use];
  return selection.entries.flatMap(entry => entry.targets.flatMap((target, targetIndex) => {
    const context = target.contexts[index];
    if (!context) return [];
    return [{
      id: `${selection.grammarId}:${entry.id}:${targetIndex}:${use}`,
      contentId: `grammar:${selection.grammarId}:${entry.id}`,
      lemma: entry.id, label: entry.label, meaning: entry.meaning,
      q: `${context} (${target.cue})`,
      example: context.replace('___', target.answer.split('/')[0]),
      a: target.answer,
    }];
  }));
}

export function lessonGrammarWordSelection(lesson: CurriculumLesson) {
  for (const slide of effectiveSlides(lesson)) {
    if (slide.kind === 'material' && slide.materialId === GRAMMAR_WORD_SHEET && slide.grammarWords?.version === VERSION
      && Array.isArray(slide.grammarWords.entries) && slide.grammarWords.entries.length) {
      return { slide, selection: slide.grammarWords };
    }
  }
  return null;
}

export function selectGrammarWords(grammarId: string, topic: string, ids: string[]): GrammarWordSelection | undefined {
  const entries = grammarWordCandidates(grammarId).filter(entry => ids.includes(entry.id));
  if (!entries.length) return;
  return { version: VERSION, recommendationId: crypto.randomUUID(), grammarId, topic, entries };
}

export function grammarWordReviewQuestions(selection: GrammarWordSelection) {
  const questions = grammarWordQuestions(selection, 'review');
  const firstByWord = new Map<string, typeof questions[number]>();
  for (const question of questions) {
    if (!firstByWord.has(question.contentId)) firstByWord.set(question.contentId, question);
  }
  return firstByWord.size >= 2 ? [...firstByWord.values()].slice(0, 2) : questions.slice(0, 2);
}

export function grammarWordQnaQuestions(questions: ReturnType<typeof grammarWordQuestions>) {
  return questions.map(({ id, contentId, q, a }) => ({ q, a, grammarWord: { id, contentId } }));
}

export function grammarWordReview(selection: GrammarWordSelection, title: string, lessonId?: string): LessonSlide {
  return {
    id: crypto.randomUUID(), kind: 'qna', boardTheme: 'green', title,
    questions: grammarWordQnaQuestions(grammarWordReviewQuestions(selection)),
    grammarWordSource: { recommendationId: selection.recommendationId, version: selection.version, grammarId: selection.grammarId, lessonId },
    helpers: [{ ...newHelper('timer'), type: 'timer', seconds: 60 }],
  };
}

export function grammarWordHomework(lesson: CurriculumLesson, title: string): HwItemDraft[] {
  const source = lessonGrammarWordSelection(lesson);
  if (!source) return [];
  const { selection } = source;
  const { recommendationId, version, grammarId } = selection;
  const reference = { recommendationId, version, grammarId, lessonId: lesson.id, slideId: source.slide.id, lessonVersion: lesson.updated_at };
  const questions: HwQuestion[] = grammarWordQuestions(selection, 'homework').map(question => ({
    id: `${selection.recommendationId}:${question.id}`, contentId: question.contentId,
    qtype: 'text', style: 'blank', prompt: question.q, correct: question.a,
    word: question.lemma, skill: 'sentence.correct', gen: selection.version,
    card: { word: question.lemma, meaning: question.meaning },
    conceptTags: [selection.grammarId],
  }));
  const items: HwItemDraft[] = [];
  for (let i = 0; i < questions.length; i += 12) {
    items.push({
      kind: 'worksheet', title: questions.length > 12 ? `${title} · ${i / 12 + 1}` : title,
      config: { sheets: ['blank'], grammarWordSource: reference }, content: { questions: questions.slice(i, i + 12) },
    });
  }
  return items;
}

import { GRAMMAR_POINTS, type GrammarPoint, type GrammarStage } from './grammar';

/**
 * 교과과정 문법(2026-10-12) — 문법 항목(grammarPoints.json)을 학교급(초등·중등·고등) → 학년 → 단원(영역)으로 짠 지도.
 * 항목 자체는 문법 페이지·개별수업·문법 슬라이드와 같은 데이터를 쓴다(따로 복사하지 않는다).
 * 단원 이름·묶음만 여기서 정하므로, 새 항목을 더하면 UNITS 의 알맞은 단원에 id 한 줄을 넣는다(확인: check-curriculum-grammar.mjs).
 */
export type SchoolId = 'elementary' | 'middle' | 'high' | 'basic';

export const SCHOOLS: { id: SchoolId; ko: string; en: string; stages: GrammarStage[]; grades: string[] }[] = [
  { id: 'elementary', ko: '초등', en: 'Elementary', stages: ['elementary'], grades: ['초3', '초4', '초5', '초6'] },
  { id: 'middle', ko: '중등', en: 'Middle school', stages: ['middle'], grades: ['중1', '중2', '중3'] },
  { id: 'high', ko: '고등', en: 'High school', stages: ['high'], grades: ['고1', '고2', '고3'] },
  { id: 'basic', ko: '기초 개념', en: 'Core concepts', stages: ['pos', 'tense', 'forms'], grades: ['8품사', '시제', '5형식'] },
];

export interface CurriculumUnit {
  id: string;
  ko: string;
  en: string;
  ids: string[];
}

export const UNITS: CurriculumUnit[] = [
  { id: 'intro', ko: '소개·지시·안부', en: 'Introducing & greeting', ids: ['this-is', 'it-is', 'these-those', 'how-are-you'] },
  { id: 'be', ko: 'be동사', en: 'The verb be', ids: ['i-am', 'he-she-is', 'is-it', 'be-not', 'm-be-verb'] },
  { id: 'verb', ko: '일반동사·명령문', en: 'Verbs & commands', ids: ['i-like', 'i-have', 'i-want', 'do-you-like', 'i-dont', 'third-s', 'does-he', 'imperative', 'lets', 'm-general-verb'] },
  { id: 'modal', ko: '조동사·부탁·의무', en: 'Modals & requests', ids: ['i-can', 'can-i-may-i', 'want-to', 'have-to-should', 'm-modals', 'm-have-to', 'h-modal-perfect'] },
  { id: 'noun', ko: '명사·관사·대명사', en: 'Nouns, articles & pronouns', ids: ['a-an', 'plural', 'apostrophe-s', 'possessive', 'countable-uncountable', 'object-pronouns', 'm-pronoun-case', 'm-noun-count', 'm-reflexive', 'm-indefinite-pronouns', 'h-article-noun', 'h-quantifiers', 'h-pronoun-reference'] },
  { id: 'describe', ko: '꾸미는 말(형용사·부사)', en: 'Adjectives & adverbs', ids: ['adj-noun', 'describe', 'frequency', 'adverb-ly', 'm-adj-adv', 'h-adj-adv-usage'] },
  { id: 'tense', ko: '시제', en: 'Tenses', ids: ['present-progressive', 'past-be', 'past-regular', 'past-irregular', 'did-you', 'future', 'm-present-vs-progressive', 'm-past', 'm-future', 'm-present-perfect', 'm-past-progressive', 'm-past-perfect', 'used-to', 'm-reported-speech', 'h-tense-agreement'] },
  { id: 'question', ko: '의문문·묻고 답하기', en: 'Questions', ids: ['wh-questions', 'how-many', 'time-day', 'date-months', 'how-do-you', 'm-wh-questions', 'm-how-questions', 'm-tag-questions', 'm-indirect-question'] },
  { id: 'daily', ko: '일상 의사소통', en: 'Everyday communication', ids: ['weather', 'jobs-future', 'whats-wrong', 'sequence', 'i-think'] },
  { id: 'place', ko: '위치·장소·길', en: 'Places & directions', ids: ['prepositions', 'there-is', 'directions', 'm-there-be', 'm-prep-place', 'm-prep-time'] },
  { id: 'compare', ko: '비교', en: 'Comparison', ids: ['comparative', 'superlative', 'm-comparison', 'm-comparative-emphasis', 'm-superlative-one-of', 'h-comparison-advanced'] },
  { id: 'conj', ko: '접속사·문장 잇기', en: 'Conjunctions', ids: ['and-but', 'because', 'so', 'm-conj-coordinating', 'm-conj-when-if-that', 'm-because-although', 'as-long-as', 'so-that-purpose', 'm-if-conditional', 'h-conj-vs-prep', 'h-correlative', 'h-noun-clause'] },
  { id: 'verbals', ko: 'to부정사·동명사', en: 'Infinitives & gerunds', ids: ['m-to-inf-noun', 'm-gerund', 'm-to-inf-adj-adv', 'm-gerund-vs-inf', 'm-it-to', 'm-too-enough-so', 'h-inf-subject-tense', 'h-gerund-idioms'] },
  { id: 'participle', ko: '분사', en: 'Participles', ids: ['m-participle', 'h-emotion-participle', 'h-participle-clause', 'h-with-absolute'] },
  { id: 'patterns', ko: '문장 형식', en: 'Sentence patterns', ids: ['m-dative', 'm-linking-verbs', 'm-object-complement', 'm-causative', 'm-perception'] },
  { id: 'passive', ko: '수동태', en: 'The passive', ids: ['m-passive', 'm-passive-advanced', 'h-passive-advanced', 'h-have-pp'] },
  { id: 'relative', ko: '관계사', en: 'Relative clauses', ids: ['m-relative-subject', 'm-relative-object', 'm-relative-what', 'm-relative-adverb', 'm-relative-whose', 'h-relative-nonrestrictive', 'h-prep-relative', 'h-compound-relative', 'h-relative-what-that'] },
  { id: 'subjunctive', ko: '가정법', en: 'Subjunctive', ids: ['m-subjunctive', 'h-subjunctive-past-perfect', 'h-wish-as-if', 'h-without-its-time', 'h-subjunctive-demand'] },
  { id: 'special', ko: '특수 구문', en: 'Special structures', ids: ['m-exclamation', 'm-it-impersonal', 'h-inversion', 'h-emphasis', 'h-agreement', 'h-parallelism', 'h-ellipsis-insertion', 'h-negation'] },
  { id: 'basic-pos', ko: '8품사', en: 'Parts of speech', ids: ['pos-overview', 'pos-noun', 'pos-pronoun', 'pos-verb', 'pos-adjective', 'pos-adverb', 'pos-preposition', 'pos-conjunction', 'pos-interjection'] },
  { id: 'basic-tense', ko: '12시제', en: 'Twelve tenses', ids: ['tense-overview', 'tense-present', 'tense-past', 'tense-future', 'tense-present-progressive', 'tense-past-progressive', 'tense-future-progressive', 'tense-present-perfect', 'tense-past-perfect', 'tense-future-perfect', 'tense-present-perfect-progressive', 'tense-past-perfect-progressive', 'tense-future-perfect-progressive'] },
  { id: 'basic-forms', ko: '5형식', en: 'Five sentence patterns', ids: ['forms-overview', 'forms-1', 'forms-2', 'forms-3', 'forms-4', 'forms-5'] },
];

/** 2026-10-12에 교과과정에 맞춰 새로 보강한 항목(검수 전 초안) — 화면에서 "NEW"로 표시한다 */
export const NEW_CURRICULUM_IDS = new Set<string>([
  'how-are-you', 'these-those', 'apostrophe-s', 'date-months', 'can-i-may-i', 'directions', 'jobs-future', 'how-do-you', 'countable-uncountable', 'object-pronouns', 'whats-wrong', 'adverb-ly',
  'as-long-as', 'so-that-purpose', 'used-to',
  'm-be-verb', 'm-general-verb', 'm-noun-count', 'm-wh-questions', 'm-there-be', 'm-future', 'm-adj-adv', 'm-reflexive', 'm-conj-coordinating', 'm-prep-place', 'm-comparative-emphasis', 'm-if-conditional', 'm-indefinite-pronouns', 'm-reported-speech', 'm-relative-whose',
  'h-tense-agreement', 'h-article-noun', 'h-quantifiers', 'h-pronoun-reference', 'h-parallelism', 'h-conj-vs-prep', 'h-adj-adv-usage', 'h-ellipsis-insertion', 'h-negation', 'h-emotion-participle', 'h-relative-what-that', 'h-subjunctive-demand',
]);

const unitById = new Map<string, CurriculumUnit>();
for (const u of UNITS) for (const id of u.ids) unitById.set(id, u);

export const unitOf = (id: string): CurriculumUnit | null => unitById.get(id) ?? null;

export interface CurriculumGrade {
  grade: string;
  count: number;
  units: { unit: CurriculumUnit; points: GrammarPoint[] }[];
}

/** 학교급 하나의 학년 → 단원 → 항목 목록 */
export function curriculumFor(school: SchoolId, points: GrammarPoint[] = GRAMMAR_POINTS): CurriculumGrade[] {
  const s = SCHOOLS.find((x) => x.id === school);
  if (!s) return [];
  const inSchool = points.filter((p) => s.stages.includes(p.stage));
  return s.grades.map((grade) => {
    const here = inSchool.filter((p) => p.grade === grade);
    const units: CurriculumGrade['units'] = [];
    for (const unit of UNITS) {
      const list = here.filter((p) => unitById.get(p.id) === unit);
      if (list.length > 0) units.push({ unit, points: list });
    }
    const loose = here.filter((p) => !unitById.has(p.id));
    if (loose.length > 0) units.push({ unit: { id: 'etc', ko: '기타', en: 'Other', ids: [] }, points: loose });
    return { grade, count: here.length, units };
  });
}

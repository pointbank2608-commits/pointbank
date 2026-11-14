import type { SoloClip, SoloStep } from './soloLessons';
import type { VideoClip } from './videoClips';
import { withSource } from './soloBoard';
import { parseShadowText } from './shadowLines';

export const DEFAULT_VIDEO_WORDS = 4;
export const DEFAULT_VIDEO_SHADOW_LINES = 2;

export interface VerifiedVideoLine {
  start: number;
  end: number;
  text: string;
}

const clean = (s: string) => s.toLowerCase().replace(/[’]/g, "'").replace(/[.!?]+$/, '').trim();

interface DialogueRange {
  title: string;
  start: number;
  end: number;
}

interface VideoExpression {
  phrase: string;
  meaning: string;
}

export function videoSelectedSteps(draft: SoloVideoDraft, excluded: readonly number[] = draft.defaultExcluded): SoloStep[] {
  const omitted = new Set(excluded);
  return draft.steps.filter((step, index) =>
    !omitted.has(index) || (step.t !== 'meet' && (step.t !== 'lineSing' || step.practice !== 'shadow')));
}

export function videoDraftSteps(draft: SoloVideoDraft, excluded: readonly number[] = draft.defaultExcluded, games: readonly SoloStep[] = []): SoloStep[] {
  const selected = videoSelectedSteps(draft, excluded);
  if (!draft.finalReview) return [...selected, ...games];
  const words = selected.flatMap(step => step.t === 'meet' ? [`${step.word} · ${step.meaning}`] : []);
  const lines = selected.filter(step => step.t === 'lineSing' && step.practice === 'shadow');
  const watched = selected.filter(step => step.t === 'watch');
  return [
    ...selected,
    { t: 'intro' as const, title: '오늘 배운 내용 총정리', text: lines.length ? `오늘 연습한 ${lines.length}문장을 차례로 한 번 더 쉐도잉해요.` : '오늘 들은 장면과 배운 표현을 떠올려 봐요.' },
    ...games,
    ...(words.length ? [{ t: 'rule' as const, title: '오늘 배운 단어·표현', pattern: '뜻을 떠올려 봐요', explain: '', lines: [...new Set(words)], tip: '' }] : []),
    ...(lines.length ? lines : watched.map(step => ({ ...step, clip: { ...step.clip, captions: [] } }))),
  ];
}

export interface SoloVideoDraft {
  name: string;
  steps: SoloStep[];
  minutes: number;
  checks: { evidence: VerifiedVideoLine; clip: SoloClip; prompt: string; answer: string }[];
  defaultExcluded: number[];
  finalReview?: boolean;
}

// Each rule applies to one complete utterance in the reviewed source.
function buildSoloVideoTemplate(source: {
  title: string;
  mediaUrl?: string;
  videoId?: string;
  start?: number;
  duration: number;
  lines: VerifiedVideoLine[];
}, plan: {
  questions: ( { line: RegExp; prompt: string; options: string[]; answer: number } & { dialogue?: DialogueRange; practice?: VideoExpression[]; extraShadow?: number })[];
  model: RegExp;
  practice?: { expressions: VideoExpression[]; chunks: VerifiedVideoLine[]; extraExpressions?: VideoExpression[]; extraShadow?: number };
  translation: string;
  intro: string;
  situation: string;
  prompt: string;
  cue: string;
  example: string;
}) {
  const { title, mediaUrl, videoId = '', start = 0, duration: end, lines } = source;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || (!mediaUrl && !videoId)) return null;
  if (lines.some((line, i) => !line.text.trim() || !Number.isFinite(line.start) || !Number.isFinite(line.end) ||
    line.start < (lines[i - 1]?.end ?? start) || line.end <= line.start || line.end > end)) return null;

  const segment = ({ start, end }: Pick<SoloClip, 'start' | 'end'>): SoloClip => ({ mediaUrl, videoId, start, end });
  const describeExpression = ({ phrase, meaning }: VideoExpression): SoloStep => ({
    t: 'meet', word: phrase, meaning, imageUrl: null, example: null,
  });
  const shadow = (line: VerifiedVideoLine): SoloStep => ({
    t: 'lineSing', clip: segment(line), en: line.text, ko: '', originalOnly: true, practice: 'shadow',
  });
  const extras = new Set<SoloStep>();
  const addExtra = (step: SoloStep) => { extras.add(step); return step; };
  const checks = plan.questions.flatMap(({ line: rule, prompt, options, answer, dialogue, practice, extraShadow }) => {
    if (dialogue && (dialogue.start < start || dialogue.end > end || dialogue.end <= dialogue.start)) return [];
    const context = dialogue ? lines.filter(line => line.start >= dialogue.start && line.end <= dialogue.end) : lines;
    const matches = context.filter(line => rule.test(clean(line.text)));
    if (matches.length !== 1) return [];
    const evidence = matches[0];
    if (practice?.some(({ phrase }) => !clean(evidence.text).includes(clean(phrase)))) return [];
    const clip = { ...segment(evidence), ...(dialogue && { captions: [evidence] }) };
    const step: SoloStep = { t: 'lyricBlank', clip, sentence: '', ko: '', audioQuestion: prompt, options, answer,
      ...(dialogue && { afterDialogue: true }) };
    const watch: SoloStep | undefined = dialogue && {
      t: 'watch', title: dialogue.title, mode: 'listen', clip: { ...segment(dialogue), captions: context },
    };
    const practiceSteps = practice ? [...practice.map(describeExpression), shadow(evidence)] : [];
    const extraLine = context.find(line => line.start === extraShadow);
    if (extraLine) practiceSteps.push(addExtra(shadow(extraLine)));
    return [{ evidence, clip, prompt, answer: options[answer], step, watch, practiceSteps }];
  });
  const models = lines.filter(line => plan.model.test(clean(line.text)));
  if (!checks.length || models.length !== 1 || (plan.questions.some(q => q.dialogue) && checks.length !== plan.questions.length)) return null;
  const [model] = models;
  const practice = plan.practice;
  if (practice && (practice.chunks.map(chunk => chunk.text).join(' ') !== model.text ||
      practice.chunks.some(chunk => chunk.start < model.start || chunk.end > model.end || chunk.end <= chunk.start))) return null;
  const speakingSteps: SoloStep[] = practice ? [
    ...practice.expressions.map(describeExpression),
    ...(practice.extraExpressions ?? []).map(expression => addExtra(describeExpression(expression))),
    ...practice.chunks.map((chunk, index): SoloStep => ({
      t: 'lineSing', clip: segment(chunk), en: chunk.text,
      ko: index === practice.chunks.length - 1 ? plan.translation : '', originalOnly: true, practice: 'repeat',
    })),
    shadow(model),
  ] : [{ t: 'lineSing', clip: segment(model), en: model.text, ko: plan.translation, originalOnly: true }];
  const extraLine = lines.find(line => line.start === practice?.extraShadow);
  if (extraLine) speakingSteps.push(addExtra(shadow(extraLine)));

  const steps: SoloStep[] = [
    { t: 'intro', title, text: plan.intro },
    ...(!checks.some(check => check.watch)
      ? [{ t: 'watch' as const, title, mode: 'listen' as const, clip: { mediaUrl, videoId, start, end, captions: lines } }]
      : []),
    ...checks.flatMap(({ step, watch, practiceSteps }) => [...(watch ? [watch] : []), step, ...practiceSteps]),
    ...speakingSteps,
    {
      t: 'roleplay', title: plan.situation, speakFirst: true,
      lines: [
        { who: 'other', speaker: '친구', en: plan.prompt, ko: plan.cue },
        { who: 'me', speaker: '나', en: plan.example, ko: '영어 한 문장으로 말해 보세요.' },
      ],
    },
  ];
  return { name: title, steps, minutes: 5, checks, model,
    defaultExcluded: steps.flatMap((step, index) => extras.has(step) ? [index] : []) };
}

export const ICE_SKATING_CLIP_ID = '0ca33141-ab1b-40bb-b361-8be0ff158da6';

export function buildLibrarySoloVideoTemplate(clip: Pick<VideoClip, 'id' | 'youtube_id' | 'title' | 'start_sec' | 'end_sec' | 'hidden'>) {
  const start = Number(clip.start_sec);
  const end = Number(clip.end_sec);
  if (clip.hidden || clip.id !== ICE_SKATING_CLIP_ID || clip.youtube_id !== 'O37zFRCQhEQ' ||
      !Number.isFinite(start) || !Number.isFinite(end) || start > 12.8 || end < 44.6) return null;

  const lesson = buildSoloVideoTemplate({
    title: clip.title,
    videoId: clip.youtube_id,
    start: 12.8,
    duration: 44.6,
    lines: [
      { start: 13.10, end: 16.55, text: "It's slippery out there, so be careful, okay?" },
      { start: 16.76, end: 19.40, text: "We don't want you falling and hurting yourself." },
      { start: 22.10, end: 25.20, text: 'Rosie, hold on tight to your penguin, okay?' },
      { start: 31.55, end: 35.88, text: "Are you sure you don't want a penguin too, Caillou?" },
      { start: 37.32, end: 38.62, text: 'No thanks, Mommy.' },
      { start: 38.62, end: 41.27, text: 'I want to learn all by myself.' },
      { start: 41.65, end: 42.76, text: 'Okay.' },
      { start: 43.17, end: 44.38, text: 'Careful now.' },
    ],
  }, {
    questions: [
      { line: /^it's slippery out there, so be careful, okay$/, prompt: '아빠는 왜 조심하라고 했나요?', options: ['미끄러워서', '어두워서', '날이 추워서'], answer: 0,
        dialogue: { title: '아빠가 조심하라고 해요', start: 12.8, end: 19.55 },
        practice: [{ phrase: 'slippery', meaning: '미끄러운' }, { phrase: 'be careful', meaning: '조심해' }], extraShadow: 16.76 },
      { line: /^i want to learn all by myself$/, prompt: '카이유는 어떻게 배우고 싶다고 했나요?', options: ['친구와 같이', '혼자서', '아빠와 같이'], answer: 1,
        dialogue: { title: '카이유가 혼자 해 보겠다고 해요', start: 31.45, end: 44.6 } },
    ],
    model: /^i want to learn all by myself$/,
    practice: { expressions: [{ phrase: 'by myself', meaning: '혼자서' }, { phrase: 'I want to …', meaning: '나는 …하고 싶어요' }],
      extraExpressions: [{ phrase: 'Are you sure …?', meaning: '정말 …하겠니?' }, { phrase: 'No thanks', meaning: '아니요, 괜찮아요' }], extraShadow: 31.55, chunks: [
      { start: 38.62, end: 39.84, text: 'I want to learn' },
      { start: 39.82, end: 41.27, text: 'all by myself.' },
    ] },
    translation: '나 혼자서 배우고 싶어요.',
    intro: '카이유 가족의 대화를 듣고, 혼자서 해 보고 싶은 일을 영어로 말해요.',
    situation: '자전거를 혼자 타 보고 싶을 때',
    prompt: 'Do you want me to help you ride your bike?',
    cue: '가족이 자전거 타는 걸 도와줄지 물어요. 이번에는 혼자 타 보고 싶다고 말해 보세요.',
    example: 'I want to ride all by myself.',
  });
  if (!lesson) return null;
  return { ...lesson, steps: withSource(lesson.steps, { id: clip.id, name: clip.title }) };
}

/** Draft for library clips with explicitly timed lines. The teacher previews their original timing. */
export function buildLibraryVideoPractice(clip: VideoClip): SoloVideoDraft | null {
  if (clip.hidden) return null;
  const start = Number(clip.start_sec);
  const end = Number(clip.end_sec);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) return null;
  const timedRows = clip.script.split(/\r?\n/).flatMap(row => {
    const timing = row.match(/^\s*\[(\d{1,2}):(\d{2}(?:\.\d+)?)\s*-\s*(\d{1,2}):(\d{2}(?:\.\d+)?)\]/);
    if (!timing) return [];
    const [, startMin, startSec, endMin, endSec] = timing;
    const begin = Number(startMin) * 60 + Number(startSec);
    const finish = Number(endMin) * 60 + Number(endSec);
    return begin >= start && finish <= end && finish - begin >= 0.5 ? [row] : [];
  });
  const lines = parseShadowText(timedRows.join('\n'))
    .map(line => ({ start: line.start, end: line.end, text: line.en.replace(/\*\*/g, '').trim(), meaning: line.ko.trim() }))
    .filter(line => /[a-z]+\s+[a-z]/i.test(line.text));
  if (!lines.length) return null;
  const scriptWords = lines.map(line => ` ${clean(line.text).replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim()} `);
  const words = new Map<string, VideoExpression>();
  for (const item of clip.pack?.words ?? []) {
    const phrase = item.word.trim();
    const meaning = item.meaning.trim();
    if (!phrase || !meaning || !scriptWords.some(line => line.includes(` ${clean(phrase)} `))) continue;
    words.set(clean(phrase), { phrase, meaning });
  }
  for (const { text: phrase, meaning } of lines) {
    if (meaning && /^[a-z'’]+(?:\s+[a-z'’]+){1,3}[.!?]?$/i.test(phrase) && !words.has(clean(phrase))) {
      words.set(clean(phrase), { phrase, meaning });
    }
  }
  const steps: SoloStep[] = [
    { t: 'intro', title: clip.title, text: clip.summary || '장면을 듣고 표현을 따라 말해요.' },
    { t: 'watch', title: clip.title, mode: 'listen', clip: { videoId: clip.youtube_id, start, end,
      captions: lines.map(({ start, end, text }) => ({ start, end, text })) } },
    ...Array.from(words.values(), ({ phrase, meaning }): SoloStep => ({ t: 'meet', word: phrase, meaning, imageUrl: null, example: null })),
    ...lines.map((line): SoloStep => ({ t: 'lineSing', clip: { videoId: clip.youtube_id, start: line.start, end: line.end },
      en: line.text, ko: '', originalOnly: true, practice: 'shadow' })),
  ];
  const defaultExcluded = steps.flatMap((step, index) =>
    (step.t === 'meet' && index >= 2 + DEFAULT_VIDEO_WORDS) ||
    (step.t === 'lineSing' && index >= 2 + words.size + DEFAULT_VIDEO_SHADOW_LINES) ? [index] : []);
  return { name: clip.title, steps: withSource(steps, { id: clip.id, name: clip.title }), minutes: 5, checks: [], defaultExcluded };
}

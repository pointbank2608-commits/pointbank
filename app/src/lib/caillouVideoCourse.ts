import data from '../data/caillouVideoCourse.json';
import type { SoloClip, SoloStep } from './soloLessons';
import type { SoloVideoDraft } from './soloVideoTemplate';
import { withSource } from './soloBoard';

export const CAILLOU_VIDEO_ID = 'O37zFRCQhEQ';
export const VIDEO_LESSON_MINUTES = [10, 20, 40] as const;
export type VideoLessonMinutes = typeof VIDEO_LESSON_MINUTES[number];

type Context = {
  title: string;
  start: number;
  end: number;
  lines: { start: number; end: number; text: string }[];
  words: { phrase: string; meaning: string }[];
};
type Scene = Context & {
  before?: (Omit<Context, 'lines' | 'words'> & Partial<Pick<Context, 'lines' | 'words'>>)[];
  question?: { prompt: string; options: string[]; answer: number; evidenceStart: number };
};
type Story = { title: string; scenes: Scene[] };
const stories: Story[] = data.stories;

export function caillouCourseParts(minutes: VideoLessonMinutes) {
  const scenesPerLesson = minutes / 5;
  const scenes = stories.flatMap(story => story.scenes.map(scene => ({ ...scene, story: story.title })));
  return Array.from({ length: Math.ceil(scenes.length / scenesPerLesson) }, (_, index) => {
    const group = scenes.slice(index * scenesPerLesson, (index + 1) * scenesPerLesson);
    const titles = [...new Set(group.map(scene => scene.story))];
    return { title: `${index + 1}차시 · ${titles.join(' / ')}`, scenes: group,
      closing: index === Math.ceil(scenes.length / scenesPerLesson) - 1 ? data.closing : [] };
  });
}

export const caillouCourseCoverage = {
  ...data.coverage,
  selectedSeconds: Math.round(caillouCourseParts(40).flatMap(part => [
    ...part.scenes.flatMap(scene => [...(scene.before ?? []), scene]),
    ...part.closing,
  ]).reduce((sum, clip) => sum + clip.end - clip.start, 0)),
};

type LibraryDraft = Pick<SoloVideoDraft, 'steps' | 'defaultExcluded' | 'checks'>;

function practiceSeconds(step: SoloStep) {
  if (step.t === 'watch') return step.clip.end - step.clip.start;
  if (step.t === 'meet') return 20;
  if (step.t === 'lineSing') return step.practice === 'shadow' ? 65 : 20;
  if (step.t === 'lyricBlank') return 25;
  if (step.t === 'roleplay') return 75;
  return 15;
}

export function caillouPracticeMinutes(steps: SoloStep[]) {
  return Math.ceil(steps.reduce((sum, step) => sum + practiceSeconds(step), 30) / 60);
}

export function buildCaillouCourseDraft(minutes: VideoLessonMinutes, partIndex = 0, reviewed?: LibraryDraft): SoloVideoDraft | null {
  const part = caillouCourseParts(minutes)[partIndex];
  if (!part) return null;
  const clipOf = ({ start, end }: { start: number; end: number }): SoloClip => ({ videoId: CAILLOU_VIDEO_ID, start, end });
  const steps: SoloStep[] = [{ t: 'intro', title: part.title, text: '장면을 듣고, 오늘 배운 표현과 대사를 마지막에 다시 연습해요.' }];
  const defaultExcluded: number[] = [];
  const checks: SoloVideoDraft['checks'] = [];
  function addContext(context: NonNullable<Scene['before']>[number]) {
    steps.push({ t: 'watch', title: context.title, mode: 'listen', clip: { ...clipOf(context), captions: context.lines ?? [] } });
    for (const { phrase, meaning } of context.words ?? []) {
      defaultExcluded.push(steps.length);
      steps.push({ t: 'meet', word: phrase, meaning, imageUrl: null, example: null });
    }
    for (const line of context.lines ?? []) {
      defaultExcluded.push(steps.length);
      steps.push({ t: 'lineSing', clip: clipOf(line), en: line.text, ko: '', originalOnly: true, practice: 'shadow' });
    }
  }
  for (const scene of part.scenes) {
    for (const context of scene.before ?? []) addContext(context);
    if (reviewed) {
      const sourceStart = reviewed.steps.findIndex(step => step.t === 'watch' && step.clip.start === scene.start);
      if (sourceStart >= 0) {
        const nextScene = reviewed.steps.findIndex((step, index) => index > sourceStart && (step.t === 'watch' || step.t === 'roleplay'));
        const sourceSteps = reviewed.steps.slice(sourceStart, nextScene < 0 ? undefined : nextScene);
        sourceSteps.forEach((step, index) => {
          if (reviewed.defaultExcluded.includes(sourceStart + index)) defaultExcluded.push(steps.length);
          steps.push(step);
        });
        checks.push(...reviewed.checks.filter(check => check.evidence.start >= scene.start && check.evidence.end <= scene.end));
        continue;
      }
    }
    steps.push({ t: 'watch', title: scene.title, mode: 'listen', clip: { ...clipOf(scene), captions: scene.lines } });
    const question = scene.question;
    const evidence = question && scene.lines.find(line => line.start === question.evidenceStart);
    if (question && evidence) {
      const evidenceClip = { ...clipOf(evidence), captions: [evidence] };
      steps.push({ t: 'lyricBlank', clip: evidenceClip, sentence: '', ko: '', audioQuestion: question.prompt,
        afterDialogue: true, options: question.options, answer: question.answer });
      checks.push({ evidence, clip: evidenceClip, prompt: question.prompt, answer: question.options[question.answer] });
    }
    scene.words.forEach(({ phrase, meaning }, index) => {
      if (index > 1) defaultExcluded.push(steps.length);
      steps.push({ t: 'meet', word: phrase, meaning, imageUrl: null, example: null });
    });
    scene.lines.forEach(line => {
      if (line !== (evidence ?? scene.lines[0])) defaultExcluded.push(steps.length);
      steps.push({ t: 'lineSing', clip: clipOf(line), en: line.text, ko: '', originalOnly: true, practice: 'shadow' });
    });
  }
  part.closing.forEach(addContext);
  const transfer = reviewed?.steps.find(step => step.t === 'roleplay');
  if (transfer && part.scenes.some(scene => scene.start === 31.45)) steps.push(transfer);
  const omitted = new Set(defaultExcluded);
  let seconds = steps.reduce((sum, step, index) => omitted.has(index) ? sum : sum + practiceSeconds(step), 30);
  // Keep base selections in a short session; use the available time for more lines and expressions in longer sessions.
  if (minutes > 10) for (const index of defaultExcluded) {
    const cost = practiceSeconds(steps[index]);
    if (seconds + cost > minutes * 60) continue;
    seconds += cost;
    omitted.delete(index);
  }
  return { name: part.title, minutes, checks, defaultExcluded: [...omitted], finalReview: true,
    steps: withSource(steps, { id: CAILLOU_VIDEO_ID, name: part.title }) };
}

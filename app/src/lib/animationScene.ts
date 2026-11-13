import type { VideoClip } from './videoClips';
import { parseShadowText } from './shadowLines';
import type { QnaItem } from './qnaLines';
import { animationScenes } from '../data/animationScenes';

export interface AnimationLessonPlan {
  minutes: 30 | 40;
  gameLast?: boolean;
}

export interface SceneTeaching {
  image?: string;
  range?: { start: number; end: number };
  expression?: { text: string; explanation: string; original?: string; examples: { situation: string; answer: string }[] };
  choices?: Record<string, string[]>;
  definitions?: Record<string, string>;
  wordPictures?: Record<string, string>;
  print?: import('./animationPrint').AnimationPrintContent;
}

export const sceneTeaching = (clip: VideoClip): SceneTeaching => ({...animationScenes[clip.id],...clip.pack.scene});

export function sceneWordPicture(clip: VideoClip, word: string, meaning: string) {
  const normalize=(value:string)=>value.normalize('NFKC').trim().toLowerCase();
  return sceneTeaching(clip).wordPictures?.[normalize(word)+'|'+normalize(meaning)];
}

export function learningRange(clip: VideoClip) {
  const range = sceneRange(clip);
  const focus = sceneTeaching(clip).range;
  return range && focus && focus.start >= range.start && focus.end <= range.end && focus.end > focus.start ? focus : range;
}

export function sceneRange(clip: VideoClip) {
  const start = Number(clip.start_sec), end = Number(clip.end_sec);
  return clip.start_sec != null && clip.end_sec != null && Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start
    ? { start, end } : null;
}

export function sceneQuestions(clip: VideoClip, range = sceneRange(clip)): QnaItem[] {
  const script = parseShadowText(clip.script);
  return (clip.pack.questions ?? []).filter(item=>item.q.trim() && item.a.trim()).flatMap(item=>{
    const {time,end,...question}=item;
    if (time === undefined) return range === null || range.start === Number(clip.start_sec) && range.end === Number(clip.end_sec) ? [question] : [];
    if (!range || time < range.start || time >= range.end) return range ? [] : [question];
    const line = script.find(line=>line.start <= time && line.end > time);
    const finish = end ?? line?.end;
    return finish !== undefined && finish > time && finish <= range.end ? [{...question,time,end:finish}] : [question];
  });
}

export function sceneLesson(clip: VideoClip) {
  const data = sceneTeaching(clip);
  const lessonRange = learningRange(clip);
  const grammar = clip.pack.grammar;
  const expression = data.expression ?? (grammar?.sentence && grammar.drills?.length ? {
    text: grammar.sentence,
    explanation: grammar.point,
    examples: grammar.drills.map(item=>({situation:item.cue,answer:item.answer})),
    original: parseShadowText(clip.script).some(line=>line.en.replace(/\*\*/g,'').includes(grammar.sentence)) ? grammar.sentence : undefined,
  } : undefined);
  const questions = sceneQuestions(clip,lessonRange);
  const examples = expression?.examples.filter(item=>item.situation.trim() && item.answer.trim() && item.answer.trim()!==expression.original?.trim()) ?? [];
  const missing = [
    !lessonRange && '학습 구간 시작·종료',
    !questions.some(question=>question.time!==undefined&&question.end!==undefined) && '구간 안에 근거가 있는 내용 질문',
    !clip.pack.words?.some(item=>item.word.trim()&&item.meaning.trim()) && '장면 속 핵심 단어와 뜻',
    (!expression || examples.length < 4) && '목표 표현과 새 상황 예문 4개 이상',
    lessonRange && lessonRange.end-lessonRange.start>125 && '2분 안팎의 수업용 구간',
  ].filter((value):value is string=>typeof value==='string');
  return {range:lessonRange, questions, expression, examples, missing};
}

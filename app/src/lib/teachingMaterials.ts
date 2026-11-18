import { createCurriculumLesson } from './api';
import { saveTextbookWorksheet, textbookWorksheetPath } from './textbooks';
import type { CanvasTextElement, LessonSlide } from './types';
import { parseWorksheetFile, readWorksheetStore, studioKey, writeWorksheetStore, type WorksheetDocument } from './worksheetStudio';

export const materialOutputs = ['words', 'sentences', 'lesson', 'workbook'] as const;
export type MaterialOutput = typeof materialOutputs[number];
export const examCategories = ['reading', 'vocabulary', 'grammar', 'writing'] as const;
export type ExamCategory = typeof examCategories[number];
export type ExamCounts = Record<ExamCategory, number>;
export type TeachingSettings = {
  grade: number;
  level: 'foundation' | 'standard' | 'advanced';
  purpose: 'classroom' | 'support' | 'exam';
  minutes?: number;
  questionCount?: number;
  exam?: { scope: string; counts: ExamCounts };
};
export type SourceMaterialOptions = { outputs: MaterialOutput[]; teaching?: TeachingSettings };
export type LessonStage = { title: string; minutes: number; content: string };
export type PracticeQuestion = { category: ExamCategory; prompt: string; options: string[]; answer: string; explanation: string; evidence: string };
export type MaterialPractice = { instruction: string; passage: string; questions: PracticeQuestion[] };
export type TeachingDraft = { objective: string; lesson?: LessonStage[]; practice?: MaterialPractice };

export function defaultExamCounts(total: number): ExamCounts {
  const reading = Math.round(total * 0.3);
  const vocabulary = Math.round(total * 0.2);
  const grammar = Math.round(total * 0.3);
  return { reading, vocabulary, grammar, writing: total - reading - vocabulary - grammar };
}

export function hasTeachingDraft(draft: Partial<TeachingDraft>, settings: SourceMaterialOptions): draft is TeachingDraft {
  return typeof draft.objective === 'string' && !!draft.objective.trim() &&
    (!settings.outputs.includes('lesson') || (Array.isArray(draft.lesson) && draft.lesson.length > 0)) &&
    (!settings.teaching?.questionCount || (Array.isArray(draft.practice?.questions) && draft.practice.questions.length > 0));
}

export function isTeachingReviewComplete(draft: TeachingDraft, minutes?: number) {
  if (!draft.objective.trim()) return false;
  if (draft.lesson && (draft.lesson.some(stage => !stage.title.trim() || !stage.content.trim() || !Number.isInteger(stage.minutes) || stage.minutes < 1) ||
      draft.lesson.reduce((sum, stage) => sum + stage.minutes, 0) !== minutes)) return false;
  if (draft.practice && (!draft.practice.instruction.trim() || draft.practice.questions.some(question => {
    const choices = question.options.map(option => option.trim());
    return !question.prompt.trim() || !question.answer.trim() || !question.explanation.trim() ||
      (choices.length > 0 && (choices.length < 2 || choices.length > 5 || new Set(choices).size !== choices.length ||
        choices.some(choice => !choice || choice.length > 60) || !choices.includes(question.answer.trim())));
  }))) return false;
  return true;
}

export function makeTeachingLessonSlides(draft: TeachingDraft, durations: string[], includePractice: boolean, practiceTitle: string): LessonSlide[] {
  const textBox = (text: string, y: number, h: number, fontSize: number, bold: boolean): CanvasTextElement => ({
    id: crypto.randomUUID(), type: 'text', x: 7, y, w: 86, h, text, fontSize, bold, align: 'left',
    fitText: true, font: 'sans', color: '#102b50',
  });
  const slides: LessonSlide[] = (draft.lesson ?? []).map((stage, index) => ({
    id: crypto.randomUUID(), kind: 'canvas', background: '#f7f9fd',
    elements: [textBox(`${stage.title.trim()} · ${durations[index]}`, 8, 15, 8, true),
      ...(index === 0 ? [textBox(draft.objective.trim(), 25, 12, 4.5, true)] : []),
      textBox(stage.content.trim(), index === 0 ? 40 : 26, index === 0 ? 52 : 66, 5.5, false)],
  }));
  if (includePractice && draft.practice) {
    const { passage, questions } = draft.practice;
    if (passage.trim()) slides.push({ id: crypto.randomUUID(), kind: 'reading', title: practiceTitle, source: passage.trim(), mode: 'lines' });
    slides.push({ id: crypto.randomUUID(), kind: 'qna', title: practiceTitle,
      questions: questions.map(question => ({
        q: [question.prompt.trim(), ...question.options.map((option, index) => `${index + 1}. ${option.trim()}`)].join('\n'),
        a: question.answer.trim(), aKo: question.explanation.trim(),
      })) });
  }
  return slides;
}

export function makeTeachingWorkbook(name: string, draft: TeachingDraft, labels?: Record<ExamCategory, string>): WorksheetDocument {
  if (!draft.practice) throw new Error('missingPractice');
  return parseWorksheetFile({
    schema: 'classbank-worksheet-v1', activityId: 'sourceWorkbook', title: name.trim(),
    instruction: draft.practice.instruction.trim(), topic: draft.objective.trim(), passage: draft.practice.passage.trim(),
    words: [], tasks: draft.practice.questions.map(question => ({
      id: crypto.randomUUID(), prompt: `${labels ? `[${labels[question.category]}] ` : ''}${question.prompt.trim()}`,
      options: question.options.map(option => option.trim()), answer: question.answer.trim(),
      detail: [question.explanation.trim(), question.evidence.trim()].filter(Boolean).join('\n'),
    })), left: '', right: '', columns: '', route: '', seed: 1, editedTasks: true,
  });
}

export function assertWorkbookSpace(academy: string, owner: string) {
  if (readWorksheetStore(studioKey(owner, academy)).copies.length >= 30) throw new Error('workbookStorageLimit');
}

export async function saveTeachingWorkbook(academy: string, owner: string, id: string, document: WorksheetDocument, unitId?: string) {
  if (unitId) {
    await saveTextbookWorksheet(unitId, id, document);
    return textbookWorksheetPath(unitId, undefined, id);
  }
  const key = studioKey(owner, academy);
  const store = readWorksheetStore(key);
  if (!store.copies.some(copy => copy.id === id)) {
    if (store.copies.length >= 30) throw new Error('workbookStorageLimit');
    const copy = { id, name: document.title, updatedAt: new Date().toISOString(), document };
    if (!writeWorksheetStore(key, { ...store, copies: [copy, ...store.copies] })) throw new Error('saveFailed');
  }
  return `/materials/worksheet?${new URLSearchParams({ copy: id })}`;
}

export async function saveTeachingLesson(academy: string, owner: string, id: string, name: string, level: string,
  playlist: LessonSlide[], wordListId: string | null) {
  await createCurriculumLesson({ id, academyId: academy, classId: null, name, wordListId, videoUrl: null, level, playlist, teacherId: owner });
}

import { supabase } from "../supabase";
import type { HomeworkBlock, HomeworkDraft } from "./blocks";
import { extractYoutubeId } from '../youtube';
import type { HwCard } from "./types";

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}
export const listDrafts = (classId: string) =>
  rpc<HomeworkDraft[]>("hw_drafts", { p_class: classId });
export const saveDraft = (classId: string, draft: HomeworkDraft) =>
  rpc<HomeworkDraft>("hw_save_draft", { p_class: classId, p_draft: draft });
export const assignDraft = (
  classId: string,
  draft: HomeworkDraft,
  studentIds: string[] | null,
  due: string,
  request: string,
) =>
  rpc<{ id: string; code: string }>("hw_assign_draft", {
    p_class: classId,
    p_draft: draft,
    p_students: studentIds,
    p_due: due ? new Date(due).toISOString() : null,
    p_request: request,
  });
export interface BlockResult {
  started: boolean;
  answered: number;
  attempt_id: string;
  item_id: string;
  student_id?: string;
  spelling_hints?: {
    allowed: import('./spellingHints').HintLevel;
    questions: { index:number; prompt:string; word:string|null; allowed:import('./spellingHints').HintLevel; used:import('./spellingHints').HintLevel; correct:boolean|null }[];
  } | null;
  guided_practice?: boolean | null;
  check_type?: string | null;
  check_misses?: HwCard[] | null;
  name: string;
  title: string;
  meta: {
    response?: string;
    recording?: string;
    hints?: number;
    listens?: number;
    review?: string;
    watched?: boolean;
  };
  finished: boolean;
  first_correct: number;
  final_correct: number;
  total: number;
  retries: number;
}
export const blockResults = (assignmentId: string) =>
  rpc<BlockResult[]>("hw_block_results", { p_assignment: assignmentId });

export type RecordingOriginal = { text: string; videoUrl: string; start: number; end: number };

export async function recordingOriginals(assignmentId: string): Promise<Record<string, RecordingOriginal>> {
  const { data, error } = await supabase.from('homework_items').select('id,config').eq('assignment_id', assignmentId);
  if (error) throw error;
  const originals: Record<string, RecordingOriginal> = {};
  for (const item of data ?? []) {
    const block = item.config?.block as HomeworkBlock | undefined;
    if (block?.type !== 'speak' || block.completion !== 'recording' || typeof block.videoUrl !== 'string' || !extractYoutubeId(block.videoUrl) ||
      !Number.isFinite(block.start) || !Number.isFinite(block.end) || block.start < 0 || block.end <= block.start) continue;
    originals[item.id] = { text:block.text, videoUrl:block.videoUrl, start:block.start, end:block.end };
  }
  return originals;
}
export const reviewBlock = (attempt: string, item: string) =>
  rpc("hw_review_block", { p_attempt: attempt, p_item: item });
export async function uploadRecording(
  token: string,
  itemId: string,
  blob: Blob,
  duration: number,
): Promise<string> {
  const form = new FormData();
  form.set("token", token);
  form.set("item", itemId);
  form.set("duration", String(duration));
  form.set("audio", blob, "recording");
  const { data, error } = await supabase.functions.invoke(
    "homework-recording",
    { body: form },
  );
  if (error || !data?.path) throw error || new Error("upload_failed");
  return data.path;
}
export async function recordingUrl(path: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke(
    "homework-recording",
    { body: { path } },
  );
  if (error || !data?.url) throw error || new Error("recording_unavailable");
  return data.url;
}

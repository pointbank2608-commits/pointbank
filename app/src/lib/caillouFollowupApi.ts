import { supabase } from './supabase';
import type { FollowupRow, StudentTransferAction, TeacherTransferApi, TransferState } from './caillouFollowup';

async function request<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return data as T;
}

export function teacherTransferApi(lessonId: string): TeacherTransferApi {
  return (action, assignmentId, plan) => request<FollowupRow[]>('caillou_followup_teacher', {
    p_lesson: lessonId, p_action: action, p_assignment: assignmentId ?? null,
    p_lesson_plan: plan?.lesson ?? null, p_homework_plan: plan?.homework ?? null,
  });
}

export async function listTransferHomework(token: string) {
  try {
    return await request<TransferState[]>('caillou_followup_student', { p_token: token });
  } catch (error) {
    // Allows the app and the optional pilot migration to be rolled out separately.
    if ((error as { code?: string }).code === 'PGRST202') return [];
    throw error;
  }
}

export function actOnTransferHomework(token: string, id: string, action: StudentTransferAction, answer?: string) {
  return request<TransferState>('caillou_followup_student', {
    p_token: token, p_assignment: id, p_action: action, p_value: answer ?? null,
  });
}

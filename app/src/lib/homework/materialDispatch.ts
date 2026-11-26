import { supabase } from '../supabase';
import { assignDraft } from './blockApi';
import type { HomeworkDraft } from './blocks';
import type { WmCard, WmAssignResult } from '../wordMemory/types';

export interface MaterialDispatch {
  classId: string;
  studentIds: string[];
  due: string;
  request: string;
  draft: HomeworkDraft | null;
  project: {
    request: string;
    title: string;
    cards: WmCard[];
    limit: number;
    source: { type: 'curriculum'; name: string; ranges: string[] };
  } | null;
}
export type DispatchResult = { assignment: { id: string; code: string } | null; project: WmAssignResult | null };

export async function dispatchMaterials(input: MaterialDispatch): Promise<DispatchResult> {
  const { classId, studentIds, due, request, draft, project } = input;
  if (!studentIds.length || (!draft && !project)) throw Error('empty_assignment');
  if (!project && draft) {
    return { assignment: await assignDraft(classId, draft, studentIds, due, request), project: null };
  }
  const { data, error } = await supabase.rpc('hw_assign_materials', {
    p_class: classId, p_students: studentIds, p_due: due || null,
    p_request: request, p_draft: draft, p_project: project,
  });
  if (error) throw error;
  return data as DispatchResult;
}

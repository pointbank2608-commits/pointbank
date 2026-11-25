import { supabase } from './supabase';

import type { ParentAccount } from './parentPortal';

export async function loadStudentContacts(student: string) {
  const { data, error } = await supabase.rpc('student_info_contacts', { p_student: student });
  if (error || !data) throw new Error('contact_load_failed');
  return data as { parent: ParentAccount | null; login_last4: string | null; can_reveal: boolean };
}

export async function revealParentPhone(student: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('parent_contact_reveal', { p_student: student });
  if (error) throw new Error('phone_load_failed');
  return data;
}

export interface StudentInfoInput {
  priceConsent?: { due: string; total: number };
  request: string;
  student: string | null;
  classId: string;
  name: string;
  loginPhone: string | null;
  loginConsent: boolean;
  parentName: string | null;
  parentPhone: string | null;
  parentConsent: boolean;
}

export async function saveStudentInfo(input: StudentInfoInput): Promise<string> {
  const consent = input.priceConsent;
  const { data, error } = await supabase.rpc(consent ? 'student_add_with_price' : 'student_save_info', {
    p_request: input.request, ...(consent ? { p_due: consent.due, p_total: consent.total } : { p_student: input.student }), p_class: input.classId, p_name: input.name.trim(),
    p_login_phone: input.loginPhone, p_login_consent: input.loginConsent,
    p_parent_name: input.parentName, p_parent_phone: input.parentPhone, p_parent_consent: input.parentConsent,
  });
  if (error) throw new Error(error.message);
  if (!data?.student_id) throw new Error('student_save_failed');
  return data.student_id as string;
}

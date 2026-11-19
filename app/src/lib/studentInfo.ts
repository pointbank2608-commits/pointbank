import { supabase } from './supabase';

export interface StudentInfoInput {
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
  const { data, error } = await supabase.rpc('student_save_info', {
    p_request: input.request, p_student: input.student, p_class: input.classId, p_name: input.name.trim(),
    p_login_phone: input.loginPhone, p_login_consent: input.loginConsent,
    p_parent_name: input.parentName, p_parent_phone: input.parentPhone, p_parent_consent: input.parentConsent,
  });
  if (error) throw new Error(error.message);
  if (!data?.student_id) throw new Error('student_save_failed');
  return data.student_id as string;
}

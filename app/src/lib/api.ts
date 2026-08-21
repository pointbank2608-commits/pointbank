import { supabase } from './supabase';
import type {
  Academy,
  ClassRow,
  GameItem,
  GameTemplate,
  Preset,
  RankRow,
  Settlement,
  Student,
  StudentBalance,
  SummaryRow,
  Transaction,
} from './types';

/** Supabase 응답에서 에러를 던지고 데이터만 돌려준다. */
function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/* ---------------- 반 ---------------- */

export async function fetchClasses(academyId: string): Promise<ClassRow[]> {
  return unwrap(
    await supabase
      .from('classes')
      .select('*')
      .eq('academy_id', academyId)
      .order('sort_order')
      .order('created_at'),
  );
}

export async function createClass(academyId: string, name: string, sortOrder: number) {
  return unwrap(
    await supabase
      .from('classes')
      .insert({ academy_id: academyId, name, sort_order: sortOrder })
      .select()
      .single(),
  ) as ClassRow;
}

export async function renameClass(classId: string, name: string) {
  const { error } = await supabase.from('classes').update({ name }).eq('id', classId);
  if (error) throw new Error(error.message);
}

export async function deleteClass(classId: string) {
  const { error } = await supabase.from('classes').delete().eq('id', classId);
  if (error) throw new Error(error.message);
}

/* ---------------- 학생 ---------------- */

export async function fetchStudentsOfClass(classId: string): Promise<Student[]> {
  return unwrap(
    await supabase.from('students').select('*').eq('class_id', classId).order('name'),
  );
}

export async function createStudent(academyId: string, classId: string, name: string) {
  return unwrap(
    await supabase
      .from('students')
      .insert({ academy_id: academyId, class_id: classId, name })
      .select()
      .single(),
  ) as Student;
}

export async function renameStudent(studentId: string, name: string) {
  const { error } = await supabase.from('students').update({ name }).eq('id', studentId);
  if (error) throw new Error(error.message);
}

export async function deleteStudent(studentId: string) {
  const { error } = await supabase.from('students').delete().eq('id', studentId);
  if (error) throw new Error(error.message);
}

/* ---------------- 잔액 ---------------- */

export async function fetchBalancesOfClass(classId: string): Promise<StudentBalance[]> {
  return unwrap(
    await supabase.from('student_balances').select('*').eq('class_id', classId).order('name'),
  );
}

export async function fetchMyBalance(studentId: string): Promise<StudentBalance | null> {
  const { data, error } = await supabase
    .from('student_balances')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as StudentBalance | null;
}

/* ---------------- 거래 원장 ---------------- */

export async function fetchTransactions(studentId: string, limit = 50): Promise<Transaction[]> {
  return unwrap(
    await supabase
      .from('transactions')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(limit),
  );
}

export async function givePoints(params: {
  academyId: string;
  classId: string;
  studentId: string;
  delta: number;
  reason: string;
  teacherId: string;
  teacherName: string;
}): Promise<Transaction> {
  return unwrap(
    await supabase
      .from('transactions')
      .insert({
        academy_id: params.academyId,
        class_id: params.classId,
        student_id: params.studentId,
        delta: params.delta,
        reason: params.reason,
        created_by: params.teacherId,
        created_by_name: params.teacherName,
      })
      .select()
      .single(),
  ) as Transaction;
}

export async function deleteTransaction(txId: string) {
  const { error } = await supabase.from('transactions').delete().eq('id', txId);
  if (error) throw new Error(error.message);
}

/** 특정 반의 "오늘" 거래 전부. 카드별 오늘 적립액과 오늘 내역을 한 번에 채운다. */
export async function fetchTransactionsSince(
  classId: string,
  since: Date,
): Promise<Transaction[]> {
  return unwrap(
    await supabase
      .from('transactions')
      .select('*')
      .eq('class_id', classId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false }),
  );
}

/* ---------------- 일일 마감 ---------------- */

export async function fetchSettlement(
  classId: string,
  settledOn: string,
): Promise<Settlement | null> {
  const { data, error } = await supabase
    .from('settlements')
    .select('*')
    .eq('class_id', classId)
    .eq('settled_on', settledOn)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Settlement | null;
}

export async function createSettlement(params: {
  academyId: string;
  classId: string;
  settledOn: string;
  teacherId: string;
  teacherName: string;
  totalDelta: number;
  studentCount: number;
}): Promise<Settlement> {
  return unwrap(
    await supabase
      .from('settlements')
      .insert({
        academy_id: params.academyId,
        class_id: params.classId,
        settled_on: params.settledOn,
        settled_by: params.teacherId,
        settled_by_name: params.teacherName,
        total_delta: params.totalDelta,
        student_count: params.studentCount,
      })
      .select()
      .single(),
  ) as Settlement;
}

export async function deleteSettlement(id: string) {
  const { error } = await supabase.from('settlements').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/* ---------------- 프리셋 ---------------- */

export async function fetchPresets(academyId: string): Promise<Preset[]> {
  return unwrap(
    await supabase
      .from('presets')
      .select('*')
      .eq('academy_id', academyId)
      .order('sort_order')
      .order('created_at'),
  );
}

export async function createPreset(
  academyId: string,
  label: string,
  delta: number,
  sortOrder: number,
) {
  return unwrap(
    await supabase
      .from('presets')
      .insert({ academy_id: academyId, label, delta, sort_order: sortOrder })
      .select()
      .single(),
  ) as Preset;
}

export async function deletePreset(presetId: string) {
  const { error } = await supabase.from('presets').delete().eq('id', presetId);
  if (error) throw new Error(error.message);
}

/* ---------------- 학원 설정 ---------------- */

export async function updateAcademy(
  academyId: string,
  patch: Partial<Pick<Academy, 'name' | 'point_unit' | 'logo_url'>>,
) {
  const { error } = await supabase.from('academies').update(patch).eq('id', academyId);
  if (error) throw new Error(error.message);
}

export async function rotateInviteCode(): Promise<string> {
  const { data, error } = await supabase.rpc('rotate_invite_code');
  if (error) throw new Error(error.message);
  return data as string;
}

/** 학원 로고를 올리고 academies.logo_url 을 갱신한 뒤 새 URL을 돌려준다. */
export async function uploadAcademyLogo(academyId: string, image: Blob): Promise<string> {
  const path = `${academyId}/logo.png`;

  const { error: uploadError } = await supabase.storage
    .from('logos')
    .upload(path, image, { upsert: true, contentType: 'image/png', cacheControl: '3600' });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from('logos').getPublicUrl(path);
  // 같은 경로를 덮어쓰므로, 캐시 무효화를 위해 버전 쿼리를 붙여서 저장한다.
  const url = `${data.publicUrl}?v=${Date.now()}`;

  await updateAcademy(academyId, { logo_url: url });
  return url;
}

export async function removeAcademyLogo(academyId: string): Promise<void> {
  await supabase.storage.from('logos').remove([`${academyId}/logo.png`]);
  await updateAcademy(academyId, { logo_url: null });
}

/* ---------------- 순위 ---------------- */

export async function fetchClassRanking(classId: string): Promise<RankRow[]> {
  const { data, error } = await supabase.rpc('class_ranking', { p_class_id: classId });
  if (error) throw new Error(error.message);
  return (data ?? []) as RankRow[];
}

export async function fetchAcademyRanking(): Promise<RankRow[]> {
  const { data, error } = await supabase.rpc('academy_ranking');
  if (error) throw new Error(error.message);
  return (data ?? []) as RankRow[];
}

/**
 * 결과 보기용 집계.
 * classId 가 null 이면 학원 전체, since 가 null 이면 전체 기간.
 */
export async function fetchRankingSummary(
  classId: string | null,
  since: Date | null,
): Promise<SummaryRow[]> {
  const { data, error } = await supabase.rpc('ranking_summary', {
    p_class_id: classId,
    p_since: since ? since.toISOString() : null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as SummaryRow[];
}

/* ---------------- 온보딩 ---------------- */

export async function createAcademy(name: string, pointUnit: string, displayName: string) {
  const { data, error } = await supabase.rpc('create_academy', {
    p_name: name,
    p_point_unit: pointUnit,
    p_display_name: displayName,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function joinAsTeacher(inviteCode: string, displayName: string) {
  const { data, error } = await supabase.rpc('join_academy_as_teacher', {
    p_invite_code: inviteCode,
    p_display_name: displayName,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function claimStudent(claimCode: string) {
  const { data, error } = await supabase.rpc('claim_student', { p_claim_code: claimCode });
  if (error) throw new Error(error.message);
  return data as string;
}

/* ---------------- 미니게임 ---------------- */

/**
 * 특정 반에서 보이는 게임 템플릿 전부.
 * class_id 가 이 반이거나(반 전용), null 이면(학원 공용) 함께 돌려준다.
 */
export async function fetchGameTemplates(
  academyId: string,
  classId: string,
  gameType: string,
): Promise<GameTemplate[]> {
  return unwrap(
    await supabase
      .from('game_templates')
      .select('*')
      .eq('academy_id', academyId)
      .eq('game_type', gameType)
      .or(`class_id.eq.${classId},class_id.is.null`)
      .order('created_at'),
  );
}

export async function createGameTemplate(params: {
  academyId: string;
  classId: string | null;
  gameType: string;
  name: string;
  items: GameItem[];
  teacherId: string;
}): Promise<GameTemplate> {
  return unwrap(
    await supabase
      .from('game_templates')
      .insert({
        academy_id: params.academyId,
        class_id: params.classId,
        game_type: params.gameType,
        name: params.name,
        items: params.items,
        created_by: params.teacherId,
      })
      .select()
      .single(),
  ) as GameTemplate;
}

export async function updateGameTemplateItems(id: string, items: GameItem[]) {
  const { error } = await supabase
    .from('game_templates')
    .update({ items, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function renameGameTemplate(id: string, name: string) {
  const { error } = await supabase
    .from('game_templates')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteGameTemplate(id: string) {
  const { error } = await supabase.from('game_templates').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** 로그인한 학생 본인의 students 행 */
export async function fetchMyStudentRow(userId: string): Promise<Student | null> {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Student | null;
}

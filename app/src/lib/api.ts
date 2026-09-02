import { supabase } from './supabase';
import type {
  Academy,
  AdminAcademyRow,
  Attendance,
  ClassRow,
  GameItem,
  GameTemplate,
  GameTemplateConfig,
  Preset,
  RankRow,
  Settlement,
  Student,
  StudentBalance,
  SummaryRow,
  Transaction,
  WordBankEntry,
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

export async function fetchStudentsOfAcademy(academyId: string): Promise<Student[]> {
  return unwrap(
    await supabase.from('students').select('*').eq('academy_id', academyId).order('name'),
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

export async function fetchStudentById(studentId: string): Promise<Student | null> {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Student | null;
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
  isHomework?: boolean;
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
        is_homework: params.isHomework ?? false,
      })
      .select()
      .single(),
  ) as Transaction;
}

export async function deleteTransaction(txId: string) {
  const { error } = await supabase.from('transactions').delete().eq('id', txId);
  if (error) throw new Error(error.message);
}

/** 숙제 캘린더용: 특정 학생의 특정 기간(from~to, 둘 다 YYYY-MM-DD, inclusive) 숙제 관련 거래만. */
export async function fetchHomeworkTransactions(
  studentId: string,
  from: string,
  to: string,
): Promise<Transaction[]> {
  return unwrap(
    await supabase
      .from('transactions')
      .select('*')
      .eq('student_id', studentId)
      .eq('is_homework', true)
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .order('created_at'),
  );
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

/** 학원 전체의 특정 시각 이후 거래. 선생님 대시보드 오늘 요약용. */
export async function fetchAcademyTransactionsSince(
  academyId: string,
  since: Date,
): Promise<Transaction[]> {
  return unwrap(
    await supabase
      .from('transactions')
      .select('*')
      .eq('academy_id', academyId)
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
  isHomework = false,
) {
  return unwrap(
    await supabase
      .from('presets')
      .insert({ academy_id: academyId, label, delta, sort_order: sortOrder, is_homework: isHomework })
      .select()
      .single(),
  ) as Preset;
}

export async function updatePresetHomeworkFlag(presetId: string, isHomework: boolean) {
  const { error } = await supabase
    .from('presets')
    .update({ is_homework: isHomework })
    .eq('id', presetId);
  if (error) throw new Error(error.message);
}

export async function deletePreset(presetId: string) {
  const { error } = await supabase.from('presets').delete().eq('id', presetId);
  if (error) throw new Error(error.message);
}

/* ---------------- 내 프로필 ---------------- */

export async function updateMyDisplayName(displayName: string) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('로그인이 필요합니다.');
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', userId);
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
  const options = { contentType: 'image/png', cacheControl: '3600' } as const;

  // upsert 는 SELECT+INSERT 를 한 번에 써서, SELECT 정책이 없으면 RLS 에 걸린다.
  // 먼저 올리고, 이미 있으면 교체한다.
  const uploaded = await supabase.storage.from('logos').upload(path, image, options);
  if (uploaded.error) {
    const replaced = await supabase.storage.from('logos').update(path, image, options);
    if (replaced.error) throw new Error(replaced.error.message);
  }

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
  config?: GameTemplateConfig;
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
        config: params.config ?? {},
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

export async function updateGameTemplate(
  id: string,
  patch: { items?: GameItem[]; config?: GameTemplateConfig },
) {
  const { error } = await supabase
    .from('game_templates')
    .update({ ...patch, updated_at: new Date().toISOString() })
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

export async function fetchGameTemplateById(id: string): Promise<GameTemplate> {
  return unwrap(await supabase.from('game_templates').select('*').eq('id', id).single()) as GameTemplate;
}

/**
 * 이 반의 "라이브러리" — 이 반(또는 학원 공용)에 실제 템플릿이 있는 게임 종류 목록.
 * 별도 설정 없이 "템플릿이 있으면 라이브러리에 있는 것"으로 자동 도출한다.
 */
export async function fetchClassLibraryTypes(academyId: string, classId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('game_templates')
    .select('game_type')
    .eq('academy_id', academyId)
    .or(`class_id.eq.${classId},class_id.is.null`);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { game_type: string }[];
  return Array.from(new Set(rows.map((r) => r.game_type)));
}

export interface ImportCandidate {
  templateId: string;
  templateName: string;
  classId: string;
  className: string;
  itemCount: number;
}

/** 다른 반(현재 반 제외)에 있는, 같은 게임 종류의 반 전용 템플릿 목록 — "다른 반에서 가져오기" 후보. */
export async function fetchImportCandidates(
  academyId: string,
  gameType: string,
  excludeClassId: string,
): Promise<ImportCandidate[]> {
  const [templatesRes, classesRes] = await Promise.all([
    supabase
      .from('game_templates')
      .select('id, name, items, class_id')
      .eq('academy_id', academyId)
      .eq('game_type', gameType)
      .not('class_id', 'is', null)
      .neq('class_id', excludeClassId)
      .order('created_at'),
    supabase.from('classes').select('id, name').eq('academy_id', academyId),
  ]);
  if (templatesRes.error) throw new Error(templatesRes.error.message);
  if (classesRes.error) throw new Error(classesRes.error.message);
  const classNameById = new Map(
    ((classesRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
  );
  return (
    (templatesRes.data ?? []) as { id: string; name: string; items: GameItem[] | null; class_id: string }[]
  ).map((row) => ({
    templateId: row.id,
    templateName: row.name,
    classId: row.class_id,
    className: classNameById.get(row.class_id) ?? '',
    itemCount: Array.isArray(row.items) ? row.items.length : 0,
  }));
}

/* ---------------- 게임 배경음악 업로드 (학원별 보관함) ---------------- */

export interface GameAudioFile {
  path: string;
  name: string;
  url: string;
}

export async function listGameAudio(academyId: string): Promise<GameAudioFile[]> {
  const { data, error } = await supabase.storage.from('game-audio').list(academyId, {
    sortBy: { column: 'created_at', order: 'desc' },
  });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((f) => f.name !== '.emptyFolderPlaceholder')
    .map((f) => {
      const path = `${academyId}/${f.name}`;
      const { data: pub } = supabase.storage.from('game-audio').getPublicUrl(path);
      return { path, name: f.name, url: pub.publicUrl };
    });
}

export async function uploadGameAudio(academyId: string, file: File): Promise<GameAudioFile> {
  const ext = file.name.split('.').pop() ?? 'mp3';
  const path = `${academyId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('game-audio').upload(path, file);
  if (error) throw new Error(error.message);
  const { data: pub } = supabase.storage.from('game-audio').getPublicUrl(path);
  return { path, name: file.name, url: pub.publicUrl };
}

export async function deleteGameAudio(path: string) {
  const { error } = await supabase.storage.from('game-audio').remove([path]);
  if (error) throw new Error(error.message);
}

/* ---------------- 게임 이미지 업로드 (다이어그램 배경·이미지 퀴즈 사진) ---------------- */

export interface GameImageFile {
  path: string;
  name: string;
  url: string;
}

export async function uploadGameImage(academyId: string, file: File): Promise<GameImageFile> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${academyId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('game-images').upload(path, file);
  if (error) throw new Error(error.message);
  const { data: pub } = supabase.storage.from('game-images').getPublicUrl(path);
  return { path, name: file.name, url: pub.publicUrl };
}

export async function deleteGameImage(path: string) {
  const { error } = await supabase.storage.from('game-images').remove([path]);
  if (error) throw new Error(error.message);
}

/* ---------------- 출석부 ---------------- */

/** 특정 반의 특정 기간(from~to, 둘 다 YYYY-MM-DD, inclusive) 출석 기록 전체. */
export async function fetchAttendance(
  classId: string,
  from: string,
  to: string,
): Promise<Attendance[]> {
  return unwrap(
    await supabase
      .from('attendance')
      .select('*')
      .eq('class_id', classId)
      .gte('attended_on', from)
      .lte('attended_on', to),
  );
}

/** 학원 전체의 하루 출석. 선생님 대시보드 등원 수 요약용. */
export async function fetchAcademyAttendanceOn(
  academyId: string,
  day: string,
): Promise<Attendance[]> {
  return unwrap(
    await supabase
      .from('attendance')
      .select('*')
      .eq('academy_id', academyId)
      .eq('attended_on', day),
  );
}

export async function checkIn(params: {
  academyId: string;
  classId: string;
  studentId: string;
  attendedOn: string;
  teacherId: string;
}): Promise<Attendance> {
  return unwrap(
    await supabase
      .from('attendance')
      .upsert(
        {
          academy_id: params.academyId,
          class_id: params.classId,
          student_id: params.studentId,
          attended_on: params.attendedOn,
          checked_in_at: new Date().toISOString(),
          checked_in_by: params.teacherId,
        },
        { onConflict: 'student_id,attended_on' },
      )
      .select()
      .single(),
  ) as Attendance;
}

export async function checkOut(params: {
  academyId: string;
  classId: string;
  studentId: string;
  attendedOn: string;
  teacherId: string;
}): Promise<Attendance> {
  return unwrap(
    await supabase
      .from('attendance')
      .upsert(
        {
          academy_id: params.academyId,
          class_id: params.classId,
          student_id: params.studentId,
          attended_on: params.attendedOn,
          checked_out_at: new Date().toISOString(),
          checked_out_by: params.teacherId,
        },
        { onConflict: 'student_id,attended_on' },
      )
      .select()
      .single(),
  ) as Attendance;
}

/** 등원/하원 기록을 지운다 (해당 필드만 null 처리). */
export async function clearCheckIn(id: string) {
  const { error } = await supabase
    .from('attendance')
    .update({ checked_in_at: null, checked_in_by: null })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function clearCheckOut(id: string) {
  const { error } = await supabase
    .from('attendance')
    .update({ checked_out_at: null, checked_out_by: null })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** 출석부 그리드에서 빈 칸을 눌러 "출석"으로 표시할 때 사용 (시간은 정오로 고정). */
export async function markPresent(params: {
  academyId: string;
  classId: string;
  studentId: string;
  attendedOn: string;
  teacherId: string;
}): Promise<Attendance> {
  return unwrap(
    await supabase
      .from('attendance')
      .upsert(
        {
          academy_id: params.academyId,
          class_id: params.classId,
          student_id: params.studentId,
          attended_on: params.attendedOn,
          checked_in_at: `${params.attendedOn}T12:00:00`,
          checked_in_by: params.teacherId,
        },
        { onConflict: 'student_id,attended_on' },
      )
      .select()
      .single(),
  ) as Attendance;
}

export async function deleteAttendance(id: string) {
  const { error } = await supabase.from('attendance').delete().eq('id', id);
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

/* ---------------- 플랫폼 관리자 ---------------- */

export async function claimAdmin(): Promise<void> {
  const { error } = await supabase.rpc('claim_admin');
  if (error) throw new Error(error.message);
}

export async function fetchAdminAcademies(): Promise<AdminAcademyRow[]> {
  const { data, error } = await supabase.rpc('admin_list_academies');
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminAcademyRow[];
}

export async function deleteAcademyAsAdmin(academyId: string) {
  const { error } = await supabase.from('academies').delete().eq('id', academyId);
  if (error) throw new Error(error.message);
}

/** 로그인한 본인의 비밀번호를 바꾼다. 현재 비밀번호는 필요 없다 —
 * 이미 유효한 세션으로 로그인돼 있어야 호출 가능한 API. */
export async function changeMyPassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

/* ---------------- 단어장 ---------------- */

/** 교육부 지정 초등 필수 영단어 800(학원 구분 없는 공용 사전) 전체를 한 번에 불러온다.
 * 812행(뜻이 2개 이상인 단어는 행이 나뉨) 정도라 페이지네이션 없이 전부 가져와 화면에서 검색/필터한다. */
export async function fetchWordBank(): Promise<WordBankEntry[]> {
  return unwrap(await supabase.from('word_bank').select('*').order('sort_order').order('sense_number'));
}

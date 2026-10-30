/**
 * 학생별 맞춤 숙제 만들기·보내기(마법사용) — 맞춤 칸(slots.ts)이 든 활동 목록을 학생마다 채워 학생별 숙제로 보낸다.
 * 블록 편집기에도 같은 흐름이 있다(HomeworkBlockEditor). 재료는 단어장이 아니라 카드 목록(pool)을 직접 받는다.
 */
import { createHomework, fetchReviewCandidates } from '../homework';
import { enrichCards, loadWordBank } from '../wordBankCache';
import type { FullCardItem, Student } from '../types';
import type { BuildLabels } from './build';
import { recommendForStudent, type RecReason } from './recommend';
import { expandSlots } from './slots';
import { fetchClassWrongCards } from './teacherHelpers';
import type { HwItemDraft } from './types';

export interface PersonalPlan {
  student: Student;
  items: HwItemDraft[];
  empty: number;
  reasons: RecReason[];
  personal: boolean;
  rule: string;
}

export async function buildPersonalPlans(a: { items: HwItemDraft[]; students: Student[]; pool: FullCardItem[]; classId: string; labels: BuildLabels }): Promise<PersonalPlan[]> {
  const bank = await loadWordBank().catch(() => []);
  const pool = enrichCards(a.pool, bank);
  const common = await fetchClassWrongCards(a.classId).catch(() => []);
  const out: PersonalPlan[] = [];
  for (const s of a.students) {
    const rec = recommendForStudent(await fetchReviewCandidates(s.id), pool, common, a.labels);
    const r = expandSlots(a.items, rec, pool);
    out.push({ student: s, items: r.items, empty: r.empty, reasons: rec.reasons, personal: rec.personal, rule: rec.ruleVersion });
  }
  return out;
}

export interface PersonalSendState {
  group: string;
  requests: Map<string, string>;
  done: Set<string>;
}
export const newPersonalSendState = (): PersonalSendState => ({ group: crypto.randomUUID(), requests: new Map(), done: new Set() });

/** 아직 못 보낸 학생만 차례로 보낸다. 하나라도 실패하면 던진다(다시 부르면 남은 학생만 보낸다). 처음 만든 숙제를 돌려준다 */
export async function sendPersonalPlans(a: { plans: PersonalPlan[]; classId: string; title: string; due: string; templateId: string; state: PersonalSendState }): Promise<{ id: string; code: string } | null> {
  let first: { id: string; code: string } | null = null;
  for (const p of a.plans) {
    if (a.state.done.has(p.student.id) || !p.items.length) continue;
    const key = p.student.id + JSON.stringify(p.items).length;
    if (!a.state.requests.has(key)) a.state.requests.set(key, crypto.randomUUID());
    const made = await createHomework({
      requestId: a.state.requests.get(key),
      classId: a.classId,
      title: `${a.title} · ${p.student.name}`,
      items: p.items,
      studentIds: [p.student.id],
      dueAt: a.due ? new Date(a.due).toISOString() : null,
      kind: 'custom',
      groupId: a.state.group,
      recommendation: { rule_version: p.rule, personal: p.personal, reasons: p.reasons, template: a.templateId, slots: true },
    });
    a.state.done.add(p.student.id);
    first ??= made;
  }
  return first;
}

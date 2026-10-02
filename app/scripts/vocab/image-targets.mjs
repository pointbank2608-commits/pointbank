// 이미지가 필요한 새 단어 목록(시범 + 확장 배치). 숙어·표현은 그림 없이 쓴다.
import { NEW_ROWS as PILOT_ROWS } from './pilot-new-words.mjs';
import { BATCH_A } from './batch-a.mjs';
import { BATCH_B } from './batch-b.mjs';
import { BATCH_C } from './batch-c.mjs';
import { BATCH_D } from './batch-d.mjs';
import { BATCH_E } from './batch-e.mjs';
import { MOE_ELEM } from './batch-moe-elem.mjs';
import { MOE_MID_1 } from './batch-moe-mid-1.mjs';
import { MOE_MID_2 } from './batch-moe-mid-2.mjs';
import { MOE_MID_3 } from './batch-moe-mid-3.mjs';
import { MOE_HIGH_1 } from './batch-moe-high-1.mjs';
import { MOE_HIGH_2 } from './batch-moe-high-2.mjs';
import { MOE_HIGH_3 } from './batch-moe-high-3.mjs';

export const slug = (word) => word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function collect(groups, batch) {
  const merged = {};
  for (const g of groups) for (const [cat, list] of Object.entries(g)) merged[cat] = [...(merged[cat] ?? []), ...list];
  const out = [];
  for (const [key, list] of Object.entries(merged)) {
    for (const [word, pos, meaning, example, level, subcategory, opt = {}] of list) {
      out.push({ batch, category: opt.category ?? key, id: opt.id ?? slug(word), word, pos, meaning, example, level, subcategory });
    }
  }
  return out;
}

export const PILOT_TARGETS = collect([PILOT_ROWS], 'pilot');
export const BATCH2_TARGETS = collect([BATCH_A, BATCH_B, BATCH_C, BATCH_D], 'batch2'); // BATCH_E(숙어·표현)는 그림 없음
export const ALL_TARGETS = [...PILOT_TARGETS, ...BATCH2_TARGETS].filter((r) => r.pos !== '숙어' && r.pos !== '표현');

// 교육부 확장 1차(초등 빠진 95개) — 그림 없음(none)으로 정한 단어는 빼고. 안내서는 CURSOR_IMAGE_HANDOFF_MOE.md(build-moe-elem.mjs).
export const MOE_TARGETS = MOE_ELEM.filter((r) => r[7] !== 'none').map(([word, pos, meaning, example, level, category, subcategory, kind]) => ({
  batch: 'moe-elem', category, id: slug(word), word, pos, meaning, example, level, subcategory, kind,
}));

// ── 그림 자리 전부 채우기(2026-10-02 사용자 결정: 비어 있는 자리는 추상어·숙어까지 모두 커서가 그린다) ──
// 안내서는 CURSOR_IMAGE_HANDOFF_FILL_ALL.md(build-image-fill-all.mjs). scene 이 비어 있으면 "참고 문장을 한 장면으로".
const moeRow = (batch) => ([word, pos, meaning, example, level, category, subcategory, kind, scene]) => ({
  batch, category, id: slug(word), word, pos, meaning, example, level, subcategory, kind, scene: scene || '',
});
export const MOE_ELEM_NONE_TARGETS = MOE_ELEM.filter((r) => r[7] === 'none').map(moeRow('moe-elem'));
export const MOE_MID_TARGETS = [...MOE_MID_1, ...MOE_MID_2, ...MOE_MID_3].map(moeRow('moe-mid'));
export const MOE_HIGH_TARGETS = [...MOE_HIGH_1, ...MOE_HIGH_2, ...MOE_HIGH_3].map(moeRow('moe-high'));
export const IDIOM_TARGETS = [...PILOT_TARGETS, ...BATCH2_TARGETS, ...collect([BATCH_E], 'batch2')]
  .filter((r) => r.pos === '숙어' || r.pos === '표현')
  .map((r) => ({ ...r, kind: 'scene', scene: '' }));
export const FILL_TARGETS = [...MOE_ELEM_NONE_TARGETS, ...IDIOM_TARGETS, ...MOE_MID_TARGETS, ...MOE_HIGH_TARGETS];

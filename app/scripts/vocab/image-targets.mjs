// 이미지가 필요한 새 단어 목록(시범 + 확장 배치). 숙어·표현은 그림 없이 쓴다.
import { NEW_ROWS as PILOT_ROWS } from './pilot-new-words.mjs';
import { BATCH_A } from './batch-a.mjs';
import { BATCH_B } from './batch-b.mjs';
import { BATCH_C } from './batch-c.mjs';
import { BATCH_D } from './batch-d.mjs';

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

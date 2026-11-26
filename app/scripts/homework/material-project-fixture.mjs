import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sqlRoot } from './block-fixture.mjs';

export async function installMaterialProjects(db) {
  const memory = readdirSync(sqlRoot).filter(name => /^(090[a-m]|096[a-h])_wm_/.test(name)).sort();
  for (const name of [...memory, '094a_watch_block_validate.sql','103_word_projects.sql','104_word_project_adaptive_pace.sql','153_material_homework_dispatch.sql','156_material_homework_card_limits.sql']) {
    await db.exec(readFileSync(resolve(sqlRoot,name),'utf8'));
  }
}

export async function curriculumFixture(db) {
  for (const name of ['012_word_bank.sql','020_word_bank_levels.sql','022_word_bank_pilot.sql','033_word_bank_moe_elementary.sql','036_word_bank_moe_middle.sql']) {
    await db.exec(readFileSync(resolve(sqlRoot,name),'utf8'));
  }
  // A bounded sample from two genuine curriculum levels keeps the browser fixture small.
  return (await db.query(`select * from (
    select b.*,row_number() over(partition by level order by sort_order) as n
    from word_bank b where level in (1,5)
  ) ranked where n <= 80 order by level,n`)).rows;
}

import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const SUPABASE_DIR = join(here, '..', '..', '..', 'supabase');

/** 새 임시 DB 를 만들고 하네스 스키마 + 주어진 마이그레이션 파일(supabase/ 기준)을 순서대로 적용한다. */
export async function makeDb(files) {
  const db = new PGlite();
  await db.exec(readFileSync(join(here, 'harness_schema.sql'), 'utf8'));
  for (const f of files) {
    try {
      await db.exec(readFileSync(join(SUPABASE_DIR, f), 'utf8'));
    } catch (e) {
      throw new Error(`${f}: ${e.message}`);
    }
  }
  return db;
}

export const as = async (db, uid) => db.exec(`select set_config('test.uid', '${uid ?? ''}', false)`);

let passed = 0;
let failed = 0;
export function check(name, cond, extra = '') {
  if (cond) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name} ${extra}`);
  }
}
export const summary = () => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
};

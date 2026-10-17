// supabase/086_check.sql 이 임시 DB 에서 문법 오류 없이 돌고, 마이그레이션 적용 후 모든 줄이 true 인지 확인한다.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeDb, check, summary, SUPABASE_DIR } from './lib.mjs';
import { ALL_FILES } from './files.mjs';

const db = await makeDb(ALL_FILES);
const sql = readFileSync(join(SUPABASE_DIR, '086_check.sql'), 'utf8');
const stmts = sql.split(/;\s*\n/).map((s) => s.trim()).filter((s) => s && !/^--[^\n]*$/.test(s));
const rows = (await db.query(stmts[0])).rows;
for (const r of rows) check(r.item, r.ok === true);
check('정보 조회가 돈다', (await db.query(stmts[1])).rows.length === 1);
summary();

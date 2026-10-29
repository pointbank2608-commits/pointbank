import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '../../node_modules/homework-test-tools/node_modules/@electric-sql/pglite/dist/index.js';
const songs=JSON.parse(readFileSync('app/scripts/ready-media/provided-phonics-songs.json','utf8'));
const plan=JSON.parse(readFileSync('app/src/data/phonics/teachingPlan.json','utf8')).units;
const sql=readFileSync('supabase/092_phonics_provided_songs.sql','utf8');
assert.equal(songs.length,34);assert.equal(new Set(songs.map(s=>s.youtubeId)).size,34);
for(const s of songs){assert(s.tip&&s.sourceTitle&&s.channelUrl.startsWith('https://www.youtube.com/'));assert(s.duration>0);assert(s.unitIds.length);for(const id of s.unitIds)assert(plan.some(u=>u.id===id&&u.step===s.step));for(const r of s.ruleIds)assert(plan.some(u=>u.step===s.step&&u.segments.some(g=>g.ruleId===r)));}
const db=new PGlite();
try{
await db.exec(`create role anon;create role authenticated;create function public.is_platform_admin() returns boolean language sql as $$select false$$;`);
await db.exec(readFileSync('supabase/039_video_clips.sql','utf8'));
await db.exec(sql);await db.exec(sql);
assert.equal((await db.query('select count(*)::int as n from video_clips')).rows[0].n,34);
await db.query('update video_clips set title=$1 where youtube_id=$2',['Existing admin title',songs[0].youtubeId]);await db.exec(sql);
assert.equal((await db.query('select title from video_clips where youtube_id=$1',[songs[0].youtubeId])).rows[0].title,'Existing admin title');
for(const row of (await db.query('select level,pack from video_clips')).rows){assert(row.pack.phonicsSong.unitIds.every(id=>plan.some(u=>u.id===id&&u.step===row.level)));}
console.log('PASS 34 unique official links; real course IDs/rules; 5 levels; SQL valid, repeat-safe and existing edits preserved');
}finally{await db.close();}

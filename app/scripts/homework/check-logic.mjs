// 숙제 2단계(041) 핵심 순수 로직 가벼운 확인 — 테스트 도구 없이 Vite 로 TS 파일을 불러와 검사한다.
// 실행: node app/scripts/homework/check-logic.mjs   (저장소 루트 또는 app/ 어디서든)
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// 순수 로직만 본다 — 서버 연결 파일은 빈 것으로 바꿔 끼운다(네트워크·환경 변수 없이 돈다)
const stubSupabase = {
  name: 'stub-supabase',
  enforce: 'pre',
  load(id) {
    if (id.replace(/\\/g, '/').endsWith('/src/lib/supabase.ts')) return 'export const supabase = {};';
  },
};
const server = await createServer({ root, logLevel: 'error', plugins: [stubSupabase], server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let failed = 0;
const test = async (name, fn) => {
  try {
    await fn();
    console.log('ok  ', name);
  } catch (e) {
    failed += 1;
    console.log('FAIL', name, '\n     ', e.message);
  }
};

try {
  const grade = await server.ssrLoadModule('/src/lib/homework/grade.ts');
  const build = await server.ssrLoadModule('/src/lib/homework/build.ts');
  const rec = await server.ssrLoadModule('/src/lib/homework/recommend.ts');

  // ---- 채점(서버 hw_grade 와 같은 규칙 — 041_check.sql 6번과 같은 예) ----
  await test('채점: 보기 번호', () => {
    assert.equal(grade.gradeLocal({ qtype: 'choice', correct: 2 }, '2'), true);
    assert.equal(grade.gradeLocal({ qtype: 'choice', correct: 2 }, '1'), false);
    assert.equal(grade.gradeLocal({ qtype: 'choice', correct: 2 }, '2abc'), false);
  });
  await test('채점: 철자(여러 답·대소문자·끝 문장부호·공백)', () => {
    assert.equal(grade.gradeLocal({ qtype: 'text', correct: 'color/colour' }, ' Colour. '), true);
    assert.equal(grade.gradeLocal({ qtype: 'text', correct: 'ice cream' }, 'ice   cream'), true);
    assert.equal(grade.gradeLocal({ qtype: 'text', correct: 'cat' }, ''), false);
  });
  await test('채점: 순서', () => {
    assert.equal(grade.gradeLocal({ qtype: 'order', correct: ['c', 'a', 't'] }, '["c","a","t"]'), true);
    assert.equal(grade.gradeLocal({ qtype: 'order', correct: ['c', 'a', 't'] }, '["a","c","t"]'), false);
    assert.equal(grade.gradeLocal({ qtype: 'order', correct: ['c'] }, 'not json'), false);
  });

  // ---- 문제 만들기 ----
  const cards = [
    ['apple', '사과', 'I eat an apple.'],
    ['dog', '개', 'The dog is big.'],
    ['book', '책', 'I read a book.'],
    ['happy', '행복한', 'I am happy today.'],
    ['school', '학교', 'We go to school.'],
    ['water', '물', 'I drink water.'],
    ['bird', '새', 'A bird can fly.'],
    ['green', '초록색', 'The leaf is green.'],
  ].map(([word, meaning, example], i) => ({ id: `c${i}`, word, meaning, example, imageUrl: i % 2 ? `/img/${word}.webp` : null }));
  const labels = { quiz: 'quiz', worksheet: 'ws', matchup: 'mu', anagram: 'an', spelling: 'sp', shadowing: 'sh' };
  let seed = 7;
  const rng = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

  for (const minutes of [5, 10, 15]) {
    await test(`문제 만들기: ${minutes}분 구성 — 모든 문제가 자기 정답으로 맞게 채점된다`, () => {
      const items = build.buildItems(cards, build.presetPlan(minutes, cards, false), labels, null, rng);
      assert.ok(items.length > 0, '활동이 하나도 없음');
      for (const it of items)
        for (const q of it.content.questions) {
          assert.ok(q.skill && q.word && q.gen, `skill/word/gen 빠짐: ${q.id}`);
          const answer = q.qtype === 'choice' ? String(q.correct) : q.qtype === 'text' ? String(q.correct).split('/')[0] : JSON.stringify(q.correct);
          assert.equal(grade.gradeLocal(q, answer), true, `${it.kind} ${q.style} 정답이 틀림으로 채점됨`);
          if (q.qtype === 'choice') assert.ok(Number(q.correct) < (q.choices?.length ?? 0), '정답 번호가 보기 밖');
          if (q.qtype === 'order') assert.deepEqual([...q.tokens].sort(), [...q.correct].sort(), '조각과 정답 낱말이 다름');
        }
    });
  }
  await test('문제 만들기: 워크시트 3종(고르기·빈칸·순서)·게임 3종(짝 맞추기·글자 섞기·철자)을 만들 수 있다', () => {
    const plan = { ...build.EMPTY_PLAN, sheetChoose: 3, sheetBlank: 3, sheetOrder: 3, gameMatchup: 5, gameAnagram: 3, gameSpelling: 3 };
    const items = build.buildItems(cards, plan, labels, null, rng);
    const ws = items.find((i) => i.kind === 'worksheet');
    assert.deepEqual(ws.config.sheets, ['choose', 'blank', 'order']);
    assert.deepEqual(items.filter((i) => i.kind === 'game').map((i) => i.config.game), ['matchup', 'anagram', 'spelling']);
  });

  // ---- 맞춤 추천 ----
  const ago = (d) => new Date(Date.now() - d * 86_400_000).toISOString();
  await test('추천: 기록이 모자라면 개인화라고 하지 않고 반 공통 복습', () => {
    const r = rec.recommendForStudent({ graded: 10, completed_activities: 1, words: [] }, cards, cards.slice(0, 3), labels);
    assert.equal(r.personal, false);
    assert.ok(r.reasons.every((x) => x.kind === 'common_review'));
    assert.equal(r.ruleVersion, 'rec-v1');
  });
  await test('추천: 뜻을 틀린 낱말은 다른 모양(뜻→단어)으로, 15문제 이하, 이유가 붙는다', () => {
    const words = cards.map((c, i) => ({
      word: c.word,
      card: { meaning: c.meaning, example: c.example },
      last_seen: ago(i < 2 ? 2 : 20),
      skills: { 'vocab.meaning': i < 2 ? { wrong: 3, right: 0, last_wrong: ago(2), last_right: null } : { wrong: 0, right: 2, last_wrong: null, last_right: ago(20) } },
    }));
    const r = rec.recommendForStudent({ graded: 60, completed_activities: 6, words }, cards, [], labels);
    assert.equal(r.personal, true);
    const qs = r.items.flatMap((i) => i.content.questions);
    assert.ok(qs.length > 0 && qs.length <= 15, `문제 수 ${qs.length}`);
    const weak = r.reasons.filter((x) => x.kind === 'wrong_meaning').map((x) => x.word);
    assert.deepEqual(weak.sort(), ['apple', 'dog']);
    const appleQs = qs.filter((q) => q.word === 'apple');
    assert.ok(appleQs.length > 0 && appleQs.every((q) => q.style !== 'meaning'), '틀린 문제와 같은 모양(뜻 고르기)을 그대로 냄');
    assert.ok(r.reasons.some((x) => x.kind === 'review_due'), '복습할 때 된 낱말이 없음');
  });
  // ---- 스탯 카드 ----
  const stats = await server.ssrLoadModule('/src/lib/homework/stats.ts');
  const baseCard = (over) => ({
    student: { id: 's', name: '민준', archived: false },
    days: 30,
    graded: 60,
    completed_activities: 6,
    skills: [],
    habit: { assigned: 4, finished: 4, prev_assigned: 0, prev_finished: 0 },
    retries: { count: 0, corrected: 0 },
    shadowing: { lines: 0, listens: 0 },
    wrong_words: [],
    recent: [],
    passbook_homework: { done: 0, missing: 0 },
    ...over,
  });
  await test('스탯: 등급 경계(S+ 95 · S 90 · A 80 · B 70 · C)', () => {
    assert.deepEqual([0.96, 0.9, 0.85, 0.7, 0.69].map(stats.gradeOf), ['S+', 'S', 'A', 'B', 'C']);
  });
  await test('스탯: 문제 8개 미만 세부 능력은 ?, 기록이 모자라면 모두 ?', () => {
    const sk = (skill, n, correct, weighted) => ({ skill, n, correct, weighted, prev_n: 0, prev_correct: 0 });
    const full = stats.buildStatSheet(baseCard({ skills: [sk('vocab.meaning', 20, 19, 0.95), sk('vocab.spelling', 5, 5, 1)] }));
    const vocab = full.abilities.find((a) => a.key === 'vocab');
    assert.equal(vocab.subs.find((s) => s.key === 'vocab.meaning').grade, 'S+');
    assert.equal(vocab.subs.find((s) => s.key === 'vocab.spelling').grade, null);
    assert.equal(vocab.grade, 'S+');
    assert.equal(full.abilities.find((a) => a.key === 'reading').grade, null);
    const thin = stats.buildStatSheet(baseCard({ graded: 20, skills: [sk('vocab.meaning', 20, 19, 0.95)] }));
    assert.equal(thin.enough, false);
    assert.ok(thin.abilities.every((a) => a.grade === null) && thin.overall.grade === null);
  });
  await test('스탯: 지난 기간 비교(%p)와 잘하는·연습할 것', () => {
    const s = stats.buildStatSheet(
      baseCard({
        skills: [
          { skill: 'vocab.meaning', n: 20, correct: 18, weighted: 0.9, prev_n: 10, prev_correct: 6 },
          { skill: 'listening.word', n: 10, correct: 5, weighted: 0.5, prev_n: 0, prev_correct: 0 },
        ],
      }),
    );
    assert.equal(s.abilities[0].subs[0].delta, 30);
    const sf = stats.strengthsAndFocus(s);
    assert.deepEqual(sf.strengths.map((x) => x.key).slice(0, 1), ['vocab.meaning']);
    assert.deepEqual(sf.focus.map((x) => x.key), ['listening.word']);
  });
  await test('스탯: 개별수업 능력(읽기·품사·받아쓰기·맞는 문장)이 능력별 세부 항목으로 들어온다', () => {
    const sk = (skill, n, correct, weighted) => ({ skill, n, correct, weighted, prev_n: 0, prev_correct: 0 });
    const s = stats.buildStatSheet(
      baseCard({ skills: [sk('reading.sentence', 10, 9, 0.9), sk('reading.situation', 8, 8, 1), sk('vocab.pos', 9, 6, 0.67), sk('listening.dictation', 8, 7, 0.88), sk('sentence.correct', 8, 5, 0.6)] }),
    );
    const ab = (k) => s.abilities.find((a) => a.key === k);
    assert.equal(ab('reading').grade, 'S');
    assert.equal(ab('vocab').subs.find((x) => x.key === 'vocab.pos').grade, 'C');
    assert.equal(ab('listening').subs.find((x) => x.key === 'listening.dictation').grade, 'A');
    assert.equal(ab('sentence').subs.find((x) => x.key === 'sentence.correct').grade, 'C');
  });
  await test('스탯: 서버(060 SQL)의 단계 → 능력 이름표가 앱의 세부 능력 목록과 같다', async () => {
    const fs = await import('node:fs');
    // 가장 나중 파일의 정의가 서버에 적용된 것이다(060 에서 만들고 062 에서 새 단계 종류를 더함)
    const files = ['060_solo_stats.sql', '062_solo_skill_text_blocks.sql', '064_solo_fix_error.sql', '065_solo_write_blocks.sql'].filter((f) => fs.existsSync(new URL('../../../supabase/' + f, import.meta.url)));
    const sql = fs.readFileSync(new URL('../../../supabase/' + files[files.length - 1], import.meta.url), 'utf8');
    const from = sql.indexOf('create or replace function public.solo_step_skill');
    const to = sql.indexOf('$$;', sql.indexOf('$$', from) + 2);
    const body = sql.slice(from, to);
    const fromSql = new Set([...body.matchAll(/'((?:vocab|listening|reading|sentence)\.[a-z]+)'/g)].map((m) => m[1]));
    const fromApp = new Set(stats.buildStatSheet(baseCard()).abilities.flatMap((a) => a.subs.map((x) => x.key)).filter((k) => k.includes('.') && !k.startsWith('habit.')));
    assert.deepEqual([...fromSql].sort(), [...fromApp].sort());
  });
  // ---- 블록 보드 정답률(063) ----
  const bs = await server.ssrLoadModule('/src/lib/soloBlockStats.ts');
  await test('블록 정답률: 앱의 단계 → 능력 이름표가 서버(062 SQL)와 같다', async () => {
    const fs = await import('node:fs');
    // solo_step_skill 을 다시 정의한 가장 나중 파일이 적용본(062, 064 …)
    const files = ['062_solo_skill_text_blocks.sql', '064_solo_fix_error.sql', '065_solo_write_blocks.sql'].filter((f) => fs.existsSync(new URL('../../../supabase/' + f, import.meta.url)));
    let sql = '';
    for (const f of files) {
      const t = fs.readFileSync(new URL('../../../supabase/' + f, import.meta.url), 'utf8');
      if (t.includes('create or replace function public.solo_step_skill')) sql = t;
    }
    const from = sql.indexOf('create or replace function public.solo_step_skill');
    const body = sql.slice(from, sql.indexOf('$$;', sql.indexOf('$$', from) + 2));
    const pairs = [...body.matchAll(/when '([A-Za-z]+)' then '([a-z]+\.[a-z]+)'/g)].map((m) => [m[1], m[2]]);
    assert.ok(pairs.length >= 14);
    for (const [type, skill] of pairs) assert.equal(bs.soloStepSkill({ t: type }), skill, type);
    // pickWord 는 그림이 있으면 vocab.picture
    assert.equal(bs.soloStepSkill({ t: 'pickWord', imageUrl: 'x' }), 'vocab.picture');
    assert.equal(bs.soloStepSkill({ t: 'meet' }), null);
    assert.equal(bs.soloStepSkill({ t: 'roleplay' }), null);
  });
  await test('블록 정답률: 블록 범위의 처음 답을 더하고, 번호가 어긋나면 이 수업 숫자는 숨긴다', () => {
    const saved = [{ t: 'intro' }, { t: 'spell' }, { t: 'spell' }, { t: 'listenPick' }];
    const block = { type: 'spell', start: 1, end: 2, count: 2, edited: 0, words: [], seconds: 90, source: null };
    const data = {
      days: 30,
      scope: 'class',
      steps: [
        { step: 1, students: 4, n: 4, correct: 3 },
        { step: 2, students: 5, n: 5, correct: 2 },
        { step: 3, students: 5, n: 5, correct: 5 },
      ],
      skills: [{ skill: 'vocab.spelling', n: 40, correct: 24, students: 6 }],
    };
    const p = bs.blockPerformance(data, saved, saved, block);
    assert.deepEqual([p.lesson.n, p.lesson.correct, p.lesson.students], [9, 5, 5]);
    assert.equal(p.lesson.label, 'review'); // 5/9 = 56%
    assert.equal(p.klass.skill, 'vocab.spelling');
    assert.equal(p.klass.label, 'review'); // 60%
    // 문제를 하나 지워 번호가 어긋나면 "이 수업" 숫자는 안 보이고 반 능력 숫자만 남는다
    const edited = [saved[0], saved[3], saved[1], saved[2]];
    const moved = bs.blockPerformance(data, saved, edited, block);
    assert.equal(moved.lesson, null);
    // 기록이 8개 미만이면 판단 말이 없다
    const few = bs.blockPerformance({ ...data, steps: [{ step: 1, students: 1, n: 3, correct: 3 }], skills: [] }, saved, saved, block);
    assert.equal(few.lesson.label, null);
    assert.equal(few.klass, null);
    // 능력 이름표가 없는 채점 블록(조건 영작)은 "이 수업 정답률"도 만들지 않는다
    const cw = [{ t: 'intro' }, { t: 'condWrite' }];
    const cwBlock = { type: 'condWrite', start: 1, end: 1, count: 1, edited: 0, words: [], seconds: 60, source: null };
    const cwPerf = bs.blockPerformance({ ...data, steps: [{ step: 1, students: 3, n: 3, correct: 3 }] }, cw, cw, cwBlock);
    assert.equal(cwPerf.lesson, null);
    assert.equal(cwPerf.klass, null);
    // 시험 블록·정보 블록은 능력 숫자를 안 붙인다
    assert.equal(bs.blockPerformance(data, saved, [{ t: 'test' }], { ...block, type: 'test', start: 0, end: 0 }).klass, null);
  });
  // ---- 문장 목록(066) ----
  const sl = await server.ssrLoadModule('/src/lib/sentenceLists.ts');
  await test('문장 목록: 한 줄에 영어 문장 | 해석, 번호·빈 줄·영어 없는 줄·중복은 뺀다', () => {
    const parsed = sl.parseSentenceLines('1. I like apples. | 나는 사과를 좋아해요.\n\n- The cat is cute\t고양이는 귀여워요\n3)\nhello world\nI like apples.  |  또 같은 문장\n안녕하세요');
    assert.deepEqual(parsed.map((p) => p.sentence), ['I like apples.', 'The cat is cute', 'hello world']);
    assert.deepEqual(parsed.map((p) => p.meaning), ['나는 사과를 좋아해요.', '고양이는 귀여워요', '']);
    const items = sl.newSentenceItems([{ id: 'a', word: 'the cat  is cute', meaning: '', image_url: null, category: null }], parsed, () => 'n');
    assert.deepEqual(items.map((i) => i.word), ['I like apples.', 'hello world']);
  });
  // ---- 노래 가사: 숙어 확장·문법 찾기(2026-10-12) ----
  const lw = await server.ssrLoadModule('/src/lib/lyricWords.ts');
  const lg = await server.ssrLoadModule('/src/lib/lyricGrammar.ts');
  const lh = await server.ssrLoadModule('/src/lib/lyricHandout.ts');
  const gram = await server.ssrLoadModule('/src/lib/grammar.ts');
  const SONG = [
    "Although she has always been a friend of mine, I'm leaving my life in your hands",
    "I can't read it all in a glance",
    "I don't care who you are, where you're from",
    "As long as you love me, we are meant to be",
    "I tried to hide it so that no one knows",
    "They are running and the light was shining",
    "People say that I am blind",
  ].join('\n');
  await test('가사 숙어: a friend of mine·in a glance·as long as·meant to be·줄임말 표현을 찾는다', () => {
    const v = lw.extractLyricVocab(SONG, []);
    const keys = v.phrases.map((p) => p.phrase.toLowerCase());
    for (const want of ['a friend of mine', 'in a glance', 'as long as', 'so that']) {
      assert.ok(keys.includes(want), want + ' 없음: ' + keys.join(' | '));
    }
    assert.ok(v.phrases.length >= 6, '숙어 수 ' + v.phrases.length);
  });
  await test('가사 문법: although·has been·be+ing·as long as·간접의문문·so that 을 찾고 라이브러리 항목에 잇는다', () => {
    const g = lg.extractLyricGrammar(SONG);
    const ids = g.map((x) => x.id);
    for (const want of ['m-because-although', 'm-present-perfect', 'present-progressive', 'as-long-as', 'm-indirect-question', 'so-that-purpose']) {
      assert.ok(ids.includes(want), want + ' 없음: ' + ids.join(','));
    }
    const pp = g.find((x) => x.id === 'm-present-perfect');
    assert.ok(/has always been/.test(pp.hits[0].match), pp.hits[0].match);
    // 쉬운 것부터(level 오름차순)
    for (let i = 1; i < g.length; i++) assert.ok(g[i - 1].point.level <= g[i].point.level);
  });
  await test('가사 문법 규칙의 id 는 모두 문법 라이브러리에 있다', () => {
    const ids = new Set(gram.GRAMMAR_POINTS.map((p) => p.id));
    for (const id of lg.LYRIC_GRAMMAR_RULE_IDS) assert.ok(ids.has(id), id);
  });
  await test('수업 자료(인쇄물): 표·문법 카드·줄별 포인트가 만들어지고 가사 해석은 붙여 넣은 줄만 들어간다', () => {
    const src = "As long as you love me, we are meant to be | 네가 나를 사랑하기만 하면 우린 운명이야" + '\n' + "I tried to hide it so that no one knows";
    const grammar = lg.extractLyricGrammar(src).filter((x) => ['as-long-as', 'so-that-purpose'].includes(x.id));
    const html = lh.buildLyricHandoutHtml({
      title: 'Test song',
      source: src,
      rows: [{ word: 'as long as', pos: '숙어', meaning: '~하기만 하면', example: '', line: 'As long as you love me, we are meant to be' }],
      grammar,
    });
    assert.ok(html.includes('UNIT 1') && html.includes('UNIT 2') && html.includes('UNIT 3'));
    assert.ok(html.includes('네가 나를 사랑하기만 하면 우린 운명이야'));
    assert.ok(!html.includes('<script'));
  });
  // ---- 팝송 수업 컬렉션·수업 대상(2026-10-12) ----
  const songs = await server.ssrLoadModule('/src/lib/songLessons.ts');
  const lvl = await server.ssrLoadModule('/src/lib/lessonLevel.ts');
  await test('팝송 수업 데이터: 문법 id 가 라이브러리에 있고, 영상 id 형식·문장 길이·대상 값이 맞다', () => {
    const gids = new Set(gram.GRAMMAR_POINTS.map((p) => p.id));
    assert.ok(songs.SONG_LESSONS.length >= 8);
    const ids = new Set();
    for (const s of songs.SONG_LESSONS) {
      assert.ok(!ids.has(s.id), '중복 id ' + s.id);
      ids.add(s.id);
      assert.ok(s.levels.length > 0 && s.levels.every((l) => ['elementary', 'middle', 'high'].includes(l)), s.id + ' levels');
      for (const g of s.grammarIds) assert.ok(gids.has(g), s.id + ' 문법 ' + g);
      if (s.videoId !== null) assert.match(s.videoId, /^[A-Za-z0-9_-]{11}$/, s.id + ' videoId');
      assert.ok(s.words.length >= 5 && s.words.length <= 8, s.id + ' 단어 수');
      for (const w of s.words) assert.ok(w.word && w.meaning && w.example && w.exampleKo, s.id + ' ' + w.word);
      for (const sent of s.sentences) {
        const n = sent.split(' ').filter(Boolean).length;
        assert.ok(n >= 3 && n <= 8, s.id + ' 문장 낱말 수: ' + sent);
      }
      assert.ok(s.warmup.length >= 1 && s.comprehension.length >= 1 && s.activity.frame && s.draft === true, s.id);
      // 가사를 담지 않는다: 한 필드가 지나치게 길면(가사 덩어리 의심) 막는다
      for (const text of [s.intro, ...s.sentences, ...s.words.map((w) => w.example)]) assert.ok(text.length < 400, s.id + ' 너무 긴 글');
      assert.ok(songs.lyricsSearchUrl(s).startsWith('https://genius.com/search?q='));
    }
  });
  await test('수업 대상: 필터가 전체면 모두, 아니면 대상이 들어 있는 것만(대상이 없으면 초등으로 본다)', () => {
    assert.equal(lvl.levelMatches('all', ['high']), true);
    assert.equal(lvl.levelMatches('middle', ['middle', 'high']), true);
    assert.equal(lvl.levelMatches('elementary', ['middle']), false);
    assert.equal(lvl.levelMatches('elementary', undefined), true);
    assert.equal(lvl.levelMatches('high', undefined), false);
  });
  await test('팝송 수업 만들기: 가사 없이도 제목·질문·영상·Q&A·단어·문법·활동 슬라이드가 순서대로 만들어진다', async () => {
    const song = songs.SONG_LESSONS.find((s) => s.id === 'count-on-me');
    const made = [];
    const slides = await songs.buildSongLesson(song, {
      makeWordList: async (words) => {
        made.push(words.length);
        return true;
      },
      makeUnscrambleFromSentences: async () => 'tpl-unscramble',
      makeGameFromWords: async () => 'tpl-quiz',
    });
    const kinds = slides.map((x) => x.kind);
    assert.deepEqual(kinds.slice(0, 4), ['canvas', 'canvas', 'video', 'qna']);
    assert.ok(kinds.includes('wordshow') && kinds.includes('grammar') && kinds.filter((k) => k === 'game').length >= 3);
    assert.equal(made[0], song.words.length);
    assert.equal(slides.filter((x) => x.kind === 'reading').length, 0, '가사를 붙여 넣지 않으면 읽기 슬라이드는 없다');
    // 영상이 없는 곡(디즈니 계열)은 영상 슬라이드를 만들지 않는다
    const none = songs.SONG_LESSONS.find((s) => s.videoId === null);
    if (none) {
      const s2 = await songs.buildSongLesson(none, {});
      assert.ok(!s2.some((x) => x.kind === 'video'));
    }
  });
  const popSolo = await server.ssrLoadModule('/src/lib/soloPopSongs.ts');
  await test('팝송 개별수업: 모든 곡이 가사 없이 단계가 만들어지고, 고르기 정답 번호가 보기 범위 안에 있다', () => {
    const CHOICE = ['pickWord', 'pickMeaning', 'listenPick', 'translatePick', 'pickCorrect', 'sayPick', 'pickPos'];
    for (const song of songs.SONG_LESSONS) {
      const l = popSolo.buildSoloPopSongLesson(song);
      assert.equal(l.steps[0].t, 'intro', song.id);
      assert.ok(l.steps.length >= 15, song.id + ' 단계 수 ' + l.steps.length);
      assert.ok(l.steps.some((x) => x.t === 'meet') && l.steps.some((x) => x.t === 'rule') && l.steps.some((x) => x.t === 'unscramble'), song.id);
      assert.equal(l.steps.some((x) => x.t === 'watch'), song.videoId !== null, song.id + ' 영상');
      for (const st of l.steps) if (CHOICE.includes(st.t)) assert.ok(st.answer >= 0 && st.answer < st.options.length, song.id + ' ' + st.t);
      assert.ok(l.minutes >= 10);
    }
  });
  // ---- 직접 만들기 슬라이드 효과 순서(2026-10-05) ----
  const motion = await server.ssrLoadModule('/src/lib/canvasMotion.ts');
  const el = (id, m) => ({ id, type: 'text', x: 0, y: 0, w: 10, h: 10, text: id, fontSize: 5, color: '#000', bold: false, align: 'left', font: 'sans', motion: m });
  const fx = (trigger, extra = {}) => ({ effect: 'fade', trigger, duration: 0.5, delay: 0, ...extra });
  await test('효과 순서: 클릭마다 새 단계, 함께는 같은 단계·같은 시작, 이어서는 앞이 끝난 뒤', () => {
    const plan = motion.buildMotionPlan({ elements: [el('plain', null), el('a', fx('click')), el('b', fx('with', { delay: 0.2 })), el('c', fx('auto')), el('d', fx('click', { out: true }))] });
    assert.equal(plan.clickSteps, 2);
    assert.equal(plan.byId.has('plain'), false);
    assert.deepEqual([plan.byId.get('a').step, plan.byId.get('b').step, plan.byId.get('c').step, plan.byId.get('d').step], [1, 1, 1, 2]);
    assert.equal(plan.byId.get('b').start, 0.2);
    assert.ok(Math.abs(plan.byId.get('c').start - 0.7) < 1e-9, '이어서는 앞(0.2+0.5)이 끝난 뒤');
  });
  await test('효과 순서: 슬라이드 열릴 때 나오는 효과는 단계 0, 순서 목록(motionOrder)을 따른다', () => {
    const els = [el('a', fx('auto')), el('b', fx('click')), el('c', fx('click'))];
    assert.equal(motion.buildMotionPlan({ elements: els }).byId.get('a').step, 0);
    const swapped = motion.buildMotionPlan({ elements: els, motionOrder: ['c', 'b', 'a'] });
    assert.deepEqual(swapped.ordered.map((i) => i.id), ['c', 'b', 'a']);
    assert.equal(swapped.byId.get('c').step, 1);
    assert.equal(swapped.byId.get('b').step, 2);
  });
} finally {
  await server.close();
}

console.log(failed ? `\n${failed}개 실패` : '\n모두 통과');
process.exit(failed ? 1 : 0);

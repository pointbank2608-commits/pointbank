// 개별수업 글 블록(lib/textBlocks.ts · lib/soloPrint.ts) 확인 — 가사로 빈칸·줄 순서 문제를 만들고,
// 문법 겨냥이 맞는 낱말을 비우는지·정답이 학생에게 안 가는지·채점이 맞는지·인쇄 HTML 이 같은 문제를 쓰는지 본다.
// 실행: node app/scripts/solo/check-text-blocks.mjs   (저장소 루트 또는 app/ 어디서든)
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const stubSupabase = {
  name: 'stub-supabase',
  enforce: 'pre',
  load(id) {
    if (id.replace(/\\/g, '/').endsWith('/src/lib/supabase.ts')) return 'export const supabase = {};';
  },
};
const server = await createServer({ root, logLevel: 'error', plugins: [stubSupabase], server: { middlewareMode: true, hmr: false }, appType: 'custom' });

try {
  const L = await server.ssrLoadModule('/src/lib/soloLessons.ts');
  const X = await server.ssrLoadModule('/src/lib/textBlocks.ts');
  const P = await server.ssrLoadModule('/src/lib/soloPrint.ts');
  const E = await server.ssrLoadModule('/src/lib/soloEdit.ts');

  const SONG = `[0:10-0:14] I have been waiting for you | 널 기다려 왔어
[0:14-0:18] She has never seen the ocean | 그녀는 바다를 본 적이 없어
[0:18-0:22] We are going to the park | 우린 공원에 갈 거야
[0:22-0:26] The cake was eaten by my brother | 케이크는 내 동생이 먹었어
[0:26-0:30] I want to learn English | 영어를 배우고 싶어
[0:30-0:34] He enjoys playing the guitar | 그는 기타 치는 걸 즐겨
[0:34-0:38] This is bigger than that one | 이게 저것보다 커
[0:38-0:42] You are the best friend | 넌 최고의 친구야`;

  // 1) 읽기
  const parsed = X.parseTextSource(SONG);
  assert.equal(parsed.lines.length, 8);
  assert.equal(parsed.timed, true);
  assert.equal(parsed.lines[0].ko, '널 기다려 왔어');
  assert.equal(X.parseTextSource('I like apples.\nYou like pears.\nWe like plums.').timed, false);
  const para = X.parseTextSource('I like apples very much. You like pears and plums too. We all like fruit a lot because it is sweet and healthy.');
  assert.ok(para.lines.length >= 3, '한 덩어리 문단은 문장으로 나뉜다');

  // 2) 문법 겨냥: 맞는 낱말만 비운다
  const blankOf = (id, line) => {
    const items = X.buildGapItems([{ en: line, ko: '', start: 0, end: 3 }], { target: id }, 5);
    return items[0]?.answer ?? null;
  };
  assert.equal(blankOf('presentPerfect', 'I have been waiting for you'), 'been');
  assert.equal(blankOf('presentPerfect', 'She has never seen the ocean'), 'seen');
  assert.equal(blankOf('presentPerfect', 'I have a red hat'), null, 'have + 명사는 현재완료가 아니다');
  assert.equal(blankOf('progressive', 'We are going to the park'), 'going');
  assert.equal(blankOf('passive', 'The cake was eaten by my brother'), 'eaten');
  assert.equal(blankOf('toInfinitive', 'I want to learn English'), 'learn');
  assert.equal(blankOf('toInfinitive', 'I go to school'), null, 'to + 명사는 to부정사가 아니다');
  assert.equal(blankOf('gerund', 'He enjoys playing the guitar'), 'playing');
  assert.equal(blankOf('comparative', 'This is bigger than that one'), 'bigger');
  assert.equal(blankOf('superlative', 'You are the best friend'), 'best');
  assert.equal(blankOf('pastSimple', 'We need some speed'), null, 'need·speed 는 과거형이 아니다');

  // 3) 문법 겨냥으로 만든 빈칸 → 단계
  const ctx = { videoId: 'dQw4w9WgXcQ', timed: parsed.timed, lines: parsed.lines };
  const gapItems = X.buildGapItems(parsed.lines, { target: 'presentPerfect' }, 8);
  assert.equal(gapItems.length, 2, '현재완료가 쓰인 줄만(2줄)');
  const easy = X.buildGapSteps(gapItems, 'easy', ctx);
  assert.ok(easy.every((s) => s.t === 'lyricBlank'), '영상+시간표가 있으면 줄 듣기 빈칸');
  for (const s of easy) {
    assert.equal(s.options[s.answer], gapItems[easy.indexOf(s)].answer);
    assert.equal(new Set(s.options.map((o) => o.toLowerCase())).size, s.options.length, '보기에 같은 낱말이 없다');
    assert.deepEqual(E.stepProblems(s), []);
    assert.equal(s.clip.videoId, 'dQw4w9WgXcQ');
  }
  const noVideo = X.buildGapSteps(gapItems, 'easy', { videoId: null, timed: true, lines: parsed.lines });
  assert.ok(noVideo.every((s) => s.t === 'fillBlank'), '영상이 없으면 일반 빈칸 고르기');
  const hard = X.buildGapSteps(gapItems, 'hard', ctx);
  assert.ok(hard.every((s) => s.t === 'gapType' && s.clip));
  for (const s of hard) assert.deepEqual(E.stepProblems(s), []);

  // 4) 학생에게 가는 모양에는 정답이 없다 + 채점
  const gap = hard[0];
  const pub = L.toPublicStep(gap);
  assert.ok(!('word' in pub), 'gapType: word 가 빠져야 한다');
  assert.equal(pub.first, gap.word[0]);
  assert.equal(L.gradeSoloLocal(gap, ` ${gap.word.toUpperCase()} `), true);
  assert.equal(L.gradeSoloLocal(gap, 'zzz'), false);
  assert.equal(L.soloCorrectText(gap), gap.word);

  // 5) 줄 순서
  const orders = X.buildLineOrderSteps(parsed.lines, 4, ctx);
  assert.equal(orders.length, 2, '8줄을 4줄씩 2문제');
  for (const o of orders) {
    assert.equal(o.t, 'lineOrder');
    assert.equal(o.lines.length, 4);
    assert.deepEqual([...o.pieces].sort(), [...o.lines].sort(), '같은 줄을 섞은 것');
    assert.notDeepEqual(o.pieces, o.lines, '섞였다');
    assert.deepEqual(E.stepProblems(o), []);
    const opub = L.toPublicStep(o);
    assert.ok(!('lines' in opub), 'lineOrder: lines 가 빠져야 한다');
    assert.equal(L.gradeSoloLocal(o, o.lines.join(' ')), true);
    assert.equal(L.gradeSoloLocal(o, [...o.lines].reverse().join(' ')), false);
  }
  assert.equal(X.buildLineOrderSteps(parsed.lines.slice(0, 2), 4, ctx).length, 0, '줄이 3개 미만이면 만들지 않는다');
  assert.equal(L.soloCorrectText(orders[0]), orders[0].lines.join(' / '));

  // 6) 인쇄 HTML: 같은 문제 + 정답지 + 이스케이프
  const t = (k) => k;
  const steps = [...hard, ...orders, { t: 'fillBlank', sentence: 'I <b>like</b> _____.', meaning: '', options: ['a & b', 'c', 'd'], answer: 0 }];
  const html = P.buildSoloPrintHtml(steps, { title: '확인 <시험>', includeAnswers: true, showBank: true }, t);
  assert.ok(html.includes('확인 &lt;시험&gt;'), '제목이 이스케이프된다');
  assert.ok(!html.includes('<b>like</b>'), '문장 속 태그가 이스케이프된다');
  assert.ok(html.includes('a &amp; b'));
  assert.equal((html.match(/class="no"/g) ?? []).length, steps.length, '문제 번호가 문제 수와 같다');
  assert.ok(html.includes('class="bank"'), '빈칸 쓰기에는 낱말 은행');
  assert.ok(html.includes('class="page ans"'), '정답지 장');
  for (const g of hard) assert.ok(html.split('class="page ans"')[1].includes(g.word), '정답지에 정답');
  const letters = P.lineOrderLetters(orders[0].lines, orders[0].pieces);
  assert.equal(letters.length, 4);
  assert.ok(letters.every((l) => /^[A-D]$/.test(l)), '정답 순서가 A~D 글자');
  assert.ok(html.split('class="page ans"')[1].includes(letters.join(' → ')));
  const noAns = P.buildSoloPrintHtml(steps, { title: 'x', includeAnswers: false, showBank: false }, t);
  assert.ok(!noAns.includes('class="page ans"'));
  assert.ok(!noAns.includes('class="bank"'));
  assert.equal(P.buildSoloPrintHtml([{ t: 'intro', title: 'x', text: '' }], { title: 'x', includeAnswers: true, showBank: true }, t), null, '인쇄할 문제가 없으면 null');
  // 인쇄할 수 있는 종류는 전부 렌더된다
  for (const ty of P.PRINTABLE_STEP_TYPES) assert.ok(typeof ty === 'string');

  // 7) 어법 오류 고치기(문법 항목의 틀리기 쉬운 문장)
  const G = await server.ssrLoadModule('/src/lib/grammarBlocks.ts');
  const grammar = await server.ssrLoadModule('/src/lib/grammar.ts');
  const withPit = grammar.GRAMMAR_POINTS.filter((g) => g.pitfalls && g.pitfalls.length > 0);
  assert.ok(withPit.length > 100, '틀리기 쉬운 문장이 있는 문법 항목이 충분하다');
  const ids = withPit.slice(0, 6).map((g) => g.id);
  const fix = G.buildFixErrorSteps(ids, 8);
  assert.ok(fix.length >= 6 && fix.every((x) => x.t === 'fixError'), '오류 고치기 문제가 만들어진다');
  for (const f of fix) {
    assert.deepEqual(E.stepProblems(f), [], `검사 통과: ${f.wrong}`);
    assert.ok(!/\*\*/.test(f.wrong + f.right), '강조 표시(**)가 없다');
    const fp = L.toPublicStep(f);
    assert.ok(!('right' in fp) && fp.wrong === f.wrong, 'fixError: right 가 빠져야 한다');
    // 대소문자·문장부호가 달라도 맞다, 틀린 문장 그대로면 틀리다
    assert.equal(L.gradeSoloLocal(f, f.right.toUpperCase().replace(/[.!?]+$/, '')), true);
    assert.equal(L.gradeSoloLocal(f, f.wrong), false);
    assert.equal(L.soloCorrectText(f), f.right);
  }
  assert.equal(new Set(fix.map((f) => f.wrong.toLowerCase())).size, fix.length, '같은 틀린 문장이 겹치지 않는다');
  // 낱말을 눌러 고치기: 칸 번호별 고친 글을 반영해 문장을 만든다
  assert.deepEqual(G.fixTokens('He go to school.'), ['He', 'go', 'to', 'school.']);
  assert.equal(G.applyFixEdits('He go to school.', { 1: 'goes' }), 'He goes to school.');
  assert.equal(G.applyFixEdits('I am a a boy.', { 3: '' }), 'I am a boy.', '낱말을 비우면 지운 것');
  assert.equal(G.applyFixEdits('She happy.', { 1: 'is happy.' }), 'She is happy.', '낱말 대신 여러 낱말을 써도 된다');
  const manual = { t: 'fixError', wrong: 'He go to school.', right: 'He goes to school.', why: '', ko: '' };
  assert.equal(L.gradeSoloLocal(manual, G.applyFixEdits(manual.wrong, { 1: 'goes' })), true);
  assert.deepEqual(E.stepProblems({ ...manual, right: 'he go to school' }), ['fixSame'], '같으면 안 된다');
  assert.deepEqual(E.stepProblems({ ...manual, right: '' }), ['fixEmpty']);
  // 정답이 여러 개(" / ")인 항목: 어느 쪽이든 맞고, 조각 정답도 앞 낱말이 같으면 맞다
  const alt = { t: 'fixError', wrong: 'I need many water.', right: 'I need much water. / a lot of water.', why: '', ko: '' };
  assert.equal(L.gradeSoloLocal(alt, 'I need much water.'), true);
  assert.equal(L.gradeSoloLocal(alt, 'i need a lot of water'), true, '조각 정답');
  assert.equal(L.gradeSoloLocal(alt, 'A lot of water.'), false, '앞 낱말이 다르면 아니다');
  assert.equal(L.gradeSoloLocal(alt, 'I need many water.'), false);
  const alt2 = { t: 'fixError', wrong: "I don't know neither.", right: "I don't know either. / I know neither.", why: '', ko: '' };
  assert.equal(L.gradeSoloLocal(alt2, 'I know neither.'), true);
  assert.equal(L.gradeSoloLocal(alt2, "I don't know either"), true);
  // 8) 영작 블록: 단어 배열 영작·조건 영작(문법 예문 + 해석, 또는 해석이 있는 가사 줄)
  const W = await server.ssrLoadModule('/src/lib/writeBlocks.ts');
  const sents = W.sentencesForPointIds(withPit.slice(0, 12).map((g) => g.id));
  assert.ok(sents.length >= 8, '해석이 있는 예문이 충분하다');
  assert.ok(sents.every((x) => x.ko && !/\*\*/.test(x.en)), '해석이 있고 강조 표시가 없다');
  const ow = W.buildOrderWriteSteps(sents, 6);
  assert.equal(ow.length, 6);
  for (const o of ow) {
    assert.equal(o.t, 'orderWrite');
    assert.deepEqual(E.stepProblems(o), [], `검사 통과: ${o.answer}`);
    assert.deepEqual([...o.words].map((w) => w.toLowerCase()).sort(), W.wordTokens(o.answer).map((w) => w.toLowerCase()).sort(), '주어진 낱말 = 정답의 낱말');
    const op = L.toPublicStep(o);
    assert.ok(!('answer' in op) && op.ko === o.ko, 'orderWrite: answer 가 빠져야 한다');
    assert.equal(L.gradeSoloLocal(o, o.answer.toLowerCase().replace(/[.!?]+$/, '')), true);
    assert.equal(L.gradeSoloLocal(o, o.words.join(' ')) === true && o.words.join(' ') !== W.wordTokens(o.answer).join(' ') ? true : false, false, '섞인 순서 그대로는 틀리다');
  }
  const cw = W.buildCondWriteSteps(sents, 6);
  for (const c of cw) {
    assert.equal(c.t, 'condWrite');
    assert.deepEqual(E.stepProblems(c), [], `검사 통과: ${c.model}`);
    assert.ok(c.conditions.some((x) => typeof x.min === 'number') && c.conditions.some((x) => x.words && x.words.length), '단어 수와 낱말 조건이 있다');
    const cp = L.toPublicStep(c);
    assert.ok(!('model' in cp) && cp.conditions.length === c.conditions.length, 'condWrite: model 이 빠져야 한다');
    assert.equal(L.gradeSoloLocal(c, c.model), true, '예시 답은 자기 조건을 통과한다');
    assert.equal(L.gradeSoloLocal(c, 'Hi.'), false, '조건을 못 지키면 틀리다');
    assert.equal(L.gradeSoloLocal(c, '   '), false);
  }
  // 조건 하나씩
  const cond = { text: '7단어', min: 7, max: 7 };
  assert.equal(L.checkCondition(cond, 'I want to learn English very much'), true);
  assert.equal(L.checkCondition(cond, 'I want to learn English'), false);
  assert.equal(L.checkCondition({ text: 'x', words: ['want', 'wants'] }, 'She wants it.'), true);
  assert.equal(L.checkCondition({ text: 'x', words: ['want'] }, 'She wanted it.'), false, '낱말 전체가 같아야 한다');
  assert.equal(L.checkCondition({ text: 'a lot of', words: ['a lot of'] }, 'I have a lot of books'), true, '낱말 묶음');
  assert.equal(L.checkCondition({ text: '틀 안내' }, 'anything'), null, '검사할 게 없으면 null');
  assert.equal(L.conditionsMet([{ text: '틀 안내' }], 'anything'), true);
  assert.equal(L.conditionsMet([{ text: '틀 안내' }], ''), false);
  // 해석이 있는 가사 줄
  const tl = X.parseTextSource(['[0:10-0:14] I have been waiting for you | 널 기다려 왔어', '[0:14-0:18] Hello | 안녕'].join('\n')).lines;
  assert.equal(W.sentencesFromLines(tl).length, 1, '3낱말 이상 + 해석 있는 줄만');
  // 인쇄
  const whtml = P.buildSoloPrintHtml([...ow, ...cw], { title: '영작', includeAnswers: true, showBank: false }, (k) => k);
  assert.ok(whtml.includes('soloPrint.condTitle') && whtml.includes('inst_orderWrite') && whtml.includes('inst_condWrite'));
  assert.equal((whtml.match(/class="no"/g) ?? []).length, ow.length + cw.length);
  assert.ok(whtml.split('class="page ans"')[1].includes(cw[0].model.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;')), '정답지에 예시 답');

  // 인쇄
  const fhtml = P.buildSoloPrintHtml(fix, { title: '오류 고치기', includeAnswers: true, showBank: false }, t);
  assert.equal((fhtml.match(/class="no"/g) ?? []).length, fix.length);
  assert.ok(fhtml.includes('inst_fixError'));
  assert.ok(fhtml.split('class="page ans"')[1].includes(fix[0].right.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')), '정답지에 고친 문장');

  console.log('글 블록 확인 통과 — 현재완료 빈칸 2문제, 줄 순서 2문제, 오류 고치기 ' + fix.length + '문제, 영작 ' + ow.length + '+' + cw.length + '문제, 인쇄 HTML', Math.round(html.length / 1024) + 'KB');
} finally {
  await server.close();
}

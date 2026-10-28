// 문법 워크북 v2(A·B 세트, 문항 확대) 공용 도구 — 자료 읽기·쓰기, Gemini 호출, 정적 검사.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const src = join(here, '..', '..', 'src', 'data');
export const bankDir = join(src, 'grammarSheets', 'bank');
export const points = JSON.parse(readFileSync(join(src, 'grammarPoints.json'), 'utf8'));
export const pointById = Object.fromEntries(points.map((p) => [p.id, p]));
export const strip = (s) => (s ?? '').replace(/\*\*/g, '');

/** 모든 bank 파일을 { file, list } 로 읽는다. */
export function loadBank() {
  return readdirSync(bankDir).filter((n) => n.endsWith('.json')).sort().map((file) => ({ file, list: JSON.parse(readFileSync(join(bankDir, file), 'utf8')) }));
}
export function saveBankFile(b) {
  writeFileSync(join(bankDir, b.file), JSON.stringify(b.list, null, 2) + '\n');
}
/** 다른 프로세스가 같은 파일을 고쳤을 수 있어, 디스크에서 다시 읽어 이 항목만 바꿔 쓴다. */
export function saveItem(item) {
  for (const f of readdirSync(bankDir).filter((n) => n.endsWith('.json'))) {
    const path = join(bankDir, f);
    const list = JSON.parse(readFileSync(path, 'utf8'));
    const i = list.findIndex((x) => x.id === item.id);
    if (i >= 0) { list[i] = item; writeFileSync(path, JSON.stringify(list, null, 2) + '\n'); return; }
  }
}
export function allItems(bank) {
  return bank.flatMap((b) => b.list);
}

// ---------- Gemini ----------
const PROJECT = process.env.GCP_PROJECT ?? 'project-01c6d808-a517-4177-82f';
export const MODEL = process.env.GEN_MODEL ?? 'gemini-3.1-pro-preview';
const gcloud = process.env.LOCALAPPDATA ? `"${join(process.env.LOCALAPPDATA, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd')}"` : 'gcloud';
let token = '';
let tokenAt = 0;
const auth = () => {
  if (Date.now() - tokenAt > 20 * 60 * 1000) { token = execSync(`${gcloud} auth print-access-token`, { encoding: 'utf8' }).trim(); tokenAt = Date.now(); }
  return token;
};
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function ask(prompt, temperature = 0) {
  const url = `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${MODEL}:generateContent`;
  for (let a = 1; a <= 5; a++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth()}`, 'Content-Type': 'application/json', 'x-goog-user-project': PROJECT },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature } }),
      });
      if (res.status === 401) tokenAt = 0;
      if (!res.ok) { await sleep((res.status === 429 ? 20000 : 4000) * a); continue; }
      const j = await res.json();
      return JSON.parse(j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? 'null');
    } catch { await sleep(4000 * a); }
  }
  return null;
}
/** n개 작업을 동시에 limit 개씩 처리한다. */
export async function pool(items, limit, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => { while (next < items.length) { const i = next++; await fn(items[i], i); } }));
}

// ---------- 정적 검사 ----------
const hangul = /[가-힣]/;
const words = (s) => s.trim().split(/\s+/).length;
const tokens = (s) => s.replace(/[.,?!]/g, '').toLowerCase().split(/\s+/);
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
export const COUNT = { choose: 10, say: 6, review: 6, buildExtra: 4, correctA: 6, bBuild: 8, bCorrect: 6 };

function checkChoose(list, label, bad) {
  if (!Array.isArray(list) || list.length !== COUNT.choose) bad(`${label} choose 는 ${COUNT.choose}문항이어야 함(${list?.length})`);
  const seen = new Set();
  for (const [i, q] of (list ?? []).entries()) {
    const tag = `${label} choose ${i + 1}`;
    if (typeof q.p !== 'string' || (q.p.match(/____/g) ?? []).length !== 1) bad(`${tag}: 빈칸 ____ 은 한 곳이어야 함`);
    if (!Array.isArray(q.c) || q.c.length < 2 || q.c.length > 3) bad(`${tag}: 보기는 2~3개`);
    if (new Set((q.c ?? []).map((c) => String(c).trim())).size !== (q.c ?? []).length) bad(`${tag}: 보기가 중복됨`);
    if (!(q.a >= 0 && q.a < (q.c ?? []).length)) bad(`${tag}: 정답 번호가 범위 밖`);
    if (!hangul.test(q.why ?? '')) bad(`${tag}: why(한국어)가 없음`);
    if (/앞뒤 문맥|문맥:/.test(q.why ?? '')) bad(`${tag}: why 에 모호한 문맥 설명`);
    const key = String(q.p).toLowerCase();
    if (seen.has(key)) bad(`${tag}: 같은 문장이 두 번 나옴`);
    seen.add(key);
  }
}
function checkBuild(list, label, min, bad) {
  if (!Array.isArray(list) || list.length < min) bad(`${label} build 는 ${min}개 이상이어야 함(${list?.length})`);
  for (const [i, b] of (list ?? []).entries()) {
    const tag = `${label} build ${i + 1}`;
    const marks = [...String(b.en ?? '').matchAll(/\*\*(.+?)\*\*/g)];
    if (marks.length < 1 || marks.length > 2) bad(`${tag}: 굵은 표시(**) 는 1~2곳`);
    if (String(b.en ?? '').replace(/\*\*/g, '').includes('**')) bad(`${tag}: 굵은 표시가 짝이 안 맞음`);
    const n = words(strip(b.en ?? ''));
    if (n < 3 || n > 9) bad(`${tag}: 낱말 수 3~9(${n})`);
    if (!/[.?!]\*{0,2}$/.test(String(b.en ?? '').trim())) bad(`${tag}: 문장부호로 끝나야 함`);
    if (hangul.test(b.en ?? '') || !hangul.test(b.ko ?? '')) bad(`${tag}: en 은 영어, ko 는 한국어`);
  }
}
function checkCorrect(list, label, min, bad) {
  if ((list ?? []).length < min) bad(`${label} correct 는 ${min}개 이상(${list?.length})`);
  for (const [i, c] of (list ?? []).entries()) {
    const tag = `${label} correct ${i + 1}`;
    if (c.w.trim() === c.r.trim()) bad(`${tag}: 틀린 문장과 고친 문장이 같음`);
    if (editDistance(tokens(c.w), tokens(c.r)) > 3) bad(`${tag}: 두 문장이 너무 다름(틀린 곳은 한 군데)`);
    if (!hangul.test(c.why ?? '') || hangul.test(c.w) || hangul.test(c.r)) bad(`${tag}: w·r 은 영어, why 는 한국어`);
  }
}
function checkSay(list, label, bad) {
  if (!Array.isArray(list) || list.length !== COUNT.say) bad(`${label} say 는 ${COUNT.say}개(${list?.length})`);
  for (const [i, s] of (list ?? []).entries()) if (!hangul.test(s.task ?? '') || !s.frame || hangul.test(s.frame)) bad(`${label} say ${i + 1}: task 는 한국어, frame 은 영어`);
}
function checkReview(list, label, bad) {
  if (!Array.isArray(list) || list.length !== COUNT.review) bad(`${label} review 는 ${COUNT.review}개(${list?.length})`);
  for (const [i, r] of (list ?? []).entries()) {
    if (!hangul.test(r.ko ?? '') || !hangul.test(r.cond ?? '')) bad(`${label} review ${i + 1}: ko·cond 는 한국어`);
    if (!/[.?!]$/.test(r.model ?? '') || hangul.test(r.model ?? '') || words(r.model) < 2) bad(`${label} review ${i + 1}: model 은 문장부호로 끝나는 영어 문장`);
  }
}
function checkMission(m, label, bad) {
  if (!m?.title || !m?.scene || !Array.isArray(m?.steps) || m.steps.length !== 3) bad(`${label} mission 은 title·scene·steps(3개)`);
}
function checkDiscover(d, label, bad) {
  if (!d?.q || !d?.a || !hangul.test(d.q) || !hangul.test(d.a)) bad(`${label} discover 질문·모범 답(한국어)이 없음`);
  if (d?.q?.length > 170) bad(`${label} discover 질문이 너무 김`);
}

/** 한 주제의 A·B 세트를 검사해 문제 목록을 돌려준다. strictB: B 세트가 있어야 하는지 */
export function checkTopic(it, { requireB = true } = {}) {
  const problems = [];
  const point = pointById[it.id];
  const bad = (m) => problems.push(m);
  if (!point) { bad('문법 id 가 grammarPoints.json 에 없음'); return problems; }
  checkDiscover(it.discover, 'A', bad);
  checkChoose(it.choose, 'A', bad);
  checkBuild(it.buildExtra, 'A', COUNT.buildExtra, bad);
  checkCorrect(it.correct, 'A', COUNT.correctA, bad);
  checkSay(it.say, 'A', bad);
  checkMission(it.mission, 'A', bad);
  checkReview(it.review, 'A', bad);
  for (const w of it.dropPitfalls ?? []) if (!point.pitfalls?.some((x) => strip(x.wrong).trim().toLowerCase() === strip(w).trim().toLowerCase())) bad(`dropPitfalls 에 없는 문장: ${w}`);
  if (requireB || it.b) {
    const b = it.b;
    if (!b) { bad('B 세트가 없음'); return problems; }
    checkDiscover(b.discover, 'B', bad);
    checkChoose(b.choose, 'B', bad);
    checkBuild(b.build, 'B', COUNT.bBuild, bad);
    checkCorrect(b.correct, 'B', COUNT.bCorrect, bad);
    checkSay(b.say, 'B', bad);
    checkMission(b.mission, 'B', bad);
    checkReview(b.review, 'B', bad);
    // A·B 사이 중복
    const a = new Set([...(it.choose ?? []).map((q) => q.p.toLowerCase()), ...(it.correct ?? []).map((c) => strip(c.w).toLowerCase()), ...(it.buildExtra ?? []).map((x) => strip(x.en).toLowerCase()), ...point.examples.map((e) => strip(e).toLowerCase())]);
    for (const q of b.choose ?? []) if (a.has(q.p.toLowerCase())) bad(`B choose 가 A 와 같은 문장: ${q.p}`);
    for (const x of b.build ?? []) if (a.has(strip(x.en).toLowerCase())) bad(`B build 가 A 와 같은 문장: ${x.en}`);
    for (const c of b.correct ?? []) if (a.has(strip(c.w).toLowerCase())) bad(`B correct 가 A 와 같은 문장: ${c.w}`);
  }
  return problems;
}

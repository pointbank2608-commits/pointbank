/**
 * 문의 유사도 계산(2026-10-16, 관리자 자동화 2단계) — AI 없이 글자 두 쌍(bigram) 겹침으로
 *  ① 새 문의와 가장 비슷한 FAQ를 찾아 답변 초안을 만들고
 *  ② 비슷한 문의끼리 묶어 한 번에 답하게 한다.
 * 나중에 AI 초안으로 바꿔도 같은 자리(`suggestFaq`)만 갈아 끼우면 된다.
 */

const FILLER = /(어떻게|어떡해|하나요|해요|할까요|돼요|되나요|있나요|인가요|없어요|안돼요|주세요|궁금|문의|합니다|입니다|알려|질문|혹시|그런데|제가|저는|있어요)/g;

function bigrams(text: string): Set<string> {
  const s = text.toLowerCase().replace(FILLER, ' ').replace(/[^0-9a-z가-힣]/g, '');
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

function intersection(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n += 1;
  return n;
}

/** 두 글 사이의 닮은 정도(0~1) */
export function similarity(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  return (2 * intersection(A, B)) / (A.size + B.size);
}

export interface FaqCandidate {
  id: string;
  q: string;
  a: string;
  link?: string;
}

export interface FaqSuggestion {
  faq: FaqCandidate;
  score: number;
}

/** 문의 글과 가장 비슷한 FAQ(점수 threshold 이상일 때만). 질문 문장과 겹침을 더 무겁게 본다. */
export function suggestFaq(text: string, faqs: FaqCandidate[], threshold = 0.3): FaqSuggestion | null {
  const Q = bigrams(text);
  if (Q.size < 3) return null;
  let best: FaqSuggestion | null = null;
  for (const faq of faqs) {
    const inQ = intersection(Q, bigrams(faq.q)) / Q.size;
    const inA = intersection(Q, bigrams(`${faq.q} ${faq.a}`)) / Q.size;
    const score = 0.6 * inQ + 0.4 * inA;
    if (!best || score > best.score) best = { faq, score };
  }
  return best && best.score >= threshold ? best : null;
}

export interface TicketLike {
  id: string;
  subject: string;
  body: string;
}

/** 비슷한 문의 묶음(2건 이상인 것만). 처음 만난 문의를 기준으로 닮은 것을 모은다. */
export function clusterTickets<T extends TicketLike>(items: T[], threshold = 0.4): T[][] {
  const clusters: { seed: string; list: T[] }[] = [];
  for (const it of items) {
    const text = `${it.subject} ${it.body}`;
    const hit = clusters.find((c) => similarity(c.seed, text) >= threshold);
    if (hit) hit.list.push(it);
    else clusters.push({ seed: text, list: [it] });
  }
  return clusters.filter((c) => c.list.length >= 2).map((c) => c.list);
}

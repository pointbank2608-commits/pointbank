/**
 * Q&A 슬라이드(2026-10-03, 클래스5 무비 수업의 "Q & A"를 참고) 원문 형식.
 * 한 줄에 질문 하나:  [0:41] What happened to Pedro's yogurt? | Pedro's yogurt exploded. | 페드로의 요구르트는 어떻게 됐나요? | 터졌어요.
 *  - [분:초] 는 답이 나오는 장면(선택) — "장면 보기" 버튼이 그 부분을 틀어 준다
 *  - 질문 | 답 | 질문 해석 | 답 해석 (해석은 선택)
 */
export interface QnaItem {
  q: string;
  a: string;
  qKo?: string;
  aKo?: string;
  /** 답이 나오는 장면(영상 전체 기준 초) */
  time?: number;
}

export function parseQnaText(source: string): QnaItem[] {
  const out: QnaItem[] = [];
  for (const raw of source.split(/\r?\n/)) {
    let rest = raw.trim();
    if (!rest) continue;
    let time: number | undefined;
    const m = rest.match(/^\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]\s*/);
    if (m) {
      time = Number(m[1]) * 60 + Number(m[2]);
      rest = rest.slice(m[0].length);
    }
    const [q, a = '', qKo = '', aKo = ''] = rest.split('|').map((s) => s.trim());
    if (q) out.push({ q, a, ...(qKo ? { qKo } : {}), ...(aKo ? { aKo } : {}), ...(time !== undefined ? { time } : {}) });
  }
  return out;
}

export function qnaToText(items: QnaItem[]): string {
  return items
    .map((it) => {
      const mm = it.time !== undefined ? `[${Math.floor(it.time / 60)}:${String(Math.floor(it.time % 60)).padStart(2, '0')}] ` : '';
      const ko = it.qKo || it.aKo ? ` | ${it.qKo ?? ''} | ${it.aKo ?? ''}` : '';
      return `${mm}${it.q} | ${it.a}${ko}`;
    })
    .join('\n');
}

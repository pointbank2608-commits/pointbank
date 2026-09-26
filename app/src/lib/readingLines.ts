/**
 * "노래·지문 한 줄씩" 슬라이드의 원문 형식(2026-09-26).
 *
 * 한 줄에 한 문장:  [0:35] I **like** it. | 나는 그게 좋아.
 *  - 맨 앞 [분:초] 는 선택 — 있으면 그 줄을 영상의 그 시점부터 들려준다.
 *  - | 뒤는 해석(선택).
 *  - ** ** 로 감싼 낱말은 강조(한 줄씩 보기)·빈칸(빈칸 듣기)이 된다.
 * 선생님이 직접 쓰거나, 나중에 AI 원문 분석이 같은 형식으로 채운다.
 * 가사 같은 원문은 이 선생님의 수업(슬라이드) 안에만 저장한다 — 공용 자료로 모으지 않는다(저작권).
 */
export interface ReadingLine {
  en: string;
  ko: string;
  /** 영상 시작 시점(초) */
  start: number | null;
}

export function parseReadingText(source: string): ReadingLine[] {
  return source
    .split(/\r?\n/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      let rest = raw;
      let start: number | null = null;
      const m = rest.match(/^\[(\d{1,2}):(\d{2})\]\s*/);
      if (m) {
        start = Number(m[1]) * 60 + Number(m[2]);
        rest = rest.slice(m[0].length);
      }
      const bar = rest.indexOf('|');
      const en = (bar >= 0 ? rest.slice(0, bar) : rest).trim();
      const ko = bar >= 0 ? rest.slice(bar + 1).trim() : '';
      return { en, ko, start };
    })
    .filter((l) => l.en);
}

/** 빈칸 듣기용 — ** ** 낱말을 밑줄 칸으로 바꾼 조각. */
export function clozeSegments(en: string): { text: string; blank: boolean }[] {
  return en
    .split('**')
    .map((text, i) => ({ text, blank: i % 2 === 1 }))
    .filter((s) => s.text !== '');
}

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
import { parseShadowText } from './shadowLines';

export interface ReadingLine {
  en: string;
  ko: string;
  /** 영상 시작 시점(초) */
  start: number | null;
  end?: number;
}

export function readingCue(start: number, end: number): string {
  const format = (seconds: number) => {
    const [whole, fraction] = seconds.toFixed(3).replace(/\.?0+$/, '').split('.');
    const minutes = Math.floor(Number(whole) / 60);
    return `${minutes}:${String(Number(whole) % 60).padStart(2, '0')}${fraction ? `.${fraction}` : ''}`;
  };
  return `[${format(start)}-${format(end)}]`;
}

/** Older generated cloze slides saved rounded starts. Restore a range only for an unambiguous transcript match. */
export function restoreReadingCues(source: string, transcript: string): string {
  const cues = parseShadowText(transcript);
  const normalize = (text: string) => text.replaceAll('**', '').replace(/\s+/g, ' ').trim();
  return source.split('\n').map(raw => {
    const prefix = raw.match(/^\s*\[\d{1,2}:\d{2}\]\s*/);
    if (!prefix) return raw;
    const line = parseReadingText(raw)[0];
    if (!line || line.start === null) return raw;
    const matches = cues.filter(cue => Math.floor(cue.start) === line.start && normalize(cue.en) === normalize(line.en));
    if (matches.length !== 1) return raw;
    return `${readingCue(matches[0].start, matches[0].end)} ${raw.slice(prefix[0].length)}`;
  }).join('\n');
}

export function parseReadingText(source: string): ReadingLine[] {
  return source
    .split(/\r?\n/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      let rest = raw;
      let start: number | null = null;
      const m = rest.match(/^\[(\d{1,2}):(\d{2}(?:\.\d+)?)(?:\s*[-–—]\s*(\d{1,2}):(\d{2}(?:\.\d+)?))?\]\s*/);
      if (m) {
        start = Number(m[1]) * 60 + Number(m[2]);
        rest = rest.slice(m[0].length);
      }
      const bar = rest.indexOf('|');
      const en = (bar >= 0 ? rest.slice(0, bar) : rest).trim();
      const ko = bar >= 0 ? rest.slice(bar + 1).trim() : '';
      return { en, ko, start, end: m?.[3] ? Number(m[3]) * 60 + Number(m[4]) : undefined };
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

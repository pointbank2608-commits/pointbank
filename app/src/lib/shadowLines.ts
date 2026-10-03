/**
 * 쉐도잉 슬라이드(2026-10-03)의 대사표 형식 — 노래·지문(readingLines.ts) 형식을 넓힌 것.
 *
 * 한 줄에 한 문장:  [0:29.0-0:30.7] Caillou: Can we make a **snowman**? | 우리 눈사람 만들어도 돼요?
 *  - [시작-끝] 은 분:초(소수점 가능). 끝을 빼면 다음 줄 시작까지(마지막 줄은 시작 + 3초).
 *  - "이름:" 은 배역(선택) — 배역 나눠 따라하기에 쓴다.
 *  - | 뒤는 해석(선택), ** ** 는 빈칸 자막에서 비울 낱말.
 * 유튜브 "스크립트 표시"를 복사한 글(0:03 다음 줄에 문장)과 SRT·VTT 자막도 이 형식으로 바꿔 준다(toShadowSource).
 * 영상 대본은 이 선생님의 수업 안에만 저장한다 — 공용 자료로 모으지 않는다(저작권).
 */
export interface ShadowLine {
  en: string;
  ko: string;
  speaker: string | null;
  start: number;
  end: number;
}

const TIME = String.raw`(\d{1,2}):(\d{2}(?:\.\d+)?)`;
const toSec = (m: string, s: string) => Number(m) * 60 + Number(s);

export function parseShadowText(source: string): ShadowLine[] {
  // 시간표 없이 유튜브 "스크립트 표시"·SRT 를 그대로 넣어 둔 대본도 그 자리에서 바꿔 읽는다(이미 저장된 슬라이드도 고쳐진다)
  if (!/^\s*\[\d{1,2}:\d{2}/m.test(source)) {
    const converted = toShadowSource(source);
    if (/^\[\d{1,2}:\d{2}/m.test(converted)) source = converted;
  }
  const rows: { en: string; ko: string; speaker: string | null; start: number | null; end: number | null }[] = [];
  for (const raw of source.split(/\r?\n/)) {
    let rest = raw.trim();
    if (!rest) continue;
    let start: number | null = null;
    let end: number | null = null;
    const m = rest.match(new RegExp(String.raw`^\[${TIME}(?:\s*-\s*${TIME})?\]\s*`));
    if (m) {
      start = toSec(m[1], m[2]);
      if (m[3] !== undefined) end = toSec(m[3], m[4]);
      rest = rest.slice(m[0].length);
    }
    let speaker: string | null = null;
    const sp = rest.match(/^([A-Za-z][\w .'-]{0,19}):\s+/);
    if (sp) {
      speaker = sp[1].trim();
      rest = rest.slice(sp[0].length);
    }
    const bar = rest.indexOf('|');
    const en = (bar >= 0 ? rest.slice(0, bar) : rest).trim();
    const ko = bar >= 0 ? rest.slice(bar + 1).trim() : '';
    if (en) rows.push({ en, ko, speaker, start, end });
  }
  // 시간이 없는 줄은 앞 줄 끝에 이어 붙이고, 끝이 없는 줄은 다음 줄 시작까지로 채운다
  let clock = 0;
  return rows.map((r, i) => {
    const start = r.start ?? clock;
    const nextStart = rows.slice(i + 1).find((x) => x.start !== null)?.start ?? null;
    const end = r.end ?? (nextStart !== null && nextStart > start ? nextStart : start + 3);
    clock = end;
    return { en: r.en, ko: r.ko, speaker: r.speaker, start, end: Math.max(end, start + 0.5) };
  });
}

/** 배역 목록(나온 순서대로). */
export function shadowSpeakers(lines: ShadowLine[]): string[] {
  return [...new Set(lines.map((l) => l.speaker).filter((s): s is string => !!s))];
}

const fmt = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
};

/**
 * 붙여넣은 글을 대사표로 바꾼다 — 이미 대사표 형식이면 그대로 둔다.
 *  - 유튜브 "스크립트 표시" 복사: "0:03" 줄 다음에 문장 줄(또는 "0:03 문장")
 *  - SRT/VTT: "00:00:03,000 --> 00:00:05,500" 다음에 문장
 */
export function toShadowSource(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  if (lines.some((l) => /^\[\d{1,2}:\d{2}/.test(l))) return text.trim();

  const out: { start: number; end: number | null; text: string }[] = [];
  const cue = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})\s*-->\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;
  if (lines.some((l) => cue.test(l))) {
    let cur: { start: number; end: number | null; text: string } | null = null;
    for (const l of lines) {
      const m = l.match(cue);
      if (m) {
        if (cur?.text) out.push(cur);
        const s = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(`0.${m[4]}`);
        const e = Number(m[5] ?? 0) * 3600 + Number(m[6]) * 60 + Number(m[7]) + Number(`0.${m[8]}`);
        cur = { start: s, end: e, text: '' };
      } else if (cur && l && !/^\d+$/.test(l) && l !== 'WEBVTT') {
        cur.text = `${cur.text} ${l.replace(/<[^>]+>/g, '')}`.trim();
      }
    }
    if (cur?.text) out.push(cur);
  } else {
    // 유튜브 "스크립트 표시" 복사본. 화면 읽기용 글이 시간 뒤에 붙어 온다: "0:033초[Music]", "1:091분 9초gilbert where…",
    // 영어 화면이면 "0:033 seconds…". 시간 뒤의 "3초"·"1분 9초"·"3 seconds" 는 버리고, [Music] 같은 소리 표시는 문장으로 쓰지 않는다
    // (대신 앞 문장의 끝 시간으로 쓴다). "스크립트 검색"·"챕터 1: …" 같은 머리 줄은 첫 시간 앞이라 저절로 빠진다(2026-10-03 제보).
    const stamp = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*((?:\d+\s*(?:시간|분|초|hours?|minutes?|seconds?)\s*,?\s*)*)(.*)$/i;
    const noise = /^\s*[[(（][^\])）]*[\])）]\s*$/;
    let cur: { start: number; end: number | null; text: string } | null = null;
    const flush = (nextStart: number | null) => {
      if (!cur) return;
      if (cur.text && !noise.test(cur.text)) out.push(cur);
      else if (nextStart === null && out.length) out[out.length - 1].end ??= cur.start;
      else if (out.length && out[out.length - 1].end === null) out[out.length - 1].end = cur.start;
    };
    for (const l of lines) {
      const m = l.match(stamp);
      if (m) {
        const start = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
        flush(start);
        cur = { start, end: null, text: m[5].trim() };
      } else if (cur && l && !/^\d+\s*(?:시간|분|초|hours?|minutes?|seconds?)/i.test(l)) {
        cur.text = `${cur.text} ${l}`.trim();
      }
    }
    flush(null);
    // 자동 자막은 소문자로 시작한다 — 첫 글자만 대문자로, 나 혼자인 i 도 I 로
    for (const o of out) o.text = o.text.replace(/^[a-z]/, (c) => c.toUpperCase()).replace(/\bi\b/g, 'I');
  }
  if (out.length === 0) return text.trim();
  return out.map((o) => `[${fmt(o.start)}${o.end !== null ? `-${fmt(o.end)}` : ''}] ${o.text.replace(/\s+/g, ' ')}`).join('\n');
}

/** 빈칸 자막 — ** ** 낱말을 밑줄 칸으로. 표시된 낱말이 없으면 4글자 이상 낱말 중 하나를 고정으로 비운다. */
export function shadowCloze(en: string, seed: number): { text: string; blank: boolean }[] {
  if (en.includes('**')) {
    return en
      .split('**')
      .map((text, i) => ({ text, blank: i % 2 === 1 }))
      .filter((s) => s.text !== '');
  }
  const parts = en.split(/(\s+)/);
  const candidates = parts.map((p, i) => ({ p, i })).filter(({ p }) => /^[A-Za-z']{4,}/.test(p));
  if (candidates.length === 0) return [{ text: en, blank: false }];
  const pick = candidates[seed % candidates.length].i;
  return parts.flatMap((p, i) => {
    if (i !== pick) return [{ text: p, blank: false }];
    const word = p.match(/^[A-Za-z']+/)![0];
    const tail = p.slice(word.length);
    return tail ? [{ text: word, blank: true }, { text: tail, blank: false }] : [{ text: word, blank: true }];
  });
}

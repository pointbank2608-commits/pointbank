import type { SoloStep } from './soloLessons';

/**
 * 개별수업 문제 → 인쇄물(2026-10-12). 화면에서 푸는 것과 **같은 문제 단계**로 A4 시트와 정답지를 만든다 —
 * 그래서 화면과 인쇄물의 내용이 어긋나지 않는다(BLOCK_SPEC §3: 같은 블록, 쓰는 자리에 맞춰 다르게 그린다).
 * 결과는 스스로 완결된 HTML 문자열(인라인 스타일, 앱 CSS 불필요)이라 새 창에 써서 인쇄하거나 iframe 미리보기에 쓴다.
 * 순서: 문제 장(번호 이어서) → 정답지(마지막 장). 그림은 절대 주소로 바꿔 넣는다.
 */

/** 인쇄할 수 있는 문제 종류 */
export const PRINTABLE_STEP_TYPES: SoloStep['t'][] = [
  'pickWord',
  'pickMeaning',
  'pickPos',
  'listenPick',
  'fillBlank',
  'lyricBlank',
  'translatePick',
  'pickCorrect',
  'sayPick',
  'spell',
  'typeWord',
  'dictation',
  'unscramble',
  'gapType',
  'lineOrder',
];

export const isPrintableStep = (s: SoloStep): boolean => PRINTABLE_STEP_TYPES.includes(s.t);

export type PrintT = (key: string, vars?: Record<string, string | number>) => string;

export interface PrintOptions {
  title: string;
  /** 마지막에 정답지 장을 붙인다 */
  includeAnswers: boolean;
  /** 빈칸 쓰기 앞에 낱말 은행(섞은 정답 목록)을 보여 준다 */
  showBank: boolean;
  /** 그림 주소를 절대 주소로 바꿀 기준(브라우저면 location.origin) */
  origin?: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥'];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function absUrl(u: string | null | undefined, origin: string): string | null {
  if (!u) return null;
  if (/^(https?:|data:)/i.test(u)) return u;
  return `${origin}${u.startsWith('/') ? '' : '/'}${u}`;
}

/** "_____" 를 밑줄 칸으로 */
function blankHtml(sentence: string, width = 24): string {
  return esc(sentence).replace(/_{3,}/g, `<span class="blank" style="min-width:${width}mm"></span>`);
}

function choices(options: string[]): string {
  return `<div class="choices">${options.map((o, i) => `<span class="ch">${CIRCLED[i] ?? `${i + 1}.`} ${esc(o)}</span>`).join('')}</div>`;
}

/** 정답 순서를 보기 글자(A, B …)로: 섞인 pieces 에서 lines 의 각 줄이 어디 있는지 */
export function lineOrderLetters(lines: string[], pieces: string[]): string[] {
  const used = new Set<number>();
  return lines.map((l) => {
    let idx = pieces.findIndex((p, i) => !used.has(i) && p === l);
    if (idx < 0) idx = pieces.findIndex((p, i) => !used.has(i) && p.trim().toLowerCase() === l.trim().toLowerCase());
    if (idx >= 0) used.add(idx);
    return idx >= 0 ? (LETTERS[idx] ?? String(idx + 1)) : '?';
  });
}

interface Rendered {
  body: string;
  answer: string;
}

function render(step: SoloStep, no: number, t: PrintT, origin: string): Rendered | null {
  const n = `<span class="no">${no}</span>`;
  const ko = (s: string | undefined) => (s && s.trim() ? `<div class="ko">${esc(s)}</div>` : '');
  switch (step.t) {
    case 'gapType': {
      const w = Math.max(18, Math.min(60, step.word.length * 3.4));
      return {
        body: `<div class="q">${n}<span class="sent">${blankHtml(step.sentence, w)}</span>${ko(step.ko)}</div>`,
        answer: esc(step.word),
      };
    }
    case 'fillBlank':
    case 'lyricBlank': {
      const meaning = step.t === 'fillBlank' ? step.meaning : step.ko;
      return {
        body: `<div class="q">${n}<span class="sent">${blankHtml(step.sentence)}</span>${ko(meaning)}${choices(step.options)}</div>`,
        answer: `${CIRCLED[step.answer] ?? step.answer + 1} ${esc(step.options[step.answer] ?? '')}`,
      };
    }
    case 'lineOrder': {
      const letters = lineOrderLetters(step.lines, step.pieces);
      const rows = step.pieces.map((p, i) => `<div class="piece"><b>${LETTERS[i] ?? i + 1}</b> ${esc(p)}</div>`).join('');
      const slots = step.pieces.map(() => '<span class="slot"></span>').join('<span class="arrow">→</span>');
      return {
        body: `<div class="q">${n}<span class="inst-inline">${esc(t('soloPrint.lineOrderAsk'))}</span><div class="pieces">${rows}</div><div class="order">${slots}</div></div>`,
        answer: letters.join(' → '),
      };
    }
    case 'unscramble': {
      const chips = step.words.map((w) => `<span class="chip">${esc(w)}</span>`).join('');
      return {
        body: `<div class="q">${n}<span class="inst-inline">${esc(t('soloPrint.unscrambleAsk'))}</span><div class="chips">${chips}</div><div class="line"></div></div>`,
        answer: esc(step.sentence),
      };
    }
    case 'spell': {
      const chips = step.letters.map((w) => `<span class="chip sm">${esc(w)}</span>`).join('');
      const img = absUrl(step.imageUrl, origin);
      return {
        body: `<div class="q">${n}${img ? `<img class="pic" src="${esc(img)}" alt="">` : ''}<span class="sent">${esc(step.meaning)}</span><div class="chips">${chips}</div><div class="line short"></div></div>`,
        answer: esc(step.word),
      };
    }
    case 'typeWord': {
      const img = absUrl(step.imageUrl, origin);
      return {
        body: `<div class="q">${n}${img ? `<img class="pic" src="${esc(img)}" alt="">` : ''}<span class="sent">${esc(step.meaning)}</span><span class="hint">${esc(step.first)}${'_ '.repeat(Math.max(0, step.length - 1)).trim()}</span><div class="line short"></div></div>`,
        answer: esc(step.word),
      };
    }
    case 'dictation':
      return {
        body: `<div class="q">${n}<span class="inst-inline">${esc(t('soloPrint.dictationAsk'))}</span><div class="line short"></div></div>`,
        answer: esc(step.word),
      };
    case 'pickWord': {
      const img = absUrl(step.imageUrl, origin);
      return {
        body: `<div class="q">${n}${img ? `<img class="pic" src="${esc(img)}" alt="">` : ''}<span class="sent">${esc(step.meaning)}</span>${choices(step.options)}</div>`,
        answer: `${CIRCLED[step.answer] ?? step.answer + 1} ${esc(step.options[step.answer] ?? '')}`,
      };
    }
    case 'pickMeaning': {
      const img = absUrl(step.imageUrl, origin);
      return {
        body: `<div class="q">${n}${img ? `<img class="pic" src="${esc(img)}" alt="">` : ''}<span class="sent big">${esc(step.word)}</span>${choices(step.options)}</div>`,
        answer: `${CIRCLED[step.answer] ?? step.answer + 1} ${esc(step.options[step.answer] ?? '')}`,
      };
    }
    case 'pickPos':
      return {
        body: `<div class="q">${n}<span class="sent">${esc(step.sentence ?? step.word)}</span>${step.sentence ? `<div class="ko">${esc(step.word)}</div>` : ''}${choices(step.options)}</div>`,
        answer: `${CIRCLED[step.answer] ?? step.answer + 1} ${esc(step.options[step.answer] ?? '')}`,
      };
    case 'listenPick':
      return {
        body: `<div class="q">${n}<span class="inst-inline">${esc(t('soloPrint.listenAsk'))}</span>${choices(step.options)}</div>`,
        answer: `${CIRCLED[step.answer] ?? step.answer + 1} ${esc(step.options[step.answer] ?? '')}`,
      };
    case 'translatePick':
      return {
        body: `<div class="q">${n}<span class="sent">${esc(step.sentence)}</span>${choices(step.options)}</div>`,
        answer: `${CIRCLED[step.answer] ?? step.answer + 1} ${esc(step.options[step.answer] ?? '')}`,
      };
    case 'pickCorrect':
      return {
        body: `<div class="q">${n}<span class="inst-inline">${esc(t('soloPrint.correctAsk'))}</span>${choices(step.options)}</div>`,
        answer: `${CIRCLED[step.answer] ?? step.answer + 1} ${esc(step.options[step.answer] ?? '')}`,
      };
    case 'sayPick':
      return {
        body: `<div class="q">${n}<span class="sent">${esc(step.situation)}</span>${choices(step.options)}</div>`,
        answer: `${CIRCLED[step.answer] ?? step.answer + 1} ${esc(step.options[step.answer] ?? '')}`,
      };
    default:
      return null;
  }
}

const CSS = `
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #000; font-family: 'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',system-ui,sans-serif; font-size: 13.5px; line-height: 1.6; }
.page { padding: 0; }
.page + .page { break-before: page; page-break-before: always; }
header { display: flex; align-items: flex-end; justify-content: space-between; gap: 8mm; margin-bottom: 5mm; }
h1 { margin: 0; font-size: 21px; border: 2px solid #1e4b7a; color: #1e4b7a; border-radius: 99px; padding: 1.5mm 6mm; }
.who { display: flex; gap: 6mm; font-size: 12.5px; white-space: nowrap; }
.who span.f { display: inline-block; border-bottom: 1px solid #000; }
.who .n { width: 36mm; } .who .d { width: 26mm; }
.inst { border: 1px solid #c2c6d2; background: #f3f6fa; border-radius: 6px; padding: 2mm 4mm; margin: 3mm 0 4mm; font-size: 13.5px; }
.bank { border: 1.5px dashed #555; border-radius: 6px; padding: 2.5mm 4mm; margin: 0 0 5mm; }
.bank b { margin-right: 3mm; }
.bank span { display: inline-block; margin: 0 4mm 0 0; font-weight: 600; }
.q { break-inside: avoid; page-break-inside: avoid; margin: 0 0 5.5mm; }
.no { display: inline-block; min-width: 7mm; height: 7mm; line-height: 7mm; text-align: center; border-radius: 50%; background: #1e4b7a; color: #fff; font-weight: 700; font-size: 12.5px; margin-right: 2.5mm; }
.sent { font-size: 16px; font-weight: 600; }
.sent.big { font-size: 22px; }
.blank { display: inline-block; border-bottom: 1.4px solid #000; height: 1.1em; vertical-align: baseline; margin: 0 1mm; }
.ko { margin: 0.8mm 0 0 10mm; color: #555; font-size: 12.5px; }
.choices { margin: 1.5mm 0 0 10mm; }
.ch { display: inline-block; margin-right: 6mm; font-size: 15px; }
.inst-inline { font-size: 13px; color: #444; margin-right: 3mm; }
.pieces { margin: 2mm 0 2mm 10mm; }
.piece { font-size: 15.5px; padding: 1.2mm 3mm; margin-bottom: 1.5mm; border: 1px solid #999; border-radius: 6px; }
.piece b { display: inline-block; min-width: 6mm; color: #1e4b7a; }
.order { margin: 3mm 0 0 10mm; font-size: 14px; }
.slot { display: inline-block; width: 12mm; height: 8mm; border: 1.3px solid #000; border-radius: 4px; vertical-align: middle; }
.arrow { margin: 0 2.5mm; }
.chips { margin: 2mm 0 0 10mm; }
.chip { display: inline-block; padding: 1mm 3.5mm; margin: 0 2.5mm 2mm 0; border: 1.3px solid #000; border-radius: 6px; font-size: 16px; font-weight: 600; background: #fff; }
.chip.sm { padding: 0.6mm 2.6mm; font-size: 18px; }
.line { border-bottom: 1.3px solid #000; height: 9mm; margin: 1mm 0 0 10mm; }
.line.short { width: 70mm; }
.hint { margin-left: 4mm; letter-spacing: 1px; color: #555; font-family: monospace; font-size: 16px; }
.pic { width: 24mm; height: 24mm; object-fit: contain; vertical-align: middle; margin-right: 3mm; border: 1px solid #ddd; border-radius: 6px; }
.ans h2 { margin: 0 0 4mm; font-size: 18px; }
.ans ol { margin: 0; padding: 0; list-style: none; columns: 2; column-gap: 12mm; }
.ans li { break-inside: avoid; margin-bottom: 2mm; font-size: 14.5px; }
.ans li b { display: inline-block; min-width: 8mm; color: #1e4b7a; }
`;

/** 문제 단계 → 인쇄 HTML. 인쇄할 수 없는 단계는 건너뛴다. 문제가 하나도 없으면 null. */
export function buildSoloPrintHtml(steps: SoloStep[], opts: PrintOptions, t: PrintT): string | null {
  const origin = opts.origin ?? '';
  const questions = steps.filter(isPrintableStep);
  if (questions.length === 0) return null;

  const parts: string[] = [];
  const answers: string[] = [];
  let no = 0;
  let prevType: SoloStep['t'] | null = null;

  // 낱말 은행: 빈칸 쓰기 정답을 섞어서
  const gaps = questions.filter((s): s is Extract<SoloStep, { t: 'gapType' }> => s.t === 'gapType');
  const bank = opts.showBank && gaps.length > 0 ? `<div class="bank"><b>${esc(t('soloPrint.bank'))}</b>${shuffled(gaps.map((g) => g.word)).map((w) => `<span>${esc(w)}</span>`).join('')}</div>` : '';

  for (const q of questions) {
    no += 1;
    const r = render(q, no, t, origin);
    if (!r) {
      no -= 1;
      continue;
    }
    if (q.t !== prevType) {
      parts.push(`<div class="inst">${esc(t(`soloPrint.inst_${q.t}`))}</div>`);
      if (q.t === 'gapType' && bank) parts.push(bank);
      prevType = q.t;
    }
    parts.push(r.body);
    answers.push(`<li><b>${no}</b> ${r.answer}</li>`);
  }

  const header = `<header><h1>${esc(opts.title)}</h1><div class="who"><span>${esc(t('soloPrint.name'))}: <span class="f n">&nbsp;</span></span><span>${esc(t('soloPrint.date'))}: <span class="f d">&nbsp;</span></span></div></header>`;
  const answerPage = opts.includeAnswers
    ? `<section class="page ans"><h2>${esc(opts.title)} — ${esc(t('soloPrint.answerKey'))}</h2><ol>${answers.join('')}</ol></section>`
    : '';
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(opts.title)}</title><style>${CSS}</style></head><body><section class="page">${header}${parts.join('')}</section>${answerPage}</body></html>`;
}

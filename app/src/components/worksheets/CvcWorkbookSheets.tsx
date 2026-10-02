import type { ReactNode } from 'react';
import TracingRow from './TracingRow';
import { FONT_LETTER, FONT_TITLE } from './cuteTheme';
import { CVC_UNITS, CVC_VOWELS, cvcCircleRows, cvcImage, cvcLineart, cvcMatchOrder, type CvcUnit } from '../../data/cvcWorkbook';

// 치수는 mm — A4 세로(내용 높이 273mm 이내) 한 장에 활동 세 개가 들어가게 맞췄다. 크기를 바꾸면 높이를 다시 잴 것.
const TONES = [
  { main: '#f4a300', bg: '#ffe9a8' },
  { main: '#f0608f', bg: '#ffd9e6' },
  { main: '#2f9be6', bg: '#dff0fd' },
  { main: '#a36ad8', bg: '#ead9f8' },
  { main: '#f28a2e', bg: '#ffdcbc' },
  { main: '#6fbf73', bg: '#e3f4e2' },
];
const VOWEL_RED = '#e11d2e';

/** 낱말을 쓰되 모음 글자만 빨갛게. blank 면 모음 자리를 빈칸 상자로. */
function Word({ word, vowel, size, blank = false }: { word: string; vowel: string; size: number; blank?: boolean }) {
  const at = word.toLowerCase().indexOf(vowel);
  return (
    <span style={{ fontFamily: FONT_LETTER, fontSize: `${size}mm`, fontWeight: 700, lineHeight: 1, letterSpacing: '0.04em', color: '#1b1b1b', display: 'inline-flex', alignItems: 'center' }}>
      {[...word].map((ch, i) =>
        i === at ? (
          blank ? (
            <span key={i} style={{ display: 'inline-block', width: `${size * 0.95}mm`, height: `${size * 1.15}mm`, margin: `0 ${size * 0.12}mm`, borderRadius: '2.5mm', background: '#fbeecb', border: '0.4mm solid #e6c97a' }} />
          ) : (
            <span key={i} style={{ color: VOWEL_RED }}>
              {ch}
            </span>
          )
        ) : (
          <span key={i}>{ch}</span>
        ),
      )}
    </span>
  );
}

function Section({ n, title, height, children }: { n: number; title: string; height: number; children: ReactNode }) {
  const tone = TONES[(n - 1) % TONES.length];
  return (
    <section style={{ marginBottom: '4mm' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '3mm', height: '10mm', marginBottom: '2mm' }}>
        <span style={{ width: '10mm', height: '10mm', borderRadius: '50%', background: tone.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_TITLE, fontWeight: 700, fontSize: '5.5mm', color: '#1b1b1b' }}>
          {n}
        </span>
        <span style={{ height: '10mm', padding: '0 7mm', borderRadius: '3mm', background: tone.bg, display: 'inline-flex', alignItems: 'center', fontFamily: FONT_TITLE, fontWeight: 600, fontSize: '5.6mm', color: '#1b1b1b' }}>
          {title}
        </span>
      </div>
      <div style={{ height: `${height}mm`, border: `0.7mm solid ${tone.main}`, borderRadius: '3mm', boxSizing: 'border-box', padding: '3mm 5mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
        {children}
      </div>
    </section>
  );
}

function Picture({ src, size }: { src: string; size: number }) {
  return <img src={src} alt="" style={{ width: `${size}mm`, height: `${size}mm`, objectFit: 'cover', borderRadius: '2.5mm', flexShrink: 0 }} />;
}

function Sheet({ unit, page, children }: { unit: CvcUnit; page: number; children: ReactNode }) {
  return (
    <div className="print-board bg-white text-black" style={{ width: '186mm', margin: '0 auto' }}>
      <div style={{ height: '15mm', marginBottom: '4mm', background: '#f8e9c0', borderRadius: '3mm', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_TITLE, fontWeight: 700, fontSize: '7.5mm', letterSpacing: '0.03em', color: '#1b1b1b' }}>
        UNIT {unit.unit}.&nbsp; SHORT VOWEL {unit.vowel.toUpperCase()}
      </div>
      {children}
      <div style={{ textAlign: 'right', fontFamily: FONT_LETTER, fontSize: '3.6mm', color: '#555', height: '5mm' }}>
        {unit.family} · {page}
      </div>
    </div>
  );
}

/** 유닛 하나의 A4 두 장. */
export function CvcUnitPages({ unit }: { unit: CvcUnit }) {
  const v = unit.vowel;
  const circle = cvcCircleRows(unit);
  const matchRight = cvcMatchOrder(unit);
  const row = { display: 'flex', alignItems: 'center' } as const;
  return (
    <>
      <Sheet unit={unit} page={unit.unit * 2 - 1}>
        <Section n={1} title="Look and Say" height={64}>
          <div style={{ ...row, justifyContent: 'space-around' }}>
            {unit.words.map((w) => (
              <div key={w} style={{ width: '50mm', border: '0.6mm solid #ffd966', borderRadius: '3mm', padding: '2.5mm', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2mm' }}>
                <Picture src={cvcImage(w)} size={36} />
                <div style={{ width: '100%', height: '14mm', borderRadius: '3mm', background: '#ffe066', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Word word={w} vowel={v} size={9.5} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section n={2} title="Read and Write" height={66}>
          {unit.words.map((w) => (
            <div key={w} style={{ ...row, gap: '5mm' }}>
              <Picture src={cvcImage(w)} size={13} />
              <div style={{ width: '24mm' }}>
                <Word word={w} vowel={v} size={7} />
              </div>
              <div style={{ flex: 1, ['--trace-stroke' as string]: '#9aa3b5' }}>
                <TracingRow word={w} trace last rowMm={12} emMm={12.5} />
              </div>
            </div>
          ))}
        </Section>

        <Section n={3} title="Circle the Correct Word" height={56}>
          {circle.map(({ word, choices }) => (
            <div key={word} style={{ ...row, gap: '10mm' }}>
              <Picture src={cvcImage(word)} size={13} />
              <div style={{ flex: 1, height: '12.5mm', border: '0.5mm solid #2f9be6', borderRadius: '3mm', display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
                {choices.map((c) => (
                  <Word key={c} word={c} vowel={v} size={6.5} />
                ))}
              </div>
            </div>
          ))}
        </Section>
      </Sheet>

      <Sheet unit={unit} page={unit.unit * 2}>
        <Section n={4} title="Match" height={60}>
          {unit.words.map((w, i) => (
            <div key={w} style={{ ...row, justifyContent: 'space-between', padding: '0 14mm' }}>
              <div style={{ ...row, gap: '6mm' }}>
                <Word word={w} vowel={v} size={7.5} />
                <span style={{ width: '2.4mm', height: '2.4mm', borderRadius: '50%', background: '#1b1b1b' }} />
              </div>
              <div style={{ ...row, gap: '6mm' }}>
                <span style={{ width: '2.4mm', height: '2.4mm', borderRadius: '50%', background: '#1b1b1b' }} />
                <Picture src={cvcImage(matchRight[i])} size={14} />
              </div>
            </div>
          ))}
        </Section>

        <Section n={5} title="Complete the Word" height={66}>
          <div style={{ ...row, justifyContent: 'space-around' }}>
            {unit.words.map((w) => (
              <div key={w} style={{ width: '50mm', height: '57mm', border: '0.6mm solid #ffd966', borderRadius: '3mm', padding: '2.5mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
                <Picture src={cvcImage(w)} size={34} />
                <Word word={w} vowel={v} size={10.5} blank />
              </div>
            ))}
          </div>
        </Section>

        <Section n={6} title="Color" height={66}>
          <div style={{ ...row, justifyContent: 'space-around' }}>
            {unit.words.map((w) => (
              <div key={w} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2mm' }}>
                <img src={cvcLineart(w)} alt="" style={{ width: '46mm', height: '44mm', objectFit: 'contain' }} />
                <Word word={w} vowel={v} size={7.5} />
              </div>
            ))}
          </div>
        </Section>
      </Sheet>
    </>
  );
}

/** 유닛 고르기 — 모음별로 묶은 칩. 자료실 페이지와 수업 만들기의 슬라이드 설정이 같이 쓴다. */
export function CvcUnitPicker({ selected, onChange, vowelLabel }: { selected: number[]; onChange: (units: number[]) => void; vowelLabel: (vowel: string) => string }) {
  const toggle = (unit: number) => onChange(selected.includes(unit) ? selected.filter((u) => u !== unit) : [...selected, unit].sort((a, b) => a - b));
  return (
    <div className="space-y-2">
      {CVC_VOWELS.map((vowel) => {
        const units = CVC_UNITS.filter((u) => u.vowel === vowel);
        const all = units.every((u) => selected.includes(u.unit));
        return (
          <div key={vowel} className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChange(all ? selected.filter((n) => !units.some((u) => u.unit === n)) : [...new Set([...selected, ...units.map((u) => u.unit)])].sort((a, b) => a - b))}
              className={`w-24 shrink-0 rounded-lg px-3 py-1.5 text-left font-label-md text-label-md transition-colors ${
                all ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface hover:bg-secondary-container/50'
              }`}
            >
              {vowelLabel(vowel)}
            </button>
            {units.map((u) => {
              const on = selected.includes(u.unit);
              return (
                <button
                  key={u.unit}
                  type="button"
                  onClick={() => toggle(u.unit)}
                  title={u.words.join(', ')}
                  className={`rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${
                    on ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/50 hover:bg-secondary-container/40'
                  }`}
                >
                  {u.unit}. {u.words.join(' · ')}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

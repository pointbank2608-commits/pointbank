import type { CSSProperties, ReactNode } from 'react';
import { parseMarked } from '../../lib/grammar';
import { KEY_PAGES, KIND_PAGES, PER_PAGE, type SheetData, type SheetKind, type Support } from '../../lib/grammarSheets';
import { GrammarExerciseBlock, GrammarSheet } from './GrammarWorkbookSheets';
import { FONT_TITLE } from './cuteTheme';

export const KIND_NAMES: Record<SheetKind, { ko: string; en: string; sub: string }> = {
  discover: { ko: '규칙 발견', en: 'Discover the rule', sub: '예문을 보고 규칙을 스스로 찾아요' },
  choose: { ko: '고르기', en: 'Choose', sub: '알맞은 것을 골라요' },
  build: { ko: '빈칸·배열', en: 'Build', sub: '직접 만들어 써요' },
  correct: { ko: '고쳐 쓰기', en: 'Fix it', sub: '틀린 곳을 찾아 고쳐요' },
  say: { ko: '말하기 미션', en: 'Speak', sub: '짝과 말하면서 써요' },
  review: { ko: '총정리', en: 'Review', sub: '섞어서 다시 확인해요' },
};

const line: CSSProperties = { borderBottom: '0.3mm solid #8d99ae', height: '8mm' };
const body: CSSProperties = { fontSize: '4.2mm', lineHeight: 1.55 };
const small: CSSProperties = { fontSize: '3.5mm', lineHeight: 1.5, color: '#4b587c' };
const num = (i: number) => `${i + 1}. `;

function Marked({ text }: { text: string }) {
  return <>{parseMarked(text).map((seg, i) => seg.strong ? <strong key={i} style={{ background: '#ffe9a6', borderRadius: '1mm', padding: '0 0.6mm', color: '#c23b2a' }}>{seg.text}</strong> : <span key={i}>{seg.text}</span>)}</>;
}
function Lines({ n }: { n: number }) {
  return <>{Array.from({ length: n }, (_, i) => <div key={i} style={line} />)}</>;
}
function Stars({ support }: { support: Support }) {
  return <span aria-label={`level ${support}`} style={{ marginLeft: '2mm', color: '#f2a516' }}>{'★'.repeat(support)}{'☆'.repeat(3 - support)}</span>;
}
function RuleBox({ data }: { data: SheetData }) {
  return <div style={{ background: '#e8f3fd', borderRadius: '2.5mm', padding: '2.5mm 4mm', marginBottom: '3.5mm', ...small }}>
    <strong>기억해요</strong> · {data.point.rule?.join(' / ') ?? data.point.explain}
  </div>;
}
/** 시트가 여러 쪽일 때의 몇 번째 쪽(0부터) */
type PartProps = { part?: number };
function Shell({ data, kind, support, teacher, part = 0, children }: { data: SheetData; kind: SheetKind; support: Support; teacher: boolean; part?: number; children: ReactNode }) {
  const name = KIND_NAMES[kind];
  const pages = KIND_PAGES[kind];
  return <GrammarSheet title={`${data.point.name}`} subtitle={`${name.ko}${pages > 1 ? ` ${part + 1}/${pages}` : ''} · 세트 ${data.set} · ${name.sub}`} teacher={teacher}>
    <div style={{ marginTop: '-1mm', marginBottom: '3mm', display: 'flex', justifyContent: 'space-between', ...small }}>
      <span>이름 ______________ · 날짜 ____ / ____</span><span>도움 수준<Stars support={support} /></span>
    </div>
    {children}
  </GrammarSheet>;
}

export function DiscoverSheet({ data, support }: { data: SheetData; support: Support }) {
  return <Shell data={data} kind="discover" support={support} teacher={false}>
    <GrammarExerciseBlock title="1. Look at the sentences.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2mm 5mm' }}>
        {data.discover.examples.map((e, i) => <div key={i} style={{ ...body, padding: '1mm 0' }}>
          <div><span style={{ color: '#8d99ae' }}>{num(i)}</span><Marked text={e.raw} /></div>
          {support < 3 && e.ko && <div style={small}>{e.ko}</div>}
        </div>)}
      </div>
    </GrammarExerciseBlock>
    <GrammarExerciseBlock title="2. Find the rule." color="#f0608f">
      <p style={body}>{data.discover.q}</p>
      {support === 1 && <p style={{ ...small, marginTop: '1mm' }}>힌트: 굵은 글자 앞의 낱말(주어)과 굵은 글자를 함께 살펴보세요.</p>}
      <Lines n={3} />
    </GrammarExerciseBlock>
    <GrammarExerciseBlock title="3. My rule box." color="#6fbf73">
      <p style={small}>찾은 규칙을 한 문장으로 정리하고, 내가 만든 예문을 하나 써 보세요.</p>
      <Lines n={2} />
    </GrammarExerciseBlock>
  </Shell>;
}

export function ChooseSheet({ data, support, part = 0 }: { data: SheetData; support: Support } & PartProps) {
  const from = part * PER_PAGE.choose;
  return <Shell data={data} kind="choose" support={support} teacher={false} part={part}>
    {support === 1 && <RuleBox data={data} />}
    <GrammarExerciseBlock title="1. Circle the correct answer.">
      <ol style={{ listStyle: 'none', padding: 0 }}>
        {data.choose.slice(from, from + PER_PAGE.choose).map((q, k) => { const i = from + k; return <li key={i} style={{ ...body, padding: '2.2mm 0', borderBottom: '0.2mm dashed #c7d0e0' }}>
          <span style={{ color: '#8d99ae' }}>{num(i)}</span>{q.p}
          <span style={{ marginLeft: '4mm', whiteSpace: 'nowrap' }}>( {q.c.join(' / ')} )</span>
          {support === 3 && <div style={{ ...small, marginTop: '1mm' }}>Why? ________________________________________</div>}
        </li>; })}
      </ol>
    </GrammarExerciseBlock>
  </Shell>;
}

export function BuildSheet({ data, support, part = 0 }: { data: SheetData; support: Support } & PartProps) {
  const from = part * PER_PAGE.fill;
  const fill = data.fill.slice(from, from + PER_PAGE.fill);
  const order = data.order.slice(part * PER_PAGE.order, part * PER_PAGE.order + PER_PAGE.order);
  return <Shell data={data} kind="build" support={support} teacher={false} part={part}>
    {support === 1 && <RuleBox data={data} />}
    <GrammarExerciseBlock title="1. Complete the sentences." color="#f0608f">
      {fill.map((q, k) => <div key={k} style={{ ...body, padding: '1.4mm 0' }}>
        <span style={{ color: '#8d99ae' }}>{num(from + k)}</span>{q.prompt}
        {support < 3 && <span style={{ marginLeft: '3mm', color: '#4b587c' }}>({q.hint})</span>}
        {q.ko && <div style={small}>{q.ko}</div>}
      </div>)}
    </GrammarExerciseBlock>
    {order.length > 0 && <GrammarExerciseBlock title="2. Put the words in order." color="#6fbf73">
      {order.map((q, k) => <div key={k} style={{ padding: '1.4mm 0' }}>
        <div style={{ ...body, display: 'flex', flexWrap: 'wrap', gap: '2mm' }}>
          <span style={{ color: '#8d99ae' }}>{num(part * PER_PAGE.order + k)}</span>
          {q.words.map((w, j) => <span key={j} style={{ border: '0.4mm solid #6fbf73', borderRadius: '1.5mm', padding: '0 2mm' }}>{w}</span>)}
        </div>
        <div style={small}>{q.ko}</div><div style={line} />
      </div>)}
    </GrammarExerciseBlock>}
  </Shell>;
}

export function CorrectSheet({ data, support }: { data: SheetData; support: Support }) {
  return <Shell data={data} kind="correct" support={support} teacher={false}>
    {support === 1 && <RuleBox data={data} />}
    <GrammarExerciseBlock title="1. Find the mistake. Write the correct sentence." color="#6fbf73">
      <p style={small}>각 문장에서 틀린 곳은 한 군데예요. 틀린 곳에 ○ 하고, 바르게 고쳐 써요.</p>
      {data.correct.map((q, i) => <div key={i} style={{ padding: '1.6mm 0' }}>
        <div style={body}><span style={{ color: '#8d99ae' }}>{num(i)}</span>{q.w}</div><div style={line} />
        {support === 3 && <div style={{ ...small, marginTop: '0.6mm' }}>Because ________________________________________</div>}
      </div>)}
    </GrammarExerciseBlock>
  </Shell>;
}

export function SaySheet({ data, support, part = 0 }: { data: SheetData; support: Support } & PartProps) {
  const from = part * PER_PAGE.say;
  return <Shell data={data} kind="say" support={support} teacher={false} part={part}>
    <GrammarExerciseBlock title="1. Talk with your partner." color="#f0608f">
      {data.say.slice(from, from + PER_PAGE.say).map((q, k) => <div key={k} style={{ padding: '0.8mm 0' }}>
        <div style={body}><span style={{ color: '#8d99ae' }}>{num(from + k)}</span>{q.task}</div>
        {support < 3 && <div style={{ background: '#fff5d6', borderRadius: '1.5mm', padding: '0.8mm 3mm', margin: '0.8mm 0 1mm', ...small, color: '#182640' }}>{q.frame}</div>}
        <div style={line} />
      </div>)}
    </GrammarExerciseBlock>
    {part === 0 && <GrammarExerciseBlock title={`2. Mission · ${data.mission.title}`} color="#a36ad8">
      <p style={body}>{data.mission.scene}</p>
      <ol style={{ listStyle: 'none', padding: 0, marginTop: '1mm' }}>
        {data.mission.steps.map((s, i) => <li key={i} style={{ ...body, padding: '0.8mm 0' }}>☐ {s}</li>)}
      </ol>
    </GrammarExerciseBlock>}
  </Shell>;
}

export function ReviewSheet({ data, support, part = 0 }: { data: SheetData; support: Support } & PartProps) {
  const from = part * PER_PAGE.review;
  return <Shell data={data} kind="review" support={support} teacher={false} part={part}>
    <GrammarExerciseBlock title="1. Write the sentences in English.">
      {data.review.slice(from, from + PER_PAGE.review).map((q, k) => <div key={k} style={{ padding: '1.6mm 0' }}>
        <div style={body}><span style={{ color: '#8d99ae' }}>{num(from + k)}</span>{q.ko}</div>
        {support < 3 && <div style={small}>조건: {q.cond}</div>}<div style={line} />
      </div>)}
    </GrammarExerciseBlock>
    {part === 0 && data.mixed.length > 0 && <GrammarExerciseBlock title="2. Mixed review. Circle the correct answer." color="#f0608f">
      {data.mixed.map((m, i) => <div key={i} style={{ ...body, padding: '1.4mm 0' }}>
        <span style={{ color: '#8d99ae' }}>{num(i)}</span>{m.item.p}<span style={{ marginLeft: '4mm', whiteSpace: 'nowrap' }}>( {m.item.c.join(' / ')} )</span>
        <div style={small}>복습 · {m.from}</div>
      </div>)}
    </GrammarExerciseBlock>}
    {part === KIND_PAGES.review - 1 && <GrammarExerciseBlock title="3. I can..." color="#6fbf73">
      <p style={body}>☐ 규칙을 내 말로 설명할 수 있어요.　☐ 예문을 보지 않고 쓸 수 있어요.　☐ 친구에게 말로 해 볼 수 있어요.</p>
    </GrammarExerciseBlock>}
  </Shell>;
}

/** 교사용 정답·풀이(한 쪽, 두 단) — 선택한 시트만 싣는다 */
export function TeacherKey({ data, kinds, part = 0 }: { data: SheetData; kinds: SheetKind[] } & PartProps) {
  const has = (k: SheetKind) => kinds.includes(k);
  const row: CSSProperties = { fontSize: '3.1mm', lineHeight: 1.4, margin: '0.4mm 0' };
  const block: CSSProperties = { breakInside: 'avoid', marginBottom: '2.5mm' };
  const Title = ({ children, color }: { children: ReactNode; color: string }) => <h2 style={{ fontFamily: FONT_TITLE, fontWeight: 600, fontSize: '3.8mm', borderBottom: `0.4mm solid ${color}`, marginBottom: '1mm' }}>{children}</h2>;
  return <GrammarSheet title={data.point.name} subtitle={`정답·풀이 ${part + 1}/${KEY_PAGES} · 세트 ${data.set}`} teacher>
    <div style={{ columnCount: 2, columnGap: '6mm' }}>
      {has('discover') && <section style={block}><Title color="#2f9be6">규칙 발견</Title><p style={row}>{data.discover.a}</p></section>}
      {has('choose') && <section style={block}><Title color="#2f9be6">고르기</Title>{data.choose.map((q, i) => <p key={i} style={row}>{i + 1}. <strong>{q.c[q.a]}</strong> — {q.why}</p>)}</section>}
      {has('build') && <section style={block}><Title color="#f0608f">빈칸·배열</Title>
        {data.fill.map((q, i) => <p key={i} style={row}>{i + 1}. <strong>{q.answer}</strong></p>)}
        {data.order.map((q, i) => <p key={i} style={row}>배열 {i + 1}. <strong>{q.answer}</strong></p>)}
      </section>}
      {has('correct') && <section style={block}><Title color="#6fbf73">고쳐 쓰기</Title>{data.correct.map((q, i) => <p key={i} style={row}>{i + 1}. <strong>{q.r}</strong> — {q.why}</p>)}</section>}
      {has('say') && <section style={block}><Title color="#a36ad8">말하기 미션</Title><p style={row}>{data.mission.title}: {data.mission.steps.join(' → ')}</p></section>}
      {has('review') && <section style={block}><Title color="#f0608f">총정리</Title>
        {data.review.map((q, i) => <p key={i} style={row}>{i + 1}. <strong>{q.model}</strong></p>)}
        {data.mixed.map((m, i) => <p key={i} style={row}>복습 {i + 1}. <strong>{m.item.c[m.item.a]}</strong> — {m.item.why}</p>)}
      </section>}
    </div>
  </GrammarSheet>;
}

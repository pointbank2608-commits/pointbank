import type { ReactNode } from 'react';
import type { GrammarWorkbookTopic, GrammarExercise } from '../../data/grammarWorkbook';
import { FONT_LETTER, FONT_TITLE } from './cuteTheme';

/** Shared print shell for further reviewed grammar topics and activity types. */
export function GrammarSheet({ title, subtitle, teacher = false, children }: { title: string; subtitle: string; teacher?: boolean; children: ReactNode }) {
  return <article className="print-board grammar-workbook bg-white text-black" data-audience={teacher ? 'teacher' : 'student'} style={{ width: '186mm', minHeight: '263mm', margin: '0 auto', fontFamily: FONT_LETTER, color: '#182640', boxSizing: 'border-box' }}>
    <header style={{ borderRadius: '3mm', background: '#f8e9c0', padding: '4mm 5mm', marginBottom: '4mm' }}>
      <h1 style={{ fontSize: '5.8mm', lineHeight: 1.3, fontWeight: 700, overflowWrap: 'anywhere' }}>{title}</h1>
      <p style={{ fontSize: '3.8mm', marginTop: '2mm' }}>{teacher ? '교사용 정답·풀이' : '학생용'} · {subtitle}</p>
    </header>
    {children}
  </article>;
}
export function GrammarExerciseBlock({ title, children, color = '#2f9be6' }: { title: string; children: ReactNode; color?: string }) {
  return <section style={{ border: `0.5mm solid ${color}`, borderRadius: '3mm', padding: '3mm 5mm', marginBottom: '4mm', breakInside: 'avoid' }}>
    <h2 style={{ fontFamily: FONT_TITLE, fontWeight: 600, fontSize: '4.8mm', marginBottom: '2mm' }}>{title}</h2>{children}
  </section>;
}
function BasicRows({ rows, kind, answers }: { rows: GrammarExercise[]; kind: 'choose' | 'fill' | 'correct'; answers: boolean }) {
  return <ol style={{ listStyle: 'decimal', paddingLeft: '6mm' }}>{rows.map((row, i) => <li key={i} style={{ padding: answers ? '1mm 0' : '1.6mm 0', fontSize: answers ? '3.9mm' : '4.2mm', lineHeight: answers ? 1.4 : 1.5 }}>
    {answers ? <><strong>{row.answer}</strong><p style={{ fontSize: '3.3mm' }}>{row.explanation}</p></> : <>
      <span>{row.prompt}</span>{kind === 'choose' && <span style={{ marginLeft: '3mm' }}>( {row.choices!.join(' / ')} )</span>}
      {kind === 'fill' && <span style={{ marginLeft: '3mm' }}>({row.hint})</span>}
      {kind === 'correct' && <div style={{ borderBottom: '0.3mm solid #8d99ae', height: '8mm' }} />}
    </>}
  </li>)}</ol>;
}
export function GrammarBasicSheet({ topic, title, answers = false }: { topic: GrammarWorkbookTopic; title: string; answers?: boolean }) {
  return <GrammarSheet title={title} subtitle="기본 연습" teacher={answers}>
    <p style={{ fontSize: '3.5mm', lineHeight: 1.6, marginBottom: '4mm' }}>{topic.rule}</p>
    <GrammarExerciseBlock title="1. Choose the correct verb."><BasicRows rows={topic.choose} kind="choose" answers={answers} /></GrammarExerciseBlock>
    <GrammarExerciseBlock title="2. Complete the sentences." color="#f0608f"><BasicRows rows={topic.fill} kind="fill" answers={answers} /></GrammarExerciseBlock>
    <GrammarExerciseBlock title="3. Correct the sentences." color="#6fbf73"><BasicRows rows={topic.correct} kind="correct" answers={answers} /></GrammarExerciseBlock>
  </GrammarSheet>;
}
function Robot({ color }: { color: string }) {
  return <svg aria-hidden="true" viewBox="0 0 80 60" style={{ width: '15mm', height: '12mm' }}><path d="M40 15V5" stroke="#182640" strokeWidth="3"/><circle cx="40" cy="5" r="4" fill={color}/><rect x="10" y="15" width="60" height="40" rx="12" fill={color} stroke="#182640" strokeWidth="2"/><circle cx="28" cy="32" r="5" fill="white"/><circle cx="52" cy="32" r="5" fill="white"/><path d="M28 44h24" stroke="#182640" strokeWidth="3"/></svg>;
}
export function GrammarMissionSheet({ topic, title, answers = false }: { topic: GrammarWorkbookTopic; title: string; answers?: boolean }) {
  const mission = topic.mission;
  return <GrammarSheet title={title} subtitle={mission.title} teacher={answers}>
    {answers ? <>
      <GrammarExerciseBlock title="탐정 기록 · 정답">
        {mission.clues.map((clue, i) => <div key={i} style={{ margin: '4mm 0', fontSize: '4.5mm' }}><strong>{i + 1}. {clue.answer}</strong><p style={{ fontSize: '3.7mm' }}>{clue.explanation}</p></div>)}
      </GrammarExerciseBlock>
      <GrammarExerciseBlock title={`소포 주인: ${mission.owner}`} color="#a36ad8">
        <p style={{ fontSize: '4mm', lineHeight: 1.8 }}>{mission.solution}</p>
      </GrammarExerciseBlock>
      <GrammarExerciseBlock title="말하기 예시 · Speaking" color="#6fbf73"><p style={{ fontSize: '4.5mm', lineHeight: 2 }}>The owner is TOBI.<br />{mission.clues.map(c => <span key={c.answer}>{c.answer}<br /></span>)}</p></GrammarExerciseBlock>
    </> : <>
      <p style={{ fontSize: '3.7mm', marginBottom: '3mm' }}>로봇 네 명은 모두 he로 소개해요. 단서를 읽고 소포의 주인을 찾아요.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm', marginBottom: '4mm' }}>
        {mission.characters.map((robot, i) => <section key={robot.name} style={{ border: '0.5mm solid #a36ad8', borderRadius: '3mm', padding: '2.5mm 4mm' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}><Robot color={['#ffccdc', '#d9e9ff', '#ffecaa', '#cff2e0'][i]} /><h2 style={{ fontFamily: FONT_TITLE, fontSize: '5.5mm', fontWeight: 700 }}>{robot.name}</h2></div>
          {robot.sentences.map(s => <p key={s} style={{ fontSize: '3.8mm', lineHeight: 1.7 }}>{s}</p>)}
        </section>)}
      </div>
      <GrammarExerciseBlock title="1. Read the clues. Write about him." color="#f0608f">
        {mission.clues.map((clue, i) => <div key={i} style={{ fontSize: '4mm', marginBottom: '2mm' }}><p>{i + 1}. {clue.prompt}</p><p style={{ height: '8mm', borderBottom: '0.3mm solid #8d99ae', paddingTop: '1mm' }}>He</p></div>)}
      </GrammarExerciseBlock>
      <GrammarExerciseBlock title="2. Find the owner. Say your clues." color="#6fbf73">
        <p style={{ fontSize: '4.5mm', margin: '2mm 0 4mm' }}>The owner is ____________________.</p>
        <p style={{ fontSize: '3.7mm' }}>네 문장을 소리 내어 말하고, 카드의 정보와 모두 맞는지 확인해요.</p>
      </GrammarExerciseBlock>
    </>}
  </GrammarSheet>;
}

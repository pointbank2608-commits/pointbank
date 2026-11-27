import { useState } from 'react';
import { classroomStep, type GrammarPoint } from '../../lib/grammar';
import {InlineText} from './InlineWorkshopEdit';
import './workshop-board.css';

export default function GrammarPrepOverview({ point, onStage, onGoal }: {
  point: GrammarPoint;
  onGoal?: (value:string)=>void;
  onStage?: (index: number) => void;
}) {
  const comparison = classroomStep(point, 1)?.practice?.panels;
  const examples = comparison?.map(panel => panel.chunks.join(' ')) ?? point.examples;
  const final = classroomStep(point, 5);
  const Container = onStage ? 'nav' : 'section';
  const Tile = onStage ? 'button' : 'div';
  const target = (index: number) => onStage ? {type: 'button' as const, onClick: () => onStage(index)} : {};
  return <Container aria-label="수업 준비 한눈에 보기" className="grammar-prep-overview">
    {onGoal?<div><strong>수업 목표</strong><InlineText label="수업 목표" value={point.goal||point.explain} onChange={onGoal}/></div>:<Tile {...target(0)}>
      <strong>수업 목표</strong><span>{(point.goal || point.explain).replaceAll('**', '')}</span>
    </Tile>}
    <Tile {...target(1)}>
      <strong>비교할 예문</strong>
      {examples.slice(0, 2).map((text, index) => <span key={index} lang="en">{text.replaceAll('**', '')}</span>)}
    </Tile>
    <Tile {...target(5)}>
      <strong>마지막 과제</strong><span>{(final?.practice?.independentPrompts?.join('\n') || final?.prompt)?.replaceAll('**', '')}</span>
    </Tile>
  </Container>;
}

export function SoloGrammarPrepOverview({ points }: { points: GrammarPoint[] }) {
  const [id, setId] = useState(points[0]?.id);
  const chosen = points.find(point => point.id === id) ?? points[0];
  if (!chosen) return null;
  return <>
    {points.length > 1 && <label>준비할 문법 <select value={chosen.id} onChange={event => setId(event.target.value)}>
      {points.map(point => <option key={point.id} value={point.id}>{point.name}</option>)}
    </select></label>}
    <GrammarPrepOverview point={chosen}/>
  </>;
}

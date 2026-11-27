import { useMemo } from 'react';
import { grammarPoint, type GeneratedSentence, type GrammarPoint } from '../lib/grammar';
import { workshopSnapshot } from '../lib/grammarWorkshopSnapshot';
import WorkshopBoard from './grammar/WorkshopBoard';

import type {StageEdit} from './grammar/InlineWorkshopEdit';
export interface GrammarBoardPosition {
  scene?:number;
  view: 'lesson' | 'examples' | 'pitfalls' | 'explain';
  step: number;
  hintOpen: boolean;
  answerOpen: boolean;
  showKo: boolean;
  shown: number;
}
export interface GrammarBoardEditor {
  stage: (index:number) => StageEdit;
  prompt: (index:number,value:string) => void;
  goal: (value:string) => void;
}

export interface GrammarBoardProps {
  point: GrammarPoint;
  mode?: 'prepare' | 'classroom';
  /** 우리 단어장으로 만든 예문 */
  extra?: GeneratedSentence[];
  themeId?: string | null;
  /** false 면 미리보기(버튼·키보드 없이 예문 전부 표시) */
  interactive?: boolean;
  keyboard?: boolean;
  className?: string;
  /** 슬라이드 설정: 해석을 켠 채로 시작 */
  initialShowKo?: boolean;
  /** 슬라이드 설정: 예문을 처음부터 모두 보여주기(하나씩 꺼내지 않음) */
  initialRevealAll?: boolean;
  onCue?: (action: 'shown' | 'submitted' | 'hint' | 'revealed', stageIndex: number) => void;
  editor?: GrammarBoardEditor;
  initialPosition?: GrammarBoardPosition;
  onPositionChange?: (position: GrammarBoardPosition) => void;
}

export default function GrammarBoard(props: GrammarBoardProps) {
  const point=useMemo(()=>workshopSnapshot(props.point,grammarPoint(props.point.id)),[props.point]);
  return <WorkshopBoard key={point.id} {...props} point={point} workshop={point.workshop} />;
}

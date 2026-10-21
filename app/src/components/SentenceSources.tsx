import SentenceBankPicker from './SentenceBankPicker';
import WordListPicker from './WordListPicker';
import type { MatchPair, WordList } from '../lib/types';

/**
 * 문장으로 할 수 있는 게임의 설정 화면 공통 "문장 가져오기"(2026-10-21):
 * 내 문장 목록 불러오기 + 문장 은행에서 담기. 게임 페이지는 이 부품 하나만 부르면 된다.
 * - mode "labels": 문장이 글 한 줄(GameItem.label)인 게임(돌림판·공 돌리기 …). 영어만 담는다.
 * - mode "pairs": 앞(영어)·뒤(우리말) 짝으로 담는 게임(플래시카드·답 입력하기). 해석이 있으면 같이 담는다.
 */
type Props = { wordLists: WordList[]; loading: boolean; classId?: string | null } & (
  | { mode: 'labels'; onImportLabels: (labels: string[]) => void }
  | { mode: 'pairs'; onImportPairs: (pairs: MatchPair[]) => void }
);

function uid(): string {
  return crypto.randomUUID();
}

/** `영어 | 우리말` 한 줄 → 짝 */
function toPair(line: string): MatchPair {
  const i = line.indexOf(' | ');
  return i < 0 ? { id: uid(), left: line.trim(), right: '' } : { id: uid(), left: line.slice(0, i).trim(), right: line.slice(i + 3).trim() };
}

export default function SentenceSources(props: Props) {
  const sentenceLists = props.wordLists.filter((l) => l.kind === 'sentence');
  return (
    <>
      {props.mode === 'labels' ? (
        <WordListPicker variant="label" kind="sentence" wordLists={sentenceLists} loading={props.loading} onImportLabels={props.onImportLabels} />
      ) : (
        <WordListPicker variant="pairs" kind="sentence" wordLists={sentenceLists} loading={props.loading} onImportPairs={props.onImportPairs} />
      )}
      {props.mode === 'labels' ? (
        <SentenceBankPicker withKo={false} classId={props.classId} onImportLabels={props.onImportLabels} />
      ) : (
        <SentenceBankPicker classId={props.classId} onImportLabels={(lines) => props.onImportPairs(lines.map(toPair))} />
      )}
    </>
  );
}

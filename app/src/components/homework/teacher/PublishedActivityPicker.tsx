import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { fetchWordLists, wordListKindOf } from '../../../lib/api';
import { wordListToCards } from '../../../lib/gameFromWords';
import { gameItemFromCards, newBlock, SOLO_GAME_NAMES, validateItems, type SoloGame } from '../../../lib/homework/blocks';
import { MAX_MEMORY_COUNT, MEMORY_METHOD_LIST, MEMORY_METHODS, memoryItemFromCards, type MemoryMethod } from '../../../lib/homework/memory';
import type { HwItemDraft } from '../../../lib/homework/types';
import type { WordList } from '../../../lib/types';
import AccessibleDialog from '../../AccessibleDialog';
import { QuestionEditor } from './HomeworkBlockEditor';

const field = 'mt-1 block min-h-11 w-full rounded-xl border border-outline-variant bg-white px-3 py-2';

export default function PublishedActivityPicker({ classId, en, onAdd, onClose }: {
  classId: string; en: boolean; onAdd: (item: HwItemDraft) => void; onClose: () => void;
}) {
  const { academy } = useAuth();
  const [lists, setLists] = useState<WordList[]>([]);
  const [status, setStatus] = useState<'loading'|'ready'|'failed'>('loading');
  const [retry, setRetry] = useState(0);
  const [choice, setChoice] = useState('');
  const [listId, setListId] = useState('');
  const [manual, setManual] = useState(() => newBlock('recall'));
  const l = (ko: string, english: string) => en ? english : ko;
  const lang = en ? 1 : 0;
  const list = lists.find(row => row.id === listId);
  const method = MEMORY_METHOD_LIST.find(m => choice === 'memory-' + m);
  const game = (Object.keys(SOLO_GAME_NAMES) as SoloGame[]).find(g => choice === 'game-' + g);
  const isManual = choice === 'manual';
  useEffect(() => {
    let active = true;
    setStatus('loading');
    if (!academy?.id) { setStatus('failed'); return; }
    fetchWordLists(academy.id, classId, 'all').then(rows => {
      if (active) { setLists(rows.filter(row => row.items.length)); setStatus('ready'); }
    }, () => { if (active) setStatus('failed'); });
    return () => { active = false; };
  }, [academy?.id, classId, retry]);

  const made = useMemo(() => {
    if (isManual) return manual;
    if (!list) return null;
    const kind = wordListKindOf(list);
    const cards = wordListToCards(list).map(card => kind === 'sentence' && method === 'sentence' ? { ...card, example: card.word } : card);
    const item = method ? memoryItemFromCards(cards, method, Math.min(cards.length, MAX_MEMORY_COUNT), en)
      : game ? gameItemFromCards(cards, game, SOLO_GAME_NAMES[game][lang]) : null;
    if (item) item.config.materialList = { id: list.id, name: list.name, version: list.updated_at, kind };
    return item;
  }, [isManual, manual, list, method, game, en, lang]);
  const issue = made ? validateItems([made])[0] : undefined;
  const sentenceOnly = method && MEMORY_METHODS[method].sentence;
  const available = lists.filter(row => !sentenceOnly || wordListKindOf(row) === 'sentence');
  const amount = made?.content.questions.length || made?.config.block?.count;
  const methodOption = (m: MemoryMethod) => <option key={m} value={'memory-' + m}>{MEMORY_METHODS[m].name[lang]}</option>;
  return <AccessibleDialog label={l('활동 추가','Add activity')} onClose={onClose}>
    <div className="space-y-4 p-5">
      <h2 className="text-xl font-bold">{l('활동 추가','Add activity')}</h2>
      <label className="block font-bold">{l('활동 종류','Activity type')}
        <select autoFocus className={field} value={choice} onChange={e => { setChoice(e.target.value); setListId(''); }}>
          <option value="">{l('활동 고르기','Choose an activity')}</option>
          <optgroup label={l('암기 활동','Memory practice')}>{MEMORY_METHOD_LIST.filter(m => !MEMORY_METHODS[m].sentence).map(methodOption)}</optgroup>
          <optgroup label={l('문장 연습','Sentence practice')}>{MEMORY_METHOD_LIST.filter(m => MEMORY_METHODS[m].sentence).map(methodOption)}</optgroup>
          <optgroup label={l('단어·문장 게임','Word and sentence games')}>{(Object.keys(SOLO_GAME_NAMES) as SoloGame[]).map(g =>
            <option key={g} value={'game-' + g}>{SOLO_GAME_NAMES[g][lang]}</option>)}</optgroup>
          <option value="manual">{l('문제 직접 입력','Write your own questions')}</option>
        </select>
      </label>
      {method && <p className="text-sm text-on-surface-variant">{MEMORY_METHODS[method].help[lang]}</p>}
      {choice && !isManual && <>
        <label className="block font-bold">{l('단어장·문장 모음','Word or sentence list')}
          <select className={field} disabled={status !== 'ready'} value={listId} onChange={e => setListId(e.target.value)}>
            <option value="">{status === 'loading' ? l('불러오는 중…','Loading…') : l('자료 고르기','Choose material')}</option>
            {(['word','sentence'] as const).map(kind => {
              const rows = available.filter(row => wordListKindOf(row) === kind);
              return rows.length > 0 && <optgroup key={kind} label={kind === 'word' ? l('단어장','Word lists') : l('문장 모음','Sentence lists')}>
                {rows.map(row => <option key={row.id} value={row.id}>{row.name} ({row.items.length})</option>)}
              </optgroup>;
            })}
          </select>
        </label>
        {status === 'failed' && <p role="alert">{l('자료를 불러오지 못했어요.','Could not load materials.')} <button type="button" className="text-primary underline" onClick={()=>setRetry(n=>n+1)}>{l('다시 시도','Retry')}</button></p>}
        {status === 'ready' && !available.length && <p>{l('선택할 수 있는 자료가 없어요. 내 자료에서 모음을 먼저 만들어 주세요.','Create a compatible list in My Materials first.')}</p>}
        {list && <p role="status">{!made ? l('이 자료로 만들 수 있는 문제가 없어요. 다른 활동이나 자료를 선택해 주세요.','This activity needs different material. Choose another activity or list.')
          : issue || (made.config.block?.method === 'flip' ? l(`카드 ${amount}장`, `${amount} cards`) : l(`생성된 문제 ${amount}개`, `${amount} questions`))}</p>}
      </>}
      {isManual && <QuestionEditor items={manual.content.questions} en={en} onChange={questions=>setManual({...manual,content:{...manual.content,questions}})}/>}
      {isManual && manual.content.questions.length > 0 && issue && <p role="alert">{issue}</p>}
      <div className="flex gap-2"><button type="button" className="min-h-11 rounded-xl bg-primary px-5 font-bold text-white disabled:opacity-40" disabled={!made || !!issue} onClick={()=>{if(made && !issue) onAdd(made);}}>{l('완료','Done')}</button>
        <button type="button" className="min-h-11 rounded-xl border border-outline-variant px-4" onClick={onClose}>{l('취소','Cancel')}</button></div>
    </div>
  </AccessibleDialog>;
}

import type { FullCardItem } from '../lib/types';

interface Props {
  tab: string;
  words: FullCardItem[];
  title: string;
  compact?: boolean;
}

const FALLBACK_WORDS: FullCardItem[] = [
  { id: 'preview-apple', word: 'apple', meaning: '사과', imageUrl: null },
  { id: 'preview-book', word: 'book', meaning: '책', imageUrl: null },
  { id: 'preview-cat', word: 'cat', meaning: '고양이', imageUrl: null },
  { id: 'preview-desk', word: 'desk', meaning: '책상', imageUrl: null },
];

function PreviewPicture({ word }: { word: FullCardItem }) {
  return word.imageUrl ? (
    <img src={word.imageUrl} alt="" className="h-full w-full object-cover" />
  ) : (
    <span className="material-symbols-outlined text-[clamp(16px,2.8vw,32px)] text-primary/55">image</span>
  );
}

/** 커리큘럼 편집기에서 쓰는 가벼운 종이 미리보기. 인쇄 DOM을 축소하지 않아 작은 화면에서도
 * 글자와 활동 구조가 또렷하고, 18가지 유형이 서로 다른 활동이라는 점을 바로 알 수 있다. */
export default function WorksheetTypePreview({ tab, words, title, compact = false }: Props) {
  const sample = (words.length > 0 ? words : FALLBACK_WORDS).slice(0, 4);
  const w = (index: number) => sample[index % sample.length] ?? FALLBACK_WORDS[index % FALLBACK_WORDS.length];
  const scramble = (value: string) => value.length > 2 ? `${value.slice(1)}${value[0]}` : value;
  const chars = `${sample.map((item) => item.word).join('').toUpperCase()}WORKSHEET`.padEnd(49, 'ABC');

  let content: React.ReactNode;
  switch (tab) {
    case 'card':
      content = <div className="grid h-full grid-cols-2 gap-2">{sample.map((item) => <div key={item.id} className="flex flex-col overflow-hidden rounded-md border border-primary/20 bg-white"><div className="flex min-h-0 flex-1 items-center justify-center bg-secondary-container/25"><PreviewPicture word={item} /></div><div className="py-1 text-center font-bold">{item.word}</div></div>)}</div>;
      break;
    case 'tracing':
      content = <div className="space-y-3">{sample.map((item) => <div key={item.id}><div className="border-b border-dashed border-outline-variant pb-1"><b>{item.word}</b> <span className="ml-3 text-on-surface/20">{item.word}　{item.word}</span></div><div className="mt-1 border-b border-dotted border-outline-variant/70">&nbsp;</div></div>)}</div>;
      break;
    case 'quiz':
    case 'multipleChoice':
      content = <div className="space-y-3">{sample.slice(0, 3).map((item, i) => <div key={item.id}><b>{i + 1}. {item.word}</b><div className="mt-1 flex gap-2">{sample.slice(0, 3).map((choice, j) => <span key={choice.id} className="rounded border border-outline-variant px-2 py-1">{String.fromCharCode(65 + j)}. {choice.meaning}</span>)}</div></div>)}</div>;
      break;
    case 'coloring':
      content = <div className="grid h-full grid-cols-2 gap-2">{sample.map((item) => <div key={item.id} className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/25 bg-primary/[0.03]"><PreviewPicture word={item} /><b>{item.word}</b></div>)}</div>;
      break;
    case 'match':
    case 'readMatch':
      content = <div className="grid h-full grid-cols-[1fr_auto_1fr] items-center gap-3"><div className="space-y-2">{sample.map((item) => <div key={item.id} className="rounded border border-outline-variant bg-white px-2 py-1 font-bold">{item.word}</div>)}</div><div className="space-y-3 text-primary/45">{sample.map((item) => <div key={item.id}>······</div>)}</div><div className="space-y-2">{[...sample].reverse().map((item) => <div key={item.id} className="rounded border border-outline-variant bg-white px-2 py-1 text-right">{tab === 'readMatch' ? <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-sm">image</span>{item.meaning}</span> : item.meaning}</div>)}</div></div>;
      break;
    case 'wordSearch':
      content = <div className="mx-auto grid max-w-64 grid-cols-7 overflow-hidden rounded border border-outline-variant bg-white">{chars.slice(0, 49).split('').map((char, i) => <span key={i} className="flex aspect-square items-center justify-center border border-outline-variant/30 font-mono font-bold">{char}</span>)}</div>;
      break;
    case 'unscramble':
      content = <div className="space-y-3">{sample.map((item, i) => <div key={item.id} className="flex items-center gap-3"><span className="w-5">{i + 1}.</span><span className="rounded-md bg-secondary-container/50 px-3 py-1 font-bold tracking-[0.18em]">{scramble(item.word)}</span><span className="flex-1 border-b border-outline">&nbsp;</span></div>)}</div>;
      break;
    case 'fillBlank':
      content = <div className="space-y-4">{sample.map((item, i) => <div key={item.id}>{i + 1}. <span className="inline-block min-w-24 border-b-2 border-outline">&nbsp;</span> <span className="text-on-surface-variant">({item.meaning})</span></div>)}</div>;
      break;
    case 'grouping':
      content = <div className="grid h-full grid-cols-2 gap-3">{['A', 'B'].map((group, i) => <div key={group} className="rounded-lg border-2 border-primary/25 bg-white p-2"><div className="mb-2 rounded bg-primary/10 py-1 text-center font-bold">Group {group}</div>{sample.filter((_, j) => j % 2 === i).map((item) => <div key={item.id} className="mb-1 rounded border border-dashed border-outline-variant px-2 py-1">{item.word}</div>)}</div>)}</div>;
      break;
    case 'cutPaste':
      content = <div className="space-y-3"><div className="grid grid-cols-2 gap-2">{sample.map((item) => <div key={item.id} className="h-10 rounded border-2 border-primary/20 bg-white" />)}</div><div className="flex items-center gap-2 text-on-surface-variant"><span className="material-symbols-outlined text-base">content_cut</span><span className="flex-1 border-t-2 border-dashed border-outline-variant" /></div><div className="grid grid-cols-2 gap-2">{sample.map((item) => <div key={item.id} className="rounded border border-dashed border-outline px-2 py-1 text-center font-bold">{item.word}</div>)}</div></div>;
      break;
    case 'sentence':
      content = <div className="space-y-4">{sample.slice(0, 3).map((item, i) => <div key={item.id}><span className="mr-2">{i + 1}.</span>{['I', 'like', item.word].sort((a, b) => b.localeCompare(a)).map((token) => <span key={token} className="mr-1 inline-block rounded border border-outline-variant bg-white px-2 py-1">{token}</span>)}<div className="mt-2 border-b border-outline">&nbsp;</div></div>)}</div>;
      break;
    case 'trueFalse':
      content = <div className="space-y-3">{sample.map((item, i) => <div key={item.id} className="flex items-center gap-3 rounded border border-outline-variant bg-white px-3 py-2"><span className="flex-1">{i + 1}. {item.word} = {item.meaning}</span><b className="text-primary">○　×</b></div>)}</div>;
      break;
    case 'miniBook':
      content = <div className="grid h-full grid-cols-2 grid-rows-2 overflow-hidden rounded border-2 border-outline-variant">{sample.map((item, i) => <div key={item.id} className={`flex flex-col items-center justify-center border-outline-variant ${i < 2 ? 'border-b' : ''} ${i % 2 === 0 ? 'border-r' : ''}`}><span className="material-symbols-outlined text-primary/45">auto_stories</span><b>{item.word}</b><small>{item.meaning}</small></div>)}</div>;
      break;
    case 'askAnswer':
      content = <div className="overflow-hidden rounded border border-outline-variant"><div className="grid grid-cols-[1.5fr_repeat(3,1fr)] bg-primary/10 font-bold"><span className="p-2">Question</span><span className="p-2">A</span><span className="p-2">B</span><span className="p-2">C</span></div>{sample.map((item) => <div key={item.id} className="grid grid-cols-[1.5fr_repeat(3,1fr)] border-t border-outline-variant bg-white"><span className="p-2">Do you like {item.word}?</span><span className="p-2">○ / ×</span><span className="p-2">○ / ×</span><span className="p-2">○ / ×</span></div>)}</div>;
      break;
    case 'boardGame':
      content = <div className="grid h-full grid-cols-4 gap-1.5">{Array.from({ length: 12 }, (_, i) => <div key={i} className={`flex items-center justify-center rounded-lg border-2 text-center font-bold ${i === 0 || i === 11 ? 'border-primary bg-primary text-on-primary' : 'border-primary/25 bg-white'}`}>{i === 0 ? 'START' : i === 11 ? 'FINISH' : w(i).word}</div>)}</div>;
      break;
    case 'list':
    default:
      content = <div className="overflow-hidden rounded border border-outline-variant">{sample.map((item, i) => <div key={item.id} className="grid grid-cols-[28px_1fr_1fr] border-b border-outline-variant/60 bg-white last:border-b-0"><span className="bg-primary/10 p-2 text-center">{i + 1}</span><b className="p-2">{item.word}</b><span className="p-2 text-on-surface-variant">{item.meaning}</span></div>)}</div>;
  }

  return (
    <div className={`relative mx-auto w-full overflow-hidden rounded-lg border border-outline-variant/60 bg-[#fffefa] text-[clamp(9px,1.1vw,13px)] text-on-surface shadow-[0_10px_28px_rgba(45,35,20,0.12)] ${compact ? 'aspect-[4/3] p-3' : 'aspect-[1.414/1] max-w-3xl p-5 sm:p-7'}`}>
      <div className="mb-3 flex items-center justify-between border-b-2 border-primary/20 pb-2">
        <strong className="truncate text-[1.25em]">{title}</strong>
        <span className="text-[0.85em] text-on-surface-variant">Name __________</span>
      </div>
      <div className="h-[calc(100%-2.25rem)] overflow-hidden">{content}</div>
    </div>
  );
}

/** Small, code-rendered examples show the activity, even when icon fonts are offline. */
export default function ActivityPreview({ type, label }: { type: string; label: string }) {
  const tile = 'rounded-xl border border-blue-100 bg-white px-3 py-2 text-center font-bold text-deep-navy shadow-sm';
  return <div role="img" aria-label={label} className="flex min-h-36 items-center justify-center overflow-hidden bg-sky-50 p-4">
    {type === 'wheel' ? <div className="relative h-28 w-28 rounded-full border-4 border-blue-700 shadow-md" style={{ background: 'conic-gradient(#93c5fd 0deg 90deg,#fde68a 90deg 180deg,#86efac 180deg 270deg,#fda4af 270deg)' }}>
      <span className="absolute -top-3 left-[42%] text-xl text-blue-900">▼</span>
      <span className="absolute right-2 top-4 text-xs font-bold">apple</span><span className="absolute bottom-4 right-3 text-xs font-bold">cat</span><span className="absolute bottom-4 left-3 text-xs font-bold">sun</span><span className="absolute left-2 top-4 text-xs font-bold">book</span>
      <span className="absolute left-[38%] top-[38%] flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs text-primary shadow">▶</span>
    </div> : type === 'matchup' ? <div className="grid grid-cols-2 gap-2"><span className={tile}>apple</span><span className={`${tile} border-blue-400!`}>사과</span><span className={tile}>cat</span><span className={tile}>고양이</span></div>
      : type === 'unscramble' ? <div className="flex flex-wrap justify-center gap-2">{['I', 'like', 'apples'].map(word => <span key={word} className={tile}>{word}</span>)}</div>
      : <div className="grid grid-cols-3 gap-2">{['?', 'apple', '?', '?', '★', '?'].map((word,index) => <span key={index} className={`${tile} border-amber-200! bg-amber-100!`}>{word}</span>)}</div>}
  </div>;
}

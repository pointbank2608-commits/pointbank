import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adventureId, type DetectiveCase } from '../../lib/adventureGames';
import { caseFromCorrect, detectiveCaseFromVariant, detectiveSuggestion, detectiveVariants } from '../../lib/detectiveSuggestion';

export default function DetectiveCaseEditor({ item, rules, onChange, onRemove }: { item: DetectiveCase; rules?: string[]; onChange: (value: DetectiveCase) => void; onRemove: () => void }) {
  const { t, i18n } = useTranslation();
  const l = (ko: string, en: string) => i18n.language.startsWith('ko') ? ko : en;
  const area = useRef<HTMLTextAreaElement>(null);
  const [manual, setManual] = useState(!!item.correct&&!item.incorrect);
  const [notice, setNotice] = useState('');
  const variants = detectiveVariants(item.correct, rules);
  const index = variants.findIndex(v => v.incorrect === item.incorrect);
  const replaceError = (id: string, patch: Partial<DetectiveCase['errors'][number]>) => onChange({ ...item, errors: item.errors.map(r => r.id === id ? { ...r, ...patch } : r) });
  return <div className="ad-edit-card" data-detective-case-editor={item.id}>
    <label>{t('launchUx.correct')}<input aria-label={t('launchUx.correct')} value={item.correct} onChange={e => {
      setNotice('');
      onChange(manual ? { ...item, correct: e.target.value } : { ...caseFromCorrect(e.target.value, item.id, rules), context:item.context });
    }} /></label>
    {!manual && <div aria-live="polite">
      {item.incorrect ? <><p>{t('launchUx.incorrect')}: <strong lang="en">{item.incorrect}</strong></p>
        {item.errors.map(r => <p key={r.id}>{r.start===r.end?l('빠진 자리','Missing word'):item.incorrect.slice(r.start, r.end)} → <strong>{r.replacement||l('삭제','Remove')}</strong></p>)}</> :
        <p>{item.correct.trim() ? l('확실한 오류를 만들기 어려워요. 더 짧은 문장을 쓰거나 직접 수정해 주세요.', 'No clear error could be generated. Try a shorter sentence or edit the question manually.') : l('마침표로 끝나는 올바른 문장을 입력하세요.', 'Enter a correct sentence ending with a period.')}</p>}
    </div>}
    <button type="button" disabled={!variants.length || (variants.length === 1 && index === 0)} onClick={() => {
      const v = variants[(index + 1) % variants.length];
      if (v) onChange(detectiveCaseFromVariant(v,item.id,item.context));
      setNotice(''); setManual(false);
    }}>{l('다른 오류 만들기', 'Generate another error')}</button>
    <button type="button" aria-expanded={manual} onClick={() => setManual(v => !v)}>{l('직접 수정', 'Edit manually')}</button>
    {manual && <><label>{l('뜻 또는 상황 (선택)','Meaning or situation (optional)')}<input value={item.context??''} onChange={e=>onChange({...item,context:e.target.value})}/></label>
      <label>{t('launchUx.incorrect')}<textarea aria-label={t('launchUx.incorrect')} ref={area} value={item.incorrect} onChange={e => { setNotice(''); onChange({ ...item, incorrect: e.target.value, errors: [] }); }} /></label>
      <button type="button" onClick={() => {
        const proposal = detectiveSuggestion(item.incorrect, item.correct);
        if (!proposal) { setNotice(t('launchUx.ambiguous')); return; }
        setNotice(''); onChange({ ...item, errors: [{ id: adventureId(), ...proposal }] });
      }}>{t('launchUx.suggest')}</button>{notice && <p role="status">{notice}</p>}</>}
    <details><summary>{l('고급 설정', 'Advanced settings')}</summary>
      {manual && <><p>{t('launchUx.manualRange')}</p><button type="button" onClick={() => {
        const n = area.current;
        if (!n || n.selectionStart === n.selectionEnd) { n?.focus(); return; }
        onChange({ ...item, errors: [...item.errors, { id: adventureId(), start: n.selectionStart, end: n.selectionEnd, replacement: '', choices: [] }] });
      }}>{t('launchUx.addRange')}</button></>}
      {item.errors.map(r => <div className="ad-edit-row" key={r.id}>
        <strong>“{item.incorrect.slice(r.start, r.end)}”</strong>
        <label>{t('guide.answer')}<input value={r.replacement} onChange={e => replaceError(r.id, { replacement: e.target.value })} /></label>
        <label>{t('launchUx.choices')}<input value={r.choices.join('|')} onChange={e => replaceError(r.id, { choices: e.target.value.split('|') })} /></label>
        <button type="button" onClick={() => onChange({ ...item, errors: item.errors.filter(x => x.id !== r.id) })}>{t('guide.remove')}</button>
      </div>)}
      <label>{t('launchUx.accepted')}<textarea value={item.accepted.join('\n')} onChange={e => onChange({ ...item, accepted: e.target.value.split('\n').filter(Boolean) })} /></label>
      <label>{t('launchUx.explanation')}<input value={item.explanation} onChange={e => onChange({ ...item, explanation: e.target.value })} /></label>
    </details>
    <button type="button" onClick={onRemove}>{t('guide.remove')}</button>
  </div>;
}

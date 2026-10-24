import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { buildStage1Course } from '../../data/phonicsStage1';
import type { MaterialSlide } from '../../lib/types';

/** Store curriculum references in the existing material block, never word snapshots. */
export default function Stage1LessonOptions({slide,onUpdate}:{slide:MaterialSlide;onUpdate:(patch:Partial<MaterialSlide>)=>void}) {
  const {t}=useTranslation();
  const units=useMemo(()=>buildStage1Course(),[]);
  const ref=slide.phonicsStage1??{unitId:'stage1-abc',view:'slides' as const,lesson:1 as const};
  const unit=units.find(u=>u.id===ref.unitId);
  const mode=ref.view==='workbook'?'workbook':ref.optional?'extra':String(ref.lesson);
  const update=(patch:Partial<NonNullable<MaterialSlide['phonicsStage1']>>)=>onUpdate({phonicsStage1:{...ref,...patch}});
  return <div className="space-y-4">
    <h3 className="text-lg font-bold">{t('phonicsStage1.title')}</h3>
    <label className="flex flex-col gap-2"><span>{t('phonicsStage1.unit')}</span><select className="min-h-12 rounded-xl border border-outline-variant bg-white px-3" value={ref.unitId} onChange={e=>update({unitId:e.target.value})}>
      {!unit&&<option value={ref.unitId}>{t('phonicsStage1.invalidReference')}</option>}
      {units.map(u=><option key={u.id} value={u.id}>{u.number?'Unit '+u.number+' · ':''}{u.groups.map(g=>g.letter+g.letter.toLowerCase()).join(' ')} · {u.groups.flatMap(g=>g.entries.map(e=>e.word)).join(', ')}</option>)}
    </select></label>
    <label className="flex flex-col gap-2"><span>{t('phonicsStage1.lessons')}</span><select className="min-h-12 rounded-xl border border-outline-variant bg-white px-3" value={mode} onChange={e=>update({view:e.target.value==='workbook'?'workbook':'slides',lesson:e.target.value==='1'||e.target.value==='workbook'?1:2,optional:e.target.value==='extra'})}>
      <option value="1">{t('phonicsStage1.start',{n:1})}</option><option value="2">{t('phonicsStage1.start',{n:2})}</option><option value="extra">{t('phonicsStage1.extra')}</option><option value="workbook">{t('phonicsStage1.workbook')}</option>
    </select></label>
    {unit&&<p>{unit.reader?t('phonicsStage1.unit1Ready'):t('phonicsStage1.pendingReader')}</p>}
  </div>;
}

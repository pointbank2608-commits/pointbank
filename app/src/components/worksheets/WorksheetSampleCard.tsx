import { useTranslation } from 'react-i18next';
import type { WorksheetActivity } from '../../lib/worksheetActivityCatalog';
import { WORKSHEET_SAMPLE_THUMBNAILS } from '../../lib/worksheetSampleThumbnails';

export default function WorksheetSampleCard({ activity, onPreview, onEdit }: {
  activity:WorksheetActivity; onPreview:()=>void; onEdit:()=>void;
}) {
  const {t}=useTranslation(),sample=WORKSHEET_SAMPLE_THUMBNAILS[activity.id];
  const title=t(`worksheetStudio.activities.${activity.id}.title`);
  return <article className="ws-activity-card" data-activity-card={activity.number?activity.id:undefined} data-basic-activity={!activity.number?activity.id:undefined}>
    <button type="button" className="ws-sample-thumbnail" data-sample-open={activity.id} aria-label={t('worksheetStudio.previewNamedSample',{title})} onClick={onPreview}>
      <img src={sample.src} alt="" loading="lazy" width={420} height={activity.id==='basic-miniBook'?297:590}/>
      <span>{t('worksheetStudio.samplePageCount',{count:sample.pages})}</span>
    </button>
    <span className="ws-purpose-label">{t(`worksheetStudio.purpose.${activity.purpose}`)}</span>
    <h2>{title}</h2><p>{t(`worksheetStudio.activities.${activity.id}.goal`)}</p>
    <small>{t(`worksheetStudio.people.${activity.people}`)} · {t('worksheetStudio.time',{count:activity.minutes})}</small>
    <div className="ws-card-actions"><button type="button" className="ws-button" onClick={onPreview}>{t('worksheetStudio.samplePreview')}</button><button type="button" className="ws-button ws-primary" onClick={onEdit}>{t('worksheetStudio.open')}</button></div>
  </article>;
}

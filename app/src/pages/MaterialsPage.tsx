import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { materialSections, MATERIAL_PREPARATIONS } from '../lib/materialsCatalog';
import { useMaterialNavigation } from '../lib/useMaterialNavigation';
import '../styles/materials-browser.css';
import SightWordWorksheets from '../components/worksheets/SightWordWorksheets';

const sections = materialSections();
const sectionIds = sections.map(s => `materials-${s.key}`);

export default function MaterialsPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const sightWords = params.get('tab') === 'sightwords';
  const { rootRef, navRef, active, jump } = useMaterialNavigation(sectionIds);
  return <div className="materials-browser" ref={rootRef}>
    <header className="materials-heading no-print"><h1>{t('materials.pageTitle')}</h1><p>{t('materialBrowser.subtitle')}</p><Link to="/materials/worksheet" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 py-3 text-base font-bold text-white focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary">{t('worksheetStudio.title')} →</Link></header>
    <nav className="materials-shortcuts no-print" ref={navRef} aria-label={t('materialBrowser.shortcuts')}>
      <div className="materials-shortcuts-scroll">{sections.map(s => {
        const id = `materials-${s.key}`;
        return <span className="contents" key={s.key}><Link to={`/materials#${id}`} aria-current={!sightWords && active === id ? 'location' : undefined} onClick={event => {
          if (sightWords) return;
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault(); jump(id, true);
        }}><span className="material-symbols-outlined" aria-hidden="true">{s.icon}</span><span>{t(`materials.group_${s.key}`)}</span><span className="materials-count">{s.items.length}</span></Link>{s.key==='phonics'&&<Link to="/materials?tab=sightwords" aria-current={sightWords?'page':undefined}>사이트워드</Link>}</span>;
      })}</div>
    </nav>
    {sightWords ? <SightWordWorksheets/> : sections.map(s => <section key={s.key} id={`materials-${s.key}`} className="materials-section" aria-labelledby={`materials-title-${s.key}`}>
      <div className="materials-section-heading"><h2 id={`materials-title-${s.key}`} tabIndex={-1}>{t(`materials.group_${s.key}`)} <span className="materials-count">{s.items.length}</span></h2><span>{t('materialBrowser.count', {count:s.items.length})}</span></div>
      <div className="materials-card-grid">{s.items.map(m => {
        const preparation = m.preparation ?? 'options';
        const {tone, action} = MATERIAL_PREPARATIONS[preparation];
        return <Link key={m.id} to={m.path} className="materials-card">
          <div className="materials-cover">{m.cover ? <img src={m.cover} alt="" width={640} height={360} loading="lazy" decoding="async" /> : <span className="material-symbols-outlined" aria-hidden="true">{m.icon}</span>}</div>
          <div className="materials-card-copy"><span className={`materials-preparation materials-tone-${tone}`}>{t(`materialBrowser.preparation.${preparation}`)}</span><h3>{t(m.nameKey)}</h3><p>{t(m.descKey)}</p><span className="materials-card-action">{t(`materialBrowser.action.${action}`)} <span aria-hidden="true">→</span></span></div>
        </Link>;
      })}</div>
    </section>)}
  </div>;
}

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { materialSections, MATERIAL_PREPARATIONS } from '../lib/materialsCatalog';
import { useMaterialNavigation } from '../lib/useMaterialNavigation';
import '../styles/materials-browser.css';

const sections = materialSections();
const sectionIds = sections.map(s => `materials-${s.key}`);

export default function MaterialsPage() {
  const { t } = useTranslation();
  const { rootRef, navRef, active, jump } = useMaterialNavigation(sectionIds);
  return <div className="materials-browser" ref={rootRef}>
    <header className="materials-heading"><h1>{t('materials.pageTitle')}</h1><p>{t('materialBrowser.subtitle')}</p></header>
    <nav className="materials-shortcuts" ref={navRef} aria-label={t('materialBrowser.shortcuts')}>
      <div className="materials-shortcuts-scroll">{sections.map(s => {
        const id = `materials-${s.key}`;
        return <a key={s.key} href={`#${id}`} aria-current={active === id ? 'location' : undefined} onClick={event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault(); jump(id, true);
        }}><span className="material-symbols-outlined" aria-hidden="true">{s.icon}</span><span>{t(`materials.group_${s.key}`)}</span><span className="materials-count">{s.items.length}</span></a>;
      })}</div>
    </nav>
    {sections.map(s => <section key={s.key} id={`materials-${s.key}`} className="materials-section" aria-labelledby={`materials-title-${s.key}`}>
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

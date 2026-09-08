import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MATERIALS_CATALOG } from '../lib/materialsCatalog';

export default function MaterialsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy mb-1.5">
          {t('materials.pageTitle')}
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('materials.pageSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {MATERIALS_CATALOG.map((m) => (
          <Link
            key={m.id}
            to={m.path}
            className="group relative bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)] overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all"
          >
            <div className="relative h-36 overflow-hidden">
              {m.cover ? (
                <img
                  src={m.cover}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary-container to-secondary-container flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                  <span className="material-symbols-outlined text-6xl text-on-primary-container opacity-80">{m.icon}</span>
                </div>
              )}
              <div className="absolute top-3 left-3 w-10 h-10 rounded-full bg-surface-container-lowest/90 backdrop-blur-sm flex items-center justify-center text-primary shadow-sm">
                <span className="material-symbols-outlined">{m.icon}</span>
              </div>
            </div>
            <div className="p-5">
              <h3 className="font-title-md text-title-md text-on-surface mb-1">{t(m.nameKey)}</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">{t(m.descKey)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

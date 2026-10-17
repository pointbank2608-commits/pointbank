import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MATERIALS_CATALOG, type MaterialCatalogEntry } from '../lib/materialsCatalog';

/** 활동지를 쓰임새별로 묶어 보여 준다(2026-10-17, 외부 평가: 한 줄로 길게 늘어서 있으면 찾기 어렵다). 새 활동지는 여기 한 칸에 id 를 더할 것. */
const GROUPS: { key: string; ids: string[] }[] = [
  { key: 'words', ids: ['library', 'worksheet', 'flashcards', 'memorycards'] },
  { key: 'phonics', ids: ['phonics', 'cvcworkbook', 'longvowelworkbook'] },
  { key: 'gamecards', ids: ['bingo', 'mysterybox', 'lightning'] },
  { key: 'roleplay', ids: ['airport', 'restaurant', 'icecream', 'doctor'] },
];

export default function MaterialsPage() {
  const { t } = useTranslation();
  const known = new Set(GROUPS.flatMap((g) => g.ids));
  const byId = new Map<string, MaterialCatalogEntry>(MATERIALS_CATALOG.map((m) => [m.id, m]));
  const sections = [
    ...GROUPS.map((g) => ({ key: g.key, items: g.ids.map((id) => byId.get(id)).filter((m): m is MaterialCatalogEntry => !!m) })),
    // 어느 묶음에도 없는 새 활동지는 "기타"로 모은다
    { key: 'other', items: MATERIALS_CATALOG.filter((m) => !known.has(m.id)) },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy mb-1.5">
          {t('materials.pageTitle')}
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('materials.pageSubtitle')}</p>
      </div>

      {sections.map((s) => (
        <section key={s.key} className="space-y-3">
          <h3 className="font-title-md text-title-md text-deep-navy">
            {t(`materials.group_${s.key}`)} <span className="text-on-surface-variant">{s.items.length}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {s.items.map((m) => (
              <Link
                  key={m.id}
                  to={m.path}
                  className="group relative bg-surface-container-lowest rounded-xl shadow-card overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all"
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
        </section>
      ))}
    </div>
  );
}

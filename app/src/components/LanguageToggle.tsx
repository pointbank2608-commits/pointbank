import { useTranslation } from 'react-i18next';

interface Props {
  className?: string;
}

/** 한국어/영어 전환 토글. 선택은 i18next-browser-languagedetector 가 localStorage 에 저장한다. */
export default function LanguageToggle({ className = '' }: Props) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'ko';

  function switchTo(next: 'ko' | 'en') {
    void i18n.changeLanguage(next);
  }

  return (
    <div className={`flex bg-surface-container-low rounded-full p-0.5 ${className}`}>
      <button
        type="button"
        onClick={() => switchTo('ko')}
        aria-pressed={lang === 'ko'}
        className={`px-2.5 py-1 rounded-full font-caption text-caption transition-all whitespace-nowrap ${
          lang === 'ko' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
        }`}
      >
        KO
      </button>
      <button
        type="button"
        onClick={() => switchTo('en')}
        aria-pressed={lang === 'en'}
        className={`px-2.5 py-1 rounded-full font-caption text-caption transition-all ${
          lang === 'en' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
        }`}
      >
        EN
      </button>
    </div>
  );
}

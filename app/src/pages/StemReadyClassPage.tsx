import {useTranslation} from 'react-i18next';
export default function StemReadyClassPage(){
 const {t}=useTranslation();
 return <main data-stem-ready className="mx-auto w-full max-w-5xl space-y-6"><header><h1 className="text-3xl font-extrabold text-deep-navy">{t('videoUi.stemTitle')}</h1><p className="mt-3 text-base text-on-surface-variant">{t('videoUi.stemDescription')}</p></header><section className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-outline-variant bg-white p-8 text-center"><span aria-hidden className="material-symbols-outlined rounded-full bg-sky-50 p-5 text-5xl text-primary">science</span><p role="status" className="text-xl font-bold text-deep-navy">{t('videoUi.stemEmpty')}</p></section></main>;
}

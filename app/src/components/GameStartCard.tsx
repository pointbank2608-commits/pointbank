import { useId } from 'react';
import { useTranslation } from 'react-i18next';

export default function GameStartCard({ name, description, onStart }: {
  name: string;
  description: string;
  onStart: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-deep-navy/25 p-3">
      <section aria-labelledby={titleId} data-game-start-card className="w-full max-w-sm rounded-2xl bg-white p-4 text-center text-deep-navy shadow-xl sm:p-6">
        <h2 id={titleId} className="text-xl font-black sm:text-2xl">{name}</h2>
        <p className="mt-2 text-sm leading-relaxed sm:text-base">{description}</p>
        <button type="button" autoFocus onClick={onStart} className="mt-4 min-h-11 rounded-xl bg-primary px-6 py-2 font-bold !text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
          <span aria-hidden="true">▶ </span>{t('flow.start')}
        </button>
      </section>
    </div>
  );
}

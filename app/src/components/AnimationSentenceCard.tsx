import type {ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import '../styles/animation-sentence-card.css';

type Props = {
  host: HTMLElement | null;
  title: string;
  progress?: string;
  speakers?: ReactNode;
  previous?: () => void;
  next?: () => void;
  hasNavigation?: boolean;
  actions?: ReactNode;
  roleSelector?: ReactNode;
  onList: () => void;
  onClose: () => void;
  children: ReactNode;
};

export default function AnimationSentenceCard({
  host, title, progress, speakers, previous, next, hasNavigation, actions, roleSelector, onList, onClose, children,
}: Props) {
  const {t} = useTranslation();
  if (!host) return null;
  return createPortal(
    <section className="animation-sentence-card" aria-label={title}>
      <header>
        <h2>{title}</h2>
        {speakers}
        {progress && <span className="episode-progress">{progress}</span>}
      </header>
      <div className="animation-sentence-content" data-navigation={hasNavigation || undefined}>
        {hasNavigation && <button aria-label={t('episodeActivities.previous')} disabled={!previous} onClick={previous}>❮</button>}
        <div className="animation-sentence-text">{children}</div>
        {hasNavigation && <button aria-label={t('episodeActivities.next')} disabled={!next} onClick={next}>❯</button>}
      </div>
      <footer>
        {roleSelector}
        {actions && <div className="animation-sentence-actions">{actions}</div>}
        <div className="animation-sentence-exits">
          <button onClick={onList}>{t('episodeActivities.list')}</button>
          <button onClick={onClose}>{t('episodeActivities.close')}</button>
        </div>
      </footer>
    </section>, host,
  );
}

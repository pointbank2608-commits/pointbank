import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useClasses } from '../lib/useClasses';
import { useFeature } from '../lib/features';
import ClassChipRow from '../components/ClassChipRow';
import AnimationSoloLibrary from '../components/solo/AnimationSoloLibrary';

export default function AnimationSoloPage() {
  const { t } = useTranslation();
  const { academy, profile } = useAuth();
  const classes = useClasses(academy?.id);
  const enabled = useFeature('solo');
  if (!enabled) return <p role="status">{t('animationSolo.closed')}</p>;
  if (!academy) return null;
  return <div className="space-y-5">
    <Link className="inline-block min-h-11 py-2 font-bold text-primary" to="/curriculum?mode=solo">{t('animationSolo.savedLessons')}</Link>
    <ClassChipRow classes={classes.classes} selectedId={classes.selectedId} onSelect={classes.select} onReorder={classes.reorder} />
    {classes.error && <p role="alert">{classes.error}</p>}
    <AnimationSoloLibrary academyId={academy.id} classId={classes.loading ? null : classes.selectedId} teacherId={profile?.id} />
  </div>;
}

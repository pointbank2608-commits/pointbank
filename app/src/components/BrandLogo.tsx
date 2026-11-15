import { useTranslation } from 'react-i18next';
import { brandLocalUrl, useBrandSrc } from '../lib/brand';
import BrandMark from './BrandMark';

interface Props {
  className?: string;
  /** 이름 없이 심볼만 표시 */
  symbolOnly?: boolean;
}

export default function BrandLogo({ className = 'h-11 w-auto', symbolOnly = false }: Props) {
  const { t } = useTranslation();
  const logo = useBrandSrc('logo');
  if (!symbolOnly && logo !== brandLocalUrl('logo')) {
    return <img src={logo} alt={t('common.brand')} width={1000} height={207} draggable={false} className={className} />;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} aria-label={symbolOnly ? t('common.brand') : undefined} role={symbolOnly ? 'img' : undefined}>
      <BrandMark className="h-full w-auto shrink-0" />
      {!symbolOnly && <span className="whitespace-nowrap text-xl font-black tracking-tight text-deep-navy sm:text-2xl">{t('common.brand')}</span>}
    </span>
  );
}

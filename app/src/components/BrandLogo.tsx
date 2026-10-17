import { useTranslation } from 'react-i18next';
import { useBrandSrc } from '../lib/brand';

interface Props {
  className?: string;
  /** true 면 로고 옆 글자(클래스뱅크)가 없는 심볼만 */
  symbolOnly?: boolean;
}

/** 클래스뱅크 전체 로고(심볼 + 글자). 헤더·로그인·약관 같은 "이름이 같이 있어야 하는 자리"에 쓴다. 그림은 Supabase 저장소 `brand/logo.webp`, 없으면 내장. */
export default function BrandLogo({ className = 'h-11 w-auto', symbolOnly = false }: Props) {
  const { t } = useTranslation();
  const f = symbolOnly ? 'symbol' : 'logo';
  const src = useBrandSrc(f);
  return (
    <img
      src={src}
      alt={t('common.brand')}
      width={symbolOnly ? 420 : 1000}
      height={symbolOnly ? 313 : 207}
      draggable={false}
      className={className}
    />
  );
}

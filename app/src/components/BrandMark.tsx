import { useBrandSrc } from '../lib/brand';

interface Props {
  className?: string;
}

/** 클래스뱅크 심볼(펼친 책 + 노란 말풍선). 그림은 Supabase 저장소 `brand/symbol.webp`(관리자 > 로고에서 교체), 없으면 내장 /brand/symbol.webp. */
export default function BrandMark({ className = 'h-10 w-10' }: Props) {
  const src = useBrandSrc('symbol');
  return <img src={src} alt="" aria-hidden width={420} height={313} draggable={false} className={`object-contain ${className}`} />;
}

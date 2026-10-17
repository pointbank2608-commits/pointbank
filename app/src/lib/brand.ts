import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * 브랜드 로고 저장소(2026-10-17) — 로고 그림은 Supabase 공개 버킷 `brand`(supabase/085a)에 두고 앱이 불러 쓴다.
 * 관리자 > 로고 탭에서 올리면 배포 없이 바뀐다. 저장소에 파일이 없거나 못 받으면 앱 안에 든 로고(`/brand/…`)로 대신 보여 준다.
 */
export type BrandFile = 'symbol' | 'logo' | 'wordmark';
export const BRAND_FILES: BrandFile[] = ['symbol', 'logo', 'wordmark'];
export const BRAND_BUCKET = 'brand';

const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;

export const brandRemoteUrl = (f: BrandFile) => `${base}/storage/v1/object/public/${BRAND_BUCKET}/${f}.webp`;
export const brandLocalUrl = (f: BrandFile) => `/brand/${f}.webp`;

// 서버 그림을 미리 받아 본 결과(true 받음 / false 없음·실패) — 같은 접속에서 되풀이하지 않는다
const probe = new Map<BrandFile, boolean>();
const waiting = new Map<BrandFile, Promise<boolean>>();

function probeRemote(f: BrandFile): Promise<boolean> {
  if (!base) return Promise.resolve(false);
  const known = probe.get(f);
  if (known !== undefined) return Promise.resolve(known);
  let p = waiting.get(f);
  if (!p) {
    p = new Promise<boolean>((resolve) => {
      const img = new Image();
      const timer = window.setTimeout(() => resolve(false), 4000);
      img.onload = () => {
        window.clearTimeout(timer);
        resolve(true);
      };
      img.onerror = () => {
        window.clearTimeout(timer);
        resolve(false);
      };
      img.src = brandRemoteUrl(f);
    }).then((ok) => {
      probe.set(f, ok);
      waiting.delete(f);
      return ok;
    });
    waiting.set(f, p);
  }
  return p;
}

/** 지금 쓸 주소. 처음엔 내장 로고를 보여 주고(빈 칸·깨진 그림이 없게), 서버 그림을 받아 보면 그걸로 바꾼다. */
export function useBrandSrc(f: BrandFile): string {
  const [src, setSrc] = useState(() => (probe.get(f) ? brandRemoteUrl(f) : brandLocalUrl(f)));
  useEffect(() => {
    let alive = true;
    void probeRemote(f).then((ok) => {
      if (alive && ok) setSrc(brandRemoteUrl(f));
    });
    return () => {
      alive = false;
    };
  }, [f]);
  return src;
}

/** 관리자가 올리거나 지운 뒤: 다시 확인하게 한다 */
export function resetBrandProbe(f: BrandFile) {
  probe.delete(f);
  waiting.delete(f);
}

/** 이미지 파일을 WebP(투명 유지)로 바꿔 maxWidth 안으로 줄인다 */
export async function toWebp(file: File, maxWidth: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('webp'))), 'image/webp', 0.92));
}

export async function uploadBrandFile(f: BrandFile, blob: Blob): Promise<void> {
  const { error } = await supabase.storage.from(BRAND_BUCKET).upload(`${f}.webp`, blob, { upsert: true, contentType: 'image/webp', cacheControl: '300' });
  if (error) throw new Error(error.message);
  resetBrandProbe(f);
}

export async function deleteBrandFile(f: BrandFile): Promise<void> {
  const { error } = await supabase.storage.from(BRAND_BUCKET).remove([`${f}.webp`]);
  if (error) throw new Error(error.message);
  resetBrandProbe(f);
}

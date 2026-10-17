import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { BRAND_FILES, brandLocalUrl, brandRemoteUrl, deleteBrandFile, toWebp, uploadBrandFile, type BrandFile } from '../lib/brand';

/** 관리자 > 로고(2026-10-17): 서버(Supabase 저장소)에 둔 브랜드 로고를 보고 교체한다. 올리면 배포 없이 사이트 전체가 바뀐다. */
const MAX_WIDTH: Record<BrandFile, number> = { symbol: 600, logo: 1400, wordmark: 1200 };

export default function AdminBrandPage() {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [busy, setBusy] = useState<BrandFile | null>(null);
  // 올린 직후 미리보기를 새로 받기 위한 값
  const [stamp, setStamp] = useState<Record<string, number>>({});
  const [fallback, setFallback] = useState<Record<string, boolean>>({});

  async function onPick(f: BrandFile, file: File | undefined) {
    if (!file) return;
    setBusy(f);
    try {
      const blob = await toWebp(file, MAX_WIDTH[f]);
      await uploadBrandFile(f, blob);
      setFallback((s) => ({ ...s, [f]: false }));
      setStamp((s) => ({ ...s, [f]: Date.now() }));
      notify(t('adminBrand.uploaded'));
    } catch (err) {
      notify(err instanceof Error ? err.message : t('adminBrand.failed'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function onReset(f: BrandFile) {
    if (!window.confirm(t('adminBrand.resetConfirm'))) return;
    setBusy(f);
    try {
      await deleteBrandFile(f);
      setFallback((s) => ({ ...s, [f]: true }));
      notify(t('adminBrand.resetDone'));
    } catch (err) {
      notify(err instanceof Error ? err.message : t('adminBrand.failed'), 'error');
    } finally {
      setBusy(null);
    }
  }

  const checker = 'bg-[length:16px_16px] bg-[linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%),linear-gradient(45deg,#eee_25%,#fff_25%,#fff_75%,#eee_75%)] [background-position:0_0,8px_8px]';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy">{t('adminBrand.title')}</h2>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{t('adminBrand.desc')}</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {BRAND_FILES.map((f) => {
          const src = fallback[f] ? brandLocalUrl(f) : `${brandRemoteUrl(f)}?t=${stamp[f] ?? 0}`;
          return (
            <section key={f} className="rounded-xl bg-surface-container-lowest p-5 shadow-card">
              <h3 className="font-title-md text-title-md text-on-surface">{t(`adminBrand.file_${f}`)}</h3>
              <p className="mb-3 font-caption text-caption text-on-surface-variant">{t(`adminBrand.hint_${f}`)}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className={`flex h-32 items-center justify-center rounded-lg border border-outline-variant/40 p-3 ${checker}`}>
                  <img
                    src={src}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      if (!fallback[f]) setFallback((s) => ({ ...s, [f]: true }));
                      else e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                <div className="flex h-32 items-center justify-center rounded-lg bg-[#16213e] p-3">
                  <img src={src} alt="" className="max-h-full max-w-full object-contain" />
                </div>
              </div>
              <p className="mt-2 font-caption text-caption text-on-surface-variant">
                {fallback[f] ? t('adminBrand.usingBuiltin') : t('adminBrand.usingServer')}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className={`cursor-pointer rounded-full bg-primary px-4 py-2 font-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container ${busy === f ? 'opacity-60' : ''}`}>
                  {busy === f ? t('adminBrand.uploading') : t('adminBrand.upload')}
                  <input type="file" accept="image/png,image/webp,image/jpeg" className="sr-only" disabled={busy !== null} onChange={(e) => void onPick(f, e.target.files?.[0])} />
                </label>
                <button
                  type="button"
                  disabled={busy !== null || fallback[f]}
                  onClick={() => void onReset(f)}
                  className="rounded-full border border-outline-variant px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low disabled:opacity-40"
                >
                  {t('adminBrand.reset')}
                </button>
              </div>
              <input readOnly value={brandRemoteUrl(f)} onFocus={(e) => e.currentTarget.select()} aria-label={t('adminBrand.urlLabel')} className="mt-3 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-1.5 font-caption text-caption text-on-surface-variant" />
            </section>
          );
        })}
      </div>
    </div>
  );
}

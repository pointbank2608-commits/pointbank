import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../context/ToastContext';
import type { HomeworkOverviewRow } from '../../../lib/homework';
import { fetchStudentCode, studentLink } from '../../../lib/studentPortal';

/**
 * 숙제 보내기 안내 — 학생은 학생 포털(학원 코드 + 이름 + 학부모 휴대폰 번호)로 들어가 숙제 목록에서 연다.
 * 반 QR·숙제 번호·PIN·학생별 QR 카드는 더 이상 나눠 주지 않는다.
 */
export default function HomeworkSharePanel({ hw }: { hw: Pick<HomeworkOverviewRow, 'id' | 'title'> }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const title = hw.title || t('studentHw.defaultTitle');
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [portalQr, setPortalQr] = useState<string | null>(null);
  const fallback = `${window.location.origin}/s`;

  useEffect(() => {
    let cancelled = false;
    void fetchStudentCode()
      .then(async (code) => {
        const link = code ? studentLink(code) : fallback;
        const dataUrl = await QRCode.toDataURL(link, { margin: 1, width: 360, errorCorrectionLevel: 'M' });
        if (!cancelled) {
          setPortalUrl(link);
          setPortalQr(dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setPortalUrl(fallback);
      });
    return () => {
      cancelled = true;
    };
  }, [fallback]);

  const copy = (text: string, msg: string) =>
    navigator.clipboard.writeText(text).then(
      () => notify(msg),
      () => notify(t('studentHw.copyFailed'), 'error'),
    );

  const btn = 'flex min-h-11 items-center gap-1.5 rounded-full px-4 font-label-md text-label-md';
  const link = portalUrl ?? fallback;
  return (
    <div className="flex flex-wrap items-start gap-6 border-t border-outline-variant/40 p-4">
      {portalQr && (
        <figure className="flex flex-col items-center gap-1">
          <img src={portalQr} alt={t('studentHw.kidsPortalQrAlt')} className="h-44 w-44 rounded-lg bg-white p-1" />
          <figcaption className="text-sm text-on-surface-variant">{t('studentHw.portalQr')}</figcaption>
        </figure>
      )}
      <div className="min-w-0 flex-1 space-y-3">
        <div className="rounded-xl bg-primary/10 px-4 py-3 text-base text-deep-navy">
          <div className="mb-1 flex items-center gap-2 font-bold">
            <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
            {t('studentHw.portalShareTitle')}
          </div>
          <p>{t('studentHw.portalShareBody')}</p>
        </div>
        <div className="break-all text-base text-primary">{link}</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void copy(t('studentHw.kidsShareMessage', { title, url: link }), t('studentHw.copiedMessage'))} className={`${btn} bg-primary text-on-primary`}>
            <span className="material-symbols-outlined text-[18px]">chat</span>
            {t('studentHw.copyMessage')}
          </button>
          <button type="button" onClick={() => void copy(link, t('studentHw.copiedLink'))} className={`${btn} border border-outline-variant text-on-surface`}>
            <span className="material-symbols-outlined text-[18px]">link</span>
            {t('studentHw.copyLink')}
          </button>
        </div>
        <p className="text-sm text-on-surface-variant">{t('studentHw.kidsShareNeed')}</p>
      </div>
    </div>
  );
}

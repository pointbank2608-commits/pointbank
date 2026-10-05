import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../context/ToastContext';
import { fetchPersonalLinks, homeworkUrl, personalHomeworkUrl, teacherErrorKey, type HomeworkOverviewRow, type PersonalLink } from '../../../lib/homework';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * 숙제 보내기 — 반 QR·숙제 번호·링크·카톡 메시지 복사 + 학생별 개인 QR 카드 인쇄.
 * 반 링크는 이름 + PIN 이 필요하고, 개인 QR 은 그 학생만 바로 들어간다(카드를 나눠 줄 때).
 */
export default function HomeworkSharePanel({ hw }: { hw: Pick<HomeworkOverviewRow, 'id' | 'code' | 'title' | 'kind' | 'due_at'> }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [qr, setQr] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const url = homeworkUrl(hw.code);
  const title = hw.title || t('studentHw.defaultTitle');
  const isCustom = hw.kind === 'custom';

  useEffect(() => {
    if (isCustom) return;
    void QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: 'M' }).then(setQr);
  }, [url, isCustom]);

  const copy = (text: string, msg: string) =>
    navigator.clipboard.writeText(text).then(
      () => notify(msg),
      () => notify(t('studentHw.copyFailed'), 'error'),
    );

  const message = t('studentHw.shareMessage', { title, url, code: hw.code });

  async function printCards() {
    setPrinting(true);
    // 팝업 차단을 피하려고 창을 먼저 연다
    const w = window.open('', '_blank');
    try {
      const links: PersonalLink[] = await fetchPersonalLinks(hw.id);
      const cards = await Promise.all(
        links.map(async (l) => ({ ...l, qr: await QRCode.toDataURL(personalHomeworkUrl(l.access), { margin: 1, width: 260, errorCorrectionLevel: 'M' }) })),
      );
      if (!w) {
        notify(t('studentHw.popupBlocked'), 'error');
        return;
      }
      const due = hw.due_at ? t('studentHw.dueShort', { date: new Date(hw.due_at).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }) : '';
      w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
@page{size:A4;margin:10mm}
body{font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;margin:0;color:#142a46}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm}
.card{border:1.5px dashed #9aa3b5;border-radius:4mm;padding:4mm;text-align:center;break-inside:avoid}
.name{font-size:16pt;font-weight:800}
.t{font-size:10pt;color:#555;margin-top:1mm}
img{width:38mm;height:38mm;margin:2mm auto;display:block}
.hint{font-size:9pt;color:#555}
</style></head><body><div class="grid">${cards
        .map(
          (c) => `<div class="card"><div class="name">${escapeHtml(c.name)}</div><div class="t">${escapeHtml(title)}${due ? ' · ' + escapeHtml(due) : ''}</div><img src="${c.qr}" alt=""><div class="hint">${escapeHtml(t('studentHw.cardHint'))}</div></div>`,
        )
        .join('')}</div><script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`);
      w.document.close();
    } catch (e) {
      w?.close();
      notify(t(teacherErrorKey(e)), 'error');
    } finally {
      setPrinting(false);
    }
  }

  const btn = 'flex min-h-11 items-center gap-1.5 rounded-full px-4 font-label-md text-label-md';
  return (
    <div className="flex flex-wrap items-start gap-6 border-t border-outline-variant/40 p-4">
      {!isCustom && qr && (
        <figure className="flex flex-col items-center gap-1">
          <img src={qr} alt={t('studentHw.classQrAlt')} className="h-44 w-44 rounded-lg bg-white p-1" />
          <figcaption className="text-sm text-on-surface-variant">{t('studentHw.classQr')}</figcaption>
        </figure>
      )}
      <div className="min-w-0 flex-1 space-y-3">
        {isCustom ? (
          <p className="text-base text-on-surface">{t('studentHw.customShareNote')}</p>
        ) : (
          <>
            <div>
              <div className="font-caption text-caption text-on-surface-variant">{t('studentHw.code')}</div>
              <div className="font-headline-md text-headline-md tabular-nums tracking-widest text-deep-navy">{hw.code}</div>
              <div className="break-all text-base text-primary">{url}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void copy(message, t('studentHw.copiedMessage'))} className={`${btn} bg-primary text-on-primary`}>
                <span className="material-symbols-outlined text-[18px]">chat</span>
                {t('studentHw.copyMessage')}
              </button>
              <button type="button" onClick={() => void copy(url, t('studentHw.copiedLink'))} className={`${btn} border border-outline-variant text-on-surface`}>
                <span className="material-symbols-outlined text-[18px]">link</span>
                {t('studentHw.copyLink')}
              </button>
              <button type="button" onClick={() => void copy(hw.code, t('studentHw.copiedCode'))} className={`${btn} border border-outline-variant text-on-surface`}>
                <span className="material-symbols-outlined text-[18px]">pin</span>
                {t('studentHw.copyCode')}
              </button>
            </div>
            <p className="text-sm text-on-surface-variant">{t('studentHw.shareHint')}</p>
          </>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant/30 pt-3">
          <button type="button" disabled={printing} onClick={() => void printCards()} className={`${btn} border border-outline-variant text-on-surface disabled:opacity-50`}>
            <span className="material-symbols-outlined text-[18px]">print</span>
            {printing ? t('common.loading') : t('studentHw.printCards')}
          </button>
          <span className="text-sm text-on-surface-variant">{t('studentHw.printCardsHint')}</span>
        </div>
      </div>
    </div>
  );
}

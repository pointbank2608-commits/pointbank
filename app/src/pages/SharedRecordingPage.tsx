import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import BrandMark from '../components/BrandMark';
import { base64ToBlobUrl, fetchSharedRecording, type SharedRecording } from '../lib/soloApi';
import { useYoutubeSegment } from '../lib/useYoutubeSegment';

const shell = 'min-h-[100dvh] bg-[#16213e] text-white';

/**
 * 학부모가 링크(/r/열쇠)로 보는 "우리 아이 녹음" — 로그인 없음.
 * 줄마다 원곡 구간(유튜브)과 아이 목소리를 나란히 들을 수 있다. 만료·닫힘이면 "열 수 없는 링크".
 */
export default function SharedRecordingPage() {
  const { t } = useTranslation();
  const { token } = useParams();
  const [data, setData] = useState<SharedRecording | null | undefined>(undefined);

  useEffect(() => {
    if (!token) {
      setData(null);
      return;
    }
    fetchSharedRecording(token)
      .then(setData)
      .catch(() => setData(null));
  }, [token]);

  const urls = useMemo(() => (data ? data.items.map((it) => base64ToBlobUrl(it.b64, it.mime)) : []), [data]);
  useEffect(
    () => () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    },
    [urls],
  );

  const videoId = data?.items.find((it) => it.line?.videoId)?.line?.videoId ?? null;
  const yt = useYoutubeSegment(videoId);
  const [playing, setPlaying] = useState<number | null>(null);

  if (data === undefined) return <div className={`${shell} flex items-center justify-center text-lg text-white/70`}>{t('common.loading')}</div>;
  if (data === null) {
    return (
      <div className={`${shell} flex flex-col items-center justify-center gap-3 p-6 text-center`}>
        <BrandMark className="h-12 w-12" />
        <p className="text-2xl font-bold">{t('sharedRecording.closedTitle')}</p>
        <p className="max-w-sm text-base text-white/70">{t('sharedRecording.closedText')}</p>
      </div>
    );
  }

  return (
    <div className={shell}>
      <header className="border-b border-white/10 px-5 py-4">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <BrandMark className="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold">{data.academy ?? 'Classbank'}</div>
            <div className="truncate text-sm text-white/60">{data.lesson}</div>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-xl flex-col gap-5 px-5 py-6">
        <h1 className="text-2xl font-bold">{data.student ? t('sharedRecording.titleNamed', { name: data.student }) : t('sharedRecording.titleHidden')}</h1>
        <p className="text-base text-white/70">{t('sharedRecording.intro')}</p>

        {videoId && !yt.failed && (
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
            <div id={yt.elementId} className="absolute inset-0 h-full w-full" />
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {data.items.map((it, i) => (
            <li key={it.step} className="rounded-2xl bg-white/10 p-4">
              {it.line?.en && <div className="text-xl font-bold leading-snug">{it.line.en}</div>}
              {it.line?.ko && <div className="mt-1 text-base text-white/70">{it.line.ko}</div>}
              <div className="mt-3 flex flex-col gap-2">
                {it.line?.videoId && it.line.start != null && it.line.end != null && (
                  <button
                    type="button"
                    disabled={playing === i || !yt.ready || yt.failed}
                    onClick={async () => {
                      setPlaying(i);
                      await yt.playSegment(Number(it.line?.start), Number(it.line?.end));
                      setPlaying(null);
                    }}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-white/15 px-4 text-base font-bold disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">play_circle</span>
                    {t('sharedRecording.original')}
                  </button>
                )}
                <div className="text-sm text-warm-yellow">{t('sharedRecording.myChild')}</div>
                <audio src={urls[i]} controls className="w-full" />
              </div>
            </li>
          ))}
        </ul>

        <p className="text-center text-sm text-white/50">{t('sharedRecording.until', { date: new Date(data.expires_at).toLocaleDateString() })}</p>
      </main>
    </div>
  );
}

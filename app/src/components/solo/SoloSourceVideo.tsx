import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { SoloClip } from '../../lib/soloLessons';
import { useYoutubeSegment } from '../../lib/useYoutubeSegment';

export default function SoloSourceVideo({ clip, audioOnly, bounded = false, playRequest = 0, playLabel, onCaptionShown, onPlay, onHeard, onError }: {
  clip: SoloClip;
  audioOnly?: boolean;
  bounded?: boolean;
  playRequest?: number;
  playLabel?: string;
  onCaptionShown?: () => void;
  onPlay: () => void;
  onHeard: () => void;
  onError: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const youtube = useYoutubeSegment(clip.mediaUrl ? null : clip.videoId, clip.start, bounded);
  const [time, setTime] = useState(clip.start);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [captions, setCaptions] = useState(false);
  const running = useRef(false);
  const interrupted = useRef(false);
  const mounted = useRef(false);
  const lastRequest = useRef(0);
  const caption = captions && (audioOnly || bounded && (clip.captions?.length??0)<=1
    ? clip.captions?.[0]
    : clip.captions?.find(line => line.start <= time && time < line.end));
  const reportError = useEffectEvent(onError);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (youtube.failed) reportError();
  }, [youtube.failed]);

  function sync() {
    const media = video.current;
    if (!media || !running.current) return;
    setTime(media.currentTime);
    if (media.currentTime < clip.end && !media.ended) return;
    running.current = false;
    media.pause();
    setPlaying(false);
    if (media.currentTime + 0.05 >= clip.end) onHeard();
    else onError();
  }

  const syncPlayback = useEffectEvent(sync);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => syncPlayback(), 25);
    return () => window.clearInterval(timer);
  }, [playing]);

  async function play() {
    interrupted.current=false;
    if (!clip.mediaUrl) {
      setTime(clip.start);
      onPlay();
      const completed = await youtube.playSegment(clip.start, clip.end, 1, setTime);
      if (!mounted.current||interrupted.current) return;
      if (completed) onHeard();
      else onError();
      return;
    }
    const media = video.current;
    if (!media || running.current) return;
    try {
      running.current = true;
      media.currentTime = clip.start;
      setTime(clip.start);
      await media.play();
      if (mounted.current && running.current) {
        setPlaying(true);
        onPlay();
      }
    } catch {
      running.current = false;
      if (mounted.current) onError();
    }
  }

  function stop(){
    interrupted.current=true;
    running.current=false;
    youtube.stop();video.current?.pause();setPlaying(false);
  }

  const available = clip.mediaUrl ? ready && !playing : youtube.ready && !youtube.playing && !youtube.failed;
  const playRequested = useEffectEvent(() => void play());
  useEffect(() => {
    if (!available || playRequest <= lastRequest.current) return;
    lastRequest.current = playRequest;
    playRequested();
  }, [available, playRequest]);

  return (
    <div className="w-full space-y-2">
      <div className="overflow-hidden rounded-xl bg-black">
        {clip.mediaUrl ? (
          <video ref={video} src={clip.mediaUrl} playsInline preload="auto" className={audioOnly ? 'sr-only' : 'w-full'}
            aria-hidden={audioOnly || undefined} disablePictureInPicture
            onCanPlay={() => setReady(true)} onTimeUpdate={sync} onEnded={sync}
            onError={() => { running.current = false; setPlaying(false); setReady(false); onError(); }} />
        ) : (
          <div className="relative aspect-video min-h-[200px] w-full" inert={bounded}>
            <div id={youtube.elementId} className="absolute inset-0 h-full w-full" />
          </div>
        )}
        {captions && <p data-source-caption className="min-h-16 bg-black px-3 py-2 text-center text-lg text-white">{caption ? caption.text : ''}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!available} onClick={() => void play()} className="min-h-12 flex-1 rounded-xl bg-[#3b5bdb] px-4 font-bold text-white disabled:opacity-50">
          {playing || youtube.playing ? '원음 재생 중' : playLabel ?? (audioOnly ? '원음 듣기' : '원본 재생')}
        </button>
        {(playing||youtube.playing)&&<button type="button" className="min-h-12 rounded-xl border border-[#d9d3c3] px-4" onClick={stop}>재생 멈추기</button>}
        {!!clip.captions?.length && (
          <button type="button" aria-pressed={captions} onClick={() => {
            if (!captions) onCaptionShown?.();
            setCaptions(!captions);
          }} className="min-h-12 rounded-xl border border-[#d9d3c3] px-4">
            {captions ? '자막 끄기' : '자막 켜기'}
          </button>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { HwItem } from "../../lib/homework/types";
import { recordingCache } from "../../lib/homework/recordingCache";
import {
  extractYoutubeId,
  loadYoutubeIframeApi,
  type YoutubePlayer,
} from "../../lib/youtube";
import { speak } from "../../lib/speech";
import type { RunnerApi } from "./runnerTypes";

const btn =
  "min-h-14 rounded-2xl bg-warm-yellow px-5 py-3 text-lg font-bold text-deep-navy disabled:opacity-40 focus-visible:outline-4 focus-visible:outline-white";
export default function BlockActivity({
  item,
  api,
  preview,
  onDone,
}: {
  item: HwItem;
  api: RunnerApi;
  preview: boolean;
  onDone: (meta: Record<string, unknown>) => Promise<void>;
}) {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith("en");
  const l = useCallback(
    (ko: string, english: string) => (en ? english : ko),
    [en],
  );
  const b = item.config.block!;
  const cache = api.cacheScope ? `${api.cacheScope}:${item.id}` : "";
  const [recovery] = useState(() => {
    try {
      return cache && !preview
        ? JSON.parse(localStorage.getItem(`hw.block.${cache}`) || "{}")
        : {};
    } catch {
      return {};
    }
  });
  const [response, setResponse] = useState<string>(
    typeof recovery.response === "string" ? recovery.response : "",
  );
  const [hints, setHints] = useState<number>(Number(recovery.hints) || 0);
  const [listens, setListens] = useState<number>(Number(recovery.listens) || 0);
  const [stage, setStage] = useState<number>(
    Math.min(Number(recovery.stage) || 0, b.stages.length),
  );
  const [repeated, setRepeated] = useState<number>(
    Number(recovery.repeated) || 0,
  );
  const [showHint, setShowHint] = useState(false);
  const [watched, setWatched] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const uploadPath = useRef<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    if (cache && !preview)
      void recordingCache(cache)
        .then((v) => {
          if (v && mounted.current) {
            setBlob(v.blob);
            setDuration(v.duration);
          }
        })
        .catch(() =>
          setError(
            l(
              "기기 녹음 복구 저장을 사용할 수 없습니다.",
              "Recording recovery is unavailable on this device.",
            ),
          ),
        );
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [cache, preview, l]);
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  useEffect(() => {
    if (cache && !preview) {
      try {
        localStorage.setItem(
          `hw.block.${cache}`,
          JSON.stringify({ response, hints, listens, stage, repeated }),
        );
      } catch {
        setError(
          l(
            "자동 저장 실패. 이 화면을 닫지 말고 재시도하세요.",
            "Autosave failed. Stay here and retry.",
          ),
        );
      }
    }
  }, [cache, preview, response, hints, listens, stage, repeated, l]);
  async function startRecording() {
    setError("");
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        l(
          "이 기기는 녹음을 지원하지 않습니다. 최신 Chrome 또는 Safari를 사용해 주세요.",
          "Recording is unsupported. Use a current Chrome or Safari.",
        ),
      );
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const mime = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      if (!mime) {
        media.getTracks().forEach((t) => t.stop());
        throw new Error("unsupported");
      }
      const r = new MediaRecorder(media, { mimeType: mime });
      recorder.current = r;
      const chunks: BlobPart[] = [];
      const start = performance.now();
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onerror = () => {
        setError(
          l("녹음 실패. 다시 녹음해 주세요.", "Recording failed. Try again."),
        );
        media.getTracks().forEach((t) => t.stop());
        setRecording(false);
      };
      r.onstop = () => {
        media.getTracks().forEach((t) => t.stop());
        if (timer.current) clearTimeout(timer.current);
        const seconds = Math.min(120, (performance.now() - start) / 1000);
        const audio = new Blob(chunks, { type: mime });
        if (!mounted.current) return;
        setRecording(false);
        if (audio.size > 8 * 1024 * 1024 || audio.size < 64 || seconds < 0.5) {
          setError(
            l(
              "녹음은 0.5~120초, 8MB 이하여야 합니다.",
              "Record 0.5–120 seconds, up to 8 MB.",
            ),
          );
          return;
        }
        setBlob(audio);
        setDuration(seconds);
        uploadPath.current = null;
        if (cache && !preview)
          void recordingCache(cache, { blob: audio, duration: seconds }).catch(
            () =>
              setError(
                l(
                  "기기 저장 실패. 화면을 유지하고 제출해 주세요.",
                  "Device save failed. Keep this screen open and submit.",
                ),
              ),
          );
      };
      r.start();
      setRecording(true);
      timer.current = setTimeout(() => {
        if (r.state === "recording") r.stop();
      }, 120000);
    } catch (e) {
      setError(
        (e as DOMException).name === "NotAllowedError"
          ? l(
              "마이크 권한이 거부되었습니다. 브라우저 설정에서 허용한 뒤 다시 눌러 주세요.",
              "Microphone permission denied. Allow it in browser settings and retry.",
            )
          : l(
              "마이크를 사용할 수 없습니다. 기기와 권한을 확인해 주세요.",
              "Microphone unavailable. Check your device and permissions.",
            ),
      );
    }
  }
  async function finish() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      let path = uploadPath.current;
      if (b.completion === "recording") {
        if (!blob) throw new Error("recording_required");
        if (!preview && !path) {
          if (!api.uploadRecording) throw new Error("upload_unavailable");
          path = await api.uploadRecording(item.id, blob, duration);
          uploadPath.current = path;
        }
      }
      await onDone({
        response: response.trim(),
        recording: path,
        duration,
        hints,
        listens,
        watched,
        confirmed: b.completion === "confirm",
        stages: b.stages,
        repeats: repeated,
      });
      if (cache && !preview) {
        localStorage.removeItem(`hw.block.${cache}`);
        await recordingCache(cache, null);
      }
    } catch {
      setError(
        l(
          "제출 또는 업로드에 실패했습니다. 녹음과 답변을 보관했으니 다시 제출하세요.",
          "Submission or upload failed. Your recording and response are kept. Retry submission.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  if (
    b.schemaVersion !== 1 ||
    !["study", "speak", "sentence", "video"].includes(b.type)
  )
    return (
      <p role="alert" className="p-6">
        {l(
          "지원하지 않는 블록 버전 또는 손상된 자료입니다. 선생님에게 알려 주세요.",
          "Unsupported or damaged activity. Contact your teacher.",
        )}
      </p>
    );
  const currentStage = b.stages[stage];
  const speakingReady = b.type !== "speak" || stage >= b.stages.length;
  const allowed =
    (b.type !== "video" || watched) &&
    speakingReady &&
    (b.completion !== "review" || !!response.trim()) &&
    (b.completion !== "recording" || !!blob);
  return (
    <div className="flex flex-1 flex-col gap-4 p-5">
      <h2 className="text-2xl font-bold">{item.title}</h2>
      {preview && (
        <p className="rounded-xl bg-white/10 p-2">
          {l(
            "미리보기 · 기록·포인트·알림 없음",
            "Preview · No records, points or notifications",
          )}
        </p>
      )}
      {b.imageUrl && (
        <img
          className="mx-auto max-h-56 max-w-full rounded-xl object-contain"
          src={b.imageUrl}
          alt={l("활동 그림", "Activity illustration")}
          onError={() =>
            setError(l("그림을 불러올 수 없습니다.", "Image unavailable."))
          }
        />
      )}
      {b.type === "speak" && !speakingReady && (
        <p className="text-lg text-warm-yellow">
          {stage + 1} / {b.stages.length} ·{" "}
          {l(
            currentStage === "model"
              ? "보고 따라 말해요"
              : currentStage === "hidden"
                ? "빈칸을 기억해서 말해요"
                : "그림만 보고 말해요",
            currentStage === "model"
              ? "Listen and repeat"
              : currentStage === "hidden"
                ? "Recall the hidden words"
                : "Speak from the picture",
          )}
        </p>
      )}
      {(b.type !== "speak" ||
        (currentStage !== "picture" && !speakingReady) ||
        showHint) && (
        <p className="text-center text-2xl leading-relaxed">
          {b.type === "speak" && currentStage === "hidden" && !showHint
            ? b.text
                .split(/\s+/)
                .map((w, i) => (b.hiddenWords.includes(i) ? "____" : w))
                .join(" ")
            : b.text}
        </p>
      )}
      {b.translation &&
        (b.type !== "speak" || currentStage === "model" || showHint) && (
          <p className="text-center text-lg">{b.translation}</p>
        )}
      {b.type !== "video" && (
        <div className="flex flex-wrap gap-2">
          <button
            className={btn}
            onClick={() => {
              setListens((n) => n + 1);
              if (b.audioUrl) {
                void new Audio(b.audioUrl)
                  .play()
                  .catch(() =>
                    setError(
                      l(
                        "음성을 재생할 수 없습니다.",
                        "Audio playback unavailable.",
                      ),
                    ),
                  );
              } else speak(b.text);
            }}
          >
            {l("다시 듣기", "Listen again")}
          </button>
          {b.type === "speak" && (
            <button
              className={btn}
              onClick={() => {
                setHints((n) => n + 1);
                setShowHint(!showHint);
              }}
            >
              {l("힌트 보기/숨기기", "Show / hide hint")}
            </button>
          )}
        </div>
      )}
      {b.type === "speak" && !speakingReady && (
        <button
          className={btn}
          onClick={() => {
            const n = repeated + 1;
            if (n >= b.repeats) {
              setStage(stage + 1);
              setRepeated(0);
              setShowHint(false);
            } else setRepeated(n);
          }}
        >
          {l("말해 봤어요", "I practised")} · {repeated + 1}/{b.repeats}
        </button>
      )}
      {b.type === "video" && (
        <VideoSegment
          url={b.videoUrl}
          start={b.start}
          end={b.end}
          onWatched={() => setWatched(true)}
          onError={() =>
            setError(
              l(
                "영상 재생 실패 또는 접근 불가. 연결을 확인하고 다시 열거나 선생님에게 알려 주세요.",
                "Video unavailable. Check connection, reopen or contact your teacher.",
              ),
            )
          }
        />
      )}
      {b.question && <p className="text-xl font-bold">{b.question}</p>}
      {b.completion === "review" && (
        <label className="text-lg">
          {l("내 답변 · 선생님이 확인해요", "My response · Teacher review")}
          <textarea
            className="mt-2 min-h-32 w-full rounded-xl bg-white p-3 text-xl text-deep-navy"
            maxLength={2000}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
          />
        </label>
      )}
      {b.completion === "recording" && speakingReady && (
        <div className="space-y-3 rounded-xl bg-white/10 p-4">
          <p>
            {l(
              "대표 녹음 1개 제출 · 최대 2분 · 8MB. 녹음은 선생님이 확인합니다.",
              "Submit one recording · Up to 2 minutes / 8 MB. Your teacher reviews it.",
            )}
          </p>
          <button
            className={btn}
            disabled={busy}
            onClick={() =>
              recording ? recorder.current?.stop() : void startRecording()
            }
          >
            {recording
              ? l("녹음 끝내기", "Stop recording")
              : blob
                ? l("다시 녹음", "Record again")
                : l("녹음 시작", "Start recording")}
          </button>
          {url && <audio className="w-full" src={url} controls />}
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-rose-950 p-3 text-white">
          {error}
        </p>
      )}
      {speakingReady && (
        <button
          className={`${btn} mt-auto`}
          disabled={!allowed || busy || recording}
          onClick={() => void finish()}
        >
          {busy
            ? l("업로드·저장 중…", "Uploading / saving…")
            : b.completion === "watch"
              ? l("시청 완료 제출", "Submit viewing completion")
              : b.completion === "confirm"
                ? l("학습 내용을 확인했어요", "I reviewed the content")
                : l("제출하고 다음으로", "Submit and continue")}
        </button>
      )}
      {b.type === "video" && !watched && (
        <p>
          {l(
            "지정 구간을 시청한 뒤 제출할 수 있어요.",
            "Watch the selected segment before submitting.",
          )}
        </p>
      )}
    </div>
  );
}

function VideoSegment({
  url,
  start,
  end,
  onWatched,
  onError,
}: {
  url: string;
  start: number;
  end: number;
  onWatched: () => void;
  onError: () => void;
}) {
  const id = useRef(`hw-video-${crypto.randomUUID()}`);
  const callbacks = useRef({ onWatched, onError });
  callbacks.current = { onWatched, onError };
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let player: YoutubePlayer | undefined;
    let cancelled = false;
    let playing = false;
    let last = start;
    let elapsed = 0;
    let done = false;
    const seen = new Set<number>();
    const guard = setTimeout(() => {
      if (!player) callbacks.current.onError();
    }, 15000);
    void loadYoutubeIframeApi()
      .then(() => {
        if (cancelled || !window.YT) return;
        player = new window.YT.Player(id.current, {
          videoId: extractYoutubeId(url),
          playerVars: { start, end, playsinline: 1, rel: 0 },
          events: {
            onReady: () => clearTimeout(guard),
            onError: () => callbacks.current.onError(),
            onStateChange: (e: { data: number }) => {
              playing = e.data === 1;
            },
          },
        });
      })
      .catch(() => callbacks.current.onError());
    const poll = setInterval(() => {
      if (!playing || !player || done) return;
      const now = player.getCurrentTime();
      const delta = now - last;
      if (delta > 0 && delta <= 1.8 && now >= start && now <= end + 1) {
        elapsed += Math.min(delta, 1);
        seen.add(Math.floor(now));
      }
      last = now;
      // Seeking to the end cannot satisfy continuous segment coverage.
      if (
        elapsed >= (end - start) * 0.85 &&
        seen.size >= Math.max(1, Math.floor((end - start) * 0.8))
      ) {
        done = true;
        callbacks.current.onWatched();
      }
    }, 500);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearTimeout(guard);
      player?.destroy();
    };
  }, [url, start, end, retry]);
  return (
    <div>
      <div key={retry} className="aspect-video w-full" id={id.current} />
      <button
        type="button"
        className="min-h-11 underline"
        onClick={() => setRetry((v) => v + 1)}
      >
        영상 다시 연결 / Reload video
      </button>
    </div>
  );
}

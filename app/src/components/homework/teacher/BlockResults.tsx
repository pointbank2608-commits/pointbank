import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  blockResults,
  recordingUrl,
  reviewBlock,
  type BlockResult,
} from "../../../lib/homework/blockApi";

export default function BlockResults({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith("en");
  const [rows, setRows] = useState<BlockResult[]>([]);
  const [error, setError] = useState("");
  const [audio, setAudio] = useState<Record<string, string>>({});
  const load = useCallback(
    () =>
      blockResults(assignmentId)
        .then(setRows)
        .catch(() =>
          setError(
            en
              ? "Block results unavailable. Check migration 087."
              : "블록별 결과를 불러오지 못했습니다. 087 마이그레이션을 확인하세요.",
          ),
        ),
    [assignmentId, en],
  );
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15000);
    return () => clearInterval(timer);
  }, [load]);
  if (error)
    return (
      <p role="status" className="text-sm text-error">
        {error}
      </p>
    );
  if (!rows.length) return null;
  return (
    <section
      className="space-y-3 rounded-xl bg-surface-container-low p-4"
      aria-label={en ? "Block results" : "블록별 결과"}
    >
      <h3 className="font-bold">
        {en ? "Submissions and teacher review" : "제출·교사 확인"}
      </h3>
      {rows.map((r) => {
        const key = `${r.attempt_id}:${r.item_id}`;
        return (
          <article key={key} className="space-y-2 rounded-xl bg-white p-3">
            <p className="font-bold">
              {r.name} · {r.title} ·{" "}
              {r.meta.review === "pending"
                ? en
                  ? "Review needed"
                  : "교사 확인 필요"
                : r.meta.review === "reviewed"
                  ? en
                    ? "Reviewed"
                    : "확인 완료"
                  : r.finished
                    ? en
                      ? "Submitted"
                      : "제출 완료"
                    : r.started
                      ? en
                        ? "In progress"
                        : "진행 중"
                      : en
                        ? "Not started"
                        : "미시작"}
            </p>
            {r.total > 0 && r.answered > 0 && (
              <p>
                {en ? "First / final correct" : "첫 시도 / 최종 정답"}:{" "}
                {r.first_correct}/{r.total} → {r.final_correct}/{r.total} ·{" "}
                {en ? "Retries" : "재시도"} {r.retries}
              </p>
            )}
            {r.total > 0 && !r.answered && (
              <p>{en ? "Not assessed" : "평가 전"}</p>
            )}
            {r.meta.watched && <p>{en ? "Viewing complete" : "시청 완료"}</p>}
            <p>
              {en ? "Hints / listens" : "힌트 / 다시 듣기"}: {r.meta.hints || 0}{" "}
              / {r.meta.listens || 0}
            </p>
            {r.meta.response && (
              <p className="whitespace-pre-wrap">{r.meta.response}</p>
            )}
            {r.meta.recording && (
              <>
                {audio[key] ? (
                  <audio controls src={audio[key]} />
                ) : (
                  <button
                    className="min-h-11 rounded-lg border px-3"
                    onClick={() =>
                      void recordingUrl(r.meta.recording!)
                        .then((url) => setAudio((a) => ({ ...a, [key]: url })))
                        .catch(() =>
                          setError(
                            en
                              ? "Recording unavailable. Retry later."
                              : "녹음을 불러오지 못했습니다. 다시 시도하세요.",
                          ),
                        )
                    }
                  >
                    {en ? "Listen to recording" : "대표 녹음 듣기"}
                  </button>
                )}
              </>
            )}
            {r.meta.review === "pending" && (
              <button
                className="min-h-11 rounded-lg bg-primary px-4 text-white"
                onClick={() =>
                  void reviewBlock(r.attempt_id, r.item_id)
                    .then(load)
                    .catch(() =>
                      setError(en ? "Review save failed." : "확인 저장 실패"),
                    )
                }
              >
                {en ? "Mark reviewed" : "확인 완료로 표시"}
              </button>
            )}
          </article>
        );
      })}
    </section>
  );
}

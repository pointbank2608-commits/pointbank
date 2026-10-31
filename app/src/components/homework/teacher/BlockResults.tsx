import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  blockResults,
  recordingUrl,
  reviewBlock,
  type BlockResult,
} from "../../../lib/homework/blockApi";

/** 활동 한 칸의 색: 첫 시도 정답률(90↑ 초록 · 70↑ 노랑 · 그 아래 주황), 점수 없는 활동은 끝냄 파랑, 아직이면 회색 */
function cellStyle(r: BlockResult): { bg: string; label: string } {
  if (r.total > 0 && r.answered > 0) {
    const p = Math.round((100 * r.first_correct) / r.total);
    return { bg: p >= 90 ? "bg-emerald-400" : p >= 70 ? "bg-amber-300" : "bg-orange-400", label: `${p}` };
  }
  if (r.finished) return { bg: "bg-sky-300", label: "✓" };
  if (r.started) return { bg: "bg-surface-container-highest", label: "…" };
  return { bg: "bg-surface-container-high", label: "" };
}

/** 활동별 결과(학생 × 활동)를 15초마다 읽는다. 화면이 보일 때만 */
export function useBlockRows(assignmentId: string) {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith("en");
  const [rows, setRows] = useState<BlockResult[]>([]);
  const [error, setError] = useState("");
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
  return { rows, error, setError, load };
}

/** 반 전체 피드백: 색 설명 · 교사 확인 필요 개수 · 활동 방식별 평균(낮은 것부터) */
export function ClassMethods({ rows }: { rows: BlockResult[] }) {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith("en");
  const { methods, pending } = useMemo(() => {
    const acc = new Map<string, { ok: number; total: number }>();
    for (const r of rows) {
      if (!(r.total > 0 && r.answered > 0)) continue;
      const a = acc.get(r.title) ?? { ok: 0, total: 0 };
      a.ok += r.first_correct;
      a.total += r.total;
      acc.set(r.title, a);
    }
    const methods = [...acc.entries()].map(([title, a]) => ({ title, pct: Math.round((100 * a.ok) / a.total) })).sort((x, y) => x.pct - y.pct);
    return { methods, pending: rows.filter((r) => r.meta.review === "pending").length };
  }, [rows]);
  if (!rows.length) return null;
  return (
    <div className="space-y-2">
      {pending > 0 && (
        <p className="rounded-lg bg-warm-yellow/30 px-3 py-2 text-sm font-bold text-deep-navy">
          {en ? `${pending} activities need your review (marked !)` : `교사 확인이 필요한 활동 ${pending}개 (학생 카드의 ! 표시)`}
        </p>
      )}
      {methods.length > 0 && (
        <div className="space-y-1">
          <div className="text-sm font-bold text-on-surface-variant">{en ? "Average by activity type (first try)" : "활동 방식별 평균(첫 시도)"}</div>
          <div className="flex flex-wrap gap-1.5">
            {methods.map((m) => (
              <span key={m.title} className={`rounded-full px-3 py-1 text-sm ${m.pct < 50 ? "bg-error-container/70 font-bold text-on-error-container" : m.pct < 70 ? "bg-orange-100 text-orange-900" : "bg-surface-container-high text-on-surface"}`}>
                {m.title} <b>{m.pct}%</b>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded bg-emerald-400" />90%+</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded bg-amber-300" />70%+</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded bg-orange-400" />{en ? "below 70%" : "70% 미만"}</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded bg-sky-300" />{en ? "done (no score)" : "끝냄(점수 없음)"}</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded bg-surface-container-high" />{en ? "not yet" : "아직"}</span>
      </div>
    </div>
  );
}

/**
 * 학생 한 명의 활동 색칸 줄. 칸을 누르면 그 활동의 자세한 결과(첫 시도·재시도·힌트·녹음·교사 확인)가 아래에 뜬다.
 * 학생은 이름으로 찾는다(활동별 결과가 학생 번호가 아니라 이름·진행 번호를 주므로).
 */
export function StudentStrip({
  rows,
  name,
  onReviewed,
  onError,
}: {
  rows: BlockResult[];
  name: string;
  onReviewed: () => void;
  onError: (msg: string) => void;
}) {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith("en");
  const mine = useMemo(() => rows.filter((r) => r.name === name), [rows, name]);
  const [open, setOpen] = useState<string | null>(null);
  const [audio, setAudio] = useState<Record<string, string>>({});
  if (!mine.length) return null;
  const detail = mine.find((r) => r.item_id === open);
  const statusText = (r: BlockResult) =>
    r.meta.review === "pending"
      ? en ? "Review needed" : "교사 확인 필요"
      : r.meta.review === "reviewed"
        ? en ? "Reviewed" : "확인 완료"
        : r.finished
          ? en ? "Submitted" : "제출 완료"
          : r.started
            ? en ? "In progress" : "진행 중"
            : en ? "Not started" : "미시작";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {mine.map((r, i) => {
          const c = cellStyle(r);
          return (
            <button
              key={r.item_id}
              type="button"
              title={`${i + 1}. ${r.title}`}
              aria-label={`${name} · ${r.title}`}
              aria-pressed={open === r.item_id}
              onClick={() => setOpen(open === r.item_id ? null : r.item_id)}
              className={`relative flex h-8 w-8 items-center justify-center rounded text-[11px] font-bold text-deep-navy ${c.bg} ${open === r.item_id ? "ring-2 ring-primary ring-offset-1" : ""}`}
            >
              {c.label}
              {r.meta.review === "pending" && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] text-white">!</span>}
            </button>
          );
        })}
      </div>
      {detail && (
        <article className="space-y-2 rounded-xl bg-surface-container-low p-3 text-base">
          <p className="font-bold">
            {detail.title} · {statusText(detail)}
          </p>
          {detail.total > 0 && detail.answered > 0 && (
            <p>
              {en ? "First / final correct" : "첫 시도 / 최종 정답"}: {detail.first_correct}/{detail.total} → {detail.final_correct}/{detail.total} · {en ? "Retries" : "재시도"} {detail.retries}
            </p>
          )}
          {detail.total > 0 && !detail.answered && <p>{en ? "Not assessed" : "평가 전"}</p>}
          {detail.meta.watched && <p>{en ? "Viewing complete" : "시청 완료"}</p>}
          <p>
            {en ? "Hints / listens" : "힌트 / 다시 듣기"}: {detail.meta.hints || 0} / {detail.meta.listens || 0}
          </p>
          {detail.meta.response && <p className="whitespace-pre-wrap">{detail.meta.response}</p>}
          {detail.meta.recording &&
            (audio[detail.item_id] ? (
              <audio controls src={audio[detail.item_id]} />
            ) : (
              <button
                className="min-h-11 rounded-lg border px-3"
                onClick={() =>
                  void recordingUrl(detail.meta.recording!)
                    .then((url) => setAudio((a) => ({ ...a, [detail.item_id]: url })))
                    .catch(() => onError(en ? "Recording unavailable. Retry later." : "녹음을 불러오지 못했습니다. 다시 시도하세요."))
                }
              >
                {en ? "Listen to recording" : "대표 녹음 듣기"}
              </button>
            ))}
          {detail.meta.review === "pending" && (
            <button
              className="min-h-11 rounded-lg bg-primary px-4 text-white"
              onClick={() => void reviewBlock(detail.attempt_id, detail.item_id).then(onReviewed).catch(() => onError(en ? "Review save failed." : "확인 저장 실패"))}
            >
              {en ? "Mark reviewed" : "확인 완료로 표시"}
            </button>
          )}
        </article>
      )}
    </div>
  );
}

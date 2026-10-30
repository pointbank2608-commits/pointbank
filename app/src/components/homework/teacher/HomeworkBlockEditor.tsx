import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  fetchCurriculumLessons,
  fetchStudentsOfClass,
  fetchWordLists,
} from "../../../lib/api";
import {
  assignDraft,
  listDrafts,
  saveDraft,
} from "../../../lib/homework/blockApi";
import {
  BLOCK_NAMES,
  blocksFromCards,
  gameItemFromCards,
  lessonCandidates,
  newBlock,
  newDraft,
  SOLO_GAME_NAMES,
  syncWatchItem,
  validateItems,
  isEditableDraft,
  type BlockType,
  type HomeworkDraft,
  type SoloGame,
} from "../../../lib/homework/blocks";
import {
  createHomework,
  fetchAdFlags,
  fetchReviewCandidates,
  setAdFlag,
} from "../../../lib/homework";
import { recommendForStudent } from "../../../lib/homework/recommend";
import {
  expandSlots,
  hasSlots,
  newSlot,
  SLOT_NAMES,
  type SlotWant,
} from "../../../lib/homework/slots";
import {
  fetchClassWrongCards,
  useBuildLabels,
} from "../../../lib/homework/teacherHelpers";
import { enrichCards, loadWordBank } from "../../../lib/wordBankCache";
import { extractYoutubeId } from "../../../lib/youtube";
import type { HwItemDraft, HwQuestion } from "../../../lib/homework/types";
import type {
  CurriculumLesson,
  FullCardItem,
  Student,
  WordList,
} from "../../../lib/types";
import { wordListToCards } from "../../../lib/gameFromWords";
import HomeworkPreview from "./HomeworkPreview";
import AccessibleDialog from "../../AccessibleDialog";

const button =
  "min-h-11 rounded-xl border border-outline-variant px-3 py-2 text-base font-bold disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary";
const field =
  "min-h-11 w-full rounded-lg border border-outline-variant bg-white p-2 text-base text-deep-navy focus:outline-2 focus:outline-primary";

interface PersonalPlan {
  student: Student;
  items: HwItemDraft[];
  empty: number;
  reasons: import("../../../lib/homework/recommend").RecReason[];
  personal: boolean;
  rule: string;
}

export default function HomeworkBlockEditor({
  academyId,
  classId,
  ownerId,
  initialItems,
  initialTitle,
  lessonId,
  startWithLessonImport,
  initialStudentIds,
  initialDue,
  classOptions,
  onClose,
  onCreated,
}: {
  /** 이 틀을 복사해 갈 수 있는 다른 반 */
  classOptions?: { id: string; name: string }[];
  academyId: string;
  classId: string;
  ownerId: string;
  initialItems?: HwItemDraft[];
  initialTitle?: string;
  lessonId?: string;
  onClose: () => void;
  onCreated: (result: { id: string; code: string }) => void;
  startWithLessonImport?: boolean;
  initialStudentIds?: string[] | null;
  initialDue?: string;
}) {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith("en");
  const l = useCallback(
    (ko: string, english: string) => (en ? english : ko),
    [en],
  );
  const cache = `classbank.hw.draft.${ownerId}.${academyId}.${classId}`;
  const badRecovery = useRef(false);
  const [draft, setDraft] = useState<HomeworkDraft>(() => {
    if (initialItems)
      return {
        ...newDraft(),
        title: initialTitle || "",
        items: structuredClone(initialItems),
        assignment: {
          students: initialStudentIds || null,
          due: initialDue || "",
        },
      };
    try {
      const saved = JSON.parse(localStorage.getItem(cache) || "null");
      if (isEditableDraft(saved)) return saved;
      if (saved) {
        badRecovery.current = true;
        localStorage.setItem(`${cache}.unreadable`, JSON.stringify(saved));
      }
    } catch {
      /* recovery remains optional */
    }
    return newDraft();
  });
  const [past, setPast] = useState<HomeworkDraft[]>([]);
  const [future, setFuture] = useState<HomeworkDraft[]>([]);
  const [selected, setSelected] = useState(0);
  useEffect(
    () => setSelected((i) => Math.max(0, Math.min(i, draft.items.length - 1))),
    [draft.items.length],
  );
  const [saved, setSaved] = useState("");
  const [message, setMessage] = useState(
    badRecovery.current
      ? l(
          "기기 초안이 손상되었거나 지원하지 않는 버전입니다. 서버 초안 또는 복구 파일을 열어 주세요.",
          "Device draft is damaged or unsupported. Open a server draft or recovery file.",
        )
      : "",
  );
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const request = useRef(crypto.randomUUID());
  const [preview, setPreview] = useState<"all" | "current" | null>(null);
  const [drafts, setDrafts] = useState<HomeworkDraft[]>([]);
  const [lessons, setLessons] = useState<CurriculumLesson[]>([]);
  const [lists, setLists] = useState<WordList[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const all = draft.assignment?.students == null;
  const targets = draft.assignment?.students || [];
  const due = draft.assignment?.due || "";
  const setAll = (value: boolean) =>
    change({ ...draft, assignment: { students: value ? null : [], due } });
  const setTargets = (value: string[]) =>
    change({ ...draft, assignment: { students: value, due } });
  const setDue = (value: string) =>
    change({
      ...draft,
      assignment: { students: all ? null : targets, due: value },
    });
  const [importId, setImportId] = useState(lessonId || "");
  const [imports, setImports] = useState<Set<string>>(new Set());
  const [excludedImportItems, setExcludedImportItems] = useState<Set<string>>(
    new Set(),
  );
  const [importing, setImporting] = useState(
    !!lessonId || !!startWithLessonImport,
  );
  const [assigning, setAssigning] = useState(false);
  const serialized = JSON.stringify(draft);
  const dirty = serialized !== saved;
  const item = draft.items[selected];
  const block = item?.config.block;
  // 영상 반복 보기 블록: "광고가 나와요" 표시(학원 단위, 093 전에는 빈 목록)
  const watchVideoId = block?.type === "watch" ? extractYoutubeId(block.videoUrl) : null;
  const [adFlagged, setAdFlagged] = useState<Set<string>>(new Set());
  // 혼자 하는 게임 넣기(매치업·글자 섞기·철자 쓰기)
  const [gameKind, setGameKind] = useState<SoloGame>("matchup");
  const [gameList, setGameList] = useState("");
  const [copyTo, setCopyTo] = useState("");
  // 맞춤 칸: 학생마다 다른 낱말로 채워 학생별 숙제로 보낸다
  const labels = useBuildLabels();
  const [personal, setPersonal] = useState<PersonalPlan[] | null>(null);
  const personalGroup = useRef(crypto.randomUUID());
  const personalRequests = useRef(new Map<string, string>());
  const personalDone = useRef(new Set<string>());
  async function buildPersonal(): Promise<PersonalPlan[]> {
    const people = students.filter((s) => all || targets.includes(s.id));
    const latest = [...lists]
      .filter((w) => w.kind !== "sentence")
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    const byWord = new Map<string, FullCardItem>();
    for (const it of draft.items) {
      if (!it.config.slot) continue;
      const wl = it.config.slot.listId
        ? lists.find((w) => w.id === it.config.slot!.listId)
        : latest;
      for (const c of wordListToCards(wl)) byWord.set(c.word.toLowerCase(), c);
    }
    const bank = await loadWordBank().catch(() => []);
    const pool = enrichCards([...byWord.values()], bank);
    const common = await fetchClassWrongCards(classId).catch(() => []);
    const out: PersonalPlan[] = [];
    for (const s of people) {
      const rec = recommendForStudent(
        await fetchReviewCandidates(s.id),
        pool,
        common,
        labels,
      );
      const r = expandSlots(draft.items, rec);
      out.push({
        student: s,
        items: r.items,
        empty: r.empty,
        reasons: rec.reasons,
        personal: rec.personal,
        rule: rec.ruleVersion,
      });
    }
    return out;
  }
  async function sendPersonal() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const plan = personal ?? (await buildPersonal());
      let first: { id: string; code: string } | null = null;
      for (const p of plan) {
        if (personalDone.current.has(p.student.id) || !p.items.length) continue;
        const key = p.student.id + JSON.stringify(p.items).length;
        if (!personalRequests.current.has(key))
          personalRequests.current.set(key, crypto.randomUUID());
        const made = await createHomework({
          requestId: personalRequests.current.get(key),
          classId,
          title: `${draft.title || l("맞춤 숙제", "Personal homework")} · ${p.student.name}`,
          items: p.items,
          studentIds: [p.student.id],
          dueAt: due ? new Date(due).toISOString() : null,
          kind: "custom",
          groupId: personalGroup.current,
          recommendation: {
            rule_version: p.rule,
            personal: p.personal,
            reasons: p.reasons,
            template: draft.id,
            slots: true,
          },
        });
        personalDone.current.add(p.student.id);
        first ??= made;
      }
      localStorage.removeItem(cache);
      if (first) onCreated(first);
      else
        setMessage(
          l(
            "보낼 학생별 활동이 없어요. 재료 단어장을 확인하세요.",
            "No per-student activities to send. Check the word list.",
          ),
        );
    } catch {
      setMessage(
        l(
          "일부 학생에게 보내지 못했어요. 다시 누르면 아직 못 보낸 학생만 보냅니다.",
          "Some students were not sent. Retry sends only the remaining ones.",
        ),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!watchVideoId) return;
    let alive = true;
    void fetchAdFlags([watchVideoId]).then(
      (s) => alive && setAdFlagged((cur) => new Set([...cur, ...s])),
    );
    return () => {
      alive = false;
    };
  }, [watchVideoId]);
  function toggleAd(videoId: string) {
    const next = !adFlagged.has(videoId);
    setAdFlagged((cur) => {
      const n = new Set(cur);
      if (next) n.add(videoId);
      else n.delete(videoId);
      return n;
    });
    void setAdFlag(academyId, videoId, next).catch(() =>
      setAdFlagged((cur) => {
        const n = new Set(cur);
        if (next) n.delete(videoId);
        else n.add(videoId);
        return n;
      }),
    );
  }
  const candidates = lessons.find((x) => x.id === importId);
  const options = candidates ? lessonCandidates(candidates, lists) : [];
  const importedItems = options
    .filter((o) => imports.has(o.slideId))
    .flatMap((o) =>
      o.items.filter((_, i) => !excludedImportItems.has(`${o.slideId}:${i}`)),
    );

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchCurriculumLessons(academyId, classId),
      fetchWordLists(academyId, classId),
      fetchStudentsOfClass(classId),
    ])
      .then(([ls, wl, ss]) => {
        if (!cancelled) {
          setLessons(ls);
          setLists(wl);
          setStudents(ss);
        }
      })
      .catch(() => {
        if (!cancelled)
          setMessage(
            l(
              "자료를 불러오지 못했습니다. 다시 열어 주세요.",
              "Could not load materials. Reopen to retry.",
            ),
          );
      });
    void listDrafts(classId)
      .then((d) => {
        if (!cancelled) setDrafts(d);
      })
      .catch(() => {
        if (!cancelled)
          setMessage(
            l(
              "서버 초안 기능에 087 마이그레이션이 필요합니다. 기기 복구 저장은 계속됩니다.",
              "Server drafts require migration 087. Device recovery is still available.",
            ),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [academyId, classId, l]);
  useEffect(() => {
    try {
      localStorage.setItem(cache, serialized);
    } catch {
      setMessage(
        l(
          "기기 복구 저장 실패. 초안을 내려받아 보관하세요.",
          "Device save failed. Download a recovery draft.",
        ),
      );
    }
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    const linkLeave = (e: MouseEvent) => {
      const a = (e.target as Element)?.closest?.("a[href]");
      if (
        dirty &&
        a &&
        !a.hasAttribute("download") &&
        !window.confirm(
          l(
            "미저장 초안은 기기에 보관됩니다. 다른 화면으로 이동할까요?",
            "Recovery is kept on this device. Leave the editor?",
          ),
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", leave);
    document.addEventListener("click", linkLeave, true);
    return () => {
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("click", linkLeave, true);
    };
  }, [serialized, dirty, cache, l]);
  function change(next: HomeworkDraft) {
    setPast((p) => [...p.slice(-49), draft]);
    setFuture([]);
    setDraft(next);
    request.current = crypto.randomUUID();
  }
  function patch(next: HwItemDraft) {
    // 영상 반복 보기 블록은 학생 화면이 읽는 모양(영상 id·목표 횟수)을 늘 같이 맞춘다
    const synced = syncWatchItem(next);
    change({
      ...draft,
      items: draft.items.map((it, i) => (i === selected ? synced : it)),
    });
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= draft.items.length) return;
    const items = [...draft.items];
    items.splice(to, 0, items.splice(from, 1)[0]);
    change({ ...draft, items });
    setSelected(to);
  }
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await saveDraft(classId, draft);
      setDraft((current) =>
        JSON.stringify(current) === serialized
          ? result
          : { ...current, revision: result.revision },
      );
      setSaved(JSON.stringify(result));
      setDrafts((ds) => [result, ...ds.filter((d) => d.id !== result.id)]);
      setMessage(l("초안 저장 완료", "Draft saved"));
    } catch {
      setMessage(
        l(
          "저장 실패 또는 다른 창에서 수정됨. 기기 복구본을 내려받거나 새 사본으로 저장하세요.",
          "Save failed or revision conflict. Download recovery or save a new copy.",
        ),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function close() {
    if (
      !dirty ||
      window.confirm(
        l(
          "미저장 초안을 기기에 보관하고 닫을까요?",
          "Keep recovery draft on this device and close?",
        ),
      )
    )
      onClose();
  }
  const errors = validateItems(draft.items);
  return (
    <section
      className="space-y-4 rounded-2xl border-2 border-primary/30 bg-surface-container-lowest p-3 text-deep-navy sm:p-5"
      aria-label={l("숙제 블록 편집기", "Homework block editor")}
    >
      <header className="flex flex-wrap items-center gap-2">
        <input
          aria-label={l("숙제 이름", "Homework title")}
          className={`${field} max-w-sm font-bold`}
          value={draft.title}
          placeholder={l("새 숙제", "New homework")}
          onChange={(e) => change({ ...draft, title: e.target.value })}
        />
        <span className="text-sm" role="status">
          {busy
            ? l("저장 중", "Saving")
            : dirty
              ? l("기기 복구본 · 서버 미저장", "Device recovery · Unsaved")
              : l("저장됨", "Saved")}
        </span>
        <button className={button} onClick={() => void save()} disabled={busy}>
          {l("초안 저장", "Save draft")}
        </button>
        <button
          className={button}
          onClick={() => setPreview("all")}
          disabled={!!errors.length}
        >
          {l("처음부터 미리보기", "Preview all")}
        </button>
        <button
          className={button}
          onClick={() => setPreview("current")}
          disabled={!item || !!validateItems([item]).length}
        >
          {l("현재 블록 미리보기", "Preview current")}
        </button>
        <button
          className={`${button} bg-primary text-white`}
          onClick={() => setAssigning(true)}
          disabled={!!errors.length}
        >
          {l("배정", "Assign")}
        </button>
        <button className={button} onClick={close}>
          {l("닫기", "Close")}
        </button>
      </header>
      <div className="flex flex-wrap gap-2">
        <button
          className={button}
          disabled={!past.length}
          onClick={() => {
            setFuture([draft, ...future]);
            const restored = past.at(-1)!;
            setDraft(
              restored.id === draft.id
                ? { ...restored, revision: draft.revision }
                : restored,
            );
            setPast(past.slice(0, -1));
          }}
        >
          {l("실행취소", "Undo")}
        </button>
        <button
          className={button}
          disabled={!future.length}
          onClick={() => {
            setPast([...past, draft]);
            setDraft(
              future[0].id === draft.id
                ? { ...future[0], revision: draft.revision }
                : future[0],
            );
            setFuture(future.slice(1));
          }}
        >
          {l("다시 실행", "Redo")}
        </button>
        <button className={button} onClick={() => setImporting(!importing)}>
          {l("저장된 수업에서 가져오기", "Import saved lesson")}
        </button>
        <select
          className={`${field} max-w-xs`}
          aria-label={l("초안·템플릿 다시 열기", "Open draft or template")}
          value=""
          onChange={(e) => {
            const d = drafts.find((x) => x.id === e.target.value);
            if (
              d &&
              (!dirty ||
                window.confirm(
                  l("현재 초안을 바꿀까요?", "Replace current draft?"),
                ))
            ) {
              change(
                structuredClone(
                  d.template
                    ? {
                        ...d,
                        id: crypto.randomUUID(),
                        revision: 1,
                        template: false,
                      }
                    : d,
                ),
              );
              setSelected(0);
            }
          }}
        >
          <option value="">
            {l("초안·템플릿 다시 열기", "Open draft / template")}
          </option>
          {drafts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.template ? "Template: " : ""}
              {d.title || d.id}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.template}
            onChange={(e) => change({ ...draft, template: e.target.checked })}
          />
          {l("템플릿으로 저장", "Save as template")}
        </label>
        <button
          className={button}
          onClick={() =>
            change({ ...draft, id: crypto.randomUUID(), revision: 1 })
          }
        >
          {l("새 사본", "New copy")}
        </button>
        {classOptions && classOptions.length > 0 && (
          <span className="inline-flex flex-wrap items-center gap-2">
            <select
              className={`${field} max-w-[10rem]`}
              aria-label={l("복사할 반", "Class to copy to")}
              value={copyTo}
              onChange={(e) => setCopyTo(e.target.value)}
            >
              <option value="">{l("다른 반으로 복사…", "Copy to another class…")}</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={button}
              disabled={!copyTo || busy}
              onClick={async () => {
                // 학생 선택은 반마다 달라 빼고, 틀 그대로 그 반의 템플릿으로 저장한다
                const { assignment: _assignment, ...rest } = structuredClone(draft);
                void _assignment;
                setBusy(true);
                try {
                  await saveDraft(copyTo, {
                    ...rest,
                    id: crypto.randomUUID(),
                    revision: 1,
                    template: true,
                  });
                  const name = classOptions.find((c) => c.id === copyTo)?.name ?? "";
                  setMessage(
                    l(`"${name}" 반에 템플릿으로 복사했어요.`, `Copied as a template to "${name}".`),
                  );
                  setCopyTo("");
                } catch {
                  setMessage(l("복사하지 못했어요. 다시 시도해 주세요.", "Could not copy. Try again."));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {l("복사", "Copy")}
            </button>
          </span>
        )}
        <button
          className={button}
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([serialized], { type: "application/json" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "homework-draft.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          {l("복구본 내려받기", "Download recovery")}
        </button>
        <label className={button}>
          {l("복구본 열기", "Restore file")}
          <input
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={async (e) => {
              try {
                const f = e.target.files?.[0];
                if (!f || f.size > 1_000_000) throw new Error();
                const d = JSON.parse(await f.text());
                if (!isEditableDraft(d)) throw new Error();
                change({ ...d, id: crypto.randomUUID(), revision: 1 });
              } catch {
                setMessage(
                  l("복구 파일을 읽을 수 없습니다.", "Invalid recovery file"),
                );
              }
            }}
          />
        </label>
      </div>
      {message && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-amber-950">
          {message}
        </p>
      )}
      {!draft.items.length && (
        <div className="flex flex-wrap gap-3 rounded-xl bg-primary/5 p-5">
          <p className="w-full">
            {l(
              "시작 방법을 선택하세요. 템플릿을 연 뒤 내용을 입력·수정하세요.",
              "Choose a starting point, then edit the content.",
            )}
          </p>
          {(["recall", "speak", "video"] as BlockType[]).map((type) => (
            <button
              key={type}
              className={button}
              onClick={() => change({ ...draft, items: [newBlock(type)] })}
            >
              {l(BLOCK_NAMES[type][0], BLOCK_NAMES[type][1])}{" "}
              {l("템플릿", "template")}
            </button>
          ))}
          <button className={button} onClick={() => setImporting(true)}>
            {l("수업에서 가져오기", "Import lesson")}
          </button>
        </div>
      )}
      {importing && (
        <div className="space-y-3 rounded-xl bg-surface-container-low p-4">
          <p>
            {l(
              "수업 실행 기록은 없습니다. 저장된 수업의 블록과 핵심 내용을 골라 가져오세요.",
              "No run history is available. Select blocks from a saved lesson.",
            )}
          </p>
          <select
            className={field}
            aria-label={l("저장된 수업", "Saved lesson")}
            value={importId}
            onChange={(e) => {
              setImportId(e.target.value);
              setImports(new Set());
            }}
          >
            <option value="">{l("수업 선택", "Choose lesson")}</option>
            {lessons.map((ls) => (
              <option key={ls.id} value={ls.id}>
                {ls.name}
              </option>
            ))}
          </select>
          {options.map((opt) => (
            <div key={opt.slideId}>
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  disabled={opt.status === "unsupported"}
                  checked={imports.has(opt.slideId)}
                  onChange={(e) =>
                    setImports((prev) => {
                      const n = new Set(prev);
                      if (e.target.checked) n.add(opt.slideId);
                      else n.delete(opt.slideId);
                      return n;
                    })
                  }
                />
                <span>
                  {opt.label} ·{" "}
                  {opt.status === "convert"
                    ? l("변환 가능", "Convertible")
                    : opt.status === "alternative"
                      ? l("개인 활동 대체", "Alternative")
                      : l("변환 불가", "Unsupported")}{" "}
                  · {opt.items.length} {l("활동", "activities")}
                  <small className="block">{opt.reason}</small>
                </span>
              </label>
              {imports.has(opt.slideId) && opt.items.length > 1 && (
                <div className="max-h-60 overflow-y-auto pl-6">
                  {opt.items.map((it, i) => (
                    <label key={i} className="flex min-h-11 gap-2">
                      <input
                        type="checkbox"
                        checked={
                          !excludedImportItems.has(`${opt.slideId}:${i}`)
                        }
                        onChange={(e) =>
                          setExcludedImportItems((prev) => {
                            const n = new Set(prev);
                            const key = `${opt.slideId}:${i}`;
                            if (e.target.checked) n.delete(key);
                            else n.add(key);
                            return n;
                          })
                        }
                      />
                      {it.config.block?.text || it.title}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
          <p>
            {l("가져올 활동", "Selected activities")}: {importedItems.length} ·{" "}
            {l(
              "선택하지 않은 내용은 가져오지 않습니다. 최대 60개.",
              "Unchecked content will be omitted. Maximum 60.",
            )}
          </p>
          <button
            className={button}
            disabled={
              !importedItems.length ||
              draft.items.length + importedItems.length > 60
            }
            onClick={() => {
              change({
                ...draft,
                title: draft.title || candidates?.name || "",
                items: [...draft.items, ...importedItems],
              });
              setImporting(false);
            }}
          >
            {l("선택한 내용 가져와서 추리기", "Import selected and refine")}
          </button>
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[210px_minmax(300px,1fr)_300px]">
        <aside className="space-y-2" aria-label={l("블록 순서", "Block order")}>
          {draft.items.map((it, i) => (
            <div
              key={i}
              draggable
              onDragStart={(e) =>
                e.dataTransfer.setData("text/plain", String(i))
              }
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = Number(e.dataTransfer.getData("text/plain"));
                if (
                  Number.isInteger(from) &&
                  from >= 0 &&
                  from < draft.items.length
                )
                  move(from, i);
              }}
              className={`rounded-xl border-2 p-2 ${selected === i ? "border-primary bg-primary/10" : "border-outline-variant"}`}
            >
              <button
                className="min-h-12 w-full text-left"
                aria-current={selected === i ? "step" : undefined}
                onClick={() => setSelected(i)}
                onKeyDown={(e) => {
                  if (e.altKey && ["ArrowUp", "ArrowDown"].includes(e.key)) {
                    e.preventDefault();
                    move(i, i + (e.key === "ArrowUp" ? -1 : 1));
                  }
                }}
              >
                {i + 1}. {it.title}
                <small className="block truncate font-normal">
                  {it.config.block?.text || `${it.content.questions.length} Q`}
                </small>
              </button>
              <div className="flex gap-1">
                <button
                  className={button}
                  aria-label={l("위로", "Move up")}
                  disabled={!i}
                  onClick={() => move(i, i - 1)}
                >
                  ↑
                </button>
                <button
                  className={button}
                  aria-label={l("아래로", "Move down")}
                  disabled={i === draft.items.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  ↓
                </button>
                <button
                  className={button}
                  aria-label={l("복제", "Duplicate")}
                  onClick={() => {
                    const items = [...draft.items];
                    items.splice(i + 1, 0, structuredClone(it));
                    change({ ...draft, items });
                    setSelected(i + 1);
                  }}
                >
                  ⧉
                </button>
                <button
                  className={button}
                  aria-label={l("삭제", "Delete")}
                  onClick={() => {
                    change({
                      ...draft,
                      items: draft.items.filter((_, j) => j !== i),
                    });
                    setSelected(Math.max(0, i - 1));
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          {(Object.keys(BLOCK_NAMES) as BlockType[]).map((type) => (
            <button
              key={type}
              className={`${button} w-full text-left`}
              onClick={() => {
                change({ ...draft, items: [...draft.items, newBlock(type)] });
                setSelected(draft.items.length);
              }}
            >
              + {BLOCK_NAMES[type][en ? 1 : 0]}
            </button>
          ))}
          <fieldset className="space-y-2 rounded-xl border border-outline-variant p-2">
            <legend className="px-1 text-sm font-bold">
              {l("학생별 맞춤 칸", "Per-student slot")}
            </legend>
            {(["quiz", "game"] as SlotWant[]).map((want) => (
              <button
                key={want}
                type="button"
                className={`${button} w-full text-left`}
                onClick={() => {
                  change({ ...draft, items: [...draft.items, newSlot(want, en)] });
                  setSelected(draft.items.length);
                }}
              >
                + {SLOT_NAMES[want][en ? 1 : 0]}
              </button>
            ))}
            <p className="text-xs">
              {l(
                "칸은 하나지만 보낼 때 학생마다 다른 낱말로 채워져요.",
                "One slot, filled with different words per student.",
              )}
            </p>
          </fieldset>
          <fieldset className="space-y-2 rounded-xl border border-outline-variant p-2">
            <legend className="px-1 text-sm font-bold">
              {l("혼자 하는 게임 넣기", "Add a solo game")}
            </legend>
            <select
              className={field}
              aria-label={l("게임 종류", "Game")}
              value={gameKind}
              onChange={(e) => setGameKind(e.target.value as SoloGame)}
            >
              {(Object.keys(SOLO_GAME_NAMES) as SoloGame[]).map((g) => (
                <option key={g} value={g}>
                  {SOLO_GAME_NAMES[g][en ? 1 : 0]}
                </option>
              ))}
            </select>
            <select
              className={field}
              aria-label={l("게임에 쓸 단어장", "Word list for the game")}
              value={gameList}
              onChange={(e) => setGameList(e.target.value)}
            >
              <option value="">{l("단어장 고르기", "Choose a word list")}</option>
              {lists
                .filter((w) => w.kind !== "sentence")
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className={`${button} w-full`}
              disabled={!gameList}
              onClick={() => {
                const wl = lists.find((w) => w.id === gameList);
                const made = wl
                  ? gameItemFromCards(
                      wordListToCards(wl),
                      gameKind,
                      SOLO_GAME_NAMES[gameKind][en ? 1 : 0],
                    )
                  : null;
                if (!made) {
                  setMessage(
                    l(
                      "이 단어장으로는 이 게임을 만들 수 없어요(단어가 모자라거나 영어 글자가 아니에요).",
                      "This list cannot make that game (too few words or not letters).",
                    ),
                  );
                  return;
                }
                change({ ...draft, items: [...draft.items, made] });
                setSelected(draft.items.length);
              }}
            >
              + {l("게임 추가", "Add game")}
            </button>
            <p className="text-xs">
              {l(
                "집에서 혼자 할 수 있는 게임만 넣을 수 있어요. 점수가 아니라 처음 답이 기록돼요.",
                "Only games a child can do alone. First answers are recorded, not game scores.",
              )}
            </p>
          </fieldset>
        </aside>
        <main className="rounded-2xl bg-[#16213e] p-3 text-white">
          {item?.config.slot ? (
            <div className="space-y-2 p-6 text-center">
              <p className="text-lg font-bold">
                {l("학생마다 다른 낱말이 들어가는 칸이에요", "Filled differently per student")}
              </p>
              <p className="text-sm">
                {l(
                  "보낼 때 학생의 학습 기록(틀린 낱말, 복습할 때가 된 낱말)으로 채워져요. 보내기 전에 학생별 구성을 미리 볼 수 있어요.",
                  "Filled from each student's record when sending. Preview per-student content before sending.",
                )}
              </p>
            </div>
          ) : item ? (
            <HomeworkPreview
              key={JSON.stringify(item)}
              title={draft.title}
              items={[item]}
              startImmediately
            />
          ) : (
            <p className="p-8 text-center">
              {l("왼쪽에서 활동을 추가하세요.", "Add an activity on the left.")}
            </p>
          )}
        </main>
        <aside
          className="space-y-3"
          aria-label={l("활동 설정", "Activity settings")}
        >
          {item && (
            <>
              <label className="block">
                {l("블록 이름", "Activity title")}
                <input
                  className={field}
                  value={item.title}
                  onChange={(e) => patch({ ...item, title: e.target.value })}
                />
              </label>
              {item.config.slot && (
                <fieldset className="space-y-2 rounded-xl border border-outline-variant p-3">
                  <legend className="px-1 font-bold">
                    {l("맞춤 칸 설정", "Slot settings")}
                  </legend>
                  <label className="block">
                    {l("종류", "Kind")}
                    <select
                      className={field}
                      value={item.config.slot.want}
                      onChange={(e) =>
                        patch({
                          ...item,
                          kind: e.target.value === "game" ? "game" : "quiz",
                          config: {
                            ...item.config,
                            slot: { ...item.config.slot!, want: e.target.value as SlotWant },
                          },
                        })
                      }
                    >
                      {(["quiz", "game"] as SlotWant[]).map((w) => (
                        <option key={w} value={w}>
                          {SLOT_NAMES[w][en ? 1 : 0]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    {l("문제 수(1~12)", "Questions (1–12)")}
                    <input
                      className={field}
                      type="number"
                      min={1}
                      max={12}
                      value={item.config.slot.count}
                      onChange={(e) =>
                        patch({
                          ...item,
                          config: {
                            ...item.config,
                            slot: {
                              ...item.config.slot!,
                              count: Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                            },
                          },
                        })
                      }
                    />
                  </label>
                  <label className="block">
                    {l("재료 단어장", "Word list")}
                    <select
                      className={field}
                      value={item.config.slot.listId}
                      onChange={(e) =>
                        patch({
                          ...item,
                          config: {
                            ...item.config,
                            slot: { ...item.config.slot!, listId: e.target.value },
                          },
                        })
                      }
                    >
                      <option value="">
                        {l("반의 가장 최근 단어장", "Most recent list of the class")}
                      </option>
                      {lists
                        .filter((w) => w.kind !== "sentence")
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </fieldset>
              )}
              {block && (
                <>
                  {(
                    (block.type === "watch"
                      ? ["videoUrl"]
                      : [
                          "text",
                          "translation",
                          "imageUrl",
                          "audioUrl",
                          ...(block.type === "video"
                            ? ["videoUrl", "question"]
                            : []),
                        ]) as readonly string[]
                  ).map((key) => (
                    <label className="block" key={key}>
                      {l(
                        (
                          {
                            text: "단어·문장",
                            translation: "해석",
                            imageUrl: "그림 주소",
                            audioUrl: "모델 음성 주소",
                            videoUrl: "YouTube 주소",
                            question: "후속 질문",
                          } as Record<string, string>
                        )[key] || key,
                        key,
                      )}
                      <textarea
                        aria-label={l(
                          (
                            {
                              text: "단어·문장",
                              translation: "해석",
                              imageUrl: "그림 주소",
                              audioUrl: "모델 음성 주소",
                              videoUrl: "YouTube 주소",
                              question: "후속 질문",
                            } as Record<string, string>
                          )[key] || key,
                          key,
                        )}
                        className={field}
                        value={block[key as keyof typeof block] as string}
                        onChange={(e) =>
                          patch({
                            ...item,
                            config: {
                              ...item.config,
                              block: { ...block, [key]: e.target.value },
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                  {block.type === "watch" && (
                    <fieldset className="space-y-2 rounded-xl border border-outline-variant p-3">
                      <legend className="px-1 font-bold">
                        {l("한 영상을 몇 번 보게 할까요?", "How many times?")}
                      </legend>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            aria-pressed={(block.views ?? 1) === n}
                            className={`${button} min-w-14 ${(block.views ?? 1) === n ? "bg-primary text-on-primary" : ""}`}
                            onClick={() =>
                              patch({
                                ...item,
                                config: { ...item.config, block: { ...block, views: n } },
                              })
                            }
                          >
                            {l(`${n}번`, `${n}x`)}
                          </button>
                        ))}
                      </div>
                      <p className="text-sm">
                        {l(
                          "끝까지 보면 한 번으로 세요. 건너뛰면 세지 않아요. 며칠에 나눠 봐도 이어서 셉니다.",
                          "A watch counts when played to the end. Skipping ahead does not count; views can be spread over days.",
                        )}
                      </p>
                      {watchVideoId && (
                        <button
                          type="button"
                          aria-pressed={adFlagged.has(watchVideoId)}
                          className={`${button} ${adFlagged.has(watchVideoId) ? "border-error bg-error-container/50" : ""}`}
                          onClick={() => toggleAd(watchVideoId)}
                        >
                          {adFlagged.has(watchVideoId)
                            ? l("광고 표시됨 (눌러서 해제)", "Marked as showing ads")
                            : l("광고가 나와요", "This video shows ads")}
                        </button>
                      )}
                    </fieldset>
                  )}
                  {["study", "recall", "speak", "sentence"].includes(
                    block.type,
                  ) && (
                    <select
                      className={field}
                      aria-label={l("단어장에서 불러오기", "Import word list")}
                      value=""
                      onChange={(e) => {
                        const wl = lists.find((w) => w.id === e.target.value);
                        if (wl) {
                          const items = blocksFromCards(
                            wordListToCards(wl),
                            block.type,
                          );
                          change({
                            ...draft,
                            items: [
                              ...draft.items.slice(0, selected),
                              ...items,
                              ...draft.items.slice(selected + 1),
                            ],
                          });
                        }
                      }}
                    >
                      <option value="">
                        {l(
                          "단어장·문장 목록에서 불러오기",
                          "Import word / sentence list",
                        )}
                      </option>
                      {lists.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {block.type === "speak" && (
                    <fieldset>
                      <legend>{l("힌트를 줄이는 단계", "Fading hints")}</legend>
                      {(["model", "hidden", "picture"] as const).map(
                        (stage, i) => (
                          <label
                            className="flex min-h-11 items-center gap-2"
                            key={stage}
                          >
                            <input
                              type="checkbox"
                              checked={block.stages.includes(stage)}
                              onChange={(e) =>
                                patch({
                                  ...item,
                                  config: {
                                    ...item.config,
                                    block: {
                                      ...block,
                                      stages: e.target.checked
                                        ? (
                                            [
                                              "model",
                                              "hidden",
                                              "picture",
                                            ] as const
                                          ).filter(
                                            (s) =>
                                              s === stage ||
                                              block.stages.includes(s),
                                          )
                                        : block.stages.filter(
                                            (s) => s !== stage,
                                          ),
                                    },
                                  },
                                })
                              }
                            />
                            {l(
                              ["전체 문장＋음성", "일부 가리기", "그림만"][i],
                              ["Model", "Masked text", "Picture only"][i],
                            )}
                          </label>
                        ),
                      )}
                      <p>
                        {l("가릴 낱말·청크를 누르세요", "Select words to hide")}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {block.text
                          .split(/\s+/)
                          .filter(Boolean)
                          .map((w, i) => (
                            <button
                              className={`${button} ${block.hiddenWords.includes(i) ? "bg-warm-yellow" : ""}`}
                              key={i}
                              aria-pressed={block.hiddenWords.includes(i)}
                              onClick={() =>
                                patch({
                                  ...item,
                                  config: {
                                    ...item.config,
                                    block: {
                                      ...block,
                                      hiddenWords: block.hiddenWords.includes(i)
                                        ? block.hiddenWords.filter(
                                            (n) => n !== i,
                                          )
                                        : [...block.hiddenWords, i],
                                    },
                                  },
                                })
                              }
                            >
                              {w}
                            </button>
                          ))}
                      </div>
                      <label>
                        {l("단계별 반복", "Repetitions per stage")}
                        <input
                          className={field}
                          type="number"
                          min={1}
                          max={5}
                          value={block.repeats}
                          onChange={(e) =>
                            patch({
                              ...item,
                              config: {
                                ...item.config,
                                block: {
                                  ...block,
                                  repeats: Number(e.target.value),
                                },
                              },
                            })
                          }
                        />
                      </label>
                      <p className="text-sm">
                        {l(
                          "마지막 대표 녹음 1개만 제출합니다. 발음 자동 채점 없음.",
                          "Submit one representative recording. No automatic pronunciation score.",
                        )}
                      </p>
                    </fieldset>
                  )}
                  {block.type === "video" && (
                    <div className="grid grid-cols-2 gap-2">
                      {(["start", "end"] as const).map((key) => (
                        <label key={key}>
                          {l(key === "start" ? "시작(초)" : "종료(초)", key)}
                          <input
                            className={field}
                            type="number"
                            value={block[key]}
                            onChange={(e) =>
                              patch({
                                ...item,
                                config: {
                                  ...item.config,
                                  block: {
                                    ...block,
                                    [key]: Number(e.target.value),
                                  },
                                },
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                  )}
                  {["sentence", "video"].includes(block.type) && (
                    <label>
                      {l("완료 조건", "Completion rule")}
                      <select
                        className={field}
                        value={block.completion}
                        onChange={(e) =>
                          patch({
                            ...item,
                            config: {
                              ...item.config,
                              block: {
                                ...block,
                                completion: e.target
                                  .value as typeof block.completion,
                              },
                            },
                            content: {
                              ...item.content,
                              questions:
                                e.target.value === "answers"
                                  ? item.content.questions
                                  : [],
                            },
                          })
                        }
                      >
                        {(block.type === "sentence"
                          ? ["answers", "review"]
                          : ["watch", "review", "recording"]
                        ).map((v) => (
                          <option key={v} value={v}>
                            {l(
                              (
                                {
                                  answers: "정답형 문제 응답",
                                  review: "열린 답변 · 교사 확인",
                                  watch: "구간 시청 완료",
                                  recording: "대표 녹음 제출",
                                } as Record<string, string>
                              )[v],
                              v,
                            )}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {block.source && (
                    <p className="break-all text-xs">
                      {l("출처 버전", "Source version")}: {block.source.version}
                    </p>
                  )}
                </>
              )}
              {(!block || block.completion === "answers") && (
                <QuestionEditor
                  items={item.content.questions}
                  onChange={(qs) =>
                    patch({
                      ...item,
                      config: {
                        ...item.config,
                        game:
                          item.config.game === "matchup" &&
                          !qs.every(
                            (q) => q.qtype === "choice" && q.style === "match",
                          )
                            ? undefined
                            : item.config.game,
                      },
                      content: { ...item.content, questions: qs },
                    })
                  }
                  en={en}
                />
              )}
            </>
          )}
          {!!errors.length && (
            <ul role="status" className="space-y-2 text-sm text-error">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          )}
        </aside>
      </div>
      {preview && (
        <AccessibleDialog
          label={l("학생 미리보기", "Student preview")}
          onClose={() => setPreview(null)}
        >
          <div className="overflow-auto bg-deep-navy/95 p-4">
            <button
              className={`${button} mb-3 bg-white`}
              autoFocus
              onClick={() => setPreview(null)}
            >
              {l("미리보기 닫기", "Close preview")}
            </button>
            <HomeworkPreview
              title={draft.title}
              items={preview === "all" ? draft.items : [item]}
            />
          </div>
        </AccessibleDialog>
      )}
      {assigning && (
        <div className="space-y-3 rounded-xl border-2 border-primary p-4">
          <h3 className="font-bold">
            {l(
              "배정 시 내용과 평가 기준이 고정됩니다. 이후 초안 수정은 새 배정에만 적용됩니다.",
              "Assignment freezes content and grading. Later edits affect new assignments only.",
            )}
          </h3>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={all}
              onChange={(e) => {
                setAll(e.target.checked);
                request.current = crypto.randomUUID();
              }}
            />
            {l("반 전체", "Whole class")}
          </label>
          {!all &&
            students.map((s) => (
              <label
                key={s.id}
                className="mr-4 inline-flex min-h-11 items-center gap-2"
              >
                <input
                  type="checkbox"
                  checked={targets.includes(s.id)}
                  onChange={(e) => {
                    setTargets(
                      e.target.checked
                        ? [...targets, s.id]
                        : targets.filter((x) => x !== s.id),
                    );
                    request.current = crypto.randomUUID();
                  }}
                />
                {s.name}
              </label>
            ))}
          <label className="block">
            {l("마감(선택)", "Due date (optional)")}
            <input
              type="datetime-local"
              className={`${field} max-w-sm`}
              value={due}
              onChange={(e) => {
                setDue(e.target.value);
                request.current = crypto.randomUUID();
              }}
            />
          </label>
          {hasSlots(draft.items) && (
            <div className="space-y-2 rounded-xl bg-primary/5 p-3">
              <p className="text-sm">
                {l(
                  "맞춤 칸이 있어서 학생마다 다른 숙제로 보내요. 공통 활동은 모두 같고, 맞춤 칸만 학생 기록으로 채워져요.",
                  "This template has per-student slots. Each student gets their own homework; common activities stay the same.",
                )}
              </p>
              <button
                type="button"
                className={button}
                disabled={busy || (!all && !targets.length) || !students.length}
                onClick={async () => {
                  setBusy(true);
                  try {
                    setPersonal(await buildPersonal());
                  } catch {
                    setMessage(l("학생 기록을 불러오지 못했어요.", "Could not load student records."));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {l("학생별 구성 미리 보기", "Preview per student")}
              </button>
              {personal && (
                <ul className="space-y-1 text-sm">
                  {personal.map((p) => (
                    <li key={p.student.id}>
                      <b>{p.student.name}</b> ·{" "}
                      {l(`활동 ${p.items.length}개`, `${p.items.length} activities`)}{" "}
                      ·{" "}
                      {l(
                        `문제 ${p.items.reduce((n, x) => n + x.content.questions.length, 0)}개`,
                        `${p.items.reduce((n, x) => n + x.content.questions.length, 0)} questions`,
                      )}
                      {!p.personal &&
                        ` · ${l("기록이 적어 반 공통 복습", "class review (little record)")}`}
                      {p.empty > 0 &&
                        ` · ${l(`빈 칸 ${p.empty}개 제외`, `${p.empty} empty slot(s) dropped`)}`}
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className={`${button} bg-primary text-white`}
                disabled={busy || (!all && !targets.length) || !students.length}
                onClick={() => void sendPersonal()}
              >
                {l("학생별로 확인하고 보내기", "Confirm and send per student")}
              </button>
            </div>
          )}
          {!hasSlots(draft.items) && (
          <button
            className={`${button} bg-primary text-white`}
            disabled={
              busy ||
              (!all && !targets.length) ||
              !students.length ||
              !!errors.length
            }
            onClick={async () => {
              if (lock.current) return;
              lock.current = true;
              setBusy(true);
              try {
                const payload = JSON.stringify({
                  draft,
                  targets: all ? null : targets,
                  due,
                });
                try {
                  const previous = JSON.parse(
                    localStorage.getItem(cache + ".assignment") || "null",
                  );
                  if (previous?.payload === payload)
                    request.current = previous.request;
                  localStorage.setItem(
                    cache + ".assignment",
                    JSON.stringify({ payload, request: request.current }),
                  );
                } catch {
                  /* in-memory request still protects this session */
                }
                const result = await assignDraft(
                  classId,
                  draft,
                  all ? null : targets,
                  due,
                  request.current,
                );
                localStorage.removeItem(cache);
                localStorage.removeItem(cache + ".assignment");
                onCreated(result);
              } catch {
                setMessage(
                  l(
                    "배정 실패. 연결과 087 마이그레이션을 확인하고 재시도하세요. 동일 요청은 한 번만 배정됩니다.",
                    "Assignment failed. Check connection and migration 087, then retry. The same request is assigned once.",
                  ),
                );
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }}
          >
            {l("확인하고 배정", "Confirm assignment")}
          </button>
          )}
          <button
            className={`${button} ml-2`}
            onClick={() => setAssigning(false)}
          >
            {l("편집 계속", "Continue editing")}
          </button>
        </div>
      )}
    </section>
  );
}

function QuestionEditor({
  items,
  onChange,
  en,
}: {
  items: HwQuestion[];
  onChange: (items: HwQuestion[]) => void;
  en: boolean;
}) {
  function update(i: number, q: HwQuestion) {
    onChange(items.map((old, j) => (i === j ? q : old)));
  }
  return (
    <fieldset className="space-y-3">
      <legend>{en ? "Questions and answers" : "문제·정답·오답 보기"}</legend>
      {items.map((q, i) => (
        <div
          key={q.id}
          className="space-y-2 rounded-xl border border-outline-variant p-2"
        >
          <label>
            {en ? "Answer format" : "활동 방식"}
            <select
              className={field}
              value={q.qtype}
              onChange={(e) => {
                const type = e.target.value as HwQuestion["qtype"];
                update(i, {
                  ...q,
                  qtype: type,
                  style:
                    type === "order"
                      ? "sentence"
                      : type === "choice"
                        ? "meaning"
                        : "spell",
                  correct:
                    type === "order"
                      ? ["I", "like", "cats."]
                      : type === "choice"
                        ? 0
                        : "",
                  tokens: type === "order" ? ["cats.", "like", "I"] : undefined,
                  joiner: " ",
                  choices: type === "choice" ? ["", "", ""] : undefined,
                });
              }}
            >
              <option value="choice">{en ? "Choose" : "고르기"}</option>
              <option value="text">
                {en ? "Write / fill in" : "직접 쓰기·빈칸"}
              </option>
              <option value="order">
                {en ? "Order words / chunks" : "낱말·청크 순서 맞추기"}
              </option>
            </select>
          </label>
          <label>
            {en ? "Question style" : "문제 유형"}
            <select
              className={field}
              value={q.style}
              onChange={(e) =>
                update(i, {
                  ...q,
                  style: e.target.value as HwQuestion["style"],
                  ...(e.target.value === "listen"
                    ? { speak: q.speak || "" }
                    : {}),
                })
              }
            >
              {(q.qtype === "choice"
                ? ["meaning", "reverse", "listen", "picture", "blank"]
                : q.qtype === "order"
                  ? ["sentence", "letters"]
                  : ["spell", "blank"]
              ).map((style) => (
                <option key={style} value={style}>
                  {en
                    ? style
                    : (
                        {
                          meaning: "뜻 고르기",
                          reverse: "뜻 보고 단어",
                          listen: "듣고 고르기",
                          picture: "그림 고르기",
                          blank: "빈칸",
                          spell: "직접 쓰기·철자",
                          sentence: "문장 순서",
                          letters: "글자 순서",
                        } as Record<string, string>
                      )[style]}
                </option>
              ))}
            </select>
          </label>
          {q.style === "picture" && (
            <label>
              {en ? "Image URL" : "문제 그림 주소"}
              <input
                className={field}
                value={q.imageUrl || ""}
                onChange={(e) => update(i, { ...q, imageUrl: e.target.value })}
              />
            </label>
          )}
          <label>
            {en ? "Prompt" : "문제"}
            <textarea
              className={field}
              value={q.prompt}
              onChange={(e) => update(i, { ...q, prompt: e.target.value })}
            />
          </label>
          {q.speak != null && (
            <label>
              {en ? "Listening text" : "듣기 문장"}
              <input
                className={field}
                value={q.speak}
                onChange={(e) => update(i, { ...q, speak: e.target.value })}
              />
            </label>
          )}
          {q.qtype === "choice" ? (
            <>
              {q.choices?.map((c, ci) => (
                <label key={ci} className="flex items-center gap-1">
                  <input
                    type="radio"
                    aria-label={`${en ? "Correct choice" : "정답 보기"} ${ci + 1}`}
                    name={`correct-${q.id}-${i}`}
                    checked={q.correct === ci}
                    onChange={() => update(i, { ...q, correct: ci })}
                  />
                  <input
                    className={field}
                    aria-label={`${en ? "Choice" : "보기"} ${ci + 1}`}
                    value={c}
                    onChange={(e) =>
                      update(i, {
                        ...q,
                        choices: q.choices!.map((v, j) =>
                          j === ci ? e.target.value : v,
                        ),
                      })
                    }
                  />
                </label>
              ))}
            </>
          ) : (
            <label>
              {en
                ? "Accepted answers (text: / alternatives; order: one chunk per line)"
                : "허용 정답(직접 쓰기: /로 여러 정답, 순서: 한 줄에 한 낱말·청크)"}
              <textarea
                className={field}
                value={
                  Array.isArray(q.correct)
                    ? q.correct.join("\n")
                    : String(q.correct ?? "")
                }
                onChange={(e) => {
                  if (q.qtype === "order") {
                    const arr = e.target.value.split("\n");
                    update(i, {
                      ...q,
                      correct: arr,
                      tokens: [...arr].reverse(),
                    });
                  } else update(i, { ...q, correct: e.target.value });
                }}
              />
            </label>
          )}
          <button
            className={button}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            {en ? "Remove question" : "문제 삭제"}
          </button>
        </div>
      ))}
      <button
        className={button}
        onClick={() =>
          onChange([
            ...items,
            {
              id: crypto.randomUUID(),
              qtype: "text",
              style: "spell",
              prompt: "",
              correct: "",
              skill: "sentence.correct",
              word: "",
              gen: "block-v1",
            },
          ])
        }
      >
        {en ? "+ Text question" : "+ 직접 쓰기 문제"}
      </button>
      <button
        className={`${button} ml-1`}
        onClick={() =>
          onChange([
            ...items,
            {
              id: crypto.randomUUID(),
              qtype: "choice",
              style: "meaning",
              prompt: "",
              correct: 0,
              choices: ["", "", ""],
              skill: "vocab.meaning",
              word: "",
              gen: "block-v1",
            },
          ])
        }
      >
        {en ? "+ Choice question" : "+ 뜻 고르기 문제"}
      </button>
    </fieldset>
  );
}

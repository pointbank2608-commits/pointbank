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
  lessonCandidates,
  newBlock,
  newDraft,
  validateItems,
  isEditableDraft,
  type BlockType,
  type HomeworkDraft,
} from "../../../lib/homework/blocks";
import type { HwItemDraft, HwQuestion } from "../../../lib/homework/types";
import type { CurriculumLesson, Student, WordList } from "../../../lib/types";
import { wordListToCards } from "../../../lib/gameFromWords";
import HomeworkPreview from "./HomeworkPreview";
import AccessibleDialog from "../../AccessibleDialog";

const button =
  "min-h-11 rounded-xl border border-outline-variant px-3 py-2 text-base font-bold disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary";
const field =
  "min-h-11 w-full rounded-lg border border-outline-variant bg-white p-2 text-base text-deep-navy focus:outline-2 focus:outline-primary";

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
  onClose,
  onCreated,
}: {
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
    change({
      ...draft,
      items: draft.items.map((it, i) => (i === selected ? next : it)),
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
        </aside>
        <main className="rounded-2xl bg-[#16213e] p-3 text-white">
          {item ? (
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
              {block && (
                <>
                  {(
                    [
                      "text",
                      "translation",
                      "imageUrl",
                      "audioUrl",
                      ...(block.type === "video"
                        ? ["videoUrl", "question"]
                        : []),
                    ] as const
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

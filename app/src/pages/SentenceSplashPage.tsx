import { useCallback, useLayoutEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import EditOnly from "../components/EditOnly";
import GameThemeFrame from "../components/GameThemeFrame";
import SentenceSplash from "../components/SentenceSplash";
import SentenceBankPicker from "../components/SentenceBankPicker";
import WordListPicker from "../components/WordListPicker";
import { useGameTemplates } from "../lib/useGameTemplates";
import { createGameTemplate, updateGameTemplate } from "../lib/api";
import {
  sentenceWords,
  SPLASH_TIMES,
  splashSampleItems,
  splashSeconds,
  editedSplashConfig,
  isSplashSampleItems,
} from "../lib/sentenceSplash";
import type { GameItem, GameTemplate } from "../lib/types";
import { useGameEmbed } from '../context/GameEmbedContext';

const button =
  "min-h-11 rounded-xl border border-outline-variant bg-white px-4 py-2 font-semibold disabled:opacity-40";
const input =
  "min-h-11 w-full rounded-xl border border-outline-variant bg-white px-3 py-2";

export default function SentenceSplashPage() {
  const { i18n, t } = useTranslation();
  const en = i18n.language.startsWith("en");
  const text = (ko: string, english: string) => (en ? english : ko);
  const navigate = useNavigate();
  const { academy, profile } = useAuth();
  const embed = useGameEmbed();
  const g = useGameTemplates({
    gameType: "sentencesplash",
    defaultItems: splashSampleItems,
    defaultConfig: () => ({ splashSeconds: 45 }),
    listKind: "sentence",
    sampleCards: () =>
      splashSampleItems().map((i) => ({
        id: i.id,
        word: i.label,
        meaning: "",
        imageUrl: null,
      })),
  });
  const [restart, setRestart] = useState(0);
  const [name, setName] = useState("");
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  // A new game can be edited and previewed before creating any saved template.
  // This also works without the optional platform-wide temporary-activity flow.
  const [draft, setDraft] = useState<GameTemplate>(() => ({
    id: 'splash-preview', academy_id: '', class_id: null, game_type: 'sentencesplash',
    name: 'Sentence Splash', created_by: null, created_at: '', updated_at: '',
    items: splashSampleItems(), config: { splashSeconds: 45 },
  }));
  const selected = g.selected || draft;
  const [changes, setChanges] = useState<{ templateId: string; items: GameItem[]; seconds: number } | null>(null);
  const captureChanges = useCallback((items: GameItem[], seconds: number) => {
    setChanges({ templateId: selected.id, items, seconds });
  }, [selected.id]);
  const editing = changes?.templateId === selected.id
    ? changes : { items: selected.items, seconds: splashSeconds(selected.config.splashSeconds) };
  const invalid = editing.items.length === 0 || editing.items.some(i => sentenceWords(i.label).length < 2);
  async function saveCopy() {
    if (!academy || !profile || saving || applying || invalid || !name.trim()) return;
    setSaving(true);
    try {
      const items = editing.items.map(i => ({ ...i, label: i.label.trim() }));
      const tpl = await createGameTemplate({
        academyId: academy.id,
        classId: g.classId,
        gameType: "sentencesplash",
        teacherId: profile.id,
        name: name.trim(),
        items,
        config: editedSplashConfig(selected, items, editing.seconds),
      });
      g.setTemplates((old) => [...old, tpl]);
      g.setSelectedId(tpl.id);
      setName("");
      notify(text("게임을 저장했어요.", "Game saved."));
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setSaving(false);
    }
  }
  async function apply(items: GameItem[], seconds: number) {
    const config = editedSplashConfig(selected, items, seconds);
    setApplying(true);
    try {
      if (g.selected) {
        await updateGameTemplate(selected.id, { items, config });
        g.setTemplates((old) => old.map((t) => (t.id === selected.id ? { ...t, items, config } : t)));
      } else if (embed && academy && profile) {
        // A new embedded game has no template yet. Persist it before reporting its ID to the lesson.
        const row = await createGameTemplate({
          academyId: academy.id, classId: g.classId, gameType: 'sentencesplash',
          teacherId: profile.id, name: name.trim() || selected.name, items, config,
        });
        g.setTemplates(old => [...old, row]);
        g.setSelectedId(row.id);
      } else setDraft({ ...draft, items, config });
      setRestart((k) => k + 1);
    } finally {
      setApplying(false);
    }
  }
  return (
    <div className="space-y-4">
      {!g.loading && (
        <GameThemeFrame
          gameType="sentencesplash"
          roster={g.roster}
          onRestart={() => setRestart((k) => k + 1)}
        >
          <SentenceSplash
            key={`${selected?.id || "sample"}:${restart}`}
            items={selected?.items || splashSampleItems()}
            seconds={selected?.config.splashSeconds}
            onExit={() => navigate("/games")}
          />
        </GameThemeFrame>
      )}
      {g.isStaff && (
        <EditOnly>
          <section
            className="space-y-4 rounded-2xl bg-surface-container-lowest p-4"
            aria-label={text("Sentence Splash 편집", "Edit Sentence Splash")}
          >
            <Link to="/games" className="text-primary underline">
              {text("게임 목록으로", "Back to games")}
            </Link>
            <h2 className="text-xl font-bold">
              Sentence Splash · {text("문장 배열", "Sentence Building")}
            </h2>
            <p>
              {text(
                "한 줄에 영어 문장 하나씩 입력하세요. 저장한 문장 목록이나 문장 은행에서도 가져올 수 있어요.",
                "Enter one English sentence per line, or import from your sentence lists and the sentence bank.",
              )}
            </p>
            {g.classes.length > 0 && (
              <label className="block">
                {text("반 선택", "Class")}
                <select
                  className={input}
                  value={g.staffClassId || ""}
                  onChange={(e) => g.selectClass(e.target.value)}
                >
                  {g.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block">
              {text("저장한 게임", "Saved game")}
              <select
                aria-label={text("저장한 게임", "Saved game")}
                className={input}
                value={g.selectedId || ""}
                onChange={(e) => g.setSelectedId(e.target.value)}
              >
                <option value="" disabled>
                  {text("게임 선택", "Choose game")}
                </option>
                {g.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            {selected ? (
              <SplashEditor
                key={selected.id}
                template={selected}
                wordLists={g.wordLists}
                listsLoading={g.wordListsLoading}
                classId={g.classId}
                apply={apply}
                onChange={captureChanges}
                saving={saving}
              />
            ) : (
              <p>
                {text(
                  "새 게임을 만들면 문장을 편집할 수 있어요.",
                  "Create a game to edit its sentences.",
                )}
              </p>
            )}
            <div className="space-y-2 border-t border-outline-variant pt-4">
              <label className="block">
                {text("게임 이름", "Game name")}
                <input
                  className={input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sentence Splash"
                />
              </label>
              <p className="text-sm">
                {t('sentenceSplashSave.saveHint')}
              </p>
              <button
                className={button}
                disabled={saving || applying || invalid || !name.trim()}
                onClick={() => void saveCopy()}
              >
                {saving
                  ? text("저장 중…", "Saving…")
                  : text("새 게임으로 저장", "Save as new game")}
              </button>
              {selected && (
                <button
                  className={`${button} ml-2`}
                  onClick={() => void g.handleRename(name.trim() || undefined)}
                >
                  {text("이름 바꾸기", "Rename")}
                </button>
              )}
            </div>
          </section>
        </EditOnly>
      )}
      {g.loading && <p role="status">{text("불러오는 중…", "Loading…")}</p>}
      {g.isStaff && !selected && (
        <button
          className={button}
          onClick={() =>
            void g
              .handleCreate(name.trim() || "Sentence Splash")
              .catch((err) => notify(String(err), "error"))
          }
        >
          {text("예시로 새 게임 만들기", "Create a sample game")}
        </button>
      )}
    </div>
  );
}

function SplashEditor({
  template,
  wordLists,
  listsLoading,
  classId,
  apply,
  onChange,
  saving,
}: {
  template: GameTemplate;
  wordLists: ReturnType<typeof useGameTemplates>["wordLists"];
  listsLoading: boolean;
  classId: string | null;
  apply: (items: GameItem[], seconds: number) => Promise<void>;
  onChange: (items: GameItem[], seconds: number) => void;
  saving: boolean;
}) {
  const { i18n, t } = useTranslation();
  const en = i18n.language.startsWith("en");
  const text = (ko: string, english: string) => (en ? english : ko);
  const [items, setItems] = useState(() =>
    template.items.map((i) => ({ ...i })),
  );
  const [seconds, setSeconds] = useState(
    splashSeconds(template.config.splashSeconds),
  );
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const invalid =
    items.length === 0 || items.some((i) => sentenceWords(i.label).length < 2);
  const { notify } = useToast();
  useLayoutEffect(() => onChange(items, seconds), [items, seconds, onChange]);
  async function append(labels: string[]) {
    if (busy || saving) return false;
    // Also repair older saved games that accidentally contain only the untouched demo.
    const base = isSplashSampleItems(items) ? [] : items;
    const seen = new Set(base.map(i => i.label.trim().replace(/\s+/g, ' ').toLowerCase()));
    const fresh = labels.map(s => s.trim()).filter(label => {
      const key = label.replace(/\s+/g, ' ').toLowerCase();
      if (!label || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(label => ({ id: crypto.randomUUID(), label }));
    if (!fresh.length) return false;
    const next = [...base, ...fresh];
    setItems(next);
    if (next.some(i => sentenceWords(i.label).length < 2)) return false;
    setBusy(true);
    setFeedback('');
    try {
      await apply(next, seconds);
      setFeedback(t('sentenceSplashSave.imported'));
      return true;
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
      setFeedback(text('적용하지 못했어요. 입력 내용은 유지되니 다시 시도하세요.', 'Could not apply. Your edits are still here; please retry.'));
      return false;
    } finally {
      setBusy(false);
    }
  }
  function move(index: number, direction: number) {
    setItems((old) => {
      const next = [...old];
      [next[index], next[index + direction]] = [
        next[index + direction],
        next[index],
      ];
      return next;
    });
  }
  async function preview() {
    if (invalid || busy) return;
    setBusy(true);
    setFeedback("");
    try {
      await apply(
        items.map((i) => ({ ...i, label: i.label.trim() })),
        seconds,
      );
      setFeedback(
        text(
          "미리보기에 적용했어요. 저장된 게임은 변경 내용도 저장됐어요.",
          "Preview updated. Changes to saved games are saved too.",
        ),
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), "error");
      setFeedback(
        text(
          "적용하지 못했어요. 입력 내용은 유지되니 다시 시도하세요.",
          "Could not apply. Your edits are still here; please retry.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset disabled={busy||saving} className="space-y-4 min-w-0">
      <label className="block font-semibold">
        {text("문장당 제한 시간", "Time per sentence")}
        <select
          aria-label={text("문장당 제한 시간", "Time per sentence")}
          className={input}
          value={seconds}
          onChange={(e) => setSeconds(Number(e.target.value))}
        >
          {SPLASH_TIMES.map((s) => (
            <option key={s} value={s}>
              {s}
              {text("초", " seconds")}
            </option>
          ))}
        </select>
      </label>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="rounded-xl border border-outline-variant p-2"
          >
            <label className="block">
              {text(`문장 ${index + 1}`, `Sentence ${index + 1}`)}
              <input
                className={input}
                value={item.label}
                onChange={(e) =>
                  setItems((old) =>
                    old.map((i) =>
                      i.id === item.id ? { ...i, label: e.target.value } : i,
                    ),
                  )
                }
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className={button}
                type="button"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                aria-label={text(
                  `문장 ${index + 1} 위로`,
                  `Move sentence ${index + 1} up`,
                )}
              >
                ↑ {text("위로", "Up")}
              </button>
              <button
                className={button}
                type="button"
                disabled={index === items.length - 1}
                onClick={() => move(index, 1)}
                aria-label={text(
                  `문장 ${index + 1} 아래로`,
                  `Move sentence ${index + 1} down`,
                )}
              >
                ↓ {text("아래로", "Down")}
              </button>
              <button
                className={button}
                type="button"
                onClick={() =>
                  setItems((old) => old.filter((i) => i.id !== item.id))
                }
                aria-label={text(
                  `문장 ${index + 1} 삭제`,
                  `Delete sentence ${index + 1}`,
                )}
              >
                {text("삭제", "Delete")}
              </button>
            </div>
          </div>
        ))}
      </div>
      <label className="block">
        {text(
          "여러 문장 붙여넣기 (한 줄에 한 문장)",
          "Paste sentences (one per line)",
        )}
        <textarea
          className={`${input} min-h-28`}
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          className={button}
          type="button"
          disabled={!bulk.trim()}
          onClick={async () => { if(await append(bulk.split(/\r?\n/)))setBulk(''); }}
        >
          {text("입력한 문장 추가", "Add pasted sentences")}
        </button>
        <button
          className={button}
          type="button"
          onClick={() =>
            setItems((old) => [...old, { id: crypto.randomUUID(), label: "" }])
          }
        >
          {text("빈 문장 추가", "Add blank sentence")}
        </button>
      </div>
      <WordListPicker
        variant="full"
        kind="sentence"
        wordLists={wordLists}
        loading={listsLoading}
        onImportFull={(cards) => {void append(cards.map((c) => c.word));}}
      />
      <SentenceBankPicker
        withKo={false}
        classId={classId}
        onImportLabels={labels=>{void append(labels);}}
      />
      {invalid && (
        <p role="status">
          {text(
            "각 문장을 두 단어 이상 입력하세요. 빈 문장은 삭제해 주세요.",
            "Use at least two words per sentence. Remove blank sentences.",
          )}
        </p>
      )}
      <button
        type="button"
        className={`${button} bg-primary! text-on-primary!`}
        disabled={busy || invalid}
        onClick={() => void preview()}
      >
        {busy
          ? text("적용 중…", "Applying…")
          : text("미리보기 적용", "Apply to preview")}
      </button>
      <p role="status" className="text-sm">
        {feedback}
      </p>
    </fieldset>
  );
}

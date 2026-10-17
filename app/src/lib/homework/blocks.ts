import type {
  CurriculumLesson,
  FullCardItem,
  LessonSlide,
  WordList,
} from "../types";
import { wordListToCards } from "../gameFromWords";
import { parseShadowText } from "../shadowLines";
import { extractYoutubeId } from "../youtube";
import { effectiveSlides } from "../lessonSlides";
import { SPEAKING_ITEMS } from "../rainbow";
import { grammarPoint, sentencesForUnscramble } from "../grammar";
import { meaningQ, sentenceOrderQ, spellQ } from "./build";
import type { HwItemDraft } from "./types";
import { isMeaning } from "./quality";
export { isMeaning } from "./quality";

export type BlockType = "study" | "recall" | "speak" | "sentence" | "video";
export interface HomeworkBlock {
  schemaVersion: 1;
  type: BlockType;
  completion: "confirm" | "answers" | "recording" | "review" | "watch";
  text: string;
  translation: string;
  imageUrl: string;
  audioUrl: string;
  videoUrl: string;
  start: number;
  end: number;
  question: string;
  stages: ("model" | "hidden" | "picture")[];
  hiddenWords: number[];
  repeats: number;
  source?: {
    lessonId: string;
    slideId: string;
    version: string;
    materialId?: string;
  };
}
export interface HomeworkDraft {
  assignment?: { students: string[] | null; due: string };
  id: string;
  revision: number;
  title: string;
  items: HwItemDraft[];
  template: boolean;
}
export const BLOCK_NAMES: Record<BlockType, [string, string]> = {
  study: ["보고 듣기", "Look & listen"],
  recall: ["기억해서 답하기", "Recall"],
  speak: ["말하기", "Speaking"],
  sentence: ["문장 만들기", "Build a sentence"],
  video: ["영상 미션", "Video mission"],
};
export function newBlock(type: BlockType): HwItemDraft {
  return {
    kind: type === "recall" ? "quiz" : "worksheet",
    title: BLOCK_NAMES[type][0],
    config: {
      block: {
        schemaVersion: 1,
        type,
        completion:
          type === "recall"
            ? "answers"
            : type === "speak"
              ? "recording"
              : type === "sentence"
                ? "review"
                : type === "video"
                  ? "watch"
                  : "confirm",
        text: "",
        translation: "",
        imageUrl: "",
        audioUrl: "",
        videoUrl: "",
        start: 0,
        end: 30,
        question: "",
        stages: ["model", "hidden", "picture"],
        hiddenWords: [],
        repeats: 1,
      },
    },
    content: { questions: [] },
  };
}
export const newDraft = (): HomeworkDraft => ({
  id: crypto.randomUUID(),
  revision: 1,
  title: "",
  items: [],
  template: false,
});

/** Incomplete content is editable; malformed or future schemas must not crash recovery. */
export function isEditableDraft(value: unknown): value is HomeworkDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as HomeworkDraft;
  if (
    typeof d.id !== "string" ||
    typeof d.title !== "string" ||
    !Number.isInteger(d.revision) ||
    d.revision < 1 ||
    !Array.isArray(d.items) ||
    d.items.length > 60
  )
    return false;
  if (
    d.assignment &&
    (typeof d.assignment.due !== "string" ||
      (d.assignment.students !== null &&
        (!Array.isArray(d.assignment.students) ||
          !d.assignment.students.every((id) => typeof id === "string"))))
  )
    return false;
  return d.items.every((it) => {
    if (
      !it ||
      typeof it.title !== "string" ||
      !it.config ||
      !it.content ||
      !Array.isArray(it.content.questions)
    )
      return false;
    const b = it.config.block;
    if (
      b &&
      (b.schemaVersion !== 1 ||
        !Object.hasOwn(BLOCK_NAMES, b.type) ||
        !Array.isArray(b.stages) ||
        !Array.isArray(b.hiddenWords) ||
        [
          "text",
          "translation",
          "imageUrl",
          "audioUrl",
          "videoUrl",
          "question",
        ].some((key) => typeof b[key as keyof HomeworkBlock] !== "string"))
    )
      return false;
    return it.content.questions.every(
      (q) =>
        q &&
        typeof q.prompt === "string" &&
        ["choice", "text", "order"].includes(q.qtype) &&
        (!q.choices ||
          (Array.isArray(q.choices) &&
            q.choices.every((c) => typeof c === "string"))) &&
        (!q.tokens ||
          (Array.isArray(q.tokens) &&
            q.tokens.every((c) => typeof c === "string"))),
    );
  });
}

/** Conservative filter: explanatory notes require teacher editing, never become meaning distractors. */
export function validateItems(items: HwItemDraft[]): string[] {
  const errors: string[] = [];
  if (!Array.isArray(items))
    return ["손상된 활동 목록 / Invalid activity list"];
  if (!items.length || items.length > 60)
    errors.push("활동은 1~60개 필요합니다. / Add 1–60 activities.");
  items.forEach((it, i) => {
    const prefix = `${i + 1}. `;
    if (
      !it ||
      typeof it.title !== "string" ||
      !it.config ||
      !it.content ||
      !Array.isArray(it.content.questions)
    ) {
      errors.push(prefix + "손상된 자료 / Damaged activity");
      return;
    }
    const b = it.config.block;
    if (b) {
      if (
        typeof b.text !== "string" ||
        typeof b.videoUrl !== "string" ||
        !Array.isArray(b.stages) ||
        !Array.isArray(b.hiddenWords)
      ) {
        errors.push(prefix + "손상된 블록 / Damaged block");
        return;
      }
      if (b.schemaVersion !== 1 || !Object.hasOwn(BLOCK_NAMES, b.type))
        errors.push(prefix + "지원하지 않는 블록 버전 / Unsupported block");
      if (b.type !== "video" && b.type !== "recall" && !b.text.trim())
        errors.push(prefix + "학습 내용 필요 / Content required");
      if (
        b.type === "video" &&
        (!extractYoutubeId(b.videoUrl) ||
          b.start < 0 ||
          b.end <= b.start ||
          b.end - b.start > 1200)
      )
        errors.push(
          prefix +
            "지원하는 YouTube 주소와 1~1200초 구간 필요 / Check video and segment",
        );
      if (
        b.type === "speak" &&
        (!b.stages.length || b.repeats < 1 || b.repeats > 5)
      )
        errors.push(prefix + "말하기 단계·반복 확인 / Check speaking stages");
      const allowed: Record<BlockType, string[]> = {
        study: ["confirm"],
        recall: ["answers"],
        speak: ["recording"],
        sentence: ["answers", "review"],
        video: ["watch", "review", "recording"],
      };
      if (!allowed[b.type]?.includes(b.completion))
        errors.push(prefix + "완료 조건 확인 / Check completion rule");
    }
    if (
      (!b || b.completion === "answers") &&
      !it.content.questions.length &&
      it.kind !== "shadowing"
    )
      errors.push(prefix + "문제를 추가하세요 / Add questions");
    it.content.questions.forEach((q, qi) => {
      if (!q || !["choice", "text", "order"].includes(q.qtype)) {
        errors.push(prefix + "손상된 문제 / Invalid question");
        return;
      }
      if (q.style === "listen" && !q.speak?.trim())
        errors.push(prefix + "듣기 내용 필요 / Listening content required");
      if (q.style === "picture" && !q.imageUrl)
        errors.push(prefix + "문제 그림 필요 / Picture required");
      if (
        typeof q.prompt !== "string" ||
        (q.style !== "listen" && !q.prompt.trim())
      )
        errors.push(prefix + "문제 안내 필요 / Prompt required");
      if (
        q.qtype === "order" &&
        (!Array.isArray(q.correct) ||
          q.correct.some((v) => !v.trim()) ||
          JSON.stringify(q.correct).length > 300)
      )
        errors.push(prefix + "낱말·청크를 확인하세요 / Check answer chunks");
      if (q.qtype === "text" && String(q.correct).length > 300)
        errors.push(
          prefix +
            "허용 정답은 300자 이내 / Accepted answers must fit in 300 characters",
        );
      if (
        q.qtype === "choice" &&
        (!q.choices ||
          q.choices.length < 2 ||
          new Set(q.choices).size !== q.choices.length ||
          typeof q.correct !== "number" ||
          !Number.isInteger(q.correct) ||
          !q.choices[q.correct])
      )
        errors.push(prefix + `${qi + 1}: 보기·정답 확인 / Check choices`);
      if (q.style === "meaning" && q.choices?.some((v) => !isMeaning(v)))
        errors.push(
          prefix +
            `${qi + 1}: 설명 메모를 뜻 보기로 사용할 수 없습니다 / Meaning contains notes`,
        );
      if (
        q.qtype !== "choice" &&
        (!q.correct || (Array.isArray(q.correct) && !q.correct.length))
      )
        errors.push(prefix + `${qi + 1}: 정답 필요 / Answer required`);
    });
  });
  return errors;
}

export function blocksFromCards(
  cards: FullCardItem[],
  type: BlockType,
): HwItemDraft[] {
  const usable = cards.filter((c) => c.word.trim());
  if (type === "recall") {
    const it = newBlock(type);
    it.content.questions = usable
      .map(
        (c) =>
          (isMeaning(c.meaning)
            ? meaningQ(
                c,
                usable.filter((x) => isMeaning(x.meaning)),
                Math.random,
              )
            : null) ?? spellQ(c),
      )
      .filter((q) => q !== null);
    return it.content.questions.length ? [it] : [];
  }
  return usable.map((c) => {
    const it = newBlock(type);
    Object.assign(it.config.block!, {
      text: type === "study" ? c.word : c.example || c.word,
      translation: c.meaning,
      imageUrl: c.imageUrl || "",
    });
    if (type === "sentence") {
      const q = sentenceOrderQ(c, Math.random);
      if (q) {
        it.content.questions = [q];
        it.config.block!.completion = "answers";
      }
    }
    return it;
  });
}
export interface ImportCandidate {
  slideId: string;
  label: string;
  status: "convert" | "alternative" | "unsupported";
  reason: string;
  items: HwItemDraft[];
}
export function lessonCandidates(
  lesson: CurriculumLesson,
  lists: WordList[],
): ImportCandidate[] {
  return effectiveSlides(lesson).map((raw, index) => {
    const slide = raw as LessonSlide;
    const cards =
      ("words" in slide && slide.words) ||
      wordListToCards(
        lists.find(
          (w) => w.id === (slide.ownWordListId || lesson.word_list_id),
        ),
      );
    let items: HwItemDraft[] = [];
    let status: ImportCandidate["status"] = "convert";
    let reason = "";
    switch (slide.kind) {
      case "study":
      case "wordshow":
        items = blocksFromCards(cards, "study");
        break;
      case "game":
        items = blocksFromCards(cards, "recall");
        status = "alternative";
        reason =
          "팀 게임의 단어장으로 개인 복습 제안 / Individual vocabulary alternative";
        break;
      case "drill": {
        const it = newBlock("speak");
        it.config.block!.text = slide.sentence;
        it.config.block!.translation = slide.sentenceKo || "";
        items = [it];
        break;
      }
      case "rainbow": {
        if (slide.mode !== "speak") {
          status = "unsupported";
          reason =
            "구조 설명은 직접 숙제로 구성 / Adapt structural explanation manually";
          break;
        }
        items = SPEAKING_ITEMS.filter(
          (s) => !slide.itemIds?.length || slide.itemIds.includes(s.id),
        ).map((s) => {
          const it = newBlock("speak");
          Object.assign(it.config.block!, {
            text: s.englishAnswer,
            translation: s.koreanPrompt,
            imageUrl: s.imageMain,
          });
          return it;
        });
        break;
      }
      case "grammar": {
        const point = grammarPoint(slide.grammarId);
        if (point)
          items = sentencesForUnscramble(point).flatMap((sentence) =>
            blocksFromCards(
              [
                {
                  id: crypto.randomUUID(),
                  word: sentence,
                  meaning: sentence,
                  example: sentence,
                  imageUrl: null,
                },
              ],
              "study",
            ).concat(
              blocksFromCards(
                [
                  {
                    id: crypto.randomUUID(),
                    word: sentence,
                    meaning: sentence,
                    example: sentence,
                    imageUrl: null,
                  },
                ],
                "sentence",
              ),
            ),
          );
        reason =
          "저장된 문법 예문만 가져옵니다. 수업 중 단어장으로 생성한 변형 문장은 제외됩니다. / Stored examples only; generated variants are omitted.";
        break;
      }
      case "reading":
      case "shadow": {
        const lines = parseShadowText(slide.source);
        items = lines.flatMap((line) => {
          const it = newBlock(slide.kind === "shadow" ? "speak" : "study");
          it.config.block!.text = line.en;
          it.config.block!.translation = line.ko || "";
          return slide.kind === "shadow"
            ? [it]
            : [
                it,
                ...blocksFromCards(
                  [
                    {
                      id: crypto.randomUUID(),
                      word: line.en,
                      meaning: line.ko || line.en,
                      example: line.en,
                      imageUrl: null,
                    },
                  ],
                  "sentence",
                ),
              ];
        });
        break;
      }
      case "video": {
        const it = newBlock("video");
        Object.assign(it.config.block!, {
          videoUrl: slide.videoUrl,
          start: slide.startSec || 0,
          end: slide.endSec || (slide.startSec || 0) + 30,
        });
        items = [it];
        break;
      }
      default:
        status = "unsupported";
        reason =
          "직접 확인 후 숙제 블록으로 작성하세요 / Requires manual adaptation";
    }
    if (!items.length) {
      status = "unsupported";
      reason ||= "가져올 학습 내용이 없습니다 / No learning content";
    }
    items.forEach((it) => {
      it.config.block!.source = {
        lessonId: lesson.id,
        slideId: slide.id,
        version: lesson.updated_at,
        materialId: lesson.word_list_id || undefined,
      };
    });
    return {
      slideId: slide.id || String(index),
      label: `${index + 1}. ${slide.kind || "legacy"}`,
      status,
      reason,
      items,
    };
  });
}

// Local synthetic browser fixture, never imported by the production application.
import { createRoot } from "react-dom/client";
import "../../src/tailwind.css";
import i18n from "../../src/i18n";
import HomeworkBlockEditor from "../../src/components/homework/teacher/HomeworkBlockEditor";
import HomeworkPreview from "../../src/components/homework/teacher/HomeworkPreview";
import HomeworkRunner from "../../src/components/homework/HomeworkRunner";
import type { RunnerApi } from "../../src/components/homework/runnerTypes";
import { newBlock, type BlockType } from "../../src/lib/homework/blocks";
const params = new URLSearchParams(location.search);
void i18n.changeLanguage(params.get("lang") || "ko");
const type = params.get("type") as BlockType | null;
const item = newBlock(type || "study");
Object.assign(item.config.block!, {
  text: "I like cats.",
  translation: "나는 고양이를 좋아해요.",
  hiddenWords: [1],
  imageUrl: "/word-bank-images/cat.webp",
});
if (type === "video")
  Object.assign(item.config.block!, {
    videoUrl: "https://youtu.be/abcdefghijk",
    start: 0,
    end: 5,
  });
if (type === "recall")
  item.content.questions = [
    {
      id: "q",
      qtype: "choice",
      style: "meaning",
      prompt: "cat",
      choices: ["고양이", "개"],
      correct: 0,
      skill: "vocab.meaning",
      word: "cat",
      gen: "test",
    },
  ];
const test = window as unknown as {
  __hwTest: { calls: string[]; failUpload?: boolean; failProgress?: boolean };
};
const api: RunnerApi = {
  cacheScope: "synthetic-token",
  submit: async () => {
    test.__hwTest.calls.push("submit");
    return { correct: true, answer: "synthetic" };
  },
  uploadRecording: async () => {
    test.__hwTest.calls.push("upload");
    if (test.__hwTest.failUpload) throw new Error("synthetic upload failure");
    return "synthetic/private-audio";
  },
  progress: async () => {
    if (test.__hwTest.failProgress)
      throw new Error("synthetic connection failure");
    test.__hwTest.calls.push("progress");
  },
  finish: async () => {
    test.__hwTest.calls.push("finish");
    return { score: 0, total: 0 };
  },
};
createRoot(document.getElementById("root")!).render(
  type ? (
    <div className="min-h-screen bg-[#16213e] p-3">
      {params.get("mode") === "student" ? (
        <div className="mx-auto flex min-h-screen max-w-md flex-col text-white">
          <HomeworkRunner
            title="합성 테스트 숙제"
            items={[{ ...item, id: `synthetic-${type}` }]}
            initialAnswers={new Map()}
            finishedItems={new Set()}
            shadowLinesDone={new Map()}
            alreadyFinished={false}
            api={api}
            saveState="saved"
          />
        </div>
      ) : (
        <HomeworkPreview title="합성 테스트 숙제" items={[item]} />
      )}
    </div>
  ) : (
    <HomeworkBlockEditor
      academyId="synthetic-academy"
      classId="synthetic-class"
      ownerId="synthetic-teacher"
      onClose={() => {
        document.title = "closed";
      }}
      onCreated={() => {
        document.title = "assigned";
      }}
    />
  ),
);

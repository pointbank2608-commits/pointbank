import TracingRow from './TracingRow';
import { buildQuizQuestions } from '../../lib/quizFromWordList';
import type { FullCardItem, WorksheetSlideOptions } from '../../lib/types';

export function worksheetQuiz(words: FullCardItem[]) {
  return buildQuizQuestions({ items: words.map(w => ({ id: w.id, word: w.word, meaning: w.meaning, image_url: w.imageUrl, category: null })) }, 'wordToMeaning');
}

export default function BasicWorksheetSheets({ tab, words, options = {}, quiz = [] }: {
  tab: string;
  words: FullCardItem[];
  options?: WorksheetSlideOptions;
  quiz?: ReturnType<typeof worksheetQuiz>;
}) {
  const listShow = options.listShow ?? { pos: true, example: false, image: false };
  const tracingShow = options.tracingShow ?? { meaning: false, image: false };
  const showAnswerKey = options.showAnswerKey ?? false;
  return <>
      {tab === 'list' && (
        <div data-board-text className="print-sheet mx-auto p-6">
          {/* 예문·그림이 들어가면 한 줄이 길어져서 한 단으로, 아니면 두 단으로 보여준다. */}
          <div className={listShow.example || listShow.image ? '' : 'columns-2 gap-8'}>
            {words.map((w, i) => (
              <div
                key={w.id}
                className={`print-card flex gap-2 border-b border-outline-variant/40 py-1.5 ${listShow.image ? 'items-center' : 'items-baseline'}`}
              >
                <span className="font-caption text-caption text-on-surface-variant w-6 shrink-0">{i + 1}.</span>
                {listShow.image && (
                  <span className="flex h-[14mm] w-[14mm] shrink-0 items-center justify-center">
                    {w.imageUrl ? <img src={w.imageUrl} alt="" className="h-full w-full object-contain" /> : null}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-title-md text-title-md text-deep-navy">{w.word}</span>
                    {listShow.pos && w.partOfSpeech && (
                      <span className="rounded bg-surface-container-high px-1.5 font-caption text-caption text-on-surface-variant">
                        {w.partOfSpeech}
                      </span>
                    )}
                    <span className="font-body-md text-body-md text-on-surface-variant">{w.meaning}</span>
                  </div>
                  {listShow.example && w.example && (
                    <div className="font-body-sm text-body-sm text-on-surface-variant">{w.example}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'card' && (
        <div data-board-text className="print-sheet mx-auto p-6">
          <div className="grid grid-cols-3 gap-[5mm]">
            {words.map((w) => (
              <div
                key={w.id}
                className="print-card flex flex-col items-center rounded-[4mm] border-2 border-outline-variant p-[3mm] gap-[2mm]"
              >
                <div className="w-full aspect-square rounded-[3mm] bg-surface-container-low flex items-center justify-center overflow-hidden">
                  {w.imageUrl ? (
                    <img src={w.imageUrl} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span style={{ fontSize: '32px' }} aria-hidden>
                      🔤
                    </span>
                  )}
                </div>
                <div className="font-title-md font-bold text-deep-navy text-center" style={{ wordBreak: 'keep-all' }}>
                  {w.word}
                </div>
                <div className="font-body-sm text-on-surface-variant text-center" style={{ wordBreak: 'keep-all' }}>
                  {w.meaning}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'tracing' && (
        <div data-board-text className="print-sheet mx-auto p-6 space-y-[4mm]">
          {words.map((w) => (
            <div key={w.id} className="print-card">
              <div className="mb-[3mm] flex flex-wrap items-baseline gap-x-3">
                <span className="font-bold text-deep-navy" style={{ fontSize: '30px', lineHeight: 1.1 }}>
                  {w.word}
                </span>
                {tracingShow.meaning && w.meaning && <span className="text-[18px] text-on-surface-variant">{w.meaning}</span>}
              </div>
              {/* 그림은 사선지 3줄 블록 높이(13mm × 3 + 줄 사이 8mm × 2 = 55mm)에 맞춘다. */}
              <div className="flex items-stretch gap-[6mm]">
                {tracingShow.image && w.imageUrl && (
                  <img src={w.imageUrl} alt="" className="h-[55mm] w-[55mm] shrink-0 object-contain" />
                )}
                <div className="min-w-0 flex-1">
                  {[0, 1, 2].map((row) => (
                    <TracingRow key={row} word={w.word} trace={row === 0} last={row === 2} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'quiz' && (
        <div data-board-text className="print-sheet mx-auto p-6 space-y-4">
          {quiz.map((q, i) => (
            <div key={q.id} className="print-card">
              <div className="font-title-md text-title-md text-deep-navy mb-1">
                {i + 1}. {q.question}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 pl-4">
                {q.choices.map((choice, ci) => (
                  <span
                    key={ci}
                    className={`font-body-md text-body-md ${
                      showAnswerKey && ci === q.correctIndex ? 'text-primary font-bold underline' : 'text-on-surface'
                    }`}
                  >
                    {String.fromCharCode(97 + ci)}. {choice}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
  </>;
}

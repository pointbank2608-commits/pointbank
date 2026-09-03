import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildGroupSortGroups, buildQuizQuestions, buildTrueFalseStatements, type QuizDirection } from '../lib/quizFromWordList';
import type { GroupSortGroup, ImageQuizItem, MatchPair, QuizQuestion, TrueFalseStatement, WordList } from '../lib/types';

function uid(): string {
  return crypto.randomUUID();
}

type Props =
  | { variant: 'label'; wordLists: WordList[]; loading: boolean; onImportLabels: (labels: string[]) => void }
  | { variant: 'pairs'; wordLists: WordList[]; loading: boolean; onImportPairs: (pairs: MatchPair[]) => void }
  | { variant: 'image'; wordLists: WordList[]; loading: boolean; onImportImage: (items: ImageQuizItem[]) => void }
  | { variant: 'quiz'; wordLists: WordList[]; loading: boolean; onImportQuestions: (questions: QuizQuestion[]) => void }
  | { variant: 'truefalse'; wordLists: WordList[]; loading: boolean; onImportStatements: (statements: TrueFalseStatement[]) => void }
  | { variant: 'groupsort'; wordLists: WordList[]; loading: boolean; onImportGroups: (groups: GroupSortGroup[]) => void };

/**
 * 선생님이 미리 만들어둔 단어장(WordListsPage 에서 관리)을 게임 항목으로 그대로 불러오는 패널.
 * variant 에 따라 이 게임이 받는 콘텐츠 모양이 다르다:
 * - label: 라벨 하나짜리 항목(GameItem[])만 쓰는 게임 — 단어로 채울지 뜻으로 채울지 토글이 필요.
 * - pairs: 단어+뜻 짝(MatchPair[])을 쓰는 게임(매치업·두더지잡기·플래시카드·답 입력하기).
 * - image: 사진+정답(ImageQuizItem[])을 쓰는 게임 — 이미지가 있는 단어장(사전에서 담은 것)만 유효.
 * - quiz: 오지선다 질문(QuizQuestion[])을 쓰는 게임 — 오답 보기는 AI 없이 단어장 안의 다른
 *   항목들로 자동 생성한다(`quizFromWordList.ts`).
 * - truefalse: 참/거짓 문장(TrueFalseStatement[])을 쓰는 게임 — 절반은 맞는 짝으로 참 문장을,
 *   절반은 다른 항목의 짝으로 바꿔치기해 거짓 문장을 자동으로 만든다.
 * - groupsort: 그룹(GroupSortGroup[])을 쓰는 게임 — 단어장 항목의 카테고리(사전에서 담은
 *   단어만 있음)로 자동 그룹화. 카테고리가 2개 이상 섞인 단어장만 고를 수 있다.
 */
export default function WordListPicker(props: Props) {
  const { t } = useTranslation();
  const { wordLists, loading } = props;
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<'word' | 'meaning'>('word');
  const [direction, setDirection] = useState<QuizDirection>('wordToMeaning');
  const showDirectionToggle = props.variant === 'quiz' || props.variant === 'truefalse';

  const usable =
    props.variant === 'image'
      ? wordLists.filter((l) => l.items.some((i) => i.image_url))
      : props.variant === 'quiz'
        ? wordLists.filter((l) => l.items.length >= 2)
        : props.variant === 'groupsort'
          ? wordLists.filter((l) => new Set(l.items.filter((i) => i.category).map((i) => i.category)).size >= 2)
          : wordLists;

  function handlePick(list: WordList) {
    if (props.variant === 'label') {
      props.onImportLabels(list.items.map((i) => (field === 'word' ? i.word : i.meaning)));
    } else if (props.variant === 'pairs') {
      props.onImportPairs(list.items.map((i) => ({ id: uid(), left: i.word, right: i.meaning })));
    } else if (props.variant === 'image') {
      props.onImportImage(
        list.items.filter((i) => i.image_url).map((i) => ({ id: uid(), imageUrl: i.image_url as string, answer: i.word })),
      );
    } else if (props.variant === 'quiz') {
      props.onImportQuestions(buildQuizQuestions(list, direction));
    } else if (props.variant === 'truefalse') {
      props.onImportStatements(buildTrueFalseStatements(list, direction));
    } else {
      props.onImportGroups(buildGroupSortGroups(list));
    }
  }

  return (
    <div className="my-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-label-md text-label-md transition-colors ${
          open
            ? 'bg-secondary-container text-on-secondary-container'
            : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
        }`}
      >
        <span className="material-symbols-outlined text-base">library_books</span>
        {open ? t('wordListPicker.close') : t('wordListPicker.open')}
      </button>

      {open && (
        <div className="mt-3 p-4 bg-surface-container-low rounded-lg">
          {props.variant === 'label' && (
            <div className="flex bg-surface-container-lowest rounded-lg p-1 mb-3 w-fit">
              <button
                type="button"
                onClick={() => setField('word')}
                className={`px-3 py-1 rounded-md font-label-md text-label-md transition-all ${
                  field === 'word' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                }`}
              >
                {t('wordListPicker.fieldWord')}
              </button>
              <button
                type="button"
                onClick={() => setField('meaning')}
                className={`px-3 py-1 rounded-md font-label-md text-label-md transition-all ${
                  field === 'meaning' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                }`}
              >
                {t('wordListPicker.fieldMeaning')}
              </button>
            </div>
          )}

          {showDirectionToggle && (
            <div>
              <div className="flex bg-surface-container-lowest rounded-lg p-1 mb-2 w-fit">
                <button
                  type="button"
                  onClick={() => setDirection('wordToMeaning')}
                  className={`px-3 py-1 rounded-md font-label-md text-label-md transition-all ${
                    direction === 'wordToMeaning' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                  }`}
                >
                  {t('wordListPicker.quizWordToMeaning')}
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('meaningToWord')}
                  className={`px-3 py-1 rounded-md font-label-md text-label-md transition-all ${
                    direction === 'meaningToWord' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                  }`}
                >
                  {t('wordListPicker.quizMeaningToWord')}
                </button>
              </div>
              <div className="font-caption text-caption text-on-surface-variant mb-2">
                {props.variant === 'quiz' ? t('wordListPicker.quizAutoChoicesHint') : t('wordListPicker.trueFalseAutoHint')}
              </div>
            </div>
          )}

          {loading ? (
            <div className="font-caption text-caption text-on-surface-variant py-2">{t('wordListPicker.loading')}</div>
          ) : usable.length === 0 ? (
            <div className="font-caption text-caption text-on-surface-variant py-2">
              {props.variant === 'image' && wordLists.length > 0
                ? t('wordListPicker.emptyNoImages')
                : props.variant === 'quiz' && wordLists.length > 0
                  ? t('wordListPicker.emptyTooFewForQuiz')
                  : props.variant === 'groupsort' && wordLists.length > 0
                    ? t('wordListPicker.emptyTooFewCategories')
                    : t('wordListPicker.emptyNone')}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {usable.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => handlePick(list)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-lowest hover:bg-secondary-container text-on-surface hover:text-on-secondary-container font-label-md text-label-md transition-colors w-fit"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  {list.name}
                  <span className="font-caption text-caption opacity-70">({list.items.length})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

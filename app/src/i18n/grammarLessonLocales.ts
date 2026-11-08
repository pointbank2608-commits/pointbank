import i18n from './index';

/** 문법 30분 수업 문구 — 이 파일을 불러오면 `grammarLesson.*` 키가 번역에 더해진다(ko.ts/en.ts 를 건드리지 않는다). */
const ko = {
  warmUp: '오늘 배울 문법을 알아볼까요? 짝과 이야기해 보세요.',
  discoverTitle: '규칙 발견 질문',
  conceptTitle: '개념 확인 문제 (팀 점수)',
  fixTitle: '심화 ① 틀린 곳 고치기',
  writeTitle: '심화 ② 조건에 맞게 영작하기',
  wrapTitle: '오늘의 정리',
  wrapPoints: '포인트 주기: 오늘 잘한 친구에게 칭찬 포인트!',
  exitTitle: '마무리 문제',
  chooseHint: '빈칸에 알맞은 것을 골라요.',
  fixPrompt: '틀린 곳을 찾아 고쳐요 →',
  gameTemplateName: '문법 · {{name}}',
  teamQuizName: '문법 팀 대항 퀴즈 · {{name}}',
  focusName: '{{game}} · {{name}}',
  factoryTitle: '문장 공장 미션',
  factory: {
    past: '과거형으로 바꿔요',
    present: '현재형으로 바꿔요',
    future: '미래형(will)으로 바꿔요',
    negative: '부정문으로 바꿔요',
    question: '의문문으로 바꿔요',
    subjectThey: '주어를 They 로 바꿔요',
    subjectHe: '주어를 He 로 바꿔요',
    subjectShe: '주어를 She로 바꾸고 동사도 알맞게 바꾸세요.',
  },
};
const en = {
  warmUp: 'What will we learn today? Talk with your partner.',
  discoverTitle: 'Find the rule',
  conceptTitle: 'Concept check (team score)',
  fixTitle: 'Challenge 1: fix the mistake',
  writeTitle: 'Challenge 2: write with conditions',
  wrapTitle: 'Wrap-up',
  wrapPoints: 'Give praise points to today\'s stars!',
  exitTitle: 'Exit questions',
  chooseHint: 'Choose the right one for the blank.',
  fixPrompt: 'Find and fix the mistake →',
  gameTemplateName: 'Grammar · {{name}}',
  teamQuizName: 'Grammar team quiz · {{name}}',
  focusName: '{{game}} · {{name}}',
  factoryTitle: 'Sentence factory missions',
  factory: {
    past: 'Change to the past',
    present: 'Change to the present',
    future: 'Change to the future (will)',
    negative: 'Make it negative',
    question: 'Make it a question',
    subjectThey: 'Change the subject to They',
    subjectHe: 'Change the subject to He',
    subjectShe: 'Change the subject to She and adjust the verb.',
  },
};
i18n.addResourceBundle('ko', 'translation', { grammarLesson: ko }, true, true);
i18n.addResourceBundle('en', 'translation', { grammarLesson: en }, true, true);
export {};

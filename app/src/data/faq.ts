/**
 * 도움말 · 자주 묻는 질문(2026-09-27). 고객센터가 문의하기 전에 먼저 보여 준다(검색 가능).
 * 기능을 바꾸면 여기 답도 같이 고칠 것. link 는 답과 관련된 화면(누르면 이동).
 */
export type FaqCategory = 'start' | 'lesson' | 'games' | 'words' | 'online' | 'points' | 'billing' | 'account';

export interface FaqItem {
  id: string;
  category: FaqCategory;
  q: { ko: string; en: string };
  a: { ko: string; en: string };
  link?: string;
}

export const FAQ_CATEGORIES: FaqCategory[] = ['start', 'lesson', 'games', 'words', 'online', 'points', 'billing', 'account'];

export const FAQ: FaqItem[] = [
  {
    id: 'start-first',
    category: 'start',
    q: { ko: '처음인데 무엇부터 하면 되나요?', en: 'I am new. Where do I start?' },
    a: {
      ko: '① 학생관리에서 반을 만들고 ② 내 단어장에서 단어장을 하나 만든 뒤 ③ 내 수업 → 새 수업 만들기에서 "레시피로 시작하기"를 고르세요. 슬라이드가 순서대로 채워지고, "발표하기"만 누르면 수업이 시작돼요. 대시보드의 "처음 시작하기" 체크리스트를 따라가도 돼요.',
      en: 'Create a class in Students, make one word list, then go to My Lessons → New lesson and pick a recipe. Slides fill in automatically — just press Present. The "Getting started" checklist on the dashboard walks you through it.',
    },
    link: '/curriculum',
  },
  {
    id: 'lesson-recipe',
    category: 'lesson',
    q: { ko: '레시피로 만든 수업을 고칠 수 있나요?', en: 'Can I edit a lesson made from a recipe?' },
    a: {
      ko: '네. 슬라이드를 끌어서 순서를 바꾸고, 복사·삭제하고, "종류 바꾸기"로 다른 슬라이드로 바꿀 수 있어요. 잘못 바꿨으면 되돌리기(Ctrl+Z)를 누르세요. 저장 전에도 자동 임시저장돼요.',
      en: 'Yes. Drag to reorder, duplicate, delete, or use "Change type". Press Undo (Ctrl+Z) if you make a mistake. Drafts are auto-saved.',
    },
  },
  {
    id: 'lesson-history',
    category: 'lesson',
    q: { ko: '수업이나 단어장을 잘못 고쳤어요. 예전 내용으로 되돌릴 수 있나요?', en: 'I changed a lesson or word list by mistake. Can I go back?' },
    a: {
      ko: '네. 수업 카드의 시계 모양(이전 버전) 버튼을 누르면 고치기 전 내용이 날짜·시간별로 나와요. "이 버전으로"를 누르면 그때 내용으로 돌아가고, 지금 내용도 기록에 남아서 다시 돌아올 수 있어요. 내 단어장에도 같은 버튼이 있어요. 지운 수업·단어장은 목록 아래 "최근에 지운 …"에서 180일 안에 되살릴 수 있어요.',
      en: 'Yes. Press the clock (history) button on a lesson card to see earlier versions by date and time. "Restore" brings that version back, and the current one stays in history. Word lists have the same button. Deleted lessons and word lists can be restored for 180 days from "Recently deleted" below the list.',
    },
    link: '/curriculum',
  },
  {
    id: 'lesson-copy-class',
    category: 'lesson',
    q: { ko: '수업을 다른 반으로 복사하면 서로 같이 바뀌나요?', en: 'If I copy a lesson to another class, do they change together?' },
    a: {
      ko: '아니요. 복사한 수업은 단어장·게임 내용까지 그 반 것으로 새로 만들어져서, 한 반에서 고쳐도 다른 반은 그대로예요. 다만 예전에 복사한 수업이나 "모든 반 공용" 단어장을 같이 쓰는 수업은 단어장을 고치면 함께 바뀔 수 있어요 — 수업 화면에서 단어를 고치려고 하면 "이 수업만 따로 복사해서 고칠까요?"라고 물어보니 그때 확인을 누르세요.',
      en: 'No. A copied lesson gets its own word list and game content, so editing one class does not change another. Lessons copied earlier, or lessons sharing an academy-wide word list, may still change together — when you edit the words from the lesson screen you will be asked whether to make a separate copy for this lesson.',
    },
    link: '/curriculum',
  },
  {
    id: 'lesson-keys',
    category: 'lesson',
    q: { ko: '발표 중에 슬라이드는 어떻게 넘기나요?', en: 'How do I move between slides while presenting?' },
    a: {
      ko: 'Space·Enter·→ 또는 화면 클릭으로 다음, ← 로 이전이에요. 발표용 리모컨(클리커)은 PageDown/PageUp 이라 게임 화면에서도 넘어가요. 발표 바의 "?"를 누르면 단축키가 모두 나와요.',
      en: 'Space, Enter, → or a click goes forward; ← goes back. A presentation clicker (PageDown/PageUp) works on game slides too. Press "?" on the presenting bar for all shortcuts.',
    },
  },
  {
    id: 'lesson-pen',
    category: 'lesson',
    q: { ko: '발표 화면에 글씨를 쓸 수 있나요?', en: 'Can I draw on the slides?' },
    a: {
      ko: '발표 바의 "판서"를 누르면 게임을 뺀 모든 슬라이드 위에 펜으로 쓸 수 있어요. 다시 누르면 꺼져요.',
      en: 'Press "Pen" on the presenting bar to draw on any slide except games. Press again to turn it off.',
    },
  },
  {
    id: 'lesson-share',
    category: 'lesson',
    q: { ko: '만든 수업을 다른 선생님에게 줄 수 있나요?', en: 'Can I share a lesson with another teacher?' },
    a: {
      ko: '수업 카드의 공유 버튼 → "공유 링크 만들기"로 링크를 보내면, 받은 선생님이 미리 본 뒤 자기 학원으로 가져가요. 학생 이름·출석·포인트는 함께 가지 않아요. 같은 학원의 다른 반에는 "다른 반으로 복사"를 쓰세요.',
      en: 'Use the share button on a lesson card → "Create share link". The other teacher previews it and imports a copy. Student names, attendance and points are never included. For another class in your academy, use "Copy to another class".',
    },
  },
  {
    id: 'games-wordlist',
    category: 'games',
    q: { ko: '게임마다 단어를 다시 입력해야 하나요?', en: 'Do I have to type words for every game?' },
    a: {
      ko: '아니요. 단어장을 한 번 만들면 게임 대부분에 "단어장 불러오기"로 그대로 들어가요. 퀴즈·O·X는 오답까지 자동으로 만들어져요. 수업의 게임 슬라이드는 내용을 안 골라도 저장할 때 수업 단어장으로 자동으로 만들어져요.',
      en: 'No. Make a word list once and load it into most games. Quiz and O/X even build wrong answers automatically. Game slides in a lesson are filled from the lesson word list when you save.',
    },
    link: '/wordlists',
  },
  {
    id: 'games-quizshow',
    category: 'games',
    q: { ko: '학생들이 휴대폰으로 참여하는 퀴즈는 어떻게 하나요?', en: 'How do students join a quiz on their phones?' },
    a: {
      ko: '게임 센터의 "대회 퀴즈쇼"에서 단어장으로 대회를 만들고 "대회 열기"를 누르면 QR 코드와 번호가 나와요. 학생은 휴대폰 카메라로 찍고 닉네임만 넣으면 돼요(로그인 없음). 이상한 닉네임은 ✕로 내보낼 수 있어요.',
      en: 'Open "Contest Quiz Show" in the game center, build a contest from a word list and press "Open". Students scan the QR code and enter a nickname — no login. Remove unsuitable nicknames with ✕.',
    },
    link: '/games/quizshow',
  },
  {
    id: 'words-dictionary',
    category: 'words',
    q: { ko: '단어장에 그림이 들어가게 하려면요?', en: 'How do I get pictures in my word list?' },
    a: {
      ko: '단어장에 단어를 담을 때 "사전에서 선택"이나 "카테고리로 선택"을 쓰면 그림이 같이 들어가요. 직접 입력한 단어는 그림이 없어요. 파닉스 단계에서 담으면 소리 규칙 강조도 같이 따라가요.',
      en: 'Add words with "Pick from dictionary" or "Pick by category" and pictures come along. Typed words have no picture. Phonics words also keep their sound-rule highlighting.',
    },
  },
  {
    id: 'words-print',
    category: 'words',
    q: { ko: '워크시트는 어디서 만드나요?', en: 'Where do I make worksheets?' },
    a: {
      ko: '수업 자료실에서 워크시트·플래시카드·빙고·메모리 카드를 A4로 인쇄할 수 있어요. 수업 안에서는 "수업 자료실" 슬라이드로 넣으면 발표 중 바로 인쇄할 수 있어요. 단어를 사전 주제(동물·음식 등)에서 고를 수도 있어요.',
      en: 'Printables (A4) are in Materials: worksheets, flashcards, bingo and memory cards. In a lesson, add a Materials slide to print during class. Words can also come from a dictionary topic.',
    },
    link: '/materials',
  },
  {
    id: 'online-zoom',
    category: 'online',
    q: { ko: '줌(화상) 수업에서도 쓸 수 있나요?', en: 'Can I use it in a Zoom class?' },
    a: {
      ko: '네. 줌에서 화면 공유 → 크롬 탭을 고르고 "소리 공유"를 켜세요. 발표 바의 "온라인" → "학생 따라보기 켜기"를 누르면 학생이 링크로 들어와 선생님이 넘기는 슬라이드를 자기 화면에서 크게 봐요. 퀴즈쇼는 입장 링크를 채팅에 붙이면 집에서 참가해요.',
      en: 'Yes. Share this Chrome tab in Zoom with "Share sound" on. On the presenting bar, press "Online" → "Turn on follow-along" so students see your slides on their own screens. Paste the quiz show link in the chat.',
    },
  },
  {
    id: 'points-give',
    category: 'points',
    q: { ko: '수업 중에 포인트는 어떻게 주나요?', en: 'How do I give points during class?' },
    a: {
      ko: '발표 바의 "포인트 주기"에서 여러 학생을 골라 한 번에 줄 수 있어요. 포인트 뱅크 화면에서는 학생 카드의 버튼으로 주고 뺄 수 있어요. 숙제 완료·미제출 버튼은 숙제 캘린더에도 기록돼요.',
      en: 'Use "Give points" on the presenting bar to reward several students at once, or the buttons on student cards in the Point Bank. Homework buttons also record to the homework calendar.',
    },
    link: '/board',
  },
  {
    id: 'points-cash',
    category: 'points',
    q: { ko: '포인트를 돈이나 기프티콘으로 바꿀 수 있나요?', en: 'Can points be exchanged for money or gift cards?' },
    a: {
      ko: '아니요. 포인트는 학원 안에서만 쓰는 칭찬 단위예요. 학원에서 정한 보상(쿠폰 등)으로 활용하세요.',
      en: 'No. Points are an in-class reward unit, not money. Use them with rewards your academy decides (coupons, etc.).',
    },
  },
  {
    id: 'billing-plan',
    category: 'billing',
    q: { ko: '무료와 유료는 무엇이 다른가요?', en: 'What is the difference between free and paid?' },
    a: {
      ko: '무료로는 일부 게임과 기본 기능을 쓸 수 있고, 유료에서는 모든 게임·단어 사전·파닉스·문법·수업 자료실·내 수업을 쓸 수 있어요. 설정 → 결제에서 바꿀 수 있어요.',
      en: 'Free includes some games and basics; paid unlocks all games, dictionary, phonics, grammar, printables and My Lessons. Change it in Settings → Billing.',
    },
    link: '/settings/billing',
  },
  {
    id: 'billing-cancel',
    category: 'billing',
    q: { ko: '구독 해지·결제 실패는 어떻게 하나요?', en: 'How do I cancel or fix a failed payment?' },
    a: {
      ko: '설정 → 결제에서 원장님이 해지할 수 있어요(남은 기간까지는 계속 사용). 결제가 실패하면 화면 위에 안내가 뜨니 카드를 다시 등록해 주세요. 그래도 안 되면 결제 문의를 남겨 주세요.',
      en: 'The owner can cancel in Settings → Billing (you keep access until the period ends). If a payment fails, a notice appears — re-register your card, or send a billing inquiry.',
    },
    link: '/settings/billing',
  },
  {
    id: 'account-teacher',
    category: 'account',
    q: { ko: '다른 선생님을 우리 학원에 초대하려면요?', en: 'How do I invite another teacher?' },
    a: {
      ko: '설정에 있는 학원 초대 코드를 알려 주세요. 선생님이 가입할 때 "선생님으로 합류"에 코드를 넣으면 같은 학원으로 들어와요.',
      en: 'Share the academy invite code from Settings. The teacher enters it under "Join as teacher" when signing up.',
    },
    link: '/settings',
  },
  {
    id: 'account-privacy',
    category: 'account',
    q: { ko: '학생 개인정보는 어떻게 다루나요?', en: 'How is student data handled?' },
    a: {
      ko: '학생 정보는 우리 학원 선생님만 볼 수 있어요. 퀴즈쇼·따라보기에서 학생은 로그인 없이 닉네임만 쓰고, 공유 링크에는 학생 이름·출석·포인트가 들어가지 않아요.',
      en: 'Only teachers in your academy can see student data. Students join quiz shows and follow-along with nicknames only, and share links never include student names, attendance or points.',
    },
  },
];

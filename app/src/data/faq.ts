/**
 * 도움말 · 자주 묻는 질문(2026-09-27). 고객센터가 문의하기 전에 먼저 보여 준다(검색 가능).
 * 기능을 바꾸면 여기 답도 같이 고칠 것. link 는 답과 관련된 화면(누르면 이동).
 */
export type FaqCategory = 'start' | 'lesson' | 'games' | 'words' | 'online' | 'homework' | 'points' | 'billing' | 'account';

export interface FaqItem {
  id: string;
  category: FaqCategory;
  q: { ko: string; en: string };
  a: { ko: string; en: string };
  link?: string;
}

export const FAQ_CATEGORIES: FaqCategory[] = ['start', 'lesson', 'games', 'words', 'online', 'homework', 'points', 'billing', 'account'];

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
    id: 'lesson-canvas-shapes',
    category: 'lesson',
    q: { ko: '슬라이드에 도형·화살표·체크 표시를 넣을 수 있나요?', en: 'Can I add shapes, arrows and check marks to a slide?' },
    a: {
      ko: '"직접 만들기" 슬라이드 편집 화면의 [도형·표시] 버튼을 누르세요. 네모·원·삼각형·별·말풍선·화살표 선 같은 도형과, 손으로 그린 듯한 체크·동그라미·X·밑줄 표시가 있어요. 넣은 뒤 위쪽에서 채우기·테두리 색, 선 굵기, 점선을 바꿀 수 있어요. 글·그림·도형 모두 [위쪽 둥근 손잡이]를 끌거나 숫자 칸에 도 단위로 입력해서 돌릴 수 있고(45도 근처에서는 저절로 딱 붙어요), 투명도를 줄이거나 [잠그기]로 실수로 안 움직이게 하고, 여러 개를 골라 [묶기]로 한 덩어리로 만들 수도 있어요.',
      en: 'In a "Create your own" slide, press [Shapes & marks]. You get shapes (rectangle, circle, triangle, star, speech bubble, arrow line…) and hand-drawn check, circle, cross and underline marks. Set fill, outline, thickness and dashes above. Any item can be rotated (drag the round handle on top or type degrees — it snaps near 45°), made transparent, locked, or grouped with others.',
    },
  },
  {
    id: 'lesson-canvas-motion',
    category: 'lesson',
    q: { ko: '발표할 때 글이나 그림이 클릭할 때마다 하나씩 나오게 할 수 있나요?', en: 'Can items appear one by one when I click while presenting?' },
    a: {
      ko: '네. 슬라이드에서 글·그림·도형을 고르고 위쪽의 [효과] 버튼을 누르세요. 서서히·톡 튀어나오기·커지기·날아오기·훑어 나오기·통통 떨어지기 같은 효과를 고르고, 시작 방식을 정해요: "클릭할 때"(클릭마다 한 단계), "앞과 함께", "앞이 끝나면". 속도와 기다림도 바꿀 수 있고 [미리 보기]로 확인해요. 체크·동그라미·화살표 표시는 "그려지기"가 있어서 펜으로 그리듯 나타나요. 나오는 순서는 효과 창의 목록에서 위·아래 화살표로 바꿔요. 여러 개를 한꺼번에 골라 효과를 주면 한 번 클릭에 같이 나와요. 발표 중에는 클리커·Space·→·화면 클릭으로 한 단계씩 넘기고, 다 나오면 다음 클릭에 다음 슬라이드로 가요(←는 한 단계씩 거둬요).',
      en: 'Yes. Select an item and press [Animation]. Pick an effect (fade, pop, zoom, fly in, wipe, bounce…) and when it starts: on click, with previous, or after previous. Adjust speed and delay and use [Preview]. Marks like checks and circles can "draw" themselves. Reorder with the arrows in the list. While presenting, click / Space / → / a clicker shows one step at a time, then moves to the next slide. ← steps back.',
    },
  },
  {
    id: 'lesson-canvas-cover',
    category: 'lesson',
    q: { ko: '정답을 가렸다가 클릭하면 보여 주고 싶어요. (빈칸 퀴즈)', en: 'I want to hide the answer and reveal it on click.' },
    a: {
      ko: '[도형·표시] → [정답 가리개]를 누르면 파란 네모가 생겨요. 이 네모를 정답 글자 위에 올려 두세요(크기·색은 바꿀 수 있어요). 발표 중에는 네모가 정답을 덮고 있다가 클릭하면 사라져요. 가리개를 여러 개 두면 클릭할 때마다 하나씩 열려요. 효과 창에서 "사라지기"로 직접 만들 수도 있어요.',
      en: 'Press [Shapes & marks] → [Answer cover]. A blue box appears — place it over the answer. While presenting, it hides the answer until you click, then disappears. Use several covers to reveal answers one by one. You can also set any item to "Disappear" in the Animation panel.',
    },
  },
  {
    id: 'lesson-canvas-chars',
    category: 'lesson',
    q: { ko: '슬라이드 글에 체크(✓)·화살표(→)·발음 기호를 넣고 싶어요.', en: 'How do I type ✓, → or phonetic symbols?' },
    a: {
      ko: '편집 화면의 [특수 문자] 버튼을 누르면 체크·도형·화살표·번호·발음 기호(ə æ θ ð ʃ …)·따옴표 묶음이 나와요. 글상자를 고치는 중이면 커서 자리에, 글상자를 골라 두었으면 글 끝에 들어가고, 아무것도 안 골랐으면 새 글상자로 생겨요. 체크가 그려지는 효과를 원하면 대신 [도형·표시]의 체크 표시를 쓰세요.',
      en: 'Press [Symbols] in the editor for checks, shapes, arrows, numbers, phonetic symbols and quotes. They go at the cursor while editing a text box, at the end of a selected text box, or into a new text box. For an animated check, use the check mark from [Shapes & marks].',
    },
  },
  {
    id: 'lesson-sort',
    category: 'lesson',
    q: { ko: '수업이 많아졌어요. 찾거나 정렬할 수 있나요?', en: 'I have many lessons. Can I search or sort?' },
    a: {
      ko: '내 수업 위쪽의 "수업 이름으로 찾기" 칸에 이름 일부를 쓰면 걸러져요. 옆의 [수정일] [만든 날] [이름] 버튼으로 정렬하고, 같은 버튼을 한 번 더 누르면 화살표가 뒤집히면서 반대 순서가 돼요. 고른 정렬은 그 기기가 기억해요. 수업 카드에는 슬라이드 개수만 보이고, 특정 슬라이드부터 발표하려면 수업을 열어 "이 슬라이드부터 발표"를 누르세요.',
      en: 'Type part of a name in "Find a lesson by name". Use [Edited] [Created] [Name] to sort — press the same button again to reverse. Your choice is remembered on this device. To start from a specific slide, open the lesson and press "Present from this slide".',
    },
    link: '/curriculum',
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
    id: 'homework-create',
    category: 'homework',
    q: { ko: '학생에게 온라인 숙제를 내려면 어떻게 하나요?', en: 'How do I give students online homework?' },
    a: {
      ko: '왼쪽 메뉴 "숙제" → [새 숙제 내기]. ① 누구에게(반 전체 또는 몇 명) ② 무엇으로(최근 수업·단어장·영상 장면·지난 오답) ③ 몇 분(5·10·15분 추천 구성, "활동을 직접 정하기"도 가능) ④ 확인 — 4단계예요. 마지막 단계 오른쪽에는 학생이 보는 화면 그대로 미리보기가 있어서 직접 풀어 볼 수 있고, 미리보기는 저장되지 않아요. 활동은 단어 퀴즈·워크시트(고르기·빈칸·순서)·게임(짝 맞추기·글자 섞기·철자)·영상 따라 말하기가 있고, 채점은 서버가 자동으로 해요.',
      en: 'Open Homework → New homework. Four steps: who, material (recent lesson, word list, video scene, past mistakes), how long (5/10/15 min or custom), then confirm. The last step shows the exact student screen you can try — nothing is saved. Activities: word quiz, worksheets, solo games and video shadowing. Grading is automatic on the server.',
    },
    link: '/homework',
  },
  {
    id: 'homework-student',
    category: 'homework',
    q: { ko: '학생은 숙제에 어떻게 들어오나요? 가입해야 하나요?', en: 'How do students open homework? Do they sign up?' },
    a: {
      ko: '가입은 필요 없어요. 숙제를 만들면 반 QR·숙제 번호 6자리·링크가 생겨요. 학생은 링크를 열고(또는 주소창에 /hw) 자기 이름과 PIN 4자리를 넣어요. 숙제 화면의 [보내기]에서 "카톡 메시지 복사"를 누르면 학부모 단톡방에 붙여 넣을 글이 만들어져요. 학생 PIN은 [학생 PIN] 버튼에서 "새 PIN"으로 만들어요(보안 때문에 지금 PIN은 아무도 볼 수 없고, 만든 순간에만 보여서 쪽지로 인쇄할 수 있어요). [학생별 QR 카드 인쇄]로 뽑은 개인 QR 카드는 이름·PIN 없이 찍으면 바로 그 학생으로 시작해요.',
      en: 'No sign-up. A class QR, 6-digit code and link are made. Students open the link (or /hw), type their name and 4-digit PIN. Create PINs under [Student PINs] — they are shown only once when created, and can be printed as slips. Personal QR cards (Print student QR cards) start homework as that student with no name or PIN.',
    },
    link: '/homework',
  },
  {
    id: 'homework-results',
    category: 'homework',
    q: { ko: '숙제 결과는 어디서 보고, 포인트는 어떻게 주나요?', en: 'Where do I see results, and how do I give points?' },
    a: {
      ko: '숙제 카드의 [결과]를 누르면 학생별 상태(안 함·하는 중·완료)·점수·걸린 시간·틀린 낱말과 반에서 많이 틀린 낱말이 나와요(열려 있는 동안 15초마다 저절로 새로 고쳐져요). 위쪽에 "숙제를 끝낸 학생 ○명이 아직 포인트를 안 받았어요"가 뜨면 통장 프리셋을 골라 [○명에게 주기]를 누르세요. 같은 숙제로 두 번 주지 않고, "숙제 완료" 프리셋이면 숙제 캘린더에 자동으로 완료로 남아요. 그날 반 통장을 마감했으면 줄 수 없어요. 안 한 학생에게 보낼 안내문 복사, 이 학생 오답으로 숙제 만들기, 반 복습 숙제 만들기도 여기서 해요.',
      en: 'Press [Results] on a homework card: status, score, time and missed words per student, refreshed every 15 seconds. When finished students have no points yet, pick a passbook preset and press [Give to N]. Never twice for the same homework; a homework preset marks the homework calendar. Not possible after the class passbook is closed for the day.',
    },
    link: '/homework',
  },
  {
    id: 'homework-stats',
    category: 'homework',
    q: { ko: '학생 스탯과 학부모 리포트는 어디서 보나요?', en: 'Where are student stats and the parent report?' },
    a: {
      ko: '세 곳에서 같은 창이 열려요. ① 리포트 메뉴의 [학생 스탯] 탭(반 학생이 이름순으로 한 줄씩) ② 학생관리에서 학생 이름 옆 [스탯] 버튼 ③ 숙제 결과의 [학습 카드]. 창 안에는 스탯 카드(전체 등급과 어휘·듣기·읽기·문장·꾸준함 5가지 그래프), 자세히 보기, 학부모 리포트 탭이 있어요. 등급은 S+·S·A·B·C이고, 문제가 8개 미만인 능력이나 기록이 적은 학생은 "?"로 보여요(읽기는 아직 재는 숙제가 없어 늘 "?"). 학생끼리 순위는 없고 지난 기간의 그 학생과만 비교해요. 학부모 리포트는 A4 한 장으로 인쇄하거나 카톡용 글로 복사할 수 있고, 선생님 한마디는 자동 문장을 고쳐서 보내세요.',
      en: 'The same window opens from three places: the [Student stats] tab in Reports, the [Stats] button beside a student in Students, and [Learning card] in homework results. It has a stat card (grade S+ to C and a 5-ability chart), details, and a parent report you can print on A4 or copy as text. Abilities with fewer than 8 questions show "?". No rankings — only compared with that student’s own previous period.',
    },
    link: '/results',
  },
  {
    id: 'homework-recommend',
    category: 'homework',
    q: { ko: '"맞춤 숙제 추천"은 어떻게 만들어지나요? 자동으로 보내지나요?', en: 'How does "tailored homework" work? Is it sent automatically?' },
    a: {
      ko: '자동으로 보내지지 않아요. 학생마다 최근 기록을 보고 정해진 규칙(AI 아님)으로 골라요: 틀린 낱말 60%·복습할 때가 된 낱말 20%·잘하는 낱말과 새 낱말 20%이고, 틀린 문제와 다른 모양으로 내요. 낱말마다 "왜 골랐는지"가 문장으로 나오고, 활동을 빼거나 학생을 제외하거나 학생을 바꿔 가며 화면을 미리 볼 수 있어요. [확인하고 보내기]를 눌러야 학생마다 개인 QR로만 열리는 숙제가 만들어져요. 기록이 적은 학생은 반 공통 복습으로 골라요.',
      en: 'Never automatic. Rules (not AI) pick words per student: 60% recently missed, 20% due for review, 20% strong or new words, in a different question shape than missed. Reasons are shown; you can drop activities or students and preview each screen. Only [Confirm and send] creates personal-QR homework. Students with few records get a class review.',
    },
    link: '/homework',
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

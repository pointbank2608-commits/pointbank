# 파닉스 게임 클레이 아트 v2

2026-10-27, 사용자 요청으로 파닉스 게임 40종의 목록·실행·결과 화면을 기존 ClassBank 클레이 게임 스타일로 수정했다. 제작은 내장 Imagegen 도구를 사용했다. 기존 `app/public/skins/dig/scene.webp`를 스타일 참고로 제공했다. 게임 글자·단어·숫자·버튼은 이미지에 그리지 않고 HTML로 표시한다.

## 화면과 동작

- 기차 마을, 장난감 공방, 마법 정원, 몬스터 식당, 바닷가 놀이터, 탐험 섬의 배경 6장.
- 기관차·객차·로봇·다리·몬스터·낚싯배·보물상자·공룡·화분·로켓·책·바구니의 투명 소품 12종, 몬스터 대기·생각·기쁨 표정 3종.
- 40종의 세계·소품·반응을 `app/src/lib/phonicsGameVisuals.ts`에서 명시적으로 연결한다. 35개 학습 게임은 기존 문제 엔진을 유지하며, 5개 모험 게임은 자기 테마의 소품을 유지하면서 하위 활동을 진행한다.
- 소리 기차의 객차에는 실제 선택한 음절·글자가 올라간다. 정답이면 객차를 연결하고 기차가 움직인다. 매직 e 다리는 실제 모음과 끝 e 선택에 따라 친구가 건너고 빛난다. 몬스터는 오답 때 생각하고, 정답 단어를 먹은 뒤 기뻐한다. 낚시는 정답 단어 물고기를 끌어 올린다. 로켓은 성공 뒤 출발한다.
- 일반 선택지, 풍선, 바구니, 기억 카드, 글자 타일, 요리 접시, OO/OW 문과 길도 같은 재질로 바꿨다. 정답 선택 대상은 선택 전에 움직이지 않는다.
- 같은 게임·유닛을 마치면 우리 반 마을에 선물 하나가 생긴다. 같은 활동을 다시 마치면 중복 증식하지 않는다. 최근 24개 활동을 **현재 탭의 sessionStorage**에 저장한다. 교사가 새 마을을 시작할 수 있다.
- 일시정지 시 조작과 애니메이션을 멈춘다. 움직임 줄이기 설정에서는 애니메이션 없이 완료 상태를 표시한다.

## 파일과 원본

배포 파일은 `app/public/skins/phonics-v2/`의 `train.webp`, `workshop.webp`, `garden.webp`, `diner.webp`, `coast.webp`, `island.webp`, `props.webp`, `monster-states.webp`이다. 원본 PNG는 로컬 `output/phonics-artwork-v2/originals/`에 보관했다. 원본 보관 경로와 배포 파일의 크기는 같은 폴더 상위의 `asset-manifest.json`에 기록했다.

배경은 WebP quality 86, 투명 소품은 lossless WebP로 형식만 최적화했다. 그림을 코드로 다시 그리거나 배경을 지우지 않았고 생성된 알파를 보존했다. 투명 WebP 검사 도구가 투명 픽셀의 RGB를 노출할 수 있어, 밝은 배경에 합성한 QA 미리보기와 실제 Chrome 화면에서도 확인했다.

다시 최적화하려면 sharp를 사용할 수 있는 환경에서 app 디렉터리 기준 `node scripts/phonics/optimise-game-art.mjs [원본 PNG 디렉터리]`를 실행한다. 외부 런타임의 sharp는 `PHONICS_SHARP_MODULE`로 지정할 수 있다.

## 재제작용 프롬프트

아래는 제작 지시를 공통 조건과 장면별 조건으로 정리한 재사용 프롬프트이다. 각 이미지는 별도 호출로 제작했다.

**공통 배경 조건**

> Match the reference ClassBank handmade clay game scene: a premium pastel matte modeling-clay miniature diorama, rounded sculpted forms, fine tactile clay texture, mint, coral, cream and soft lavender, gentle studio daylight and soft contact shadows. Wide 16:9 landscape. Leave the central 65–70 percent empty for native learning controls and animated game props. Keep small scenic details at the far edges. No words, letters, numerals, logos, watermarks, interface, cards or buttons. No characters or movable play objects in the center. Light birch where wood is used, not dark orange-brown.

| 파일 | 장면별 조건 |
|---|---|
| train | A friendly miniature train village. Small mint and coral station houses and trees at the side edges. A toy railway across the lower 18 percent, a broad empty cream and mint play area above it. No train: the engine and carriages will be overlaid separately. |
| workshop | A tidy clay toy workshop. Cream wall, a light birch worktable, mint pegboard with a few small tools at far left, coral cubbies at far right. Broad empty wall and tabletop center. No central toys or robots. |
| garden | A magical clay garden with lavender sky, rounded mint hills and tiny flowers at the side edges. Pale stone bridge piers at lower corners and an empty central crossing. A little garden gate at far left, small seedlings at far right. No bridge or character in the central play area. |
| diner | A warm miniature clay cafe kitchen in mint and blush. Small oven and utensils at the far left, plates and shelves at the far right. A pale cream counter across the lower quarter. Broad empty center for a separately overlaid friendly monster and food. No character. |
| coast | An open turquoise clay pond and sky with pale clay clouds. Reeds and a little wooden pier at far left, rocks and water lilies at far right. Open water occupies the lower half. No boat, fish or character in the central play area. |
| island | A friendly clay explorer island with soft turquoise sea, pale sandy foreground, rounded mint hills, a small lavender volcano at far left, palm and treasure chest at far right. Broad empty sandy trail in the center. No central character or rocket. |

**props.webp — 투명 소품 아틀라스**

> Create a production game sprite atlas in the same matte handmade clay style as the reference. Transparent background, exact 4 columns by 3 rows, equal square cells. Each complete object centered within its cell with clear padding, no overlap or grid lines. Consistent front three-quarter view, soft contact shadow only, mint/coral/cream palette, no text or symbols. Row 1 left to right: toy locomotive facing right; mint train carriage with a blank cream letter panel; friendly mint robot; lavender arched stone bridge. Row 2: friendly round coral monster with cream horns and large kind eyes; small wooden fishing boat; open wooden treasure chest; friendly mint dinosaur. Row 3: seedling in a cream pot; mint rocket with coral fins; open blank book; empty wicker basket. Keep each object isolated and fully visible.

**monster-states.webp — 투명 표정 아틀라스**

> Use the coral monster in row 2 column 1 of the provided sprite atlas as the exact character reference. Create three front-facing full-body poses in a transparent 3-column by 1-row atlas with equal square cells, consistent scale, clear padding and aligned feet. Preserve its coral matte clay body, cream horns, large kind eyes and small feet. Left: waiting with a friendly hungry open mouth. Middle: gently thinking with head tilted, curious and reassuring, never sad or punitive. Right: joyful with both arms raised after receiving a word snack. No letters, text, objects, frames or background.

## 검증

`app/scripts/phonics/check-games.mjs`는 7,000개 문제 생성 조합, 40종 각 3문제 완료, 40종 데스크톱·390px 모바일 화면, 모든 게임의 성공 반응과 배경, 실제 객차 글자, 대문자·소문자 가독성, 세계 필터, 마을 보상·재플레이 중복 방지·초기화를 확인한다. 일시정지, 첫 시도·도움 점수 구분, Q/X, 검토 중 문장 차단, 음성 실패, 깨진 이미지 대체, 한국어·영어도 확인한다. 브라우저는 가상 교사·학원 데이터로 실행하며 운영 DB 쓰기가 없는지 검사한다.

증거 파일은 `output/phonics-games-v2/`에 저장한다. 실제 전자칠판 하드웨어의 터치와 브라우저별 TTS 음질은 자동 검증 범위에 포함하지 않는다.

기존 5단계·42개 유닛의 단어·표적 철자·소리 규칙과 문장 승인 상태를 유지했다. 학생 계정·숙련도·숙제·포인트·운영 DB에는 변경이 없다. 후속 사용자 요청에 따라 이 디자인 변경을 main 커밋·푸시·자동 운영 배포 대상으로 확정했다.

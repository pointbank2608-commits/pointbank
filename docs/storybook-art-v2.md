# Storybook 게임 아트 v2

내장 **imagegen** 도구로 배경 3종, 몬스터 표정 3종, 탐험가 1종을 제작했다. 게임에서는 로컬 WebP만 읽으며 이미지 생성 API를 호출하지 않는다. 원본 생성물은 기본 생성 폴더에 보존하고, 실제 사용하는 최종 에셋은 프로젝트에 저장했다. WebP 변환 시 캐릭터의 알파 채널을 유지했다.

## 적용 파일

모든 최종 에셋은 `app/public/skins/storybook/`에 있다.

| 파일 | 내용 | 크기 |
|---|---|---|
| `garden-v2.webp` | 숲속 정원 배경 | 1536 × 1024 |
| `river-v2.webp` | 강가·오두막 배경 | 1536 × 1024 |
| `castle-v2.webp` | 파스텔 성 정원 배경 | 1536 × 1024 |
| `monster-idle-v2.webp` | 몬스터 기본 표정, 투명 배경 | 1254 × 1254 |
| `monster-happy-v2.webp` | 눈웃음·하트, 투명 배경 | 1254 × 1254 |
| `monster-hungry-v2.webp` | 입 벌린 표정, 투명 배경 | 1254 × 1254 |
| `explorer-v2.webp` | 탐험가, 투명 배경 | 1024 × 1536 |

일곱 에셋 합계 약 2.3MB. `StoryArt.tsx`가 배경·표정·탐험가 이미지를 렌더링하고 `storybook-art.css`가 그림자·빛·표정 전환을 처리한다. `StoryGame.tsx`에서는 새 그림의 입 위치에 맞춰 드롭 영역을 사용하며, 징검다리의 그라데이션과 대비를 보완했다. 게임 목록은 `game-*-v2.svg` 커버로 연결했다. 커버는 동일한 WebP를 포함하는 SVG 구성이다.

## 최종 제작 프롬프트

### 숲속 정원

Use case: illustration-story. Create a production-quality background ONLY for a premium Korean elementary English learning game, landscape 1536x1024. Style: exquisite warm hand-painted children's storybook illustration, kawaii rounded forms, soft gouache watercolor texture, finely painted foliage, soft volumetric shading, luminous pastel morning light. A magical garden meadow: abundant rounded emerald/mint trees framing LEFT and RIGHT edges, delicate flowers, tiny mushrooms, a winding cream path through grass, layered distant hills, fluffy clouds in pale sky. Palette sky #B8E7F5 mint #B9EAD5 pink #FFC2D6 yellow #FFE6A7 lavender #D8C8FA cream #FFF9EF. Composition intended for interactive UI overlay: upper center 60% is calm open pale sky for a speech bubble, central lower-middle broad uncluttered grass clearing for a large pink monster added separately; flowers and gorgeous detail concentrated at edges and bottom corners. Slightly elevated front-facing view, immersive polished 2D game environment matching high-end children's picture books, rich detail and depth, not flat vector art, not 3D plastic render. NO characters, NO monster, NO text, NO lettering, NO cards, NO UI, NO logos, NO borders. Output a finished full-bleed background artwork.

### 강가

Use case: illustration-story. Production game background, landscape 1536x1024. Premium hand-painted children's picture-book gouache/watercolor art, adorable rounded forms, layered fine foliage and flowers, subtle paper grain, lush detail with soft dimensional shading, bright pastel morning light. A magical storybook river crossing: mint turquoise river starts narrow at CENTER near horizon 45% down, broadens smoothly to cover bottom half, flowing toward viewer. Meadow banks on left and right with big round trees, tiny blossoms and pebbles; a beautiful little peach-roof cottage and a pink pennant near the far RIGHT bank. Rich but soft cyan sky with puffy clouds, distant mint hills, butterflies near side edges. Important layout: upper central 65% is calm pale open sky for English prompt overlay. Broad river surface in central band between 48% and 80% of image must stay open and smooth so interactive stepping stones can be rendered separately. No stepping stones, no bridge, no people, no characters, no text, no logos, no cards or UI. Match palette sky #B8E7F5 mint #B9EAD5 pink #FFC2D6 yellow #FFE6A7 lavender #D8C8FA. Beautiful polished immersive 2D educational game environment, not flat vector, not plastic 3D. Full bleed artwork.

### 성 정원

Use case: illustration-story. Create an exquisite production-quality children's educational game background landscape 1536x1024. A pastel fairytale kingdom garden for a sentence-building castle game. Premium hand-painted gouache picture book illustration, extremely charming soft round architecture, watercolor paper texture, nuanced painterly light and shadow, lush detailed trees, flowers, tiny white daisies, warm sunlit fantasy. Lavender-pink soft blue sky with fluffy cream clouds at upper edges. Beautiful small castles at the far LEFT and far RIGHT with creamy stone walls, rounded windows, blush pink and lavender conical roofs and tiny fluttering pennants. Rounded mint hills in distance, warm grass and a broad tiny-flower meadow clearing in CENTER for interactive blocks added separately. Composition: calm empty pale lavender sky upper middle for game title and English prompt, spacious middle clearing from x25% to75% and y40% to90%, keep castles, trees, little mushrooms and flowers framing side edges. Bottom ground has a soft natural warm cream oval foundation clearing. High visual craftsmanship and soft atmospheric depth. Palette #D8C8FA #B8E7F5 #FFC2D6 #FFE6A7 #B9EAD5 #FFF9EF. NOT flat vector, NOT 3D plastic, no people, no characters, no text, no words, no cards, no interface, no borders. Finished full-bleed 2D artwork.

### 몬스터 기본

Use case: illustration-story. Production transparent character cutout for a premium children's English feeding game. ONE extremely adorable pink baby monster, front view, entire body, centered, isolated on TRUE transparent alpha background. High-end hand-painted children's picture book character, softly painted gouache shading with delicate texture and warm highlights, rounded plump silhouette and tiny arms, broad rounded feet, two small buttery-cream curved horns, three tiny fluffy hair tufts, huge expressive glossy dark cocoa eyes with multiple white catchlights, rosy cheeks and a little pink oval nose. Friendly open mouth centered at x50% y63%, large deep plum mouth cavity about 42% of full character width and 25% of height, two small rounded ivory upper teeth and a coral-pink tongue at bottom, inviting for food cards. Body soft warm pink #FFB1CF shaded raspberry edges, beautiful soft lighting, slight soft fluffy/velvety texture but not furry animal, 2D illustration with substantial visual depth. Cute infant proportions, huge face, harmless and welcoming, NOT scary, NOT creepy, NOT photorealistic, NOT flat vector, NOT glossy plastic 3D. Framing: square canvas 1024x1024, horns at 7% from top, feet at 93%, full silhouette within x10%-90%, no cropping, no props, no letters, no logos, NO opaque background, NO checkerboard. Transparent outside character. Keep mouth placement clear for an interactive mouth drop zone.

### 몬스터 눈웃음

Edit target is the provided transparent pink monster character. Create its HAPPY animation expression with the EXACT SAME character identity, body silhouette, full body framing, horns, hair, hands, feet, painting texture, lighting, colors, mouth location and scale. Change ONLY the eyes to delighted closed crescent smiles and add two small floating soft pink hearts beside the upper shoulders, a joyful satisfied expression. Mouth remains at the same place with same friendly open smile and two teeth, tongue visible. Do not redesign character or move body or resize it. Preserve truly transparent alpha background and no text or floor.

### 몬스터 입 벌리기

Edit target: the provided transparent pink monster. Make its eager HUNGRY mouth-open animation pose while preserving EXACT character identity, body silhouette, canvas framing, horns, hair, hands, feet, gouache texture and lighting. Change ONLY the mouth to open 25 percent WIDER and taller toward the chin, keeping mouth center at the original location, eyes a little more excited and eyebrows raised. The dark plum mouth with small ivory teeth and pink tongue must stay harmless and cute. Keep the monster identical in scale and position; do not add arms or props. Truly transparent background, full body cutout, no text.

### 탐험가

Use case: illustration-story. One adorable young storybook explorer child character, entire body, portrait 1024x1536 composition, isolated TRUE transparent background. Premium hand-painted gouache children's picture-book character, same warm painterly softness as a pastel fairytale game, nuanced watercolor shading and fine cloth texture, not flat vector and not plastic 3D. Oversized rounded head, huge sparkling dark brown eyes, rosy cheeks, tiny nose, joyful smile, soft brown hair under a buttery yellow safari hat with a mint hatband, small yellow shirt, peach shorts, cream socks and round brown ankle boots, tiny caramel backpack. Facing three-quarter toward RIGHT, balanced standing pose ready to hop, both feet visible, arms held slightly out, friendly confident posture, charming elementary-school child proportions. Warm pastel colors #FFE6A7 #B9EAD5 #FFD3B6. Full silhouette fits within x15%-85%, hat at 5% top and boots at 95% bottom. No props in hands, no text, no lettering, no background or landscape, no checkerboard, no floor; preserve transparent alpha outside character.

탐험가 후처리도 내장 imagegen으로 진행했다:

Use case: background-extraction. Edit target: this exact explorer child. Preserve the entire character exactly including face, eyes, hair, hat, outfit, backpack, hands, boots, pose, framing, colors and watercolor details. Remove ALL brown/gold/cream background aura and smoky glow surrounding the silhouette, including between the legs and under the hat. Outside the actual character should be completely transparent alpha with clean antialiased edges. No external cast shadow, no vignette, no ground, no atmospheric haze, no glowing outline. Do not redesign, recolor, crop, or resize the character. True transparent game sprite cutout only.

## 화면 검수

- `output/storybook/*-desktop.png`: 데스크톱
- `output/storybook/*-tablet.png`: 태블릿
- `output/storybook/*-mobile.png`: 모바일
- `output/storybook/art-v2-play-test.log`: 아트 교체 후 플레이 회귀 검사
- `output/storybook/build-art-v2.log`: 전체 빌드

게임 규칙·저장 스키마·교사 콘텐츠는 변경하지 않았다.

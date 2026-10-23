# 완성 파닉스 워크북 6활동 복원 보고 (2026-10-24)

## 구현 결과

CVC·매직 e·4·5단계 완성 워크북은 같은 CvcUnitPages 템플릿으로 Look and Say → Read and Write → Circle the Correct Word / Match → Complete the Word → Color를 제공한다. 기존 mm 치수, 쓰기 칸, Fredoka·Andika, 색상과 2쪽 구성을 유지했다. 그림 부족에 따른 텍스트 전용·색칠 대체 템플릿과 선택 화면의 읽기·쓰기형 배지·집계를 제거했다. 자동 파닉스 워크시트의 독립 활동 메뉴는 변경하지 않았다.

확정 curriculum.json과 legacyWorkbookRefs.json은 변경하지 않았다. 기본·확장 구분, 순서, 기존 수업·숫자 유닛 참조를 유지한다. 배포·커밋·푸시는 하지 않았다.

## 운영 버전과 이미지 저장 위치

- 기준 체크아웃 main 및 origin/main: 4234563f010f7149545183da31e5ab8889dad5db. GitHub의 해당 커밋 Vercel 배포 상태는 성공이었다.
- 서비스: https://pointbank-ten.vercel.app/phonics
- 정상 운영 apple 경로는 /phonics-images/apple.webp, blank는 /word-bank-images/blank.webp였다.
- 운영 clam·fern·them 경로는 이미지가 아닌 SPA HTML을 반환했다. HTTP 200만으로 이미지 존재를 판정하지 않았다.
- 현재 로컬의 새 컬러 그림 16개는 아직 배포하지 않은 변경이다. 기준 커밋과 운영 배포가 일치한다는 것과 로컬 작업 폴더 전체가 운영에 반영되었다는 것은 다르다.
- 현 저장소의 /phonics에는 별도 업로드 UI가 없으며 정적 파일과 공통 words.json의 경로가 기본 자산이다. 공개 DB 0행 결과만으로 사용자 이미지 부재를 결론내리지 않았다.

## 공통 연결 방식

words.json → curriculumEntries의 image_url·lineart_url → 자료 카드 및 모든 완성 워크북으로 연결한다. phonicsMedia.ts에서 DB의 명시적인 외부/새 버전 이미지 URL도 정확한 단어 표기로 병합한다. 대소문자를 정규화하며 배열 인덱스로 연결하지 않는다. 기존 자동 생성 기본 경로는 새 업로드로 오인하지 않는다. 충돌하는 URL은 임의로 선택하지 않는다.

업데이트는 이미지 정보에만 적용한다. 승인 단어·뜻·규칙·순서·저장 수업 원본은 덮어쓰지 않는다. 새 컬러와 선화가 함께 제공되면 같은 쌍을 사용하고, 컬러만 바뀌어 기존 선화의 대상이 맞는지 확인할 수 없으면 완료 처리하지 않는다. 현재 URL의 실제 Image.decode 성공 이후에만 완성 인쇄를 허용한다. 예전 정적 이미지 manifest를 런타임 허용 목록으로 사용하지 않는다.

## 제작 및 재사용

기존 정확한 파일이 있지만 미연결된 대상 컬러 자산: 0개. 다른 단어의 그림을 대체하지 않았다.

새 컬러 16개:
clam, flap, drip, fern, plum, plug, glob, glum, grin, brim, bran, prim, prop, skid, skim, tusk.
저장 위치: app/public/phonics-images/. 프롬프트·참고 원본·생성 기록: app/scripts/phonics/generated-color-cards.json.

4·5단계 기본 단어 170개 중 기존 선화 112개를 재사용하고 새 선화 55개를 제작·연결했다. 컬러 참고 그림을 실제로 확인한 뒤 built-in image_gen으로 개별 검은 윤곽선/흰 배경 선화를 생성했다. 흑백 필터 변환을 사용하지 않았다. 저장 위치: app/public/word-bank-lineart/. 기록과 전체 프롬프트: app/scripts/phonics/generated-lineart-cards.json. 1024×1024 lossless WebP로 저장하며 기존 정상 파일을 덮어쓰지 않았다.

thin은 얇은 종이를 든 아이의 컬러 그림과 기존 연필·굵은 펜 선화가 맞지 않았다. 같은 종이 장면의 thin-v2.webp를 새로 연결하고 원본 thin.webp는 보존했다. thick은 기존 두꺼운 책 그림과 선화를 재사용했다.

## 뜻 오류 원인

thin의 straight 표기는 사용자 DB 덮어쓰기가 아니라 공통 words.json 원본에 들어가 있었다. 초기 SQL 추출이 where id in 목록까지 항목처럼 읽어 인접 영어 단어가 뜻에 들어간 오류다. 확인된 10개만 수정했다:
cat 고양이, jump 뛰다, man 남자, monkey 원숭이, sad 슬픈, shirt 셔츠, song 노래, sun 태양, thin 얇은, yellow 노란색.
thick 두꺼운은 유지했다. 사용자 저장 자료와 DB는 수정하지 않았다.

## 남은 자산

| 단어 | 남은 자료 | 이유 | 영향 |
|---|---|---|---|
| them | 컬러·선화 | 목적격 대명사를 명확히 나타내는 장면 검토 필요. 이전 후보는 검토 파일로만 보관하며 연결하지 않음 | 4단계 44번 th-voiced-b |
| then | 선화 | 기존 단일 아이 장면으로 ‘그다음’의 시간 순서가 드러나지 않음. 의미 장면 검토 후 제작 | 4단계 44번 th-voiced-b |
| term | 선화 | 학교 건물만으로 ‘학기’를 나타내기 어려움. 의미 장면 검토 후 제작 | 5단계 26번 r-er-a |

실제 완료 집계: 4단계 48유닛·105학습 항목 중 47유닛 인쇄 가능, 5단계 32유닛·66학습 항목 중 31유닛 인쇄 가능. fern의 그림·선화는 연결되었으나 같은 유닛 term의 선화가 없어 해당 유닛 전체는 아직 미완성이다. 빠진 단어를 빼거나 대체 활동을 넣어 완료 처리하지 않았다. 상세 목록은 docs/phonics-workbook-asset-audit.md와 선택 화면의 ‘자료 준비 현황’에 있다.

## 검증

- TypeScript 빌드 및 Vite 프로덕션 빌드 통과. Vite의 기존 대형 번들 경고는 남는다.
- 독립 승인 단어표 대조, 순서·기본/확장·저장 유닛 참조 회귀 검사 통과.
- brush의 br=[0,1], sh=[3,4], 매직 e의 분리된 목표 위치 검사 통과. 기존 매직 e Complete the Word의 모음 쓰기 칸 형식은 기준 PDF 그대로 보존했다.
- black/block, blank/blink, clam/clock, glob/glum, fish/dish/brush: 모든 기본 단어와 6활동·Color 복원 검사 통과.
- 자료 카드와 네 종류 워크북에 테스트용 새 버전 컬러·선화 URL을 제공했을 때 카드·미리보기·실제 PDF가 동일 URL 쌍을 사용했다. 사용자 DB에 쓰지 않고 요청을 격리했다.
- 컬러 그림 16개의 자료 카드와 확대 보기 검증 통과. 15개는 완성 유닛에서도 검증했고 fern 유닛은 term 검토 때문에 차단되는 것을 확인했다.
- PC 2열·390px 모바일 1열, 포커스·선택·전체 선택·선택 해제·인쇄 버튼 검증 통과.
- 깨진 이미지 요청 시 유닛 인쇄가 차단되고 깨진 이미지가 인쇄에 남지 않음을 확인.
- 새 선화 55개 모두 1024×1024, 색상 픽셀 비율 0.1% 미만·흰 영역 65% 이상 검사 통과. 개별 생성 결과를 시각 검수했다.
- 4·5단계 완성 78유닛 실제 PDF 156쪽: 모두 A4, 빈 페이지 없음, 영역 넘침 없음.
- CVC·매직 e 기준 2쪽은 기존 PDF와 렌더링 픽셀 차이 0.
- 대표 인쇄 PDF를 PNG로 렌더링해 Color 윤곽선·흰 배경·그림 배치와 하단 여백을 직접 확인했다.
- 독립 자동 워크시트와 기존 문법 워크북 회귀 검증 통과.

검증 기록: output/phonics-six-activities/, output/phonics-color-images/, output/phonics-curriculum/print/ 및 output/pdf/flow-checks.json.

## 주요 수정 파일

- app/src/components/worksheets/CvcWorkbookSheets.tsx
- app/src/pages/CvcWorkbookPage.tsx, PhonicsWorkbookPage.tsx, PhonicsPage.tsx
- app/src/data/phonics/words.json, phonicsCurriculum.ts, phonicsMedia.ts, phonicsWorkbook.ts, phonicsWorkbookTasks.ts, cvcWorkbook.ts
- app/src/lib/api.ts, types.ts, useWorkbookImageChecks.ts, lineartManifest.ts, workbookImageManifest.ts
- app/src/i18n/workbookLocales.ts
- app/scripts/phonics/ 생성 기록·import-lineart.py·검증 스크립트
- app/scripts/workbooks/check-flow.mjs, check-pdfs.py
- 신규 컬러 16개 및 선화 55개

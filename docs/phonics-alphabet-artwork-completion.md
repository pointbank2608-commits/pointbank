# 알파벳 워크북 그림 보완 결과

## 반영 범위

1단계 26유닛·78학습 항목의 컬러와 선화 연결을 확인했다. 공통 데이터 `app/src/data/phonics/words.json`을 수정하므로 자료 → 파닉스와 완성 워크북이 같은 자산을 참조한다. 단어·뜻·유닛·순서는 유지한다. 선화 누락 8개와 bat의 잘못된 선화 연결을 새 선화 9개로 해결했다. 추가 검수에서 top의 컬러가 기준 뜻인 팽이와 달라 컬러도 새로 제작했다.

## 저장 자산

| 단어 | 선화 파일 (`app/public/word-bank-lineart/`) | 확인한 의미 |
|---|---|---|
| axe | axe-alphabet-v1.webp | 도끼 |
| bat | bat-alphabet-v1.webp | 박쥐, 야구방망이 아님 |
| garden | garden-alphabet-v1.webp | 정원 |
| insect | insect-alphabet-v1.webp | 다리 6개의 곤충 |
| question | question-alphabet-v1.webp | 질문하는 아이와 물음표 |
| top | top-alphabet-v2.webp | 팽이 |
| up | up-alphabet-v1.webp | 위를 가리키는 동작 |
| under | under-alphabet-v1.webp | 탁자 아래 고양이 |
| watch | watch-alphabet-v1.webp | 손목시계 |

top 컬러는 `app/public/phonics-images/top-alphabet-v2.webp`이다. 기존 산꼭대기 컬러와 야구방망이 선화 등 원본 파일은 보존했다. 신규 파일은 1024×1024 WebP이며 선화는 흰 배경과 검은 윤곽선으로 제작했다. 컬러를 흑백 필터로 바꾸지 않았다.

도구는 내장 **image_gen**을 사용했다. 각 파일의 정확한 생성 프롬프트, 참고 이미지, 생성 원본과 최종 저장 경로는 `app/scripts/phonics/alphabet-lineart-cards.json`에 있다. 재가져오기:

```powershell
python app/scripts/phonics/import-lineart.py --manifest alphabet-lineart-cards.json
```

## 검증

- 실제 브라우저: 26유닛 모두 준비 완료, 누락 목록 없음. PC·모바일, 선택·해제·전체 선택·키보드·선택 쪽수와 인쇄 확인.
- 전체 인쇄: `output/phonics-print-course/alphabet-all.pdf`가 A4 52쪽. Xx 단독은 2쪽. 활동 제목·텍스트 경계 검사와 54개 렌더 이미지 검수 통과. 빈 페이지·깨진 이미지·잘림 없음.
- 6번 활동은 전체 유닛에서 Color. 신규 선화와 컬러의 대상·의미를 직접 확인했다.
- `check-workbook-navigation.mjs`: 공통 단어·유닛 및 2–5단계 인쇄 내용 회귀 검사 통과.
- `tsc -b`, `vite build` 통과. 빌드의 기존 청크 크기 경고는 남아 있다.
- 1단계 기준 컬러 누락 0개, 선화 누락 0개. 이번 결과를 다른 단계 전체의 자산 완성으로 간주하지 않는다.

사용자의 커밋·푸시·배포 지시에 따라 이번 자산 보완을 별도 커밋으로 반영한다. 운영 배포 상태는 해당 커밋의 Vercel 결과와 운영 화면 검사로 확인한다. 수업 탭 비공개 상태와 다른 진행 중인 게임 작업은 변경하지 않았다.

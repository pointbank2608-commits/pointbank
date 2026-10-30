import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'output/stem-paper-bridges'
rows=json.loads((OUT/'video-candidates.json').read_text(encoding='utf-8'))
priority={'CqYGVW2Eu6Y':1,'eQuW8G2QV_Q':2,'0hThMoHB88w':3,'0KjnJYoIqPA':4,'s236Q1nuWXg':5,'6RA9x4wlnW8':6,'RStgV8mA-gA':7,'5TAIUCYMlIQ':8,'3-xKZKxXuu0':9,'pK-iPwtW4W8':10,'s2Jud7F478I':11,'-rJdVQNy6TY':12}
s='''# ClassBank STEM 영상 재검토 — 22편

조사일: 2026-10-30. 기존 후보를 다시 검색하고 공개 YouTube oEmbed 제목·채널, 공개 플레이어의 길이·임베드 허용 정보를 재확인했다. 22편 모두 확인 시점에 메타데이터 조회 성공, 임베드 허용 true. 기기별 실제 재생이나 전편 음성·자막 검수가 끝났다는 뜻은 아니다. 원본 영상은 다운로드하거나 복제하지 않았다.

## 선정 기준

쉬운 영어로 예상 → 직접 실험·설계 → 눈에 보이는 관찰·수치 측정 → 짧은 영어로 결과 말하기 → 보고서. 영상은 수업 전체가 아니라 관찰과 실험을 돕는 자료다. 표면장력 수업의 시각 구성·8단어·게임·A4 보고서를 재사용하되 주제에 맞게 결과 기록을 바꾼다.

학년·수업 활용·영어 문장은 ClassBank의 자체 제안이다. 원 영상의 대사나 제작사의 권장 학년으로 오해하지 않는다. 길이는 영상 길이이며 실험 완료 시간이 아니다.

## 먼저 제작하기 좋은 12편

| 우선 | 주제·공식 영상 | 채널 | 길이 | ClassBank에서 할 활동 | 영어 표현 | 보고서 초점 |
|---|---|---|---|---|---|---|
'''
selected=sorted([r for r in rows if r['url'].split('v=')[-1] in priority],key=lambda r:priority[r['url'].split('v=')[-1]])
for r in selected:
    n=priority[r['url'].split('v=')[-1]];duration=r['durationSeconds'];length=f'{duration//60}:{duration%60:02d}'
    s+=f"| {n} | [{r['topic']}]({r['url']}) | {r['channel']} | {length} | {r['classbankActivityProposal']} | {r['originalEnglishPattern']} | {r['reportProposal']} |\n"
s+='''
1번 종이 다리를 이번 비교용 샘플로 제작했다. 나머지는 아직 완성 수업으로 등록하지 않았다.

- 종이 헬리콥터 영상은 *Make a Whirlybird from Paper*이며 추의 영향 탐구다. 다른 Mars Helicopter 영상과 혼동하지 않는다. 무게를 비교할 때는 날개·낙하 높이를 고정한다.
- 포일 배 영상은 파도에 버티는 설계 활동까지 포함한다. 초등 기초반은 잔잔한 물에서 하중을 먼저 비교하도록 별도 각색하고 원 영상과 범위를 구분한다.
- 자석: 모든 금속이 붙는다고 가르치지 않는다. 작은 강력 자석을 학생에게 주지 않는다.
- 정전기: 풍선 알레르기와 파편을 관리하고 수업 장소의 습도에 따른 결과 차이를 사전 시험한다.
- 로켓·낙하산·헬리콥터: 얼굴을 향해 발사하지 않고, 높은 곳에 학생을 올리지 않으며 안전한 고정 높이에서 비교한다.
- 물 걷기·씨앗: 여러 시간·여러 날 관찰이 필요할 수 있으므로 미리 준비한 세트와 연속 관찰지를 사용한다.

## 확장 후보 10편

| 주제·공식 영상 | 채널 | 길이 | 필요한 준비 | 수업·보고서 아이디어 | 검토 사항 |
|---|---|---|---|---|---|
'''
for r in rows:
    if r['url'].split('v=')[-1] in priority:continue
    d=r['durationSeconds'];s+=f"| [{r['topic']}]({r['url']}) | {r['channel']} | {d//60}:{d%60:02d} | {r['materials']} | {r['classbankActivityProposal']} / {r['reportProposal']} | {r['note']} |\n"
s+='''
## 선정 분석과 다음 단계

제작 우선순위는 재료 준비, 50분 안의 직접 참여, 시각적 결과, 영어 반복 가능성을 기준으로 판단했다. 영상이 영어 채널이라고 모두 영어 듣기용으로 쓰지는 않는다. SciShow Kids 개념 영상은 짧게 끊어 그림·교사 질문과 함께 사용하고, Science Buddies 실험 영상은 절차 관찰용, TheDadLab 시연은 교사 참고용으로 구분한다.

샘플을 검토하기 전에는 대량 생성하지 않는다. 확인할 항목은 ① 캐릭터·색감·그림 비중 ② 쉬운 영어와 한 화면 정보량 ③ 실제 실험 시간·조건 ④ 예측·측정·비교·재설계 ⑤ 보고서 쓰기 공간 ⑥ 화면·인쇄·게임의 일관성이다. 합격한 기준을 공통 템플릿으로 고정하되 영상·과학·안전·정답 검수는 수업별로 진행한다.

## 원 제작자 자료

- [Science Buddies 종이 다리](https://www.sciencebuddies.org/teacher-resources/lesson-plans/paper-bridge-design)
- [Science Buddies 종이 로켓](https://www.sciencebuddies.org/stem-activities/paper-rocket)
- [Science Buddies 종이 낙하산](https://www.sciencebuddies.org/teacher-resources/lesson-plans/parachutes-forces)
- [Science Buddies 물 걷기](https://www.sciencebuddies.org/blog/walking-water-activity)
- [Science Buddies 공식 영상 검색](https://www.sciencebuddies.org/videos?p=1&s=paper)

개별 메타데이터와 기존 준비물·문형 제안은 `video-candidates.json`에 보관했다. 실제 영상 전편 시청·실험 재현은 미완료로 명시한다. 사이트 운영 등록·배포·자동화는 아직 하지 않았다.
'''
(OUT/'STEM-Video-Shortlist-22.md').write_text(s,encoding='utf-8')
print('Wrote shortlist:',len(rows),'videos')

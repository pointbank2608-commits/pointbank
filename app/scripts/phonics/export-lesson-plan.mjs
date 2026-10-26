import {createServer} from 'vite';
import {writeFile,mkdir} from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true},logLevel:'error'});
try{
 const {courseUnits,lessonSlides,pictureContext}=await server.ssrLoadModule('/src/data/phonicsLessons.ts');
 const units=courseUnits();
 const lines=['# 파닉스 레벨 1–5 수업 편성표','','2026-10-26 사용자 승인 편성. 인쇄용 소유닛과 별도로 수업용 묶음을 관리한다. 단어는 공통 규칙·단어 ID를 참조하며 아래 표는 그 결과를 내보낸 문서이다. 수동 편집용 단어 기준표가 아니다.','','- 레벨 1: 알파벳 3개씩, 마지막 Yy·Zz.','- 레벨 2: 같은 단모음 구간에서 워드 패밀리 3개씩.','- 레벨 3: 승인된 매직 e 패밀리 3개씩, 같은 모음 구간을 넘지 않는다.','- 레벨 4: 확정 8묶음, lk 제외.','- 레벨 5: 승인된 9묶음, oo·ow 등 서로 다른 소리를 합치지 않는다.','','| 레벨 | 수업 유닛 | 규칙 | 단어 항목 | 슬라이드(1차시/2차시/추가) | 기준 |','|---|---|---|---:|---|---|'];
 for(const u of units){const s=lessonSlides(u);lines.push(`| ${u.step} | Unit ${u.number} | ${u.groups.map(g=>g.label).join(' · ')} | ${u.entries.length} | ${[1,2,'extra'].map(n=>s.filter(x=>x.lesson===n).length).join(' / ')} | 사용자 확정 |`);}
 lines.push('','## 규칙별 전체 단어와 순서','');
 for(const u of units){lines.push(`### 레벨 ${u.step} · Unit ${u.number} (${u.entries.length}항목)`,'');for(const g of u.groups)lines.push(`- ${g.label} (${g.entries.length}): ${g.entries.map(e=>e.word).join(' → ')}`);lines.push('');}
 lines.push('## 콘텐츠 검토 상태','','전체 42유닛의 편성은 확정이다. 기존 ABC 및 첨부 레벨 4 Unit 1 문장은 보존했다. 사용자 승인에 따라 나머지 40유닛은 새 사이트워드 1개를 기본으로 초안을 작성했으며, 모든 해당 읽기 슬라이드에 문장 검토 중 표시를 한다. 일반 사용자에게 공개하지 않는다. 규칙의 음가 녹음은 없고 단어·문장은 기존 브라우저 TTS를 사용한다.');
 const readers=['# 유닛별 사이트워드·읽기 문장','','2026-10-26. 기존 확정 두 유닛은 유지하고 나머지는 사용자 요청에 따른 초안이다. 단어는 해당 시점까지의 공통 기준 단어만 참조한다. 기존 ABC 문형의 I·see와 사이트워드 a를 시작 기준으로 삼았다. 문장 검토 전 운영 공개하지 않는다.','','| 레벨 / 유닛 | 상태 | 새 사이트워드 | 복습 사이트워드·기존 문형 | 읽기 문장 |','|---|---|---|---|---|'];
 for(const u of units)readers.push(`| ${u.step} / ${u.number} | ${u.reading.status==='approved'?'기존 확정':'문장 검토 중'} | ${u.reading.newSightWords.join(' · ')||'기존 유지'} | ${u.reading.reviewSightWords.map(w=>w==='i'?'I':w).join(' · ')||'—'} | ${u.reading.sentences.join('<br>')} |`);
 readers.push('','## 검토할 사항','','- 소유·인칭 문장에서는 교사가 그림을 가리키며 사람·소유 맥락을 설명한다. 단순 그림 카드 장면은 실제 소유 관계를 증명하는 사진이 아니다.','- 같은 장면의 단어 그림 위치는 고정하고, 화살표와 문장만 바꾼다. 추가 그림이나 어려운 명사를 넣지 않았다.','- These are fish. 장면에는 같은 어휘 그림 두 개를 배치해 복수 의미를 보여 준다. teeth는 기존 복수 대상을 표현하는 그림을 사용한다.','- them은 관계 그림과 교사 설명을 함께 사용한다. 단독 그림만으로 인칭대명사를 확정하는 문제로 사용하지 않는다.','- 새 문장과 사이트워드는 별도의 승인 전까지 개발 미리보기만 제공한다.');
 await writeFile('../docs/phonics-reader-drafts.md',readers.join('\n')+'\n');
 await writeFile('../docs/phonics-lesson-plan.md',lines.join('\n')+'\n');await mkdir('../output/phonics-lessons',{recursive:true});await writeFile('../output/phonics-lessons/plan.json',JSON.stringify(units.map(u=>({id:u.id,level:u.step,number:u.number,groups:u.groups.map(g=>({ruleId:g.ruleId,label:g.label,entryIds:g.entries.map(e=>e.id),words:g.entries.map(e=>e.word)})),wordCount:u.entries.length})),null,2));
 const entries=units.flatMap(u=>u.entries);const unique=[...new Map(entries.map(e=>[e.wordId,e])).values()];
 await writeFile('../output/phonics-lessons/media-audit.json',JSON.stringify({entryCount:entries.length,uniqueWords:unique.length,colorMissing:entries.filter(e=>!e.image_url).map(e=>({word:e.word,entryId:e.id})),contextReview:unique.filter(e=>pictureContext(e)).map(e=>({word:e.word,wordId:e.wordId,reason:pictureContext(e)})),recordingsMissing:entries.filter(e=>!e.audio?.recordingUrl).map(e=>({word:e.word,entryId:e.id,ruleId:e.ruleId,provider:e.audio?.provider})),phonemeRecordings:'not available; teacher modeling required'},null,2));
 console.log(JSON.stringify({units:units.length,byLevel:[1,2,3,4,5].map(step=>({step,units:units.filter(u=>u.step===step).length,entries:units.filter(u=>u.step===step).reduce((n,u)=>n+u.entries.length,0)}))}));
}finally{await server.close();}

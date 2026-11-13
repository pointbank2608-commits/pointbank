import assert from 'node:assert/strict';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { createLessonUxServer } from './ux-server.mjs';
import { createGuidedServer } from '../homework/guided-server.mjs';

function twoPagePdf() {
  const text = phrase => `BT /F1 30 Tf 48 220 Td (${phrase}) Tj ET`;
  const stream = phrase => `<< /Length ${text(phrase).length} >>\nstream\n${text(phrase)}\nendstream`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    ...[6, 7].map(content => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 300] /Resources << /Font << /F1 5 0 R >> >> /Contents ${content} 0 R >>`),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    stream('ClassBank - first page'), stream('ClassBank - second page'),
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, i) => {
    const offset = body.length;
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  return Buffer.from(body + `xref\n0 8\n0000000000 65535 f \n${offsets.map(offset => String(offset).padStart(10,'0') + ' 00000 n \n').join('')}trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${body.length}\n%%EOF\n`);
}

const lessonServer = await createLessonUxServer(5516);
const homeworkServer = await createGuidedServer(5510);
let browser;
try {
  await Promise.all([lessonServer.listen(), homeworkServer.listen()]);
  browser = await chromium.launch({channel:'chrome', headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  await page.addInitScript(()=>localStorage.setItem('classbank.selectedClassId','a'));
  page.setDefaultTimeout(14000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const colors = node => node.evaluate(button => [getComputedStyle(button).backgroundColor, getComputedStyle(button).color]);

  await page.goto('http://127.0.0.1:5510/homework');
  await page.waitForFunction(() => !!window.__guided);
  await page.evaluate(() => {
    const make = (n, sentence) => Array.from({length:n}, (_, i) => ({
      id: (sentence ? 'sentence-' : 'word-') + i,
      word: sentence ? `We can see car ${i+1}.` : `road ${i+1}`,
      meaning: `연습 자료 ${i+1}`, imageUrl: null,
    }));
    const words = make(25, false), sentences = make(6, true);
    const db = window.__guided;
    db.lessons.push({...db.lessons[0],id:'family',name:'Family Road Trip',word_list_id:null,playlist:[
      {id:'road-vocabulary',kind:'wordshow',words},
      ...sentences.map(card=>({id:card.id,kind:'drill',sentence:card.word,sentenceKo:card.meaning,point:'',drills:[]})),
    ]});
    window.__saveGuided();
  });
  await page.reload();
  await page.getByRole('button',{name:/새 숙제 내기/}).click();
  const composer = page.locator('.hw-composer');
  const next = composer.getByRole('button',{name:'다음',exact:true});
  assert.equal(await next.isDisabled(),true);
  assert.deepEqual(await colors(next),['rgb(237, 241, 246)','rgb(82, 98, 122)']);
  await composer.getByRole('button',{name:'수업에서 가져오기',exact:false}).click();
  await composer.getByLabel('수업 선택',{exact:true}).selectOption('family');
  await composer.getByText('25/25개',{exact:false}).waitFor();
  await composer.getByText('6/6개',{exact:false}).waitFor();
  assert.deepEqual(await colors(next),['rgb(7, 104, 239)','rgb(255, 255, 255)']);
  await next.click();
  assert.equal(await next.isDisabled(),true);
  assert.deepEqual(await colors(next),['rgb(237, 241, 246)','rgb(82, 98, 122)']);
  await composer.getByRole('checkbox',{name:/오늘 수업 복습하기/}).check();
  assert.deepEqual(await colors(next),['rgb(7, 104, 239)','rgb(255, 255, 255)']);
  await next.click();
  const openCalendar = composer.getByRole('button',{name:/마감일/}).first();
  await openCalendar.click();
  const today = composer.locator('[aria-current="date"]');
  const todayValue = await today.getAttribute('aria-label');
  assert.deepEqual(await colors(today),await colors(composer.getByRole('button',{name:'완료',exact:true})));
  await today.click();
  await composer.getByRole('button',{name:'완료',exact:true}).click();
  await today.waitFor({state:'hidden'});
  await openCalendar.click();
  assert.equal(await today.getAttribute('aria-pressed'),'true');
  const alternate = composer.locator('button[aria-label^="20"]:enabled').last();
  let alternateValue = await alternate.getAttribute('aria-label');
  if (alternateValue === todayValue) {
    await composer.getByRole('button',{name:'다음 달'}).click();
    alternateValue = await alternate.getAttribute('aria-label');
  }
  assert.notEqual(alternateValue,todayValue);
  await alternate.click();
  await composer.getByRole('button',{name:'완료',exact:true}).click();
  await alternate.waitFor({state:'hidden'});
  await openCalendar.click();
  assert.equal(await composer.getByRole('button',{name:alternateValue,exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>window.__guided.assignments.length),0);
  console.log('PASS 1: 25 words and 6 sentences, both Next buttons, today and another deadline, zero assignments');

  const base = 'http://127.0.0.1:5516';
  await page.goto(base+'/materials');
  const printOrder = await page.locator('.materials-section').evaluateAll(sections=>sections.map(section=>({
    title:section.querySelector('h2').childNodes[0].textContent,
    names:[...section.querySelectorAll('h3')].map(node=>node.textContent),
  })));
  await page.goto(base+'/wordlists');
  await page.getByRole('button',{name:/공용 단어장/}).first().click();
  const tabs = await page.locator('button').filter({hasText:/사전에서 선택|직접 입력|카테고리로 선택하기|노래 가사로 단어장 만들기/}).allTextContents();
  assert.deepEqual(tabs.map(label=>label.trim().replace(/^music_note\s*/,'')),['사전에서 선택','직접 입력','카테고리로 선택하기','노래 가사로 단어장 만들기']);
  await page.getByRole('textbox',{name:'단어',exact:true}).fill('pear');
  await page.getByRole('textbox',{name:'뜻',exact:true}).fill('배');
  await page.getByRole('button',{name:'추가',exact:true}).click();
  await page.getByRole('button',{name:'사전에서 선택',exact:true}).click();
  await page.getByRole('textbox',{name:/단어나 뜻을 검색/}).fill('apple');
  await page.getByRole('button',{name:/apple 사과/}).click();
  await page.waitForFunction(()=>window.__lessonQA.lists.find(list=>list.id==='shared').items.some(item=>item.word==='apple'));
  assert.equal(await page.evaluate(()=>window.__lessonQA.lists.find(list=>list.id==='shared').items.some(item=>item.word==='pear')),true);
  console.log('PASS word list input tab order, existing manual default, and both add paths');
  await page.goto(base+'/curriculum');
  await page.evaluate(()=>{
    window.__lessonQA.lists.push({...window.__lessonQA.lists[0],id:'words-alt',name:'두 번째 단어장',items:[{id:'blue',word:'blue',meaning:'파랑',image_url:null}]});
    window.__lessonQA.lists.push({...window.__lessonQA.lists[0],id:'words-sentences',kind:'sentence',name:'여행 문장 모음',items:[
      {id:'s1',word:'We drive past the bridge.',meaning:'우리는 다리를 지나갑니다.',image_url:null},
      {id:'s2',word:'We stop at the park.',meaning:'우리는 공원에 들릅니다.',image_url:null},
    ]});
    window.__saveLessonQA();
  });
  await page.reload();
  const lessonCard = page.locator('#lesson-card-lesson-a');
  const edit = () => lessonCard.getByRole('button',{name:'수정',exact:true}).click();
  await edit();
  const form = page.locator('[data-lesson-edit-form]');
  const picker = page.locator('.lesson-activity-picker');
  const open = () => form.getByRole('button',{name:'활동 추가',exact:false}).click();
  const category = name => picker.locator('nav').getByRole('button',{name,exact:false}).click();
  const card = id => picker.locator('.activity-card').filter({has:page.locator(`[data-activity-id="${id}"]`)});
  const close = () => picker.getByRole('button',{name:'닫기',exact:true}).click();
  await open();
  await category('게임·퀴즈');
  const filters = picker.locator('.activity-game-filters button');
  assert.equal(await filters.count(),7);
  assert.deepEqual(await colors(filters.first()),['rgb(7, 91, 223)','rgb(255, 255, 255)']);
  for (const filter of await filters.all()) {
    const label = await filter.innerText();
    await filter.click();
    assert.equal(await picker.locator('.activity-card').count(),Number(label.match(/\d+$/)[0]),label);
  }
  await filters.filter({hasText:/^파닉스/}).click();
  await card('phonicsGame.sound-balloons').locator('.activity-preview-button').click();
  await picker.getByRole('button',{name:'게임 시작',exact:true}).click();
  await picker.locator('[data-phonics-session="sound-balloons"]').waitFor();
  await picker.getByRole('button',{name:/활동 목록으로/}).click();
  await filters.first().click();
  for (const type of ['sentencerocket','tugofwar','wordtrain','tictactoe']) {
    const scene = picker.locator(`[data-game-scene="${type}"] img`);
    assert.match(await scene.getAttribute('src'),new RegExp(type));
  }
  const train = card('game.wordtrain');
  assert.match(await train.innerText(),/샘플/);
  assert.match(await train.innerText(),/문장/);
  for (const [type, target] of [
    ['wordtrain', '.ad-engine img'],
    ['sentencerocket', '.ad-fuel'],
    ['tugofwar', 'img[src$="rope.webp"]'],
    ['tictactoe', '[data-skin-object="cell"]'],
  ]) {
    const gameCard = picker.locator('.activity-card').filter({has:page.locator(`[data-game-scene="${type}"]`)});
    await gameCard.locator('.activity-preview-button').click();
    const native = picker.locator(`[data-native-game-preview="/games/${type}"]`);
    if (type === 'wordtrain' || type === 'sentencerocket') {
      await native.getByRole('button',{name:'게임 시작',exact:true}).click();
    }
    await native.locator(target).first().waitFor();
    if (type==='tictactoe') assert.equal(await native.locator(target).count(),9);
    await picker.getByRole('button',{name:/활동 목록으로/}).click();
  }
  await close();
  await form.locator('select').first().selectOption('words-sentences');
  await open();
  await category('게임·퀴즈');
  assert.match(await train.innerText(),/내 자료 적용/);
  assert.match(await train.innerText(),/bridge/);
  await train.locator('.activity-preview-button').click();
  const nativeTrain = picker.locator('[data-native-game-preview="/games/wordtrain"]');
  await nativeTrain.getByRole('button',{name:'게임 시작',exact:true}).click();
  await nativeTrain.getByText('bridge.',{exact:true}).first().waitFor();
  await picker.getByRole('button',{name:/활동 목록으로/}).click();
  await close();
  await form.locator('select').first().selectOption('words-a');
  await open();
  await category('게임·퀴즈');
  const balloon = card('game.balloonpop');
  assert.match(await balloon.innerText(),/내 자료 적용/);
  await balloon.locator('.activity-preview-button').click();
  const nativeBalloon = picker.locator('[data-native-game-preview="/games/balloonpop"]');
  await nativeBalloon.getByRole('button',{name:'게임 시작',exact:true}).click();
  await nativeBalloon.locator('.ad-balloon').first().waitFor();
  assert.match(await nativeBalloon.innerText(),/apple 뜻/);
  await picker.getByRole('button',{name:/활동 목록으로/}).click();
  await balloon.locator('[data-activity-id]').click();
  await picker.waitFor({state:'hidden'});
  await open();
  await card('game.balloonpop').locator('.activity-preview-button').click();
  await nativeBalloon.getByRole('button',{name:'게임 시작',exact:true}).click();
  await nativeBalloon.locator('.ad-balloon').first().waitFor();
  await picker.getByRole('button',{name:/활동 목록으로/}).click();
  console.log('PASS 2 and 6: real game preview from games and recent, scene covers, all seven filters and counts');

  await category('활동지');
  const actualSections = await picker.locator('.activity-list h4').evaluateAll(els=>els.map(heading=>({
    title:heading.textContent,
    names:[...heading.parentElement.querySelectorAll('.activity-card-main')].filter(btn=>!btn.dataset.activityId.startsWith('worksheet.')).map(btn=>btn.getAttribute('aria-label')),
  })));
  assert.deepEqual(actualSections,printOrder);
  await category('단어·문장 학습');
  await card('learn.wordShow').locator('[data-activity-id]').click();
  await open();
  await category('단어·문장 학습');
  await card('learn.study').locator('[data-activity-id]').click();
  const thumbs = form.locator('[data-slide-id]');
  await thumbs.nth(2).getByText('apple',{exact:true}).waitFor();
  await thumbs.nth(3).getByText('apple',{exact:true}).waitFor();
  await form.locator('select').first().selectOption('words-alt');
  await thumbs.nth(2).getByText('blue',{exact:true}).waitFor();
  await thumbs.nth(3).getByText('blue',{exact:true}).waitFor();
  await thumbs.nth(2).click();
  const detail = form.locator('[data-lesson-slide-detail]');
  await detail.getByRole('button',{name:'이 슬라이드만 고르기',exact:true}).click();
  await detail.locator('select').filter({has:page.locator('option[value="words-a"]')}).first().selectOption('words-a');
  await detail.getByRole('button',{name:/^ant(?:\s|$)/}).first().click();
  await thumbs.nth(2).getByText('ant',{exact:true}).waitFor();
  await detail.getByText('ant',{exact:true}).first().waitFor();
  await thumbs.nth(3).getByText('blue',{exact:true}).waitFor();
  console.log('PASS 3 and 4: word and flashcard thumbnails follow the lesson and slide-specific lists; print group and order match');

  await form.locator('select').first().selectOption('words-a');
  async function addLightning(group) {
    await open();
    await category('게임·퀴즈');
    await picker.locator('.activity-game-filters').getByRole('button',{name:group}).click();
    await card('game.lightning').locator('[data-activity-id]').click();
  }
  await addLightning(/^단어/);
  await detail.getByRole('button',{name:'문장 직접 입력',exact:true}).click();
  await detail.getByRole('textbox',{name:'문장 직접 입력',exact:true}).fill('Pete adds cheese.');
  await detail.getByRole('button',{name:'이 슬라이드에 문장 적용',exact:true}).click();
  await detail.getByText('Pete adds cheese.',{exact:true}).first().waitFor();
  await addLightning(/^문장/);
  await detail.getByRole('combobox',{name:'문장 모음 불러오기',exact:true}).selectOption('words-sentences');
  await detail.getByText(/We (drive past the bridge|stop at the park)/).first().waitFor();
  await addLightning(/^단어/);
  await detail.getByRole('combobox',{name:'이 슬라이드 단어장',exact:true}).selectOption('words-alt');
  await detail.getByText('blue',{exact:true}).first().waitFor();

  await page.route('https://i.ytimg.com/**', route=>route.abort());
  await open();
  await category('영상·이미지·웹');
  const videoCard=card('media.video');
  await videoCard.getByText('Sample classroom film',{exact:true}).waitFor();
  assert.match(await videoCard.innerText(),/샘플.*영상 선택 필요/s);
  await videoCard.locator('.activity-preview-button').click();
  await picker.locator('[data-teaching-video]').getByText('Sample classroom film',{exact:true}).waitFor({state:'attached'});
  await picker.getByRole('button',{name:/활동 목록으로/}).click();
  await videoCard.locator('[data-activity-id]').click();
  const videoLink=detail.getByRole('textbox',{name:'유튜브 주소',exact:true});
  for(const [id,title] of [['abcdefghijk','Selected film A'],['12345678901','Selected film B']]){
    await videoLink.fill('https://youtu.be/'+id);
    await detail.getByRole('textbox',{name:'영상 제목',exact:true}).fill(title);
    await open();
    await category('영상·이미지·웹');
    await videoCard.getByText(title,{exact:true}).waitFor();
    assert.match(await videoCard.innerText(),/내 자료 적용/);
    await videoCard.locator('img').waitFor({state:'detached'});
    assert.match(await videoCard.innerText(),/play_arrow/);
    await close();
  }

  await open();
  await category('단어·문장 학습');
  assert.equal(await picker.locator('[data-activity-id^="learn.rainbow"]').count(),0);
  await picker.getByRole('textbox',{name:/활동을 찾/}).fill('무지개 문법');
  assert.equal(await picker.locator('[data-activity-id^="learn.rainbow"]').count(),0);
  await category('단어·문장 학습');
  await card('learn.stem').locator('[data-activity-id]').click();
  await picker.getByText('Why Does Water Stick Together?',{exact:true}).waitFor();
  await picker.getByText(/Elementary Grade 3.*Elementary English/).waitFor();
  await picker.getByRole('button',{name:'미리보기',exact:true}).click();
  await picker.getByText('1 / 17',{exact:true}).waitFor();
  await picker.getByRole('button',{name:'다음',exact:true}).click();
  await picker.getByText('2 / 17',{exact:true}).waitFor();
  await picker.getByRole('button',{name:'내 수업에 추가',exact:true}).click();
  await detail.getByText('SCIENCE LAB · Surface Tension',{exact:true}).first().waitFor({state:'attached'});

  await open();
  await category('활동지');
  await card('worksheet.list').locator('[data-activity-id]').click();
  const listThumb=thumbs.filter({hasText:'단어 리스트'}).first();
  const replacementId=await listThumb.getAttribute('data-slide-id');
  const changeKind=form.getByRole('button',{name:'종류 바꾸기'});
  await changeKind.click();
  const change=page.getByRole('dialog',{name:'활동지 바꾸기'});
  const replacementGrid=change.locator('.worksheet-replacement-grid').first();
  assert.equal(await replacementGrid.evaluate(grid=>getComputedStyle(grid).gridTemplateColumns.split(' ').length),2);
  const pictureCard=change.getByRole('button',{name:/그림 단어카드/}).first();
  await pictureCard.locator('div[aria-hidden]').click();
  assert.equal(await pictureCard.getAttribute('aria-pressed'),'true');
  await change.getByRole('button',{name:'× 닫기'}).click();
  assert.ok(await changeKind.evaluate(button=>document.activeElement===button));
  await changeKind.click();
  await change.getByRole('button',{name:'전체 활동지'}).click();
  const scroll=change.locator('.worksheet-replacement-scroll');
  await scroll.evaluate(node=>{node.scrollTop=node.scrollHeight;});
  await change.getByRole('button',{name:'× 닫기'}).waitFor();
  await change.getByRole('button',{name:'같은 단어장'}).click();
  await page.setViewportSize({width:390,height:760});
  assert.equal(await replacementGrid.evaluate(grid=>getComputedStyle(grid).gridTemplateColumns.split(' ').length),1);
  assert.equal(await scroll.evaluate(node=>node.scrollWidth<=node.clientWidth+1),true);
  await scroll.evaluate(node=>{node.scrollTop=node.scrollHeight;});
  await change.getByRole('button',{name:'취소',exact:true}).waitFor();
  await page.setViewportSize({width:1440,height:1000});
  await pictureCard.click();
  await change.getByRole('button',{name:'이 활동지로 바꾸기',exact:true}).click();
  await form.locator(`[data-slide-id="${replacementId}"]`).getByText('그림 단어카드').waitFor();
  await open();
  await category('활동지');
  await card('worksheet.fillBlank').locator('[data-activity-id]').click();
  await detail.getByText('Missing Letters',{exact:true}).first().waitFor();
  await detail.getByRole('button',{name:'다음 쪽',exact:true}).click();
  await detail.getByText(/^2 \/ \d+$/).waitFor();
  await detail.getByRole('button',{name:'활동지 바꾸기',exact:true}).click();
  await change.getByRole('button',{name:/선 잇기/}).first().click();
  await change.getByRole('button',{name:'취소',exact:true}).click();
  await detail.getByText('Missing Letters',{exact:true}).first().waitFor();
  await detail.getByRole('button',{name:'활동지 바꾸기',exact:true}).click();
  await change.getByRole('button',{name:/선 잇기/}).first().click();
  await change.getByRole('button',{name:'이 활동지로 바꾸기',exact:true}).click();
  await detail.getByRole('button',{name:'활동지 설정',exact:true}).click();
  await detail.getByRole('complementary',{name:'활동지 설정'}).waitFor();
  const worksheetId=await thumbs.filter({hasText:/선 잇기/}).first().getAttribute('data-slide-id');
  console.log('PASS video sample and fallback, release activity filter, Ready STEM preview and add, worksheet first page and replacement');

  await open();
  await category('영상·이미지·웹');
  const input = picker.locator('input[type=file]');
  const chooser = page.waitForEvent('filechooser');
  await card('media.pdf').locator('[data-activity-id]').click();
  assert.ok(await input.count());
  await (await chooser).setFiles({name:'Two-page lesson.pdf',mimeType:'application/pdf',buffer:twoPagePdf()});
  await picker.waitFor({state:'hidden'});
  const pdfThumb = thumbs.filter({hasText:'Two-page lesson.pdf'});
  assert.equal(await pdfThumb.count(),1);
  await pdfThumb.locator('img').waitFor();
  await form.getByRole('button',{name:'저장',exact:true}).click();
  await form.waitFor({state:'hidden'});
  const lightningSources = await page.evaluate(() => {
    const db = window.__lessonQA;
    return db.lessons.find(row=>row.id==='lesson-a').playlist.filter(slide=>slide.gameType==='lightning').map(slide=>({
      id:slide.id, words:db.templates.find(t=>t.id===slide.templateId).items.map(item=>item.label),
    }));
  });
  assert.deepEqual(lightningSources.map(source=>source.words),[
    ['Pete adds cheese.'],['We drive past the bridge.','We stop at the park.'],['blue'],
  ]);
  await page.reload();
  await edit();
  const savedSlides=await page.evaluate(()=>window.__lessonQA.lessons.find(row=>row.id==='lesson-a').playlist);
  const stemSlides=savedSlides.filter(slide=>slide.stemMeta?.sourceId==='surface-tension-v1');
  assert.equal(stemSlides.length,17);
  assert.equal(savedSlides.find(slide=>slide.id===worksheetId).worksheetTab,'match');
  assert.equal(savedSlides.find(slide=>slide.id===replacementId).worksheetTab,'card');
  await form.locator(`[data-slide-id="${worksheetId}"]`).click();
  await detail.getByText(/수업 단어장 · 9개/).waitFor();
  await form.getByRole('button',{name:/이 슬라이드부터 발표/}).click();
  await page.waitForURL(/\/materials\/worksheet/);
  await page.getByText(/Match/i).first().waitFor();
  await page.goto(base+'/curriculum');
  await edit();
  await form.locator(`[data-slide-id="${stemSlides[0].id}"]`).click();
  await form.getByRole('button',{name:/이 슬라이드부터 발표/}).click();
  await page.waitForURL(new RegExp(stemSlides[0].id));
  await page.locator('[data-lesson-runner-bar]').getByRole('button',{name:'다음 활동',exact:true}).click();
  await page.waitForURL(new RegExp(stemSlides[1].id));
  console.log('PASS Ready STEM and replaced worksheet save, reopen and present');
  await page.goto(base+'/curriculum');
  await edit();
  for (const source of lightningSources) {
    await form.locator(`[data-slide-id="${source.id}"]`).click();
    await form.getByRole('button',{name:/이 슬라이드부터 발표/}).click();
    await page.waitForURL(/\/games\/lightning/);
    await page.getByText(new RegExp(source.words.map(word=>word.replace(/[.]/g,'\\.')).join('|'))).first().waitFor();
    await page.goto(base+'/curriculum');
    await edit();
  }
  console.log('PASS Lightning direct sentence, sentence list, and slide word list persist and appear during presentation');
  await pdfThumb.locator('img').waitFor();
  await pdfThumb.click();
  await form.getByRole('button',{name:/이 슬라이드부터 발표/}).click();
  await page.waitForURL(/\/curriculum\/lesson-a\/slide\//);
  const pdf = page.locator('[data-lesson-pdf-view]');
  await pdf.getByText('1 / 2',{exact:true}).waitFor();
  const pixels = () => pdf.locator('canvas').evaluate(canvas => canvas.toDataURL());
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-lesson-pdf-view] canvas');
    return canvas && canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((channel,index)=>index%4===0 && channel>0 && channel<255);
  });
  const firstPage = await pixels();
  await pdf.getByRole('button',{name:'다음 쪽',exact:true}).click();
  await pdf.getByText('2 / 2',{exact:true}).waitFor();
  await page.waitForFunction(previous => {
    const canvas = document.querySelector('[data-lesson-pdf-view] canvas');
    return canvas && canvas.toDataURL() !== previous && canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((channel,index)=>index%4===0 && channel>0 && channel<255);
  },firstPage);
  await pdf.getByRole('button',{name:'확대',exact:true}).click();
  await pdf.getByText('125%',{exact:true}).waitFor();
  await pdf.getByRole('button',{name:'PDF 전체화면',exact:true}).click();
  await page.waitForFunction(()=>document.fullscreenElement?.hasAttribute('data-lesson-pdf-view'));
  await pdf.getByRole('button',{name:'전체화면 닫기',exact:true}).click();
  assert.deepEqual(errors,[]);
  console.log('PASS 5: two-page PDF upload, one slide, thumbnail, save, reload, presentation paging, zoom, and fullscreen');
} finally {
  await browser?.close();
  await Promise.all([lessonServer.close(),homeworkServer.close()]);
}

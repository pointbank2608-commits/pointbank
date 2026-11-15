import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/playwright/index.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = new URL('../../../output/library-video-template/', import.meta.url);
const origin = 'http://localhost:5198';
const id = 'O37zFRCQhEQ';
const sourceCoverage = JSON.parse(await readFile(new URL('../../src/data/caillouVideoCourse.json', import.meta.url), 'utf8'));
const sourceClips = [...sourceCoverage.stories.flatMap(story =>
  story.scenes.flatMap(scene => [...(scene.before ?? []), scene])), ...sourceCoverage.closing];
let endOfPrevious = 0;
for (const clip of sourceClips) {
  assert.ok(Math.abs(clip.start - endOfPrevious) < 0.00001, clip.title);
  assert.ok(clip.end > clip.start, clip.title);
  for (const line of clip.lines ?? []) assert.ok(line.start >= clip.start && line.end <= clip.end && line.end > line.start, line.text);
  endOfPrevious = clip.end;
}
assert.equal(endOfPrevious, sourceCoverage.coverage.duration);
const libraryClip = {
  id: '0ca33141-ab1b-40bb-b361-8be0ff158da6', youtube_id: id, series: 'Caillou',
  title: 'Caillou Goes Ice Skating', start_sec: 12.8, end_sec: 223.6, hidden: false, tags: [], words: [], level: 1,
  summary: 'Ice skating', script: '[0:13.1-0:16.55] Dad: It is slippery. | 미끄러워요', pack: {},
};
const otherClip = {
  ...libraryClip, id: 'another-clip', title: 'Library practice fixture', start_sec: 0, end_sec: 20,
  script: ['I like fresh apples.', 'Can you help me?', 'Please come in.', 'Please sit here.', 'Take your time.']
    .map((line, i) => '[0:' + String(i * 3).padStart(2, '0') + '-0:' + String(i * 3 + 2).padStart(2, '0') + '] ' + line + ' | 연습 표현').join('\n'),
  pack: { words: [{ word: 'apples', meaning: '사과' }, { word: 'apple', meaning: '사과' }] },
};
const compiled = await build({
  root, logLevel: 'error',
  build: { write: false, rollupOptions: { input: root + 'scripts/solo/video-template.html' } },
  plugins: [{
    name: 'library-preview-no-db',
    enforce: 'pre',
    load(id) {
      if (id.replaceAll('\\', '/').endsWith('/src/lib/supabase.ts')) return `export const supabase = {
        from(table) {
          const query = { select: () => query, order: () => query,
            then: resolve => Promise.resolve({ data: table === 'video_clips' ? ${JSON.stringify([libraryClip, otherClip])} : [], error: null }).then(resolve) };
          return query;
        }
      };`;
    },
  }],
});
const bundles = new Map(compiled.output.map(file => ['/' + file.fileName, file.type === 'chunk' ? file.code : file.source]));
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });

try {
  await checkVideoFlow();
} finally {
  await browser.close();
}

async function checkVideoFlow() {
  await mkdir(output, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 920 }, permissions: ['microphone'] });
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  await page.route(origin + '/**', route => {
    const path = new URL(route.request().url()).pathname;
    const asset = bundles.get(path);
    if (asset === undefined) return route.fulfill({ status: 404 });
    const contentType = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html';
    return route.fulfill({ contentType, body: asset });
  });
  if (process.argv.includes('--readiness')) {
    await page.addInitScript(() => {
      window.YT = {
        Player: class {
          constructor(_elementId, options) {
            window.pendingVideoReady = options.events.onReady;
          }
          destroy() {}
        },
        PlayerState: { ENDED: 0, PLAYING: 1 },
      };
    });
    await page.clock.install();
    await page.goto(origin + '/scripts/solo/video-template.html?library&student&short&step=1');
    await page.waitForFunction(() => typeof window.pendingVideoReady === 'function');
    const play = page.getByRole('button', { name: '원본 재생', exact: true });
    const next = page.getByRole('button', { name: '다 들었어요', exact: true });
    await play.waitFor();
    assert.equal(await play.isDisabled(), true);
    assert.equal(await next.isDisabled(), true);
    await page.clock.fastForward(12500);
    await page.getByRole('alert').getByText('원음을 재생하지 못했어요.', { exact: false }).waitFor();
    assert.equal(await next.isDisabled(), true);
    await page.evaluate(() => window.pendingVideoReady());
    assert.equal(await play.isEnabled(), true);
    assert.equal(await next.isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log('Video readiness passed: stalled initialization reports the error; late readiness enables playback without completing the activity.');
    return;
  }
  const click = (name, timeout = 16000) => page.getByRole('button', { name, exact: true }).click({ timeout });
  const frameSelector = 'iframe[src*="/embed/' + id + '"]';
  const player = async () => {
    const frame = await (await page.locator(frameSelector).elementHandle()).contentFrame();
    await frame.locator('video').waitFor({ state: 'attached', timeout: 12000 });
    return frame;
  };
  async function playAndCheck(label, start, end, rate = 1) {
    const button = page.getByRole('button', { name: label, exact: true });
    await button.waitFor();
    const frame = await player();
    await frame.evaluate(speed => {
      const video = document.querySelector('video');
      window.lessonPlayback = null;
      video.addEventListener('playing', () => {
        window.lessonPlayback = { start: video.currentTime, muted: video.muted };
        if (speed > 1) video.playbackRate = speed;
      }, { once: true });
    }, rate);
    await button.click();
    await frame.waitForFunction(() => window.lessonPlayback && document.querySelector('video').paused);
    const actual = await frame.evaluate(() => ({ ...window.lessonPlayback, end: document.querySelector('video').currentTime }));
    assert.equal(actual.muted, false);
    assert.ok(Math.abs(actual.start - start) < 0.23, JSON.stringify(actual));
    // Faster playback stretches the same browser polling interval over more media time.
    assert.ok(Math.abs(actual.end - end) < (end === sourceCoverage.coverage.duration ? 0.7 : 0.23 * rate), JSON.stringify(actual));
    return actual;
  }

  async function practiceExpression(word, meaning) {
    await page.getByRole('button', { name: word }).waitFor();
    await page.getByText(meaning, { exact: true }).waitFor();
    await click('따라 말했어요');
  }

  async function practiceShadowing(start, end, sentence) {
    await page.locator('main').getByText('영상 속 목소리를 들으면서 한 박자 뒤에 따라 말해요.', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-source-caption]').count(), 0);
    assert.equal(await page.getByRole('button', { name: '자막 켜기' }).count(), 0);
    assert.equal(await page.getByText(sentence, { exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '쉐도잉을 마쳤어요', exact: true }).isDisabled(), true);
    const timing = await playAndCheck('쉐도잉 시작', start, end);
    assert.equal(await page.getByText(sentence, { exact: true }).count(), 0);
    return timing;
  }

  async function checkRecapWords(pairs) {
    const recap = page.locator('main');
    for (const [index, [word, meaning]] of pairs.entries()) {
      await recap.getByText('뜻에 맞는 영어를 골라요', { exact: true }).waitFor();
      await recap.getByText(meaning, { exact: true }).waitFor();
      if (index === 0) {
        const wrong = recap.getByRole('button', { name: pairs[1][0], exact: true });
        await wrong.click();
        assert.equal(await wrong.isDisabled(), true);
      }
      await click(word);
      await recap.getByText('잘했어요! 👏', { exact: true }).waitFor();
      await click('다음');
    }
  }

  async function checkRecapSentence(start, end, sentence) {
    await practiceShadowing(start, end, sentence);
    await click('쉐도잉을 마쳤어요');
    const recap = page.locator('main');
    await recap.getByRole('button', { name: new RegExp(sentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).waitFor();
    await click('읽었어요');
    const words = sentence.split(/\s+/);
    for (const word of words) {
      await recap.getByRole('button', { name: word, exact: true }).last().click();
    }
    await click('확인');
    await recap.getByText('잘했어요! 👏', { exact: true }).waitFor();
    await click('다음');
  }

  await page.goto(origin + '/scripts/solo/video-template.html?library&short', { waitUntil: 'domcontentloaded' });
  const previousStep = page.getByRole('button', { name: /이전 단계/ });
  const nextStep = page.getByRole('button', { name: /다음 단계/ });
  await nextStep.click();
  await nextStep.click();
  await page.getByText('아빠는 왜 조심하라고 했나요?', { exact: true }).waitFor();
  await previousStep.click();
  await page.getByText('아빠가 조심하라고 해요', { exact: true }).waitFor();
  await previousStep.click();
  assert.equal(await previousStep.isDisabled(), true);
  await click('시작하기');
  await page.getByText('아빠가 조심하라고 해요', { exact: true }).waitFor();
  const firstDialogue = await playAndCheck('원본 재생', 12.8, 19.55);
  await click('다 들었어요');
  await page.getByText('아빠는 왜 조심하라고 했나요?', { exact: true }).waitFor();
  assert.equal(await page.locator(frameSelector).count(), 0);
  await click('힌트 보기');
  const hintFrame = await player();
  await hintFrame.waitForFunction(() => {
    const video = document.querySelector('video');
    return !video.paused && video.currentTime >= 13 && video.currentTime < 14;
  });
  const hintStart = await hintFrame.locator('video').evaluate(video => ({ time: video.currentTime, muted: video.muted }));
  assert.equal(hintStart.muted, false);
  assert.ok(Math.abs(hintStart.time - 13.1) < 0.8, JSON.stringify(hintStart));
  await hintFrame.waitForFunction(() => document.querySelector('video').paused);
  const hintEnd = await hintFrame.locator('video').evaluate(video => video.currentTime);
  assert.ok(Math.abs(hintEnd - 16.55) < 0.23, String(hintEnd));
  assert.equal(await page.locator('[data-source-caption]').count(), 0);
  await click('미끄러워서');
  await page.getByText('잘했어요! 👏', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '근거 한 문장 다시 듣기' }).count(), 0);
  await click('다음');

  await practiceExpression(/slippery/, '미끄러운');
  await practiceExpression(/be careful/, '조심해');
  const firstShadowing = await practiceShadowing(13.10, 16.55, "It's slippery out there, so be careful, okay?");
  await click('쉐도잉을 마쳤어요');

  await page.getByText('카이유가 혼자 해 보겠다고 해요', { exact: true }).waitFor();
  const secondDialogue = await playAndCheck('원본 재생', 31.45, 44.6);
  await click('다 들었어요');
  await page.getByText('카이유는 어떻게 배우고 싶다고 했나요?', { exact: true }).waitFor();
  assert.equal(await page.locator(frameSelector).count(), 0);
  assert.equal(await page.getByRole('button', { name: '자막 켜기' }).count(), 0);
  const answer = page.getByRole('button', { name: '혼자서', exact: true });
  await click('친구와 같이');
  await page.getByText('답의 단서가 되는 문장만 다시 들어 봐요.', { exact: true }).waitFor();
  assert.equal(await answer.isDisabled(), true);
  assert.equal(await page.locator('[data-source-caption]').count(), 0);
  await click('자막 켜기');
  const caption = page.locator('[data-source-caption]');
  assert.equal(await caption.textContent(), 'I want to learn all by myself.');
  assert.equal(await answer.isDisabled(), true);
  await click('자막 끄기');
  assert.equal(await caption.count(), 0);
  await click('자막 켜기');
  await page.screenshot({ path: fileURLToPath(new URL('retry-one-line.png', output)) });
  const evidenceReplay = await playAndCheck('근거 한 문장 다시 듣기', 38.62, 41.27);
  assert.equal(await caption.textContent(), 'I want to learn all by myself.');
  await answer.click();
  await page.getByText('잘했어요! 👏', { exact: true }).waitFor();
  await click('다음');

  await practiceExpression(/by myself/, '혼자서');
  await practiceExpression(/I want to/, '나는 …하고 싶어요');

  const firstChunk = await playAndCheck('이 부분 듣기', 38.62, 39.84);
  await page.getByText('I want to learn', { exact: true }).waitFor();
  await click('따라 말했어요');
  const secondChunk = await playAndCheck('이 부분 듣기', 39.82, 41.27);
  await page.getByText('all by myself.', { exact: true }).waitFor();
  await page.getByText('나 혼자서 배우고 싶어요.', { exact: true }).waitFor();
  await click('따라 말했어요');

  const shadowing = await practiceShadowing(38.62, 41.27, 'I want to learn all by myself.');
  await page.screenshot({ path: fileURLToPath(new URL('shadowing.png', output)) });
  await click('쉐도잉을 마쳤어요');

  await page.getByText('Do you want me to help you ride your bike?', { exact: true }).waitFor();
  await click('다음');
  assert.equal(await page.getByText('I want to ride all by myself.', { exact: true }).count(), 0);
  await click('마이크 켜기');
  await click('녹음하기');
  await page.waitForTimeout(450);
  await click('녹음 끝내기');
  await page.locator('audio[src^="blob:"]').waitFor();
  await click('예시 답변 보기');
  await page.getByText('I want to ride all by myself.', { exact: true }).waitFor();
  await page.screenshot({ path: fileURLToPath(new URL('speaking.png', output)) });
  await click('말했어요');
  await page.getByText('오늘 수업 끝!', { exact: true }).waitFor();

  const openTeacherClip = async title => {
    await page.goto(origin + '/scripts/solo/video-template.html?teacher', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /목적별로 고르기/ }).click();
    await page.getByRole('button', { name: /노래·영상/ }).click();
    await page.getByRole('button', { name: new RegExp(title) }).click();
    await click('이 장면으로 개별수업 만들기');
  };
  await openTeacherClip(libraryClip.title);
  await page.getByText('단어·표현 · 4/7', { exact: true }).waitFor();
  await page.getByText('자막 없이 쉐도잉 · 2/5', { exact: true }).waitFor();
  await click('전체 선택');
  await page.getByText('단어·표현 · 7/7', { exact: true }).waitFor();
  await page.getByText('자막 없이 쉐도잉 · 5/5', { exact: true }).waitFor();
  await click('기본 분량');
  await page.getByRole('checkbox', { name: /No thanks/ }).check();
  await page.getByRole('checkbox', { name: /falling and hurting yourself/ }).check();
  await page.getByRole('checkbox', { name: /slippery ·/ }).uncheck();
  const wordGames = page.getByRole('group', { name: '단어 게임', exact: true });
  const sentenceGames = page.getByRole('group', { name: '문장 게임', exact: true });
  assert.equal(await wordGames.getByRole('checkbox', { name: /^매치업/ }).isChecked(), true);
  assert.equal(await wordGames.getByRole('checkbox').count(), 13);
  assert.equal(await sentenceGames.getByRole('checkbox').count(), 5);
  assert.equal(await wordGames.getByRole('checkbox', { name: /애너그램/ }).isDisabled(), true);
  await wordGames.getByRole('checkbox', { name: /^퀴즈(?! 쇼)/ }).check();
  await wordGames.getByRole('checkbox', { name: /^퀴즈 쇼/ }).check();
  await wordGames.getByRole('checkbox', { name: /^줄다리기/ }).check();
  await wordGames.getByRole('checkbox', { name: /^단어 농구/ }).check();
  await sentenceGames.getByRole('checkbox', { name: /문장 기차/ }).check();
  await sentenceGames.getByRole('checkbox', { name: /문장 잡기/ }).check();
  await click('학생 화면 미리보기');
  await page.getByText(/미리보기예요/).waitFor();
  await page.getByRole('button', { name: '나가기', exact: true }).click();
  await click('이 초안으로 수업 만들기');
  const saved = await page.evaluate(() => JSON.parse(document.body.dataset.savedSteps));
  assert.deepEqual(saved.filter(s => s.t === 'meet').map(s => s.word), ['be careful', 'by myself', 'I want to …', 'No thanks']);
  const reviewIndex = saved.findIndex(s => s.t === 'intro' && s.title === '오늘 배운 내용 총정리');
  assert.ok(reviewIndex > 0);
  const beforeReview = saved.slice(0, reviewIndex).filter(s => s.t === 'lineSing' && s.practice === 'shadow');
  assert.equal(beforeReview.length, 3);
  assert.deepEqual(saved.slice(reviewIndex).filter(s => s.t === 'lineSing'), beforeReview);
  assert.equal(saved.filter(s => s.t === 'lyricBlank').length, 2);
  const quiz = saved.find(s => s.gameType === 'quiz');
  assert.deepEqual(quiz.review.config.questions.map(q => q.question), ['be careful', 'by myself', 'I want to …', 'No thanks']);
  const train = saved.find(s => s.gameType === 'wordtrain');
  assert.deepEqual(train.review.config.adventure.sentences.map(s => s.text), beforeReview.map(s => s.en));
  assert.equal(quiz.measure, false);
  assert.equal(train.templateId, '');
  for (const type of ['gameshowquiz', 'tugofwar']) {
    const game = saved.find(s => s.gameType === type);
    assert.deepEqual(game.review.config.questions.map(q => q.question), saved.filter(s => s.t === 'meet').map(s => s.word));
    assert.equal(game.measure, false);
  }
  const hoops = saved.find(s => s.gameType === 'wordhoops');
  assert.deepEqual(hoops.review.config.pairs.map(pair => pair.left), saved.filter(s => s.t === 'meet').map(s => s.word));
  const catchSentence = saved.find(s => s.gameType === 'catchsentence');
  assert.deepEqual(catchSentence.review.items.map(item => item.label), beforeReview.map(s => s.en));
  assert.equal(saved[saved.indexOf(quiz) - 2].t, 'meet');
  assert.equal(saved[saved.indexOf(train) - 1].practice, 'shadow');
  const recap = saved.slice(reviewIndex);
  assert.equal(recap.some(s => s.t === 'game'), false);
  assert.deepEqual(recap.filter(s => s.t === 'pickWord').map(q => [q.options[q.answer], q.meaning]),
    saved.filter(s => s.t === 'meet').map(step => [step.word, step.meaning]));
  assert.deepEqual(recap.filter(s => s.t === 'unscramble').map(q => q.sentence), beforeReview.map(s => s.en));

  await openTeacherClip(otherClip.title);
  await page.getByText('단어·표현 · 4/6', { exact: true }).waitFor();
  await page.getByText('자막 없이 쉐도잉 · 2/5', { exact: true }).waitFor();
  assert.equal(await page.getByRole('checkbox', { name: /^apple ·/ }).count(), 0);

  await page.goto(origin + '/scripts/solo/video-template.html?teacher&library', { waitUntil: 'domcontentloaded' });
  const allocations = [];
  for (const [minutes, expected] of [[10, 2], [20, 4], [40, 8]]) {
    await page.getByRole('radio', { name: minutes + '분', exact: true }).check();
    await page.getByText(new RegExp('^장면 ' + expected + '개')).waitFor();
    allocations.push({
      words: await page.getByRole('group', { name: /^단어·표현/ }).getByRole('checkbox').count(),
      shadow: await page.getByRole('group', { name: /^자막 없이 쉐도잉/ }).getByRole('checkbox').count(),
    });
  }
  assert.ok(allocations.every((row, i) => i === 0 || row.words > allocations[i - 1].words && row.shadow > allocations[i - 1].shadow));
  await page.getByRole('radio', { name: '10분', exact: true }).check();
  const parts = page.getByLabel('이야기와 차시');
  const count = await parts.locator('option').count();
  assert.ok(count > 10);
  const latePart = await parts.locator('option').evaluateAll(options =>
    options.findLast(option => option.textContent.includes('제이슨의 배낭') && !option.textContent.includes('/'))?.value);
  assert.ok(latePart);
  await parts.selectOption(latePart);
  await page.getByRole('checkbox', { name: /^매치업/ }).check();
  await page.getByRole('checkbox', { name: /^두더지잡기/ }).check();
  await page.getByRole('checkbox', { name: /^퀴즈(?! 쇼)/ }).check();
  await page.getByRole('checkbox', { name: /문장 단어 순서 맞추기/ }).check();
  await page.getByRole('checkbox', { name: /문장 기차/ }).check();
  await click('학생 화면 미리보기');
  await page.getByRole('heading', { name: /제이슨의 배낭/ }).waitFor();
  await click('시작하기');
  const restoredBefore = await playAndCheck('원본 재생', 3283.63, 3296.10, 3);
  await click('다 들었어요');
  const lateScene = await playAndCheck('원본 재생', 3296.10, 3304.86);
  await click('다 들었어요');
  await practiceExpression(/get it back/, '돌려받다');
  await practiceExpression(/give back/, '돌려주다');
  await practiceShadowing(3296.30, 3297.99, 'Thanks for looking after my backpack.');
  await click('쉐도잉을 마쳤어요');
  const restoredBetween = await playAndCheck('원본 재생', 3304.86, 3362.63, 3);
  await click('다 들었어요');
  await playAndCheck('원본 재생', 3362.63, 3374.60);
  await click('다 들었어요');
  await practiceExpression(/twins/, '쌍둥이');
  await practiceExpression(/look the same/, '똑같이 생기다');
  await page.getByRole('heading', { name: '오늘의 단어·표현 매치업', exact: true }).waitFor();
  for (const [word, meaning] of [['get it back', '돌려받다'], ['give back', '돌려주다'], ['twins', '쌍둥이'], ['look the same', '똑같이 생기다']]) {
    await page.locator('main').getByRole('button', { name: word, exact: true }).click();
    await page.locator('main').getByRole('button', { name: meaning, exact: true }).click();
  }
  await click('다음');
  await page.getByRole('heading', { name: '오늘의 단어·표현 두더지 잡기', exact: true }).waitFor();
  const pairs = new Map([['get it back', '돌려받다'], ['give back', '돌려주다'], ['twins', '쌍둥이'], ['look the same', '똑같이 생기다']]);
  for (let i = 0; i < pairs.size; i++) {
    const prompt = page.locator('main .wm-prompt-inner');
    const word = (await prompt.innerText()).trim();
    await page.locator('main').getByRole('button', { name: pairs.get(word), exact: true }).click();
    if (i + 1 < pairs.size) await page.waitForFunction(old => document.querySelector('main .wm-prompt-inner')?.textContent.trim() !== old, word);
  }
  await click('다음');
  const review = page.locator('main');
  await review.getByRole('heading', { name: '퀴즈', exact: true }).waitFor();
  for (let i = 0; i < pairs.size; i++) {
    const prompt = (await review.locator('[data-skin-stage="board"]').innerText()).trim();
    assert.ok(pairs.has(prompt), prompt);
    await review.locator('[data-skin-object="choice"]').filter({ hasText: pairs.get(prompt) }).click();
    await review.getByRole('button', { name: /다음|결과/ }).click();
  }
  await click('다음');
  await practiceShadowing(3362.83, 3365.73, "Don't cry, Rosie. They're twins.");
  await click('쉐도잉을 마쳤어요');
  for (const word of 'Thanks for looking after my backpack.'.split(' ')) {
    await page.locator('main').getByRole('button', { name: word, exact: true }).click();
  }
  await click('확인');
  await page.getByText('잘했어요! 👏', { exact: true }).waitFor();
  await click('다음');
  await click('게임 시작');
  const pieces = review.locator('[data-piece]');
  await pieces.first().waitFor();
  const target = 'Thanks for looking after my backpack.'.split(' ');
  for (const [index, word] of target.entries()) {
    const order = await pieces.evaluateAll(nodes => nodes.map(node => node.dataset.pieceText));
    if (order[index] === word) continue;
    await pieces.nth(index).click();
    await pieces.nth(order.indexOf(word)).click();
  }
  await click('출발! 문장 확인');
  await click('결과 보기');
  await review.getByText('모험 완료!', { exact: true }).waitFor();
  await click('다음');
  const restoredClosing = await playAndCheck('원본 재생', 3374.60, 3387, 3);
  await click('다 들었어요');
  await page.getByRole('heading', { name: '오늘 배운 내용 총정리', exact: true }).waitFor();
  await page.screenshot({ path: fileURLToPath(new URL('final-review.png', output)) });
  await click('시작하기');
  await page.getByRole('heading', { name: '오늘 배운 단어·표현', exact: true }).waitFor();
  await page.locator('main').getByText('get it back · 돌려받다', { exact: true }).waitFor();
  await click('읽었어요');
  await checkRecapWords([...pairs.entries()]);
  await checkRecapSentence(3296.30, 3297.99, 'Thanks for looking after my backpack.');
  await checkRecapSentence(3362.83, 3365.73, "Don't cry, Rosie. They're twins.");
  await page.getByText('오늘 수업 끝!', { exact: true }).waitFor();

  await page.goto(origin + '/scripts/solo/video-template.html?library&student&short&step=2', { waitUntil: 'domcontentloaded' });
  await page.getByText('아빠는 왜 조심하라고 했나요?', { exact: true }).waitFor();
  assert.equal(await nextStep.isDisabled(), true);
  await click('미끄러워서');
  await page.getByText('잘했어요! 👏', { exact: true }).waitFor();
  await previousStep.click();
  await page.getByText('이전 단계 복습 중', { exact: true }).waitFor();
  await page.getByText('아빠가 조심하라고 해요', { exact: true }).waitFor();
  assert.equal(await page.locator('body').getAttribute('data-last-advance'), null);
  await nextStep.click();
  await page.getByText('잘했어요! 👏', { exact: true }).waitFor();
  assert.equal(await nextStep.isDisabled(), true);
  await click('다음');
  assert.equal(await page.locator('body').getAttribute('data-last-advance'), '2');
  await previousStep.click();
  await page.getByText('아빠는 왜 조심하라고 했나요?', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '미끄러워서', exact: true }).isDisabled(), true);
  await click('수업 이어하기');
  await page.getByRole('button', { name: /slippery/ }).waitFor();
  assert.equal(await page.locator('body').getAttribute('data-last-advance'), '2');

  await page.goto(origin + '/scripts/solo/video-template.html', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /1차시.*처음 타는 스케이트/ }).waitFor();
  const defaultGame = page.getByRole('heading', { name: '오늘의 단어·표현 매치업', exact: true });
  const summary = page.getByRole('heading', { name: '오늘 배운 내용 총정리', exact: true });
  for (let index = 1; index < 13; index++) await nextStep.click();
  await defaultGame.waitFor();
  for (const [word, meaning] of [['slippery', '미끄러운'], ['be careful', '조심해'], ['by myself', '혼자서'], ['I want to …', '나는 …하고 싶어요']]) {
    await click(word);
    await click(meaning);
  }
  await click('다음');
  for (let index = 14; index < 18; index++) await nextStep.click();
  await summary.waitFor();
  await click('시작하기');
  await page.getByRole('heading', { name: '오늘 배운 단어·표현', exact: true }).waitFor();
  await click('읽었어요');
  await checkRecapWords([['slippery','미끄러운'],['be careful','조심해'],['by myself','혼자서'],['I want to …','나는 …하고 싶어요']]);

  assert.deepEqual(errors, []);
  const result = { id, firstDialogue, firstShadowing, secondDialogue, evidenceReplay, firstChunk, secondChunk, shadowing,
    correctPath: true, retryPath: true, teacherSelection: true, otherClipDefaults: true, allocations, lateScene,
    fullCoverage: endOfPrevious, restoredBefore, restoredBetween, restoredClosing, finalReview: true, matchup: true, whackamole: true, quiz: true, sentenceOrder: true, wordtrain: true,
    previewNavigation: true, studentNavigation: true, vocabularyRecap: true, sentenceRecap: true,
    videoHint: { start: hintStart.time, end: hintEnd }, errors };
  await writeFile(new URL('shadowing-flow-results.json', output), JSON.stringify(result, null, 2));
  console.log('Library student preview passed', JSON.stringify(result));
}

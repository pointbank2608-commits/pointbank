"""랜딩 체험 영역 동작 확인(2026-10-17) — 탭 전환·돌림판·매치업·퀴즈·다시하기·키보드·reduced-motion. 개발 서버 5173 필요."""
import re
import sys
import time

from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5173'
fails = []


def check(name, ok, extra=''):
    print(('OK  ' if ok else 'FAIL'), name, extra)
    if not ok:
        fails.append(name)


with sync_playwright() as pw:
    browser = pw.chromium.launch(channel='chrome', headless=True)
    for reduced in (False, True):
        ctx = browser.new_context(viewport={'width': 1280, 'height': 900}, locale='ko-KR', reduced_motion='reduce' if reduced else 'no-preference')
        page = ctx.new_page()
        errors = []
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE + '/', wait_until='networkidle')
        tag = 'reduced' if reduced else 'normal'
        # 첫 화면 보조 버튼이 체험 영역으로 이동
        page.get_by_role('link', name=re.compile('수업 도구 둘러보기')).click()
        time.sleep(0.8)
        check(f'[{tag}] 둘러보기 → #try', page.evaluate('location.hash') == '#try')
        # 돌림판
        page.get_by_role('button', name='돌리기').click()
        time.sleep(0.4 if reduced else 4.2)
        res = page.locator('#lp-demo-panel [aria-live=polite]').inner_text()
        check(f'[{tag}] 돌림판 결과 표시', '결과' in res, res.replace('\n', ' '))
        page.get_by_role('button', name='다시하기').click()
        check(f'[{tag}] 돌림판 다시하기', '돌리기' in page.locator('#lp-demo-panel').inner_text())
        # 키보드로 탭 이동
        page.locator('#lp-tab-wheel').focus()
        page.keyboard.press('ArrowRight')
        check(f'[{tag}] 방향키로 매치업 탭', page.locator('#lp-tab-matchup').get_attribute('aria-selected') == 'true')
        # 매치업: 정답 연결 4개
        for w in ['apple', 'banana', 'cat', 'dog']:
            page.get_by_role('button', name=f'{w} 그림').click()
            page.locator('#lp-demo-panel button', has_text=re.compile(f'^{w}$')).last.click()
        check(f'[{tag}] 매치업 모두 연결', '모두 연결' in page.locator('#lp-demo-panel').inner_text())
        # 매치업 오답 처리
        page.get_by_role('button', name='다시하기').click()
        page.get_by_role('button', name='apple 그림').click()
        page.locator('#lp-demo-panel button', has_text=re.compile('^banana$')).last.click()
        check(f'[{tag}] 매치업 오답 안내', '다시 골라' in page.locator('#lp-demo-panel').inner_text())
        # 퀴즈
        page.get_by_role('tab', name='퀴즈').click()
        for i in range(4):
            opts = page.locator('#lp-demo-panel button').all()
            opts[0].click()
            time.sleep(0.1)
            nxt = page.get_by_role('button', name=re.compile('다음 문제|결과 보기'))
            check(f'[{tag}] 퀴즈 {i + 1}번 정답 확인·다음 버튼', nxt.count() == 1)
            nxt.click()
        check(f'[{tag}] 퀴즈 결과', '문제 맞혔어요' in page.locator('#lp-demo-panel').inner_text())
        page.get_by_role('button', name='다시하기').click()
        check(f'[{tag}] 퀴즈 다시하기', '1 / 4' in page.locator('#lp-demo-panel').inner_text())
        # 로그인·체험 링크 유지
        hrefs = page.eval_on_selector_all('a[href="/login"]', 'els => els.length')
        check(f'[{tag}] 로그인/체험 링크 유지', hrefs >= 4, str(hrefs))
        check(f'[{tag}] 콘솔 오류 없음', not errors, str(errors[:2]))
        ctx.close()
    browser.close()
print('FAILED' if fails else 'ALL OK', fails)
sys.exit(1 if fails else 0)

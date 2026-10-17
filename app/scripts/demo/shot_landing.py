"""랜딩 화면 캡처(2026-10-17) — 데스크톱·태블릿·모바일 전체 화면을 PNG 로 저장하고, 가로 스크롤·넘침을 검사한다.
사용법(app 폴더, 개발 서버 5173): python scripts/demo/shot_landing.py [출력 폴더]"""
import os
import sys
import time

from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get('TEMP', '.'), 'landing-shots')
os.makedirs(OUT, exist_ok=True)
BASE = os.environ.get('DEMO_BASE', 'http://localhost:5173')
SIZES = [('desktop', 1440, 900), ('tablet', 820, 1100), ('mobile', 390, 844)]

with sync_playwright() as pw:
    browser = pw.chromium.launch(channel='chrome', headless=True)
    for name, w, h in SIZES:
        ctx = browser.new_context(viewport={'width': w, 'height': h}, locale='ko-KR')
        page = ctx.new_page()
        errors = []
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.goto(BASE + '/', wait_until='networkidle')
        page.evaluate('() => document.fonts.ready')
        # 지연 로딩 이미지를 모두 불러오도록 끝까지 한 번 내려갔다 온다
        total = page.evaluate('() => document.documentElement.scrollHeight')
        y = 0
        while y < total:
            page.evaluate(f'window.scrollTo(0,{y})')
            time.sleep(0.15)
            y += h // 2
        page.evaluate('window.scrollTo(0,0)')
        time.sleep(0.8)
        info = page.evaluate(
            '() => ({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.documentElement.scrollHeight})'
        )
        over = page.evaluate(
            """() => {
              const cw = document.documentElement.clientWidth; const out = [];
              document.querySelectorAll('.landing *').forEach((el) => {
                const r = el.getBoundingClientRect();
                if (r.width > 0 && (r.right > cw + 2 || r.left < -2) && !el.closest('[aria-hidden="true"]')) out.push(el.tagName + '.' + (el.className || '').toString().slice(0, 40));
              });
              return out.slice(0, 8);
            }"""
        )
        print(name, info, 'overflow:', over, 'console errors:', errors[:3])
        page.screenshot(path=os.path.join(OUT, f'{name}.png'), full_page=True)
        ctx.close()
    browser.close()
print('saved to', OUT)

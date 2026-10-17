"""
게임 시연 영상 녹화(2026-10-17) — 실제 게임 화면을 헤드리스 크롬으로 15초 안팎 녹화해 public/demos/<게임>.mp4 로 저장한다.
앱의 게임 소개 패널(GameInfoPanel)이 파일이 있으면 자동으로 보여 준다.

사용법(app 폴더에서, 개발 서버가 5173 에서 돌고 있어야 함):
    python scripts/demo/record.py            # 전부
    python scripts/demo/record.py lightning  # 하나만
새 게임 = SCRIPTS 에 한 항목(자막 + 클릭 순서) + harness.tsx 에 그 게임을 띄우는 case.
"""
import os
import re
import shutil
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

APP = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(APP, 'public', 'demos')
TMP = os.path.join(os.environ.get('TEMP', '.'), 'classbank-demo')
BASE = os.environ.get('DEMO_BASE', 'http://localhost:5173')
FFMPEG = shutil.which('ffmpeg') or 'ffmpeg'


def click(page, pattern, timeout=2500):
    page.get_by_role('button', name=re.compile(pattern)).first.click(timeout=timeout)


def draw_popcorn(page):
    # POP! 화면이 떠 있으면 먼저 닫는다
    if page.locator('.pc-pop-hint').count() > 0:
        page.locator('.pc-pop-hint').first.click(timeout=1500)
        time.sleep(0.5)
    click(page, '팝콘 뽑기')


# (자막, 동작) 목록 — 동작은 (page) -> None, 뒤에 기다릴 초
SCRIPTS = {
    'lightning': [
        ('① 모두 일어서요 — 먹구름을 보내요', lambda p: click(p, '먹구름 보내기'), 3.0),
        ('② 한 사람이 글을 읽고 다음 사람에게 넘겨요', lambda p: click(p, '다음 사람'), 1.6),
        ('③ 번개가 언제 칠지는 아무도 몰라요', lambda p: click(p, '다음 사람'), 2.0),
        ('④ 번개를 맞은 사람은 아웃! 마지막까지 서 있으면 승리', lambda p: None, 4.0),
    ],
    'popcorn': [
        ('① 팝콘을 뽑아요', lambda p: draw_popcorn(p), 2.2),
        ('② 나온 단어를 크게 읽어요', lambda p: draw_popcorn(p), 2.2),
        ('③ 읽으면 점수가 올라가요 (못 읽으면 −1점)', lambda p: draw_popcorn(p), 2.4),
        ('④ POP! 카드가 나오면 그 팀 점수는 0점!', lambda p: draw_popcorn(p), 2.6),
    ],
    'fourclues': [
        ('① 단서 카드를 하나씩 열어요', lambda p: None, 2.5),
        ('② 모르면 "다음 단서 열기"', lambda p: click(p, '다음 단서 열기'), 2.4),
        ('③ 단서를 적게 쓸수록 높은 점수!', lambda p: click(p, '다음 단서 열기'), 2.4),
        ('④ 맞히면 "맞혔어요"를 눌러요', lambda p: click(p, '맞혔어요'), 3.0),
    ],
    'catchsentence': [
        ('① "보여 주기"를 누르면 문장이 잠깐 나타나요', lambda p: click(p, '보여 주기'), 3.4),
        ('② 모든 팀이 종이에 받아 써요', lambda p: None, 1.8),
        ('③ 정답을 확인하고 맞은 팀에 점수를 줘요', lambda p: click(p, '정답 보기'), 2.6),
        ('④ 팀 점수 +1!', lambda p: click(p, '^A.*\\+1'), 2.2),
    ],
    'icecream': [
        ('① 메뉴에서 맛·크기·토핑을 읽어요', lambda p: None, 2.0),
        ('② "주문하기"로 점원과 대화를 시작해요', lambda p: (click(p, '주문하기'), time.sleep(0.7), click(p, '대화 시작')), 1.8),
        ('③ 점원이 물으면 크기와 담기를 골라요', lambda p: (click(p, '다음 대사'), time.sleep(0.9), click(p, 'large'), time.sleep(0.5), click(p, 'cone')), 1.6),
        ('④ 맛을 고르면 스쿱이 쌓여요!', lambda p: (click(p, '다음 대사'), time.sleep(0.9), click(p, '다음 대사'), time.sleep(0.9), click(p, 'chocolate'), time.sleep(0.6), click(p, 'vanilla'), time.sleep(0.6), click(p, 'strawberry')), 2.8),
    ],
}


def cleanup():
    for f in (os.path.join(APP, 'src', '_demo.tsx'), os.path.join(APP, '_demo.html')):
        if os.path.exists(f):
            os.remove(f)


def main():
    games = sys.argv[1:] or list(SCRIPTS)
    os.makedirs(OUT, exist_ok=True)
    shutil.rmtree(TMP, ignore_errors=True)
    os.makedirs(TMP, exist_ok=True)
    shutil.copy(os.path.join(APP, 'scripts', 'demo', 'harness.tsx'), os.path.join(APP, 'src', '_demo.tsx'))
    with open(os.path.join(APP, '_demo.html'), 'w', encoding='utf8') as f:
        f.write('<!doctype html><html><body><div id="root"></div><script type="module" src="/src/_demo.tsx"></script></body></html>')
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(channel='chrome', headless=True)
            for g in games:
                steps = SCRIPTS[g]
                vdir = os.path.join(TMP, g)
                started = time.time()
                ctx = browser.new_context(viewport={'width': 1000, 'height': 720}, record_video_dir=vdir, record_video_size={'width': 1000, 'height': 720}, locale='ko-KR')
                page = ctx.new_page()
                page.goto(f'{BASE}/_demo.html?game={g}')
                page.wait_for_selector('button', timeout=20000)
                page.evaluate('() => document.fonts.ready')
                time.sleep(1.5)
                trim = max(0.0, time.time() - started - 0.3)  # 글꼴이 뜨기 전 장면은 잘라 낸다
                for cap, action, wait in steps:
                    page.evaluate('(t) => window.__cap && window.__cap(t)', cap)
                    try:
                        action(page)
                    except Exception as e:  # 한 동작이 실패해도 나머지 장면은 녹화한다
                        print(f'  ! {g}: {cap} 동작 실패 — {str(e)[:80]}')
                    time.sleep(wait)
                page.evaluate('() => window.__cap && window.__cap("")')
                time.sleep(0.4)
                ctx.close()
                webm = [f for f in os.listdir(vdir) if f.endswith('.webm')][0]
                dst = os.path.join(OUT, f'{g}.mp4')
                subprocess.run(
                    [FFMPEG, '-y', '-ss', f'{trim:.2f}', '-i', os.path.join(vdir, webm), '-an', '-vf', 'fps=12,scale=800:-2', '-c:v', 'libx264', '-crf', '30', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dst],
                    check=True,
                    capture_output=True,
                )
                print(f'{g}: {os.path.getsize(dst) // 1024} KB')
            browser.close()
    finally:
        cleanup()


if __name__ == '__main__':
    main()

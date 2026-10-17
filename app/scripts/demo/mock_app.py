"""로그인 없이 앱 화면을 캡처하는 점검 도구(2026-10-17) — Supabase 요청을 가짜 데이터로 막아 선생님 화면을 띄운다.
사용: python app/scripts/demo/mock_app.py <경로> <너비> <높이> <저장 파일> [dark]
개발 서버(5173)가 떠 있어야 한다. 실제 서버·학생 데이터에는 접속하지 않는다."""
import base64
import json
import re
import sys
import time

from playwright.sync_api import sync_playwright

path = sys.argv[1] if len(sys.argv) > 1 else '/dashboard'
w = int(sys.argv[2]) if len(sys.argv) > 2 else 1536
h = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
out = sys.argv[4] if len(sys.argv) > 4 else 'C:/Users/likes/AppData/Local/Temp/app.png'
empty = 'empty' in sys.argv[5:]

env = open('app/.env.local', encoding='utf8').read()
url = re.search(r'VITE_SUPABASE_URL=(\S+)', env).group(1)
ref = re.search(r'https://([^.]+)\.', url).group(1)


def b64(o):
    return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')


uid = '00000000-0000-4000-8000-000000000001'
aid = '00000000-0000-4000-8000-0000000000aa'
exp = int(time.time()) + 86400 * 30
token = f"{b64({'alg': 'HS256', 'typ': 'JWT'})}.{b64({'sub': uid, 'role': 'authenticated', 'exp': exp, 'aud': 'authenticated'})}.sig"
user = {'id': uid, 'aud': 'authenticated', 'role': 'authenticated', 'email': 'kelly@example.com', 'app_metadata': {}, 'user_metadata': {}, 'created_at': '2026-01-01T00:00:00Z'}
session = {'access_token': token, 'refresh_token': 'r', 'expires_at': exp, 'expires_in': 86400, 'token_type': 'bearer', 'user': user}

profile = {'id': uid, 'academy_id': aid, 'role': 'owner', 'display_name': 'Kelly', 'created_at': '2026-01-01T00:00:00Z'}
academy = {'id': aid, 'name': '스프링 잉글리시', 'point_unit': '별', 'invite_code': 'ABC123', 'logo_url': None, 'created_at': '2026-10-01T00:00:00Z', 'plan': 'paid', 'plan_status': 'active',
           'next_billing_at': None, 'card_brand': None, 'card_last4': None, 'trial_ends_at': None, 'features': {'group': True, 'solo': True, 'homework': True}}
classes = [] if empty else [{'id': f'c{i}', 'academy_id': aid, 'name': f'{n}반', 'sort_order': i, 'schedule': None, 'created_at': '2026-10-01T00:00:00Z'} for i, n in enumerate(['A', 'B', 'C', 'D', 'E', 'F', 'G'])]
students = [] if empty else [{'id': f's{i}', 'academy_id': aid, 'class_id': f'c{i % 7}', 'name': f'학생{i}', 'created_at': '2026-10-01T00:00:00Z'} for i in range(11)]
import datetime
_today = datetime.date.today()
attendance = [] if empty else [{'id': f'a{i}-{d}', 'academy_id': aid, 'student_id': f's{i}', 'class_id': f'c{i % 7}', 'attended_on': (_today - datetime.timedelta(days=d)).isoformat(), 'checked_in_at': '2026-10-15T07:00:00Z', 'checked_out_at': None, 'created_at': '2026-10-15T07:00:00Z'}
                               for i in range(11) for d in range(0, 6) if (i + d) % 3 != 0]
def _lesson(i, name, kinds):
    return {'id': f'l{i}', 'academy_id': aid, 'class_id': 'c0', 'name': name, 'level': None, 'word_list_id': None, 'video_url': None, 'created_at': '2026-10-10T00:00:00Z', 'updated_at': f'2026-10-1{i}T00:00:00Z',
            'playlist': [{'id': f'sl{i}{j}', 'kind': k, **({'gameType': 'wheel'} if k == 'game' else {})} for j, k in enumerate(kinds)]}
lessons = [] if empty else [_lesson(1, 'Animals · 동물 친구들', ['wordshow', 'game', 'game']), _lesson(2, 'Phonics · 짧은 모음 a', ['study', 'material']), _lesson(3, 'How much is it?', ['grammar', 'game']),
                            _lesson(4, 'Weather · 오늘의 날씨', ['video', 'qna']), _lesson(5, 'My Body · 몸과 움직임', ['canvas']), _lesson(6, 'Food · 좋아하는 음식', ['reading', 'game'])]
tables = {'profiles': profile, 'academies': academy, 'classes': classes, 'students': students, 'attendance': attendance, 'curriculum_lessons': lessons}


def handle(route):
    req = route.request
    u = req.url
    hdr = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*'}
    if req.method == 'OPTIONS':
        return route.fulfill(status=204, headers=hdr)
    if '/auth/v1/user' in u:
        return route.fulfill(status=200, headers=hdr, content_type='application/json', body=json.dumps(user))
    if '/auth/v1/' in u:
        return route.fulfill(status=200, headers=hdr, content_type='application/json', body=json.dumps(session))
    m = re.search(r'/rest/v1/([a-z_]+)', u)
    obj = 'vnd.pgrst.object' in (req.headers.get('accept') or '')
    if m and m.group(1) in tables:
        data = tables[m.group(1)]
        if isinstance(data, list):
            body = json.dumps(data[0] if (obj and data) else ({} if obj else data))
        else:
            body = json.dumps(data if obj else [data])
        return route.fulfill(status=200, headers=hdr, content_type='application/json', body=body)
    if '/rpc/' in u:
        return route.fulfill(status=200, headers=hdr, content_type='application/json', body='null')
    return route.fulfill(status=200, headers=hdr, content_type='application/json', body='{}' if obj else '[]')


with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True)
    ctx = b.new_context(viewport={'width': w, 'height': h})
    ctx.add_init_script(f"localStorage.setItem('sb-{ref}-auth-token', {json.dumps(json.dumps(session))}); localStorage.setItem('classbank.startCheck.skip','1');")
    ctx.route(re.compile(r'.*\.supabase\.co/.*'), handle)
    pg = ctx.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto('http://localhost:5173' + path, wait_until='networkidle')
    pg.wait_for_timeout(1500)
    pg.screenshot(path=out, full_page='full' in sys.argv[5:])
    print('overflow', pg.evaluate('document.documentElement.scrollWidth - window.innerWidth'), 'url', pg.url)
    for e in errs[:4]:
        print('console:', e[:160])
    b.close()

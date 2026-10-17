"""관리자 화면 점검 도구(2026-10-18) — Supabase 요청을 가짜 데이터로 막아 관리자 화면을 로그인 없이 띄운다.
사용: python app/scripts/demo/mock_admin.py <경로> <너비> <높이> <저장 파일> [full] [dark] [fail]
 - 개발 서버(5173)가 떠 있어야 한다. 실제 서버·실제 회원 데이터에는 접속하지 않는다(모든 supabase.co 요청을 가로챈다).
 - 'fail' 을 주면 모든 RPC 가 오류를 돌려줘 "불러오지 못했어요" 화면을 확인할 수 있다(0건으로 보이지 않는지).
 - 화면 가로 넘침과 콘솔 오류를 출력한다."""
import base64
import datetime
import json
import re
import sys
import time

from playwright.sync_api import sync_playwright

path = sys.argv[1] if len(sys.argv) > 1 else '/admin'
w = int(sys.argv[2]) if len(sys.argv) > 2 else 1440
h = int(sys.argv[3]) if len(sys.argv) > 3 else 900
out = sys.argv[4] if len(sys.argv) > 4 else 'C:/Users/likes/AppData/Local/Temp/admin.png'
flags = sys.argv[5:]
FAIL = 'fail' in flags

env = open('app/.env.local', encoding='utf8').read()
url = re.search(r'VITE_SUPABASE_URL=(\S+)', env).group(1)
ref = re.search(r'https://([^.]+)\.', url).group(1)


def b64(o):
    return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')


uid = '00000000-0000-4000-8000-000000000001'
aid = '00000000-0000-4000-8000-0000000000aa'
exp = int(time.time()) + 86400 * 30
claims = {'sub': uid, 'role': 'authenticated', 'exp': exp, 'aud': 'authenticated', 'aal': 'aal2', 'amr': [{'method': 'totp', 'timestamp': int(time.time())}]}
token = f"{b64({'alg': 'HS256', 'typ': 'JWT'})}.{b64(claims)}.sig"
user = {'id': uid, 'aud': 'authenticated', 'role': 'authenticated', 'email': 'admin@example.com', 'app_metadata': {}, 'user_metadata': {}, 'created_at': '2026-01-01T00:00:00Z'}
session = {'access_token': token, 'refresh_token': 'r', 'expires_at': exp, 'expires_in': 86400, 'token_type': 'bearer', 'user': user}
profile = {'id': uid, 'academy_id': aid, 'role': 'admin', 'display_name': 'Admin', 'created_at': '2026-01-01T00:00:00Z'}
academy = {'id': aid, 'name': '운영', 'point_unit': '별', 'invite_code': 'ABC123', 'logo_url': None, 'created_at': '2026-01-01T00:00:00Z', 'plan': 'paid', 'plan_status': 'active',
           'next_billing_at': None, 'card_brand': None, 'card_last4': None, 'trial_ends_at': None, 'features': {'group': True, 'solo': True, 'homework': True}}

now = datetime.datetime.now(datetime.timezone.utc)
iso = lambda d: (now - datetime.timedelta(minutes=d)).isoformat()

names = ['스프링 잉글리시', '해든 영어교습소', '다온 공부방', '그린트리 어학원', '바다 영어', '소나무 교습소', 'Sunny English Lab']
ents = ['full', 'trial', 'free', 'full', 'trial', 'full', 'free']
srcs = ['subscription', None, None, 'admin', None, None, None]
academies = [{
    'academy_id': f'a{i}', 'name': n, 'created_at': iso(60 * 24 * (i * 9 + 1)), 'is_test': i == 6, 'entitlement': ents[i], 'source': srcs[i] if ents[i] == 'full' else None,
    'billing_state': ['normal', 'none', 'none', 'none', 'none', 'failed', 'none'][i], 'plan_expires_at': None, 'trial_ends_at': iso(-60 * 24 * 3) if ents[i] == 'trial' else None,
    'billing_failure_count': 2 if i == 5 else 0, 'owner_email': f'owner{i}@example.com', 'owner_name': f'원장{i}', 'owner_count': 1, 'teacher_count': i % 3, 'student_count': 12 + i * 7,
    'class_count': 2 + i % 3, 'last_active_at': iso(60 * i + 30), 'open_tickets': 1 if i == 2 else 0, 'total': 1243,
} for i, n in enumerate(names)]
academies[5]['source'] = 'unclassified'

overview = {
    'academies': 1243, 'signups_today': 4, 'signups_7d': 31, 'accounts': 1710, 'owners': 1243, 'teachers': 467, 'students': 21480, 'active_7d': 612,
    'entitlement': {'free': 802, 'trial': 241, 'full': 200}, 'trial_ending_3d': 17, 'source': {'subscription': 96, 'admin': 38, 'event': 12, 'unclassified': 54},
    'billing': {'normal': 91, 'failed': 5, 'cancel_scheduled': 8}, 'grants_expiring_7d': 6, 'test_academies': 3, 'asof': now.isoformat(),
}
issues = [
    {'id': 'i1', 'issue_key': 'error:abc', 'kind': 'error', 'severity': 1, 'title': "오류가 24시간 안에 41건 — Cannot read properties of undefined (reading 'map')", 'summary': '/games/quiz 에서 발생', 'status': 'open',
     'academies_affected': 9, 'users_affected': 14, 'first_seen': iso(300), 'last_seen': iso(4), 'wait_minutes': 300, 'acknowledged_at': None, 'resolved_at': None, 'resolution_note': None,
     'auto_resolved': False, 'recurrence_count': 1, 'recurred_at': iso(60), 'ref': {'fingerprint': 'abc'}},
    {'id': 'i2', 'issue_key': 'billing:a5', 'kind': 'billing', 'severity': 2, 'title': '결제 실패 2회 — 해든 영어교습소', 'summary': '결제 수단과 재시도 결과를 확인하세요.', 'status': 'open',
     'academies_affected': 1, 'users_affected': 0, 'first_seen': iso(2000), 'last_seen': iso(60), 'wait_minutes': 2000, 'acknowledged_at': None, 'resolved_at': None, 'resolution_note': None,
     'auto_resolved': False, 'recurrence_count': 0, 'recurred_at': None, 'ref': {'academy_id': 'a5'}},
    {'id': 'i3', 'issue_key': 'ticket:t1', 'kind': 'ticket', 'severity': 3, 'title': '응답 기한이 지난 문의 — 로그인이 안 돼요', 'summary': '높음 · 기한 8시간', 'status': 'acknowledged',
     'academies_affected': 1, 'users_affected': 1, 'first_seen': iso(900), 'last_seen': iso(10), 'wait_minutes': 900, 'acknowledged_at': iso(30), 'resolved_at': None, 'resolution_note': None,
     'auto_resolved': False, 'recurrence_count': 0, 'recurred_at': None, 'ref': {'ticket_id': 't1'}},
]
tickets = [{
    'id': f't{i}', 'academy_id': f'a{i}', 'academy_name': names[i], 'entitlement': ents[i], 'user_email': f'owner{i}@example.com', 'user_name': f'원장{i}', 'category': ['bug', 'howto', 'billing'][i % 3],
    'subject': ['로그인이 안 돼요', '단어장 가져오기는 어떻게 하나요?', '결제가 두 번 됐어요'][i % 3], 'status': 'open', 'admin_state': ['new', 'in_progress', 'waiting_customer'][i % 3],
    'priority': ['high', 'normal', 'urgent'][i % 3], 'incident_key': '로그인 오류' if i == 0 else None, 'created_at': iso(500), 'updated_at': iso(20), 'waiting_since': iso(500 - i * 100),
    'wait_minutes': 500 - i * 100, 'sla_hours': [8, 24, 2][i % 3], 'overdue': i == 0, 'admin_unread': i == 0, 'reopen_count': 0, 'first_response_minutes': None,
    'errors_24h': 6 if i == 0 else 0, 'same_incident': 3 if i == 0 else 0, 'total': 37,
} for i in range(3)]
errors = [{
    'fingerprint': 'abc', 'message': "Cannot read properties of undefined (reading 'map')", 'page': '/games/quiz', 'sample_stack': 'TypeError: ...\n  at Quiz (app.js)', 'events': 41, 'users': 14, 'academies': 9,
    'first_seen': iso(300), 'last_seen': iso(4), 'issue_id': 'i1', 'status': 'open', 'recurrence_count': 1, 'resolved_at': None, 'events_after_resolved': 0, 'issue_wait_minutes': 300}]
jobs = [
    {'job_key': 'welcome_first_use', 'title': '가입 후 첫 사용 안내', 'description': '가입 후 3일 안에 수업을 만들지 않은 원장에게 안내', 'kind': 'lifecycle', 'managed': 'internal', 'enabled': False,
     'mode': 'dry_run', 'channel': 'email', 'schedule': None, 'last_run_at': None, 'last_success_at': None, 'next_run_at': None, 'expected_interval_minutes': None, 'health': 'disabled', 'last_error': None,
     'msg_planned': 0, 'msg_sent': 0, 'msg_failed': 0},
    {'job_key': 'trial_ending', 'title': '체험 종료 안내', 'description': None, 'kind': 'lifecycle', 'managed': 'internal', 'enabled': True, 'mode': 'dry_run', 'channel': 'email', 'schedule': None,
     'last_run_at': iso(120), 'last_success_at': iso(120), 'next_run_at': None, 'expected_interval_minutes': 1440, 'health': 'dry_only', 'last_error': None, 'msg_planned': 12, 'msg_sent': 0, 'msg_failed': 0},
    {'job_key': 'charge_subscriptions', 'title': '정기결제 배치', 'description': '매일 청구', 'kind': 'billing', 'managed': 'external', 'enabled': True, 'mode': 'live', 'channel': 'none',
     'schedule': 'daily', 'last_run_at': None, 'last_success_at': None, 'next_run_at': None, 'expected_interval_minutes': 1440, 'health': 'no_record', 'last_error': None, 'msg_planned': 0, 'msg_sent': 0, 'msg_failed': 0},
]
billing = {'billed_ok_30d': 83, 'billed_failed_30d': 5, 'amount_ok_30d_krw': 821700, 'amount_ok_month_krw': 504900, 'refunds_recorded': False, 'webhook_events_30d': 0,
           'failures': [{'academy_id': 'a5', 'name': '해든 영어교습소', 'billed_at': iso(2000), 'amount_krw': 9900, 'reason': '카드 한도 초과'}]}
bulk_preview = {'batch_id': 'b1', 'targets': 1243, 'will_change': 1200, 'unchanged': 43,
                'sample': [{'academy': '스프링 잉글리시', 'before': {'group': True, 'solo': True, 'homework': True}, 'after': {'group': True, 'solo': False, 'homework': False}}]}

rpcs = {
    'admin_overview': overview, 'admin_issues_sync': {'new': 0, 'recurred': 0, 'auto_resolved': 0}, 'admin_issue_list': issues, 'admin_academy_search': academies,
    'admin_ticket_search': tickets, 'admin_error_groups': errors, 'admin_jobs_status': jobs, 'admin_billing_overview': billing, 'admin_billing_reconcile': [],
    'admin_bulk_recent': [], 'admin_bulk_features_preview': bulk_preview, 'admin_action_log': [], 'admin_lifecycle_preview': {'kind': 'trial_ending', 'new': 12, 'skipped_duplicate': 3, 'sample': [{'academy': '다온 공부방', 'email': 'owner2@example.com'}]},
    'admin_purge_due_deletions': 0,
}
tables = {'profiles': profile, 'academies': academy, 'admin_saved_filters': [], 'admin_settings': {'value': {'urgent': 2, 'high': 8, 'normal': 24, 'low': 72}}}


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
    m = re.search(r'/rest/v1/rpc/([a-z_0-9]+)', u)
    if m:
        if FAIL:
            return route.fulfill(status=500, headers=hdr, content_type='application/json', body=json.dumps({'message': 'mock failure: function public.%s does not exist' % m.group(1)}))
        return route.fulfill(status=200, headers=hdr, content_type='application/json', body=json.dumps(rpcs.get(m.group(1))))
    m = re.search(r'/rest/v1/([a-z_]+)', u)
    obj = 'vnd.pgrst.object' in (req.headers.get('accept') or '')
    if m and m.group(1) in tables:
        data = tables[m.group(1)]
        if isinstance(data, list):
            body = json.dumps(data[0] if (obj and data) else ({} if obj else data))
        else:
            body = json.dumps(data if obj else [data])
        return route.fulfill(status=200, headers=hdr, content_type='application/json', body=body)
    return route.fulfill(status=200, headers=hdr, content_type='application/json', body='{}' if obj else '[]')


with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True)
    ctx = b.new_context(viewport={'width': w, 'height': h}, color_scheme='dark' if 'dark' in flags else 'light')
    ctx.add_init_script(f"localStorage.setItem('sb-{ref}-auth-token', {json.dumps(json.dumps(session))});")
    ctx.route(re.compile(r'.*\.supabase\.co/.*'), handle)
    pg = ctx.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto('http://localhost:5173' + path, wait_until='networkidle')
    pg.wait_for_timeout(1500)
    pg.screenshot(path=out, full_page='full' in flags)
    print('overflow', pg.evaluate('document.documentElement.scrollWidth - window.innerWidth'), 'url', pg.url)
    for e in errs[:6]:
        print('console:', e[:200])
    b.close()

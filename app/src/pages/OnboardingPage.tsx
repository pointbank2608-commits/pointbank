import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { createAcademy, joinAsTeacher } from '../lib/api';
import { supabase } from '../lib/supabase';

// 베타 기간 동안은 학생 로그인을 잠가둔다 (원장/선생님만 로그인 가능).
// DB 쪽도 claim_student() 실행 권한을 회수해뒀다 — 여기서 폼만 없앤다고
// 막히는 게 아니라 API 자체가 거부된다. 다시 열 때는:
//   1) supabase/schema.sql 8번 섹션의 grant 주석 해제
//   2) 아래 Choice 타입/OPTIONS 에 'student' 옵션과 claimCode 처리 복구
type Choice = 'owner' | 'teacher';

const OPTIONS: { key: Choice; emoji: string; title: string; desc: string }[] = [
  {
    key: 'owner',
    emoji: '🏫',
    title: '학원을 새로 만들기',
    desc: '원장님이라면 여기서 시작하세요. 학원과 첫 번째 반이 함께 만들어집니다.',
  },
  {
    key: 'teacher',
    emoji: '🧑‍🏫',
    title: '선생님으로 합류하기',
    desc: '원장님께 받은 6자리 초대 코드를 입력하세요.',
  },
];

export default function OnboardingPage() {
  const { refresh, session } = useAuth();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 원장
  const [academyName, setAcademyName] = useState('');
  const [pointUnit, setPointUnit] = useState('별');
  const [ownerName, setOwnerName] = useState('');
  // 선생님
  const [inviteCode, setInviteCode] = useState('');
  const [teacherName, setTeacherName] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (choice === 'owner') {
        await createAcademy(academyName, pointUnit, ownerName);
      } else if (choice === 'teacher') {
        await joinAsTeacher(inviteCode, teacherName);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">🐷</div>
          <div>
            <div className="title">시작하기</div>
            <div className="sub">{session?.user.email}</div>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}

        <div className="role-choice">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              className={`role-option ${choice === o.key ? 'selected' : ''}`}
              onClick={() => {
                setChoice(o.key);
                setError(null);
              }}
            >
              <span className="emoji">{o.emoji}</span>
              <span>
                <span className="rt">{o.title}</span>
                <span className="rd" style={{ display: 'block' }}>
                  {o.desc}
                </span>
              </span>
            </button>
          ))}
        </div>

        {choice && (
          <form onSubmit={handleSubmit} style={{ marginTop: 18 }}>
            {choice === 'owner' && (
              <>
                <div className="form-field">
                  <label htmlFor="aname">학원 / 공부방 이름</label>
                  <input
                    id="aname"
                    required
                    value={academyName}
                    onChange={(e) => setAcademyName(e.target.value)}
                    placeholder="반짝반짝 공부방"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="punit">포인트 단위</label>
                  <input
                    id="punit"
                    required
                    value={pointUnit}
                    onChange={(e) => setPointUnit(e.target.value)}
                    placeholder="별, 달러, 포인트 …"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="oname">내 이름</label>
                  <input
                    id="oname"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="김선생"
                  />
                </div>
              </>
            )}

            {choice === 'teacher' && (
              <>
                <div className="form-field">
                  <label htmlFor="icode">초대 코드</label>
                  <input
                    id="icode"
                    className="code"
                    required
                    maxLength={6}
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="ABC234"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="tname">내 이름</label>
                  <input
                    id="tname"
                    required
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    placeholder="이선생"
                  />
                </div>
              </>
            )}

            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? '처리 중…' : '완료'}
            </button>
          </form>
        )}

        <button
          className="linkish"
          style={{ color: 'var(--ink-soft)', marginTop: 14, width: '100%' }}
          onClick={() => void supabase.auth.signOut()}
        >
          다른 계정으로 로그인
        </button>
      </div>
    </div>
  );
}

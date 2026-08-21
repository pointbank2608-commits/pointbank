import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { claimStudent, createAcademy, joinAsTeacher } from '../lib/api';
import { supabase } from '../lib/supabase';

type Choice = 'owner' | 'teacher' | 'student';

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
  {
    key: 'student',
    emoji: '🎒',
    title: '학생으로 내 통장 연결하기',
    desc: '선생님께 받은 8자리 학생 코드를 입력하세요.',
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
  // 학생
  const [claimCode, setClaimCode] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (choice === 'owner') {
        await createAcademy(academyName, pointUnit, ownerName);
      } else if (choice === 'teacher') {
        await joinAsTeacher(inviteCode, teacherName);
      } else if (choice === 'student') {
        await claimStudent(claimCode);
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

            {choice === 'student' && (
              <div className="form-field">
                <label htmlFor="ccode">학생 코드</label>
                <input
                  id="ccode"
                  className="code"
                  required
                  maxLength={8}
                  value={claimCode}
                  onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                  placeholder="AB23CD45"
                />
              </div>
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

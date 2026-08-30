import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { claimAdmin, createAcademy, joinAsTeacher } from '../lib/api';
import { supabase } from '../lib/supabase';

// 이 이메일로 로그인한 사람에게는 일반 온보딩 대신 "관리자로 시작하기"를 보여준다.
// 실제 권한 부여는 claim_admin() RPC 가 서버에서 auth.users.email 로 다시 확인하므로,
// 여기서 이메일을 비교하는 건 화면 분기용일 뿐 보안 경계가 아니다.
const ADMIN_EMAIL = 'likesea85@naver.com';

// 베타 기간 동안은 학생 로그인을 잠가둔다 (원장/선생님만 로그인 가능).
// DB 쪽도 claim_student() 실행 권한을 회수해뒀다 — 여기서 폼만 없앤다고
// 막히는 게 아니라 API 자체가 거부된다. 다시 열 때는:
//   1) supabase/schema.sql 8번 섹션의 grant 주석 해제
//   2) 아래 Choice 타입/OPTIONS 에 'student' 옵션과 claimCode 처리 복구
type Choice = 'owner' | 'teacher';

const OPTIONS: { key: Choice; icon: string; title: string; desc: string }[] = [
  {
    key: 'owner',
    icon: 'school',
    title: '학원을 새로 만들기',
    desc: '원장님이라면 여기서 시작하세요. 학원과 첫 번째 반이 함께 만들어집니다.',
  },
  {
    key: 'teacher',
    icon: 'person_add',
    title: '선생님으로 합류하기',
    desc: '원장님께 받은 6자리 초대 코드를 입력하세요.',
  },
];

export default function OnboardingPage() {
  const { refresh, session } = useAuth();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdminEmail = session?.user.email?.toLowerCase() === ADMIN_EMAIL;

  async function handleClaimAdmin() {
    setBusy(true);
    setError(null);
    try {
      await claimAdmin();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

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
    <div className="min-h-screen flex items-center justify-center px-margin-mobile bg-background py-10">
      <div className="w-full max-w-[440px] bg-surface-container-lowest rounded-xl shadow-[0_8px_30px_rgba(39,101,168,0.12)] border border-surface-container-highest p-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">🐷</span>
          <div>
            <div className="font-title-md text-title-md text-deep-navy">시작하기</div>
            <div className="font-caption text-caption text-on-surface-variant">{session?.user.email}</div>
          </div>
        </div>

        {error && (
          <div className="bg-error-container text-on-error-container rounded-lg px-4 py-3 mb-4 font-body-md text-sm">
            {error}
          </div>
        )}

        {isAdminEmail ? (
          <>
            <p className="font-body-md text-body-md text-on-surface-variant mb-4">
              관리자 계정으로 로그인하셨습니다. 학원 소속 없이 회원/서비스 관리 화면으로
              들어갑니다.
            </p>
            <button
              disabled={busy}
              onClick={() => void handleClaimAdmin()}
              className="w-full bg-warm-yellow hover:brightness-95 disabled:opacity-60 text-tertiary-container font-title-md text-title-md py-3 rounded-lg shadow-sm transition-all"
            >
              {busy ? '처리 중…' : '관리자로 시작하기'}
            </button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3">
              {OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => {
                    setChoice(o.key);
                    setError(null);
                  }}
                  className={`flex items-start gap-3 text-left p-4 rounded-xl border-2 transition-all ${
                    choice === o.key
                      ? 'border-primary bg-primary-container/10'
                      : 'border-outline-variant/40 hover:bg-surface-container-low'
                  }`}
                >
                  <span className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined">{o.icon}</span>
                  </span>
                  <span>
                    <span className="block font-title-md text-title-md text-on-surface">{o.title}</span>
                    <span className="block font-caption text-caption text-on-surface-variant mt-0.5">
                      {o.desc}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {choice && (
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                {choice === 'owner' && (
                  <>
                    <div>
                      <label htmlFor="aname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
                        학원 / 공부방 이름
                      </label>
                      <input
                        id="aname"
                        required
                        value={academyName}
                        onChange={(e) => setAcademyName(e.target.value)}
                        placeholder="반짝반짝 공부방"
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="punit" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
                        포인트 단위
                      </label>
                      <input
                        id="punit"
                        required
                        value={pointUnit}
                        onChange={(e) => setPointUnit(e.target.value)}
                        placeholder="별, 달러, 포인트 …"
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="oname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
                        내 이름
                      </label>
                      <input
                        id="oname"
                        required
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder="김선생"
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                  </>
                )}

                {choice === 'teacher' && (
                  <>
                    <div>
                      <label htmlFor="icode" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
                        초대 코드
                      </label>
                      <input
                        id="icode"
                        required
                        maxLength={6}
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        placeholder="ABC234"
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-title-md text-title-md tracking-widest text-center text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="tname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
                        내 이름
                      </label>
                      <input
                        id="tname"
                        required
                        value={teacherName}
                        onChange={(e) => setTeacherName(e.target.value)}
                        placeholder="이선생"
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-primary hover:bg-primary-container disabled:opacity-60 text-on-primary font-title-md text-title-md py-3 rounded-lg shadow-sm transition-colors"
                >
                  {busy ? '처리 중…' : '완료'}
                </button>
              </form>
            )}
          </>
        )}

        <button
          onClick={() => void supabase.auth.signOut()}
          className="w-full mt-4 font-caption text-caption text-on-surface-variant hover:text-primary transition-colors"
        >
          다른 계정으로 로그인
        </button>
      </div>
    </div>
  );
}

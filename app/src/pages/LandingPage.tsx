import { Link } from 'react-router-dom';
import SpinWheel from '../components/SpinWheel';

const WHEEL_ITEMS = [
  { id: '1', label: '발표하기' },
  { id: '2', label: '숙제 검사' },
  { id: '3', label: '칭찬 스티커' },
  { id: '4', label: '자리 바꾸기' },
  { id: '5', label: '깜짝 퀴즈' },
];

const SUMMARY = [
  { icon: 'account_balance_wallet', title: '포인트 통장', desc: '지급 · 차감 · 오늘 마감' },
  { icon: 'event_available', title: '출석부', desc: '등원 · 하원 · 월별 기록' },
  { icon: 'sports_esports', title: '미니게임', desc: '돌림판 · 사다리 · 공 뽑기 · 시한폭탄 · 타이머' },
  { icon: 'school', title: '반 · 학원 관리', desc: '선생님 초대 · 반 관리' },
];

const MOCK_STUDENTS = [
  { name: '김민준', pts: 350 },
  { name: '이서윤', pts: 420 },
  { name: '박도윤', pts: 340 },
];

export default function LandingPage() {
  return (
    <div className="bg-background text-on-background font-body-md antialiased">
      {/* 헤더 */}
      <header className="w-full h-20 px-margin-mobile md:px-margin-desktop flex justify-between items-center sticky top-0 bg-surface-container-lowest/90 backdrop-blur-md z-50 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐷</span>
          <span className="font-display-lg text-primary text-[22px] md:text-[26px] tracking-tight">클래스뱅크</span>
        </div>
        <Link
          to="/login"
          className="bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md px-6 py-3 rounded-lg shadow-sm hover:-translate-y-[2px] transition-all"
        >
          로그인
        </Link>
      </header>

      <main className="max-w-container-max mx-auto w-full">
        {/* 히어로 */}
        <section className="relative pt-16 md:pt-24 pb-24 px-margin-mobile md:px-margin-desktop overflow-hidden flex flex-col md:flex-row items-center gap-12">
          <div className="absolute top-0 right-0 -z-10 w-[600px] h-[600px] bg-soft-mint/30 rounded-full blur-[100px] translate-x-1/3 -translate-y-1/4" />
          <div className="absolute bottom-0 left-0 -z-10 w-[500px] h-[500px] bg-warm-yellow/20 rounded-full blur-[80px] -translate-x-1/3 translate-y-1/4" />

          <div className="flex-1 space-y-7 z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-container rounded-full text-on-secondary-container font-label-md shadow-sm">
              <span className="material-symbols-outlined fill text-sm">star</span>
              지금은 베타 기간 · 완전 무료
            </div>
            <h1 className="font-display-lg text-headline-lg-mobile md:text-display-lg text-deep-navy leading-tight">
              숙제 쿠폰 대신,
              <br />
              <span className="text-primary">포인트 통장</span>으로
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
              초등 학원 · 공부방 선생님을 위한 포인트 관리 서비스. 지급/차감부터 출석 체크,
              미니게임까지 학원 하나로 관리하세요.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <Link
                to="/login"
                className="bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md px-8 py-4 rounded-lg shadow-[0_4px_20px_rgba(39,101,168,0.2)] hover:-translate-y-[2px] transition-all flex items-center justify-center gap-2"
              >
                무료로 시작하기
                <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
            </div>
            <p className="font-caption text-caption text-outline">
              학원 이름과 포인트 단위만 정하면 1분 안에 시작할 수 있어요.
            </p>
          </div>

          <div className="flex-1 relative z-10 w-full max-w-lg">
            <div className="relative bg-surface-container-lowest rounded-xl shadow-[0_8px_30px_rgba(39,101,168,0.12)] border border-surface-container-highest p-6 overflow-hidden transform md:rotate-2 hover:rotate-0 transition-transform duration-500">
              <div className="flex justify-between items-center mb-6 border-b border-surface-container-low pb-4">
                <div>
                  <h3 className="font-title-md text-title-md text-deep-navy text-sm md:text-base">1반 통장</h3>
                  <p className="font-caption text-caption text-on-surface-variant">학생 3명</p>
                </div>
                <div className="bg-warm-yellow px-4 py-2 rounded-full font-title-md text-deep-navy text-sm shadow-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm fill">stars</span>
                  오늘 +{MOCK_STUDENTS.reduce((s, m) => s + m.pts, 0) % 100} 별
                </div>
              </div>
              <div className="space-y-3">
                {MOCK_STUDENTS.map((s) => (
                  <div key={s.name} className="flex justify-between items-center p-3 rounded-lg bg-surface-container-low">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-title-md">
                        {s.name.slice(0, 1)}
                      </div>
                      <span className="font-body-md text-on-surface">{s.name}</span>
                    </div>
                    <span className="font-title-md text-primary bg-primary/10 px-3 py-1 rounded-full">{s.pts}점</span>
                  </div>
                ))}
              </div>
              <div className="absolute -top-4 -right-4 bg-white p-3 rounded-xl shadow-lg border border-surface-container-low flex items-center gap-2">
                <span className="material-symbols-outlined text-warm-yellow text-2xl fill">workspace_premium</span>
                <div className="flex flex-col">
                  <span className="font-caption text-caption text-outline">오늘의 마감</span>
                  <span className="font-label-md text-deep-navy">완료!</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 한눈에 보기 */}
        <section className="px-margin-mobile md:px-margin-desktop pb-20">
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy text-center mb-10">
            클래스뱅크 하나로 이만큼
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {SUMMARY.map((s) => (
              <div
                key={s.title}
                className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_4px_20px_rgba(39,101,168,0.08)] text-center flex flex-col items-center gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-soft-mint/40 flex items-center justify-center text-primary mb-1">
                  <span className="material-symbols-outlined">{s.icon}</span>
                </div>
                <div className="font-title-md text-title-md text-on-surface">{s.title}</div>
                <div className="font-caption text-caption text-on-surface-variant">{s.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 기능 1 — 포인트 뱅킹 */}
        <section className="px-margin-mobile md:px-margin-desktop pb-24 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 bg-surface-container-lowest rounded-xl shadow-[0_4px_24px_rgba(39,101,168,0.08)] border border-surface-container p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                홍
              </div>
              <div>
                <div className="font-title-md text-title-md text-on-surface">홍길동 · 1반</div>
                <div className="font-caption text-caption text-on-surface-variant">등원 09:12</div>
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-caption text-caption text-on-surface-variant">오늘 적립</span>
              <span className="font-display-lg text-[36px] text-primary font-bold">+7</span>
              <span className="font-body-md text-on-surface-variant">별</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="bg-secondary-container text-on-secondary-container font-caption text-caption px-3 py-1.5 rounded-full">+2 숙제 완료</span>
              <span className="bg-secondary-container text-on-secondary-container font-caption text-caption px-3 py-1.5 rounded-full">+3 수업 태도 우수</span>
              <span className="bg-error-container text-on-error-container font-caption text-caption px-3 py-1.5 rounded-full">-2 미제출</span>
            </div>
          </div>

          <div className="flex-1">
            <div className="font-label-md text-label-md text-primary mb-2">포인트 뱅킹</div>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy mb-4">
              오늘 적립만 크게, 부담 없이
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              숙제 완료, 발표 참여 같은 사유 버튼 하나로 바로 지급. 누적 총액 대신{' '}
              <strong className="text-on-surface">오늘 하루의 적립</strong>만 보여줘서, 포인트가 적은
              학생도 오늘만큼은 의욕을 잃지 않아요. 수업이 끝나면 "오늘 마감" 한 번으로 통장에
              정리됩니다.
            </p>
          </div>
        </section>

        {/* 기능 2 — 미니게임 */}
        <section className="px-margin-mobile md:px-margin-desktop pb-24 flex flex-col md:flex-row-reverse items-center gap-12">
          <div className="flex-1 bg-surface-container-lowest rounded-xl shadow-[0_4px_24px_rgba(39,101,168,0.08)] border border-surface-container p-6 flex items-center justify-center">
            <div style={{ width: 260 }}>
              <SpinWheel items={WHEEL_ITEMS} />
            </div>
          </div>

          <div className="flex-1">
            <div className="font-label-md text-label-md text-primary mb-2">미니게임 · 돌림판 · 사다리 · 랜덤 공 뽑기</div>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy mb-4">
              발표자 뽑기, 이제 게임으로 한 번에
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              사유 버튼처럼 항목을 자유롭게 등록하고 돌리거나, 사다리를 타거나, 순서를 뽑으면 끝.
              반 전용으로 만들 수도, 학원 전체가 같이 쓰는 공용 게임으로 만들 수도 있어요. 게임마다
              배경음악도 골라 넣을 수 있어요.
            </p>
          </div>
        </section>

        {/* 기능 3 — 출석부 */}
        <section className="px-margin-mobile md:px-margin-desktop pb-24 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 bg-surface-container-lowest rounded-xl shadow-[0_4px_24px_rgba(39,101,168,0.08)] border border-surface-container p-6 overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="font-caption text-caption text-on-surface-variant">
                  <th className="text-left pb-2">이름</th>
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <th key={d} className="pb-2 px-1">
                      {d}
                    </th>
                  ))}
                  <th className="pb-2">출석</th>
                </tr>
              </thead>
              <tbody className="font-body-md text-body-md">
                {[
                  { name: '홍길동', marks: [1, 1, 0, 1, 1, 0, 1] },
                  { name: '김철수', marks: [1, 0, 1, 1, 0, 0, 1] },
                  { name: '이영희', marks: [1, 1, 1, 0, 1, 0, 1] },
                ].map((row) => (
                  <tr key={row.name} className="border-t border-surface-container">
                    <td className="text-left py-2 font-medium text-on-surface">{row.name}</td>
                    {row.marks.map((m, i) => (
                      <td key={i} className="py-2 px-1">
                        {m ? <span className="inline-block w-2.5 h-2.5 rounded-full bg-secondary mx-auto" /> : null}
                      </td>
                    ))}
                    <td className="py-2 font-bold text-primary">{row.marks.filter(Boolean).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex-1">
            <div className="font-label-md text-label-md text-primary mb-2">출석부</div>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy mb-4">
              등원 / 하원 체크, 월별 기록까지
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              학생 카드에서 버튼 한 번으로 등원·하원 시각을 기록합니다. 반별·월별 출석부에서는
              학생×날짜 표로 한눈에 확인하고, 빠뜨린 날짜는 소급 입력도 가능해요.
            </p>
          </div>
        </section>

        {/* 마지막 CTA */}
        <section className="px-margin-mobile md:px-margin-desktop pb-20 text-center">
          <div className="bg-primary rounded-xl p-10 md:p-14 relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-5xl mb-4">🐷</div>
              <h2 className="font-headline-lg-mobile md:font-headline-lg text-on-primary mb-3">
                지금 바로, 무료로 시작해 보세요
              </h2>
              <p className="font-body-lg text-primary-fixed opacity-90 mb-6">
                학원 이름과 포인트 단위만 정하면 1분 안에 시작할 수 있어요.
              </p>
              <Link
                to="/login"
                className="inline-flex bg-warm-yellow hover:bg-tertiary-fixed-dim text-on-tertiary-fixed-variant font-title-md text-title-md px-8 py-4 rounded-lg shadow-sm hover:-translate-y-[2px] transition-all"
              >
                무료로 시작하기
              </Link>
            </div>
            <div
              className="absolute right-0 top-0 w-64 h-full opacity-20 pointer-events-none"
              style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, #FFD54F 0%, transparent 60%)' }}
            />
          </div>
        </section>
      </main>

      <footer className="text-center py-8 font-caption text-caption text-outline">
        클래스뱅크 · 학원용 포인트 통장 서비스
      </footer>
    </div>
  );
}

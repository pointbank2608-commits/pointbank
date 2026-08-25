import { Link } from 'react-router-dom';
import SpinWheel from '../components/SpinWheel';

const WHEEL_ITEMS = [
  { id: '1', label: '발표하기' },
  { id: '2', label: '숙제 검사' },
  { id: '3', label: '칭찬 스티커' },
  { id: '4', label: '자리 바꾸기' },
  { id: '5', label: '깜짝 퀴즈' },
];

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="brand">
          <div className="brand-mark">🐷</div>
          <div className="brand-text">
            <div className="name">클래스뱅크</div>
          </div>
        </div>
        <Link to="/login" className="landing-nav-btn">
          로그인
        </Link>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-emoji">🐷✨</div>
        <h1>
          숙제 쿠폰 대신,
          <br />
          포인트 <span>통장</span>으로
        </h1>
        <p>
          초등 학원 · 공부방 선생님을 위한 포인트 관리 서비스.
          <br />
          지급/차감부터 출석 체크, 미니게임까지 학원 하나로 관리하세요.
        </p>
        <Link to="/login" className="landing-cta">
          무료로 시작하기
        </Link>
        <div className="landing-beta-note">지금은 베타 기간이라 완전 무료로 이용하실 수 있어요.</div>
      </section>

      <section className="landing-feature">
        <div className="landing-feature-text">
          <div className="landing-feature-eyebrow">포인트 뱅킹</div>
          <h2>오늘 적립만 크게, 부담 없이</h2>
          <p>
            숙제 완료, 발표 참여 같은 사유 버튼 하나로 바로 지급. 누적 총액 대신{' '}
            <strong>오늘 하루의 적립</strong>만 보여줘서, 포인트가 적은 학생도 오늘만큼은 의욕을
            잃지 않아요. 수업이 끝나면 "오늘 마감" 한 번으로 통장에 정리됩니다.
          </p>
        </div>
        <div className="landing-mock">
          <div className="passbook" style={{ maxWidth: 260 }}>
            <div className="passbook-head">
              <div>
                <div className="name">김사랑</div>
                <div className="class-label">1반</div>
              </div>
            </div>
            <div className="attendance-row">
              <button className="att-btn in done" disabled>
                등원 09:12
              </button>
              <button className="att-btn out" disabled>
                하원
              </button>
            </div>
            <div className="today-row">
              <div className="today-label">오늘 적립</div>
              <div className="today-num plus">
                +7<span className="today-unit">별</span>
              </div>
            </div>
            <div className="preset-row">
              <span className="chip plus">+2 숙제 완료</span>
              <span className="chip plus">+3 수업 태도 우수</span>
              <span className="chip minus">-2 미제출</span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-feature reverse">
        <div className="landing-feature-text">
          <div className="landing-feature-eyebrow">미니게임 · 돌림판</div>
          <h2>발표자 뽑기, 이제 돌림판으로</h2>
          <p>
            사유 버튼처럼 항목을 자유롭게 등록하고 돌리면 끝. 반 전용으로 만들 수도, 학원 전체가
            같이 쓰는 공용 돌림판으로 만들 수도 있어요. 앞으로 사다리·빙고 게임도 이 안에
            추가됩니다.
          </p>
        </div>
        <div className="landing-mock">
          <div style={{ transform: 'scale(0.72)', transformOrigin: 'top center', marginTop: -30 }}>
            <SpinWheel items={WHEEL_ITEMS} />
          </div>
        </div>
      </section>

      <section className="landing-feature">
        <div className="landing-feature-text">
          <div className="landing-feature-eyebrow">출석부</div>
          <h2>등원/하원 체크, 월별 기록까지</h2>
          <p>
            학생 카드에서 버튼 한 번으로 등원·하원 시각을 기록합니다. 반별·월별 출석부에서는
            학생×날짜 표로 한눈에 확인하고, 빠뜨린 날짜는 소급 입력도 가능해요.
          </p>
        </div>
        <div className="landing-mock">
          <div className="att-grid-wrap" style={{ maxWidth: 320 }}>
            <table className="att-grid">
              <thead>
                <tr>
                  <th className="att-grid-name">이름</th>
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <th key={d}>{d}</th>
                  ))}
                  <th>출석</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: '김사랑', marks: [1, 1, 0, 1, 1, 0, 1] },
                  { name: '이에스더', marks: [1, 0, 1, 1, 0, 0, 1] },
                ].map((row) => (
                  <tr key={row.name}>
                    <td className="att-grid-name">{row.name}</td>
                    {row.marks.map((m, i) => (
                      <td key={i}>
                        <span className={`att-cell ${m ? 'present' : ''}`}>{m ? '●' : ''}</span>
                      </td>
                    ))}
                    <td className="att-grid-count">{row.marks.filter(Boolean).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="landing-final">
        <div className="landing-hero-emoji">🐷</div>
        <h2>지금 바로, 무료로 시작해 보세요</h2>
        <p>학원 이름과 포인트 단위만 정하면 1분 안에 시작할 수 있어요.</p>
        <Link to="/login" className="landing-cta gold">
          무료로 시작하기
        </Link>
      </section>

      <footer className="landing-footer">클래스뱅크 · 학원용 포인트 통장 서비스</footer>
    </div>
  );
}

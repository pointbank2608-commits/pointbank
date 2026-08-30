import './StitchDashboard.css';

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="sgd-icon-sec">
      <path d="M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V2zm13 8H4v10h16V10z" />
    </svg>
  );
}

function AttendIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-7 8v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1zm13.5-9.5 1.4 1.4L16 16.8l-2.4-2.4 1.4-1.4 1 1z" />
    </svg>
  );
}

function GameIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zM8 15H6v-2H4v-2h2V9h2v2h2v2H8zm8.5 1a1.5 1.5 0 1 1 1.5-1.5 1.5 1.5 0 0 1-1.5 1.5zm3-3A1.5 1.5 0 1 1 21 11.5 1.5 1.5 0 0 1 19.5 13z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="sgd-icon-error">
      <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm8-6v-5a8 8 0 1 0-16 0v5l-2 2v1h20v-1z" />
    </svg>
  );
}

export default function StitchDashboard() {
  return (
    <section className="sgd" aria-label="대시보드 미리보기">
      <div className="sgd-blob sgd-blob-a" />
      <div className="sgd-blob sgd-blob-b" />

      <div className="sgd-inner">
        <header className="sgd-hello">
          <h2 className="sgd-title">좋은 아침입니다, 사라 선생님! ☀️</h2>
          <p className="sgd-sub">오늘 3개의 수업이 예정되어 있으며, 2개의 알림이 있습니다.</p>
        </header>

        <div className="sgd-grid">
          <section className="sgd-card">
            <div className="sgd-card-accent" />
            <div className="sgd-card-head">
              <h3 className="sgd-h2">
                <CalendarIcon />
                오늘의 일정
              </h3>
              <button type="button" className="sgd-ghost">
                전체 보기
              </button>
            </div>

            <div className="sgd-lessons">
              <article className="sgd-lesson">
                <div className="sgd-lesson-main">
                  <div className="sgd-time">
                    <strong>10:00</strong>
                    <span>AM</span>
                  </div>
                  <div>
                    <h3>3학년 A반 영어</h3>
                    <p>Unit 4: 나의 동네 (어휘 연습)</p>
                    <div className="sgd-tags">
                      <span className="sgd-tag">어휘</span>
                      <span className="sgd-tag is-gold">25명 참여</span>
                    </div>
                  </div>
                </div>
                <button type="button" className="sgd-start">
                  수업 시작
                </button>
              </article>

              <article className="sgd-lesson is-later">
                <div className="sgd-lesson-main">
                  <div className="sgd-time">
                    <strong>13:00</strong>
                    <span>PM</span>
                  </div>
                  <div>
                    <h3>3학년 B반 영어</h3>
                    <p>Unit 4: 나의 동네 (문법 기초)</p>
                    <div className="sgd-tags">
                      <span className="sgd-tag">문법</span>
                      <span className="sgd-tag is-gold">24명 참여</span>
                    </div>
                  </div>
                </div>
                <button type="button" className="sgd-ready">
                  준비하기
                </button>
              </article>
            </div>
          </section>

          <aside className="sgd-side">
            <div className="sgd-actions">
              <button type="button" className="sgd-action is-blue">
                <AttendIcon />
                출석부 열기
              </button>
              <button type="button" className="sgd-action is-gold">
                <GameIcon />
                단어 게임 시작
              </button>
            </div>

            <section className="sgd-card">
              <div className="sgd-card-head">
                <h3 className="sgd-h2">
                  <BellIcon />
                  알림
                </h3>
                <span className="sgd-badge">2</span>
              </div>
              <div className="sgd-notes">
                <div className="sgd-note is-alert">
                  <div>
                    <strong>숙제 미제출 알림</strong>
                    <p>지민 학생(3-A)이 어제 단어 숙제를 제출하지 않았습니다.</p>
                  </div>
                </div>
                <div className="sgd-note is-ok">
                  <div>
                    <strong>주간 목표 달성</strong>
                    <p>3-B반이 이번 주 독서 목표를 달성했습니다!</p>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}

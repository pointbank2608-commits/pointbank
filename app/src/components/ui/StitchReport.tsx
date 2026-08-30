import { useMemo, useState } from 'react';
import './StitchReport.css';

const WEEKS = [
  { label: '1주차', read: 60, listen: 45 },
  { label: '2주차', read: 75, listen: 65 },
  { label: '3주차', read: 85, listen: 80 },
  { label: '4주차', read: 92, listen: 88 },
];

const STUDENTS = [
  {
    name: '김민준',
    note: '우수 학습자',
    score: 98,
    alert: false,
    star: true,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAb0JI9iN6XC7aJjKWqvQUWyehlb0cmR6yegRZm5aNQbVIQpKkZhE2saBK57t8kphNPOvH-CcetwxlHFlSs2nOvyuR9mvqY38ea_zbPQyOx5H5F6YsGFQdcOxHh3NmhGnDAE_9a5XophAHxalpVC8-9ii1akv_y1Wedct9RwHmXJM4aiLZcZdw45uJVzdvnRhIDot--8NsBBeGhtMrrNnZqcWGLrmcubER_fkzQgo3053HkBM6WusKdlQ',
  },
  {
    name: '이서아',
    note: '정상 진도',
    score: 85,
    alert: false,
    star: false,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDlrF3_IDJqTk9_8k6og9JXUz26THJPKYGmuPLQymS4ju9cIAqC2xTlGU3c2ErECRwaMhC-Y-xVYSex4xDdeAdvMBmmRP7N9c3IoJeeDzwMVRC-RWig24_eHO0ynxTAmlKTg1Nz9JwACoHvP2e1hEi5tqlUEzS8iCN8QmxdsEA5q9SfbADmXHgRFsgWYbtC1VANB3YjAQ6Q5RIaWnFBIz_T4XUwWGdiVxlqGzmienDZoZnEd4Oh5BUJEw',
  },
  {
    name: '박도윤',
    note: '정상 진도',
    score: 82,
    alert: false,
    star: false,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBPcwhwutKx3PT4W47RR9e0vOMNzCHDtrxwqzeoQgdOZ3k74z-Qml7Vi01hRiTXBt70nEIDXgY4PrTXjXMqDGO9QCbxCYxGsnrFPWFeAxbYUuSwTXc0ogORCESwJyqBhNMdJJOaCDytKvUZXtjzpKYiKjM03vFs1MQCdu3q_luwybeo-CMFy9J01NvKY4_zFjuOd7c_mLHBnPpLlSKzmqZg2ruY6vEP9rb3zdvZnvK4y-2XzSS0FhJfFw',
  },
  {
    name: '최지유',
    note: '관심 필요 (말하기 영역)',
    score: 45,
    alert: true,
    star: false,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBqTaojQ-aAozRIYjmyDfJiB3Ui67nUSmU-1qSvgXaBTcmAC9F2EQqfXU3MN90p2vmYhulNrYnwCxLw8TEgnyCuf2YO4B5f6Pf0ojIXb-JpSuhBTQ5SEreUIwFvqkH6c3amRp0_fpMfkl0vAR8TfEwop1RzDNGnHjbaAn97j1RtkqI5e2kjxv1eS5odYgL_0TUwT_vz4U899dabIajfdu_dFu4CDDS1lhe6HSBJvSm7turgga6XeGbuWg',
  },
  {
    name: '정시우',
    note: '정상 진도',
    score: 76,
    alert: false,
    star: false,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBnO2KqcUCNeK58yg05ywVeiqui8q--9n5E0DPYNIvQLF_O9bfQqis3-zHF3v1QeIivxILzM0SzM6CpowgFRJQ1vVXmlIX68G5j_xMp3Y5RYo42Yg5aOAW0DX6WozC9WB8F4mbAV5i6JStLBWOgfv4F_TfzlD3-WbMKiYaWjWR2sHhL2hciOvlu4T5j0Ui_-r_Ml18Ux6GGgnL6Hq5s3IihPg2caIMrYrBCQuIz7xBAfwhqUAAs5ZejVA',
  },
];

function barColor(score: number, alert: boolean) {
  if (alert) return '#ba1a1a';
  if (score >= 90) return '#006b5d';
  return '#206488';
}

export default function StitchReport() {
  const [query, setQuery] = useState('');

  const students = useMemo(() => {
    const q = query.trim();
    if (!q) return STUDENTS;
    return STUDENTS.filter((s) => s.name.includes(q));
  }, [query]);

  return (
    <section className="sgr" aria-label="수업 리포트 미리보기">
      <header className="sgr-head">
        <div>
          <h2 className="sgr-title">클래스 성취도 리포트</h2>
          <p className="sgr-sub">3학년 영어반 - 최근 30일 학습 현황</p>
        </div>
        <div className="sgr-actions">
          <button type="button" className="sgr-btn is-ghost">
            리포트 다운로드
          </button>
          <button type="button" className="sgr-btn is-primary">
            학부모 발송
          </button>
        </div>
      </header>

      <div className="sgr-stats">
        <article className="sgr-stat">
          <div className="sgr-stat-bar is-p" />
          <div className="sgr-stat-top">
            <div>
              <p className="sgr-label">평균 성취도</p>
              <p className="sgr-num">86%</p>
            </div>
            <div className="sgr-ico is-p" aria-hidden>
              ↗
            </div>
          </div>
          <p className="sgr-delta">
            <strong>▲ 4.2%</strong> 지난달 대비
          </p>
        </article>
        <article className="sgr-stat">
          <div className="sgr-stat-bar is-s" />
          <div className="sgr-stat-top">
            <div>
              <p className="sgr-label">완료한 과제</p>
              <p className="sgr-num">124</p>
            </div>
            <div className="sgr-ico is-s" aria-hidden>
              ✓
            </div>
          </div>
          <div className="sgr-meter">
            <span style={{ width: '92%' }} />
          </div>
          <p className="sgr-delta" style={{ textAlign: 'right' }}>
            92% 제출률
          </p>
        </article>
        <article className="sgr-stat">
          <div className="sgr-stat-bar is-t" />
          <div className="sgr-stat-top">
            <div>
              <p className="sgr-label">도움 필요 학생</p>
              <p className="sgr-num">3명</p>
            </div>
            <div className="sgr-ico is-e" aria-hidden>
              !
            </div>
          </div>
          <button type="button" className="sgr-link">
            상세 보기 →
          </button>
        </article>
      </div>

      <div className="sgr-split">
        <section className="sgr-panel">
          <h3 className="sgr-h3">영역별 학업 성취도</h3>
          <div className="sgr-legend">
            <span className="sgr-pill is-s">
              <i /> 읽기
            </span>
            <span className="sgr-pill is-p">
              <i /> 듣기
            </span>
          </div>
          <div className="sgr-chart">
            <div className="sgr-y">
              <span>100</span>
              <span>75</span>
              <span>50</span>
              <span>25</span>
              <span>0</span>
            </div>
            {WEEKS.map((w) => (
              <div key={w.label} className="sgr-week">
                <div className="sgr-col is-s" style={{ height: `${w.read}%` }}>
                  <em>{w.read}%</em>
                </div>
                <div className="sgr-col is-p" style={{ height: `${w.listen}%` }}>
                  <em>{w.listen}%</em>
                </div>
              </div>
            ))}
            <div className="sgr-x">
              {WEEKS.map((w) => (
                <span key={w.label}>{w.label}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="sgr-panel">
          <h3 className="sgr-h3">주요 활동 달성률</h3>
          <div className="sgr-prog">
            <div>
              <div className="sgr-prog-row">
                <span>독서 과제</span>
                <span>95%</span>
              </div>
              <div className="sgr-track">
                <span style={{ width: '95%', background: '#dfc55b' }} />
              </div>
            </div>
            <div>
              <div className="sgr-prog-row">
                <span>주간 퀴즈</span>
                <span>78%</span>
              </div>
              <div className="sgr-track">
                <span style={{ width: '78%', background: '#006b5d' }} />
              </div>
            </div>
            <div>
              <div className="sgr-prog-row">
                <span>말하기 연습</span>
                <span>64%</span>
              </div>
              <div className="sgr-track">
                <span style={{ width: '64%', background: '#206488' }} />
              </div>
            </div>
          </div>
          <div className="sgr-tip">
            <div>
              <h4>인사이트</h4>
              <p>말하기 연습 참여도가 약간 저조합니다. 이번 주 게임 센터에 말하기 미션을 추가해보세요.</p>
            </div>
          </div>
        </section>
      </div>

      <div className="sgr-list-head">
        <h3 className="sgr-h3" style={{ margin: 0 }}>
          학생별 성취도
        </h3>
        <input
          className="sgr-search"
          type="search"
          placeholder="학생 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="sgr-students">
        {students.length === 0 ? (
          <p className="sgr-empty">검색 결과가 없어요.</p>
        ) : (
          students.map((s) => (
            <article key={s.name} className={`sgr-student${s.alert ? ' is-alert' : ''}`}>
              <div className="sgr-face">
                <img src={s.image} alt="" />
                {s.star && (
                  <span className="sgr-mark is-star" aria-hidden>
                    ★
                  </span>
                )}
                {s.alert && (
                  <span className="sgr-mark is-alert" aria-hidden>
                    !
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4>{s.name}</h4>
                <p>{s.note}</p>
                <div className="sgr-mini">
                  <span style={{ width: `${s.score}%`, background: barColor(s.score, s.alert) }} />
                </div>
              </div>
              <div className="sgr-score">
                <strong style={{ color: s.alert ? '#ba1a1a' : s.star ? '#006b5d' : '#191c1c' }}>{s.score}</strong>
                <span>점</span>
              </div>
            </article>
          ))
        )}
        {query.trim() === '' && (
          <button type="button" className="sgr-more">
            전체 학생 보기 (24명)
          </button>
        )}
      </div>
    </section>
  );
}

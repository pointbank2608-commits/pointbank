import { useState } from 'react';
import './StitchAttendance.css';

type Status = 'present' | 'absent' | 'late';

const STUDENTS = [
  {
    id: 'S-102',
    name: '김민준',
    status: 'present' as Status,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCfjlYy8hjUCbYJtioxE2nqNaViHWud53TkMeJznmdq11g10lmXJgTn2iQNfEwbzU3OZ8-LxWrsgSLGgD8uq8VPXW_gWW8MQuOzmjiEzYJVACoqrUuRdGgiJshMQyzw12HjZz2IlwLicQR4gBP0qwoqA17C0SvoL9aoBifSseoqRbhoRRsbHSOjE1zvi2n2H-60veWu5PIeom6anQYELR5__vt1p1MPRKgEwvcT6a7UZsaYcNgv38G0Pw',
    alt: '노란 강아지 캐릭터 아바타',
  },
  {
    id: 'S-105',
    name: '이지우',
    status: 'absent' as Status,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBLiEwZQgqOPVzNrbaoRcHAnE8_0n5qTXa5cNaovrBqr2e8KIxrW35oulmz0w-ugz7eAFvOyuoz-oHzungHxTaGKnS0nRDnnMLKb5GnAet-KteU5fiS07xrPRWfO_2EdChZcoUgwWQDM3k7Bl7qdCvsQb8bUT1aYEN57FoMVfBLLWM1MIflrem6g2VbjFb0B1ytK4xPtub4fQT_XnMSlMtmmeGbcvTt1cRtRBosRitLgmHCUpiB9-OMLw',
    alt: '초록 개구리 캐릭터 아바타',
  },
  {
    id: 'S-110',
    name: '박서연',
    status: 'present' as Status,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCJO9j48CGAYZQsINlXDujZLaOOWdeT85lW9bXgTHEAda5WLuDGDBr1m3pYMYoz5Z_6Jou5XouaEYn77pRs0m5OVUK8-PbO3ThppLQnJsWQtyRJeA7lAMeXGYIPejvJx7_B7Xc-lz-QyXHuLflBqWQ1vZ0CC9A3kjR5eSRXtlHqw17u2IcqNZLRB_XVQW80dQUUm-zOw55QpJ1-MeSmhZ40YeBax_OmWeimQznrIP68FmTXXRjZx3qFtw',
    alt: '안경 쓴 주황 고양이 캐릭터 아바타',
  },
  {
    id: 'S-118',
    name: '최도윤',
    status: 'late' as Status,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBS1Aq7D-lGzgwNr-5vbPL1h0oURgg4uUm2Kd-ak38kZGhnStbweRKgaOezrR_jNWYruiec5qxvr6QVT3NQMc2lyTkyQCVyS-C1z5q94GX4BHMjFoMPhc3Fq0vkJd90YYyIOljwtkVqpStMLj8qJtctnuMK24_AUVwaSgvTCrt7l86cKXNopT00HtI-i84iyTmS584B7kqfYu84z_v461cDzsbzrq6BLr1GAZD00N2SzumjAYI7mS67NA',
    alt: '파란 곰 캐릭터 아바타',
  },
];

const OPTIONS: { id: Status; label: string }[] = [
  { id: 'present', label: '출석' },
  { id: 'absent', label: '결석' },
  { id: 'late', label: '지각' },
];

export default function StitchAttendance() {
  const [marks, setMarks] = useState<Record<string, Status>>(
    Object.fromEntries(STUDENTS.map((s) => [s.id, s.status])),
  );

  return (
    <section className="sga" aria-label="출석 체크 미리보기">
      <header className="sga-head">
        <div>
          <h2 className="sga-title">출석 체크 (Grade 3 English)</h2>
          <p className="sga-sub">2024년 5월 20일, 월요일</p>
        </div>
        <div className="sga-actions">
          <button type="button" className="sga-btn is-ghost">
            이력 보기
          </button>
          <button type="button" className="sga-btn is-primary">
            저장하기
          </button>
        </div>
      </header>

      <div className="sga-grid">
        {STUDENTS.map((s) => {
          const status = marks[s.id];
          return (
            <article key={s.id} className="sga-card">
              <div className={`sga-bar is-${status}`} />
              <div className={`sga-avatar-wrap is-${status}`}>
                <img src={s.image} alt={s.alt} />
              </div>
              <h3 className="sga-name">{s.name}</h3>
              <span className="sga-id">학생 ID: {s.id}</span>
              <div className="sga-toggle" role="group" aria-label={`${s.name} 출석 상태`}>
                <div className={`sga-knob is-${status}`} />
                {OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={status === opt.id ? `is-on${opt.id === 'late' ? ' is-late' : ''}` : ''}
                    onClick={() => setMarks((prev) => ({ ...prev, [s.id]: opt.id }))}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

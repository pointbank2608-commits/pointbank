import { useState } from 'react';
import StitchAttendance from '../components/ui/StitchAttendance';
import StitchDashboard from '../components/ui/StitchDashboard';
import StitchReport from '../components/ui/StitchReport';
import './UiPreviewPage.css';

type Tab = 'dashboard' | 'attendance' | 'report';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: '대시보드' },
  { id: 'attendance', label: '출석부' },
  { id: 'report', label: '리포트' },
];

export default function UiPreviewPage() {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <>
      <div className="uip">
        <div className="section-title">스티치 UI 미리보기</div>
        <p className="uip-note">
          실제 반별 통장·출석부와는 연결되어 있지 않습니다. 화면 껍데기만 확인하는 임시 페이지입니다.
        </p>
        <div className="uip-tabs" role="tablist" aria-label="미리보기 화면">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`uip-tab${tab === t.id ? ' is-on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'dashboard' && <StitchDashboard />}
      {tab === 'attendance' && <StitchAttendance />}
      {tab === 'report' && <StitchReport />}
    </>
  );
}

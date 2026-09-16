import { Link } from 'react-router-dom';
import BrandMark from '../components/BrandMark';

/** 개인정보처리방침 — TermsPage.tsx와 같은 이유로 비로그인 라우트에 둔다. */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-on-background antialiased">
      <header className="border-b border-outline-variant/40">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-2.5 px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark className="h-8 w-8 shrink-0" />
            <span className="font-title-md text-title-md text-on-surface">클래스뱅크</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="mb-2 font-headline-lg-mobile text-headline-lg-mobile text-on-surface">개인정보처리방침</h1>
        <p className="mb-10 font-caption text-caption text-on-surface-variant">시행일: 2026년 9월 16일</p>

        <div className="space-y-8 font-body-md text-body-md leading-7 text-on-surface">
          <section>
            <p>
              플럭스미디어(이하 "회사")는 「개인정보 보호법」 등 관계 법령을 준수하며, 클래스뱅크 서비스(이하 "서비스")
              이용자의 개인정보를 안전하게 보호하기 위해 다음과 같이 개인정보처리방침을 수립·공개합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">1. 수집하는 개인정보 항목 및 수집 방법</h2>
            <div className="space-y-3">
              <div>
                <p className="font-bold">가. 선생님(회원) 계정</p>
                <p>필수: 이메일 주소, 비밀번호(암호화 저장), 학원(기관)명</p>
                <p>결제 시(유료 플랜): 결제수단 정보는 회사가 직접 저장하지 않으며, 전자지급결제대행사가 암호화하여 보관합니다.</p>
              </div>
              <div>
                <p className="font-bold">나. 학생 정보 (선생님이 직접 등록)</p>
                <p>이름, 소속 반, 포인트·출석·숙제 기록 등 수업 운영에 필요한 정보. 학생 개인정보의 서비스 등록·관리는 선생님(회원)의 책임 하에 이루어집니다.</p>
              </div>
              <div>
                <p className="font-bold">다. 자동 수집 정보</p>
                <p>서비스 이용 과정에서 접속 로그, 쿠키, 접속 IP, 이용 기기 정보가 자동으로 생성되어 수집될 수 있습니다.</p>
              </div>
              <p>수집 방법: 회원가입·서비스 이용 과정에서 이용자가 직접 입력하거나, 서비스 이용 중 자동으로 생성되어 수집됩니다.</p>
            </div>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">2. 개인정보의 수집 및 이용 목적</h2>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>회원 가입 의사 확인, 본인 확인, 계정 관리</li>
              <li>서비스(포인트 통장, 출석부, 숙제 캘린더, 단어장, 수업 게임 등) 제공 및 운영</li>
              <li>유료 플랜 이용 시 요금 산정·청구·결제 및 환불 처리</li>
              <li>공지사항 전달, 문의 응대, 서비스 개선을 위한 통계 분석</li>
            </ol>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">3. 개인정보의 보유 및 이용 기간</h2>
            <p>
              회사는 원칙적으로 개인정보 수집·이용 목적이 달성되거나 회원 탈퇴 시 해당 정보를 지체 없이 파기합니다.
              다만 관계 법령에 따라 보존할 필요가 있는 경우 아래와 같이 보관합니다.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
              <li>대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
              <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
              <li>웹사이트 방문 기록(로그): 3개월 (통신비밀보호법)</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">4. 개인정보 처리의 위탁</h2>
            <p>회사는 원활한 서비스 제공을 위해 아래와 같이 개인정보 처리 업무를 위탁하고 있습니다.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-outline-variant/60 text-on-surface-variant">
                    <th className="py-2 pr-4 font-label-md text-label-md">수탁업체</th>
                    <th className="py-2 pr-4 font-label-md text-label-md">위탁업무</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-outline-variant/30">
                    <td className="py-2 pr-4">아이원 네트웍스</td>
                    <td className="py-2 pr-4">문자메시지(SMS) 발송</td>
                  </tr>
                  <tr className="border-b border-outline-variant/30">
                    <td className="py-2 pr-4">엠엔와이즈 (카카오 알림톡)</td>
                    <td className="py-2 pr-4">카카오 알림톡 자동 메시지 발송</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">포트원(주), NHN 한국사이버결제(KCP)</td>
                    <td className="py-2 pr-4">유료 플랜 결제 및 정기결제 처리 대행</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-on-surface-variant">
              회사는 위탁계약 시 개인정보 보호를 위한 법적 사항을 명확히 규정하고, 수탁자가 개인정보를 안전하게 처리하는지
              감독합니다. 위탁 업체가 추가·변경되는 경우 이 방침을 통해 공지합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">5. 개인정보의 제3자 제공</h2>
            <p>
              회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 이용자가 사전에 동의한 경우, 또는
              법령의 규정에 의거하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우는
              예외로 합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">6. 이용자 및 법정대리인의 권리와 행사 방법</h2>
            <p>
              이용자는 언제든지 등록되어 있는 자신(또는 관리 중인 학생)의 개인정보를 조회·수정하거나 삭제(회원 탈퇴)를
              요청할 수 있습니다. 서비스 내 설정 화면 또는 아래 문의처를 통해 요청해 주시면 지체 없이 조치합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">7. 개인정보의 안전성 확보 조치</h2>
            <p>
              회사는 개인정보를 암호화하여 저장·관리하고, 접근 권한을 최소한의 인원으로 제한하며, 데이터베이스 접근 통제
              등 기술적·관리적 보호조치를 취하고 있습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">8. 개인정보 보호책임자</h2>
            <p>성명: 이동희 (대표)</p>
            <p>연락처: 010-7979-3621 | 이메일: fluxmedia20@naver.com</p>
            <p>
              이용자는 서비스 이용 중 발생한 모든 개인정보 관련 문의를 위 개인정보 보호책임자에게 문의할 수 있으며, 회사는
              신속하고 성실하게 답변하겠습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">9. 개인정보처리방침의 변경</h2>
            <p>
              이 방침은 법령·정책 또는 서비스 변경에 따라 개정될 수 있으며, 변경 시 서비스 내 공지를 통해 고지합니다.
            </p>
          </section>

          <section className="rounded-xl bg-surface-container-lowest p-5">
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">사업자 정보</h2>
            <div className="space-y-1 text-on-surface-variant">
              <p>상호: 플럭스미디어 | 대표: 이동희</p>
              <p>사업자등록번호: 522-26-02380</p>
              <p>통신판매업신고: 2026-부천소사-0565</p>
              <p>사업장 주소: 경기도 부천시 소사구 소사로 257, 6층 C59호(태한빌딩)</p>
              <p>고객센터: 010-7979-3621 | 이메일: fluxmedia20@naver.com</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

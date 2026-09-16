import { Link } from 'react-router-dom';
import BrandMark from '../components/BrandMark';

/**
 * 이용약관 — 로그인 없이도 봐야 한다(결제대행사 심사 봇, 방문자 전부). App.tsx의
 * 비로그인 라우트에 등록돼 있다. 사업자 정보는 랜딩 푸터(ko.ts landing.biz*)와 동일한
 * 실제 값을 그대로 옮겼다.
 */
export default function TermsPage() {
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
        <h1 className="mb-2 font-headline-lg-mobile text-headline-lg-mobile text-on-surface">이용약관</h1>
        <p className="mb-10 font-caption text-caption text-on-surface-variant">시행일: 2026년 9월 16일</p>

        <div className="space-y-8 font-body-md text-body-md leading-7 text-on-surface">
          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">제1조 (목적)</h2>
            <p>
              이 약관은 플럭스미디어(이하 "회사")가 제공하는 학원·공부방 수업 관리 서비스 "클래스뱅크"(이하 "서비스")의
              이용과 관련하여 회사와 회원 간의 권리·의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">제2조 (정의)</h2>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>"서비스"란 회사가 제공하는 웹 기반 학급 관리 도구(포인트 통장, 출석부, 숙제 캘린더, 단어장, 수업 게임 등)를 말합니다.</li>
              <li>"회원"이란 이 약관에 동의하고 서비스 이용계약을 체결한 학원·공부방 운영자(선생님) 및 그 소속 학생을 말합니다.</li>
              <li>"학원(기관)"이란 회원가입 시 등록되는 하나의 사업 단위를 말하며, 그 하위에 하나 이상의 "반"과 "학생"을 둘 수 있습니다.</li>
              <li>"유료 플랜"이란 제5조에 따라 요금을 지불하고 이용하는 플랜을 말하며, "무료 플랜"이란 요금 없이 제한된 기능만 이용하는 플랜을 말합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">제3조 (약관의 효력 및 변경)</h2>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>이 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이 발생합니다.</li>
              <li>
                회사는 관계 법령을 위배하지 않는 범위에서 이 약관을 개정할 수 있으며, 개정 시 적용일자 및 개정사유를
                명시하여 적용일 7일 전(회원에게 불리한 변경은 30일 전)부터 서비스 내 공지합니다.
              </li>
              <li>회원이 개정약관의 적용에 동의하지 않는 경우 이용계약을 해지할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">제4조 (서비스의 제공 및 변경)</h2>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>회사는 연중무휴, 1일 24시간 서비스 제공을 원칙으로 합니다. 다만 시스템 점검 등 필요한 경우 일시 중단될 수 있습니다.</li>
              <li>
                회사는 서비스 품질 향상을 위해 제공하는 기능의 전부 또는 일부를 변경·추가·중단할 수 있으며, 중요한 변경은
                사전에 공지합니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">제5조 (서비스 이용요금 및 플랜)</h2>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                <span className="font-bold">무료 플랜</span> — 반 1개, 학생 10명까지 등록할 수 있으며, 포인트 통장·출석부
                기능과 게임 센터 중 일부(돌림판, 사다리, 시한폭탄, 행맨)만 이용할 수 있습니다. 단어 사전, 파닉스, 내
                단어장, 내 커리큘럼, 수업 자료실, 리포트, 게임 센터의 나머지 게임은 유료 플랜에서만 이용할 수 있습니다.
              </li>
              <li>
                <span className="font-bold">유료 플랜</span> — 반·학생 수 제한 없이 전체 기능을 이용할 수 있습니다. 월
                기본요금은 9,900원(학생 10명까지 포함, 부가세 별도)이며, 등록 학생 수가 10명을 초과하는 경우 초과 인원
                1명당 월 5,000원(부가세 별도)이 기본요금에 추가로 청구됩니다.
              </li>
              <li>
                유료 플랜 요금은 매월 정기적으로 자동 청구되며, 청구 시점의 등록 학생 수를 기준으로 산정합니다. 결제는
                회원이 등록한 신용카드로 전자지급결제대행사를 통해 이루어집니다.
              </li>
              <li>구체적인 요금·플랜 구성은 서비스 내 요금 안내 화면에서 별도로 고지하며, 이 조와 배치되는 경우 서비스 내 고지가 우선합니다.</li>
              <li>환불에 관한 사항은 별도의 <Link to="/refund-policy" className="text-primary underline">환불정책</Link>을 따릅니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">제6조 (회원가입 및 계정 관리)</h2>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>회원가입은 이용자가 약관 내용에 동의하고 회사가 정한 절차에 따라 가입을 신청하면, 회사의 승낙으로 성립합니다.</li>
              <li>회원은 계정 정보를 본인이 직접 관리해야 하며, 제3자에게 양도·대여할 수 없습니다. 계정 도용을 인지한 경우 즉시 회사에 통지해야 합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">제7조 (회원의 의무 및 학생 데이터 관리 책임)</h2>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>회원(학원)은 등록하는 학생 정보에 대해 보호자 등 정당한 권한을 확보한 상태에서 서비스에 입력해야 합니다.</li>
              <li>회원은 서비스를 이용해 타인의 권리를 침해하거나 법령·공서양속에 반하는 행위를 해서는 안 됩니다.</li>
              <li>회원은 등록한 정보(이메일, 결제수단 등)를 최신 상태로 유지해야 하며, 이를 게을리하여 발생한 불이익은 회원이 부담합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">제8조 (계약 해지 및 이용 제한)</h2>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>회원은 서비스 내 설정 메뉴 또는 고객센터를 통해 언제든지 이용계약 해지(탈퇴)를 요청할 수 있습니다.</li>
              <li>
                회원이 이 약관을 위반하거나, 유료 플랜 이용료를 장기간 미납하는 경우 회사는 사전 통지 후 서비스 이용을
                제한하거나 계약을 해지할 수 있습니다.
              </li>
              <li>계약 해지 시 회원의 데이터는 관계 법령 및 회사의 개인정보처리방침에 따른 보유기간 경과 후 파기됩니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">제9조 (면책조항)</h2>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>회사는 천재지변, 회원의 귀책사유 등 회사가 통제할 수 없는 사유로 인한 서비스 장애에 대해 책임을 지지 않습니다.</li>
              <li>회사는 회원이 서비스에 입력한 정보(단어장, 학생 정보 등)의 정확성에 대해 보증하지 않습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">제10조 (분쟁해결)</h2>
            <p>
              이 약관과 관련하여 분쟁이 발생한 경우 회사와 회원은 상호 협의하여 원만히 해결하도록 노력하며, 협의가 되지
              않는 경우 관련 법령 및 상관례에 따릅니다. 소송이 필요한 경우 민사소송법상의 관할 법원에 제기합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">부칙</h2>
            <p>이 약관은 2026년 9월 16일부터 시행합니다.</p>
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

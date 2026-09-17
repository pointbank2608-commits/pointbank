import { Link } from 'react-router-dom';
import BrandMark from '../components/BrandMark';

/** 환불정책 — TermsPage.tsx와 같은 이유로 비로그인 라우트에 둔다. */
export default function RefundPolicyPage() {
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
        <h1 className="mb-2 font-headline-lg-mobile text-headline-lg-mobile text-on-surface">환불정책</h1>
        <p className="mb-10 font-caption text-caption text-on-surface-variant">시행일: 2026년 9월 17일</p>

        <div className="space-y-8 font-body-md text-body-md leading-7 text-on-surface">
          <section>
            <p>
              이 환불정책은 클래스뱅크(이하 "서비스")의 유료 플랜 결제·해지·환불에 관한 사항을 정합니다. 이 정책은
              「전자상거래 등에서의 소비자보호에 관한 법률」을 따르며, <Link to="/terms" className="text-primary underline">이용약관</Link>과
              함께 적용됩니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">1. 결제 및 청구 방식</h2>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>유료 플랜은 매월 정기적으로 자동 결제되는 구독형 서비스입니다.</li>
              <li>청구 금액은 등록 학생 수와 무관하게 <span className="font-bold">월 9,900원</span> 정액입니다.</li>
              <li>결제는 회원이 등록한 신용카드로 전자지급결제대행사(PG사)를 통해 이루어지며, 카드 정보는 회사가 보관하지 않습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">2. 청약철회 (결제 후 7일 이내)</h2>
            <p>
              최초 유료 플랜 결제일로부터 7일 이내에는 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조에 따라
              청약철회를 요청할 수 있으며, 해당 기간 동안 유료 기능을 실제로 사용하지 않은 경우 결제 금액 전액을
              환불합니다. 이미 유료 기능(게임 센터 전체, 확장 학생 등록 등)을 실제로 이용한 경우에는 이용한 일수만큼을
              차감하고 환불합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">3. 정기결제 해지 및 중도 환불</h2>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>회원은 서비스 내 설정 메뉴에서 언제든지 다음 결제 회차부터 자동결제를 해지(구독 취소)할 수 있습니다.</li>
              <li>해지 신청 시 이미 결제된 당월 이용료는 환불되지 않으며, 다음 결제 회차부터 청구가 중단됩니다(이용 기간 동안 서비스는 정상 이용 가능).</li>
              <li>
                다만 회사의 귀책사유(서비스 중대 장애 등)로 정상적인 서비스 이용이 불가능했던 기간이 있는 경우, 해당
                기간에 대해서는 일할 계산하여 환불합니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">4. 환불 절차 및 방법</h2>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>환불은 아래 문의처로 요청하면 접수일로부터 영업일 기준 3일 이내에 처리합니다.</li>
              <li>환불은 원칙적으로 결제에 사용한 수단(신용카드 승인 취소)으로 이루어집니다.</li>
              <li>카드사 사정에 따라 실제 환불(취소) 완료까지 3~5영업일이 추가로 소요될 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="mb-2 font-title-md text-title-md text-on-surface">5. 문의처</h2>
            <p>고객센터: 010-7979-3621 | 이메일: fluxmedia20@naver.com</p>
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

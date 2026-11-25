// 포트원 빌링키 결제 공통 로직 — register-billing-key(첫 결제)와
// charge-subscriptions(매달 결제)가 이 함수 하나를 공유한다. "청구액을 계산하고 →
// 포트원에 결제를 요청하고 → 결과를 돌려준다"만 한다. billing_history 기록·academies
// 갱신은 호출한 쪽(각 함수)에서 한다 — 실패 시에도 기록을 남겨야 하기 때문.
//
// 첫 결제와 갱신은 회차에 확정한 견적을 사용한다.

export interface ChargeResult {
  success: boolean;
  studentCount: number;
  amountKrw: number;
  portonePaymentId?: string;
  failureReason?: string;
}

const PORTONE_API_BASE = 'https://api.portone.io';
export const MONTHLY_SUBSCRIPTION_KRW = 9900;

export const studentMonthlyAmount = (count: number) => MONTHLY_SUBSCRIPTION_KRW + count * 4900;

export async function requireIssuedBillingKey(billingKey: string) {
  const apiSecret = Deno.env.get('PORTONE_API_SECRET');
  const channelKey = Deno.env.get('PORTONE_CHANNEL_KEY');
  if (!apiSecret || !channelKey) throw new Error('결제 서비스가 아직 준비되지 않았어요.');

  const response = await fetch(`${PORTONE_API_BASE}/billing-keys/${encodeURIComponent(billingKey)}`, {
    headers: { Authorization: `PortOne ${apiSecret}` },
  });
  if (!response.ok) throw new Error('등록된 카드를 확인하지 못했어요. 카드를 다시 등록해 주세요.');
  const info = await response.json() as { status?: string; channels?: Array<{ type?: string; key?: string }> };
  if (info.status !== 'ISSUED') throw new Error('사용할 수 없는 카드 등록 정보예요.');
  if (!info.channels?.some((channel) => channel.key === channelKey)) {
    throw new Error('현재 결제 채널에서 발급된 카드 등록 정보가 아니에요. 카드를 다시 등록해 주세요.');
  }
}

export async function chargeAcademy(
  academyId: string,
  billingKey: string,
  customerUid: string,
  // 결제 번호를 "학원 + 청구 기준일(한국 날짜) + 시도 횟수"로 정해, 같은 청구를 두 번 요청해도 포트원이 중복을 막게 한다(2026-10-18).
  // 예전에는 Date.now()를 써서 재실행하면 같은 청구가 두 번 결제될 수 있었다.
  opts: { dueDate: string; attempt: number; studentCount: number; amountKrw: number },
): Promise<ChargeResult> {
  const { studentCount, amountKrw } = opts;

  const apiSecret = Deno.env.get('PORTONE_API_SECRET');
  const channelKey = Deno.env.get('PORTONE_CHANNEL_KEY');
  if (!apiSecret || !channelKey) {
    return {
      success: false,
      studentCount,
      amountKrw,
      failureReason: '포트원 API 시크릿이나 결제 채널이 설정되지 않았어요.',
    };
  }

  // KCP는 주문번호를 40자까지 받는다. 날짜와 시도 번호를 포함해 재시도에도 같은 ID를 쓴다.
  const paymentSeed = new TextEncoder().encode(`${academyId}:${opts.dueDate}:${opts.attempt}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', paymentSeed));
  const paymentId = `sub_${Array.from(digest.slice(0, 18), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  const res = await fetch(`${PORTONE_API_BASE}/payments/${paymentId}/billing-key`, {
    method: 'POST',
    headers: {
      Authorization: `PortOne ${apiSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      billingKey,
      channelKey,
      orderName: '클래스뱅크 유료 플랜 구독료',
      customer: { id: customerUid },
      amount: { total: amountKrw },
      currency: 'KRW',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    // 재요청 전에 포트원에서 결제가 끝났다면 같은 청구 ID의 확정 금액으로 복구한다.
    if (res.status === 409 || /already[_ ]?paid/i.test(body)) {
      const previous = await fetch(`${PORTONE_API_BASE}/payments/${paymentId}`, {
        headers: { Authorization: `PortOne ${apiSecret}` },
      });
      if (previous.ok) {
        const payment = await previous.json();
        if (payment.status === 'PAID' && payment.channel?.key === channelKey &&
          payment.currency === 'KRW' && payment.amount?.total === amountKrw) {
          return { success: true, studentCount, amountKrw, portonePaymentId: paymentId };
        }
      }
    }
    if (res.status === 409 || res.status >= 500 || res.status === 408 || res.status === 429 || /already[_ ]?paid/i.test(body)) throw new Error("결제 결과 확인 대기");
    return { success: false, studentCount, amountKrw, failureReason: body.slice(0, 500) };
  }

  return { success: true, studentCount, amountKrw, portonePaymentId: paymentId };
}

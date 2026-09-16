// 포트원 빌링키 결제 공통 로직 — register-billing-key(첫 결제)와
// charge-subscriptions(매달 결제)가 이 함수 하나를 공유한다. "학생 수를 다시 세고 →
// 금액을 계산하고 → 포트원에 결제를 요청하고 → 결과를 돌려준다"만 한다. billing_history
// 기록·academies 갱신은 호출한 쪽(각 함수)에서 한다 — 실패 시에도 기록을 남겨야 하기 때문.

export interface ChargeResult {
  success: boolean;
  studentCount: number;
  amountKrw: number;
  portonePaymentId?: string;
  failureReason?: string;
}

const FREE_STUDENT_LIMIT = 10;
const PORTONE_API_BASE = 'https://api.portone.io';

/** 학생 10명 초과분 요금은 항상 "지금 이 순간"의 실제 학생 수로 다시 계산한다 — 클라이언트가
 * 보낸 값을 절대 믿지 않는다. */
export async function chargeAcademy(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  academyId: string,
  billingKey: string,
  customerUid: string,
): Promise<ChargeResult> {
  const { count, error: countError } = await supabaseAdmin
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('academy_id', academyId);
  if (countError) {
    return { success: false, studentCount: 0, amountKrw: 0, failureReason: `학생 수 조회 실패: ${countError.message}` };
  }

  const studentCount = count ?? 0;
  const baseFee = Number(Deno.env.get('BASE_FEE_KRW') ?? '9900');
  const perStudent = Number(Deno.env.get('PER_STUDENT_FEE_KRW') ?? '5000');
  const amountKrw = baseFee + Math.max(0, studentCount - FREE_STUDENT_LIMIT) * perStudent;

  const apiSecret = Deno.env.get('PORTONE_API_SECRET');
  if (!apiSecret) {
    // 채널키·API 시크릿이 아직 발급 전이면(KCP 승인 대기 중) 결제를 시도하지 않고 실패로
    // 기록만 남긴다 — 화면/배치 작업이 죽지 않는다.
    return {
      success: false,
      studentCount,
      amountKrw,
      failureReason: 'PORTONE_API_SECRET 시크릿이 아직 설정되지 않았어요(KCP 승인 대기 중).',
    };
  }

  const paymentId = `sub_${academyId}_${Date.now()}`;
  try {
    const res = await fetch(`${PORTONE_API_BASE}/payments/${paymentId}/billing-key`, {
      method: 'POST',
      headers: {
        Authorization: `PortOne ${apiSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        billingKey,
        orderName: '클래스뱅크 유료 플랜 구독료',
        customer: { id: customerUid },
        amount: { total: amountKrw },
        currency: 'KRW',
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { success: false, studentCount, amountKrw, failureReason: body.slice(0, 500) };
    }

    return { success: true, studentCount, amountKrw, portonePaymentId: paymentId };
  } catch (err) {
    return {
      success: false,
      studentCount,
      amountKrw,
      failureReason: err instanceof Error ? err.message : String(err),
    };
  }
}

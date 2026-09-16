import PortOne from '@portone/browser-sdk/v2';

/** 포트원 결제창 SDK 얇은 래퍼 — NHN KCP 채널키가 승인되기 전까지는 store/channel 값이
 * 비어 있을 수 있으니, 그 경우 화면이 깨지는 대신 친절한 안내 메시지로 실패하게 한다. */

function requireEnv(name: 'VITE_PORTONE_STORE_ID' | 'VITE_PORTONE_CHANNEL_KEY'): string {
  const value = import.meta.env[name] as string | undefined;
  if (!value) {
    throw new Error('결제 기능은 아직 준비 중이에요. 잠시 후 다시 시도해주세요.');
  }
  return value;
}

/**
 * 카드 등록(빌링키 발급) — 포트원이 띄우는 KCP 결제창에서 고객(선생님)이 직접 카드 정보를
 * 입력하고 3DS 인증까지 마친다. 우리 코드는 카드번호를 한 번도 직접 다루지 않는다.
 * 돌려주는 billingKey만 서버(Edge Function)로 넘기면 되고, 나머지(고객 식별자 등)는
 * 서버가 호출자의 academy_id 기준으로 알아서 정한다.
 */
export async function issueBillingKey(customerName: string): Promise<string> {
  const storeId = requireEnv('VITE_PORTONE_STORE_ID');
  const channelKey = requireEnv('VITE_PORTONE_CHANNEL_KEY');
  const issueId = `bk_${crypto.randomUUID()}`;

  const response = await PortOne.requestIssueBillingKey({
    storeId,
    channelKey,
    billingKeyMethod: 'CARD',
    issueId,
    issueName: '클래스뱅크 유료 플랜 카드 등록',
    customer: { fullName: customerName },
  });

  if (!response) {
    throw new Error('카드 등록이 취소됐어요.');
  }
  if (response.code) {
    throw new Error(response.message ?? '카드 등록에 실패했어요. 카드 정보를 다시 확인해주세요.');
  }
  if (!response.billingKey || response.billingKey === 'NEEDS_CONFIRMATION') {
    throw new Error('카드 등록 승인이 완료되지 않았어요. 다시 시도해주세요.');
  }

  return response.billingKey;
}

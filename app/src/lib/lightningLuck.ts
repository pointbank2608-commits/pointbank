/**
 * 번개 피하기 기본 문장(2026-10-16) — 날씨·폭풍 주제 12개. 수업 레시피와 워크시트가 같이 쓴다.
 * PPT "Bad Luck Billy"에는 단어·문장이 비어 있어(선생님이 채움) 수업 라이브러리에서 바로 쓸 수 있게 우리가 만들었다. 우리말은 Claude 초안.
 */
export interface LightningSample {
  en: string;
  ko: string;
  /** 빈칸 채우기에서 가리는 낱말 */
  blank: string;
}

export const LIGHTNING_SAMPLES: LightningSample[] = [
  { en: 'It is raining.', ko: '비가 와요.', blank: 'raining' },
  { en: 'The sky is dark.', ko: '하늘이 어두워요.', blank: 'dark' },
  { en: 'I hear thunder.', ko: '천둥소리가 들려요.', blank: 'thunder' },
  { en: 'Lightning is bright.', ko: '번개가 밝아요.', blank: 'bright' },
  { en: 'Take an umbrella.', ko: '우산을 챙겨요.', blank: 'umbrella' },
  { en: 'The wind is strong.', ko: '바람이 세요.', blank: 'strong' },
  { en: 'Stay inside, please.', ko: '안에 있어 주세요.', blank: 'inside' },
  { en: 'I see a rainbow.', ko: '무지개가 보여요.', blank: 'rainbow' },
  { en: 'The clouds are gray.', ko: '구름이 회색이에요.', blank: 'clouds' },
  { en: 'It is sunny today.', ko: '오늘은 맑아요.', blank: 'sunny' },
  { en: 'Wear a raincoat.', ko: '우비를 입어요.', blank: 'raincoat' },
  { en: 'The storm is over.', ko: '폭풍이 지나갔어요.', blank: 'storm' },
];

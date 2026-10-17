/** Explanatory notes must be edited into a short meaning before use in a meaning question. */
export function isMeaning(value: string): boolean {
  const s = value.trim();
  return (
    !!s &&
    s.length <= 45 &&
    !/[\n\r→=]/.test(s) &&
    !/(문법|예문|주의|규칙|설명|동사원형|주어|목적어|과거형|현재형|접속사|분사구문|\b(?:grammar|note|example)\s*:)/i.test(
      s,
    )
  );
}

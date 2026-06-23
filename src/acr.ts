/**
 * KLON がサポートする ACR (Authentication Context Class Reference) 値の定数集。
 *
 * 認可リクエストの `acr_values` パラメータに指定する認証強度を表す。
 * 強度は LOW < HIGH < VERY_HIGH の 3 段階で、上位の認証は下位を包含する。
 *
 * 実効的に要求される ACR は `claims.id_token.acr` > `acr_values` >
 * クライアント既定値 の優先順位で決定される。`acr_values` に複数指定した場合、
 * 先頭の値が UI 上の優先候補として扱われる。
 */
export const AcrValues = {
  /** メール OTP など低強度の認証 (`urn:klon:acr:low`)。 */
  LOW: "urn:klon:acr:low",
  /** JPKI 利用者証明用電子証明書相当 (`urn:klon:acr:high`)。 */
  HIGH: "urn:klon:acr:high",
  /** JPKI 署名用電子証明書相当 (`urn:klon:acr:very_high`)。 */
  VERY_HIGH: "urn:klon:acr:very_high",
} as const;

/** {@link AcrValues} の値のいずれかを表すユニオン型。 */
export type AcrValue = (typeof AcrValues)[keyof typeof AcrValues];

/** {@link AcrValues} の全値を列挙した配列。 */
export const allAcrValues: readonly AcrValue[] = Object.values(AcrValues);

/**
 * @example
 * ```ts
 * buildAcrValues([AcrValues.HIGH, AcrValues.VERY_HIGH])
 * // => "urn:klon:acr:high urn:klon:acr:very_high"
 * ```
 */
export function buildAcrValues(values: Iterable<string>, manualValue: string = ""): string {
  const fromManual = manualValue.split(/\s+/).filter((entry) => entry.length > 0);

  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of [...values, ...fromManual]) {
    if (!seen.has(v)) {
      seen.add(v);
      result.push(v);
    }
  }
  return result.join(" ");
}

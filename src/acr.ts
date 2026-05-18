export const AcrValues = {
  /** メールアドレス/外部IdP */
  LOW: "urn:klon:acr:low",
  /** JPKI 利用者証明用電子証明書相当 */
  HIGH: "urn:klon:acr:high",
  /** JPKI 署名用電子証明書相当 */
  VERY_HIGH: "urn:klon:acr:very_high",
} as const;

export type AcrValue = (typeof AcrValues)[keyof typeof AcrValues];

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

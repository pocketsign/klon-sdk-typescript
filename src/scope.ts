export const Scopes = {
  /** OpenID Connect */
  OPENID: "openid",
  /** 氏名/生年月日/性別 */
  PROFILE: "profile",
  /** メールアドレス */
  EMAIL: "email",
  /** リフレッシュトークン */
  OFFLINE_ACCESS: "offline_access",
  /** 住所 */
  ADDRESS: "address",
  /** 電話番号 */
  PHONE: "phone",
  /** 基本4情報 */
  PERSONAL_INFO: "personal_info",
} as const;

export type Scope = (typeof Scopes)[keyof typeof Scopes];

export const allScopes: readonly Scope[] = Object.values(Scopes);

/**
 * @example
 * ```ts
 * buildScope([Scopes.OPENID, Scopes.PROFILE])
 * // => "openid profile"
 * ```
 */
export function buildScope(scopes: Iterable<string>): string {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const scope of scopes) {
    if (!seen.has(scope)) {
      seen.add(scope);
      result.push(scope);
    }
  }
  return result.join(" ");
}

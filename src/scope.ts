/**
 * KLON がサポートする OAuth/OIDC スコープの定数集。
 *
 * 認可リクエストの `scope` パラメータに指定する。`profile` / `email` などは
 * 単なる表示用ラベルではなく、対応する Registry リソースの読み取り権限要求として扱われる。
 */
export const Scopes = {
  /** OpenID Connect。ID トークンの発行を要求する。 */
  OPENID: "openid",
  /** 氏名/生年月日/性別 (name / gender / birthdate) の読み取り権限。 */
  PROFILE: "profile",
  /** メールアドレス (email / email_verified) の読み取り権限。 */
  EMAIL: "email",
  /** リフレッシュトークンの発行を要求する。 */
  OFFLINE_ACCESS: "offline_access",
  /** 住所 (address) の読み取り権限。 */
  ADDRESS: "address",
  /** 電話番号 (phone_number / phone_number_verified) の読み取り権限。 */
  PHONE: "phone",
  /** 基本4情報の読み取り権限。 */
  PERSONAL_INFO: "personal_info",
} as const;

/** {@link Scopes} の値のいずれかを表すユニオン型。 */
export type Scope = (typeof Scopes)[keyof typeof Scopes];

/** {@link Scopes} の全値を列挙した配列。 */
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

/**
 * KLON ID Token のデコード済みクレーム。
 *
 * `exchangeCode()` / `refreshToken()` の戻り値 `TokenSet.idTokenClaims` として取得できる。
 * フィールド名は JWT クレーム名 (snake_case) をそのまま使用する。
 *
 * 本型に定義されていないクレームも実行時のオブジェクトには保持されるため、
 * 参照する場合はこの interface を拡張する
 * (例: `interface MyClaims extends IDTokenClaims { foo?: string }`)。
 */
export interface IDTokenClaims {
  // --- Standard OIDC (always present) ---
  /** Issuer identifier (IdP URL) */
  iss: string;
  /**
   * Subject identifier (pairwise, RP-specific)。
   * KLON ではサービスごとの subscription_id が入る。
   */
  sub: string;
  /** Audience (client ID) */
  aud: string | string[];
  /** Issued-at time (Unix epoch seconds) */
  iat: number;
  /** Expiration time (Unix epoch seconds) */
  exp: number;
  /** Nonce echoed from the authorization request */
  nonce?: string;

  // --- Auth context (always present) ---
  /** Time of user authentication (Unix epoch seconds) */
  auth_time: number;
  /** Authentication context class reference */
  acr: string;
  /** Authentication methods used */
  amr: string[];
  /** IdP-RP session identifier */
  sid?: string;

  // --- KLON-specific (always present) ---
  /** Whether the user's account is bound to JPKI */
  jpki_verified: boolean;

  // --- Profile (scope: "profile") ---
  /** 氏名 (scope: "profile") */
  name?: string;
  /** 性別 (scope: "profile") */
  gender?: string;
  /** 生年月日 (scope: "profile") */
  birthdate?: string;

  // --- Email (scope: "email") ---
  /** メールアドレス (scope: "email") */
  email?: string;
  /** メールアドレスが検証済みかどうか (scope: "email") */
  email_verified?: boolean;

  // --- Address (scope: "address") ---
  /** 住所 (scope: "address") */
  address?: string;

  // --- Phone (scope: "phone") ---
  /** 電話番号 (scope: "phone") */
  phone_number?: string;
  /** 電話番号が検証済みかどうか (scope: "phone") */
  phone_number_verified?: boolean;
}

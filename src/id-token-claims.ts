/**
 * KLON ID Token のデコード済みクレーム。
 *
 * `exchangeCode()` / `refreshToken()` の戻り値 `TokenSet.idTokenClaims` として取得できる。
 * フィールド名は JWT クレーム名 (snake_case) をそのまま使用する。
 */
export interface IDTokenClaims {
  // --- Standard OIDC (always present) ---
  /** Issuer identifier (IdP URL) */
  iss: string;
  /** Subject identifier (pairwise, RP-specific) */
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
  /** IdP user ID (only if IncludeUserIDClaim is enabled for the RP) */
  uid?: string;
  /** Whether the user's account is bound to JPKI */
  jpki_verified: boolean;

  // --- Profile (scope: "profile") ---
  name?: string;
  gender?: string;
  birthdate?: string;

  // --- Email (scope: "email") ---
  email?: string;
  email_verified?: boolean;

  // --- Address (scope: "address") ---
  address?: string;

  // --- Phone (scope: "phone") ---
  phone_number?: string;
  phone_number_verified?: boolean;
}

import type { AuthorizationDetail, AuthorizationDetailInput } from "./authorization-details";
import type { DPoPOptions } from "./dpop";
import type { GrantManagementAction } from "./grant-management";
import type { IDTokenClaims } from "./id-token-claims";

/** {@link createClient} に渡す KLON OIDC クライアントの設定。 */
export interface ClientConfig {
  /**
   * IdP の issuer URL。OIDC discovery のベースになる。
   * 環境ごとに異なるため、固定ホスト名を前提にせず明示的に渡すこと。
   */
  issuer: string;
  /** OAuth クライアント ID。 */
  clientId: string;
  /**
   * Confidential Client の場合に指定する。
   * 省略時は Public Client (SPA / ネイティブ向け) として扱われる。
   */
  clientSecret?: string;
  /** 認可コールバックを受け取るリダイレクト URI。 */
  redirectUri: string;
  /** React Native 環境では `expo/fetch` を渡す */
  customFetch?: typeof globalThis.fetch;
  /**
   * DPoP (RFC 9449) を有効化する。
   * 指定すると PAR / token / bindNativeSession に DPoP proof が自動付与され、
   * 発行されるアクセストークンは sender-constrained になる (token_type=DPoP)。
   */
  dpop?: DPoPOptions;
  /**
   * HTTP (非 HTTPS) エンドポイントへのリクエストを許可する。
   * ローカル開発で issuer が `http://` の場合にのみ有効化すること。
   * 本番では必ず false のまま。
   *
   * @deprecated 本番コードでは使わないこと。ローカル開発・検証目的の escape hatch。
   *   oauth4webapi の同名シンボルも同じ意図で `@deprecated` が付けられている。
   */
  allowInsecureRequests?: boolean;
}

/** `client.createAuthorizationURL()` のオプション */
export interface AuthorizeOptions {
  /** スコープ配列。デフォルト: [Scopes.OPENID] */
  scopes?: readonly string[];
  /** RFC 9396 Authorization Details。SDK が JSON 文字列を自動構築する。 */
  authorizationDetails?: readonly AuthorizationDetailInput[];
  /** ACR 値の配列 */
  acrValues?: readonly string[];
  /** prompt 値の配列 */
  prompt?: readonly string[];
  /** 認証の最大経過時間 (秒) */
  maxAge?: number;
  /** Grant Management API の操作種別 (`grant_management_action`)。 */
  grantManagementAction?: GrantManagementAction;
  /** RFC 9126 Pushed Authorization Requests */
  usePAR?: boolean;
}

/** コールバック処理に必要な認可フロー状態 */
export interface AuthorizationSession {
  /** CSRF 対策の state 値。コールバックで一致を検証する。 */
  state: string;
  /** ID Token のリプレイ対策に使う nonce 値。 */
  nonce: string;
  /** PKCE の code_verifier。トークン交換時に使う。 */
  codeVerifier: string;
  /** 認可リクエスト時に使用したリダイレクト URI。 */
  redirectUri: string;
  /** 認可リクエスト時に指定した max_age。コールバック時の auth_time 検証に使う。 */
  maxAge?: number;
}

/** `client.bindNativeSession()` の結果 */
export interface BindNativeSessionResult {
  /** バインド完了後に WebView に読み込ませる URL */
  bindCompleteUrl: string;
}

/** トークンエンドポイントの応答を正規化したトークン一式。 */
export interface TokenSet {
  /** アクセストークン。 */
  accessToken: string;
  /** oauth4webapi により小文字化された token_type。通常 "bearer" または "dpop" */
  tokenType: "bearer" | "dpop" | Lowercase<string>;
  /** 有効期限 (秒) */
  expiresIn?: number;
  /** リフレッシュトークン (発行された場合)。 */
  refreshToken?: string;
  /** ID Token (JWT 文字列)。 */
  idToken?: string;
  /** ID Token のデコード済みクレーム。idToken が存在する場合にセットされる。 */
  idTokenClaims?: IDTokenClaims;
  /** 実際に許可されたスコープ (スペース区切り)。 */
  scope?: string;
  /** 許可された認可詳細 (RFC 9396) の配列。 */
  authorizationDetails?: AuthorizationDetail[];
}

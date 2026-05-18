import type { AuthorizationDetail, AuthorizationDetailInput } from "./authorization-details";
import type { DPoPOptions } from "./dpop";
import type { GrantManagementAction } from "./grant-management";
import type { IDTokenClaims } from "./id-token-claims";

export interface ClientConfig {
  issuer: string;
  clientId: string;
  /** Confidential Client の場合に指定 */
  clientSecret?: string;
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
  grantManagementAction?: GrantManagementAction;
  /** RFC 9126 Pushed Authorization Requests */
  usePAR?: boolean;
}

/** コールバック処理に必要な認可フロー状態 */
export interface AuthorizationSession {
  state: string;
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
}

/** `client.bindNativeSession()` の結果 */
export interface BindNativeSessionResult {
  /** バインド完了後に WebView に読み込ませる URL */
  bindCompleteUrl: string;
}

export interface TokenSet {
  accessToken: string;
  /** 通常 "Bearer" */
  tokenType: string;
  /** 有効期限 (秒) */
  expiresIn?: number;
  refreshToken?: string;
  idToken?: string;
  /** ID Token のデコード済みクレーム。idToken が存在する場合にセットされる。 */
  idTokenClaims?: IDTokenClaims;
  scope?: string;
  authorizationDetails?: AuthorizationDetail[];
}

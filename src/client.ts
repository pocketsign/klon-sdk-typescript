/**
 * KLON OIDC クライアント
 *
 * oauth4webapi をベースに、KLON 固有のパラメータ構築を内包する。
 *
 * @example
 * ```ts
 * const client = createClient({ issuer, clientId, redirectUri });
 *
 * // 認可
 * const { url, session } = await client.createAuthorizationURL({
 *   resources: [{ identifiers: [Resources.MERGED_FULL_NAME], actions: ["read"] }],
 *   scopes: [Scopes.OPENID, Scopes.PROFILE],
 * });
 *
 * // コールバック
 * const tokens = await client.exchangeCode(code, state, session);
 * ```
 *
 * @see https://github.com/panva/oauth4webapi
 */

import * as oauth from "oauth4webapi";
import type { AuthorizationDetail } from "./authorization-details";
import { buildAuthorizationDetails, isAuthorizationDetail } from "./authorization-details";
import { bindNativeSession as bindNativeSessionRequest } from "./bind";
import { buildScope } from "./scope";
import { buildAcrValues } from "./acr";
import { buildPrompt } from "./prompt";
import { getOrCreateDPoPHandle, resetDPoPHandle } from "./dpop";
import type { IDTokenClaims } from "./id-token-claims";
import type {
  AuthorizeOptions,
  AuthorizationSession,
  BindNativeSessionResult,
  ClientConfig,
  TokenSet,
} from "./types";

type InternalAuthorizeOptions = AuthorizeOptions & {
  /** pocketsign向けの非公開UI開始位置ヒント。公開APIとしては扱わない。 */
  klonAuthEntry?: "email";
};

/**
 * KLON OIDC クライアント。
 *
 * oauth4webapi をベースに、KLON 固有のパラメータ構築 (認可詳細・ACR・prompt 等) と
 * DPoP バインディングを内包する。通常は {@link createClient} 経由で生成する。
 *
 * 認可フローは PKCE (`code_challenge_method=S256` のみ) を必須とし、
 * トークン取得は `authorization_code` / `refresh_token` の 2 種の grant_type を扱う。
 * issuer は環境ごとに異なるため、固定ホスト名を前提にせず {@link ClientConfig.issuer}
 * で渡すこと。
 */
export class OIDCClient {
  private config: ClientConfig;
  private discoveryPromise: Promise<oauth.AuthorizationServer> | null = null;

  constructor(config: ClientConfig) {
    this.config = config;
  }

  private discover(): Promise<oauth.AuthorizationServer> {
    if (this.discoveryPromise !== null) {
      return this.discoveryPromise;
    }

    this.discoveryPromise = (async () => {
      try {
        const issuerUrl = new URL(this.config.issuer);
        const response = await oauth.discoveryRequest(issuerUrl, {
          algorithm: "oidc",
          ...this.fetchOptions(),
        });
        return oauth.processDiscoveryResponse(issuerUrl, response);
      } catch (err) {
        // 失敗時はキャッシュをクリアして再試行可能にする
        this.discoveryPromise = null;
        throw err;
      }
    })();

    return this.discoveryPromise;
  }

  /**
   * 認可 URL を生成する。
   *
   * 返された `session` はコールバック処理に必要なのでセッションストレージに保存すること。
   * `JSON.stringify(session)` / `JSON.parse()` でシリアライズ可能。
   *
   * @param options 認可リクエストのオプション (スコープ・認可詳細・ACR・prompt 等)
   * @returns リダイレクト先の `url` と、コールバック処理で使う `session`
   */
  async createAuthorizationURL(options: AuthorizeOptions = {}): Promise<{
    /** ユーザーをリダイレクトする認可エンドポイントの URL。 */
    url: URL;
    /** コールバック処理に渡す認可フロー状態。永続化が必要。 */
    session: AuthorizationSession;
  }> {
    const as = await this.discover();

    const codeVerifier = oauth.generateRandomCodeVerifier();
    const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);

    const state = oauth.generateRandomState();
    const nonce = oauth.generateRandomNonce();

    // Layer 2: 配列から文字列を構築
    const scope = options.scopes ? buildScope(options.scopes) : "openid";
    const authorizationDetails = options.authorizationDetails
      ? buildAuthorizationDetails(options.authorizationDetails)
      : undefined;
    const acrValues = options.acrValues ? buildAcrValues(options.acrValues) : undefined;
    const prompt = options.prompt ? buildPrompt(options.prompt) : undefined;

    const authorizationParams = new URLSearchParams();
    authorizationParams.set("client_id", this.config.clientId);
    authorizationParams.set("response_type", "code");
    authorizationParams.set("redirect_uri", this.config.redirectUri);
    authorizationParams.set("scope", scope);
    authorizationParams.set("state", state);
    authorizationParams.set("nonce", nonce);
    authorizationParams.set("code_challenge", codeChallenge);
    authorizationParams.set("code_challenge_method", "S256");

    if (authorizationDetails) {
      authorizationParams.set("authorization_details", authorizationDetails);
    }
    if (acrValues) {
      authorizationParams.set("acr_values", acrValues);
    }
    if (prompt) {
      authorizationParams.set("prompt", prompt);
    }
    if (options.maxAge !== undefined) {
      authorizationParams.set("max_age", options.maxAge.toString());
    }
    if (options.grantManagementAction) {
      authorizationParams.set("grant_management_action", options.grantManagementAction);
    }
    const klonAuthEntry = (options as InternalAuthorizeOptions).klonAuthEntry;
    if (klonAuthEntry) {
      authorizationParams.set("klon_auth_entry", klonAuthEntry);
    }

    const authorizationEndpoint = as.authorization_endpoint;
    if (!authorizationEndpoint) {
      throw new Error("Authorization server does not expose an authorization_endpoint");
    }

    // RFC 9449 Section 10: 認可リクエストの DPoP バインディング用に dpop_jkt を付与する
    const dpopHandle = await this.getDPoPHandle();
    if (dpopHandle) {
      authorizationParams.set("dpop_jkt", await dpopHandle.calculateThumbprint());
    }

    let authorizationUrl: URL;
    if (options.usePAR) {
      if (!as.pushed_authorization_request_endpoint) {
        throw new Error(
          "Authorization server does not expose a pushed_authorization_request_endpoint",
        );
      }

      const client = this.getClient();
      const response = await oauth.pushedAuthorizationRequest(
        as,
        client,
        this.getClientAuth(),
        authorizationParams,
        { ...this.fetchOptions(), DPoP: dpopHandle },
      );
      const parResponse = await oauth.processPushedAuthorizationResponse(as, client, response);

      authorizationUrl = new URL(authorizationEndpoint);
      authorizationUrl.searchParams.set("client_id", this.config.clientId);
      authorizationUrl.searchParams.set("request_uri", parResponse.request_uri);
    } else {
      authorizationUrl = new URL(authorizationEndpoint);
      for (const [key, value] of authorizationParams.entries()) {
        authorizationUrl.searchParams.set(key, value);
      }
    }

    return {
      url: authorizationUrl,
      session: {
        state,
        nonce,
        codeVerifier,
        redirectUri: this.config.redirectUri,
        maxAge: options.maxAge,
      },
    };
  }

  /**
   * 認可コードをトークンに交換する。
   *
   * @param code コールバックで受け取った認可コード
   * @param state コールバックで受け取った state パラメータ
   * @param session `createAuthorizationURL()` で返されたセッション
   */
  async exchangeCode(
    code: string,
    state: string,
    session: AuthorizationSession,
  ): Promise<TokenSet> {
    const as = await this.discover();
    const client = this.getClient();
    const clientAuth = this.getClientAuth();

    const callbackUrl = new URL(session.redirectUri);
    callbackUrl.searchParams.set("code", code);
    callbackUrl.searchParams.set("state", state);

    const params = oauth.validateAuthResponse(as, client, callbackUrl, session.state);

    const dpopHandle = await this.getDPoPHandle();
    const response = await oauth.authorizationCodeGrantRequest(
      as,
      client,
      clientAuth,
      params,
      session.redirectUri,
      session.codeVerifier,
      { ...this.fetchOptions(), DPoP: dpopHandle },
    );

    const result = await oauth.processAuthorizationCodeResponse(as, client, response, {
      expectedNonce: session.nonce,
      requireIdToken: true,
      maxAge: session.maxAge,
    });

    await oauth.validateApplicationLevelSignature(as, response, this.fetchOptions());

    return toTokenSet(result);
  }

  /** リフレッシュトークンでアクセストークンを更新する */
  async refreshToken(refreshToken: string): Promise<TokenSet> {
    const as = await this.discover();
    const client = this.getClient();
    const clientAuth = this.getClientAuth();

    const dpopHandle = await this.getDPoPHandle();
    const response = await oauth.refreshTokenGrantRequest(as, client, clientAuth, refreshToken, {
      ...this.fetchOptions(),
      DPoP: dpopHandle,
    });

    const result = await oauth.processRefreshTokenResponse(as, client, response);
    if (result.id_token) {
      await oauth.validateApplicationLevelSignature(as, response, this.fetchOptions());
    }

    return toTokenSet(result);
  }

  /**
   * ネイティブアプリの WebView セッションをバインドする。
   *
   * `POST {issuer}/api/native/v1/bind` (NATIVE_BIND_PATH) を呼び出し、完了 URL を返す。
   * DPoP が設定されている場合は proof を自動付与する
   * (`Authorization: DPoP <token>` + `DPoP: <proof>`)。未設定時は Bearer で送る。
   *
   * @param bindId サーバーが発行した bind_id (bound_session_id)
   * @param accessToken アクセストークン (DPoP 有効時は DPoP-bound トークン)
   */
  async bindNativeSession(bindId: string, accessToken: string): Promise<BindNativeSessionResult> {
    return bindNativeSessionRequest({
      issuer: this.config.issuer,
      bindId,
      accessToken,
      fetchOptions: this.fetchOptions(),
      dpopHandle: await this.getDPoPHandle(),
    });
  }

  /**
   * DPoP 鍵ペアを破棄し、SDK 内部の DPoPHandle キャッシュも無効化する。
   *
   * ログアウト・アカウント切替・鍵漏洩時のローテーション等で呼ぶ。
   * `keyStore.clear()` 単独ではメモリ上の `DPoPHandle` (既存鍵ペア) が
   * 残り続け、以後のリクエストも古い鍵で署名されてしまう。このメソッドは
   * KeyStore の `clear()` に加えて内部キャッシュも破棄するため、
   * 次回リクエスト時に新しい鍵ペアが生成される。
   *
   * DPoP 未設定の場合は no-op。
   */
  async resetDPoPKey(): Promise<void> {
    if (this.config.dpop) {
      await this.config.dpop.keyStore.clear();
      resetDPoPHandle(this.config.dpop.keyStore);
    }
  }

  /**
   * DPoPHandle を KeyStore 単位の共有キャッシュから取得する。
   *
   * DPoPHandle はサーバー発行の nonce を origin ごとに保持するため、
   * 同じ KeyStore を使う SDK 内部リクエストと protected resource fetch で
   * 単一のハンドルを使い回す必要がある。
   * `dpop` 未設定時は undefined を返し、呼び出し側は通常の Bearer フローを維持する。
   */
  private getDPoPHandle(): Promise<oauth.DPoPHandle> | undefined {
    if (!this.config.dpop) {
      return undefined;
    }
    return getOrCreateDPoPHandle(this.config.dpop.keyStore);
  }

  private getClient(): oauth.Client {
    return {
      client_id: this.config.clientId,
    };
  }

  private getClientAuth(): oauth.ClientAuth {
    if (this.config.clientSecret) {
      return oauth.ClientSecretPost(this.config.clientSecret);
    }
    return oauth.None();
  }

  private fetchOptions(): Record<symbol, typeof globalThis.fetch | boolean> {
    const options: Record<symbol, typeof globalThis.fetch | boolean> = {};
    if (this.config.customFetch) {
      options[oauth.customFetch] = this.config.customFetch;
    }
    if (this.config.allowInsecureRequests) {
      // oauth4webapi は `@deprecated` マーカー付きでこのシンボルを公開している。
      // 削除予定のレガシー API ではなく、「HTTP を許可していることをエディタで目立たせる」
      // 意図的なフラグ付与。ローカル開発の escape hatch として使用。
      options[oauth.allowInsecureRequests] = true;
    }
    return options;
  }
}

/**
 * {@link ClientConfig} から {@link OIDCClient} を生成する。
 *
 * @param config クライアント設定 (issuer / clientId / redirectUri 等)
 * @returns 初期化済みの {@link OIDCClient}
 */
export function createClient(config: ClientConfig): OIDCClient {
  return new OIDCClient(config);
}

function toTokenSet(result: oauth.TokenEndpointResponse): TokenSet {
  const rawClaims = oauth.getValidatedIdTokenClaims(result);

  return {
    accessToken: result.access_token,
    tokenType: result.token_type,
    expiresIn: result.expires_in,
    refreshToken: result.refresh_token,
    idToken: result.id_token,
    idTokenClaims: rawClaims ? toIDTokenClaims(rawClaims) : undefined,
    scope: result.scope,
    authorizationDetails: result.authorization_details
      ?.map(toAuthorizationDetail)
      .filter((d): d is AuthorizationDetail => d !== null),
  };
}

function toIDTokenClaims(raw: oauth.IDToken): IDTokenClaims {
  return {
    // 型に定義されていないクレームも実行時のオブジェクトに保持し、
    // IDTokenClaims を拡張した型からアクセスできるようにする。
    ...raw,
    iss: raw.iss,
    sub: raw.sub,
    aud: raw.aud,
    iat: raw.iat,
    exp: raw.exp,
    nonce: raw.nonce,
    auth_time: raw.auth_time as number,
    acr: raw.acr as string,
    amr: raw.amr as string[],
    sid: raw.sid as string | undefined,
    jpki_verified: raw.jpki_verified as boolean,
    name: raw.name as string | undefined,
    gender: raw.gender as string | undefined,
    birthdate: raw.birthdate as string | undefined,
    email: raw.email as string | undefined,
    email_verified: raw.email_verified as boolean | undefined,
    address: raw.address as string | undefined,
    phone_number: raw.phone_number as string | undefined,
    phone_number_verified: raw.phone_number_verified as boolean | undefined,
  };
}

function toAuthorizationDetail(detail: oauth.AuthorizationDetails): AuthorizationDetail | null {
  const raw = detail as Record<string, unknown>;
  const candidate: Record<string, unknown> = {
    type: raw.type,
    identifiers: raw.identifiers,
    actions: raw.actions ?? [],
  };

  if (typeof raw.required === "boolean") {
    candidate.required = raw.required;
  }
  if (typeof raw.prefill === "boolean") {
    candidate.prefill = raw.prefill;
  }

  if (!isAuthorizationDetail(candidate)) {
    return null;
  }

  return candidate;
}

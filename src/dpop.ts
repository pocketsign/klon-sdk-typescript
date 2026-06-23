/**
 * DPoP (Demonstrating Proof of Possession, RFC 9449) 対応のための
 * KeyStore 抽象と鍵管理ヘルパ。
 *
 * DPoP はアクセストークンを鍵ペアにバインドし、盗まれたアクセストークンの
 * 転用リスクを下げる。proof JWT はリクエストごとに生成され、署名アルゴリズムは
 * ES256 のみ対応。token_type=DPoP のトークンには `cnf.jkt` (公開鍵の JWK
 * Thumbprint) が含まれる。
 *
 * oauth4webapi の `DPoP()` は `CryptoKeyPair` を直接受け取る API のため、
 * SDK はプラットフォーム非依存の保存/復元インターフェースだけを提供する。
 * 実装 (AsyncStorage / expo-secure-store / IndexedDB 等) はアプリ側で行う。
 *
 * @see https://www.rfc-editor.org/rfc/rfc9449
 */

import * as oauth from "oauth4webapi";

/**
 * DPoP proof 署名に使用するアルゴリズム (RFC 9449 Section 4.1)。
 * ES256 (ECDSA with P-256 and SHA-256) は全サーバ実装で必須サポート。
 */
const DPOP_SIGNING_ALG = "ES256";

/**
 * DPoP 署名鍵ペアの永続化インターフェース。
 *
 * SDK は初回に `load()` を呼び、`null` が返ると `generateKeyPair(DPOP_SIGNING_ALG)` で
 * 新規生成して `save()` を呼ぶ。アプリはこの interface を任意のストレージ
 * (AsyncStorage / expo-secure-store / IndexedDB 等) で実装する。
 *
 * @remarks
 * JWK エクスポートによる永続化を想定する場合、保存する鍵ペアは
 * `extractable: true` で生成される必要がある。SDK 側の鍵生成は
 * `extractable: true` を設定済み。
 */
export interface DPoPKeyStore {
  /** 保存済みの鍵ペアを読み出す。存在しない場合は null */
  load(): Promise<CryptoKeyPair | null>;
  /** 鍵ペアを保存する */
  save(keyPair: CryptoKeyPair): Promise<void>;
  /** 鍵ペアを破棄する (ログアウト時等) */
  clear(): Promise<void>;
}

/** `ClientConfig.dpop` に渡す設定 */
export interface DPoPOptions {
  /** DPoP 署名鍵ペアの永続化を担う {@link DPoPKeyStore}。 */
  keyStore: DPoPKeyStore;
}

/** {@link createDPoPFetch} に渡すオプション。 */
export interface CreateDPoPFetchOptions {
  /** DPoP 署名鍵ペアの永続化を担う {@link DPoPKeyStore}。 */
  keyStore: DPoPKeyStore;
  /** リクエストごとに最新のアクセストークンを返す関数。 */
  getAccessToken(): Promise<string>;
  /** React Native / Expo では `expo/fetch` などを渡す */
  fetch?: typeof globalThis.fetch;
  /**
   * HTTP (非 HTTPS) エンドポイントへのリクエストを許可する。
   * ローカル開発で API base URL が `http://` の場合にのみ有効化すること。
   * 本番では必ず false のまま。
   *
   * @deprecated 本番コードでは使わないこと。ローカル開発・検証目的の escape hatch。
   *   oauth4webapi の同名シンボルも同じ意図で `@deprecated` が付けられている。
   */
  allowInsecureRequests?: boolean;
}

/**
 * DPoP proof を自動付与する fetch 関数。
 *
 * 標準の `fetch` シグネチャに加えて、鍵をローテーションするための
 * `resetDPoPKey()` メソッドを持つ。
 */
export type DPoPFetch = typeof globalThis.fetch & {
  /** DPoP 鍵ペアを破棄し、KeyStore と内部キャッシュをクリアする。 */
  resetDPoPKey(): Promise<void>;
};

const dpopHandlePromises = new WeakMap<DPoPKeyStore, Promise<oauth.DPoPHandle>>();

/**
 * KeyStore から鍵ペアを読み出し、無ければ ES256 で生成して保存する。
 *
 * @internal
 */
export async function loadOrGenerateKeyPair(keyStore: DPoPKeyStore): Promise<CryptoKeyPair> {
  const existing = await keyStore.load();
  if (existing) {
    return existing;
  }
  const generated = await oauth.generateKeyPair(DPOP_SIGNING_ALG, { extractable: true });
  await keyStore.save(generated);
  return generated;
}

/**
 * KeyStore 単位で DPoPHandle を遅延生成して共有する。
 *
 * DPoPHandle はサーバー発行 nonce を origin ごとに保持するため、同じ鍵ペアを使う
 * SDK 内部リクエストと protected resource fetch で同じ handle を使い回す。
 *
 * @internal
 */
export function getOrCreateDPoPHandle(keyStore: DPoPKeyStore): Promise<oauth.DPoPHandle> {
  const cached = dpopHandlePromises.get(keyStore);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    try {
      const keyPair = await loadOrGenerateKeyPair(keyStore);
      return oauth.DPoP({}, keyPair);
    } catch (err) {
      dpopHandlePromises.delete(keyStore);
      throw err;
    }
  })();
  dpopHandlePromises.set(keyStore, promise);
  return promise;
}

/**
 * KeyStore に紐づく DPoPHandle キャッシュを破棄する。
 *
 * @internal
 */
export function resetDPoPHandle(keyStore: DPoPKeyStore): void {
  dpopHandlePromises.delete(keyStore);
}

/**
 * KLON access token を使う protected resource request に DPoP proof を自動付与する
 * fetch wrapper を作成する。
 *
 * リクエストごとに proof JWT を生成し、その `ath` がアクセストークンのハッシュと
 * 一致するように設定する。`Authorization` ヘッダは Bearer ではなく `DPoP <token>` を
 * 用いる。サーバーが nonce を要求した場合、リクエスト body が再送可能なときは
 * 自動でリトライする。
 *
 * @param options KeyStore・アクセストークン取得関数・カスタム fetch 等のオプション
 * @returns DPoP proof を自動付与する {@link DPoPFetch}
 */
export function createDPoPFetch(options: CreateDPoPFetchOptions): DPoPFetch {
  const baseFetch = options.fetch ?? globalThis.fetch;

  const dpopFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const accessToken = await options.getAccessToken();
    const dpopHandle = await getOrCreateDPoPHandle(options.keyStore);
    const request = toRequestParts(input, init);

    const send = () =>
      oauth.protectedResourceRequest(
        accessToken,
        request.method,
        request.url,
        new Headers(request.headers),
        request.body,
        {
          ...fetchOptions(baseFetch, options.allowInsecureRequests, request.fetchInit),
          DPoP: dpopHandle,
          signal: request.signal,
        },
      );

    try {
      return await send();
    } catch (err) {
      if (oauth.isDPoPNonceError(err) && request.canRetry) {
        return await send();
      }
      throw err;
    }
  }) as DPoPFetch;

  dpopFetch.resetDPoPKey = async () => {
    await options.keyStore.clear();
    resetDPoPHandle(options.keyStore);
  };

  return dpopFetch;
}

function fetchOptions(
  customFetch: typeof globalThis.fetch,
  allowInsecureRequests: boolean | undefined,
  baseInit: RequestInit,
): oauth.ProtectedResourceRequestOptions {
  const fetchForOAuth = (
    url: string,
    init: oauth.CustomFetchOptions<string, oauth.ProtectedResourceRequestBody>,
  ): Promise<Response> => customFetch(url, { ...baseInit, ...init } as unknown as RequestInit);
  const options: oauth.ProtectedResourceRequestOptions = {
    [oauth.customFetch]: fetchForOAuth,
  };
  if (allowInsecureRequests) {
    options[oauth.allowInsecureRequests] = true;
  }
  return options;
}

function toRequestParts(input: RequestInfo | URL, init: RequestInit | undefined) {
  const request = toRequest(input);
  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
  const headers = new Headers(request?.headers);
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }
  const body = (init?.body ?? request?.body ?? undefined) as oauth.ProtectedResourceRequestBody;

  return {
    url: toURL(input),
    method,
    headers,
    body,
    signal: init?.signal ?? request?.signal,
    fetchInit: { ...toRequestInit(request), ...init },
    canRetry: isReplayableBody(body),
  };
}

function toRequestInit(request: Request | undefined): RequestInit {
  if (!request) {
    return {};
  }
  return {
    cache: request.cache,
    credentials: request.credentials,
    integrity: request.integrity,
    keepalive: request.keepalive,
    mode: request.mode,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
  };
}

function isReplayableBody(body: oauth.ProtectedResourceRequestBody): boolean {
  if (body === null || body === undefined || typeof body === "string") {
    return true;
  }
  if (body instanceof URLSearchParams || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    return true;
  }
  return false;
}

function toRequest(input: RequestInfo | URL): Request | undefined {
  if (typeof Request === "undefined") {
    return undefined;
  }
  return input instanceof Request ? input : undefined;
}

function toURL(input: RequestInfo | URL): URL {
  if (input instanceof URL) {
    return input;
  }
  if (typeof input === "string") {
    return new URL(input);
  }
  const request = toRequest(input);
  if (request) {
    return new URL(request.url);
  }
  return new URL(input.url);
}

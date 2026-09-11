import { describe, expect, it, vi } from "vitest";
import { BindNativeSessionError } from "./bind";
import { createClient } from "./client";
import type { DPoPKeyStore } from "./dpop";
import type { BindNativeSessionErrorReason } from "./index";
import type { AuthorizeOptions } from "./types";

const ISSUER = "https://idp.example.com";
const CLIENT_ID = "test-client";
const REDIRECT_URI = "app://callback";
const NATIVE_BIND_PATH = "/api/native/v1/bind";

type InternalAuthorizeOptions = AuthorizeOptions & {
  klonAuthEntry?: "email";
};

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function discoveryResponse(extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/authorize`,
      token_endpoint: `${ISSUER}/token`,
      pushed_authorization_request_endpoint: `${ISSUER}/par`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      ...extra,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function parResponse(): Response {
  return new Response(
    JSON.stringify({ request_uri: "urn:ietf:params:oauth:request_uri:abc", expires_in: 60 }),
    { status: 201, headers: { "Content-Type": "application/json" } },
  );
}

function tokenResponse(idToken: string): Response {
  return new Response(
    JSON.stringify({
      access_token: "access-token-xyz",
      token_type: "DPoP",
      expires_in: 3600,
      id_token: idToken,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

async function expectBindNativeSessionError(
  promise: Promise<unknown>,
): Promise<BindNativeSessionError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(BindNativeSessionError);
    return error as BindNativeSessionError;
  }
  throw new Error("expected bindNativeSession to throw");
}

async function createMemoryKeyStore(): Promise<DPoPKeyStore> {
  let stored: CryptoKeyPair | null = null;
  return {
    load: async () => stored,
    save: async (kp) => {
      stored = kp;
    },
    clear: async () => {
      stored = null;
    },
  };
}

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function createIDTokenSigner(): Promise<{
  jwks: { keys: JsonWebKey[] };
  sign(payload: Record<string, unknown>): Promise<string>;
}> {
  const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const jwk = publicJwk as JsonWebKey & {
    alg: string;
    kid: string;
    use: string;
    key_ops: string[];
  };
  jwk.alg = "ES256";
  jwk.kid = "test-key";
  jwk.use = "sig";
  jwk.key_ops = ["verify"];

  return {
    jwks: { keys: [jwk] },
    sign: async (payload) => {
      const encodedHeader = base64UrlEncode(
        JSON.stringify({ alg: "ES256", kid: "test-key", typ: "JWT" }),
      );
      const encodedPayload = base64UrlEncode(JSON.stringify(payload));
      const signingInput = `${encodedHeader}.${encodedPayload}`;
      const signature = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        keyPair.privateKey,
        new TextEncoder().encode(signingInput),
      );
      return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
    },
  };
}

function tamperJWTSignature(rawJWT: string): string {
  const parts = rawJWT.split(".");
  if (parts.length !== 3 || !parts[2]) {
    throw new Error("invalid JWT");
  }
  const replacement = parts[2].at(0) === "A" ? "B" : "A";
  return `${parts[0]}.${parts[1]}.${replacement}${parts[2].slice(1)}`;
}

describe("private_key_jwt", () => {
  it("signs fresh assertions for PAR, code exchange, and repeated refresh", async () => {
    const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ]);
    const signer = await createIDTokenSigner();
    const ids = new Set<string>();
    const paths: string[] = [];
    let nonce = "";
    const customFetch: typeof fetch = async (input, init) => {
      const url = urlOf(input);
      if (url.includes("/.well-known/"))
        return discoveryResponse({
          jwks_uri: `${ISSUER}/jwks`,
          id_token_signing_alg_values_supported: ["ES256"],
        });
      if (url.endsWith("/jwks")) return Response.json(signer.jwks);
      const body = new URLSearchParams(init?.body as URLSearchParams);
      expect(new Headers(init?.headers).has("Authorization")).toBe(false);
      expect(body.has("client_secret")).toBe(false);
      expect(body.get("client_id")).toBe(CLIENT_ID);
      expect(body.get("client_assertion_type")).toBe(
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      );
      const [header, payload, signature] = body.get("client_assertion")!.split(".") as [
        string,
        string,
        string,
      ];
      const decode = (value: string) => atob(value.replaceAll("-", "+").replaceAll("_", "/"));
      expect(JSON.parse(decode(header))).toMatchObject({ alg: "ES256", kid: "client-key" });
      const claims = JSON.parse(decode(payload));
      expect(claims).toMatchObject({ iss: CLIENT_ID, sub: CLIENT_ID, aud: ISSUER });
      expect(claims.exp - claims.iat).toBe(60);
      expect(claims.exp).toBeGreaterThan(Date.now() / 1000);
      expect(claims.jti).toBeTruthy();
      expect(ids.has(claims.jti)).toBe(false);
      ids.add(claims.jti);
      expect(
        await crypto.subtle.verify(
          { name: "ECDSA", hash: "SHA-256" },
          keys.publicKey,
          Uint8Array.from(decode(signature), (char) => char.charCodeAt(0)),
          new TextEncoder().encode(`${header}.${payload}`),
        ),
      ).toBe(true);
      paths.push(new URL(url).pathname);
      if (url.endsWith("/par")) {
        nonce = body.get("nonce")!;
        return parResponse();
      }
      const idToken = await signer.sign({
        iss: ISSUER,
        sub: "user",
        aud: CLIENT_ID,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,
        nonce,
      });
      return Response.json({
        access_token: "access",
        token_type: "Bearer",
        refresh_token: "refresh",
        id_token: idToken,
      });
    };
    const client = createClient({
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      clientPrivateKey: { key: keys.privateKey, kid: "client-key" },
      customFetch,
    });
    const { session } = await client.createAuthorizationURL({ usePAR: true });
    expect((await client.exchangeCode("code", session.state, session)).accessToken).toBe("access");
    for (let i = 0; i < 2; i++) {
      expect((await client.refreshToken("refresh")).accessToken).toBe("access");
    }
    expect(paths).toEqual(["/par", "/token", "/token", "/token"]);
  });

  it("rejects conflicting credentials, public keys, unsupported curves, and empty kid", async () => {
    const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ]);
    const wrongCurve = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-384" },
      true,
      ["sign", "verify"],
    );
    const base = { issuer: ISSUER, clientId: CLIENT_ID, redirectUri: REDIRECT_URI };
    expect(() =>
      createClient({
        ...base,
        clientSecret: "secret",
        clientPrivateKey: { key: keys.privateKey, kid: "key" },
      }),
    ).toThrow("cannot be configured together");
    for (const clientPrivateKey of [
      { key: keys.publicKey, kid: "key" },
      { key: wrongCurve.privateKey, kid: "key" },
      { key: keys.privateKey, kid: " " },
    ]) {
      expect(() => createClient({ ...base, clientPrivateKey })).toThrow("ECDSA P-256");
    }
  });
});

describe("createClient (DPoP 統合)", () => {
  it("dpop 未指定時は PAR リクエストに DPoP ヘッダも dpop_jkt も付与しない", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(input);
      calls.push({ url, init });
      if (url.includes("/.well-known/")) return discoveryResponse();
      if (url.endsWith("/par")) return parResponse();
      throw new Error(`unexpected fetch: ${url}`);
    });

    const client = createClient({
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      customFetch: mockFetch as unknown as typeof globalThis.fetch,
    });

    const { url } = await client.createAuthorizationURL({ usePAR: true });

    const parCall = calls.find((c) => c.url.endsWith("/par"));
    expect(parCall).toBeDefined();
    const headers = new Headers(parCall?.init?.headers);
    expect(headers.has("DPoP")).toBe(false);
    const body = parCall?.init?.body as URLSearchParams;
    expect(body.has("dpop_jkt")).toBe(false);
    expect(url.searchParams.has("request_uri")).toBe(true);
  });

  it("非公開 klonAuthEntry 指定時は非 PAR 認可 URL に klon_auth_entry を含める", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.includes("/.well-known/")) return discoveryResponse();
      throw new Error(`unexpected fetch: ${url}`);
    });

    const client = createClient({
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      customFetch: mockFetch as unknown as typeof globalThis.fetch,
    });

    const { url } = await client.createAuthorizationURL({
      klonAuthEntry: "email",
      usePAR: false,
    } as InternalAuthorizeOptions);

    expect(url.searchParams.get("klon_auth_entry")).toBe("email");
  });

  it("非公開 klonAuthEntry 指定時は PAR ボディに klon_auth_entry を含める", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(input);
      calls.push({ url, init });
      if (url.includes("/.well-known/")) return discoveryResponse();
      if (url.endsWith("/par")) return parResponse();
      throw new Error(`unexpected fetch: ${url}`);
    });

    const client = createClient({
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      customFetch: mockFetch as unknown as typeof globalThis.fetch,
    });

    const { url } = await client.createAuthorizationURL({
      klonAuthEntry: "email",
      usePAR: true,
    } as InternalAuthorizeOptions);

    const parCall = calls.find((c) => c.url.endsWith("/par"));
    const body = parCall?.init?.body as URLSearchParams;
    expect(body.get("klon_auth_entry")).toBe("email");
    expect(url.searchParams.has("klon_auth_entry")).toBe(false);
    expect(url.searchParams.has("request_uri")).toBe(true);
  });

  it("dpop 指定時は PAR ボディに dpop_jkt を含み DPoP ヘッダも付与する", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(input);
      calls.push({ url, init });
      if (url.includes("/.well-known/")) return discoveryResponse();
      if (url.endsWith("/par")) return parResponse();
      throw new Error(`unexpected fetch: ${url}`);
    });

    const keyStore = await createMemoryKeyStore();
    const client = createClient({
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      customFetch: mockFetch as unknown as typeof globalThis.fetch,
      dpop: { keyStore },
    });

    await client.createAuthorizationURL({ usePAR: true });

    const parCall = calls.find((c) => c.url.endsWith("/par"));
    expect(parCall).toBeDefined();
    const headers = new Headers(parCall?.init?.headers);
    expect(headers.get("DPoP")).toBeTruthy();
    const body = parCall?.init?.body as URLSearchParams;
    expect(body.get("dpop_jkt")).toBeTruthy();
  });

  it("dpop 指定時は非 PAR 認可 URL にも dpop_jkt パラメータが付く", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.includes("/.well-known/")) return discoveryResponse();
      throw new Error(`unexpected fetch: ${url}`);
    });

    const keyStore = await createMemoryKeyStore();
    const client = createClient({
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      customFetch: mockFetch as unknown as typeof globalThis.fetch,
      dpop: { keyStore },
    });

    const { url } = await client.createAuthorizationURL({ usePAR: false });
    expect(url.searchParams.get("dpop_jkt")).toBeTruthy();
  });

  it("複数回の呼び出しで DPoPHandle と鍵ペアを使い回す", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.includes("/.well-known/")) return discoveryResponse();
      if (url.endsWith("/par")) return parResponse();
      throw new Error(`unexpected fetch: ${url}`);
    });

    const keyStore = await createMemoryKeyStore();
    const loadSpy = vi.spyOn(keyStore, "load");
    const saveSpy = vi.spyOn(keyStore, "save");

    const client = createClient({
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      customFetch: mockFetch as unknown as typeof globalThis.fetch,
      dpop: { keyStore },
    });

    await client.createAuthorizationURL({ usePAR: true });
    await client.createAuthorizationURL({ usePAR: true });

    // DPoPHandle はキャッシュされるので load/save は最大1回ずつ
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it("resetDPoPKey() は KeyStore.clear() を呼び、次回リクエストで新しい鍵を生成する", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.includes("/.well-known/")) return discoveryResponse();
      throw new Error(`unexpected fetch: ${url}`);
    });

    const keyStore = await createMemoryKeyStore();
    const clearSpy = vi.spyOn(keyStore, "clear");
    const loadSpy = vi.spyOn(keyStore, "load");

    const client = createClient({
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      customFetch: mockFetch as unknown as typeof globalThis.fetch,
      dpop: { keyStore },
    });

    // 初回リクエストで鍵ペア生成 + DPoPHandle キャッシュ (非 PAR だと URL に dpop_jkt が入る)
    const { url: urlBefore } = await client.createAuthorizationURL({ usePAR: false });
    const jktBefore = urlBefore.searchParams.get("dpop_jkt");
    expect(jktBefore).toBeTruthy();

    // キー破棄
    await client.resetDPoPKey();
    expect(clearSpy).toHaveBeenCalledTimes(1);

    // 次回リクエストでは再生成 → 別の thumbprint になる
    const { url: urlAfter } = await client.createAuthorizationURL({ usePAR: false });
    const jktAfter = urlAfter.searchParams.get("dpop_jkt");
    expect(jktAfter).toBeTruthy();
    expect(jktAfter).not.toBe(jktBefore);
    // load は 2 回呼ばれる (キャッシュ無効化により再読込)
    expect(loadSpy).toHaveBeenCalledTimes(2);
  });

  it("resetDPoPKey() は DPoP 未設定クライアントで no-op", async () => {
    const client = createClient({
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
    });
    await expect(client.resetDPoPKey()).resolves.toBeUndefined();
  });

  it("KeyStore.load() が失敗しても次回呼び出しで再試行する (rejected promise をキャッシュしない)", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.includes("/.well-known/")) return discoveryResponse();
      if (url.endsWith("/par")) return parResponse();
      throw new Error(`unexpected fetch: ${url}`);
    });

    let callCount = 0;
    const keyStore: DPoPKeyStore = {
      load: async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("transient storage error");
        }
        return null;
      },
      save: async () => {},
      clear: async () => {},
    };

    const client = createClient({
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      customFetch: mockFetch as unknown as typeof globalThis.fetch,
      dpop: { keyStore },
    });

    // 1回目: load が throw してエラーが伝播する
    await expect(client.createAuthorizationURL({ usePAR: true })).rejects.toThrow(
      "transient storage error",
    );

    // 2回目: キャッシュがクリアされているので load が再試行され成功する
    await expect(client.createAuthorizationURL({ usePAR: true })).resolves.toBeDefined();
    expect(callCount).toBe(2);
  });

  it("exchangeCode は署名検証の JWKS 取得にも customFetch を使う", async () => {
    const signer = await createIDTokenSigner();
    let expectedNonce = "";
    const calls: string[] = [];
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input);
      calls.push(url);
      if (url.includes("/.well-known/")) {
        return discoveryResponse({
          jwks_uri: `${ISSUER}/jwks`,
          id_token_signing_alg_values_supported: ["ES256"],
        });
      }
      if (url.endsWith("/token")) {
        const now = Math.floor(Date.now() / 1000);
        return tokenResponse(
          await signer.sign({
            iss: ISSUER,
            sub: "subject-123",
            aud: CLIENT_ID,
            iat: now,
            exp: now + 3600,
            nonce: expectedNonce,
            auth_time: now,
            acr: "urn:klon:acr:high",
            amr: ["jpki"],
            jpki_verified: true,
          }),
        );
      }
      if (url.endsWith("/jwks")) {
        return new Response(JSON.stringify(signer.jwks), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const client = createClient({
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      customFetch: mockFetch as unknown as typeof globalThis.fetch,
    });
    const { session } = await client.createAuthorizationURL();
    expectedNonce = session.nonce;

    const tokenSet = await client.exchangeCode("code-123", session.state, session);

    expect(tokenSet.tokenType).toBe("dpop");
    expect(calls.some((url) => url.endsWith("/jwks"))).toBe(true);
  });

  it("maxAge 指定時は ID Token の auth_time を検証する", async () => {
    const signer = await createIDTokenSigner();
    let expectedNonce = "";
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.includes("/.well-known/")) {
        return discoveryResponse({
          jwks_uri: `${ISSUER}/jwks`,
          id_token_signing_alg_values_supported: ["ES256"],
        });
      }
      if (url.endsWith("/token")) {
        const now = Math.floor(Date.now() / 1000);
        return tokenResponse(
          await signer.sign({
            iss: ISSUER,
            sub: "subject-123",
            aud: CLIENT_ID,
            iat: now,
            exp: now + 3600,
            nonce: expectedNonce,
            auth_time: now - 120,
            acr: "urn:klon:acr:high",
            amr: ["jpki"],
            jpki_verified: true,
          }),
        );
      }
      if (url.endsWith("/jwks")) {
        return new Response(JSON.stringify(signer.jwks), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const client = createClient({
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      customFetch: mockFetch as unknown as typeof globalThis.fetch,
    });
    const { session } = await client.createAuthorizationURL({ maxAge: 60 });
    expectedNonce = session.nonce;

    await expect(client.exchangeCode("code-123", session.state, session)).rejects.toThrow(
      /too much time has elapsed/,
    );
  });

  it("refreshToken は refresh response の ID Token 署名を検証する", async () => {
    const signer = await createIDTokenSigner();
    const calls: string[] = [];
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input);
      calls.push(url);
      if (url.includes("/.well-known/")) {
        return discoveryResponse({
          jwks_uri: `${ISSUER}/jwks`,
          id_token_signing_alg_values_supported: ["ES256"],
        });
      }
      if (url.endsWith("/token")) {
        const now = Math.floor(Date.now() / 1000);
        const idToken = await signer.sign({
          iss: ISSUER,
          sub: "subject-123",
          aud: CLIENT_ID,
          iat: now,
          exp: now + 3600,
          auth_time: now,
          acr: "urn:klon:acr:high",
          amr: ["jpki"],
          jpki_verified: true,
        });
        return tokenResponse(tamperJWTSignature(idToken));
      }
      if (url.endsWith("/jwks")) {
        return new Response(JSON.stringify(signer.jwks), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const client = createClient({
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      customFetch: mockFetch as unknown as typeof globalThis.fetch,
    });

    await expect(client.refreshToken("refresh-token-123")).rejects.toThrow();
    expect(calls.some((url) => url.endsWith("/jwks"))).toBe(true);
  });
});

describe("bindNativeSession", () => {
  it("DPoP 未設定時は Authorization: Bearer で送る", async () => {
    const capturedHeaders: Headers[] = [];
    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(input);
      if (url.endsWith(NATIVE_BIND_PATH)) {
        capturedHeaders.push(new Headers(init?.headers));
        return new Response(
          JSON.stringify({ bind_complete_url: `${ISSUER}/auth/native/bind_complete` }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const client = createClient({
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      customFetch: mockFetch as unknown as typeof globalThis.fetch,
    });

    const result = await client.bindNativeSession("bind-123", "access-token-xyz");

    expect(result.bindCompleteUrl).toBe(`${ISSUER}/auth/native/bind_complete`);
    expect(capturedHeaders[0].get("Authorization")).toBe("Bearer access-token-xyz");
    expect(capturedHeaders[0].has("DPoP")).toBe(false);
  });

  it("DPoP 設定時は Authorization: DPoP と DPoP ヘッダが付く", async () => {
    const capturedHeaders: Headers[] = [];
    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(input);
      if (url.endsWith(NATIVE_BIND_PATH)) {
        capturedHeaders.push(new Headers(init?.headers));
        return new Response(
          JSON.stringify({ bind_complete_url: `${ISSUER}/auth/native/bind_complete` }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const keyStore = await createMemoryKeyStore();
    const client = createClient({
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      customFetch: mockFetch as unknown as typeof globalThis.fetch,
      dpop: { keyStore },
    });

    await client.bindNativeSession("bind-123", "access-token-xyz");

    expect(capturedHeaders[0].get("Authorization")).toBe("DPoP access-token-xyz");
    expect(capturedHeaders[0].get("DPoP")).toBeTruthy();
  });

  it("bind_complete_url の origin が issuer と違えば例外", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.endsWith(NATIVE_BIND_PATH)) {
        return new Response(
          JSON.stringify({ bind_complete_url: "https://evil.example.com/redirect" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const client = createClient({
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      customFetch: mockFetch as unknown as typeof globalThis.fetch,
    });

    await expect(client.bindNativeSession("bind-123", "token")).rejects.toThrow(
      /bind_complete_url origin/,
    );
  });

  it("HTTP エラーを例外として投げる", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.endsWith(NATIVE_BIND_PATH)) {
        return new Response(JSON.stringify({ error: "invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const client = createClient({
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      customFetch: mockFetch as unknown as typeof globalThis.fetch,
    });

    const error = await expectBindNativeSessionError(
      client.bindNativeSession("bind-123", "bad-token"),
    );
    expect(error.message).toMatch(/HTTP 401/);
    expect(error.status).toBe(401);
    expect(error.error).toBe("invalid token");
    expect(error.reason).toBeUndefined();
  });

  it.each([
    ["既知", "bind_session_expired"],
    ["将来追加される未知", "future_reason"],
  ] satisfies [string, BindNativeSessionErrorReason][])(
    "HTTP エラーの%s reason を BindNativeSessionError に保持する",
    async (_kind, reason) => {
      const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = urlOf(input);
        if (url.endsWith(NATIVE_BIND_PATH)) {
          return new Response(JSON.stringify({ error: "bind failed", reason }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        throw new Error(`unexpected fetch: ${url}`);
      });

      const client = createClient({
        issuer: ISSUER,
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        customFetch: mockFetch as unknown as typeof globalThis.fetch,
      });

      const error = await expectBindNativeSessionError(
        client.bindNativeSession("bind-123", "bad-token"),
      );
      expect(error.message).toMatch(/HTTP 400/);
      expect(error.status).toBe(400);
      expect(error.error).toBe("bind failed");
      expect(error.reason).toBe(reason);
    },
  );

  it("HTTP エラー body が JSON でなくても status 付き BindNativeSessionError を投げる", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.endsWith(NATIVE_BIND_PATH)) {
        return new Response("upstream unavailable", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const client = createClient({
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      customFetch: mockFetch as unknown as typeof globalThis.fetch,
    });

    const error = await expectBindNativeSessionError(
      client.bindNativeSession("bind-123", "bad-token"),
    );
    expect(error.message).toMatch(/HTTP 503/);
    expect(error.status).toBe(503);
    expect(error.error).toBe("Session binding failed");
    expect(error.reason).toBeUndefined();
  });
});

import { describe, expect, it, vi } from "vitest";
import { createClient } from "./client";
import type { DPoPKeyStore } from "./dpop";

const ISSUER = "https://idp.example.com";
const CLIENT_ID = "test-client";
const REDIRECT_URI = "app://callback";
const NATIVE_BIND_PATH = "/api/native/v1/bind";

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function discoveryResponse(): Response {
  return new Response(
    JSON.stringify({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/authorize`,
      token_endpoint: `${ISSUER}/token`,
      pushed_authorization_request_endpoint: `${ISSUER}/par`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
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

    await expect(client.bindNativeSession("bind-123", "bad-token")).rejects.toThrow(/HTTP 401/);
  });
});

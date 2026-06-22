import * as oauth from "oauth4webapi";
import { describe, expect, it, vi } from "vitest";
import { createClient } from "./client";
import { createDPoPFetch, loadOrGenerateKeyPair, type DPoPKeyStore } from "./dpop";

function createMemoryKeyStore(): DPoPKeyStore {
  let stored: CryptoKeyPair | null = null;
  return {
    load: vi.fn(async () => stored),
    save: vi.fn(async (kp) => {
      stored = kp;
    }),
    clear: vi.fn(async () => {
      stored = null;
    }),
  };
}

function base64UrlDecode(input: string): Uint8Array {
  const base64 = input.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJsonPart<T>(input: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(input))) as T;
}

function decodeDPoPProof(proof: string): {
  header: { typ: string; alg: string; jwk: JsonWebKey };
  payload: { htm: string; htu: string; ath?: string; nonce?: string };
  signingInput: string;
  signature: Uint8Array;
} {
  const [encodedHeader, encodedPayload, encodedSignature] = proof.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("invalid DPoP proof");
  }
  return {
    header: decodeJsonPart(encodedHeader),
    payload: decodeJsonPart(encodedPayload),
    signingInput: `${encodedHeader}.${encodedPayload}`,
    signature: base64UrlDecode(encodedSignature),
  };
}

function base64UrlEncode(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function accessTokenHash(accessToken: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(accessToken));
  return base64UrlEncode(new Uint8Array(digest));
}

async function expectValidSignature(proof: ReturnType<typeof decodeDPoPProof>): Promise<void> {
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    proof.header.jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  await expect(
    crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      toArrayBuffer(proof.signature),
      new TextEncoder().encode(proof.signingInput),
    ),
  ).resolves.toBe(true);
}

describe("loadOrGenerateKeyPair", () => {
  it("既存の鍵ペアがあれば load() の結果をそのまま返す", async () => {
    const existing = await oauth.generateKeyPair("ES256", { extractable: true });
    const save = vi.fn();
    const store: DPoPKeyStore = {
      load: async () => existing,
      save,
      clear: async () => {},
    };

    const result = await loadOrGenerateKeyPair(store);

    expect(result).toBe(existing);
    expect(save).not.toHaveBeenCalled();
  });

  it("鍵ペアが無ければ ES256 で生成し save() に渡す", async () => {
    const save = vi.fn(async (_: CryptoKeyPair) => {});
    const store: DPoPKeyStore = {
      load: async () => null,
      save,
      clear: async () => {},
    };

    const result = await loadOrGenerateKeyPair(store);

    expect(result).toBeDefined();
    expect(result.privateKey.algorithm.name).toBe("ECDSA");
    expect(save).toHaveBeenCalledWith(result);
  });

  it("生成された鍵は DPoPHandle にそのまま渡せる", async () => {
    const store = createMemoryKeyStore();
    const keyPair = await loadOrGenerateKeyPair(store);

    const handle = oauth.DPoP({}, keyPair);
    const thumbprint = await handle.calculateThumbprint();

    expect(typeof thumbprint).toBe("string");
    expect(thumbprint.length).toBeGreaterThan(0);
  });

  it("生成された公開鍵は extractable で JWK エクスポート可能", async () => {
    const store = createMemoryKeyStore();
    const keyPair = await loadOrGenerateKeyPair(store);

    const jwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);

    expect(jwk.kty).toBe("EC");
    expect(jwk.crv).toBe("P-256");
    expect(jwk.x).toBeDefined();
    expect(jwk.y).toBeDefined();
  });
});

describe("createDPoPFetch", () => {
  it("GET request に Authorization: DPoP と DPoP proof を付与する", async () => {
    const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
    const baseFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input, init });
      return new Response("ok");
    });
    const dpopFetch = createDPoPFetch({
      keyStore: createMemoryKeyStore(),
      getAccessToken: async () => "access-token-123",
      fetch: baseFetch as unknown as typeof globalThis.fetch,
    });

    await dpopFetch("https://registry.example.com/resources/123");

    expect(baseFetch).toHaveBeenCalledOnce();
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get("Authorization")).toBe("DPoP access-token-123");
    const proof = decodeDPoPProof(headers.get("DPoP") ?? "");
    expect(proof.header.typ).toBe("dpop+jwt");
    expect(proof.header.alg).toBe("ES256");
    expect(proof.payload.htm).toBe("GET");
    expect(proof.payload.htu).toBe("https://registry.example.com/resources/123");
    expect(proof.payload.ath).toBe(await accessTokenHash("access-token-123"));
    await expectValidSignature(proof);
  });

  it("init.method を uppercase して proof の htm に反映し、既存 fetch option を維持する", async () => {
    const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
    const baseFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input, init });
      return new Response("ok");
    });
    const dpopFetch = createDPoPFetch({
      keyStore: createMemoryKeyStore(),
      getAccessToken: async () => "access-token-123",
      fetch: baseFetch as unknown as typeof globalThis.fetch,
    });

    await dpopFetch("https://registry.example.com/resources", {
      method: "post",
      headers: { "X-Test": "1" },
      body: "request-body",
      cache: "no-store",
      credentials: "include",
      keepalive: true,
      mode: "cors",
      referrer: "https://app.example.com/",
    });

    const headers = new Headers(calls[0]?.init?.headers);
    const proof = decodeDPoPProof(headers.get("DPoP") ?? "");
    expect(proof.payload.htm).toBe("POST");
    expect(headers.get("X-Test")).toBe("1");
    expect(calls[0]?.init?.body).toBe("request-body");
    expect(calls[0]?.init?.cache).toBe("no-store");
    expect(calls[0]?.init?.credentials).toBe("include");
    expect(calls[0]?.init?.keepalive).toBe(true);
    expect(calls[0]?.init?.mode).toBe("cors");
    expect(calls[0]?.init?.referrer).toBe("https://app.example.com/");
    expect(calls[0]?.init?.redirect).toBe("manual");
  });

  it("allowInsecureRequests が true なら HTTP endpoint にも送信できる", async () => {
    const baseFetch = vi.fn(async () => new Response("ok"));
    const dpopFetch = createDPoPFetch({
      keyStore: createMemoryKeyStore(),
      getAccessToken: async () => "access-token-123",
      fetch: baseFetch as unknown as typeof globalThis.fetch,
      allowInsecureRequests: true,
    });

    await dpopFetch("http://localhost:3000/resources");

    expect(baseFetch).toHaveBeenCalledOnce();
  });

  it("DPoPHandle と鍵ペアを使い回す", async () => {
    let stored: CryptoKeyPair | null = null;
    let loadCount = 0;
    let saveCount = 0;
    const keyStore: DPoPKeyStore = {
      load: async () => {
        loadCount += 1;
        return stored;
      },
      save: async (keyPair) => {
        saveCount += 1;
        stored = keyPair;
      },
      clear: async () => {
        stored = null;
      },
    };
    const dpopFetch = createDPoPFetch({
      keyStore,
      getAccessToken: async () => "access-token-123",
      fetch: vi.fn(async () => new Response("ok")) as unknown as typeof globalThis.fetch,
    });

    await dpopFetch("https://registry.example.com/a");
    await dpopFetch("https://registry.example.com/b");

    expect(loadCount).toBe(1);
    expect(saveCount).toBe(1);
  });

  it("同じ KeyStore の client.resetDPoPKey() 後は fetch wrapper も新しい鍵で proof を作る", async () => {
    const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
    const baseFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input, init });
      return new Response("ok");
    });
    const keyStore = createMemoryKeyStore();
    const client = createClient({
      issuer: "https://idp.example.com",
      clientId: "test-client",
      redirectUri: "app://callback",
      dpop: { keyStore },
    });
    const dpopFetch = createDPoPFetch({
      keyStore,
      getAccessToken: async () => "access-token-123",
      fetch: baseFetch as unknown as typeof globalThis.fetch,
    });

    await dpopFetch("https://registry.example.com/a");
    const proofBefore = decodeDPoPProof(new Headers(calls[0]?.init?.headers).get("DPoP") ?? "");

    await client.resetDPoPKey();
    await dpopFetch("https://registry.example.com/b");
    const proofAfter = decodeDPoPProof(new Headers(calls[1]?.init?.headers).get("DPoP") ?? "");

    expect(proofAfter.header.jwk.x).not.toBe(proofBefore.header.jwk.x);
    expect(proofAfter.header.jwk.y).not.toBe(proofBefore.header.jwk.y);
  });

  it("fetch wrapper の resetDPoPKey() 後は新しい鍵で proof を作る", async () => {
    const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
    const baseFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input, init });
      return new Response("ok");
    });
    const keyStore = createMemoryKeyStore();
    const clearSpy = vi.spyOn(keyStore, "clear");
    const dpopFetch = createDPoPFetch({
      keyStore,
      getAccessToken: async () => "access-token-123",
      fetch: baseFetch as unknown as typeof globalThis.fetch,
    });

    await dpopFetch("https://registry.example.com/a");
    const proofBefore = decodeDPoPProof(new Headers(calls[0]?.init?.headers).get("DPoP") ?? "");

    await dpopFetch.resetDPoPKey();
    await dpopFetch("https://registry.example.com/b");
    const proofAfter = decodeDPoPProof(new Headers(calls[1]?.init?.headers).get("DPoP") ?? "");

    expect(clearSpy).toHaveBeenCalledOnce();
    expect(proofAfter.header.jwk.x).not.toBe(proofBefore.header.jwk.x);
    expect(proofAfter.header.jwk.y).not.toBe(proofBefore.header.jwk.y);
  });

  it("use_dpop_nonce challenge では nonce を反映して一度だけ retry する", async () => {
    const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
    const baseFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input, init });
      if (calls.length === 1) {
        return new Response("nonce required", {
          status: 401,
          headers: {
            "DPoP-Nonce": "nonce-123",
            "WWW-Authenticate": 'DPoP error="use_dpop_nonce"',
          },
        });
      }
      return new Response("ok");
    });
    const dpopFetch = createDPoPFetch({
      keyStore: createMemoryKeyStore(),
      getAccessToken: async () => "access-token-123",
      fetch: baseFetch as unknown as typeof globalThis.fetch,
    });

    const response = await dpopFetch("https://registry.example.com/resources");

    expect(response.status).toBe(200);
    expect(baseFetch).toHaveBeenCalledTimes(2);
    const retryHeaders = new Headers(calls[1]?.init?.headers);
    const retryProof = decodeDPoPProof(retryHeaders.get("DPoP") ?? "");
    expect(retryProof.payload.nonce).toBe("nonce-123");
  });

  it("stream body の nonce challenge は自動 retry しない", async () => {
    const baseFetch = vi.fn(async () => {
      return new Response("nonce required", {
        status: 401,
        headers: {
          "DPoP-Nonce": "nonce-123",
          "WWW-Authenticate": 'DPoP error="use_dpop_nonce"',
        },
      });
    });
    const dpopFetch = createDPoPFetch({
      keyStore: createMemoryKeyStore(),
      getAccessToken: async () => "access-token-123",
      fetch: baseFetch as unknown as typeof globalThis.fetch,
    });
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("request-body"));
        controller.close();
      },
    });

    await expect(
      dpopFetch("https://registry.example.com/resources", {
        method: "POST",
        body,
      }),
    ).rejects.toThrow();
    expect(baseFetch).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it } from "vitest";
import { externalPrivateKeyJwt } from "./client-assertion";
import type { ES256Signer } from "./index";

async function authenticate(
  signature: Uint8Array,
  signatureFormat: ES256Signer["signatureFormat"],
) {
  const body = new URLSearchParams();
  const auth = externalPrivateKeyJwt({ sign: async () => signature, signatureFormat }, "key");
  await auth({ issuer: "https://example.com" }, { client_id: "client" }, body, new Headers());
  return body;
}

describe("external client assertion signatures", () => {
  it("converts DER integers with sign padding and short values", async () => {
    const r = [0, 0x80, ...new Array<number>(31).fill(1)];
    const der = new Uint8Array([0x30, 38, 2, 33, ...r, 2, 1, 1]);
    const body = await authenticate(der, "der");
    const encoded = body.get("client_assertion")!.split(".")[2]!;
    const signature = Uint8Array.from(
      atob(encoded.replaceAll("-", "+").replaceAll("_", "/")),
      (c) => c.charCodeAt(0),
    );
    expect(signature).toEqual(
      new Uint8Array([0x80, ...new Array<number>(31).fill(1), ...new Array<number>(31).fill(0), 1]),
    );
  });

  it.each([
    [],
    [0x30, 6, 2, 1, 1, 2, 1],
    [0x31, 6, 2, 1, 1, 2, 1, 1],
    [0x30, 6, 2, 1, 0x80, 2, 1, 1],
    [0x30, 7, 2, 2, 0, 1, 2, 1, 1],
    [0x30, 6, 2, 0, 1, 2, 1, 1],
    [0x30, 6, 2, 33, 1, 2, 1, 1],
    [0x30, 7, 2, 1, 1, 2, 1, 1, 0],
    [0x30, 6, 2, 1, 0, 2, 1, 1],
  ])("rejects malformed DER %j", async (...bytes) => {
    await expect(authenticate(new Uint8Array(bytes), "der")).rejects.toThrow(
      "invalid DER signature",
    );
  });

  it("rejects a signature with an invalid raw length", async () => {
    await expect(authenticate(new Uint8Array(63), undefined)).rejects.toThrow("64-byte");
  });
});

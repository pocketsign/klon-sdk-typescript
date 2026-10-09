import { p256 } from "@noble/curves/nist.js";
import type { ClientAuth } from "oauth4webapi";
import { generateRandomState } from "oauth4webapi";

/** 秘密鍵を SDK に渡さず、KMS 等で ES256 署名を行うインターフェース。 */
export interface ES256Signer {
  /** 署名の形式。省略時は JWT / Web Crypto と同じ64バイトの r || s。 */
  signatureFormat?: "ieee-p1363" | "der";
  /**
   * 未ハッシュの JWS Signing Input を ECDSA P-256 / SHA-256 で署名する。
   * KMS がダイジェストを要求する場合は実装側で SHA-256 を1回適用する。
   * 通信のタイムアウト・リトライは実装側で管理する。
   */
  sign(signingInput: Uint8Array): Promise<Uint8Array>;
}

export function externalPrivateKeyJwt(key: ES256Signer, kid: string): ClientAuth {
  return async (as, client, body) => {
    const now = Math.floor(Date.now() / 1000);
    const header = encodeJSON({ alg: "ES256", kid });
    const payload = encodeJSON({
      iss: client.client_id,
      sub: client.client_id,
      aud: as.issuer,
      iat: now,
      exp: now + 60,
      jti: generateRandomState(),
    });
    const input = `${header}.${payload}`;
    const signed = await key.sign(new TextEncoder().encode(input));
    const signature = key.signatureFormat === "der" ? derToP1363(signed) : signed;
    if (signature.length !== 64) {
      throw new Error("ES256 signer must return a 64-byte IEEE P1363 signature");
    }
    body.set("client_id", client.client_id);
    body.set("client_assertion_type", "urn:ietf:params:oauth:client-assertion-type:jwt-bearer");
    body.set("client_assertion", `${input}.${base64url(signature)}`);
  };
}

function encodeJSON(value: Record<string, string | number>): string {
  return base64url(new TextEncoder().encode(JSON.stringify(value)));
}

function base64url(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function derToP1363(der: Uint8Array): Uint8Array {
  try {
    return p256.Signature.fromBytes(der, "der").toBytes("compact");
  } catch (cause) {
    throw new Error("ES256 signer returned an invalid DER signature", { cause });
  }
}

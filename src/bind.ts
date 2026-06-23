import * as oauth from "oauth4webapi";
import type { BindNativeSessionResult } from "./types";

/** KLON 固有: ネイティブアプリ WebView セッションバインドエンドポイントのパス */
export const NATIVE_BIND_PATH = "/api/native/v1/bind";

const DEFAULT_BIND_NATIVE_SESSION_ERROR = "Session binding failed";

type BindNativeSessionErrorBody = {
  error: string;
  reason?: string;
};

type BindNativeSessionOptions = {
  issuer: string;
  bindId: string;
  accessToken: string;
  fetchOptions: Record<symbol, typeof globalThis.fetch | boolean>;
  dpopHandle?: oauth.DPoPHandle;
};

/**
 * `OIDCClient.bindNativeSession()` がサーバーエラー応答を受けた際に投げられるエラー。
 */
export class BindNativeSessionError extends Error {
  /** HTTP ステータスコード。 */
  readonly status: number;
  /** サーバーが返した error コード。 */
  readonly error: string;
  /** サーバーが返した詳細理由 (存在する場合)。 */
  readonly reason?: string;

  constructor(status: number, error: string = DEFAULT_BIND_NATIVE_SESSION_ERROR, reason?: string) {
    const detail = error === DEFAULT_BIND_NATIVE_SESSION_ERROR ? "" : `: ${error}`;
    const reasonDetail = reason ? ` [${reason}]` : "";
    super(`${DEFAULT_BIND_NATIVE_SESSION_ERROR} (HTTP ${status})${detail}${reasonDetail}`);
    this.name = "BindNativeSessionError";
    this.status = status;
    this.error = error;
    this.reason = reason;
    Object.setPrototypeOf(this, BindNativeSessionError.prototype);
  }
}

export async function bindNativeSession(
  options: BindNativeSessionOptions,
): Promise<BindNativeSessionResult> {
  const url = new URL(NATIVE_BIND_PATH, options.issuer);
  const headers = new Headers({ "Content-Type": "application/json" });
  const body = JSON.stringify({ bind_id: options.bindId });

  const response = await oauth.protectedResourceRequest(
    options.accessToken,
    "POST",
    url,
    headers,
    body,
    {
      ...options.fetchOptions,
      DPoP: options.dpopHandle,
    },
  );

  if (!response.ok) {
    const errorBody = await readBindNativeSessionErrorBody(response);
    throw new BindNativeSessionError(response.status, errorBody.error, errorBody.reason);
  }

  const data = (await response.json()) as { bind_complete_url: string };
  const completeUrl = new URL(data.bind_complete_url);
  const allowedOrigin = new URL(options.issuer).origin;
  if (completeUrl.origin !== allowedOrigin) {
    throw new Error("Unexpected bind_complete_url origin");
  }
  return { bindCompleteUrl: data.bind_complete_url };
}

export async function readBindNativeSessionErrorBody(
  response: Response,
): Promise<BindNativeSessionErrorBody> {
  try {
    const body = (await response.json()) as unknown;
    if (!isRecord(body)) {
      return { error: DEFAULT_BIND_NATIVE_SESSION_ERROR };
    }

    const error =
      typeof body.error === "string" && body.error !== ""
        ? body.error
        : DEFAULT_BIND_NATIVE_SESSION_ERROR;
    const reason = typeof body.reason === "string" && body.reason !== "" ? body.reason : undefined;
    return { error, reason };
  } catch {
    return { error: DEFAULT_BIND_NATIVE_SESSION_ERROR };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

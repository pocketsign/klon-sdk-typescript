import * as oauth from "oauth4webapi";
import type { BindNativeSessionResult } from "./types";

/** KLON 固有: ネイティブアプリ WebView セッションバインドエンドポイントのパス */
export const NATIVE_BIND_PATH = "/api/native/v1/bind";

const DEFAULT_BIND_NATIVE_SESSION_ERROR = "Session binding failed";

/** Native bind 失敗時にサーバーが返す詳細理由。将来追加される未知の値も含む。 */
export type BindNativeSessionErrorReason =
  | "request_body_invalid"
  | "bind_id_missing"
  | "bind_id_invalid"
  | "access_token_invalid"
  | "dpop_proof_invalid"
  | "native_scope_missing"
  | "bind_session_not_found"
  | "bind_session_expired"
  | "bind_session_already_bound"
  | "bind_session_used"
  | "bind_session_not_pending"
  | "user_session_unavailable"
  | "bind_session_failed"
  | "unexpected_error"
  | (string & {});

type BindNativeSessionErrorBody = {
  error: string;
  reason?: BindNativeSessionErrorReason;
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
  readonly reason?: BindNativeSessionErrorReason;

  constructor(
    status: number,
    error: string = DEFAULT_BIND_NATIVE_SESSION_ERROR,
    reason?: BindNativeSessionErrorReason,
  ) {
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

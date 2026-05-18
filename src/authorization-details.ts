/**
 * OAuth 2.0 Rich Authorization Requests (RAR)
 *
 * @see https://datatracker.ietf.org/doc/html/rfc9396
 */

export type ResourceAction = "read" | "write" | "invoke";

export interface AuthorizationDetail {
  type: "urn:klon:resource_access";
  identifiers: string[];
  actions: ResourceAction[];
  required?: boolean;
  prefill?: boolean;
}

/** `buildAuthorizationDetails()` の入力型。`type` は自動補完される。 */
export interface AuthorizationDetailInput {
  identifiers: string[];
  actions: ResourceAction[];
  required?: boolean;
  prefill?: boolean;
}

/**
 * authorization_details パラメータの JSON 文字列を生成する
 *
 * @example
 * ```ts
 * buildAuthorizationDetails([
 *   { identifiers: [Resources.MERGED_FULL_NAME], actions: ["read"], required: true },
 *   { identifiers: ["your-org/custom"], actions: ["read", "write"] },
 * ])
 * ```
 */
export function buildAuthorizationDetails(details: readonly AuthorizationDetailInput[]): string {
  const result: AuthorizationDetail[] = details.map((d) => ({
    type: "urn:klon:resource_access",
    identifiers: d.identifiers,
    actions: d.actions,
    ...(d.required !== undefined ? { required: d.required } : {}),
    ...(d.prefill !== undefined ? { prefill: d.prefill } : {}),
  }));
  return JSON.stringify(result);
}

function isResourceAction(value: unknown): value is ResourceAction {
  return value === "read" || value === "write" || value === "invoke";
}

export function isAuthorizationDetail(value: unknown): value is AuthorizationDetail {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.type !== "urn:klon:resource_access") {
    return false;
  }

  if (!Array.isArray(obj.identifiers)) {
    return false;
  }

  if (!obj.identifiers.every((id) => typeof id === "string")) {
    return false;
  }

  if (!Array.isArray(obj.actions)) {
    return false;
  }

  if (!obj.actions.every(isResourceAction)) {
    return false;
  }

  if (obj.required !== undefined && typeof obj.required !== "boolean") {
    return false;
  }

  if (obj.prefill !== undefined && typeof obj.prefill !== "boolean") {
    return false;
  }

  return true;
}

/** authorization_details JSON 文字列をパースしてバリデーションする */
export function parseAuthorizationDetails(json: string): AuthorizationDetail[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("authorization_details のパースに失敗しました: 無効な JSON です");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("authorization_details は配列である必要があります");
  }

  const result: AuthorizationDetail[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (!isAuthorizationDetail(item)) {
      throw new Error(`authorization_details[${i}] の形式が不正です`);
    }
    result.push(item);
  }

  return result;
}

/**
 * OAuth 2.0 Rich Authorization Requests (RAR)
 *
 * @see https://datatracker.ietf.org/doc/html/rfc9396
 */

/**
 * Registry リソースに対して要求できる操作。
 *
 * - `read`: 値の取得
 * - `write`: 値の更新・削除
 * - `invoke`: 実行リソースの呼び出し
 */
export type ResourceAction = "read" | "write" | "invoke";

/**
 * 認可リクエストの `authorization_details` に含まれる 1 件分の要求 (RFC 9396)。
 *
 * `type` は現状 `urn:klon:resource_access` (Registry リソースへの権限要求) のみ。
 * `scope` と `authorization_details` を併用した場合、要求は和集合となり、
 * 同じ意味の要求は重複しない 1 つに正規化される。
 */
export interface AuthorizationDetail {
  /** 認可詳細の型。KLON では常に `"urn:klon:resource_access"`。 */
  type: "urn:klon:resource_access";
  /** 対象リソースの Registry リソース定義 ID またはエイリアスの配列。 */
  identifiers: string[];
  /** 各リソースに対して要求する操作 (read / write / invoke) の配列。 */
  actions: ResourceAction[];
  /** true のとき、ユーザーが拒否すると認可フロー自体を継続できない必須要求になる。 */
  required?: boolean;
  /** true のとき、リソース値が未登録なら認可フロー内で値入力・登録を促す。 */
  prefill?: boolean;
}

/** {@link buildAuthorizationDetails} の入力型。`type` は自動補完される。 */
export interface AuthorizationDetailInput {
  /** 対象リソースの Registry リソース定義 ID またはエイリアスの配列。 */
  identifiers: string[];
  /** 各リソースに対して要求する操作 (read / write / invoke) の配列。 */
  actions: ResourceAction[];
  /** true のとき、ユーザーが拒否すると認可フロー自体を継続できない必須要求になる。 */
  required?: boolean;
  /** true のとき、リソース値が未登録なら認可フロー内で値入力・登録を促す。 */
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

/**
 * 値が {@link AuthorizationDetail} の形式に合致するか判定する型ガード。
 *
 * @param value 検査対象の値
 * @returns 値が有効な {@link AuthorizationDetail} なら `true`
 */
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

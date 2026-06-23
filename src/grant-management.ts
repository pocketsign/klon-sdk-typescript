/**
 * Grant Management API の `grant_management_action` パラメータに指定する値の定数集。
 *
 * KLON は 1 ユーザー × 1 クライアントにつき有効な同意 (グラント) を 1 つ管理し、
 * 認可リクエスト時に既存グラントの扱いをこの値で指定する。
 */
export const GrantManagementActions = {
  /**
   * 既存グラントが無ければ新規作成する。既存があり要求を内包していれば再利用し、
   * 不足があれば不足分の同意を求める。
   */
  CREATE: "create",
  /** 既存グラントを要求権限で置換する (以前の権限は保持されない)。常に同意が必要。 */
  REPLACE: "replace",
  /** 既存グラントとの差分を追加する。差分があるときだけ同意が必要。 */
  MERGE: "merge",
} as const;

/** {@link GrantManagementActions} の値のいずれかを表すユニオン型。 */
export type GrantManagementAction =
  (typeof GrantManagementActions)[keyof typeof GrantManagementActions];

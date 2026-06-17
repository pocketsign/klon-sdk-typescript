export const GrantManagementActions = {
  /** 新規グラントを作成する */
  CREATE: "create",
  /** 既存グラントを置換する */
  REPLACE: "replace",
  /** 既存グラントにマージする */
  MERGE: "merge",
} as const;

export type GrantManagementAction =
  (typeof GrantManagementActions)[keyof typeof GrantManagementActions];

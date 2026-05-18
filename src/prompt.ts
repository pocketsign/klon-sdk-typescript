export const Prompts = {
  /** 認証・認可画面を表示しない。必要な場合はエラー応答をコールバックする。 */
  NONE: "none",
  /** エンドユーザーに再認証を要求する */
  LOGIN: "login",
  /** エンドユーザーに明示的な同意を要求する */
  CONSENT: "consent",
} as const;

export type Prompt = (typeof Prompts)[keyof typeof Prompts];

export const allPrompts: readonly Prompt[] = Object.values(Prompts);

/**
 * none は他の prompt と併用できない。login と consent は併用可能。
 *
 * @example
 * ```ts
 * buildPrompt([Prompts.LOGIN, Prompts.CONSENT])
 * // => "login consent"
 * ```
 */
export function buildPrompt(prompts: Iterable<string>): string {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const p of prompts) {
    if (!seen.has(p)) {
      seen.add(p);
      result.push(p);
    }
  }
  return result.join(" ");
}

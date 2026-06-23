/**
 * 認可リクエストの `prompt` パラメータに指定する値の定数集。
 *
 * IdP に対する認証・同意画面の表示方法を制御する。KLON がサポートするのは
 * none / login / consent のみ。
 */
export const Prompts = {
  /** 認証・認可画面を表示しない。必要な場合はエラー応答をコールバックする。 */
  NONE: "none",
  /** 再認証を要求する。ログアウトは必ずしも伴わず、既存セッションを維持したまま認証のみ行う。 */
  LOGIN: "login",
  /** 同意済みで再利用可能な場合でも、明示的に同意画面を表示する。 */
  CONSENT: "consent",
} as const;

/** {@link Prompts} の値のいずれかを表すユニオン型。 */
export type Prompt = (typeof Prompts)[keyof typeof Prompts];

/** {@link Prompts} の全値を列挙した配列。 */
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
  if (result.length > 1 && result.includes(Prompts.NONE)) {
    throw new Error("prompt=none cannot be combined with other prompt values");
  }
  return result.join(" ");
}

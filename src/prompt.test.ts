import { describe, expect, it } from "vitest";
import { buildPrompt, Prompts } from "./prompt";

describe("buildPrompt", () => {
  it("単一の値を構築できる", () => {
    expect(buildPrompt([Prompts.LOGIN])).toBe("login");
  });

  it("複数の値を構築できる", () => {
    expect(buildPrompt([Prompts.LOGIN, Prompts.CONSENT])).toBe("login consent");
  });

  it("重複する値は除去される", () => {
    expect(buildPrompt([Prompts.LOGIN, Prompts.LOGIN])).toBe("login");
  });

  it("空の選択で空文字列を返す", () => {
    expect(buildPrompt([])).toBe("");
  });

  it("イテレーション順を維持する", () => {
    expect(buildPrompt([Prompts.CONSENT, Prompts.LOGIN])).toBe("consent login");
  });
});

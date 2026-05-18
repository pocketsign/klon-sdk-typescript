import { describe, expect, it } from "vitest";
import { buildScope, Scopes } from "./scope";

describe("buildScope", () => {
  it("単一のスコープ値を構築できる", () => {
    expect(buildScope([Scopes.OPENID])).toBe("openid");
  });

  it("複数のスコープ値を構築できる", () => {
    expect(buildScope([Scopes.OPENID, Scopes.PROFILE])).toBe("openid profile");
  });

  it("イテレーション順を維持する", () => {
    expect(buildScope([Scopes.PROFILE, Scopes.OPENID])).toBe("profile openid");
  });

  it("任意の文字列を受け付ける", () => {
    expect(buildScope(["openid", "custom_scope"])).toBe("openid custom_scope");
  });

  it("空の選択で空文字列を返す", () => {
    expect(buildScope([])).toBe("");
  });

  it("Setを渡しても動作する", () => {
    expect(buildScope(new Set([Scopes.OPENID, Scopes.EMAIL]))).toBe("openid email");
  });

  it("重複する値は除去される", () => {
    expect(buildScope([Scopes.OPENID, Scopes.OPENID])).toBe("openid");
  });
});

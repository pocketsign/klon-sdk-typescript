import { describe, expect, it } from "vitest";
import { buildAcrValues, AcrValues } from "./acr";

describe("buildAcrValues", () => {
  it("単一の値からACR値を構築できる", () => {
    expect(buildAcrValues([AcrValues.HIGH])).toBe("urn:klon:acr:high");
  });

  it("複数の値からACR値を構築できる", () => {
    expect(buildAcrValues([AcrValues.VERY_HIGH, AcrValues.HIGH])).toBe(
      "urn:klon:acr:very_high urn:klon:acr:high",
    );
  });

  it("イテレーション順を維持する", () => {
    expect(buildAcrValues([AcrValues.HIGH, AcrValues.VERY_HIGH])).toBe(
      "urn:klon:acr:high urn:klon:acr:very_high",
    );
    expect(buildAcrValues([AcrValues.VERY_HIGH, AcrValues.LOW, AcrValues.HIGH])).toBe(
      "urn:klon:acr:very_high urn:klon:acr:low urn:klon:acr:high",
    );
  });

  it("手動入力値を末尾に追加する", () => {
    expect(buildAcrValues([AcrValues.HIGH], "urn:custom:acr")).toBe(
      "urn:klon:acr:high urn:custom:acr",
    );
  });

  it("重複する値は最初の出現位置を維持する", () => {
    expect(buildAcrValues([AcrValues.HIGH], "urn:klon:acr:high")).toBe("urn:klon:acr:high");
  });

  it("空の選択で空文字列を返す", () => {
    expect(buildAcrValues([])).toBe("");
  });

  it("手動入力のみでも動作する", () => {
    expect(buildAcrValues([], "urn:custom:acr urn:other:acr")).toBe("urn:custom:acr urn:other:acr");
  });

  it("Setを渡しても動作する", () => {
    expect(buildAcrValues(new Set([AcrValues.VERY_HIGH, AcrValues.HIGH]))).toBe(
      "urn:klon:acr:very_high urn:klon:acr:high",
    );
  });
});

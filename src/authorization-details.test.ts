import { describe, expect, it } from "vitest";
import { buildAuthorizationDetails, parseAuthorizationDetails } from "./authorization-details";
import { Resources } from "./resources";

describe("buildAuthorizationDetails", () => {
  it("単一のリソースアクセスを生成できる", () => {
    const json = buildAuthorizationDetails([
      { identifiers: [Resources.MERGED_FULL_NAME], actions: ["read"] },
    ]);

    expect(JSON.parse(json)).toEqual([
      {
        type: "urn:klon:resource_access",
        identifiers: ["klon/merged_full_name"],
        actions: ["read"],
      },
    ]);
  });

  it("複数のリソースアクセスを生成できる", () => {
    const json = buildAuthorizationDetails([
      { identifiers: [Resources.MERGED_FULL_NAME], actions: ["read"], required: true },
      { identifiers: [Resources.MERGED_FULL_ADDRESS], actions: ["read"] },
    ]);

    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].required).toBe(true);
    expect(parsed[1].required).toBeUndefined();
  });

  it("required と prefill を設定できる", () => {
    const json = buildAuthorizationDetails([
      {
        identifiers: [Resources.MERGED_FULL_NAME],
        actions: ["read"],
        required: true,
        prefill: true,
      },
    ]);

    const parsed = JSON.parse(json);
    expect(parsed[0].required).toBe(true);
    expect(parsed[0].prefill).toBe(true);
  });

  it("required/prefill が undefined のとき出力に含まれない", () => {
    const json = buildAuthorizationDetails([
      { identifiers: [Resources.MERGED_FULL_NAME], actions: ["read"] },
    ]);

    const parsed = JSON.parse(json);
    expect("required" in parsed[0]).toBe(false);
    expect("prefill" in parsed[0]).toBe(false);
  });

  it("read/write アクションを指定できる", () => {
    const json = buildAuthorizationDetails([
      { identifiers: ["your-org/custom"], actions: ["read", "write"] },
    ]);

    const parsed = JSON.parse(json);
    expect(parsed[0].actions).toEqual(["read", "write"]);
  });

  it("invoke アクションを指定できる", () => {
    const json = buildAuthorizationDetails([
      {
        identifiers: [Resources.CHECK_JPKI_CARD_DIGITAL_SIGNATURE_CERTIFICATE_REVOCATION],
        actions: ["invoke"],
        required: true,
      },
    ]);

    const parsed = JSON.parse(json);
    expect(parsed[0]).toEqual({
      type: "urn:klon:resource_access",
      identifiers: ["klon/check_jpki_card_digital_signature_certificate_revocation"],
      actions: ["invoke"],
      required: true,
    });
  });

  it("空配列で空のJSON配列を返す", () => {
    expect(buildAuthorizationDetails([])).toBe("[]");
  });

  it("type が自動補完される", () => {
    const json = buildAuthorizationDetails([
      { identifiers: [Resources.MERGED_FULL_NAME], actions: ["read"] },
    ]);

    const parsed = JSON.parse(json);
    expect(parsed[0].type).toBe("urn:klon:resource_access");
  });
});

describe("parseAuthorizationDetails", () => {
  describe("正常系", () => {
    it("有効なJSON配列をパースできる", () => {
      const json = JSON.stringify([
        {
          type: "urn:klon:resource_access",
          identifiers: ["klon/merged_full_name"],
          actions: ["read"],
        },
      ]);

      const result = parseAuthorizationDetails(json);

      expect(result).toEqual([
        {
          type: "urn:klon:resource_access",
          identifiers: ["klon/merged_full_name"],
          actions: ["read"],
        },
      ]);
    });

    it("required と prefill を含むオブジェクトをパースできる", () => {
      const json = JSON.stringify([
        {
          type: "urn:klon:resource_access",
          identifiers: ["klon/merged_full_name"],
          actions: ["read", "write"],
          required: true,
          prefill: false,
        },
      ]);

      const result = parseAuthorizationDetails(json);

      expect(result[0].required).toBe(true);
      expect(result[0].prefill).toBe(false);
    });

    it("invoke アクションを含むオブジェクトをパースできる", () => {
      const json = JSON.stringify([
        {
          type: "urn:klon:resource_access",
          identifiers: ["klon/check_jpki_card_digital_signature_certificate_revocation"],
          actions: ["invoke"],
          required: true,
        },
      ]);

      const result = parseAuthorizationDetails(json);

      expect(result[0].actions).toEqual(["invoke"]);
      expect(result[0].required).toBe(true);
    });

    it("空配列をパースできる", () => {
      const result = parseAuthorizationDetails("[]");
      expect(result).toEqual([]);
    });
  });

  describe("異常系", () => {
    it("無効なJSONでエラーをスローする", () => {
      expect(() => parseAuthorizationDetails("invalid json")).toThrow(
        "authorization_details のパースに失敗しました",
      );
    });

    it("配列でない場合エラーをスローする", () => {
      expect(() => parseAuthorizationDetails('{"type": "object"}')).toThrow(
        "authorization_details は配列である必要があります",
      );
    });

    it("type が不正な場合エラーをスローする", () => {
      const json = JSON.stringify([
        {
          type: "invalid_type",
          identifiers: ["klon/merged_full_name"],
          actions: ["read"],
        },
      ]);

      expect(() => parseAuthorizationDetails(json)).toThrow(
        "authorization_details[0] の形式が不正です",
      );
    });

    it("identifiers が配列でない場合エラーをスローする", () => {
      const json = JSON.stringify([
        {
          type: "urn:klon:resource_access",
          identifiers: "not_an_array",
          actions: ["read"],
        },
      ]);

      expect(() => parseAuthorizationDetails(json)).toThrow(
        "authorization_details[0] の形式が不正です",
      );
    });

    it("actions に無効な値が含まれる場合エラーをスローする", () => {
      const json = JSON.stringify([
        {
          type: "urn:klon:resource_access",
          identifiers: ["klon/merged_full_name"],
          actions: ["read", "delete"],
        },
      ]);

      expect(() => parseAuthorizationDetails(json)).toThrow(
        "authorization_details[0] の形式が不正です",
      );
    });

    it("required が boolean でない場合エラーをスローする", () => {
      const json = JSON.stringify([
        {
          type: "urn:klon:resource_access",
          identifiers: ["klon/merged_full_name"],
          actions: ["read"],
          required: "yes",
        },
      ]);

      expect(() => parseAuthorizationDetails(json)).toThrow(
        "authorization_details[0] の形式が不正です",
      );
    });
  });
});

# Changelog

`@pocketsign/klon-sdk` の変更履歴です。

## Unreleased

- `clientPrivateKey` による private_key_jwt（ES256）認証を追加しました。認可コード交換・トークン更新・PAR に対応します。

### 新機能

- Native bind の失敗理由を表す型 `BindNativeSessionErrorReason` を公開しました。`BindNativeSessionError` の `reason` プロパティの型がこの型になり、サーバーが返す理由を補完付きで分岐できます。将来追加される未知の値も受け付けます。

## 1.0.0 （2026/07/03）

- `@pocketsign/klon-sdk` の最初のリリースです。[oauth4webapi](https://github.com/panva/oauth4webapi) をベースに、KLON IdP との OIDC 連携を実装するための機能を提供します。
  - `createClient` / `OIDCClient`: 認可リクエストの生成、コールバックの検証、トークンの取得・更新を行います。
  - `createDPoPFetch`: DPoP 付きのリクエストを送る `fetch` を生成します。鍵の保管方法は `DPoPKeyStore` で差し替えられます。
  - `Scopes` / `Resources` / `AcrValues` / `Prompts` / `GrantManagementActions`: KLON が受け付ける値を定数として提供します。`buildScope`、`buildAcrValues`、`buildPrompt` で認可リクエスト用の文字列を組み立てられます。
  - `buildAuthorizationDetails` / `parseAuthorizationDetails`: リソースごとの操作を指定する Rich Authorization Requests の `authorization_details` を扱います。
  - `IDTokenClaims`: KLON が発行する ID トークンのクレームの型です。

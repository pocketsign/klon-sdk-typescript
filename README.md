# @pocketsign/klon-sdk

KLON IdP と連携するための TypeScript SDK。[oauth4webapi](https://github.com/panva/oauth4webapi) をベースに、KLON 固有のパラメータ (ACR, Authorization Details, Scope) をサポートする。

## インストール

`@pocketsign` スコープのパッケージは専用レジストリで配布しています。プロジェクトのルートに `.npmrc` を作成し、レジストリと SDK 取得用トークンを設定してください。

```ini
@pocketsign:registry=https://repo.platform.p8n.app
//repo.platform.p8n.app/:_authToken=<YOUR_SDK_TOKEN>
```

`<YOUR_SDK_TOKEN>` には SDK 取得用トークンを設定します（取得方法は [SDK 取得用トークンの作成](https://docs.p8n.app/docs/verify/guide/getting-started/sdk-token) を参照）。トークンが VCS に記録されないよう注意してください。

設定後、パッケージをインストールします。

```bash
pnpm add @pocketsign/klon-sdk oauth4webapi
```

`oauth4webapi` は peerDependency のため、別途インストールが必要です。

## クイックスタート

### Web (Confidential Client)

```ts
import { createClient, Scopes, Resources, AcrValues, Prompts } from "@pocketsign/klon-sdk";

const client = createClient({
  issuer: "https://id.mock.klon.you",
  clientId: "your-client-id",
  clientSecret: "your-client-secret",
  redirectUri: "https://your-app.com/callback",
});

// 1. 認可 URL を生成
const { url, session } = await client.createAuthorizationURL({
  scopes: [Scopes.OPENID, Scopes.PROFILE],
  authorizationDetails: [
    { identifiers: [Resources.MERGED_FULL_NAME], actions: ["read"], required: true },
  ],
  acrValues: [AcrValues.HIGH],
  prompt: [Prompts.CONSENT],
  usePAR: true,
});

// session をセッションストレージに保存してからリダイレクト
// redirect(url.toString())

// 2. コールバックでトークン交換
const tokenSet = await client.exchangeCode(code, state, session);

// 3. トークンリフレッシュ
const newTokenSet = await client.refreshToken(tokenSet.refreshToken);
```

### React Native (Public Client)

oauth4webapi は内部で `crypto.subtle` を使用するが、React Native にはネイティブ実装がない。[react-native-quick-crypto](https://github.com/nicolo-ribaudo/react-native-quick-crypto) で polyfill する必要がある。

```ts
// polyfills.ts (アプリのエントリポイントより前に import する)
import QuickCrypto, { install } from "react-native-quick-crypto";

install();
// oauth4webapi は内部で `key instanceof CryptoKey` を使うが、install() は
// globalThis.crypto しか設定しないため globalThis.CryptoKey が未定義のまま残る。
// Hermes で "Property CryptoKey does not exist" になるため手動で登録する。
(globalThis as { CryptoKey?: unknown }).CryptoKey = QuickCrypto.CryptoKey;
```

```ts
import { createClient, Scopes, type DPoPKeyStore } from "@pocketsign/klon-sdk";
import { fetch as expoFetch } from "expo/fetch";

// expo/fetch は bodyUsed フラグの扱いが異なるためラッパーが必要
const customFetch: typeof globalThis.fetch = async (input, init) => {
  const res = await expoFetch(input, init);
  const body = await res.arrayBuffer();
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
};

// DPoP 鍵ペアの永続化実装 (サンプルは AsyncStorage、本番は expo-secure-store 等に差し替え)
const keyStore: DPoPKeyStore = {
  /* load / save / clear を実装する（後述の「DPoP」セクション参照） */
};

const client = createClient({
  issuer: "https://id.mock.klon.you",
  clientId: "your-client-id",
  redirectUri: "your-app-scheme://callback",
  customFetch,
  dpop: { keyStore }, // DPoP (RFC 9449) を有効化
});

const { url, session } = await client.createAuthorizationURL({
  scopes: [Scopes.OPENID, Scopes.OFFLINE_ACCESS],
  usePAR: true,
});
```

## API

### OIDC クライアント

#### `createClient(config: ClientConfig): OIDCClient`

```ts
interface ClientConfig {
  issuer: string;
  clientId: string;
  clientSecret?: string; // Confidential Client の場合
  redirectUri: string;
  customFetch?: typeof globalThis.fetch; // React Native では expo/fetch ラッパーを渡す
  dpop?: DPoPOptions; // DPoP (RFC 9449) を有効化
  allowInsecureRequests?: boolean; // 開発時のみ: HTTP エンドポイントを許可
}
```

#### `client.createAuthorizationURL(options?): Promise<{ url: URL; session: AuthorizationSession }>`

認可 URL を生成する。返された `session` はコールバック処理に必要なので保存すること。

```ts
interface AuthorizeOptions {
  scopes?: readonly string[]; // 省略時のみ ["openid"]（空配列を渡すとスコープ無し）
  authorizationDetails?: AuthorizationDetailInput[]; // RAR (RFC 9396)
  acrValues?: string[];
  prompt?: string[];
  maxAge?: number; // 認証の最大経過時間 (秒)
  grantManagementAction?: GrantManagementAction;
  usePAR?: boolean; // PAR (RFC 9126)
}
```

#### `client.exchangeCode(code, state, session): Promise<TokenSet>`

認可コードをトークンに交換する。`code` と `state` はコールバック URL のクエリパラメータ。PKCE 検証、nonce 検証、ID トークン検証を行う。

```ts
const tokenSet = await client.exchangeCode(code, state, session);

// デコード済み ID Token クレームにアクセス
console.log(tokenSet.idTokenClaims?.sub); // RP 固有のユーザー識別子
console.log(tokenSet.idTokenClaims?.acr); // 認証コンテキストクラス
console.log(tokenSet.idTokenClaims?.jpki_verified); // JPKI 紐づけ状態
```

#### `client.refreshToken(refreshToken): Promise<TokenSet>`

リフレッシュトークンでアクセストークンを更新する。レスポンスに新しい ID Token が含まれる場合は署名・issuer・audience・expiry を検証し、成功した場合のみ `idTokenClaims` もセットされる。

#### `client.bindNativeSession(bindId, accessToken): Promise<BindNativeSessionResult>`

ネイティブアプリの WebView セッションをバインドする (KLON 固有の保護リソース)。DPoP が設定されていれば proof を自動付与する。

```ts
const { bindCompleteUrl } = await client.bindNativeSession(bindId, accessToken);
// bindCompleteUrl を WebView にロードしてバインド完了させる
```

失敗時は `BindNativeSessionError` が投げられ、`status` に HTTP ステータス、`error` にエラーコード、`reason` に詳細理由が格納される。既知の `reason` は次のとおり。

```text
request_body_invalid
bind_id_missing
bind_id_invalid
access_token_invalid
dpop_proof_invalid
native_scope_missing
bind_session_not_found
bind_session_expired
bind_session_already_bound
bind_session_used
bind_session_not_pending
user_session_unavailable
bind_session_failed
unexpected_error
```

将来追加される未知の `reason` も文字列として保持されるため、分岐では `default` も処理すること。

#### `createDPoPFetch(options): DPoPFetch`

Registry API や IdP の protected API など、KLON access token が必要な API 呼び出しに DPoP proof を自動付与する fetch wrapper を作成する。

```ts
import { createDPoPFetch } from "@pocketsign/klon-sdk";

const dpopFetch = createDPoPFetch({
  keyStore,
  getAccessToken: async () => tokenSet.accessToken,
  fetch: customFetch, // 省略時は globalThis.fetch。React Native / Expo では expo/fetch 等を渡す
});

const response = await dpopFetch("https://registry.mock.klon.you/api/...", {
  method: "POST",
  body: JSON.stringify(payload),
});
```

ConnectRPC client では transport の `fetch` に渡す。

```ts
const transport = createConnectTransport({
  baseUrl: "https://registry.mock.klon.you",
  fetch: dpopFetch,
});
```

ローカル開発・検証で `http://` の API を呼ぶ場合のみ、`allowInsecureRequests: true` を指定できる。本番コードでは使わないこと。

サーバーが DPoP nonce を要求した場合、文字列や `Uint8Array` など再送可能な body では 1 回だけ自動 retry する。`ReadableStream` など再送できない body は自動 retry しない。

#### `dpopFetch.resetDPoPKey(): Promise<void>`

`createDPoPFetch()` が返した fetch wrapper の保存済み DPoP 鍵と `DPoPHandle` キャッシュを破棄する。Registry API 等の protected resource 用 fetch wrapper を保持している場合は、ログアウトやアカウント切替時に `client.resetDPoPKey()` とあわせて呼び出す。

```ts
await dpopFetch.resetDPoPKey();
```

#### `client.resetDPoPKey(): Promise<void>`

保存済みの DPoP 鍵と SDK 内部の `DPoPHandle` キャッシュを破棄する。ログアウトやアカウント切替時に呼び出す。

```ts
await clearTokens();
await client.resetDPoPKey();
```

### TokenSet

```ts
interface TokenSet {
  accessToken: string;
  tokenType: string; // oauth4webapi により小文字化された "bearer" または "dpop"
  expiresIn?: number;
  refreshToken?: string;
  idToken?: string; // 生の JWT 文字列
  idTokenClaims?: IDTokenClaims; // デコード済みクレーム
  scope?: string;
  authorizationDetails?: AuthorizationDetail[];
}
```

### DPoP (RFC 9449)

アクセストークンを sender-constrained にするための仕組み。`dpop: { keyStore }` を `createClient` に渡すと、認可リクエストに `dpop_jkt` が付き、PAR / token / `bindNativeSession` に DPoP proof が自動付与される。発行されるトークンは `token_type: "DPoP"` になり得る。

```ts
import type { DPoPKeyStore } from "@pocketsign/klon-sdk";

interface DPoPKeyStore {
  load(): Promise<CryptoKeyPair | null>;
  save(keyPair: CryptoKeyPair): Promise<void>;
  clear(): Promise<void>;
}
```

SDK は初回に `load()` を呼び、`null` なら `generateKeyPair("ES256", { extractable: true })` で新規生成し `save()` に渡す。アプリ側はこの interface をプラットフォームのセキュアストレージ (`expo-secure-store` / `react-native-keychain` / IndexedDB 等) で実装する。

**注意点**:

- DPoP では同じ鍵ペアを継続利用する必要があるため、`DPoPKeyStore` で鍵を永続化する
- React Native では Secure Store / Keychain 系の保存先を推奨する
- token response の `token_type` は `bearer` ではなく `dpop` になり得る
- `createClient({ dpop })` が自動で proof を付けるのは SDK 自身が送るリクエストだけ
- Registry API 等を直接呼ぶ場合は `createDPoPFetch` を使う
- ログアウトやアカウント切替時は `client.resetDPoPKey()` と、作成済みの `dpopFetch.resetDPoPKey()` で保存済み鍵と SDK 内部キャッシュをクリアする

```ts
const logout = async () => {
  await clearTokens();
  await client.resetDPoPKey();
  await dpopFetch.resetDPoPKey();
};
```

**実装例 (React Native / expo-secure-store)**: `CryptoKeyPair` はそのまま保存できないため JWK に変換して永続化する。秘密鍵は復元時に `extractable: false` で取り込み、再エクスポートを防ぐ。`AsyncStorage` のような平文保存は本番では避けること。

```ts
import type { DPoPKeyStore } from "@pocketsign/klon-sdk";
import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "klon.dpop.keyPair";
const EC_P256 = { name: "ECDSA", namedCurve: "P-256" } as const;

const keyStore: DPoPKeyStore = {
  load: async () => {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return null;
    const { privateJwk, publicJwk } = JSON.parse(raw);
    const privateKey = await crypto.subtle.importKey("jwk", privateJwk, EC_P256, false, ["sign"]);
    const publicKey = await crypto.subtle.importKey("jwk", publicJwk, EC_P256, true, ["verify"]);
    return { privateKey, publicKey };
  },
  save: async (keyPair) => {
    const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({ privateJwk, publicJwk }));
  },
  clear: async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  },
};
```

Web では IndexedDB 等に `CryptoKey` を直接保存する実装も可能。

### IDTokenClaims

`exchangeCode` / `refreshToken` で取得される ID Token のデコード済みクレーム。フィールド名は JWT クレーム名 (snake_case) に準拠。

| フィールド              | 型                   | 説明                   | 条件           |
| ----------------------- | -------------------- | ---------------------- | -------------- |
| `iss`                   | `string`             | Issuer (IdP URL)       | 常に存在       |
| `sub`                   | `string`             | Subject (RP 固有)      | 常に存在       |
| `aud`                   | `string \| string[]` | Audience (Client ID)   | 常に存在       |
| `iat`                   | `number`             | 発行日時 (Unix epoch)  | 常に存在       |
| `exp`                   | `number`             | 有効期限 (Unix epoch)  | 常に存在       |
| `nonce`                 | `string?`            | Nonce                  | リクエスト時   |
| `auth_time`             | `number`             | 認証日時 (Unix epoch)  | 常に存在       |
| `acr`                   | `string`             | 認証コンテキストクラス | 常に存在       |
| `amr`                   | `string[]`           | 認証方法               | 常に存在       |
| `sid`                   | `string?`            | セッション ID          | セッション時   |
| `jpki_verified`         | `boolean`            | JPKI 紐づけ状態        | 常に存在       |
| `name`                  | `string?`            | 氏名                   | scope: profile |
| `gender`                | `string?`            | 性別                   | scope: profile |
| `birthdate`             | `string?`            | 生年月日               | scope: profile |
| `email`                 | `string?`            | メールアドレス         | scope: email   |
| `email_verified`        | `boolean?`           | メール確認済み         | scope: email   |
| `address`               | `string?`            | 住所                   | scope: address |
| `phone_number`          | `string?`            | 電話番号               | scope: phone   |
| `phone_number_verified` | `boolean?`           | 電話番号確認済み       | scope: phone   |

### スコープ

`createAuthorizationURL` の `scopes` に配列で渡す。ビルダー関数 (`buildScope`) も引き続き利用可能。

| 定数                    | 値               | 説明                 |
| ----------------------- | ---------------- | -------------------- |
| `Scopes.OPENID`         | `openid`         | OpenID Connect       |
| `Scopes.PROFILE`        | `profile`        | 氏名/生年月日/性別   |
| `Scopes.EMAIL`          | `email`          | メールアドレス       |
| `Scopes.OFFLINE_ACCESS` | `offline_access` | リフレッシュトークン |
| `Scopes.ADDRESS`        | `address`        | 住所                 |
| `Scopes.PHONE`          | `phone`          | 電話番号             |
| `Scopes.PERSONAL_INFO`  | `personal_info`  | 基本4情報            |

### ACR

`createAuthorizationURL` の `acrValues` に配列で渡す。

| 定数                  | 値                       | 説明                            |
| --------------------- | ------------------------ | ------------------------------- |
| `AcrValues.LOW`       | `urn:klon:acr:low`       | メールアドレス/外部IdP          |
| `AcrValues.HIGH`      | `urn:klon:acr:high`      | JPKI 利用者証明用電子証明書相当 |
| `AcrValues.VERY_HIGH` | `urn:klon:acr:very_high` | JPKI 署名用電子証明書相当       |

### Prompt

`createAuthorizationURL` の `prompt` に配列で渡す。

| 定数              | 値        | 説明                                                     |
| ----------------- | --------- | -------------------------------------------------------- |
| `Prompts.NONE`    | `none`    | 認証・認可画面を表示しない。必要な場合はエラー応答する。 |
| `Prompts.LOGIN`   | `login`   | エンドユーザーに再認証を要求する                         |
| `Prompts.CONSENT` | `consent` | エンドユーザーに明示的な同意を要求する                   |

`none` は他の prompt と併用できない。`login` と `consent` は併用可能。

### Authorization Details (RFC 9396)

`createAuthorizationURL` の `authorizationDetails` に配列で渡す。`type: "urn:klon:resource_access"` は SDK が自動補完する。

```ts
import { Resources } from "@pocketsign/klon-sdk";

const { url, session } = await client.createAuthorizationURL({
  authorizationDetails: [
    {
      identifiers: [Resources.MERGED_FULL_NAME, Resources.MERGED_BIRTH_DATE],
      actions: ["read"],
      required: true,
    },
    {
      identifiers: [Resources.MERGED_FULL_ADDRESS],
      actions: ["read"],
      prefill: true,
    },
  ],
});
```

ビルダー関数 (`buildAuthorizationDetails`) やパーサー (`parseAuthorizationDetails`) も引き続き利用可能。

### リソース定数

`Resources` に KLON の公式リソースエイリアスが定義されている。

```ts
import { Resources } from "@pocketsign/klon-sdk";

Resources.MERGED_FULL_NAME; // "klon/merged_full_name"
Resources.MERGED_BIRTH_DATE; // "klon/merged_birth_date"
Resources.MERGED_FULL_ADDRESS; // "klon/merged_full_address"
Resources.EMAIL_ADDRESS; // "klon/email_address"
// ... 他多数
```

カテゴリ: `SIGNING_*` (署名用電子証明書), `TICKET_*` (券面事項入力補助AP), `MANUAL_*` (手入力), `MERGED_*` (最も信頼性が高い値), `EMAIL_ADDRESS`, `PHONE_NUMBER`, `FACE_IMAGE`, 実行リソース (`PUSH_NOTIFICATION`, `ACCESS_CAMERA`, `GET_CURRENT_POSITION`, `GET_HIGH_ACCURACY_CURRENT_POSITION`, `ACCESS_FITNESS_DATA`), `CHECK_JPKI_*` (証明書現況確認)

### ResourceAction

`actions` に渡せる値:

| 値       | 説明           |
| -------- | -------------- |
| `read`   | リソースの読取 |
| `write`  | リソースの書込 |
| `invoke` | リソースの実行 |

### Grant Management

`createAuthorizationURL` の `grantManagementAction` に指定する。

```ts
import { GrantManagementActions } from "@pocketsign/klon-sdk";
```

| 定数                             | 値        | 説明                     |
| -------------------------------- | --------- | ------------------------ |
| `GrantManagementActions.CREATE`  | `create`  | 新規グラントを作成する   |
| `GrantManagementActions.REPLACE` | `replace` | 既存グラントを置換する   |
| `GrantManagementActions.MERGE`   | `merge`   | 既存グラントにマージする |

## 動作環境

- Node.js >= 18 (Web Crypto API が必要)
- ブラウザ (Web Crypto API 対応)
- React Native (Expo, `customFetch` でラッパーが必要)

## リリースノートの書き方

リリースノートの正本は [`CHANGELOG.md`](./CHANGELOG.md) です。
[docs リポジトリ](https://github.com/pocketsign/docs)がこのファイルから KLON SDK リリースノートのページを生成するため、社外開発者が読む前提で書いてください。

- 公開APIを変更するPRでは、同じPRで `## Unreleased` に項目を追記してください。あとから書くと漏れます。
- 見出しは `### 破壊的変更` / `### 新機能` / `### 非推奨` / `### 修正` / `### その他` を使い、該当がないものは省略します。
- 書くのは「利用者から見て何が変わったか」と「何をすればよいか」です。内部リファクタリングやパッケージ更新は書きません。公開APIに影響がない版は「公開APIの変更はありません。」の1行にします。
- GitHub Release を作成して社外リリースするときに、`## Unreleased` を `## <version> （YYYY/MM/DD）` へ書き換え、新しい空の `## Unreleased` を追加してください。リリース本文にも同じ内容を貼ってください。

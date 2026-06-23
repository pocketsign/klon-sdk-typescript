/**
 * KLON が提供する個人情報リソースのエイリアス定数集。
 *
 * 認可詳細 (RFC 9396) の `identifiers` や Registry API のリソース指定に使用する。
 * 各値は取得元 (署名用電子証明書 / 券面事項入力補助AP / 手入力 / マージ済み) ごとに
 * 同じ項目のバリエーションを持つ。
 */
export const Resources = {
  // -- 署名用電子証明書 --
  /** 署名用電子証明書: 名 */
  SIGNING_FIRST_NAME: "klon/signing_first_name",
  /** 署名用電子証明書: 姓 */
  SIGNING_LAST_NAME: "klon/signing_last_name",
  /** 署名用電子証明書: 旧姓 */
  SIGNING_MAIDEN_NAME: "klon/signing_maiden_name",
  /** 署名用電子証明書: 氏名 */
  SIGNING_FULL_NAME: "klon/signing_full_name",
  /** 署名用電子証明書: 通称 */
  SIGNING_POPULAR_NAME: "klon/signing_popular_name",
  /** 署名用電子証明書: 性別 */
  SIGNING_GENDER: "klon/signing_gender",
  /** 署名用電子証明書: 都道府県住所 */
  SIGNING_PREFECTURE_ADDRESS: "klon/signing_prefecture_address",
  /** 署名用電子証明書: 市区町村住所 */
  SIGNING_CITY_ADDRESS: "klon/signing_city_address",
  /** 署名用電子証明書: 住所 */
  SIGNING_FULL_ADDRESS: "klon/signing_full_address",
  /** 署名用電子証明書: 国外転出日 */
  SIGNING_MOVING_ABROAD_DATE: "klon/signing_moving_abroad_date",
  /** 署名用電子証明書: 生年 */
  SIGNING_BIRTH_YEAR: "klon/signing_birth_year",
  /** 署名用電子証明書: 生月日 */
  SIGNING_BIRTH_DAY: "klon/signing_birth_day",
  /** 署名用電子証明書: 生年月日 */
  SIGNING_BIRTH_DATE: "klon/signing_birth_date",
  /** 署名用電子証明書: 名 (フリガナ) */
  SIGNING_FIRST_NAME_RUBY: "klon/signing_first_name_ruby",
  /** 署名用電子証明書: 姓 (フリガナ) */
  SIGNING_LAST_NAME_RUBY: "klon/signing_last_name_ruby",
  /** 署名用電子証明書: 旧姓 (フリガナ) */
  SIGNING_MAIDEN_NAME_RUBY: "klon/signing_maiden_name_ruby",
  /** 署名用電子証明書: 氏名 (フリガナ) */
  SIGNING_FULL_NAME_RUBY: "klon/signing_full_name_ruby",

  // -- 券面事項入力補助AP --
  /** 券面事項入力補助AP: 名 */
  TICKET_FIRST_NAME: "klon/ticket_first_name",
  /** 券面事項入力補助AP: 姓 */
  TICKET_LAST_NAME: "klon/ticket_last_name",
  /** 券面事項入力補助AP: 旧姓 */
  TICKET_MAIDEN_NAME: "klon/ticket_maiden_name",
  /** 券面事項入力補助AP: 氏名 */
  TICKET_FULL_NAME: "klon/ticket_full_name",
  /** 券面事項入力補助AP: 通称 */
  TICKET_POPULAR_NAME: "klon/ticket_popular_name",
  /** 券面事項入力補助AP: 性別 */
  TICKET_GENDER: "klon/ticket_gender",
  /** 券面事項入力補助AP: 都道府県住所 */
  TICKET_PREFECTURE_ADDRESS: "klon/ticket_prefecture_address",
  /** 券面事項入力補助AP: 市区町村住所 */
  TICKET_CITY_ADDRESS: "klon/ticket_city_address",
  /** 券面事項入力補助AP: 住所 */
  TICKET_FULL_ADDRESS: "klon/ticket_full_address",
  /** 券面事項入力補助AP: 国外転出日 */
  TICKET_MOVING_ABROAD_DATE: "klon/ticket_moving_abroad_date",
  /** 券面事項入力補助AP: 生年 */
  TICKET_BIRTH_YEAR: "klon/ticket_birth_year",
  /** 券面事項入力補助AP: 生月日 */
  TICKET_BIRTH_DAY: "klon/ticket_birth_day",
  /** 券面事項入力補助AP: 生年月日 */
  TICKET_BIRTH_DATE: "klon/ticket_birth_date",
  /** 券面事項入力補助AP: 名 (フリガナ) */
  TICKET_FIRST_NAME_RUBY: "klon/ticket_first_name_ruby",
  /** 券面事項入力補助AP: 姓 (フリガナ) */
  TICKET_LAST_NAME_RUBY: "klon/ticket_last_name_ruby",
  /** 券面事項入力補助AP: 旧姓 (フリガナ) */
  TICKET_MAIDEN_NAME_RUBY: "klon/ticket_maiden_name_ruby",
  /** 券面事項入力補助AP: 氏名 (フリガナ) */
  TICKET_FULL_NAME_RUBY: "klon/ticket_full_name_ruby",

  // -- 手入力 --
  /** 手入力: 名 */
  MANUAL_FIRST_NAME: "klon/manual_first_name",
  /** 手入力: 姓 */
  MANUAL_LAST_NAME: "klon/manual_last_name",
  /** 手入力: 旧姓 */
  MANUAL_MAIDEN_NAME: "klon/manual_maiden_name",
  /** 手入力: 氏名 */
  MANUAL_FULL_NAME: "klon/manual_full_name",
  /** 手入力: 通称 */
  MANUAL_POPULAR_NAME: "klon/manual_popular_name",
  /** 手入力: 性別 */
  MANUAL_GENDER: "klon/manual_gender",
  /** 手入力: 都道府県住所 */
  MANUAL_PREFECTURE_ADDRESS: "klon/manual_prefecture_address",
  /** 手入力: 市区町村住所 */
  MANUAL_CITY_ADDRESS: "klon/manual_city_address",
  /** 手入力: 住所 */
  MANUAL_FULL_ADDRESS: "klon/manual_full_address",
  /** 手入力: 国外転出日 */
  MANUAL_MOVING_ABROAD_DATE: "klon/manual_moving_abroad_date",
  /** 手入力: 生年 */
  MANUAL_BIRTH_YEAR: "klon/manual_birth_year",
  /** 手入力: 生月日 */
  MANUAL_BIRTH_DAY: "klon/manual_birth_day",
  /** 手入力: 生年月日 */
  MANUAL_BIRTH_DATE: "klon/manual_birth_date",
  /** 手入力: 名 (フリガナ) */
  MANUAL_FIRST_NAME_RUBY: "klon/manual_first_name_ruby",
  /** 手入力: 姓 (フリガナ) */
  MANUAL_LAST_NAME_RUBY: "klon/manual_last_name_ruby",
  /** 手入力: 旧姓 (フリガナ) */
  MANUAL_MAIDEN_NAME_RUBY: "klon/manual_maiden_name_ruby",
  /** 手入力: 氏名 (フリガナ) */
  MANUAL_FULL_NAME_RUBY: "klon/manual_full_name_ruby",

  // -- 署名用電子証明書・券面事項入力補助AP・手入力のうち最も信頼性が高い値 --
  /** マージ済み (最も信頼性が高い値): 名 */
  MERGED_FIRST_NAME: "klon/merged_first_name",
  /** マージ済み (最も信頼性が高い値): 姓 */
  MERGED_LAST_NAME: "klon/merged_last_name",
  /** マージ済み (最も信頼性が高い値): 旧姓 */
  MERGED_MAIDEN_NAME: "klon/merged_maiden_name",
  /** マージ済み (最も信頼性が高い値): 氏名 */
  MERGED_FULL_NAME: "klon/merged_full_name",
  /** マージ済み (最も信頼性が高い値): 通称 */
  MERGED_POPULAR_NAME: "klon/merged_popular_name",
  /** マージ済み (最も信頼性が高い値): 性別 */
  MERGED_GENDER: "klon/merged_gender",
  /** マージ済み (最も信頼性が高い値): 都道府県住所 */
  MERGED_PREFECTURE_ADDRESS: "klon/merged_prefecture_address",
  /** マージ済み (最も信頼性が高い値): 市区町村住所 */
  MERGED_CITY_ADDRESS: "klon/merged_city_address",
  /** マージ済み (最も信頼性が高い値): 住所 */
  MERGED_FULL_ADDRESS: "klon/merged_full_address",
  /** マージ済み (最も信頼性が高い値): 国外転出日 */
  MERGED_MOVING_ABROAD_DATE: "klon/merged_moving_abroad_date",
  /** マージ済み (最も信頼性が高い値): 生年 */
  MERGED_BIRTH_YEAR: "klon/merged_birth_year",
  /** マージ済み (最も信頼性が高い値): 生月日 */
  MERGED_BIRTH_DAY: "klon/merged_birth_day",
  /** マージ済み (最も信頼性が高い値): 生年月日 */
  MERGED_BIRTH_DATE: "klon/merged_birth_date",
  /** マージ済み (最も信頼性が高い値): 名 (フリガナ) */
  MERGED_FIRST_NAME_RUBY: "klon/merged_first_name_ruby",
  /** マージ済み (最も信頼性が高い値): 姓 (フリガナ) */
  MERGED_LAST_NAME_RUBY: "klon/merged_last_name_ruby",
  /** マージ済み (最も信頼性が高い値): 旧姓 (フリガナ) */
  MERGED_MAIDEN_NAME_RUBY: "klon/merged_maiden_name_ruby",
  /** マージ済み (最も信頼性が高い値): 氏名 (フリガナ) */
  MERGED_FULL_NAME_RUBY: "klon/merged_full_name_ruby",

  // -- 連絡先 --
  /** メールアドレス */
  EMAIL_ADDRESS: "klon/email_address",
  /** 電話番号 */
  PHONE_NUMBER: "klon/phone_number",

  // -- 顔写真 --
  /** 顔写真 */
  FACE_IMAGE: "klon/face_image",

  // -- 実行リソース (端末機能の利用やプッシュ通知送信などの権限) --
  /** プッシュ通知を送るための権限 */
  PUSH_NOTIFICATION: "klon/push_notification",
  /** 端末のカメラにアクセスするための権限 */
  ACCESS_CAMERA: "klon/access_camera",
  /** 端末の位置情報にアクセスするための権限 */
  GET_CURRENT_POSITION: "klon/get_current_position",
  /** 端末の詳細な位置情報にアクセスするための権限 */
  GET_HIGH_ACCURACY_CURRENT_POSITION: "klon/get_high_accuracy_current_position",
  /** 身体活動に関する情報 (ヘルスケア) にアクセスするための権限 */
  ACCESS_FITNESS_DATA: "klon/access_fitness_data",

  // -- 証明書現況確認 --
  /** JPKI カード 署名用電子証明書の失効確認 */
  CHECK_JPKI_CARD_DIGITAL_SIGNATURE_CERTIFICATE_REVOCATION:
    "klon/check_jpki_card_digital_signature_certificate_revocation",
  /** JPKI カード 利用者証明用電子証明書の失効確認 */
  CHECK_JPKI_CARD_USER_AUTHENTICATION_CERTIFICATE_REVOCATION:
    "klon/check_jpki_card_user_authentication_certificate_revocation",
  /** JPKI モバイル 署名用電子証明書の失効確認 */
  CHECK_JPKI_MOBILE_DIGITAL_SIGNATURE_CERTIFICATE_REVOCATION:
    "klon/check_jpki_mobile_digital_signature_certificate_revocation",
  /** JPKI モバイル 利用者証明用電子証明書の失効確認 */
  CHECK_JPKI_MOBILE_USER_AUTHENTICATION_CERTIFICATE_REVOCATION:
    "klon/check_jpki_mobile_user_authentication_certificate_revocation",
} as const;

/** {@link Resources} の値のいずれかを表すユニオン型。 */
export type ResourceAlias = (typeof Resources)[keyof typeof Resources];

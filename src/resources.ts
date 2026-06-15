export const Resources = {
  // -- 署名用電子証明書 --
  SIGNING_FIRST_NAME: "klon/signing_first_name",
  SIGNING_LAST_NAME: "klon/signing_last_name",
  SIGNING_MAIDEN_NAME: "klon/signing_maiden_name",
  SIGNING_FULL_NAME: "klon/signing_full_name",
  SIGNING_POPULAR_NAME: "klon/signing_popular_name",
  SIGNING_GENDER: "klon/signing_gender",
  SIGNING_PREFECTURE_ADDRESS: "klon/signing_prefecture_address",
  SIGNING_CITY_ADDRESS: "klon/signing_city_address",
  SIGNING_FULL_ADDRESS: "klon/signing_full_address",
  SIGNING_MOVING_ABROAD_DATE: "klon/signing_moving_abroad_date",
  SIGNING_BIRTH_YEAR: "klon/signing_birth_year",
  SIGNING_BIRTH_DAY: "klon/signing_birth_day",
  SIGNING_BIRTH_DATE: "klon/signing_birth_date",
  SIGNING_FIRST_NAME_RUBY: "klon/signing_first_name_ruby",
  SIGNING_LAST_NAME_RUBY: "klon/signing_last_name_ruby",
  SIGNING_MAIDEN_NAME_RUBY: "klon/signing_maiden_name_ruby",
  SIGNING_FULL_NAME_RUBY: "klon/signing_full_name_ruby",

  // -- 券面事項入力補助AP --
  TICKET_FIRST_NAME: "klon/ticket_first_name",
  TICKET_LAST_NAME: "klon/ticket_last_name",
  TICKET_MAIDEN_NAME: "klon/ticket_maiden_name",
  TICKET_FULL_NAME: "klon/ticket_full_name",
  TICKET_POPULAR_NAME: "klon/ticket_popular_name",
  TICKET_GENDER: "klon/ticket_gender",
  TICKET_PREFECTURE_ADDRESS: "klon/ticket_prefecture_address",
  TICKET_CITY_ADDRESS: "klon/ticket_city_address",
  TICKET_FULL_ADDRESS: "klon/ticket_full_address",
  TICKET_MOVING_ABROAD_DATE: "klon/ticket_moving_abroad_date",
  TICKET_BIRTH_YEAR: "klon/ticket_birth_year",
  TICKET_BIRTH_DAY: "klon/ticket_birth_day",
  TICKET_BIRTH_DATE: "klon/ticket_birth_date",
  TICKET_FIRST_NAME_RUBY: "klon/ticket_first_name_ruby",
  TICKET_LAST_NAME_RUBY: "klon/ticket_last_name_ruby",
  TICKET_MAIDEN_NAME_RUBY: "klon/ticket_maiden_name_ruby",
  TICKET_FULL_NAME_RUBY: "klon/ticket_full_name_ruby",

  // -- 手入力 --
  MANUAL_FIRST_NAME: "klon/manual_first_name",
  MANUAL_LAST_NAME: "klon/manual_last_name",
  MANUAL_MAIDEN_NAME: "klon/manual_maiden_name",
  MANUAL_FULL_NAME: "klon/manual_full_name",
  MANUAL_POPULAR_NAME: "klon/manual_popular_name",
  MANUAL_GENDER: "klon/manual_gender",
  MANUAL_PREFECTURE_ADDRESS: "klon/manual_prefecture_address",
  MANUAL_CITY_ADDRESS: "klon/manual_city_address",
  MANUAL_FULL_ADDRESS: "klon/manual_full_address",
  MANUAL_MOVING_ABROAD_DATE: "klon/manual_moving_abroad_date",
  MANUAL_BIRTH_YEAR: "klon/manual_birth_year",
  MANUAL_BIRTH_DAY: "klon/manual_birth_day",
  MANUAL_BIRTH_DATE: "klon/manual_birth_date",
  MANUAL_FIRST_NAME_RUBY: "klon/manual_first_name_ruby",
  MANUAL_LAST_NAME_RUBY: "klon/manual_last_name_ruby",
  MANUAL_MAIDEN_NAME_RUBY: "klon/manual_maiden_name_ruby",
  MANUAL_FULL_NAME_RUBY: "klon/manual_full_name_ruby",

  // -- 署名用電子証明書・券面事項入力補助AP・手入力のうち最も信頼性が高い値 --
  MERGED_FIRST_NAME: "klon/merged_first_name",
  MERGED_LAST_NAME: "klon/merged_last_name",
  MERGED_MAIDEN_NAME: "klon/merged_maiden_name",
  MERGED_FULL_NAME: "klon/merged_full_name",
  MERGED_POPULAR_NAME: "klon/merged_popular_name",
  MERGED_GENDER: "klon/merged_gender",
  MERGED_PREFECTURE_ADDRESS: "klon/merged_prefecture_address",
  MERGED_CITY_ADDRESS: "klon/merged_city_address",
  MERGED_FULL_ADDRESS: "klon/merged_full_address",
  MERGED_MOVING_ABROAD_DATE: "klon/merged_moving_abroad_date",
  MERGED_BIRTH_YEAR: "klon/merged_birth_year",
  MERGED_BIRTH_DAY: "klon/merged_birth_day",
  MERGED_BIRTH_DATE: "klon/merged_birth_date",
  MERGED_FIRST_NAME_RUBY: "klon/merged_first_name_ruby",
  MERGED_LAST_NAME_RUBY: "klon/merged_last_name_ruby",
  MERGED_MAIDEN_NAME_RUBY: "klon/merged_maiden_name_ruby",
  MERGED_FULL_NAME_RUBY: "klon/merged_full_name_ruby",

  // -- 連絡先 --
  EMAIL_ADDRESS: "klon/email_address",
  PHONE_NUMBER: "klon/phone_number",

  // -- 顔写真 --
  FACE_IMAGE: "klon/face_image",

  // -- 証明書現況確認 --
  CHECK_JPKI_CARD_DIGITAL_SIGNATURE_CERTIFICATE_REVOCATION:
    "klon/check_jpki_card_digital_signature_certificate_revocation",
  CHECK_JPKI_CARD_USER_AUTHENTICATION_CERTIFICATE_REVOCATION:
    "klon/check_jpki_card_user_authentication_certificate_revocation",
  CHECK_JPKI_MOBILE_DIGITAL_SIGNATURE_CERTIFICATE_REVOCATION:
    "klon/check_jpki_mobile_digital_signature_certificate_revocation",
  CHECK_JPKI_MOBILE_USER_AUTHENTICATION_CERTIFICATE_REVOCATION:
    "klon/check_jpki_mobile_user_authentication_certificate_revocation",
} as const;

export type ResourceAlias = (typeof Resources)[keyof typeof Resources];

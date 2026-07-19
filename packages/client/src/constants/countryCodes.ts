export type DialCode = '86' | '852' | '853' | '886' | '1' | '81' | '82' | '44' | '65';
export type ISOCode = 'CN' | 'HK' | 'MO' | 'TW' | 'US' | 'JP' | 'KR' | 'GB' | 'SG';

export interface CountryCode {
  name: string;
  dialCode: DialCode;
  isoCode: ISOCode;
  isDefault?: boolean;
}

export const COUNTRY_CODES: CountryCode[] = [
  { name: '中国', dialCode: '86', isoCode: 'CN', isDefault: true },
  { name: '中国香港', dialCode: '852', isoCode: 'HK' },
  { name: '中国澳门', dialCode: '853', isoCode: 'MO' },
  { name: '中国台湾', dialCode: '886', isoCode: 'TW' },
  { name: '美国/加拿大', dialCode: '1', isoCode: 'US' },
  { name: '日本', dialCode: '81', isoCode: 'JP' },
  { name: '韩国', dialCode: '82', isoCode: 'KR' },
  { name: '英国', dialCode: '44', isoCode: 'GB' },
  { name: '新加坡', dialCode: '65', isoCode: 'SG' },
];

export const DEFAULT_COUNTRY_CODE: CountryCode =
  COUNTRY_CODES.find((c) => c.isDefault) ?? COUNTRY_CODES[0];

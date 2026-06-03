export interface PhoneCountry {
  /** ISO 3166-1 alpha-2 */
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  /** Digit mask: '#' = required digit, other chars are visual separators */
  mask: string;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: 'AT', name: 'Austria',        dialCode: '+43',  flag: '🇦🇹', mask: '### ######' },
  { code: 'BY', name: 'Belarus',        dialCode: '+375', flag: '🇧🇾', mask: '## ###-##-##' },
  { code: 'BE', name: 'Belgium',        dialCode: '+32',  flag: '🇧🇪', mask: '### ## ## ##' },
  { code: 'BG', name: 'Bulgaria',       dialCode: '+359', flag: '🇧🇬', mask: '## ### ###' },
  { code: 'CA', name: 'Canada',         dialCode: '+1',   flag: '🇨🇦', mask: '(###) ###-####' },
  { code: 'HR', name: 'Croatia',        dialCode: '+385', flag: '🇭🇷', mask: '## ### ####' },
  { code: 'CZ', name: 'Czech Republic', dialCode: '+420', flag: '🇨🇿', mask: '### ### ###' },
  { code: 'DK', name: 'Denmark',        dialCode: '+45',  flag: '🇩🇰', mask: '## ## ## ##' },
  { code: 'EE', name: 'Estonia',        dialCode: '+372', flag: '🇪🇪', mask: '### ####' },
  { code: 'FI', name: 'Finland',        dialCode: '+358', flag: '🇫🇮', mask: '## ### ####' },
  { code: 'FR', name: 'France',         dialCode: '+33',  flag: '🇫🇷', mask: '## ## ## ## ##' },
  { code: 'GE', name: 'Georgia',        dialCode: '+995', flag: '🇬🇪', mask: '### ## ## ##' },
  { code: 'DE', name: 'Germany',        dialCode: '+49',  flag: '🇩🇪', mask: '### #######' },
  { code: 'GR', name: 'Greece',         dialCode: '+30',  flag: '🇬🇷', mask: '### ### ####' },
  { code: 'HU', name: 'Hungary',        dialCode: '+36',  flag: '🇭🇺', mask: '## ### ####' },
  { code: 'IL', name: 'Israel',         dialCode: '+972', flag: '🇮🇱', mask: '##-###-####' },
  { code: 'IT', name: 'Italy',          dialCode: '+39',  flag: '🇮🇹', mask: '### ### ####' },
  { code: 'LV', name: 'Latvia',         dialCode: '+371', flag: '🇱🇻', mask: '## ### ###' },
  { code: 'LT', name: 'Lithuania',      dialCode: '+370', flag: '🇱🇹', mask: '### #####' },
  { code: 'MD', name: 'Moldova',        dialCode: '+373', flag: '🇲🇩', mask: '### ## ###' },
  { code: 'NL', name: 'Netherlands',    dialCode: '+31',  flag: '🇳🇱', mask: '## ### ####' },
  { code: 'NO', name: 'Norway',         dialCode: '+47',  flag: '🇳🇴', mask: '### ## ###' },
  { code: 'PL', name: 'Poland',         dialCode: '+48',  flag: '🇵🇱', mask: '### ### ###' },
  { code: 'PT', name: 'Portugal',       dialCode: '+351', flag: '🇵🇹', mask: '### ### ###' },
  { code: 'RO', name: 'Romania',        dialCode: '+40',  flag: '🇷🇴', mask: '### ### ###' },
  { code: 'RU', name: 'Russia',         dialCode: '+7',   flag: '🇷🇺', mask: '### ###-##-##' },
  { code: 'SK', name: 'Slovakia',       dialCode: '+421', flag: '🇸🇰', mask: '### ### ###' },
  { code: 'ES', name: 'Spain',          dialCode: '+34',  flag: '🇪🇸', mask: '### ### ###' },
  { code: 'SE', name: 'Sweden',         dialCode: '+46',  flag: '🇸🇪', mask: '##-### ## ##' },
  { code: 'CH', name: 'Switzerland',    dialCode: '+41',  flag: '🇨🇭', mask: '## ### ## ##' },
  { code: 'TR', name: 'Turkey',         dialCode: '+90',  flag: '🇹🇷', mask: '### ### ## ##' },
  { code: 'AE', name: 'UAE',            dialCode: '+971', flag: '🇦🇪', mask: '## ### ####' },
  { code: 'UA', name: 'Ukraine',        dialCode: '+380', flag: '🇺🇦', mask: '## ### ## ##' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44',  flag: '🇬🇧', mask: '#### ######' },
  { code: 'US', name: 'United States',  dialCode: '+1',   flag: '🇺🇸', mask: '(###) ###-####' },
];

export const DEFAULT_COUNTRY: PhoneCountry =
  PHONE_COUNTRIES.find(c => c.code === 'UA')!;

export function maskLength(mask: string): number {
  return mask.split('').filter(ch => ch === '#').length;
}

export function applyMask(digits: string, mask: string): string {
  let result = '';
  let di = 0;
  for (const ch of mask) {
    if (di >= digits.length) break;
    if (ch === '#') {
      result += digits[di++];
    } else {
      result += ch;
    }
  }
  return result;
}

export function maskPlaceholder(mask: string): string {
  return mask.replace(/#/g, '_');
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function detectCountry(phone: string): PhoneCountry | null {
  const normalized = phone.startsWith('+') ? phone : '+' + phone;
  const sorted = [...PHONE_COUNTRIES].sort(
    (a, b) => b.dialCode.length - a.dialCode.length,
  );
  return sorted.find(c => normalized.startsWith(c.dialCode)) ?? null;
}

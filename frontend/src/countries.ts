// Lista de países comuns para o seletor (PT-PT, com bandeira emoji).
export type Country = { code: string; name: string; flag: string };

export const COUNTRIES: Country[] = [
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'ES', name: 'Espanha', flag: '🇪🇸' },
  { code: 'FR', name: 'França', flag: '🇫🇷' },
  { code: 'BR', name: 'Brasil', flag: '🇧🇷' },
  { code: 'AO', name: 'Angola', flag: '🇦🇴' },
  { code: 'MZ', name: 'Moçambique', flag: '🇲🇿' },
  { code: 'CV', name: 'Cabo Verde', flag: '🇨🇻' },
  { code: 'GW', name: 'Guiné-Bissau', flag: '🇬🇼' },
  { code: 'ST', name: 'São Tomé e Príncipe', flag: '🇸🇹' },
  { code: 'TL', name: 'Timor-Leste', flag: '🇹🇱' },
  { code: 'GB', name: 'Reino Unido', flag: '🇬🇧' },
  { code: 'IE', name: 'Irlanda', flag: '🇮🇪' },
  { code: 'DE', name: 'Alemanha', flag: '🇩🇪' },
  { code: 'IT', name: 'Itália', flag: '🇮🇹' },
  { code: 'NL', name: 'Países Baixos', flag: '🇳🇱' },
  { code: 'BE', name: 'Bélgica', flag: '🇧🇪' },
  { code: 'CH', name: 'Suíça', flag: '🇨🇭' },
  { code: 'LU', name: 'Luxemburgo', flag: '🇱🇺' },
  { code: 'AT', name: 'Áustria', flag: '🇦🇹' },
  { code: 'AD', name: 'Andorra', flag: '🇦🇩' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
  { code: 'CA', name: 'Canadá', flag: '🇨🇦' },
  { code: 'OTHER', name: 'Outro', flag: '🌍' },
];

export const findCountry = (code: string): Country | undefined =>
  COUNTRIES.find((c) => c.code === code || c.name === code);

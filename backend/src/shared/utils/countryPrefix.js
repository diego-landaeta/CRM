// Mapa "país (texto libre del form) → código telefónico internacional".
// Cubre los países LATAM + España + algunos relevantes. Se acepta:
//   - Nombre español: "Venezuela", "España", "México", "Méjico", "Estados Unidos"
//   - Nombre inglés: "Spain", "Mexico", "United States"
//   - Código ISO-2: "VE", "ES", "MX", "US"
//   - Código ISO-3: "VEN", "ESP", "MEX", "USA"
// Devuelve el código numérico SIN '+' (ej. '58' para Venezuela) o null si no se reconoce.

const PREFIX_BY_COUNTRY = {
  // LATAM
  'argentina': '54', 'ar': '54', 'arg': '54',
  'bolivia': '591', 'bo': '591', 'bol': '591',
  'brasil': '55', 'brazil': '55', 'br': '55', 'bra': '55',
  'chile': '56', 'cl': '56', 'chl': '56',
  'colombia': '57', 'co': '57', 'col': '57',
  'costa rica': '506', 'cr': '506', 'cri': '506',
  'cuba': '53', 'cu': '53', 'cub': '53',
  'ecuador': '593', 'ec': '593', 'ecu': '593',
  'el salvador': '503', 'salvador': '503', 'sv': '503', 'slv': '503',
  'guatemala': '502', 'gt': '502', 'gtm': '502',
  'honduras': '504', 'hn': '504', 'hnd': '504',
  'mexico': '52', 'méxico': '52', 'méjico': '52', 'mejico': '52', 'mx': '52', 'mex': '52',
  'nicaragua': '505', 'ni': '505', 'nic': '505',
  'panama': '507', 'panamá': '507', 'pa': '507', 'pan': '507',
  'paraguay': '595', 'py': '595', 'pry': '595',
  'peru': '51', 'perú': '51', 'pe': '51', 'per': '51',
  'puerto rico': '1', 'pr': '1', 'pri': '1',
  'republica dominicana': '1', 'república dominicana': '1', 'dominicana': '1', 'do': '1', 'dom': '1',
  'uruguay': '598', 'uy': '598', 'ury': '598',
  'venezuela': '58', 've': '58', 'ven': '58',
  // Europa
  'espana': '34', 'españa': '34', 'spain': '34', 'es': '34', 'esp': '34',
  'portugal': '351', 'pt': '351', 'prt': '351',
  'francia': '33', 'france': '33', 'fr': '33', 'fra': '33',
  'italia': '39', 'italy': '39', 'it': '39', 'ita': '39',
  'alemania': '49', 'germany': '49', 'de': '49', 'deu': '49',
  'reino unido': '44', 'inglaterra': '44', 'uk': '44', 'gb': '44', 'gbr': '44',
  // Otros frecuentes
  'estados unidos': '1', 'eeuu': '1', 'usa': '1', 'us': '1', 'united states': '1',
  'canada': '1', 'canadá': '1', 'ca': '1', 'can': '1',
};

export function countryToPrefix(raw) {
  if (raw == null) return null;
  const k = String(raw).trim().toLowerCase().replace(/[._]/g, ' ').replace(/\s+/g, ' ');
  if (!k) return null;
  return PREFIX_BY_COUNTRY[k] || null;
}

export default countryToPrefix;

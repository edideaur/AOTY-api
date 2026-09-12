export const BASE = "https://www.albumoftheyear.org";

export const REQ_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

export type FetchOpts = {
  headers: HeadersInit;
  cf: { cacheTtl: number; cacheEverything?: boolean };
  signal?: AbortSignal;
};

export const FETCH_OPTS: FetchOpts = {
  headers: REQ_HEADERS,
  cf: { cacheTtl: 3600, cacheEverything: true },
};

export const FETCH_OPTS_FRESH: FetchOpts = {
  headers: REQ_HEADERS,
  cf: { cacheTtl: 0 },
};

const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  amp: "&",
  nbsp: " ",
  ldquo: "\u201C",
  rdquo: "\u201D",
  lsquo: "\u2018",
  rsquo: "\u2019",
  laquo: "\u00AB",
  raquo: "\u00BB",
  mdash: "\u2014",
  ndash: "\u2013",
  hellip: "\u2026",
  bull: "\u2022",
  middot: "\u00B7",
  copy: "\u00A9",
  reg: "\u00AE",
  trade: "\u2122",
  eacute: "\u00E9",
  Eacute: "\u00C9",
  aacute: "\u00E1",
  Aacute: "\u00C1",
  oacute: "\u00F3",
  Oacute: "\u00D3",
  egrave: "\u00E8",
  Egrave: "\u00C8",
  igrave: "\u00EC",
  Igrave: "\u00CC",
  iacute: "\u00ED",
  Iacute: "\u00CD",
  ograve: "\u00F2",
  Ograve: "\u00D2",
  ugrave: "\u00F9",
  Ugrave: "\u00D9",
  uacute: "\u00FA",
  Uacute: "\u00DA",
  acirc: "\u00E2",
  Acirc: "\u00C2",
  ecirc: "\u00EA",
  Ecirc: "\u00CA",
  icirc: "\u00EE",
  Icirc: "\u00CE",
  ocirc: "\u00F4",
  Ocirc: "\u00D4",
  ucirc: "\u00FB",
  Ucirc: "\u00DB",
  auml: "\u00E4",
  Auml: "\u00C4",
  euml: "\u00EB",
  Euml: "\u00CB",
  iuml: "\u00EF",
  Iuml: "\u00CF",
  ouml: "\u00F6",
  Ouml: "\u00D6",
  uuml: "\u00FC",
  Uuml: "\u00DC",
  uml: "\u00A8",
  ntilde: "\u00F1",
  Ntilde: "\u00D1",
  aring: "\u00E5",
  Aring: "\u00C5",
  oslash: "\u00F8",
  Oslash: "\u00D8",
  aelig: "\u00E6",
  AElig: "\u00C6",
  oelig: "\u0153",
  OElig: "\u0152",
  szlig: "\u00DF",
  iexcl: "\u00A1",
  iquest: "\u00BF",
  not: "\u00AC",
  shy: "\u00AD",
  para: "\u00B6",
  cedil: "\u00B8",
  agrave: "\u00E0",
  Agrave: "\u00C0",
  atilde: "\u00E3",
  Atilde: "\u00C3",
  ccedil: "\u00E7",
  Ccedil: "\u00C7",
  eth: "\u00F0",
  ETH: "\u00D0",
  Eth: "\u00D0",
  yacute: "\u00FD",
  Yacute: "\u00DD",
  thorn: "\u00FE",
  THORN: "\u00DE",
  thorm: "\u00FE",
  THorn: "\u00DE",
  yuml: "\u00FF",
  Yuml: "\u0178",
  otilde: "\u00F5",
  Otilde: "\u00D5",
  brvbar: "\u00A6",
  euro: "\u20AC",
  sbquo: "\u201A",
  bdquo: "\u201E",
  dagger: "\u2020",
  Dagger: "\u2021",
  permil: "\u2030",
  lsaquo: "\u2039",
  rsaquo: "\u203A",
  ordf: "\u00AA",
  ordm: "\u00BA",
  times: "\u00D7",
  divide: "\u00F7",
  plusmn: "\u00B1",
  pound: "\u00A3",
  yen: "\u00A5",
  cent: "\u00A2",
  curren: "\u00A4",
  sect: "\u00A7",
  deg: "\u00B0",
  micro: "\u00B5",
  half: "\u00BD",
  quart: "\u00BC",
  frac34: "\u00BE",
  sup1: "\u00B9",
  sup2: "\u00B2",
  sup3: "\u00B3",
  macr: "\u00AF",
  acute: "\u00B4",
  circ: "\u02C6",
  tilde: "\u02DC",
  alpha: "\u03B1",
  beta: "\u03B2",
  gamma: "\u03B3",
  delta: "\u03B4",
  epsilon: "\u03B5",
  zeta: "\u03B6",
  eta: "\u03B7",
  theta: "\u03B8",
  iota: "\u03B9",
  kappa: "\u03BA",
  lambda: "\u03BB",
  mu: "\u03BC",
  nu: "\u03BD",
  xi: "\u03BE",
  omicron: "\u03BF",
  pi: "\u03C0",
  rho: "\u03C1",
  sigma: "\u03C3",
  tau: "\u03C4",
  upsilon: "\u03C5",
  phi: "\u03C6",
  chi: "\u03C7",
  psi: "\u03C8",
  omega: "\u03C9",
  Gamma: "\u0393",
  Delta: "\u0394",
  Theta: "\u0398",
  Lambda: "\u039B",
  Xi: "\u039E",
  Pi: "\u03A0",
  Sigma: "\u03A3",
  Upsi: "\u03A5",
  Phi: "\u03A6",
  Psi: "\u03A8",
  Omega: "\u03A9",
  alef: "\u2135",
  nous: "\u2207",
  isin: "\u2208",
  notin: "\u2209",
  ni: "\u220B",
  prod: "\u220F",
  sum: "\u2211",
  minus: "\u2212",
  lowast: "\u2217",
  radic: "\u221A",
  prop: "\u221D",
  infin: "\u221E",
  ang: "\u2220",
  and: "\u2227",
  or: "\u2228",
  cap: "\u2229",
  cup: "\u222A",
  int: "\u222B",
  there4: "\u2234",
  sim: "\u223C",
  cong: "\u2245",
  asymp: "\u2248",
  ne: "\u2260",
  equiv: "\u2261",
  le: "\u2264",
  ge: "\u2265",
  sub: "\u2282",
  sup: "\u2283",
  nsub: "\u2284",
  sube: "\u2286",
  supe: "\u2287",
  oplus: "\u2295",
  otimes: "\u2297",
  perp: "\u22A5",
  sdot: "\u22C5",
  lceil: "\u2308",
  rceil: "\u2309",
  lfloor: "\u230A",
  rfloor: "\u230B",
  loz: "\u25CA",
  spades: "\u2660",
  clubs: "\u2663",
  hearts: "\u2665",
  diams: "\u2666",
  flat: "\u266D",
  natural: "\u266E",
  sharp: "\u266F",
  sext: "\u2736",
  bsol: "\u005C",
  frasl: "\u2044",
  Ell: "\u2113",
  Weierp: "\u2118",
  image: "\u2111",
  real: "\u211C",
  alefsym: "\u2135",
  larr: "\u2190",
  uarr: "\u2191",
  rarr: "\u2192",
  darr: "\u2193",
  harr: "\u2194",
  crarr: "\u21B5",
  lArr: "\u21D0",
  uArr: "\u21D1",
  rArr: "\u21D2",
  dArr: "\u21D3",
  hArr: "\u21D4",
  forall: "\u2200",
  part: "\u2202",
  exist: "\u2203",
  empty: "\u2205",
  nabla: "\u2207",
  // Latin Extended (Caron / Hacek)
  scaron: "\u0161",
  Scaron: "\u0160",
  zcaron: "\u017E",
  Zcaron: "\u017D",
  ccaron: "\u010D",
  Ccaron: "\u010C",
  rcaron: "\u0159",
  Rcaron: "\u0158",
  dcaron: "\u010F",
  Dcaron: "\u010E",
  tcaron: "\u0165",
  Tcaron: "\u0164",
  ecaron: "\u011B",
  Ecaron: "\u011A",
  ncaron: "\u0148",
  Ncaron: "\u0147",
  lcaron: "\u013E",
  Lcaron: "\u013D",
  // Latin Extended (Stroke)
  lstrok: "\u0142",
  Lstrok: "\u0141",
  dstrok: "\u0111",
  Dstrok: "\u0110",
  hstrok: "\u0127",
  Hstrok: "\u0126",
  // Latin Extended (Acute)
  cacute: "\u0107",
  Cacute: "\u0106",
  sacute: "\u015B",
  Sacute: "\u015A",
  zacute: "\u017A",
  Zacute: "\u0179",
  nacute: "\u0144",
  Nacute: "\u0143",
  racute: "\u0155",
  Racute: "\u0154",
  lacute: "\u013A",
  Lacute: "\u0139",
  // Latin Extended (Dot)
  zdot: "\u017C",
  Zdot: "\u017B",
  Idot: "\u0130",
  inodot: "\u0131",
  // Latin Extended (Ogonek)
  aogon: "\u0105",
  Aogon: "\u0104",
  eogon: "\u0119",
  Eogon: "\u0118",
  iogon: "\u012F",
  Iogon: "\u012E",
  uogon: "\u0173",
  Uogon: "\u0172",
  // Latin Extended (Breve)
  abreve: "\u0103",
  Abreve: "\u0102",
  gbreve: "\u011F",
  Gbreve: "\u011E",
  // Latin Extended (Cedilla)
  scedil: "\u015F",
  Scedil: "\u015E",
  tcedil: "\u0163",
  Tcedil: "\u0162",
  kcedil: "\u0137",
  Kcedil: "\u0136",
  lcedil: "\u013C",
  Lcedil: "\u013B",
  ncedil: "\u0146",
  Ncedil: "\u0145",
  rcedil: "\u0157",
  Rcedil: "\u0156",
  // Latin Extended (Double Acute)
  odblac: "\u0151",
  Odblac: "\u0150",
  udblac: "\u0171",
  Udblac: "\u0170",
  // Latin Extended (Ring)
  uring: "\u016F",
  Uring: "\u016E",
  // Latin Extended (Macron)
  amacr: "\u0101",
  Amacr: "\u0100",
  emacr: "\u0113",
  Emacr: "\u0112",
  imacr: "\u012B",
  Imacr: "\u012A",
  omacr: "\u014D",
  Omacr: "\u014C",
  umacr: "\u016B",
  Umacr: "\u016A",
  // Latin Extended (Circumflex & Ligature)
  wcirc: "\u0175",
  Wcirc: "\u0174",
  ycirc: "\u0177",
  Ycirc: "\u0176",
  ijlig: "\u0133",
  IJlig: "\u0132",
  eng: "\u014B",
  ENG: "\u014A",
  // Symbols & Punctuation
  fnof: "\u0192",
  prime: "\u2032",
  Prime: "\u2033",
  oline: "\u203E",
  hyphen: "\u2010",
  dash: "\u2010",
  star: "\u2606",
  starf: "\u2605",
};

export function decodeEntities(str: string): string {
  // HTMLRewriter (Workers + Bun) hands back raw text with entities intact,
  // so every user-visible string must pass through here.
  // Loop until stable to unwind double-encoded values like &amp;oacute;.
  for (let i = 0; i < 5; i++) {
    const next = str
      .replace(/&#(\d+);/g, (_, n) => {
        try {
          return String.fromCodePoint(+n);
        } catch {
          return _;
        }
      })
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
        try {
          return String.fromCodePoint(parseInt(h, 16));
        } catch {
          return _;
        }
      })
      .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()] ?? m);
    if (next === str) break;
    str = next;
  }
  return str;
}

export function deepDecodeEntities<T>(val: T): T {
  if (typeof val === "string") return decodeEntities(val) as T;
  if (Array.isArray(val)) return val.map(deepDecodeEntities) as T;
  if (val !== null && typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = deepDecodeEntities(v);
    }
    return out as T;
  }
  return val;
}

export function cleanImageUrl<T extends string | null | undefined>(url: T): T {
  if (!url) return url;
  return url
    .replace(/\/cdn-cgi\/image\/[^/]+\//g, "/")
    .replace(/\/\d+x\d+\//g, "/")
    .replace(/\/sq\//g, "/") as T;
}

/**
 * Parse any scraped numeric text into a proper JSON number.
 * Strips commas, spaces, parentheses, `#`, `%`, `+`, `.` suffixes (track numbers),
 * and extracts the first numeric token. Returns null when no number is present
 * (e.g. "NR", "", "—"). Never returns NaN and never keeps thousand separators,
 * so API consumers always receive real integers/floats instead of "1,234".
 */
export function parseCount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? Math.trunc(raw) : null;
  }
  const s = String(raw).trim();
  if (!s || /^(nr|n\/a|na|—|–|-)$/i.test(s)) return null;
  const cleaned = s.replace(/,/g, "");
  // Compact suffixes as rendered by AOTY ("11.1K", "(40.5K)", "2.3M"): scale up.
  const compact = cleaned.match(/^[^0-9-]*(-?\d+(?:\.\d+)?)\s*([kmb])\b/i);
  if (compact?.[1] && compact[2]) {
    const n = Number(compact[1]);
    if (!Number.isFinite(n)) return null;
    const mult = compact[2].toLowerCase() === "k" ? 1_000 : compact[2].toLowerCase() === "m" ? 1_000_000 : 1_000_000_000;
    return Math.trunc(n * mult);
  }
  const m = cleaned.match(/-?\d+(\.\d+)?/);
  if (!m?.[0]) return null;
  const n = Number(m[0]);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

/** Parse a score (0-100 or 0-10, possibly decimal like "9.5") into a number. */
export function parseScore(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim();
  if (!s || /^(nr|n\/a|na|—|–|-)$/i.test(s)) return null;
  const cleaned = s.replace(/,/g, "");
  const m = cleaned.match(/-?\d+(\.\d+)?/);
  if (!m?.[0]) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Parse an exact score from a title attribute (e.g. "89.5", "89.53"). */
export function parseExactScore(raw: unknown): number | null {
  return parseScore(raw);
}

/** Parse a percentage ("55%", "55.5%") into a plain number (55, 55.5). */
export function parsePercent(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw).replace(/%/g, "").trim();
  if (!s) return null;
  return parseScore(s);
}

/** Parse a rank ("#1", "1.", "1") into an integer. */
export function parseRank(raw: unknown): number | null {
  return parseCount(raw);
}

/** Parse a track number ("1.", "1", "A1" -> null) into an integer. */
export function parseTrackNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.trunc(raw) : null;
  const s = String(raw).trim().replace(/\.$/, "");
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const m = s.replace(/,/g, "").match(/^\d+/);
  return m?.[0] ? parseInt(m[0], 10) : null;
}

/** Parse a year ("2024", "2024 ") into an integer, null otherwise. */
export function parseYear(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    const y = Math.trunc(raw);
    return y >= 1000 && y <= 9999 ? y : null;
  }
  const s = String(raw).trim();
  const m = s.match(/(19|20)\d{2}/);
  return m?.[0] ? parseInt(m[0], 10) : null;
}

/** Parse a numeric ID ("1998", 1998) into an integer, null if not numeric. */
export function parseId(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.trunc(raw) : null;
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) {
    const m = s.match(/^\d+/);
    return m?.[0] ? parseInt(m[0], 10) : null;
  }
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a human-readable duration ("3:45", "1:02:03", "1 hour, 8 minutes", "23 minutes")
 * into total integer seconds, or null if unparseable.
 */
export function parseDurationToSeconds(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.trunc(raw) : null;
  const s = String(raw).replace(/^Total Length:\s*/i, "").trim();
  if (!s) return null;

  // Pattern: "h:mm:ss" or "m:ss" (e.g., "3:45", "03:45", "1:02:03")
  const colonMatch = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (colonMatch) {
    if (colonMatch[3] !== undefined) {
      const hours = parseInt(colonMatch[1] ?? "0", 10);
      const mins = parseInt(colonMatch[2] ?? "0", 10);
      const secs = parseInt(colonMatch[3] ?? "0", 10);
      return hours * 3600 + mins * 60 + secs;
    }
    const mins = parseInt(colonMatch[1] ?? "0", 10);
    const secs = parseInt(colonMatch[2] ?? "0", 10);
    return mins * 60 + secs;
  }

  // Pattern: "X hour(s), Y minute(s)" or "X hours" or "Y minutes" or "Z seconds"
  const hourM = s.match(/(\d+)\s*(?:hours?|hrs?|h)\b/i);
  const minM = s.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i);
  const secM = s.match(/(\d+)\s*(?:seconds?|secs?|s)\b/i);
  if (hourM || minM || secM) {
    const hours = hourM?.[1] ? parseInt(hourM[1], 10) : 0;
    const mins = minM?.[1] ? parseInt(minM[1], 10) : 0;
    const secs = secM?.[1] ? parseInt(secM[1], 10) : 0;
    return hours * 3600 + mins * 60 + secs;
  }

  return null;
}

/**
 * Parse an ISO date, RFC date, exact timestamp, or full date string into Unix timestamp (seconds integer).
 * Returns null for relative times ("2y ago", "11h", "5 minutes ago") or partial dates missing a year ("Jun 15").
 */
export function parseDateToTimestamp(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    // If it looks like milliseconds (e.g. > 1e11), convert to seconds
    return raw > 1e11 ? Math.trunc(raw / 1000) : Math.trunc(raw);
  }
  const s = String(raw).trim();
  if (!s || /ago$|^(yesterday|today)$/i.test(s) || /^\d+[smhdwmy]$/i.test(s)) {
    return null;
  }
  // If year-only (e.g. "2024")
  if (/^\d{4}$/.test(s)) {
    const y = parseInt(s, 10);
    const ms = Date.UTC(y, 0, 1);
    return Math.trunc(ms / 1000);
  }
  // Must contain a 4-digit year to avoid ambiguous yearless dates like "Jun 15"
  if (!/\b(19|20)\d{2}\b/.test(s)) {
    return null;
  }
  const parsed = Date.parse(s);
  if (Number.isNaN(parsed)) return null;
  return Math.trunc(parsed / 1000);
}

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

export const RES_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
  ...CORS_HEADERS,
  "Allow": "GET, HEAD, OPTIONS",
  "Vary": "Accept-Encoding",
  "Timing-Allow-Origin": "*",
};

export const PROBLEM_HEADERS: HeadersInit = {
  "Content-Type": "application/problem+json",
  ...CORS_HEADERS,
  "Vary": "Accept-Encoding",
};
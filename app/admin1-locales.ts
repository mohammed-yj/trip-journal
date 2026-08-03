import type { Locale } from "./i18n";
import { ADMIN1_LABELS, type Admin1Code } from "./admin1-locales-data.ts";

type AdminProperties = Record<string, unknown>;

const CHINA_SOURCE_CODES: Record<string, Admin1Code> = {
  "Hainan Province": "CN-HI",
  "Guangxi Zhuang Autonomous Region": "CN-GX",
  "Fujian Province": "CN-FJ",
  "Yunnan Province": "CN-YN",
  "Guizhou Province": "CN-GZ",
  "Jiangxi Province": "CN-JX",
  "Hunan Province": "CN-HN",
  "Zhejiang Province": "CN-ZJ",
  "Shanghai Municipality": "CN-SH",
  "Chongqing Municipality": "CN-CQ",
  "Hubei Province": "CN-HB",
  "Sichuan Province": "CN-SC",
  "Anhui Province": "CN-AH",
  "Jiangsu Province": "CN-JS",
  "Henan Province": "CN-HA",
  "Tibet Autonomous Region": "CN-XZ",
  "Shandong Province": "CN-SD",
  "Qinghai Province": "CN-QH",
  "Ningxia Ningxia Hui Autonomous Region": "CN-NX",
  "Shaanxi Province": "CN-SN",
  "Tianjin Municipality": "CN-TJ",
  "Shanxi Province": "CN-SX",
  "Beijing Municipality": "CN-BJ",
  "Gansu Province": "CN-GS",
  "Hebei Province": "CN-HE",
  "Liaoning Province": "CN-LN",
  "Jilin Province": "CN-JL",
  "Xinjiang Uyghur Autonomous Region": "CN-XJ",
  "Inner Mongolia Autonomous Region": "CN-NM",
  "Heilongjiang Province": "CN-HL",
  "Macau Special Administrative Region": "CN-MO",
  "Hong Kong Special Administrative Region": "CN-HK",
  "Guangdong Province": "CN-GD",
};

const ITALY_ISTAT_CODES: Record<string, Admin1Code> = {
  "01": "IT-21",
  "02": "IT-23",
  "03": "IT-25",
  "04": "IT-32",
  "05": "IT-34",
  "06": "IT-36",
  "07": "IT-42",
  "08": "IT-45",
  "09": "IT-52",
  "10": "IT-55",
  "11": "IT-57",
  "12": "IT-62",
  "13": "IT-65",
  "14": "IT-67",
  "15": "IT-72",
  "16": "IT-75",
  "17": "IT-77",
  "18": "IT-78",
  "19": "IT-82",
  "20": "IT-88",
};

const COUNTRY_PREFIXES: Record<string, string> = {
  CHN: "CN-",
  USA: "US-",
  RUS: "RU-",
  GBR: "GB-",
  FRA: "FR-",
  DEU: "DE-",
  ITA: "IT-",
  JPN: "JP-",
};

export function admin1SourceName(properties: AdminProperties) {
  return String(properties.shapeName || properties.reg_name || "");
}

export function canonicalAdmin1Code(properties: AdminProperties) {
  const sourceName = admin1SourceName(properties);
  const shapeIso = String(properties.shapeISO || "").toUpperCase();
  if (shapeIso === "CHN") {
    return CHINA_SOURCE_CODES[sourceName] || String(properties.shapeID || sourceName);
  }
  const istatCode = String(properties.reg_istat_code || "").padStart(2, "0");
  if (ITALY_ISTAT_CODES[istatCode]) return ITALY_ISTAT_CODES[istatCode];
  if (shapeIso === "SU-SD") return "US-SD";
  if (/^[A-Z]{2}-[A-Z0-9]+$/.test(shapeIso)) return shapeIso;
  return String(properties.shapeID || sourceName);
}

export function admin1LabelByCode(
  code: string,
  locale: Locale,
  fallback = "",
) {
  const labels = ADMIN1_LABELS[code as Admin1Code];
  return labels?.[locale] || labels?.en || fallback || code;
}

export function admin1FeatureLabel(
  properties: AdminProperties,
  locale: Locale,
) {
  return admin1LabelByCode(
    canonicalAdmin1Code(properties),
    locale,
    admin1SourceName(properties),
  );
}

export function normalizeAdminLookup(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
    .replace(
      /(province|prefecture|municipality|autonomousregion|specialadministrativeregion|oblast|krai|republic|region|state|大区|大區|省|市|自治区|自治區|特别行政区|特別行政區)$/u,
      "",
    );
}

const adminAliases = new Map<string, string>();
for (const [code, labels] of Object.entries(ADMIN1_LABELS)) {
  for (const label of Object.values(labels)) {
    adminAliases.set(`${code.slice(0, 3)}${normalizeAdminLookup(label)}`, code);
  }
}
for (const [sourceName, code] of Object.entries(CHINA_SOURCE_CODES)) {
  adminAliases.set(`CN-${normalizeAdminLookup(sourceName)}`, code);
}

export function resolveAdmin1Code(
  countryCode: string,
  value: unknown,
) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw in ADMIN1_LABELS) return raw;
  const prefix = COUNTRY_PREFIXES[countryCode.toUpperCase()];
  if (!prefix) return "";
  return adminAliases.get(`${prefix}${normalizeAdminLookup(value)}`) || "";
}

export function localizedAdmin1Name(
  countryCode: string,
  adminCode: unknown,
  adminName: unknown,
  locale: Locale,
) {
  const canonicalCode =
    resolveAdmin1Code(countryCode, adminCode) ||
    resolveAdmin1Code(countryCode, adminName);
  return canonicalCode
    ? admin1LabelByCode(canonicalCode, locale)
    : String(adminName || adminCode || "");
}

export function admin1Aliases(code: string) {
  const labels = ADMIN1_LABELS[code as Admin1Code];
  return labels ? Object.values(labels) : [];
}

export const ADMIN1_LABEL_COUNT = Object.keys(ADMIN1_LABELS).length;

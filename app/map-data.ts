import countryCodes from "i18n-iso-countries/codes.json";
import enCountries from "i18n-iso-countries/langs/en.json";
import frCountries from "i18n-iso-countries/langs/fr.json";
import zhCountries from "i18n-iso-countries/langs/zh.json";
import type { Locale } from "./i18n";

type CountryLabel = string | string[];
type CountryLocale = { countries: Record<string, CountryLabel> };
type CountryCodeRow = [string, string, string, string];

const codeRows = countryCodes as CountryCodeRow[];
const alpha2To3 = new Map(codeRows.map(([alpha2, alpha3]) => [alpha2, alpha3]));
const alpha3To2 = new Map(codeRows.map(([alpha2, alpha3]) => [alpha3, alpha2]));
const numericTo3 = new Map(codeRows.map(([, alpha3, numeric]) => [numeric, alpha3]));
const locales: Record<Locale, CountryLocale> = {
  zh: zhCountries as CountryLocale,
  en: enCountries as CountryLocale,
  fr: frCountries as CountryLocale,
};

export const DETAILED_COUNTRIES = new Set([
  "CHN",
  "USA",
  "RUS",
  "GBR",
  "FRA",
  "DEU",
  "ITA",
  "JPN",
]);

export const ADMIN1_FILES: Record<string, string> = {
  CHN: "/maps/admin1/CHN.geojson",
  USA: "/maps/admin1/USA.geojson",
  RUS: "/maps/admin1/RUS.geojson",
  GBR: "/maps/admin1/GBR.geojson",
  FRA: "/maps/admin1/FRA.geojson",
  DEU: "/maps/admin1/DEU.geojson",
  ITA: "/maps/admin1/ITA.topo.json",
  JPN: "/maps/admin1/JPN.geojson",
};

const TAIWAN_NAMES: Record<Locale, string> = {
  zh: "台湾",
  en: "Taiwan",
  fr: "Taïwan",
};

const COUNTRY_ALIASES: Record<string, string> = {
  中国: "CHN",
  中华人民共和国: "CHN",
  china: "CHN",
  cn: "CHN",
  台湾: "TWN",
  台灣: "TWN",
  taiwan: "TWN",
  tw: "TWN",
  美国: "USA",
  美國: "USA",
  美利坚合众国: "USA",
  unitedstates: "USA",
  unitedstatesofamerica: "USA",
  usa: "USA",
  us: "USA",
  英国: "GBR",
  英國: "GBR",
  unitedkingdom: "GBR",
  greatbritain: "GBR",
  uk: "GBR",
  俄罗斯: "RUS",
  俄羅斯: "RUS",
  俄国: "RUS",
  russia: "RUS",
  法国: "FRA",
  法國: "FRA",
  france: "FRA",
  德国: "DEU",
  德國: "DEU",
  germany: "DEU",
  意大利: "ITA",
  義大利: "ITA",
  italy: "ITA",
  日本: "JPN",
  japan: "JPN",
};

function normalized(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function countryName(code: string, locale: Locale) {
  if (code === "TWN") return TAIWAN_NAMES[locale];
  const alpha2 = alpha3To2.get(code);
  const name = alpha2 ? locales[locale].countries[alpha2] : "";
  return Array.isArray(name) ? name[0] : name || code;
}

export function numericToAlpha3(value: unknown) {
  return numericTo3.get(String(value ?? "").padStart(3, "0")) || "";
}

export function resolveCountryCode(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper) && alpha3To2.has(upper)) return upper;
  if (/^[A-Z]{2}$/.test(upper)) return alpha2To3.get(upper) || "";
  const alias = COUNTRY_ALIASES[normalized(raw)];
  if (alias) return alias;
  for (const locale of Object.values(locales)) {
    for (const [alpha2, label] of Object.entries(locale.countries)) {
      const names = Array.isArray(label) ? label : [label];
      if (names.some((name) => normalized(name) === normalized(raw))) {
        return alpha2To3.get(alpha2) || "";
      }
    }
  }
  return "";
}

export function countryOptions(locale: Locale) {
  const items = codeRows.map(([, code]) => ({ code, name: countryName(code, locale) }));
  return items.sort((a, b) =>
    a.name.localeCompare(b.name, locale === "zh" ? "zh-CN" : locale),
  );
}

export type AdminFeature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;

export function adminFeatureName(feature: AdminFeature) {
  return String(feature.properties?.shapeName || feature.properties?.reg_name || "");
}

export function adminFeatureCode(feature: AdminFeature) {
  return String(
    feature.properties?.shapeISO ||
      feature.properties?.shapeID ||
      feature.properties?.reg_istat_code ||
      adminFeatureName(feature),
  );
}

export function normalizeAdminName(value: unknown) {
  return normalized(value).replace(
    /(province|prefecture|municipality|autonomousregion|specialadministrativeregion|oblast|krai|republic|region|state|省|市|自治区|自治區|特别行政区|特別行政區)$/u,
    "",
  );
}

export async function loadAdminFeatures(code: string): Promise<AdminFeature[]> {
  const path = ADMIN1_FILES[code];
  if (!path) return [];
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${code} map data`);
  const json = await response.json();
  if (json.type === "Topology") {
    const { feature } = await import("topojson-client");
    const object = json.objects[Object.keys(json.objects)[0]];
    const collection = feature(json, object) as unknown as GeoJSON.FeatureCollection;
    return collection.features as AdminFeature[];
  }
  return (json.features || []) as AdminFeature[];
}

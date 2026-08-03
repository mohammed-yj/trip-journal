import type { Locale } from "./i18n";

type CityRow = [name: string, admin1Code: string, latitude: number, longitude: number];

export type CityOption = {
  name: string;
  admin1Code: string;
  latitude: number;
  longitude: number;
};

const CITY_LABELS: Record<string, Partial<Record<Locale, string>>> = {
  "CHN:beijing": { zh: "北京", fr: "Pékin" },
  "CHN:changzhou": { zh: "常州" },
  "CHN:chengdu": { zh: "成都" },
  "CHN:chongqing": { zh: "重庆" },
  "CHN:guangzhou": { zh: "广州", fr: "Canton" },
  "CHN:haikou": { zh: "海口" },
  "CHN:hangzhou": { zh: "杭州" },
  "CHN:huaian": { zh: "淮安" },
  "CHN:lianyungang": { zh: "连云港" },
  "CHN:nanjing": { zh: "南京", en: "Nanjing", fr: "Nankin" },
  "CHN:nantong": { zh: "南通" },
  "CHN:shanghai": { zh: "上海" },
  "CHN:shenzhen": { zh: "深圳" },
  "CHN:suzhou": { zh: "苏州" },
  "CHN:tianjin": { zh: "天津" },
  "CHN:wuhan": { zh: "武汉" },
  "CHN:wuxi": { zh: "无锡" },
  "CHN:xian": { zh: "西安" },
  "CHN:xuzhou": { zh: "徐州" },
  "CHN:yangzhou": { zh: "扬州" },
  "CHN:yancheng": { zh: "盐城" },
  "CHN:zhenjiang": { zh: "镇江" },
};

const CITY_OVERRIDES: Record<
  string,
  Partial<Pick<CityOption, "name" | "admin1Code" | "latitude" | "longitude">>
> = {
  "CHN:nanjing": {
    name: "Nanjing",
    admin1Code: "CN-JS",
    latitude: 32.0603,
    longitude: 118.7969,
  },
};

export function normalizeCityName(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function cityKey(countryCode: string, name: string) {
  return `${countryCode}:${normalizeCityName(name)}`;
}

export function cityDisplayName(
  countryCode: string,
  city: Pick<CityOption, "name">,
  locale: Locale,
) {
  return CITY_LABELS[cityKey(countryCode, city.name)]?.[locale] || city.name;
}

export function cityMatches(
  countryCode: string,
  city: CityOption,
  query: string,
  locale: Locale,
) {
  const needle = normalizeCityName(query);
  if (!needle) return true;
  return (
    normalizeCityName(city.name).includes(needle) ||
    normalizeCityName(cityDisplayName(countryCode, city, locale)).includes(needle)
  );
}

export function findExactCity(
  countryCode: string,
  cities: CityOption[],
  value: string,
  locale: Locale,
) {
  const needle = normalizeCityName(value);
  if (!needle) return undefined;
  return cities.find(
    (city) =>
      normalizeCityName(city.name) === needle ||
      normalizeCityName(cityDisplayName(countryCode, city, locale)) === needle,
  );
}

export async function loadCityOptions(countryCode: string): Promise<CityOption[]> {
  if (!countryCode) return [];
  const response = await fetch(`/maps/cities/${countryCode}.json`);
  if (!response.ok) return [];
  const rows = (await response.json()) as CityRow[];
  return rows
    .map(([name, admin1Code, latitude, longitude]) => {
      const override = CITY_OVERRIDES[cityKey(countryCode, name)] || {};
      return {
        name: override.name || name,
        admin1Code: override.admin1Code || admin1Code,
        latitude: override.latitude ?? Number(latitude),
        longitude: override.longitude ?? Number(longitude),
      };
    })
    .filter(
      (city) =>
        city.name && Number.isFinite(city.latitude) && Number.isFinite(city.longitude),
    );
}

import type { Locale } from "./i18n";

type CityRow = [
  name: string,
  admin1Code: string,
  latitude: number,
  longitude: number,
  chineseName?: string,
];

export type CityOption = {
  name: string;
  chineseName: string;
  admin1Code: string;
  latitude: number;
  longitude: number;
};

export function cityDisplayName(city: CityOption, locale: Locale) {
  return locale === "zh" && city.chineseName ? city.chineseName : city.name;
}

export function cityOptionKey(city: CityOption) {
  return `${city.admin1Code}:${city.name}:${city.latitude}:${city.longitude}`;
}

export async function loadCityOptions(countryCode: string): Promise<CityOption[]> {
  if (!countryCode) return [];
  const response = await fetch(`/maps/cities/${countryCode}.json`);
  if (!response.ok) return [];
  const rows = (await response.json()) as CityRow[];
  return rows
    .map(([name, admin1Code, latitude, longitude, chineseName = ""]) => ({
      name,
      chineseName,
      admin1Code,
      latitude: Number(latitude),
      longitude: Number(longitude),
    }))
    .filter(
      (city) =>
        city.name && Number.isFinite(city.latitude) && Number.isFinite(city.longitude),
    );
}

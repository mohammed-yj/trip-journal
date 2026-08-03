"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { Locale } from "./i18n";
import {
  cityDisplayName,
  cityMatches,
  findExactCity,
  loadCityOptions,
  type CityOption,
} from "./city-data";
import {
  adminFeatureCode,
  adminFeatureName,
  countryName,
  countryOptions,
  DETAILED_COUNTRIES,
  loadAdminFeatures,
  type AdminFeature,
} from "./map-data";

export type LocationScope = "country" | "admin1" | "city";

type Props = {
  locale: Locale;
  compact?: boolean;
  defaultCountry?: string;
  defaultCity?: string;
  scope?: LocationScope;
};

const copy = {
  zh: {
    country: "国家或地区",
    admin: "一级行政区",
    city: "搜索并选择城市",
    choose: "请选择",
    optional: "可选",
    cityPlaceholder: "输入城市名称，例如：南京",
    cityHint: "请从列表选择；经纬度会自动填写",
    cityFound: "已匹配坐标",
    cityLoading: "正在加载城市列表…",
  },
  en: {
    country: "Country or territory",
    admin: "State / region",
    city: "Search and choose a city",
    choose: "Choose",
    optional: "Optional",
    cityPlaceholder: "Type a city, for example: Nanjing",
    cityHint: "Choose from the list; coordinates are filled automatically",
    cityFound: "Coordinates matched",
    cityLoading: "Loading cities…",
  },
  fr: {
    country: "Pays ou territoire",
    admin: "Région administrative",
    city: "Rechercher et choisir une ville",
    choose: "Choisir",
    optional: "Facultatif",
    cityPlaceholder: "Saisissez une ville, par exemple : Nankin",
    cityHint: "Choisissez dans la liste ; les coordonnées sont automatiques",
    cityFound: "Coordonnées trouvées",
    cityLoading: "Chargement des villes…",
  },
} as const;

export default function LocationPicker({
  locale,
  compact = false,
  defaultCountry = "CHN",
  defaultCity = "",
  scope = "country",
}: Props) {
  const labels = copy[locale];
  const listId = useId();
  const options = useMemo(() => countryOptions(locale), [locale]);
  const [countryCode, setCountryCode] = useState(defaultCountry);
  const [adminCode, setAdminCode] = useState("");
  const [adminFeatures, setAdminFeatures] = useState<AdminFeature[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [cityValue, setCityValue] = useState(defaultCity);
  const [selectedCity, setSelectedCity] = useState<CityOption>();
  const [loadedCityCountry, setLoadedCityCountry] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!DETAILED_COUNTRIES.has(countryCode)) {
      return;
    }
    loadAdminFeatures(countryCode)
      .then((features) => {
        if (!cancelled) setAdminFeatures(features);
      })
      .catch(() => {
        if (!cancelled) setAdminFeatures([]);
      });
    return () => {
      cancelled = true;
    };
  }, [countryCode]);

  useEffect(() => {
    let cancelled = false;
    if (scope !== "city" || !countryCode) {
      return;
    }
    loadCityOptions(countryCode)
      .then((items) => {
        if (!cancelled) setCities(items);
      })
      .catch(() => {
        if (!cancelled) setCities([]);
      })
      .finally(() => {
        if (!cancelled) setLoadedCityCountry(countryCode);
      });
    return () => {
      cancelled = true;
    };
  }, [countryCode, scope]);

  const selectedAdmin = adminFeatures.find(
    (item) => adminFeatureCode(item) === adminCode,
  );
  const eligibleCities = useMemo(
    () => cities.filter((city) => !adminCode || city.admin1Code === adminCode),
    [cities, adminCode],
  );
  const citySuggestions = useMemo(
    () =>
      eligibleCities
        .filter((city) => cityMatches(countryCode, city, cityValue, locale))
        .slice(0, 120),
    [eligibleCities, countryCode, cityValue, locale],
  );

  const resetCity = () => {
    setCityValue("");
    setSelectedCity(undefined);
  };

  return (
    <div className={`location-picker ${compact ? "location-picker-compact" : ""}`}>
      <label className="field">
        <span>{labels.country}</span>
        <select
          name="country_code"
          value={countryCode}
          onChange={(event) => {
            setCountryCode(event.target.value);
            setAdminCode("");
            setAdminFeatures([]);
            setCities([]);
            setLoadedCityCountry("");
            resetCity();
          }}
          required
        >
          <option value="">{labels.choose}</option>
          {options.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <input type="hidden" name="country_name" value={countryName(countryCode, locale)} />
      <input type="hidden" name="country" value={countryName(countryCode, locale)} />

      {scope !== "country" && DETAILED_COUNTRIES.has(countryCode) ? (
        <label className="field">
          <span>{labels.admin}</span>
          <select
            name="admin1_code"
            value={adminCode}
            onChange={(event) => {
              setAdminCode(event.target.value);
              resetCity();
            }}
            required={scope === "admin1"}
          >
            <option value="">{scope === "city" ? labels.optional : labels.choose}</option>
            {adminFeatures.map((item) => {
              const code = adminFeatureCode(item);
              return (
                <option key={code} value={code}>
                  {adminFeatureName(item, locale)}
                </option>
              );
            })}
          </select>
        </label>
      ) : null}
      <input
        type="hidden"
        name="admin1_name"
        value={selectedAdmin ? adminFeatureName(selectedAdmin, locale) : ""}
      />
      <input
        type="hidden"
        name="region_or_state"
        value={selectedAdmin ? adminFeatureName(selectedAdmin, locale) : ""}
      />

      {scope === "city" ? (
        <label className="field city-search-field">
          <span>{labels.city}</span>
          <input
            name="city"
            value={cityValue}
            list={listId}
            autoComplete="off"
            placeholder={labels.cityPlaceholder}
            onChange={(event) => {
              const value = event.target.value;
              setCityValue(value);
              const match = findExactCity(
                countryCode,
                adminCode ? eligibleCities : cities,
                value,
                locale,
              );
              setSelectedCity(match);
              if (match?.admin1Code && DETAILED_COUNTRIES.has(countryCode)) {
                setAdminCode(match.admin1Code);
              }
            }}
            required
          />
          <datalist id={listId}>
            {citySuggestions.map((city) => (
              <option
                key={`${city.admin1Code}:${city.name}:${city.latitude}:${city.longitude}`}
                value={cityDisplayName(countryCode, city, locale)}
              >
                {city.name}
              </option>
            ))}
          </datalist>
          <small>
            {loadedCityCountry !== countryCode
              ? labels.cityLoading
              : selectedCity
                ? `${labels.cityFound} · ${selectedCity.latitude.toFixed(4)}, ${selectedCity.longitude.toFixed(4)}`
                : labels.cityHint}
          </small>
        </label>
      ) : null}
      <input type="hidden" name="latitude" value={selectedCity?.latitude ?? ""} />
      <input type="hidden" name="longitude" value={selectedCity?.longitude ?? ""} />
    </div>
  );
}

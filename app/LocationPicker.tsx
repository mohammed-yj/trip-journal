"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "./i18n";
import {
  cityDisplayName,
  cityOptionKey,
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
    city: "城市",
    choose: "请选择",
    optional: "可选",
    chooseAdminFirst: "请先选择一级行政区",
    chooseCity: "请选择城市",
    cityLoading: "正在加载城市…",
  },
  en: {
    country: "Country or territory",
    admin: "State / region",
    city: "City",
    choose: "Choose",
    optional: "Optional",
    chooseAdminFirst: "Choose a state / region first",
    chooseCity: "Choose a city",
    cityLoading: "Loading cities…",
  },
  fr: {
    country: "Pays ou territoire",
    admin: "Région administrative",
    city: "Ville",
    choose: "Choisir",
    optional: "Facultatif",
    chooseAdminFirst: "Choisissez d’abord une région",
    chooseCity: "Choisissez une ville",
    cityLoading: "Chargement des villes…",
  },
} as const;

export default function LocationPicker({
  locale,
  compact = false,
  defaultCountry = "CHN",
  scope: requestedScope,
}: Props) {
  const scope = requestedScope ?? "city";
  const preciseLocationRequired = requestedScope === "city";
  const labels = copy[locale];
  const options = useMemo(() => countryOptions(locale), [locale]);
  const [countryCode, setCountryCode] = useState(defaultCountry);
  const [adminCode, setAdminCode] = useState("");
  const [adminFeatures, setAdminFeatures] = useState<AdminFeature[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [selectedCity, setSelectedCity] = useState<CityOption>();
  const [loadedCityCountry, setLoadedCityCountry] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!DETAILED_COUNTRIES.has(countryCode)) return;
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
    if (scope !== "city" || !countryCode) return;
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

  const isDetailedCountry = DETAILED_COUNTRIES.has(countryCode);
  const selectedAdmin = adminFeatures.find(
    (item) => adminFeatureCode(item) === adminCode,
  );
  const eligibleCities = useMemo(
    () =>
      cities
        .filter((city) => !isDetailedCountry || city.admin1Code === adminCode)
        .toSorted((left, right) =>
          cityDisplayName(left, locale).localeCompare(
            cityDisplayName(right, locale),
            locale === "zh" ? "zh-CN" : locale,
          ),
        ),
    [cities, isDetailedCountry, adminCode, locale],
  );

  const resetCity = () => setSelectedCity(undefined);

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
            <option key={item.code} value={item.code}>{item.name}</option>
          ))}
        </select>
      </label>
      <input type="hidden" name="country_name" value={countryName(countryCode, locale)} />
      <input type="hidden" name="country" value={countryName(countryCode, locale)} />

      {scope !== "country" && isDetailedCountry ? (
        <label className="field">
          <span>{labels.admin}</span>
          <select
            name="admin1_code"
            value={adminCode}
            onChange={(event) => {
              setAdminCode(event.target.value);
              resetCity();
            }}
            required={requestedScope === "admin1" || preciseLocationRequired}
          >
            <option value="">{labels.choose}</option>
            {adminFeatures.map((item) => {
              const code = adminFeatureCode(item);
              return <option key={code} value={code}>{adminFeatureName(item, locale)}</option>;
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
        <label className="field city-select-field">
          <span>{labels.city}</span>
          <select
            value={selectedCity ? cityOptionKey(selectedCity) : ""}
            onChange={(event) => {
              setSelectedCity(
                eligibleCities.find((city) => cityOptionKey(city) === event.target.value),
              );
            }}
            disabled={
              loadedCityCountry !== countryCode ||
              (isDetailedCountry && !adminCode)
            }
            required={preciseLocationRequired}
          >
            <option value="">
              {loadedCityCountry !== countryCode
                ? labels.cityLoading
                : isDetailedCountry && !adminCode
                  ? labels.chooseAdminFirst
                  : labels.chooseCity}
            </option>
            {eligibleCities.map((city) => (
              <option key={cityOptionKey(city)} value={cityOptionKey(city)}>
                {cityDisplayName(city, locale)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <input
        type="hidden"
        name="city"
        value={selectedCity ? cityDisplayName(selectedCity, locale) : ""}
      />
      <input type="hidden" name="latitude" value={selectedCity?.latitude ?? ""} />
      <input type="hidden" name="longitude" value={selectedCity?.longitude ?? ""} />
    </div>
  );
}

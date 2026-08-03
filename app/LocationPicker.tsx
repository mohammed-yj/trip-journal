"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "./i18n";
import {
  adminFeatureCode,
  adminFeatureName,
  countryName,
  countryOptions,
  DETAILED_COUNTRIES,
  loadAdminFeatures,
  type AdminFeature,
} from "./map-data";

type Props = {
  locale: Locale;
  compact?: boolean;
  defaultCountry?: string;
  defaultCity?: string;
};

const copy = {
  zh: {
    country: "国家或地区",
    admin: "一级行政区",
    city: "城市",
    latitude: "纬度",
    longitude: "经度",
    choose: "请选择",
    optional: "可选",
    precise: "城市图钉需要经纬度",
  },
  en: {
    country: "Country or territory",
    admin: "State / region",
    city: "City",
    latitude: "Latitude",
    longitude: "Longitude",
    choose: "Choose",
    optional: "Optional",
    precise: "City pins need coordinates",
  },
  fr: {
    country: "Pays ou territoire",
    admin: "Région administrative",
    city: "Ville",
    latitude: "Latitude",
    longitude: "Longitude",
    choose: "Choisir",
    optional: "Facultatif",
    precise: "Les épingles de ville exigent des coordonnées",
  },
} as const;

export default function LocationPicker({
  locale,
  compact = false,
  defaultCountry = "CHN",
  defaultCity = "",
}: Props) {
  const labels = copy[locale];
  const options = useMemo(() => countryOptions(locale), [locale]);
  const [countryCode, setCountryCode] = useState(defaultCountry);
  const [adminCode, setAdminCode] = useState("");
  const [adminFeatures, setAdminFeatures] = useState<AdminFeature[]>([]);

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

  const selectedAdmin = adminFeatures.find(
    (item) => adminFeatureCode(item) === adminCode,
  );

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

      {DETAILED_COUNTRIES.has(countryCode) ? (
        <label className="field">
          <span>{labels.admin}</span>
          <select
            name="admin1_code"
            value={adminCode}
            onChange={(event) => setAdminCode(event.target.value)}
          >
            <option value="">{labels.optional}</option>
            {adminFeatures.map((item) => {
              const code = adminFeatureCode(item);
              return (
                <option key={code} value={code}>
                  {adminFeatureName(item)}
                </option>
              );
            })}
          </select>
        </label>
      ) : null}
      <input
        type="hidden"
        name="admin1_name"
        value={selectedAdmin ? adminFeatureName(selectedAdmin) : ""}
      />
      <input
        type="hidden"
        name="region_or_state"
        value={selectedAdmin ? adminFeatureName(selectedAdmin) : ""}
      />

      <label className="field">
        <span>{labels.city}</span>
        <input name="city" defaultValue={defaultCity} placeholder={labels.optional} />
      </label>
      <label className="field">
        <span>{labels.latitude}</span>
        <input name="latitude" inputMode="decimal" placeholder="48.8566" />
      </label>
      <label className="field">
        <span>{labels.longitude}</span>
        <input name="longitude" inputMode="decimal" placeholder="2.3522" />
        {!compact ? <small>{labels.precise}</small> : null}
      </label>
    </div>
  );
}

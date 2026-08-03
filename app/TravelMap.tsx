"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { geoMercator, geoNaturalEarth1, geoPath, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import type { Locale } from "./i18n";
import LocationPicker from "./LocationPicker";
import {
  adminFeatureCode,
  adminFeatureName,
  countryName,
  DETAILED_COUNTRIES,
  loadAdminFeatures,
  normalizeAdminName,
  numericToAlpha3,
  resolveCountryCode,
  type AdminFeature,
} from "./map-data";

type Row = Record<string, any>;

type Props = {
  locale: Locale;
  venues: Row[];
  visits: Row[];
  trips: Row[];
  mapMarks: Row[];
  busy?: boolean;
  onAddMark: (payload: Row) => Promise<unknown>;
  onRemoveMark: (id: string) => Promise<unknown>;
};

type WorldFeature = GeoJSON.Feature<GeoJSON.Geometry, { name?: string }> & {
  id?: string | number;
};

const labels = {
  zh: {
    eyebrow: "足迹地图",
    title: "去过的地方",
    subtitle: "国家、地区与城市会随记录自动点亮",
    world: "世界",
    zoomIn: "放大",
    zoomOut: "缩小",
    reset: "重置地图",
    add: "＋ 添加足迹",
    cancel: "取消",
    scope: "点亮层级",
    country: "国家或地区",
    admin: "一级行政区",
    city: "城市图钉",
    save: "点亮地图",
    invalidAdmin: "请选择一级行政区",
    invalidCity: "城市图钉需要填写城市、纬度和经度",
    countries: "个国家/地区",
    regions: "个一级行政区",
    cities: "座城市",
    empty: "添加第一段旅程后，地图会从这里亮起来。",
    manual: "手动添加",
    remove: "移除",
    source: "地图：Natural Earth；行政区：geoBoundaries / ISTAT",
  },
  en: {
    eyebrow: "FOOTPRINT MAP",
    title: "Places visited",
    subtitle: "Countries, regions and cities light up as you add records",
    world: "World",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    reset: "Reset map",
    add: "+ Add a footprint",
    cancel: "Cancel",
    scope: "Map level",
    country: "Country or territory",
    admin: "State / region",
    city: "City pin",
    save: "Light up map",
    invalidAdmin: "Choose a state or region",
    invalidCity: "A city pin needs a city, latitude and longitude",
    countries: "countries / territories",
    regions: "regions",
    cities: "cities",
    empty: "Add your first trip and the map will begin to light up.",
    manual: "Manual",
    remove: "Remove",
    source: "Map: Natural Earth; regions: geoBoundaries / ISTAT",
  },
  fr: {
    eyebrow: "CARTE DES TRACES",
    title: "Lieux visités",
    subtitle: "Pays, régions et villes s’illuminent avec vos archives",
    world: "Monde",
    zoomIn: "Agrandir",
    zoomOut: "Réduire",
    reset: "Réinitialiser la carte",
    add: "+ Ajouter une trace",
    cancel: "Annuler",
    scope: "Niveau de carte",
    country: "Pays ou territoire",
    admin: "Région administrative",
    city: "Épingle de ville",
    save: "Éclairer la carte",
    invalidAdmin: "Choisissez une région administrative",
    invalidCity: "Une ville, une latitude et une longitude sont requises",
    countries: "pays / territoires",
    regions: "régions",
    cities: "villes",
    empty: "Ajoutez votre premier voyage pour éclairer la carte.",
    manual: "Manuel",
    remove: "Retirer",
    source: "Carte : Natural Earth ; régions : geoBoundaries / ISTAT",
  },
} as const;

function worldCode(featureItem: WorldFeature) {
  return numericToAlpha3(featureItem.id);
}

function finiteCoordinate(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function markKey(mark: Row) {
  return [
    mark.scope,
    mark.country_code,
    mark.admin1_code || normalizeAdminName(mark.admin1_name),
    normalizeAdminName(mark.city_name),
  ].join(":");
}

export default function TravelMap({
  locale,
  venues,
  visits,
  trips,
  mapMarks,
  busy = false,
  onAddMark,
  onRemoveMark,
}: Props) {
  const l = labels[locale];
  const [worldFeatures, setWorldFeatures] = useState<WorldFeature[]>([]);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [adminFeatures, setAdminFeatures] = useState<AdminFeature[]>([]);
  const [zoom, setZoom] = useState(1);
  const [adding, setAdding] = useState(false);
  const [scope, setScope] = useState("country");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/maps/world-countries.json")
      .then((response) => response.json())
      .then((topology) => {
        if (cancelled) return;
        const collection = feature(
          topology,
          topology.objects.countries,
        ) as unknown as GeoJSON.FeatureCollection;
        setWorldFeatures(collection.features as WorldFeature[]);
      })
      .catch(() => setWorldFeatures([]));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!selectedCountry || !DETAILED_COUNTRIES.has(selectedCountry)) return;
    loadAdminFeatures(selectedCountry)
      .then((items) => {
        if (!cancelled) setAdminFeatures(items);
      })
      .catch(() => {
        if (!cancelled) setAdminFeatures([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCountry]);

  const venueMap = useMemo(
    () => new Map(venues.map((venue) => [venue.id, venue])),
    [venues],
  );
  const visitedVenueIds = useMemo(
    () => new Set(visits.map((visit) => visit.venue_id)),
    [visits],
  );
  const completedTripIds = useMemo(
    () => new Set(trips.filter((trip) => trip.status === "已完成").map((trip) => trip.id)),
    [trips],
  );

  const effectiveMarks = useMemo(() => {
    const seen = new Set<string>();
    return mapMarks.filter((mark) => {
      const active =
        mark.source_type === "manual" ||
        (mark.source_type === "venue" && visitedVenueIds.has(mark.source_id)) ||
        (mark.source_type === "trip" && completedTripIds.has(mark.source_id));
      if (!active) return false;
      const key = markKey(mark);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [mapMarks, visitedVenueIds, completedTripIds]);

  const visitedVenues = useMemo(
    () =>
      Array.from(visitedVenueIds)
        .map((id) => venueMap.get(id))
        .filter(Boolean) as Row[],
    [visitedVenueIds, venueMap],
  );

  const visitedCountries = useMemo(() => {
    const set = new Set<string>();
    effectiveMarks.forEach((mark) => set.add(mark.country_code));
    visitedVenues.forEach((venue) => {
      const code = resolveCountryCode(venue.country_code || venue.country);
      if (code) set.add(code);
    });
    return set;
  }, [effectiveMarks, visitedVenues]);

  const visitedAdminKeys = useMemo(() => {
    const set = new Set<string>();
    effectiveMarks.forEach((mark) => {
      if (mark.admin1_code) set.add(`${mark.country_code}:${mark.admin1_code}`);
      if (mark.admin1_name) {
        set.add(`${mark.country_code}:name:${normalizeAdminName(mark.admin1_name)}`);
      }
    });
    visitedVenues.forEach((venue) => {
      const code = resolveCountryCode(venue.country_code || venue.country);
      if (code && venue.region_or_state) {
        set.add(`${code}:name:${normalizeAdminName(venue.region_or_state)}`);
      }
    });
    return set;
  }, [effectiveMarks, visitedVenues]);

  const pins = useMemo(() => {
    const byKey = new Map<string, Row>();
    effectiveMarks.forEach((mark) => {
      const latitude = finiteCoordinate(mark.latitude);
      const longitude = finiteCoordinate(mark.longitude);
      if (mark.city_name && latitude !== null && longitude !== null) {
        byKey.set(markKey(mark), { ...mark, latitude, longitude });
      }
    });
    visitedVenues.forEach((venue) => {
      const latitude = finiteCoordinate(venue.latitude);
      const longitude = finiteCoordinate(venue.longitude);
      if (!venue.city || latitude === null || longitude === null) return;
      const countryCode = resolveCountryCode(venue.country_code || venue.country);
      const key = ["city", countryCode, normalizeAdminName(venue.region_or_state), normalizeAdminName(venue.city)].join(":");
      if (!byKey.has(key)) {
        byKey.set(key, {
          city_name: venue.city,
          country_code: countryCode,
          latitude,
          longitude,
        });
      }
    });
    return Array.from(byKey.values());
  }, [effectiveMarks, visitedVenues]);

  const selectedWorldFeature = worldFeatures.find(
    (item) => worldCode(item) === selectedCountry,
  );

  const projection = useMemo(() => {
    let next: GeoProjection;
    if (selectedCountry && selectedWorldFeature) {
      const details: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: adminFeatures.length ? adminFeatures : [selectedWorldFeature],
      };
      next = geoMercator().fitExtent(
        [
          [34, 34],
          [966, 506],
        ],
        details,
      );
    } else {
      const collection: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: worldFeatures,
      };
      next = geoNaturalEarth1().fitExtent(
        [
          [20, 22],
          [980, 516],
        ],
        collection,
      );
    }
    return next;
  }, [worldFeatures, selectedCountry, selectedWorldFeature, adminFeatures]);

  const path = useMemo(() => geoPath(projection), [projection]);
  const visiblePins = pins.filter(
    (pin) => !selectedCountry || pin.country_code === selectedCountry,
  );
  const manualMarks = mapMarks.filter((mark) => mark.source_type === "manual");
  const regionCount = new Set(
    effectiveMarks
      .filter((mark) => mark.admin1_code || mark.admin1_name)
      .map((mark) => `${mark.country_code}:${mark.admin1_code || normalizeAdminName(mark.admin1_name)}`),
  ).size;

  const reset = () => {
    setSelectedCountry("");
    setAdminFeatures([]);
    setZoom(1);
  };

  const submitMark = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries()) as Row;
    payload.scope = scope;
    if (scope === "admin1" && !payload.admin1_code) {
      setError(l.invalidAdmin);
      return;
    }
    if (
      scope === "city" &&
      (!String(payload.city || "").trim() ||
        !String(payload.latitude || "").trim() ||
        !String(payload.longitude || "").trim())
    ) {
      setError(l.invalidCity);
      return;
    }
    await onAddMark(payload);
    setAdding(false);
  };

  return (
    <section className="travel-map-card" aria-label={l.title}>
      <div className="travel-map-head">
        <div>
          <p className="eyebrow">{l.eyebrow}</p>
          <h2>{selectedCountry ? countryName(selectedCountry, locale) : l.title}</h2>
          <p>{l.subtitle}</p>
        </div>
        <div className="map-tools" aria-label={l.reset}>
          {selectedCountry ? (
            <button type="button" onClick={reset} className="map-world-button">
              ← {l.world}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
            aria-label={l.zoomIn}
            title={l.zoomIn}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))}
            aria-label={l.zoomOut}
            title={l.zoomOut}
          >
            −
          </button>
        </div>
      </div>

      <div className="travel-map-canvas">
        {worldFeatures.length ? (
          <svg viewBox="0 0 1000 540" role="img" aria-label={l.title}>
            <g transform={`translate(${500 * (1 - zoom)} ${270 * (1 - zoom)}) scale(${zoom})`}>
              {!selectedCountry
                ? worldFeatures.map((item, index) => {
                    const code = worldCode(item);
                    const name = code ? countryName(code, locale) : item.properties?.name || "";
                    return (
                      <path
                        key={`${code || "feature"}-${index}`}
                        d={path(item) || undefined}
                        className={`map-country ${visitedCountries.has(code) ? "is-visited" : ""}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (!code) return;
                          setSelectedCountry(code);
                          setAdminFeatures([]);
                          setZoom(1);
                        }}
                        onKeyDown={(event) => {
                          if ((event.key === "Enter" || event.key === " ") && code) {
                            setSelectedCountry(code);
                            setAdminFeatures([]);
                            setZoom(1);
                          }
                        }}
                      >
                        <title>{name}</title>
                      </path>
                    );
                  })
                : adminFeatures.length
                  ? adminFeatures.map((item, index) => {
                      const code = adminFeatureCode(item);
                      const name = adminFeatureName(item);
                      const isVisited =
                        visitedAdminKeys.has(`${selectedCountry}:${code}`) ||
                        visitedAdminKeys.has(
                          `${selectedCountry}:name:${normalizeAdminName(name)}`,
                        );
                      return (
                        <path
                          key={`${code}-${index}`}
                          d={path(item) || undefined}
                          className={`map-country map-admin ${isVisited ? "is-visited" : ""}`}
                        >
                          <title>{name}</title>
                        </path>
                      );
                    })
                  : selectedWorldFeature
                    ? (
                        <path
                          d={path(selectedWorldFeature) || undefined}
                          className={`map-country ${visitedCountries.has(selectedCountry) ? "is-visited" : ""}`}
                        >
                          <title>{countryName(selectedCountry, locale)}</title>
                        </path>
                      )
                    : null}

              {visiblePins.map((pin, index) => {
                const point = projection([Number(pin.longitude), Number(pin.latitude)]);
                if (!point) return null;
                return (
                  <g className="map-pin" transform={`translate(${point[0]} ${point[1]})`} key={`${markKey(pin)}-${index}`}>
                    <circle r={7 / zoom} />
                    <circle className="map-pin-core" r={2.4 / zoom} />
                    <title>{pin.city_name}</title>
                  </g>
                );
              })}
            </g>
          </svg>
        ) : (
          <div className="map-loading" aria-hidden="true" />
        )}
      </div>

      <div className="map-summary">
        <span><strong>{visitedCountries.size}</strong> {l.countries}</span>
        <span><strong>{regionCount}</strong> {l.regions}</span>
        <span><strong>{pins.length}</strong> {l.cities}</span>
      </div>
      {!visitedCountries.size ? <p className="map-empty">{l.empty}</p> : null}

      {adding ? (
        <form className="map-add-form" onSubmit={submitMark}>
          <div className="map-scope">
            <span>{l.scope}</span>
            {(["country", "admin1", "city"] as const).map((value) => (
              <button
                type="button"
                key={value}
                className={scope === value ? "active" : ""}
                onClick={() => setScope(value)}
              >
                {value === "country" ? l.country : value === "admin1" ? l.admin : l.city}
              </button>
            ))}
          </div>
          <LocationPicker locale={locale} compact />
          {error ? <p className="map-form-error">{error}</p> : null}
          <div className="map-form-actions">
            <button type="button" onClick={() => setAdding(false)}>{l.cancel}</button>
            <button className="primary" disabled={busy}>{l.save}</button>
          </div>
        </form>
      ) : (
        <button type="button" className="map-add-button" onClick={() => setAdding(true)}>
          {l.add}
        </button>
      )}

      {manualMarks.length ? (
        <div className="manual-marks">
          {manualMarks.slice(0, 4).map((mark) => (
            <span key={mark.id}>
              {mark.city_name || mark.admin1_name || mark.country_name || countryName(mark.country_code, locale)}
              <button
                type="button"
                onClick={() => onRemoveMark(mark.id)}
                aria-label={`${l.remove} ${mark.city_name || mark.country_name}`}
                title={l.remove}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <small className="map-source">{l.source}</small>
    </section>
  );
}

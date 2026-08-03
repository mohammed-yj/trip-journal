"use client";

import {
  FormEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { geoMercator, geoNaturalEarth1, geoPath, type GeoProjection } from "d3-geo";
import { feature, neighbors } from "topojson-client";
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

const ZOOM_LEVELS = [1, 2, 4, 8] as const;

const DETAIL_FOCUS_BOUNDS: Record<
  string,
  [west: number, south: number, east: number, north: number]
> = {
  CHN: [73, 18, 135, 54],
  USA: [-125, 24, -66, 50],
  RUS: [19, 41, 179.5, 78],
  GBR: [-9, 49.5, 2.5, 61],
  FRA: [-5.5, 41, 10, 51.5],
  DEU: [5.5, 47, 15.5, 55.2],
  ITA: [6, 35, 19, 48],
  JPN: [128, 30, 146, 46],
};

function focusFeature(
  [west, south, east, north]: [number, number, number, number],
): GeoJSON.Feature<GeoJSON.MultiPoint> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "MultiPoint",
      coordinates: [
        [west, south],
        [east, north],
      ],
    },
  };
}

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

function polygonBounds(polygon: GeoJSON.Position[][]) {
  const longitudes: number[] = [];
  const latitudes: number[] = [];
  polygon.forEach((ring) =>
    ring.forEach(([longitude, latitude]) => {
      longitudes.push(Number(longitude));
      latitudes.push(Number(latitude));
    }),
  );
  return {
    west: Math.min(...longitudes),
    south: Math.min(...latitudes),
    east: Math.max(...longitudes),
    north: Math.max(...latitudes),
  };
}

function applyBoundaryPolicy(features: WorldFeature[]) {
  const russia = features.find((item) => worldCode(item) === "RUS");
  const ukraine = features.find((item) => worldCode(item) === "UKR");
  if (
    russia?.geometry.type !== "MultiPolygon" ||
    ukraine?.geometry.type !== "MultiPolygon"
  ) {
    return features;
  }

  const crimeaPolygons = russia.geometry.coordinates.filter((polygon) => {
    const bounds = polygonBounds(polygon);
    return (
      bounds.west >= 31 &&
      bounds.east <= 37 &&
      bounds.south >= 44 &&
      bounds.north <= 47
    );
  });
  if (!crimeaPolygons.length) return features;

  russia.geometry.coordinates = russia.geometry.coordinates.filter(
    (polygon) => !crimeaPolygons.includes(polygon),
  );
  ukraine.geometry.coordinates = [
    ...ukraine.geometry.coordinates,
    ...crimeaPolygons,
  ];
  return features;
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

function fourColorGraph(adjacency: number[][]) {
  const colors = Array(adjacency.length).fill(-1) as number[];

  const chooseNode = () => {
    let chosen = -1;
    let bestSaturation = -1;
    let bestDegree = -1;
    for (let node = 0; node < adjacency.length; node += 1) {
      if (colors[node] !== -1) continue;
      const saturation = new Set(
        adjacency[node]
          .map((neighbor) => colors[neighbor])
          .filter((color) => color >= 0),
      ).size;
      if (
        saturation > bestSaturation ||
        (saturation === bestSaturation && adjacency[node].length > bestDegree)
      ) {
        chosen = node;
        bestSaturation = saturation;
        bestDegree = adjacency[node].length;
      }
    }
    return chosen;
  };

  const solve = (remaining: number): boolean => {
    if (!remaining) return true;
    const node = chooseNode();
    if (node < 0) return true;
    const blocked = new Set(adjacency[node].map((neighbor) => colors[neighbor]));
    for (let color = 0; color < 4; color += 1) {
      if (blocked.has(color)) continue;
      colors[node] = color;
      if (solve(remaining - 1)) return true;
      colors[node] = -1;
    }
    return false;
  };

  solve(adjacency.length);
  return colors.map((color, index) => (color < 0 ? index % 4 : color));
}

function geometryPoints(geometry: GeoJSON.Geometry) {
  const points: GeoJSON.Position[] = [];
  const collect = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (
      value.length >= 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number"
    ) {
      points.push(value as GeoJSON.Position);
      return;
    }
    value.forEach(collect);
  };
  if ("coordinates" in geometry) collect(geometry.coordinates);
  return points;
}

function featureAdjacency(features: AdminFeature[]) {
  const pointOwners = new Map<string, Set<number>>();
  features.forEach((item, featureIndex) => {
    const uniquePoints = new Set(
      geometryPoints(item.geometry).map(
        ([longitude, latitude]) =>
          `${Number(longitude).toFixed(5)},${Number(latitude).toFixed(5)}`,
      ),
    );
    uniquePoints.forEach((point) => {
      const owners = pointOwners.get(point) ?? new Set<number>();
      owners.add(featureIndex);
      pointOwners.set(point, owners);
    });
  });

  const sharedPointCounts = new Map<string, number>();
  pointOwners.forEach((ownerSet) => {
    const owners = Array.from(ownerSet);
    for (let left = 0; left < owners.length; left += 1) {
      for (let right = left + 1; right < owners.length; right += 1) {
        const key = `${owners[left]}:${owners[right]}`;
        sharedPointCounts.set(key, (sharedPointCounts.get(key) ?? 0) + 1);
      }
    }
  });

  const adjacency = features.map(() => new Set<number>());
  sharedPointCounts.forEach((sharedPoints, key) => {
    if (sharedPoints < 2) return;
    const [left, right] = key.split(":").map(Number);
    adjacency[left].add(right);
    adjacency[right].add(left);
  });
  return adjacency.map((neighborsForFeature) => Array.from(neighborsForFeature));
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
  const [worldColors, setWorldColors] = useState<number[]>([]);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [adminFeatures, setAdminFeatures] = useState<AdminFeature[]>([]);
  const [hoveredFeature, setHoveredFeature] = useState<
    GeoJSON.Feature<GeoJSON.Geometry> | null
  >(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [adding, setAdding] = useState(false);
  const [scope, setScope] = useState("country");
  const [error, setError] = useState("");
  const dragRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const mapSvgRef = useRef<SVGSVGElement>(null);
  const lastWheelAtRef = useRef(Number.NEGATIVE_INFINITY);

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
        setWorldFeatures(
          applyBoundaryPolicy(collection.features as WorldFeature[]),
        );
        setWorldColors(
          fourColorGraph(neighbors(topology.objects.countries.geometries)),
        );
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

  useEffect(() => {
    const clearHoverOutsideMap = (event: PointerEvent) => {
      if (!mapSvgRef.current?.contains(event.target as Node)) {
        setHoveredFeature(null);
      }
    };
    window.addEventListener("pointermove", clearHoverOutsideMap);
    return () => window.removeEventListener("pointermove", clearHoverOutsideMap);
  }, []);

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

  const selectedWorldFeature = selectedCountry
    ? worldFeatures.find((item) => worldCode(item) === selectedCountry)
    : undefined;
  const selectedWorldIndex = selectedWorldFeature
    ? worldFeatures.indexOf(selectedWorldFeature)
    : -1;
  const selectedWorldColor =
    selectedWorldIndex >= 0
      ? (worldColors[selectedWorldIndex] ?? selectedWorldIndex % 4)
      : 0;

  const projection = useMemo(() => {
    let next: GeoProjection;
    if (selectedCountry && selectedWorldFeature) {
      const details: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: adminFeatures.length ? adminFeatures : [selectedWorldFeature],
      };
      const focusBounds = DETAIL_FOCUS_BOUNDS[selectedCountry];
      next = geoMercator().fitExtent(
        [
          [34, 34],
          [966, 506],
        ],
        focusBounds ? focusFeature(focusBounds) : details,
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
  const adminColors = useMemo(
    () => fourColorGraph(featureAdjacency(adminFeatures)),
    [adminFeatures],
  );
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
    setHoveredFeature(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const clampPan = (next: { x: number; y: number }, nextZoom = zoom) => {
    const maxX = Math.max(0, 500 * (nextZoom - 1));
    const maxY = Math.max(0, 270 * (nextZoom - 1));
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  };

  const changeZoom = (direction: -1 | 1) => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoom as (typeof ZOOM_LEVELS)[number]);
    const nextIndex = Math.max(
      0,
      Math.min(ZOOM_LEVELS.length - 1, currentIndex + direction),
    );
    const nextZoom = ZOOM_LEVELS[nextIndex];
    setZoom(nextZoom);
    setPan((current) => clampPan(current, nextZoom));
  };

  const beginDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (zoom <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    };
    setDragging(true);
  };

  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    const start = dragRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const deltaX = ((event.clientX - start.clientX) * 1000) / rect.width;
    const deltaY = ((event.clientY - start.clientY) * 540) / rect.height;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) start.moved = true;
    setPan(clampPan({ x: start.panX + deltaX, y: start.panY + deltaY }));
  };

  const endDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    const start = dragRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    suppressClickRef.current = start.moved;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const wheelZoom = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    if (event.timeStamp - lastWheelAtRef.current < 160) return;
    lastWheelAtRef.current = event.timeStamp;
    changeZoom(event.deltaY < 0 ? 1 : -1);
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
    <section
      className="travel-map-card"
      aria-label={l.title}
      data-map-release="map-framing-v3"
    >
      <div className="travel-map-head">
        <div>
          <p className="eyebrow">{l.eyebrow}</p>
          <h2>{selectedCountry ? countryName(selectedCountry, locale) : l.title}</h2>
          <p>{l.subtitle}</p>
        </div>
      </div>

      <div className={`travel-map-canvas ${dragging ? "is-dragging" : ""}`}>
        {selectedCountry ? (
          <button type="button" onClick={reset} className="map-world-button">
            ← {l.world}
          </button>
        ) : null}
        {worldFeatures.length ? (
          <svg
            ref={mapSvgRef}
            viewBox="0 0 1000 540"
            role="img"
            aria-label={l.title}
            onPointerDown={beginDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={() => setHoveredFeature(null)}
            onWheel={wheelZoom}
          >
            <g transform={`translate(${pan.x} ${pan.y}) translate(500 270) scale(${zoom}) translate(-500 -270)`}>
              {selectedCountry && adminFeatures.length ? (
                <g className="map-admin-country-outline" aria-hidden="true">
                  {adminFeatures.map((item, index) => (
                    <path
                      key={`country-outline-${adminFeatureCode(item)}-${index}`}
                      d={path(item) || undefined}
                    />
                  ))}
                </g>
              ) : null}
              {!selectedCountry
                ? worldFeatures.map((item, index) => {
                    const code = worldCode(item);
                    const name = code ? countryName(code, locale) : item.properties?.name || "";
                    return (
                      <path
                        key={`${code || "feature"}-${index}`}
                        d={path(item) || undefined}
                        className={`map-country map-color-${worldColors[index] ?? index % 4} ${visitedCountries.has(code) ? "is-visited" : ""}`}
                        data-country-code={code}
                        aria-label={name}
                        role={code ? "button" : undefined}
                        tabIndex={code ? 0 : undefined}
                        onClick={() => {
                          if (!code || suppressClickRef.current) return;
                          setHoveredFeature(null);
                          setSelectedCountry(code);
                          setAdminFeatures([]);
                          setZoom(1);
                          setPan({ x: 0, y: 0 });
                        }}
                        onKeyDown={(event) => {
                          if ((event.key === "Enter" || event.key === " ") && code) {
                            setHoveredFeature(null);
                            setSelectedCountry(code);
                            setAdminFeatures([]);
                            setZoom(1);
                            setPan({ x: 0, y: 0 });
                          }
                        }}
                        onPointerMove={() => setHoveredFeature(item)}
                        onPointerLeave={() => setHoveredFeature(null)}
                        onFocus={() => setHoveredFeature(item)}
                        onBlur={() => setHoveredFeature(null)}
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
                          className={`map-country map-admin map-color-${adminColors[index] ?? index % 4} ${isVisited ? "is-visited" : ""}`}
                          data-admin-code={code}
                          aria-label={name}
                          onPointerMove={() => setHoveredFeature(item)}
                          onPointerLeave={() => setHoveredFeature(null)}
                        >
                          <title>{name}</title>
                        </path>
                      );
                    })
                  : selectedWorldFeature
                    ? (
                        <path
                          d={path(selectedWorldFeature) || undefined}
                          className={`map-country map-color-${selectedWorldColor} ${visitedCountries.has(selectedCountry) ? "is-visited" : ""}`}
                          onPointerMove={() => setHoveredFeature(selectedWorldFeature)}
                          onPointerLeave={() => setHoveredFeature(null)}
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
              {selectedWorldFeature && !adminFeatures.length ? (
                <path
                  key="selected-outline"
                  d={path(selectedWorldFeature) || undefined}
                  className="map-selected-outline"
                  aria-hidden="true"
                />
              ) : null}
              {hoveredFeature ? (
                <path
                  key="hover-outline"
                  d={path(hoveredFeature) || undefined}
                  className="map-hover-outline"
                  aria-hidden="true"
                />
              ) : null}
            </g>
          </svg>
        ) : (
          <div className="map-loading" aria-hidden="true" />
        )}
        <div className="map-zoom-control" role="group" aria-label={l.reset}>
          <button
            type="button"
            onClick={() => changeZoom(1)}
            aria-label={l.zoomIn}
            title={l.zoomIn}
            disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => changeZoom(-1)}
            aria-label={l.zoomOut}
            title={l.zoomOut}
            disabled={zoom <= 1}
          >
            −
          </button>
        </div>
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

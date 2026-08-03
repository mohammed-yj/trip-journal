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
import {
  geoMercator,
  geoNaturalEarth1,
  geoPath,
  type GeoProjection,
} from "d3-geo";
import { feature, neighbors } from "topojson-client";
import type { Locale } from "./i18n";
import LocationPicker from "./LocationPicker";
import {
  adminFeatureSourceName,
  adminFeatureCode,
  adminFeatureName,
  countryName,
  DETAILED_COUNTRIES,
  detailTerritoryCodes,
  loadAdminFeatures,
  normalizeAdminName,
  resolveCountryCode,
  worldFeatureCode,
  worldFeatureName,
  type AdminFeature,
} from "./map-data";
import {
  admin1Aliases,
  localizedAdmin1Name,
  resolveAdmin1Code,
} from "./admin1-locales";
import {
  canonicalMarkKey,
  deriveMapState,
  parseLatitude,
  parseLongitude,
  type MapRow,
} from "./map-logic";
import {
  adminOuterBoundary,
  type PolygonFeature,
} from "./map-geometry";

type Row = MapRow;

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

const DETAIL_HOME_SIZE = [836, 424] as const;

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

function clampPanForZoom(
  next: { x: number; y: number },
  nextZoom: number,
) {
  const maxX = Math.max(0, 500 * (nextZoom - 1));
  const maxY = Math.max(0, 270 * (nextZoom - 1));
  return {
    x: Math.max(-maxX, Math.min(maxX, next.x)),
    y: Math.max(-maxY, Math.min(maxY, next.y)),
  };
}

function detailHomeCamera(
  path: ReturnType<typeof geoPath>,
  bounds: [number, number, number, number],
) {
  const [[left, top], [right, bottom]] = path.bounds(focusFeature(bounds));
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const desiredZoom = Math.min(
    DETAIL_HOME_SIZE[0] / width,
    DETAIL_HOME_SIZE[1] / height,
  );
  const zoom =
    ZOOM_LEVELS.find((level) => level >= Math.max(1, desiredZoom)) ||
    ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  return {
    zoom,
    pan: clampPanForZoom(
      { x: -zoom * (centerX - 500), y: -zoom * (centerY - 270) },
      zoom,
    ),
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
    jump: "快速定位国家/地区…",
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
    jump: "Find a country or territory…",
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
    jump: "Trouver un pays ou territoire…",
  },
} as const;

function worldCode(featureItem: WorldFeature) {
  return worldFeatureCode(featureItem.id, featureItem.properties?.name);
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
    countryCode: string;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const mapSvgRef = useRef<SVGSVGElement>(null);
  const lastWheelAtRef = useRef(Number.NEGATIVE_INFINITY);
  const detailHomeRef = useRef("");

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

  const mapState = useMemo(
    () =>
      deriveMapState({
        mapMarks,
        venues,
        visits,
        trips,
        resolveCountryCode,
        resolveAdmin1Code,
      }),
    [mapMarks, venues, visits, trips],
  );
  const {
    visitedCountries,
    visitedAdminKeys,
    pins,
    regionCount,
  } = mapState;

  const selectedWorldFeature = selectedCountry
    ? worldFeatures.find((item) => worldCode(item) === selectedCountry)
    : undefined;
  const detailTerritoryFeatures = useMemo(() => {
    if (!selectedCountry) return [];
    const territoryCodes = new Set(detailTerritoryCodes(selectedCountry));
    return worldFeatures.filter((item) => territoryCodes.has(worldCode(item)));
  }, [selectedCountry, worldFeatures]);
  const detailProjectionFeatures = useMemo(
    () =>
      selectedWorldFeature
        ? [selectedWorldFeature, ...detailTerritoryFeatures]
        : [],
    [selectedWorldFeature, detailTerritoryFeatures],
  );
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
        features: detailProjectionFeatures,
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
  }, [worldFeatures, selectedCountry, selectedWorldFeature, detailProjectionFeatures]);

  const path = useMemo(() => geoPath(projection), [projection]);
  const initialDetailCamera = useMemo(() => {
    const focusBounds = DETAIL_FOCUS_BOUNDS[selectedCountry];
    return selectedCountry && adminFeatures.length && focusBounds
      ? detailHomeCamera(path, focusBounds)
      : null;
  }, [selectedCountry, adminFeatures.length, path]);
  const countryJumpOptions = useMemo(
    () => {
      const options = new Map<string, { code: string; name: string }>();
      worldFeatures.forEach((item) => {
          const code = worldCode(item);
          if (!code || options.has(code)) return;
          options.set(code, {
            code,
            name: worldFeatureName(code, item.properties?.name, locale),
          });
        });
      return Array.from(options.values()).sort((left, right) =>
        left.name.localeCompare(right.name, locale),
      );
    },
    [worldFeatures, locale],
  );

  useEffect(() => {
    detailHomeRef.current = "";
  }, [selectedCountry]);

  useEffect(() => {
    if (!selectedCountry || !initialDetailCamera) return;
    if (detailHomeRef.current === selectedCountry) return;
    detailHomeRef.current = selectedCountry;
    setZoom(initialDetailCamera.zoom);
    setPan(initialDetailCamera.pan);
  }, [selectedCountry, initialDetailCamera]);
  const adminColors = useMemo(
    () => fourColorGraph(featureAdjacency(adminFeatures)),
    [adminFeatures],
  );
  const selectedAdminBoundary = useMemo(
    () => adminOuterBoundary(adminFeatures as PolygonFeature[]),
    [adminFeatures],
  );
  const visiblePins = pins.filter(
    (pin) => !selectedCountry || pin.country_code === selectedCountry,
  );
  const manualMarks = mapMarks.filter((mark) => mark.source_type === "manual");

  const reset = () => {
    detailHomeRef.current = "";
    setSelectedCountry("");
    setAdminFeatures([]);
    setHoveredFeature(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const clampPan = (next: { x: number; y: number }, nextZoom = zoom) => {
    return clampPanForZoom(next, nextZoom);
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

  const selectCountry = (code: string) => {
    if (!code) return;
    detailHomeRef.current = "";
    setHoveredFeature(null);
    setSelectedCountry(code);
    setAdminFeatures([]);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const beginDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (zoom <= 1) return;
    const target = event.target as Element;
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
      countryCode:
        target.closest<SVGPathElement>("[data-country-code]")?.dataset
          .countryCode || "",
    };
  };

  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    const start = dragRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const clientDeltaX = event.clientX - start.clientX;
    const clientDeltaY = event.clientY - start.clientY;
    if (!start.moved) {
      if (Math.hypot(clientDeltaX, clientDeltaY) < 5) return;
      start.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const deltaX = (clientDeltaX * 1000) / rect.width;
    const deltaY = (clientDeltaY * 540) / rect.height;
    setPan(clampPan({ x: start.panX + deltaX, y: start.panY + deltaY }));
  };

  const endDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    const start = dragRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    suppressClickRef.current = start.moved || Boolean(start.countryCode);
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!start.moved && start.countryCode) selectCountry(start.countryCode);
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
        parseLatitude(payload.latitude) === null ||
        parseLongitude(payload.longitude) === null)
    ) {
      setError(l.invalidCity);
      return;
    }
    try {
      await onAddMark(payload);
      setAdding(false);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : l.invalidCity,
      );
    }
  };

  return (
    <section
      className="travel-map-card"
      aria-label={l.title}
      data-map-release="map-final-v5"
    >
      <div className="travel-map-head">
        <div>
          <p className="eyebrow">{l.eyebrow}</p>
          <h2>{selectedCountry ? countryName(selectedCountry, locale) : l.title}</h2>
          <p>{l.subtitle}</p>
        </div>
        {!selectedCountry ? (
          <label className="map-country-jump">
            <span className="sr-only">{l.jump}</span>
            <select
              value=""
              onChange={(event) => selectCountry(event.target.value)}
              aria-label={l.jump}
            >
              <option value="">{l.jump}</option>
              {countryJumpOptions.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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
              {!selectedCountry
                ? worldFeatures.map((item, index) => {
                    const code = worldCode(item);
                    const name = worldFeatureName(
                      code,
                      item.properties?.name,
                      locale,
                    );
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
                          selectCountry(code);
                        }}
                        onKeyDown={(event) => {
                          if ((event.key === "Enter" || event.key === " ") && code) {
                            selectCountry(code);
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
                : null}
              {selectedCountry && selectedWorldFeature ? (
                <>
                  <path
                    d={path(selectedWorldFeature) || undefined}
                    className={`map-country map-territory map-color-${selectedWorldColor} ${visitedCountries.has(selectedCountry) ? "is-visited" : ""}`}
                    onPointerMove={() => setHoveredFeature(selectedWorldFeature)}
                    onPointerLeave={() => setHoveredFeature(null)}
                  >
                    <title>{countryName(selectedCountry, locale)}</title>
                  </path>
                  {detailTerritoryFeatures.map((item, index) => {
                    const code = worldCode(item);
                    return (
                      <path
                        key={`territory-${code}-${index}`}
                        d={path(item) || undefined}
                        className={`map-country map-territory map-color-${(selectedWorldColor + index + 1) % 4} ${visitedCountries.has(selectedCountry) || visitedCountries.has(code) ? "is-visited" : ""}`}
                        data-country-code={code}
                        aria-label={worldFeatureName(code, item.properties?.name, locale)}
                        onPointerMove={() => setHoveredFeature(item)}
                        onPointerLeave={() => setHoveredFeature(null)}
                      >
                        <title>{worldFeatureName(code, item.properties?.name, locale)}</title>
                      </path>
                    );
                  })}
                </>
              ) : null}
              {selectedCountry && adminFeatures.length
                  ? adminFeatures.map((item, index) => {
                      const code = adminFeatureCode(item);
                      const name = adminFeatureName(item, locale);
                      const nameAliases = [
                        adminFeatureSourceName(item),
                        ...admin1Aliases(code),
                      ];
                      const isVisited =
                        visitedAdminKeys.has(`${selectedCountry}:${code}`) ||
                        nameAliases.some((alias) =>
                          visitedAdminKeys.has(
                            `${selectedCountry}:name:${normalizeAdminName(alias)}`,
                          ),
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
                  : null}

              {visiblePins.map((pin, index) => {
                const point = projection([Number(pin.longitude), Number(pin.latitude)]);
                if (!point) return null;
                return (
                  <g className="map-pin" transform={`translate(${point[0]} ${point[1]})`} key={`${canonicalMarkKey({ ...pin, scope: "city" })}-${index}`}>
                    <circle r={7 / zoom} />
                    <circle className="map-pin-core" r={2.4 / zoom} />
                    <title>{pin.city_name}</title>
                  </g>
                );
              })}
              {selectedWorldFeature ? (
                <path
                  key="selected-outline"
                  d={path(selectedWorldFeature) || undefined}
                  className="map-selected-outline"
                  aria-hidden="true"
                />
              ) : null}
              {detailTerritoryFeatures.map((item, index) => (
                <path
                  key={`territory-outline-${worldCode(item)}-${index}`}
                  d={path(item) || undefined}
                  className="map-selected-outline"
                  aria-hidden="true"
                />
              ))}
              {selectedAdminBoundary ? (
                <path
                  key="admin-outer-outline"
                  d={path(selectedAdminBoundary) || undefined}
                  className="map-admin-outer-outline"
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
          {manualMarks.map((mark) => {
            const displayName =
              mark.city_name ||
              (mark.admin1_code || mark.admin1_name
                ? localizedAdmin1Name(
                    mark.country_code,
                    mark.admin1_code,
                    mark.admin1_name,
                    locale,
                  )
                : countryName(mark.country_code, locale));
            return (
              <span key={mark.id}>
                {displayName}
                <button
                  type="button"
                  onClick={() => onRemoveMark(mark.id)}
                  aria-label={`${l.remove} ${displayName}`}
                  title={l.remove}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
      <small className="map-source">{l.source}</small>
    </section>
  );
}

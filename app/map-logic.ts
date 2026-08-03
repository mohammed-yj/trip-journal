export type MapRow = Record<string, any>;

export function mapPart(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function normalizeAdminPart(value: unknown) {
  return mapPart(value).replace(
    /(province|prefecture|municipality|autonomousregion|specialadministrativeregion|oblast|krai|republic|region|state|大区|大區|省|市|自治区|自治區|特别行政区|特別行政區)$/u,
    "",
  );
}

export function parseMapCoordinate(
  value: unknown,
  minimum: number,
  maximum: number,
) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? number
    : null;
}

export const parseLatitude = (value: unknown) =>
  parseMapCoordinate(value, -90, 90);

export const parseLongitude = (value: unknown) =>
  parseMapCoordinate(value, -180, 180);

function nullableText(value: unknown) {
  const result = typeof value === "string" ? value.trim() : "";
  return result || null;
}

export function normalizeMapMarkInput(
  payload: MapRow,
  sourceType = "manual",
) {
  const countryCode = String(payload.country_code || "").trim().toUpperCase();
  if (!countryCode) {
    if (sourceType === "manual") throw new Error("请选择国家或地区");
    return null;
  }
  if (!/^[A-Z]{3}$/.test(countryCode)) {
    throw new Error("国家或地区代码无效");
  }

  const admin1Code = nullableText(payload.admin1_code);
  const admin1Name = nullableText(
    payload.admin1_name || payload.region_or_state,
  );
  const cityName = nullableText(payload.city_name || payload.city);
  const latitude = parseLatitude(payload.latitude);
  const longitude = parseLongitude(payload.longitude);
  const requestedScope = String(payload.scope || "").trim();
  let scope: "country" | "admin1" | "city" =
    requestedScope === "country" ||
    requestedScope === "admin1" ||
    requestedScope === "city"
      ? requestedScope
      : cityName && latitude !== null && longitude !== null
        ? "city"
        : admin1Code || admin1Name
          ? "admin1"
          : "country";

  // Manual input must never discard a more precise place merely because an
  // older client submitted the default country scope. Preserve the complete
  // country → ADM1 → city hierarchy whenever those fields are present.
  if (sourceType === "manual") {
    if (cityName) {
      if (latitude === null || longitude === null) {
        throw new Error(
          "请从城市列表中选择城市，经纬度会自动填写",
        );
      }
      scope = "city";
    } else if (admin1Code || admin1Name) {
      scope = "admin1";
    }
  }

  if (scope === "city" && (!cityName || latitude === null || longitude === null)) {
    if (sourceType === "manual") {
      throw new Error(
        "城市图钉需要有效的城市、纬度（-90 至 90）和经度（-180 至 180）",
      );
    }
    scope = admin1Code || admin1Name ? "admin1" : "country";
  }
  if (scope === "admin1" && !admin1Code && !admin1Name) {
    if (sourceType === "manual") throw new Error("请选择一级行政区");
    scope = "country";
  }

  return {
    scope,
    country_code: countryCode,
    admin1_code: scope === "country" ? null : admin1Code,
    admin1_name: scope === "country" ? null : admin1Name,
    city_name: scope === "city" ? cityName : null,
    latitude: scope === "city" ? latitude : null,
    longitude: scope === "city" ? longitude : null,
  };
}

function scopeOf(mark: MapRow) {
  return mark.scope === "admin1" || mark.scope === "city"
    ? mark.scope
    : "country";
}

export function canonicalMarkKey(mark: MapRow) {
  const scope = scopeOf(mark);
  const countryCode = String(mark.country_code || "").toUpperCase();
  const admin =
    scope === "country"
      ? ""
      : mark.admin1_code
        ? mapPart(mark.admin1_code)
        : normalizeAdminPart(mark.admin1_name || mark.region_or_state);
  const city = scope === "city" ? mapPart(mark.city_name || mark.city) : "";
  const latitude = scope === "city" ? parseLatitude(mark.latitude) : null;
  const longitude = scope === "city" ? parseLongitude(mark.longitude) : null;
  const coordinate =
    latitude === null || longitude === null
      ? ""
      : `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  return [scope, countryCode, admin, city, coordinate].join(":");
}

export function sourceAssociationKey(
  placeKey: string,
  sourceType: string,
  sourceId: string | null,
) {
  const source = sourceType === "manual" ? "manual" : mapPart(sourceId);
  return [sourceType, source, placeKey].join(":");
}

function isMarkActive(
  mark: MapRow,
  visitedVenueIds: Set<string>,
  completedTripIds: Set<string>,
) {
  return (
    mark.source_type === "manual" ||
    (mark.source_type === "venue" && visitedVenueIds.has(mark.source_id)) ||
    (mark.source_type === "trip" && completedTripIds.has(mark.source_id))
  );
}

export function activeUniqueMarks(
  mapMarks: MapRow[],
  visitedVenueIds: Set<string>,
  completedTripIds: Set<string>,
) {
  const priority: Record<string, number> = { manual: 0, venue: 1, trip: 2 };
  const candidates = mapMarks
    .filter((mark) => isMarkActive(mark, visitedVenueIds, completedTripIds))
    .sort(
      (left, right) =>
        (priority[left.source_type] ?? 9) -
        (priority[right.source_type] ?? 9),
    );
  const seen = new Set<string>();
  return candidates.filter((mark) => {
    const key = canonicalMarkKey(mark);
    if (!mark.country_code || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function usableCity(value: unknown) {
  const city = String(value ?? "").trim();
  if (!city) return "";
  const normalized = mapPart(city);
  if (
    normalized === "未填写" ||
    normalized === "notspecified" ||
    normalized === "nonrenseigne"
  ) {
    return "";
  }
  return city;
}

function cityPinKey(
  countryCode: string,
  city: string,
  latitude: number,
  longitude: number,
) {
  return [
    countryCode,
    mapPart(city),
    latitude.toFixed(5),
    longitude.toFixed(5),
  ].join(":");
}

type DeriveMapStateInput = {
  mapMarks: MapRow[];
  venues: MapRow[];
  visits: MapRow[];
  trips: MapRow[];
  resolveCountryCode: (value: unknown) => string;
  resolveAdmin1Code?: (countryCode: string, value: unknown) => string;
};

export function deriveMapState({
  mapMarks,
  venues,
  visits,
  trips,
  resolveCountryCode,
  resolveAdmin1Code,
}: DeriveMapStateInput) {
  const venueMap = new Map(venues.map((venue) => [venue.id, venue]));
  const visitedVenueIds = new Set(visits.map((visit) => visit.venue_id));
  const completedTripIds = new Set(
    trips.filter((trip) => trip.status === "已完成").map((trip) => trip.id),
  );
  const effectiveMarks = activeUniqueMarks(
    mapMarks,
    visitedVenueIds,
    completedTripIds,
  );
  const visitedVenues = Array.from(visitedVenueIds)
    .map((id) => venueMap.get(id))
    .filter(Boolean) as MapRow[];

  const visitedCountries = new Set<string>();
  const visitedAdminKeys = new Set<string>();
  const regionIdentities = new Set<string>();
  const venueSourceMarks = new Map<string, MapRow>();
  for (const mark of mapMarks) {
    if (
      mark.source_type === "venue" &&
      mark.source_id &&
      !venueSourceMarks.has(mark.source_id)
    ) {
      venueSourceMarks.set(mark.source_id, mark);
    }
  }

  for (const mark of effectiveMarks) {
    const countryCode = String(mark.country_code || "").toUpperCase();
    if (!countryCode) continue;
    visitedCountries.add(countryCode);
    if (mark.admin1_code) {
      visitedAdminKeys.add(`${countryCode}:${mark.admin1_code}`);
      regionIdentities.add(`${countryCode}:${mark.admin1_code}`);
    }
    if (mark.admin1_name) {
      const normalizedName = normalizeAdminPart(mark.admin1_name);
      visitedAdminKeys.add(`${countryCode}:name:${normalizedName}`);
      if (!mark.admin1_code) {
        regionIdentities.add(`${countryCode}:name:${normalizedName}`);
      }
    }
  }

  for (const venue of visitedVenues) {
    const countryCode = resolveCountryCode(
      venue.country_code || venue.country,
    );
    if (!countryCode) continue;
    visitedCountries.add(countryCode);
    if (venue.region_or_state) {
      const normalizedName = normalizeAdminPart(venue.region_or_state);
      const sourceMark = venueSourceMarks.get(venue.id);
      const canonicalAdminCode =
        sourceMark?.admin1_code ||
        resolveAdmin1Code?.(countryCode, venue.region_or_state) ||
        "";
      if (canonicalAdminCode) {
        visitedAdminKeys.add(`${countryCode}:${canonicalAdminCode}`);
      }
      visitedAdminKeys.add(`${countryCode}:name:${normalizedName}`);
      regionIdentities.add(
        canonicalAdminCode
          ? `${countryCode}:${canonicalAdminCode}`
          : `${countryCode}:name:${normalizedName}`,
      );
    }
  }

  const pinRows = new Map<string, MapRow>();
  for (const mark of effectiveMarks) {
    const city = usableCity(mark.city_name);
    const latitude = parseLatitude(mark.latitude);
    const longitude = parseLongitude(mark.longitude);
    if (!city || latitude === null || longitude === null) continue;
    const countryCode = String(mark.country_code || "").toUpperCase();
    pinRows.set(cityPinKey(countryCode, city, latitude, longitude), {
      ...mark,
      city_name: city,
      country_code: countryCode,
      latitude,
      longitude,
    });
  }

  for (const venue of visitedVenues) {
    const city = usableCity(venue.city);
    const latitude = parseLatitude(venue.latitude);
    const longitude = parseLongitude(venue.longitude);
    if (!city || latitude === null || longitude === null) continue;
    const countryCode = resolveCountryCode(
      venue.country_code || venue.country,
    );
    if (!countryCode) continue;
    const key = cityPinKey(countryCode, city, latitude, longitude);
    if (!pinRows.has(key)) {
      pinRows.set(key, {
        city_name: city,
        country_code: countryCode,
        latitude,
        longitude,
      });
    }
  }

  return {
    effectiveMarks,
    visitedVenues,
    visitedCountries,
    visitedAdminKeys,
    pins: Array.from(pinRows.values()),
    regionCount: regionIdentities.size,
  };
}

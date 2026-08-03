import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalMarkKey,
  deriveMapState,
  normalizeMapMarkInput,
  parseLatitude,
  parseLongitude,
  sourceAssociationKey,
} from "../app/map-logic.ts";

const resolveCountryCode = (value) =>
  ({ "United States": "USA", France: "FRA", 美国: "USA", 法国: "FRA" })[
    value
  ] || String(value || "");

const resolveAdmin1Code = (country, value) =>
  ({ "USA:California": "US-CA", "USA:加利福尼亚州": "US-CA" })[
    `${country}:${value}`
  ] || "";

const baseCity = {
  scope: "city",
  country_code: "USA",
  country_name: "United States",
  admin1_code: "US-CA",
  admin1_name: "California",
  city_name: "San Francisco",
  latitude: "37.7749",
  longitude: "-122.4194",
};

function derive(overrides = {}) {
  return deriveMapState({
    mapMarks: [],
    venues: [],
    visits: [],
    trips: [],
    resolveCountryCode,
    resolveAdmin1Code,
    ...overrides,
  });
}

test("validates coordinate input without turning empty values into zero", () => {
  for (const value of [null, undefined, "", " ", "abc"]) {
    assert.equal(parseLatitude(value), null);
    assert.equal(parseLongitude(value), null);
  }
  assert.equal(parseLatitude("0"), 0);
  assert.equal(parseLongitude(0), 0);
  assert.equal(parseLatitude(90), 90);
  assert.equal(parseLongitude(-180), -180);
  assert.equal(parseLatitude(90.01), null);
  assert.equal(parseLongitude(180.01), null);

  assert.throws(
    () => normalizeMapMarkInput({ ...baseCity, latitude: "91" }),
    /城市图钉需要有效/,
  );
  assert.throws(
    () => normalizeMapMarkInput({ ...baseCity, longitude: "" }),
    /城市图钉需要有效/,
  );
  assert.throws(
    () => normalizeMapMarkInput({ scope: "admin1", country_code: "USA" }),
    /请选择一级行政区/,
  );

  const automaticFallback = normalizeMapMarkInput(
    { ...baseCity, latitude: "", source: "venue" },
    "venue",
  );
  assert.equal(automaticFallback.scope, "admin1");
  assert.equal(automaticFallback.city_name, null);
});

test("keeps each source association independent while aggregating one place", () => {
  const placeKey = canonicalMarkKey(baseCity);
  assert.notEqual(
    sourceAssociationKey(placeKey, "trip", "planned"),
    sourceAssociationKey(placeKey, "trip", "completed"),
  );
  assert.notEqual(
    sourceAssociationKey(placeKey, "manual", null),
    sourceAssociationKey(placeKey, "venue", "venue-1"),
  );

  const mapMarks = [
    { ...baseCity, id: "p", source_type: "trip", source_id: "planned" },
    { ...baseCity, id: "c", source_type: "trip", source_id: "completed" },
  ];
  const state = derive({
    mapMarks,
    trips: [
      { id: "planned", status: "计划中" },
      { id: "completed", status: "已完成" },
    ],
  });
  assert.equal(state.effectiveMarks.length, 1);
  assert.equal(state.effectiveMarks[0].source_id, "completed");
  assert.deepEqual([...state.visitedCountries], ["USA"]);
  assert.equal(state.regionCount, 1);
  assert.equal(state.pins.length, 1);
});

test("manual, completed-trip, and visited-venue conflicts remain lit and dedupe pins", () => {
  const manual = {
    ...baseCity,
    id: "manual",
    source_type: "manual",
    source_id: null,
  };
  const trip = {
    ...baseCity,
    id: "trip-mark",
    source_type: "trip",
    source_id: "trip-1",
  };
  const venueMark = {
    ...baseCity,
    id: "venue-mark",
    source_type: "venue",
    source_id: "venue-1",
  };
  const venue = {
    id: "venue-1",
    country: "United States",
    region_or_state: "California",
    city: "San Francisco",
    latitude: "37.7749",
    longitude: "-122.4194",
  };

  const allSources = derive({
    mapMarks: [manual, trip, venueMark],
    venues: [venue],
    visits: [{ id: "visit-1", venue_id: "venue-1" }],
    trips: [{ id: "trip-1", status: "已完成" }],
  });
  assert.equal(allSources.effectiveMarks.length, 1);
  assert.equal(allSources.effectiveMarks[0].source_type, "manual");
  assert.equal(allSources.pins.length, 1);
  assert.equal(allSources.regionCount, 1);

  const afterManualRemoval = derive({
    mapMarks: [trip, venueMark],
    venues: [venue],
    visits: [{ id: "visit-1", venue_id: "venue-1" }],
    trips: [{ id: "trip-1", status: "已完成" }],
  });
  assert.equal(afterManualRemoval.effectiveMarks.length, 1);
  assert.equal(afterManualRemoval.visitedCountries.has("USA"), true);
  assert.equal(afterManualRemoval.pins.length, 1);
});

test("handles no-coordinate visits and same-named cities without false pins", () => {
  const withoutCoordinates = derive({
    venues: [
      {
        id: "venue-empty",
        country: "France",
        region_or_state: "Île-de-France",
        city: "未填写",
        latitude: null,
        longitude: "",
      },
    ],
    visits: [{ id: "visit-empty", venue_id: "venue-empty" }],
  });
  assert.equal(withoutCoordinates.visitedCountries.has("FRA"), true);
  assert.equal(withoutCoordinates.pins.length, 0);

  const sameNamedCities = derive({
    mapMarks: [
      {
        ...baseCity,
        id: "springfield-1",
        city_name: "Springfield",
        admin1_code: "US-IL",
        admin1_name: "Illinois",
        latitude: "39.7817",
        longitude: "-89.6501",
        source_type: "manual",
      },
      {
        ...baseCity,
        id: "springfield-2",
        city_name: "Springfield",
        admin1_code: "US-MA",
        admin1_name: "Massachusetts",
        latitude: "42.1015",
        longitude: "-72.5898",
        source_type: "manual",
      },
    ],
  });
  assert.equal(sameNamedCities.pins.length, 2);
  assert.equal(sameNamedCities.regionCount, 2);
});

test("locale-dependent labels do not change canonical visit identity", () => {
  const chinese = canonicalMarkKey({
    ...baseCity,
    admin1_name: "加利福尼亚州",
  });
  const french = canonicalMarkKey({
    ...baseCity,
    admin1_name: "Californie",
  });
  assert.equal(chinese, french);
});

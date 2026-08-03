import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { upsertMapMark } from "../db/map-marks.ts";

function d1MemoryDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE map_marks (
    id TEXT PRIMARY KEY NOT NULL,
    mark_key TEXT NOT NULL UNIQUE,
    scope TEXT NOT NULL,
    country_code TEXT NOT NULL,
    country_name TEXT NOT NULL,
    admin1_code TEXT,
    admin1_name TEXT,
    city_name TEXT,
    latitude TEXT,
    longitude TEXT,
    source_type TEXT NOT NULL,
    source_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`);
  return {
    sqlite,
    d1: {
      prepare(sql) {
        const statement = sqlite.prepare(sql);
        let values = [];
        return {
          bind(...nextValues) {
            values = nextValues;
            return this;
          },
          run() {
            return statement.run(...values);
          },
          first() {
            return statement.get(...values) || null;
          },
        };
      },
    },
  };
}

const paris = {
  scope: "city",
  country_code: "FRA",
  country_name: "France",
  admin1_code: "FR-IDF",
  admin1_name: "Île-de-France",
  city: "Paris",
  latitude: "48.8566",
  longitude: "2.3522",
};

test("persists independent provenance rows and idempotent manual records", async () => {
  const { sqlite, d1 } = d1MemoryDatabase();
  const plannedId = await upsertMapMark(d1, paris, "trip", "trip-planned");
  const completedId = await upsertMapMark(d1, paris, "trip", "trip-completed");
  const manualId = await upsertMapMark(d1, paris, "manual", null);
  assert.notEqual(plannedId, completedId);
  assert.notEqual(completedId, manualId);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM map_marks").get().count, 3);

  const repeatedManualId = await upsertMapMark(
    d1,
    { ...paris, country_name: "法国" },
    "manual",
    null,
  );
  assert.equal(repeatedManualId, manualId);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM map_marks").get().count, 3);
  assert.equal(
    sqlite.prepare("SELECT country_name FROM map_marks WHERE id = ?").get(manualId)
      .country_name,
    "法国",
  );

  sqlite
    .prepare("UPDATE map_marks SET deleted_at = 'deleted' WHERE id = ?")
    .run(manualId);
  assert.equal(await upsertMapMark(d1, paris, "manual", null), manualId);
  assert.equal(
    sqlite.prepare("SELECT deleted_at FROM map_marks WHERE id = ?").get(manualId)
      .deleted_at,
    null,
  );
});

test("updates a matching legacy mark without swallowing a new source", async () => {
  const { sqlite, d1 } = d1MemoryDatabase();
  sqlite
    .prepare(
      `INSERT INTO map_marks (
        id, mark_key, scope, country_code, country_name, admin1_code,
        admin1_name, city_name, latitude, longitude, source_type, source_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "legacy",
      "city:FRA:fridf:paris",
      "city",
      "FRA",
      "France",
      "FR-IDF",
      "Île-de-France",
      "Paris",
      "48.8",
      "2.3",
      "venue",
      "venue-old",
      "old",
      "old",
    );

  assert.equal(await upsertMapMark(d1, paris, "venue", "venue-old"), "legacy");
  const newVenueId = await upsertMapMark(d1, paris, "venue", "venue-new");
  assert.notEqual(newVenueId, "legacy");
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM map_marks").get().count, 2);
  assert.deepEqual(
    sqlite
      .prepare("SELECT source_id FROM map_marks ORDER BY source_id")
      .all()
      .map((row) => row.source_id),
    ["venue-new", "venue-old"],
  );
});

import {
  canonicalMarkKey,
  mapPart,
  normalizeMapMarkInput,
  sourceAssociationKey,
  type MapRow,
} from "../app/map-logic.ts";

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

export async function upsertMapMark(
  db: D1Database,
  payload: MapRow,
  sourceType = "manual",
  sourceId: string | null = null,
) {
  const normalizedMark = normalizeMapMarkInput(payload, sourceType);
  if (!normalizedMark) return "";
  const { scope, country_code: countryCode } = normalizedMark;
  const placeKey = canonicalMarkKey(normalizedMark);
  const legacyPlaceKey = [
    scope,
    countryCode,
    mapPart(payload.admin1_code || payload.admin1_name || payload.region_or_state),
    mapPart(payload.city_name || payload.city),
  ].join(":");
  const associationKey = sourceAssociationKey(placeKey, sourceType, sourceId);
  const timestamp = new Date().toISOString();
  const id = `map_${crypto.randomUUID()}`;

  const existing = await db
    .prepare(
      `SELECT id FROM map_marks
       WHERE source_type = ? AND COALESCE(source_id, '') = ?
         AND (mark_key = ? OR mark_key = ?)
       LIMIT 1`,
    )
    .bind(sourceType, sourceId || "", associationKey, legacyPlaceKey)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare(
        `UPDATE map_marks SET
          scope = ?, country_code = ?, country_name = ?, admin1_code = ?,
          admin1_name = ?, city_name = ?, latitude = ?, longitude = ?,
          deleted_at = NULL, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        scope,
        countryCode,
        text(payload.country_name || payload.country, countryCode),
        normalizedMark.admin1_code,
        normalizedMark.admin1_name,
        normalizedMark.city_name,
        normalizedMark.latitude,
        normalizedMark.longitude,
        timestamp,
        existing.id,
      )
      .run();
    return existing.id;
  }

  await db
    .prepare(
      `INSERT INTO map_marks (
        id, mark_key, scope, country_code, country_name, admin1_code, admin1_name,
        city_name, latitude, longitude, source_type, source_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(mark_key) DO UPDATE SET
        scope = excluded.scope,
        country_code = excluded.country_code,
        country_name = excluded.country_name,
        admin1_code = excluded.admin1_code,
        admin1_name = excluded.admin1_name,
        city_name = excluded.city_name,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        source_type = excluded.source_type,
        source_id = excluded.source_id,
        deleted_at = NULL, updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      associationKey,
      scope,
      countryCode,
      text(payload.country_name || payload.country, countryCode),
      normalizedMark.admin1_code,
      normalizedMark.admin1_name,
      normalizedMark.city_name,
      normalizedMark.latitude,
      normalizedMark.longitude,
      sourceType,
      sourceId,
      timestamp,
      timestamp,
    )
    .run();
  const row = await db
    .prepare("SELECT id FROM map_marks WHERE mark_key = ?")
    .bind(associationKey)
    .first<{ id: string }>();
  return row?.id || id;
}

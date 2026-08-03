import { env } from "cloudflare:workers";

export const SCHEMA_VERSION = "1.1.0";

type ArchiveEnv = {
  DB: D1Database;
  PHOTOS: R2Bucket;
};

export function getArchiveEnv(): ArchiveEnv {
  const bindings = env as unknown as Partial<ArchiveEnv>;
  if (!bindings.DB) {
    throw new Error("持久化数据库暂时不可用");
  }
  if (!bindings.PHOTOS) {
    throw new Error("照片对象存储暂时不可用");
  }
  return bindings as ArchiveEnv;
}

export function getArchiveDb(): D1Database {
  const bindings = env as unknown as Partial<ArchiveEnv>;
  if (!bindings.DB) {
    throw new Error("持久化数据库暂时不可用");
  }
  return bindings.DB;
}

export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS venues (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, original_name TEXT, venue_type TEXT NOT NULL,
    city TEXT NOT NULL, region_or_state TEXT, country TEXT NOT NULL, address TEXT,
    latitude TEXT, longitude TEXT, official_url TEXT, opening_notes TEXT, general_notes TEXT,
    personal_impression TEXT, cover_photo_id TEXT, is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS exhibitions (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, original_title TEXT, venue_id TEXT NOT NULL,
    exhibition_type TEXT NOT NULL, start_date TEXT, end_date TEXT, official_url TEXT,
    curator_or_organizer TEXT, description TEXT, catalogue_reference TEXT,
    personal_summary TEXT, cover_photo_id TEXT, status TEXT NOT NULL,
    verification_status TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, start_date TEXT, end_date TEXT, cities TEXT,
    status TEXT NOT NULL, planning_notes TEXT, places_to_visit TEXT, research_questions TEXT,
    final_summary TEXT, cover_photo_id TEXT, is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY, venue_id TEXT NOT NULL, visit_date TEXT NOT NULL,
    date_precision TEXT NOT NULL DEFAULT 'day', started_at TEXT, ended_at TEXT,
    duration_minutes INTEGER, trip_id TEXT, visit_status TEXT NOT NULL,
    one_sentence_summary TEXT, detailed_notes TEXT, highlights TEXT, disappointments TEXT,
    unresolved_questions TEXT, revisit_intention TEXT NOT NULL, practical_notes TEXT,
    cover_photo_id TEXT, is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS visit_exhibitions (
    visit_id TEXT NOT NULL, exhibition_id TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY (visit_id, exhibition_id)
  )`,
  `CREATE TABLE IF NOT EXISTS object_records (
    id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '未命名对象', original_title TEXT,
    object_type TEXT NOT NULL, creator TEXT, culture_or_dynasty TEXT, date_display TEXT,
    date_start INTEGER, date_end INTEGER, material TEXT, dimensions TEXT, provenance TEXT,
    excavation_location TEXT, owning_institution TEXT, current_venue_id TEXT,
    exhibition_id TEXT, gallery_or_room TEXT, case_number TEXT, cave_or_building_number TEXT,
    label_transcription TEXT, personal_observation TEXT, research_notes TEXT,
    source_links TEXT, verification_status TEXT NOT NULL, cover_photo_id TEXT,
    is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL, deleted_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS visit_objects (
    visit_id TEXT NOT NULL, object_id TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY (visit_id, object_id)
  )`,
  `CREATE TABLE IF NOT EXISTS photo_groups (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, visit_id TEXT, object_id TEXT,
    cover_photo_id TEXT, is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS photo_assets (
    id TEXT PRIMARY KEY, storage_key TEXT NOT NULL, original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL, file_size INTEGER NOT NULL, width INTEGER, height INTEGER,
    shot_at TEXT, latitude TEXT, longitude TEXT, caption TEXT, alt_text TEXT,
    photo_type TEXT NOT NULL, photo_group_id TEXT, is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS photo_links (
    photo_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
    created_at TEXT NOT NULL, PRIMARY KEY (photo_id, entity_type, entity_id)
  )`,
  `CREATE TABLE IF NOT EXISTS captures (
    id TEXT PRIMARY KEY, visit_id TEXT NOT NULL, capture_type TEXT NOT NULL,
    text_content TEXT, photo_asset_id TEXT, object_id TEXT, exhibition_id TEXT,
    photo_group_id TEXT, captured_at TEXT NOT NULL, processing_status TEXT NOT NULL,
    is_highlight INTEGER NOT NULL DEFAULT 0, is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, tag_type TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS tag_links (
    tag_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
    created_at TEXT NOT NULL, PRIMARY KEY (tag_id, entity_type, entity_id)
  )`,
  `CREATE TABLE IF NOT EXISTS trip_venues (
    trip_id TEXT NOT NULL, venue_id TEXT NOT NULL, planned_status TEXT NOT NULL,
    created_at TEXT NOT NULL, PRIMARY KEY (trip_id, venue_id)
  )`,
  `CREATE TABLE IF NOT EXISTS map_marks (
    id TEXT PRIMARY KEY, mark_key TEXT NOT NULL UNIQUE, scope TEXT NOT NULL,
    country_code TEXT NOT NULL, country_name TEXT NOT NULL, admin1_code TEXT,
    admin1_name TEXT, city_name TEXT, latitude TEXT, longitude TEXT,
    source_type TEXT NOT NULL DEFAULT 'manual', source_id TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS archive_meta (
    key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS venues_place_idx ON venues(country, city)",
  "CREATE INDEX IF NOT EXISTS exhibitions_venue_idx ON exhibitions(venue_id)",
  "CREATE INDEX IF NOT EXISTS visits_venue_date_idx ON visits(venue_id, visit_date)",
  "CREATE INDEX IF NOT EXISTS captures_visit_status_idx ON captures(visit_id, processing_status)",
  "CREATE INDEX IF NOT EXISTS photos_group_idx ON photo_assets(photo_group_id)",
  "CREATE INDEX IF NOT EXISTS photo_links_entity_idx ON photo_links(entity_type, entity_id)",
  "CREATE INDEX IF NOT EXISTS tag_links_entity_idx ON tag_links(entity_type, entity_id)",
  "CREATE INDEX IF NOT EXISTS map_marks_country_idx ON map_marks(country_code)",
  "CREATE INDEX IF NOT EXISTS map_marks_source_idx ON map_marks(source_type, source_id)",
] as const;

let initialized = false;

export async function ensureArchiveSchema(db = getArchiveDb()) {
  if (initialized) return;
  const statements = schemaStatements.map((statement) => db.prepare(statement));
  await db.batch(statements);
  await db
    .prepare(
      "INSERT OR REPLACE INTO archive_meta (key, value, updated_at) VALUES (?, ?, ?)",
    )
    .bind("schema_version", SCHEMA_VERSION, now())
    .run();
  initialized = true;
}

export function now() {
  return new Date().toISOString();
}

export function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function queryRows<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  ...values: unknown[]
) {
  const result = await db
    .prepare(sql)
    .bind(...values)
    .all<T>();
  return result.results ?? [];
}

export async function getSnapshot(db = getArchiveDb()) {
  await ensureArchiveSchema(db);
  const [
    venues,
    exhibitions,
    visits,
    visitExhibitions,
    objects,
    visitObjects,
    captures,
    photos,
    photoLinks,
    photoGroups,
    trips,
    tripVenues,
    tags,
    tagLinks,
    mapMarks,
    trashVenues,
    trashExhibitions,
    trashVisits,
    trashObjects,
    trashTrips,
    trashCaptures,
    trashPhotos,
    trashGroups,
  ] = await Promise.all([
    queryRows(db, "SELECT * FROM venues WHERE deleted_at IS NULL ORDER BY updated_at DESC"),
    queryRows(db, "SELECT * FROM exhibitions WHERE deleted_at IS NULL ORDER BY updated_at DESC"),
    queryRows(db, "SELECT * FROM visits WHERE deleted_at IS NULL ORDER BY visit_date DESC, created_at DESC"),
    queryRows(db, "SELECT * FROM visit_exhibitions ORDER BY created_at"),
    queryRows(db, "SELECT * FROM object_records WHERE deleted_at IS NULL ORDER BY updated_at DESC"),
    queryRows(db, "SELECT * FROM visit_objects ORDER BY created_at"),
    queryRows(db, "SELECT * FROM captures WHERE deleted_at IS NULL ORDER BY captured_at DESC"),
    queryRows(db, "SELECT * FROM photo_assets WHERE deleted_at IS NULL ORDER BY COALESCE(shot_at, created_at) DESC"),
    queryRows(db, "SELECT * FROM photo_links ORDER BY created_at"),
    queryRows(db, "SELECT * FROM photo_groups WHERE deleted_at IS NULL ORDER BY updated_at DESC"),
    queryRows(db, "SELECT * FROM trips WHERE deleted_at IS NULL ORDER BY updated_at DESC"),
    queryRows(db, "SELECT * FROM trip_venues ORDER BY created_at"),
    queryRows(db, "SELECT * FROM tags WHERE deleted_at IS NULL ORDER BY name"),
    queryRows(db, "SELECT * FROM tag_links ORDER BY created_at"),
    queryRows(db, "SELECT * FROM map_marks WHERE deleted_at IS NULL ORDER BY updated_at DESC"),
    queryRows(db, "SELECT *, 'venue' AS entity_type FROM venues WHERE deleted_at IS NOT NULL"),
    queryRows(db, "SELECT *, 'exhibition' AS entity_type FROM exhibitions WHERE deleted_at IS NOT NULL"),
    queryRows(db, "SELECT *, 'visit' AS entity_type FROM visits WHERE deleted_at IS NOT NULL"),
    queryRows(db, "SELECT *, 'object' AS entity_type FROM object_records WHERE deleted_at IS NOT NULL"),
    queryRows(db, "SELECT *, 'trip' AS entity_type FROM trips WHERE deleted_at IS NOT NULL"),
    queryRows(db, "SELECT *, 'capture' AS entity_type FROM captures WHERE deleted_at IS NOT NULL"),
    queryRows(db, "SELECT *, 'photo' AS entity_type FROM photo_assets WHERE deleted_at IS NOT NULL"),
    queryRows(db, "SELECT *, 'photo_group' AS entity_type FROM photo_groups WHERE deleted_at IS NOT NULL"),
  ]);

  return {
    schema_version: SCHEMA_VERSION,
    venues,
    exhibitions,
    visits,
    visit_exhibitions: visitExhibitions,
    objects,
    visit_objects: visitObjects,
    captures,
    photos,
    photo_links: photoLinks,
    photo_groups: photoGroups,
    trips,
    trip_venues: tripVenues,
    tags,
    tag_links: tagLinks,
    map_marks: mapMarks,
    trash: [
      ...trashVenues,
      ...trashExhibitions,
      ...trashVisits,
      ...trashObjects,
      ...trashTrips,
      ...trashCaptures,
      ...trashPhotos,
      ...trashGroups,
    ],
  };
}

export async function upsertTagLink(
  db: D1Database,
  tagName: string,
  entityType: string,
  entityId: string,
  tagType = "用户状态",
) {
  const timestamp = now();
  const existing = await db
    .prepare("SELECT id FROM tags WHERE name = ? AND deleted_at IS NULL")
    .bind(tagName.trim())
    .first<{ id: string }>();
  const tagId = existing?.id ?? uid("tag");
  if (!existing) {
    await db
      .prepare(
        "INSERT INTO tags (id, name, tag_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(tagId, tagName.trim(), tagType, timestamp, timestamp)
      .run();
  }
  await db
    .prepare(
      "INSERT OR IGNORE INTO tag_links (tag_id, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(tagId, entityType, entityId, timestamp)
    .run();
  return tagId;
}

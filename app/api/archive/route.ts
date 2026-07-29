import { NextResponse } from "next/server";
import {
  ensureArchiveSchema,
  getArchiveDb,
  getArchiveEnv,
  getSnapshot,
  now,
  SCHEMA_VERSION,
  uid,
  upsertTagLink,
} from "../../../db/archive";

type Payload = Record<string, any>;

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function nullable(value: unknown) {
  const result = text(value);
  return result || null;
}

function truthy(value: unknown) {
  return value === true || value === 1 || value === "1";
}

async function createVenue(db: D1Database, payload: Payload, isDemo = 0) {
  const timestamp = now();
  const id = text(payload.id) || uid("ven");
  await db
    .prepare(
      `INSERT INTO venues (
        id, name, original_name, venue_type, city, region_or_state, country, address,
        official_url, opening_notes, general_notes, personal_impression, is_demo,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      text(payload.name, "未命名地点"),
      nullable(payload.original_name),
      text(payload.venue_type, "博物馆"),
      text(payload.city, "未填写"),
      nullable(payload.region_or_state),
      text(payload.country, "中国"),
      nullable(payload.address),
      nullable(payload.official_url),
      nullable(payload.opening_notes),
      nullable(payload.general_notes),
      nullable(payload.personal_impression),
      isDemo,
      timestamp,
      timestamp,
    )
    .run();
  return id;
}

async function createExhibition(
  db: D1Database,
  payload: Payload,
  isDemo = 0,
) {
  const timestamp = now();
  const id = text(payload.id) || uid("exh");
  await db
    .prepare(
      `INSERT INTO exhibitions (
        id, title, original_title, venue_id, exhibition_type, start_date, end_date,
        official_url, curator_or_organizer, description, catalogue_reference,
        personal_summary, status, verification_status, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      text(payload.title, "未命名展览"),
      nullable(payload.original_title),
      text(payload.venue_id),
      text(payload.exhibition_type, "临时展"),
      nullable(payload.start_date),
      nullable(payload.end_date),
      nullable(payload.official_url),
      nullable(payload.curator_or_organizer),
      nullable(payload.description),
      nullable(payload.catalogue_reference),
      nullable(payload.personal_summary),
      text(payload.status, "计划参观"),
      text(payload.verification_status, "用户输入"),
      isDemo,
      timestamp,
      timestamp,
    )
    .run();
  return id;
}

async function startVisit(
  db: D1Database,
  payload: Payload,
  isDemo = 0,
) {
  const timestamp = now();
  const id = text(payload.id) || uid("vis");
  const startedAt = nullable(payload.started_at) ?? timestamp;
  const visitDate =
    text(payload.visit_date) || new Date(startedAt).toISOString().slice(0, 10);
  await db
    .prepare(
      `INSERT INTO visits (
        id, venue_id, visit_date, date_precision, started_at, ended_at,
        duration_minutes, trip_id, visit_status, one_sentence_summary,
        detailed_notes, highlights, unresolved_questions, revisit_intention,
        practical_notes, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      text(payload.venue_id),
      visitDate,
      text(payload.date_precision, "day"),
      startedAt,
      nullable(payload.ended_at),
      payload.duration_minutes ?? null,
      nullable(payload.trip_id),
      text(payload.visit_status, "进行中"),
      nullable(payload.one_sentence_summary),
      nullable(payload.detailed_notes),
      nullable(payload.highlights),
      nullable(payload.unresolved_questions),
      text(payload.revisit_intention, "可能"),
      nullable(payload.practical_notes),
      isDemo,
      timestamp,
      timestamp,
    )
    .run();

  const exhibitionIds = Array.isArray(payload.exhibition_ids)
    ? payload.exhibition_ids.filter(Boolean)
    : [];
  if (exhibitionIds.length) {
    await db.batch(
      exhibitionIds.map((exhibitionId: string) =>
        db
          .prepare(
            "INSERT OR IGNORE INTO visit_exhibitions (visit_id, exhibition_id, created_at) VALUES (?, ?, ?)",
          )
          .bind(id, exhibitionId, timestamp),
      ),
    );
  }
  return id;
}

async function createObjectRecord(
  db: D1Database,
  payload: Payload,
  isDemo = 0,
) {
  const timestamp = now();
  const id = text(payload.id) || uid("obj");
  await db
    .prepare(
      `INSERT INTO object_records (
        id, title, original_title, object_type, creator, culture_or_dynasty,
        date_display, date_start, date_end, material, dimensions, provenance,
        excavation_location, owning_institution, current_venue_id, exhibition_id,
        gallery_or_room, case_number, cave_or_building_number, label_transcription,
        personal_observation, research_notes, source_links, verification_status,
        cover_photo_id, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      text(payload.title, "未命名对象"),
      nullable(payload.original_title),
      text(payload.object_type, "其他"),
      nullable(payload.creator),
      nullable(payload.culture_or_dynasty),
      nullable(payload.date_display),
      payload.date_start ?? null,
      payload.date_end ?? null,
      nullable(payload.material),
      nullable(payload.dimensions),
      nullable(payload.provenance),
      nullable(payload.excavation_location),
      nullable(payload.owning_institution),
      nullable(payload.current_venue_id),
      nullable(payload.exhibition_id),
      nullable(payload.gallery_or_room),
      nullable(payload.case_number),
      nullable(payload.cave_or_building_number),
      nullable(payload.label_transcription),
      nullable(payload.personal_observation),
      nullable(payload.research_notes),
      nullable(payload.source_links),
      text(payload.verification_status, "用户输入"),
      nullable(payload.cover_photo_id),
      isDemo,
      timestamp,
      timestamp,
    )
    .run();
  if (payload.visit_id) {
    await db
      .prepare(
        "INSERT OR IGNORE INTO visit_objects (visit_id, object_id, created_at) VALUES (?, ?, ?)",
      )
      .bind(payload.visit_id, id, timestamp)
      .run();
  }
  if (payload.photo_group_id) {
    await db
      .prepare(
        "UPDATE photo_groups SET object_id = ?, updated_at = ? WHERE id = ?",
      )
      .bind(id, timestamp, payload.photo_group_id)
      .run();
    const group = await db
      .prepare("SELECT cover_photo_id FROM photo_groups WHERE id = ?")
      .bind(payload.photo_group_id)
      .first<{ cover_photo_id: string | null }>();
    await db
      .prepare(
        "UPDATE object_records SET cover_photo_id = ?, updated_at = ? WHERE id = ?",
      )
      .bind(group?.cover_photo_id ?? null, timestamp, id)
      .run();
    await db
      .prepare(
        "UPDATE captures SET object_id = ?, processing_status = '已整理', updated_at = ? WHERE photo_group_id = ?",
      )
      .bind(id, timestamp, payload.photo_group_id)
      .run();
  }
  return id;
}

async function seedDemo() {
  const { DB: db, PHOTOS: bucket } = getArchiveEnv();
  const existing = await db
    .prepare("SELECT id FROM venues WHERE is_demo = 1 LIMIT 1")
    .first();
  if (existing) return;

  const venueId = await createVenue(
    db,
    {
      name: "示例 · 晋祠博物馆",
      original_name: "Jinci Museum",
      venue_type: "古建筑",
      city: "太原",
      region_or_state: "山西",
      country: "中国",
      general_notes: "这是独立的演示记录，可在设置中一键删除。",
    },
    1,
  );
  const exhibitionId = await createExhibition(
    db,
    {
      title: "示例 · 圣母殿与宋代彩塑",
      venue_id: venueId,
      exhibition_type: "遗址或古建中的固定展示",
      status: "已经参观",
      verification_status: "已核实",
    },
    1,
  );
  const visitId = await startVisit(
    db,
    {
      venue_id: venueId,
      visit_date: "2026-05-18",
      started_at: "2026-05-18T09:20:00.000Z",
      ended_at: "2026-05-18T11:35:00.000Z",
      duration_minutes: 135,
      visit_status: "待整理",
      exhibition_ids: [exhibitionId],
      one_sentence_summary: "殿内光线让彩塑的衣褶与神情不断变化。",
      highlights: "侍女像；木构；献殿",
      unresolved_questions: "彩塑后世重妆具体发生在何时？",
    },
    1,
  );
  const groupId = uid("grp");
  const stamp = now();
  await db
    .prepare(
      "INSERT INTO photo_groups (id, name, visit_id, is_demo, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
    )
    .bind(groupId, "示例 · 圣母殿侍女像", visitId, stamp, stamp)
    .run();

  const png = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    ),
    (character) => character.charCodeAt(0),
  );
  const photoTypes = ["object_main", "object_detail", "label"];
  const photoIds: string[] = [];
  for (let index = 0; index < photoTypes.length; index += 1) {
    const photoId = uid("pho");
    const storageKey = `demo/${photoId}.png`;
    photoIds.push(photoId);
    await bucket.put(storageKey, png, {
      httpMetadata: { contentType: "image/png" },
      customMetadata: { demo: "true" },
    });
    await db
      .prepare(
        `INSERT INTO photo_assets (
          id, storage_key, original_filename, mime_type, file_size, photo_type,
          photo_group_id, is_demo, created_at, updated_at
        ) VALUES (?, ?, ?, 'image/png', ?, ?, ?, 1, ?, ?)`,
      )
      .bind(
        photoId,
        storageKey,
        `demo-${index + 1}.png`,
        png.byteLength,
        photoTypes[index],
        groupId,
        stamp,
        stamp,
      )
      .run();
    await db
      .prepare(
        "INSERT INTO photo_links (photo_id, entity_type, entity_id, created_at) VALUES (?, 'visit', ?, ?)",
      )
      .bind(photoId, visitId, stamp)
      .run();
    const captureId = uid("cap");
    await db
      .prepare(
        `INSERT INTO captures (
          id, visit_id, capture_type, text_content, photo_asset_id, exhibition_id,
          photo_group_id, captured_at, processing_status, is_demo, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(
        captureId,
        visitId,
        photoTypes[index] === "label" ? "铭牌照片" : "作品照片",
        index === 2 ? "铭牌文字待补录" : null,
        photoId,
        exhibitionId,
        groupId,
        stamp,
        index === 0 ? "已整理" : "未整理",
        stamp,
        stamp,
      )
      .run();
  }
  await db
    .prepare(
      "UPDATE photo_groups SET cover_photo_id = ?, updated_at = ? WHERE id = ?",
    )
    .bind(photoIds[0], stamp, groupId)
    .run();

  const objectOne = await createObjectRecord(
    db,
    {
      title: "示例 · 侍女像",
      object_type: "彩塑",
      culture_or_dynasty: "北宋",
      material: "泥质彩塑",
      current_venue_id: venueId,
      exhibition_id: exhibitionId,
      visit_id: visitId,
      photo_group_id: groupId,
      personal_observation: "侧光下衣纹的转折比正面观看更清楚。",
      research_notes: "待查资料：重妆年代与修复记录。",
      verification_status: "现场铭牌",
      cover_photo_id: photoIds[0],
    },
    1,
  );
  await createObjectRecord(
    db,
    {
      title: "示例 · 圣母殿木构",
      object_type: "建筑",
      culture_or_dynasty: "北宋",
      material: "木",
      current_venue_id: venueId,
      exhibition_id: exhibitionId,
      visit_id: visitId,
      personal_observation: "前廊尺度与殿内观看节奏关系密切。",
      verification_status: "用户输入",
    },
    1,
  );
  await db
    .prepare(
      "UPDATE photo_groups SET object_id = ?, updated_at = ? WHERE id = ?",
    )
    .bind(objectOne, stamp, groupId)
    .run();

  const tripId = uid("tri");
  await db
    .prepare(
      `INSERT INTO trips (
        id, name, cities, status, planning_notes, places_to_visit, research_questions,
        is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .bind(
      tripId,
      "示例 · 2026 山西寺观、壁画与彩塑",
      "太原,大同,忻州",
      "计划中",
      "按开放时间和交通顺序安排，不求打卡数量。",
      "晋祠,云冈石窟,佛光寺",
      "不同地点的北魏与宋代造像如何处理观看距离？",
      stamp,
      stamp,
    )
    .run();
  await upsertTagLink(db, "待查资料", "object", objectOne);
  await upsertTagLink(db, "想再看", "visit", visitId);
}

async function clearDemo() {
  const { DB: db, PHOTOS: bucket } = getArchiveEnv();
  const photoRows = await db
    .prepare("SELECT id, storage_key FROM photo_assets WHERE is_demo = 1")
    .all<{ id: string; storage_key: string }>();
  for (const photo of photoRows.results ?? []) {
    await bucket.delete(photo.storage_key);
  }
  const demoPhotoIds = (photoRows.results ?? []).map((row) => row.id);
  const tables = [
    "captures",
    "photo_groups",
    "photo_assets",
    "object_records",
    "visits",
    "exhibitions",
    "trips",
    "venues",
  ];
  if (demoPhotoIds.length) {
    const placeholders = demoPhotoIds.map(() => "?").join(",");
    await db
      .prepare(`DELETE FROM photo_links WHERE photo_id IN (${placeholders})`)
      .bind(...demoPhotoIds)
      .run();
  }
  await db
    .prepare(
      "DELETE FROM visit_objects WHERE object_id IN (SELECT id FROM object_records WHERE is_demo = 1)",
    )
    .run();
  await db
    .prepare(
      "DELETE FROM visit_exhibitions WHERE visit_id IN (SELECT id FROM visits WHERE is_demo = 1)",
    )
    .run();
  await db
    .prepare(
      "DELETE FROM tag_links WHERE entity_id IN (SELECT id FROM object_records WHERE is_demo = 1) OR entity_id IN (SELECT id FROM visits WHERE is_demo = 1)",
    )
    .run();
  await db.batch(tables.map((table) => db.prepare(`DELETE FROM ${table} WHERE is_demo = 1`)));
}

async function restoreExport(db: D1Database, archive: Payload) {
  if (archive.schema_version !== SCHEMA_VERSION) {
    throw new Error(
      `版本不兼容：需要 ${SCHEMA_VERSION}，收到 ${archive.schema_version || "未知"}`,
    );
  }
  const tableMap: Record<string, string> = {
    venues: "venues",
    exhibitions: "exhibitions",
    visits: "visits",
    objects: "object_records",
    captures: "captures",
    photos: "photo_assets",
    photo_groups: "photo_groups",
    trips: "trips",
    tags: "tags",
    visit_exhibitions: "visit_exhibitions",
    visit_objects: "visit_objects",
    photo_links: "photo_links",
    trip_venues: "trip_venues",
    tag_links: "tag_links",
  };
  let inserted = 0;
  let skipped = 0;
  for (const [sourceKey, table] of Object.entries(tableMap)) {
    const rows = Array.isArray(archive[sourceKey]) ? archive[sourceKey] : [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const keys = Object.keys(row).filter((key) => /^[a-z_]+$/.test(key));
      if (!keys.length) continue;
      const statement = `INSERT OR IGNORE INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`;
      const result = await db
        .prepare(statement)
        .bind(...keys.map((key) => row[key]))
        .run();
      if ((result.meta?.changes ?? 0) > 0) inserted += 1;
      else skipped += 1;
    }
  }
  return { inserted, skipped };
}

export async function GET() {
  try {
    const db = getArchiveDb();
    await ensureArchiveSchema(db);
    return NextResponse.json(await getSnapshot(db));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取档案失败" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: string;
      payload?: Payload;
    };
    const action = text(body.action);
    const payload = body.payload ?? {};
    const db = getArchiveDb();
    await ensureArchiveSchema(db);
    let result: Record<string, unknown> = {};
    const timestamp = now();

    if (action === "createVenue") {
      result.id = await createVenue(db, payload);
    } else if (action === "createExhibition") {
      result.id = await createExhibition(db, payload);
    } else if (action === "startVisit") {
      result.id = await startVisit(db, payload);
    } else if (action === "endVisit") {
      const current = await db
        .prepare("SELECT started_at FROM visits WHERE id = ?")
        .bind(payload.id)
        .first<{ started_at: string | null }>();
      const endedAt = nullable(payload.ended_at) ?? timestamp;
      const duration = current?.started_at
        ? Math.max(
            0,
            Math.round(
              (new Date(endedAt).getTime() -
                new Date(current.started_at).getTime()) /
                60000,
            ),
          )
        : null;
      await db
        .prepare(
          `UPDATE visits SET ended_at = ?, duration_minutes = ?, visit_status = '待整理',
          one_sentence_summary = ?, highlights = ?, unresolved_questions = ?,
          revisit_intention = ?, updated_at = ? WHERE id = ?`,
        )
        .bind(
          endedAt,
          duration,
          nullable(payload.one_sentence_summary),
          nullable(payload.highlights),
          nullable(payload.unresolved_questions),
          text(payload.revisit_intention, "可能"),
          timestamp,
          payload.id,
        )
        .run();
      result.duration_minutes = duration;
    } else if (action === "createCapture") {
      const id = uid("cap");
      await db
        .prepare(
          `INSERT INTO captures (
            id, visit_id, capture_type, text_content, object_id, exhibition_id,
            captured_at, processing_status, is_highlight, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, '未整理', ?, ?, ?)`,
        )
        .bind(
          id,
          text(payload.visit_id),
          text(payload.capture_type, "文字速记"),
          nullable(payload.text_content),
          nullable(payload.object_id),
          nullable(payload.exhibition_id),
          nullable(payload.captured_at) ?? timestamp,
          truthy(payload.is_highlight) ? 1 : 0,
          timestamp,
          timestamp,
        )
        .run();
      result.id = id;
    } else if (action === "createObject") {
      result.id = await createObjectRecord(db, payload);
    } else if (action === "createPhotoGroup") {
      const photoIds = Array.isArray(payload.photo_ids)
        ? payload.photo_ids.filter(Boolean)
        : [];
      if (!photoIds.length) throw new Error("请至少选择一张照片");
      const groupId = uid("grp");
      const coverPhotoId = text(payload.cover_photo_id) || photoIds[0];
      await db
        .prepare(
          `INSERT INTO photo_groups (
            id, name, visit_id, object_id, cover_photo_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          groupId,
          text(payload.name, "未命名照片组"),
          nullable(payload.visit_id),
          nullable(payload.object_id),
          coverPhotoId,
          timestamp,
          timestamp,
        )
        .run();
      const statements = photoIds.flatMap((photoId: string) => [
        db
          .prepare(
            "UPDATE photo_assets SET photo_group_id = ?, updated_at = ? WHERE id = ?",
          )
          .bind(groupId, timestamp, photoId),
        db
          .prepare(
            "UPDATE captures SET photo_group_id = ?, updated_at = ? WHERE photo_asset_id = ?",
          )
          .bind(groupId, timestamp, photoId),
      ]);
      await db.batch(statements);
      result.id = groupId;
    } else if (action === "batchOrganize") {
      const captureIds = Array.isArray(payload.capture_ids)
        ? payload.capture_ids.filter(Boolean)
        : [];
      const photoIds = Array.isArray(payload.photo_ids)
        ? payload.photo_ids.filter(Boolean)
        : [];
      if (captureIds.length) {
        const placeholders = captureIds.map(() => "?").join(",");
        const updates: string[] = ["updated_at = ?"];
        const values: unknown[] = [timestamp];
        if (payload.visit_id) {
          updates.push("visit_id = ?");
          values.push(payload.visit_id);
        }
        if (payload.exhibition_id) {
          updates.push("exhibition_id = ?");
          values.push(payload.exhibition_id);
        }
        if (payload.object_id) {
          updates.push("object_id = ?");
          values.push(payload.object_id);
        }
        if (truthy(payload.mark_processed)) {
          updates.push("processing_status = '已整理'");
        }
        await db
          .prepare(
            `UPDATE captures SET ${updates.join(", ")} WHERE id IN (${placeholders})`,
          )
          .bind(...values, ...captureIds)
          .run();
      }
      if (payload.object_id && photoIds.length) {
        await db.batch(
          photoIds.map((photoId: string) =>
            db
              .prepare(
                "INSERT OR IGNORE INTO photo_links (photo_id, entity_type, entity_id, created_at) VALUES (?, 'object', ?, ?)",
              )
              .bind(photoId, payload.object_id, timestamp),
          ),
        );
      }
      if (payload.visit_id && photoIds.length) {
        await db.batch(
          photoIds.flatMap((photoId: string) => [
            db
              .prepare(
                "DELETE FROM photo_links WHERE photo_id = ? AND entity_type = 'visit'",
              )
              .bind(photoId),
            db
              .prepare(
                "INSERT INTO photo_links (photo_id, entity_type, entity_id, created_at) VALUES (?, 'visit', ?, ?)",
              )
              .bind(photoId, payload.visit_id, timestamp),
          ]),
        );
      }
      if (payload.exhibition_id && photoIds.length) {
        await db.batch(
          photoIds.map((photoId: string) =>
            db
              .prepare(
                "INSERT OR IGNORE INTO photo_links (photo_id, entity_type, entity_id, created_at) VALUES (?, 'exhibition', ?, ?)",
              )
              .bind(photoId, payload.exhibition_id, timestamp),
          ),
        );
      }
      if (payload.tag_name && captureIds.length) {
        for (const captureId of captureIds) {
          await upsertTagLink(
            db,
            text(payload.tag_name),
            "capture",
            captureId,
          );
        }
      }
    } else if (action === "updatePhoto") {
      await db
        .prepare(
          "UPDATE photo_assets SET photo_type = ?, caption = ?, alt_text = ?, updated_at = ? WHERE id = ?",
        )
        .bind(
          text(payload.photo_type, "other"),
          nullable(payload.caption),
          nullable(payload.alt_text),
          timestamp,
          payload.id,
        )
        .run();
    } else if (action === "linkPhotoObject") {
      await db
        .prepare(
          "INSERT OR IGNORE INTO photo_links (photo_id, entity_type, entity_id, created_at) VALUES (?, 'object', ?, ?)",
        )
        .bind(payload.photo_id, payload.object_id, timestamp)
        .run();
      await db
        .prepare(
          "UPDATE captures SET object_id = ?, updated_at = ? WHERE photo_asset_id = ?",
        )
        .bind(payload.object_id, timestamp, payload.photo_id)
        .run();
    } else if (action === "splitPhotoGroup") {
      const photoIds = Array.isArray(payload.photo_ids)
        ? payload.photo_ids.filter(Boolean)
        : [];
      if (!payload.group_id || !photoIds.length) {
        throw new Error("请选择要移出照片组的照片");
      }
      const placeholders = photoIds.map(() => "?").join(",");
      await db
        .prepare(
          `UPDATE photo_assets SET photo_group_id = NULL, updated_at = ?
           WHERE photo_group_id = ? AND id IN (${placeholders})`,
        )
        .bind(timestamp, payload.group_id, ...photoIds)
        .run();
      await db
        .prepare(
          `UPDATE captures SET photo_group_id = NULL, processing_status = '未整理', updated_at = ?
           WHERE photo_group_id = ? AND photo_asset_id IN (${placeholders})`,
        )
        .bind(timestamp, payload.group_id, ...photoIds)
        .run();
      const nextCover = await db
        .prepare(
          "SELECT id FROM photo_assets WHERE photo_group_id = ? AND deleted_at IS NULL ORDER BY created_at LIMIT 1",
        )
        .bind(payload.group_id)
        .first<{ id: string }>();
      await db
        .prepare(
          "UPDATE photo_groups SET cover_photo_id = ?, updated_at = ? WHERE id = ?",
        )
        .bind(nextCover?.id ?? null, timestamp, payload.group_id)
        .run();
    } else if (action === "mergePhotoGroups") {
      const sourceId = text(payload.source_id);
      const targetId = text(payload.target_id);
      if (!sourceId || !targetId || sourceId === targetId) {
        throw new Error("请选择两个不同的照片组");
      }
      const target = await db
        .prepare("SELECT id FROM photo_groups WHERE id = ? AND deleted_at IS NULL")
        .bind(targetId)
        .first();
      if (!target) throw new Error("目标照片组不存在");
      await db.batch([
        db
          .prepare(
            "UPDATE photo_assets SET photo_group_id = ?, updated_at = ? WHERE photo_group_id = ?",
          )
          .bind(targetId, timestamp, sourceId),
        db
          .prepare(
            "UPDATE captures SET photo_group_id = ?, updated_at = ? WHERE photo_group_id = ?",
          )
          .bind(targetId, timestamp, sourceId),
        db
          .prepare(
            "UPDATE photo_groups SET deleted_at = ?, updated_at = ? WHERE id = ?",
          )
          .bind(timestamp, timestamp, sourceId),
      ]);
    } else if (action === "createTrip") {
      const id = uid("tri");
      await db
        .prepare(
          `INSERT INTO trips (
            id, name, start_date, end_date, cities, status, planning_notes,
            places_to_visit, research_questions, final_summary, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          text(payload.name, "未命名旅程"),
          nullable(payload.start_date),
          nullable(payload.end_date),
          nullable(payload.cities),
          text(payload.status, "构想中"),
          nullable(payload.planning_notes),
          nullable(payload.places_to_visit),
          nullable(payload.research_questions),
          nullable(payload.final_summary),
          timestamp,
          timestamp,
        )
        .run();
      result.id = id;
    } else if (action === "createHistoricalVisit") {
      let venueId = text(payload.venue_id);
      if (!venueId) venueId = await createVenue(db, payload);
      let exhibitionId = "";
      if (payload.exhibition_title) {
        exhibitionId = await createExhibition(db, {
          title: payload.exhibition_title,
          venue_id: venueId,
          exhibition_type: "临时展",
          status: "已经参观",
          verification_status: "用户输入",
        });
      }
      result.id = await startVisit(db, {
        venue_id: venueId,
        visit_date: text(payload.visit_date, "不确定"),
        date_precision: text(payload.date_precision, "uncertain"),
        started_at: null,
        visit_status: "待整理",
        one_sentence_summary: payload.one_sentence_summary,
        exhibition_ids: exhibitionId ? [exhibitionId] : [],
      });
      if (payload.tags) {
        for (const tag of text(payload.tags)
          .split(/[，,]/)
          .map((item) => item.trim())
          .filter(Boolean)) {
          await upsertTagLink(db, tag, "visit", String(result.id));
        }
      }
    } else if (action === "importCsv") {
      const rows = Array.isArray(payload.rows) ? payload.rows : [];
      let imported = 0;
      for (const row of rows) {
        const existingVenue = await db
          .prepare(
            "SELECT id FROM venues WHERE name = ? AND city = ? AND country = ? AND deleted_at IS NULL LIMIT 1",
          )
          .bind(row["Venue 名称"], row["城市"], row["国家"])
          .first<{ id: string }>();
        const venueId =
          existingVenue?.id ??
          (await createVenue(db, {
            name: row["Venue 名称"],
            city: row["城市"],
            country: row["国家"],
            venue_type: "其他文化地点",
          }));
        await (async () => {
          const exhibitionTitle = text(row["Exhibition 名称"]);
          const existingExhibition = exhibitionTitle
            ? await db
                .prepare(
                  "SELECT id FROM exhibitions WHERE title = ? AND venue_id = ? AND deleted_at IS NULL LIMIT 1",
                )
                .bind(exhibitionTitle, venueId)
                .first<{ id: string }>()
            : null;
          const exhibitionId =
            existingExhibition?.id ??
            (exhibitionTitle
              ? await createExhibition(db, {
                  title: exhibitionTitle,
                  venue_id: venueId,
                  status: "已经参观",
                })
              : "");
          const visitId = await startVisit(db, {
            venue_id: venueId,
            visit_date: text(row["Visit 日期"], "不确定"),
            date_precision: text(row["Visit 日期"]).length === 4 ? "year" : "day",
            started_at: null,
            visit_status: "待整理",
            one_sentence_summary: row["一句话笔记"],
            exhibition_ids: exhibitionId ? [exhibitionId] : [],
          });
          for (const tag of text(row["标签"])
            .split(/[，,]/)
            .map((item) => item.trim())
            .filter(Boolean)) {
            await upsertTagLink(db, tag, "visit", visitId);
          }
        })();
        imported += 1;
      }
      result.imported = imported;
    } else if (action === "softDelete") {
      const tableMap: Record<string, string> = {
        venue: "venues",
        exhibition: "exhibitions",
        visit: "visits",
        object: "object_records",
        capture: "captures",
        photo: "photo_assets",
        photo_group: "photo_groups",
        trip: "trips",
      };
      const table = tableMap[text(payload.entity_type)];
      if (!table) throw new Error("不支持的删除类型");
      await db
        .prepare(
          `UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`,
        )
        .bind(timestamp, timestamp, payload.id)
        .run();
    } else if (action === "restore") {
      const tableMap: Record<string, string> = {
        venue: "venues",
        exhibition: "exhibitions",
        visit: "visits",
        object: "object_records",
        capture: "captures",
        photo: "photo_assets",
        photo_group: "photo_groups",
        trip: "trips",
      };
      const table = tableMap[text(payload.entity_type)];
      if (!table) throw new Error("不支持的恢复类型");
      await db
        .prepare(
          `UPDATE ${table} SET deleted_at = NULL, updated_at = ? WHERE id = ?`,
        )
        .bind(timestamp, payload.id)
        .run();
    } else if (action === "emptyTrash") {
      const deletedPhotos = await db
        .prepare(
          "SELECT id, storage_key FROM photo_assets WHERE deleted_at IS NOT NULL",
        )
        .all<{ id: string; storage_key: string }>();
      const bindings = getArchiveEnv();
      for (const photo of deletedPhotos.results ?? []) {
        await bindings.PHOTOS.delete(photo.storage_key);
      }
      await db.batch([
        db.prepare(
          "DELETE FROM photo_links WHERE photo_id IN (SELECT id FROM photo_assets WHERE deleted_at IS NOT NULL)",
        ),
        db.prepare(
          "DELETE FROM visit_exhibitions WHERE visit_id IN (SELECT id FROM visits WHERE deleted_at IS NOT NULL) OR exhibition_id IN (SELECT id FROM exhibitions WHERE deleted_at IS NOT NULL)",
        ),
        db.prepare(
          "DELETE FROM visit_objects WHERE visit_id IN (SELECT id FROM visits WHERE deleted_at IS NOT NULL) OR object_id IN (SELECT id FROM object_records WHERE deleted_at IS NOT NULL)",
        ),
        db.prepare(
          "DELETE FROM tag_links WHERE entity_id IN (SELECT id FROM object_records WHERE deleted_at IS NOT NULL) OR entity_id IN (SELECT id FROM visits WHERE deleted_at IS NOT NULL) OR entity_id IN (SELECT id FROM captures WHERE deleted_at IS NOT NULL)",
        ),
        db.prepare("DELETE FROM captures WHERE deleted_at IS NOT NULL"),
        db.prepare("DELETE FROM photo_assets WHERE deleted_at IS NOT NULL"),
        db.prepare("DELETE FROM photo_groups WHERE deleted_at IS NOT NULL"),
        db.prepare("DELETE FROM object_records WHERE deleted_at IS NOT NULL"),
        db.prepare("DELETE FROM visits WHERE deleted_at IS NOT NULL"),
        db.prepare("DELETE FROM exhibitions WHERE deleted_at IS NOT NULL"),
        db.prepare("DELETE FROM trips WHERE deleted_at IS NOT NULL"),
        db.prepare("DELETE FROM venues WHERE deleted_at IS NOT NULL"),
      ]);
    } else if (action === "seedDemo") {
      await seedDemo();
    } else if (action === "clearDemo") {
      await clearDemo();
    } else if (action === "restoreJson") {
      result = await restoreExport(db, payload.archive ?? {});
    } else {
      throw new Error("未知操作");
    }

    return NextResponse.json({
      ok: true,
      result,
      snapshot: await getSnapshot(db),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存失败" },
      { status: 400 },
    );
  }
}

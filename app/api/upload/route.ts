import { NextResponse } from "next/server";
import {
  ensureArchiveSchema,
  getArchiveEnv,
  getSnapshot,
  now,
  uid,
} from "../../../db/archive";

const captureTypeByPhoto: Record<string, string> = {
  object_main: "作品照片",
  object_detail: "局部照片",
  label: "铭牌照片",
  gallery: "展厅照片",
  architecture: "建筑照片",
  environment: "环境照片",
  document: "待查资料",
  other: "作品照片",
};

export async function POST(request: Request) {
  const storedKeys: string[] = [];
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 80 * 1024 * 1024) {
      throw new Error("一次上传总大小不能超过 80 MB");
    }
    const { DB: db, PHOTOS: bucket } = getArchiveEnv();
    await ensureArchiveSchema(db);
    const form = await request.formData();
    const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
    const visitId = String(form.get("visit_id") ?? "");
    const exhibitionId = String(form.get("exhibition_id") ?? "");
    const photoType = String(form.get("photo_type") ?? "other");
    const isHighlight = String(form.get("is_highlight") ?? "") === "1";
    if (!visitId) throw new Error("缺少当前参观");
    if (!files.length) throw new Error("请选择照片");
    if (files.length > 30) throw new Error("一次最多上传 30 张照片");

    const created: Array<{ id: string; capture_id: string }> = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        throw new Error(`${file.name} 不是支持的图片文件`);
      }
      if (file.size > 35 * 1024 * 1024) {
        throw new Error(`${file.name} 超过 35 MB`);
      }
      const timestamp = now();
      const photoId = uid("pho");
      const captureId = uid("cap");
      const extension =
        file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "img";
      const storageKey = `originals/${timestamp.slice(0, 7)}/${photoId}.${extension || "img"}`;
      const bytes = await file.arrayBuffer();
      await bucket.put(storageKey, bytes, {
        httpMetadata: { contentType: file.type || "application/octet-stream" },
        customMetadata: {
          originalFilename: file.name.slice(0, 512),
          uploadedAt: timestamp,
        },
      });
      storedKeys.push(storageKey);
      await db.batch([
        db
          .prepare(
            `INSERT INTO photo_assets (
              id, storage_key, original_filename, mime_type, file_size,
              shot_at, photo_type, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            photoId,
            storageKey,
            file.name,
            file.type || "application/octet-stream",
            file.size,
            form.get("shot_at") || null,
            photoType,
            timestamp,
            timestamp,
          ),
        db
          .prepare(
            `INSERT INTO captures (
              id, visit_id, capture_type, photo_asset_id, exhibition_id,
              captured_at, processing_status, is_highlight, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, '未整理', ?, ?, ?)`,
          )
          .bind(
            captureId,
            visitId,
            captureTypeByPhoto[photoType] ?? "作品照片",
            photoId,
            exhibitionId || null,
            timestamp,
            isHighlight ? 1 : 0,
            timestamp,
            timestamp,
          ),
        db
          .prepare(
            "INSERT INTO photo_links (photo_id, entity_type, entity_id, created_at) VALUES (?, 'visit', ?, ?)",
          )
          .bind(photoId, visitId, timestamp),
        db
          .prepare(
            "INSERT INTO photo_links (photo_id, entity_type, entity_id, created_at) SELECT ?, 'capture', ?, ?",
          )
          .bind(photoId, captureId, timestamp),
      ]);
      if (exhibitionId) {
        await db
          .prepare(
            "INSERT OR IGNORE INTO photo_links (photo_id, entity_type, entity_id, created_at) VALUES (?, 'exhibition', ?, ?)",
          )
          .bind(photoId, exhibitionId, timestamp)
          .run();
      }
      created.push({ id: photoId, capture_id: captureId });
    }

    return NextResponse.json({
      ok: true,
      created,
      snapshot: await getSnapshot(db),
    });
  } catch (error) {
    try {
      const { PHOTOS: bucket } = getArchiveEnv();
      for (const key of storedKeys) await bucket.delete(key);
    } catch {
      // Cleanup is best-effort; failed uploads never create metadata rows.
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "上传失败" },
      { status: 400 },
    );
  }
}

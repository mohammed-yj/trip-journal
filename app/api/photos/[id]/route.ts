import { getArchiveEnv, ensureArchiveSchema } from "../../../../db/archive";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { DB: db, PHOTOS: bucket } = getArchiveEnv();
  await ensureArchiveSchema(db);
  const photo = await db
    .prepare(
      "SELECT storage_key, mime_type, original_filename FROM photo_assets WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(id)
    .first<{
      storage_key: string;
      mime_type: string;
      original_filename: string;
    }>();
  if (!photo) return new Response("照片不存在", { status: 404 });
  const object = await bucket.get(photo.storage_key);
  if (!object) return new Response("原始照片文件不存在", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", photo.mime_type);
  headers.set("cache-control", "private, max-age=3600");
  headers.set("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(photo.original_filename)}`);
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}

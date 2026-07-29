import {
  getArchiveDb,
  getSnapshot,
  SCHEMA_VERSION,
} from "../../../db/archive";

type Row = Record<string, any>;

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: Row[], fields?: string[]) {
  const headers =
    fields ??
    Array.from(
      new Set(rows.flatMap((row) => Object.keys(row))),
    );
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((field) => csvCell(row[field])).join(",")),
  ].join("\r\n");
}

function attachment(body: BodyInit, type: string, filename: string) {
  return new Response(body, {
    headers: {
      "content-type": `${type}; charset=utf-8`,
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function nameOf(rows: Row[], id: unknown, key = "name") {
  return rows.find((row) => row.id === id)?.[key] ?? "未关联";
}

function tagsFor(snapshot: any, entityType: string, entityId: string) {
  const tagIds = snapshot.tag_links
    .filter(
      (link: Row) =>
        link.entity_type === entityType && link.entity_id === entityId,
    )
    .map((link: Row) => link.tag_id);
  return snapshot.tags
    .filter((tag: Row) => tagIds.includes(tag.id))
    .map((tag: Row) => tag.name)
    .join("、");
}

function visitMarkdown(snapshot: any, visit: Row) {
  const venue = snapshot.venues.find((row: Row) => row.id === visit.venue_id);
  const exhibitionIds = snapshot.visit_exhibitions
    .filter((link: Row) => link.visit_id === visit.id)
    .map((link: Row) => link.exhibition_id);
  const exhibitions = snapshot.exhibitions.filter((row: Row) =>
    exhibitionIds.includes(row.id),
  );
  const captures = snapshot.captures.filter(
    (row: Row) => row.visit_id === visit.id,
  );
  const photos = snapshot.photos.filter((photo: Row) =>
    snapshot.photo_links.some(
      (link: Row) =>
        link.photo_id === photo.id &&
        link.entity_type === "visit" &&
        link.entity_id === visit.id,
    ),
  );
  return `# ${venue?.name ?? "一次参观"} · ${visit.visit_date}

- 状态：${visit.visit_status}
- 场馆：${venue?.name ?? "未关联"}
- 展览：${exhibitions.map((row: Row) => row.title).join("、") || "未关联"}
- 时长：${visit.duration_minutes ? `${visit.duration_minutes} 分钟` : "未记录"}
- 标签：${tagsFor(snapshot, "visit", visit.id) || "无"}

## 一句话总结

${visit.one_sentence_summary || "未填写"}

## 重点

${visit.highlights || "未填写"}

## 未解决的问题

${visit.unresolved_questions || "未填写"}

## 详细笔记

${visit.detailed_notes || "未填写"}

## 现场记录

${captures
  .map(
    (capture: Row) =>
      `- ${capture.captured_at} · ${capture.capture_type}${capture.text_content ? `：${capture.text_content}` : ""}`,
  )
  .join("\n") || "无"}

## 照片文件

${photos.map((photo: Row) => `- ${photo.original_filename}（${photo.photo_type}）`).join("\n") || "无"}
`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
  const type = url.searchParams.get("type") ?? "visits";
  const id = url.searchParams.get("id");
  const db = getArchiveDb();
  const snapshot = await getSnapshot(db);
  const date = new Date().toISOString().slice(0, 10);

  if (format === "template") {
    const headers = [
      "Venue 名称",
      "城市",
      "国家",
      "Visit 日期",
      "Exhibition 名称",
      "一句话笔记",
      "标签",
    ];
    const body = `\uFEFF${toCsv([], headers)}\r\n`;
    return attachment(body, "text/csv", "观迹-历史参观导入模板.csv");
  }

  if (format === "json") {
    const archive = {
      ...snapshot,
      schema_version: SCHEMA_VERSION,
      export_date: new Date().toISOString(),
      export_scope: "结构化数据与照片元数据",
      photo_files_included: false,
      photo_download_note:
        "原始照片未嵌入 JSON。可在观迹的数据页逐张下载；照片清单已包含在 photos 数组中。",
    };
    return attachment(
      JSON.stringify(archive, null, 2),
      "application/json",
      `观迹-完整数据-${date}.json`,
    );
  }

  if (format === "csv") {
    let rows: Row[] = [];
    if (type === "venues") rows = snapshot.venues;
    else if (type === "exhibitions") {
      rows = snapshot.exhibitions.map((row: Row) => ({
        ...row,
        venue_name: nameOf(snapshot.venues, row.venue_id),
      }));
    } else if (type === "objects") {
      rows = snapshot.objects.map((row: Row) => ({
        ...row,
        venue_name: nameOf(snapshot.venues, row.current_venue_id),
        exhibition_title: nameOf(
          snapshot.exhibitions,
          row.exhibition_id,
          "title",
        ),
        tags: tagsFor(snapshot, "object", row.id),
      }));
    } else if (type === "trips") rows = snapshot.trips;
    else if (type === "photos") {
      rows = snapshot.photos.map((row: Row) => ({
        ...row,
        download_url: `/api/photos/${row.id}`,
      }));
    } else {
      rows = snapshot.visits.map((row: Row) => ({
        ...row,
        venue_name: nameOf(snapshot.venues, row.venue_id),
        exhibition_titles: snapshot.visit_exhibitions
          .filter((link: Row) => link.visit_id === row.id)
          .map((link: Row) =>
            nameOf(snapshot.exhibitions, link.exhibition_id, "title"),
          )
          .join("、"),
        tags: tagsFor(snapshot, "visit", row.id),
      }));
    }
    return attachment(
      `\uFEFF${toCsv(rows)}\r\n`,
      "text/csv",
      `观迹-${type}-${date}.csv`,
    );
  }

  if (format === "md") {
    if (type === "visit") {
      const visit =
        snapshot.visits.find((row: Row) => row.id === id) ??
        snapshot.visits[0];
      if (!visit) return new Response("没有可导出的参观", { status: 404 });
      return attachment(
        visitMarkdown(snapshot, visit),
        "text/markdown",
        `观迹-参观-${visit.visit_date}.md`,
      );
    }
    if (type === "object") {
      const object =
        snapshot.objects.find((row: Row) => row.id === id) ??
        snapshot.objects[0];
      if (!object) return new Response("没有可导出的对象", { status: 404 });
      const photos = snapshot.photos.filter((photo: Row) =>
        snapshot.photo_links.some(
          (link: Row) =>
            link.photo_id === photo.id &&
            link.entity_type === "object" &&
            link.entity_id === object.id,
        ),
      );
      const markdown = `# ${object.title}

- 类型：${object.object_type}
- 作者或文化：${object.creator || object.culture_or_dynasty || "未填写"}
- 年代：${object.date_display || "未填写"}
- 材料：${object.material || "未填写"}
- 场馆：${nameOf(snapshot.venues, object.current_venue_id)}
- 展览：${nameOf(snapshot.exhibitions, object.exhibition_id, "title")}
- 标签：${tagsFor(snapshot, "object", String(object.id)) || "无"}

## 现场观察

${object.personal_observation || "未填写"}

## 研究笔记

${object.research_notes || "未填写"}

## 铭牌文字

${object.label_transcription || "未填写"}

## 照片文件

${photos.map((photo: Row) => `- ${photo.original_filename}`).join("\n") || "无"}
`;
      return attachment(
        markdown,
        "text/markdown",
        `观迹-对象-${object.title}.md`,
      );
    }
  }
  return new Response("不支持的导出格式", { status: 400 });
}
